// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE COMPRAS Y PAGOS (MIGRAD0 DESDE ADMIN.JS)
// ═══════════════════════════════════════════════════════════════

comprasData = [];
compraItemsProvisionales = [];
productosAutocomplete = [];

// Función principal para cargar compras
async function cargarCompras() {
    // Cargar compras inicial
    const tbody = document.getElementById('tbodyCompras') || document.querySelector('#tableCompras tbody');

    if (!tbody) {
        console.warn('⚠️ No se encontró #tbodyCompras');
        return;
    }

    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando historial...</td></tr>';

    try {
        const { data, error } = await supabaseClient
            .from('compras_proveedor')
            .select(`
                *,
                proveedores ( razon_social )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        comprasData = data || [];
        renderTablaCompras();
        actualizarResumenCompras();
    } catch (e) {
        console.error('Error cargando compras:', e);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error: ${e.message}</td></tr>`;
    }
}
window.cargarCompras = cargarCompras;

function renderTablaCompras(data = null) {
    const lista = data || comprasData;
    const tbody = document.getElementById('tbodyCompras') || document.querySelector('#tableCompras tbody');
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay compras registradas</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(c => {
        // Calcular saldo dinámicamente si no viene calculado de DB
        const mesesKeys = ['pago_ene', 'pago_feb', 'pago_mar', 'pago_abr', 'pago_may', 'pago_jun', 'pago_jul', 'pago_ago', 'pago_sep', 'pago_oct', 'pago_nov', 'pago_dic'];
        const totalPagado = mesesKeys.reduce((acc, mk) => acc + (parseFloat(c[mk]) || 0), 0);
        const saldo = (c.valor_compra || 0) - totalPagado;

        return `
            <tr>
                <td>
                    <div style="font-weight:bold;">${new Date(c.created_at).toLocaleDateString()}</div>
                    <div style="font-size:0.8rem; color:#64748b;">${c.anio} - ${c.mes_compra || ''}</div>
                </td>
                <td>
                    <div style="font-weight:bold; color:#1e293b;">${c.proveedores?.razon_social || 'Proveedor Desconocido'}</div>
                    <div style="font-size:0.8rem;">FAC: ${c.numero_factura || 'S/N'}</div>
                </td>
                <td>
                    <div style="font-weight:600;">$${formatearPrecio(c.valor_compra)}</div>
                </td>
                <td>
                    <div style="color:${saldo > 0 ? '#ef4444' : '#10b981'}; font-weight:bold;">
                        $${formatearPrecio(saldo > 0 ? saldo : 0)}
                    </div>
                </td>
                <td><span class="badge ${c.estado === 'CERRADO' ? 'badge-success' : 'badge-warning'}">${c.estado || 'PENDIENTE'}</span></td>
                <td>
                    <div style="display:flex; gap:0.5rem; justify-content:center;">
                        <button onclick="verDetalleCompra('${c.id}')" class="btn btn-sm btn-info" title="Ver Detalle / Pagos">📋</button>
                        <button onclick="imprimirCompra('${c.id}')" class="btn btn-sm btn-warning" title="Imprimir PDF">🖨️</button>
                        <button onclick="eliminarCompra('${c.id}')" class="btn btn-sm btn-danger" title="Eliminar">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    actualizarResumenCompras();
}

// Cargar caché de productos para el autocompletado
async function cargarProductosAutocomplete() {
    try {
        const { data, error } = await supabaseClient.from('productos').select('id, nombre, id_producto, precio, precio_compra, variantes');
        if (!error && data) {
            productosAutocomplete = data;
        }
    } catch (e) { console.error('Error cache productos autocomplete', e); }
}

async function cargarProveedoresDatalistCompra() {
    const dl = document.getElementById('listaProveedoresDatalist');
    if (!dl) return;
    dl.innerHTML = '';
    try {
        const { data, error } = await supabaseClient.from('proveedores').select('razon_social').eq('activo', true).order('razon_social');
        if (!error && data) {
            dl.innerHTML = data.map(p => `<option value="${p.razon_social}">`).join('');
        }
    } catch (e) { console.error('Error cargando proveedores datalist', e); }
}

// ------------------------------------------------------------------
// FORMULARIO DE COMPRA
// ------------------------------------------------------------------

async function mostrarFormCompra() {
    document.getElementById('formCompra').style.display = 'block';

    // Reset inputs
    if (document.getElementById('compraId')) document.getElementById('compraId').value = '';
    if (document.getElementById('compraProveedor')) document.getElementById('compraProveedor').value = '';
    const fact = document.getElementById('compraFactura'); if (fact) fact.value = '';
    const venc = document.getElementById('compraVencimiento'); if (venc) venc.value = '';
    const notas = document.getElementById('compraNotas'); if (notas) notas.value = '';

    if (document.getElementById('tbodyCompraItems')) document.getElementById('tbodyCompraItems').innerHTML = '';
    if (document.getElementById('compraTotalGeneral')) document.getElementById('compraTotalGeneral').textContent = '$0';

    compraItemsProvisionales = [];

    // Cargar productos y esperar a que termine antes de llenar la lista
    await Promise.all([
        cargarProductosAutocomplete(),
        cargarProveedoresDatalistCompra()
    ]);

    // Llenar datalist de productos
    actualizarDatalistProductos();
}
window.mostrarFormCompra = mostrarFormCompra;

function actualizarDatalistProductos() {
    // Si tienes un datalist global para productos, llénalo aquí
    let datalist = document.getElementById('listProductosAutocomplete');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'listProductosAutocomplete';
        document.body.appendChild(datalist);
    }
    // IMPORTANTE: Mapear productosAutocomplete
    datalist.innerHTML = productosAutocomplete.map(p => `<option value="${p.nombre}">${p.id_producto} - $${p.precio}</option>`).join('');
}


function cancelarFormCompra() {
    document.getElementById('formCompra').style.display = 'none';
}
window.cancelarFormCompra = cancelarFormCompra;

// Items de Compra
function agregarFilaItemCompra() {
    const tbody = document.getElementById('tbodyCompraItems');
    if (!tbody) return;
    const index = compraItemsProvisionales.length;

    // Objeto item vacío
    compraItemsProvisionales.push({
        producto_id: '',
        nombre_producto: '',
        cantidad_total: 1,
        costo_unitario: 0,
        precio_venta: 0,
        subtotal: 0,
        margen_porcentaje: 0,
        costo_anterior: 0,
        distribucion: { alcala: 0, local01: 0, jordan: 0, digital: 0 },
        colores: ''
    });

    const tr = document.createElement('tr');
    tr.id = `itemRow-${index}`;
    tr.innerHTML = renderHTMLFilaItem(index);
    tbody.appendChild(tr);
}
window.agregarFilaItemCompra = agregarFilaItemCompra;

function renderHTMLFilaItem(index) {
    return `
        <td>
            <input type="text" class="form-control" list="listProductosAutocomplete" 
                onchange="seleccionarProductoCompra(this, ${index})" placeholder="Buscar producto...">
        </td>
        <td>
            <input type="number" class="form-control text-center" value="1" min="1" 
                onchange="actualizarCalculosItem(${index}, 'cantidad', this.value)">
        </td>
        <td>
            <input type="text" class="form-control" placeholder="$0" 
                onchange="actualizarCalculosItem(${index}, 'costo', this.value)" onblur="formatearMonedaInput(this)">
            <div id="costoAnterior-${index}" style="font-size:0.7rem; color:#64748b; margin-top:2px;"></div>
        </td>
        <td>
            <input type="text" class="form-control" placeholder="$0" 
                onchange="actualizarCalculosItem(${index}, 'venta', this.value)" onblur="formatearMonedaInput(this)">
        </td>
        <td class="text-center">
            <span id="margenItem-${index}" class="badge badge-light" style="font-size:0.85rem;">0%</span>
        </td>
        <td id="subtotalItem-${index}" style="font-weight:bold;">$0</td>
        <td>
            <button onclick="abrirModalDistribucion(${index})" class="btn btn-sm btn-outline-primary">📍 Distribuir</button>
        </td>
        <td>
            <button onclick="eliminarFilaItem(${index})" class="btn btn-sm btn-light text-danger">🗑️</button>
        </td>
    `;
}

function actualizarCalculosItem(index, campo, valor) {
    const item = compraItemsProvisionales[index];
    if (!item) return;

    if (campo === 'cantidad') item.cantidad_total = parseInt(valor) || 0;

    // Asegurar que pasamos string o limpiar directamente
    if (campo === 'costo') item.costo_unitario = limpiarMoneda(valor);
    if (campo === 'venta') item.precio_venta = limpiarMoneda(valor);

    item.subtotal = item.cantidad_total * item.costo_unitario;

    // Calcular Margen
    let margen = 0;
    if (item.precio_venta > 0) {
        margen = ((item.precio_venta - item.costo_unitario) / item.precio_venta) * 100;
    }
    item.margen_porcentaje = margen;

    // Actualizar UI Margen
    const margenEl = document.getElementById(`margenItem-${index}`);
    if (margenEl) {
        margenEl.textContent = Math.round(margen) + '%';
        // Limpiar clases previas de badge
        margenEl.classList.remove('badge-success', 'badge-warning', 'badge-danger', 'badge-light');
        if (margen < 15) margenEl.classList.add('badge-danger');
        else if (margen < 30) margenEl.classList.add('badge-warning');
        else margenEl.classList.add('badge-success');
    }

    const subtotalEl = document.getElementById(`subtotalItem-${index}`);
    if (subtotalEl) subtotalEl.textContent = '$' + formatearPrecio(item.subtotal);

    actualizarTotalGeneralCompra();

    // Si ya estamos en el modal de este item, actualizar suma visual
    if (indexDistribucionActual === index) {
        calcularSumaDistribucion();
    }
}
window.actualizarCalculosItem = actualizarCalculosItem;

function actualizarTotalGeneralCompra() {
    const total = compraItemsProvisionales.reduce((acc, item) => acc + (item.subtotal || 0), 0);
    const el = document.getElementById('compraTotalGeneral');
    if (el) el.textContent = '$' + formatearPrecio(total);
}

// Distribución
// Distribución
let indexDistribucionActual = -1;
let variantesDistribucionActual = []; // Array de objetos {color, talla, alcala, local01, jordan, digital, url_imagen}

async function abrirModalDistribucion(index) {
    indexDistribucionActual = index;
    const item = compraItemsProvisionales[index];
    if (!item) return;

    document.getElementById('modalDistribucion').style.display = 'flex';
    document.getElementById('distProductoTitulo').textContent = item.nombre_producto || 'Producto Nuevo';
    const errEl = document.getElementById('distError');
    if (errEl) errEl.style.display = 'none';

    // 1. Si ya tiene distribución detallada en esta sesión, usarla
    if (Array.isArray(item.distribucion_detallada) && item.distribucion_detallada.length > 0) {
        variantesDistribucionActual = JSON.parse(JSON.stringify(item.distribucion_detallada));
        renderizarTablaDistribucion();
        calcularSumaDistribucion();
        return;
    }

    // 2. Si no, consultar el inventario real en base de datos para este producto
    try {
        const idProd = item.producto_id;
        if (idProd && idProd !== 'N/A') {
            const [invA, invL, invJ] = await Promise.all([
                supabaseClient.from('inventario_alcala').select('talla, color, cantidad').eq('id_producto', idProd),
                supabaseClient.from('inventario_01').select('talla, color, cantidad').eq('id_producto', idProd),
                supabaseClient.from('inventario_jordan').select('talla, color, cantidad').eq('id_producto', idProd)
            ]);

            // Unificar combinaciones de Color + Talla
            const combinaciones = new Map();
            const procesar = (data, sede) => {
                (data || []).forEach(i => {
                    const key = `${i.color || ''}|${i.talla || 'Única'}`;
                    if (!combinaciones.has(key)) {
                        combinaciones.set(key, { color: i.color || '', talla: i.talla || 'Única', alcala: 0, local01: 0, jordan: 0, digital: 0, url_imagen: '', stock_actual: { alcala: 0, local01: 0, jordan: 0, digital: 0 } });
                    }
                    combinaciones.get(key).stock_actual[sede] = i.cantidad || 0;
                });
            };

            procesar(invA.data, 'alcala');
            procesar(invL.data, 'local01');
            procesar(invJ.data, 'jordan');

            if (combinaciones.size > 0) {
                // Convertir el mapa a la lista de variantes para el modal
                variantesDistribucionActual = Array.from(combinaciones.values()).sort((a, b) => a.color.localeCompare(b.color) || a.talla.localeCompare(b.talla));
            } else {
                // Fallback: Si no hay inventario previo, crear fila inicial
                variantesDistribucionActual = [{
                    color: item.colores || '',
                    talla: 'Única',
                    alcala: 0, local01: 0, jordan: 0, digital: 0,
                    url_imagen: '',
                    stock_actual: { alcala: 0, local01: 0, jordan: 0, digital: 0 }
                }];
            }
        } else {
            // Producto nuevo o sin ID
            variantesDistribucionActual = [{
                color: '', talla: 'Única',
                alcala: 0, local01: 0, jordan: 0, digital: 0,
                url_imagen: '',
                stock_actual: { alcala: 0, local01: 0, jordan: 0, digital: 0 }
            }];
        }
    } catch (e) {
        console.error('Error cargando inventario para distribución:', e);
        variantesDistribucionActual = [{ color: '', talla: 'Única', alcala: 0, local01: 0, jordan: 0, digital: 0, url_imagen: '', stock_actual: { alcala: 0, local01: 0, jordan: 0, digital: 0 } }];
    }

    renderizarTablaDistribucion();
    calcularSumaDistribucion();
}
window.abrirModalDistribucion = abrirModalDistribucion;

function renderizarTablaDistribucion() {
    const tbody = document.getElementById('tbodyDistribucionCompra');
    if (!tbody) return;
    tbody.innerHTML = '';

    const item = compraItemsProvisionales[indexDistribucionActual];
    const prod = productosAutocomplete.find(p => p.id_producto === item.producto_id);
    const coloresSugeridos = prod && prod.variantes ? (Array.isArray(prod.variantes) ? prod.variantes.map(v => typeof v === 'object' ? (v.color || v.nombre) : v) : [prod.variantes]) : [];

    variantesDistribucionActual.forEach((v, idx) => {
        const tr = document.createElement('tr');
        const st = v.stock_actual || { alcala: 0, local01: 0, jordan: 0, digital: 0 };

        tr.innerHTML = `
            <td class="text-center" style="vertical-align: middle;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                    <div class="dist-img-preview" style="width: 48px; height: 48px; background: #f1f5f9; border-radius: 4px; overflow: hidden; border: 1px solid #e2e8f0;">
                        <img src="${v.url_imagen || 'https://via.placeholder.com/48'}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <button type="button" class="btn btn-xs btn-outline-info" style="padding: 0 4px; font-size: 10px;" onclick="subirImagenVarianteCompra(${idx})">📷</button>
                </div>
            </td>
            <td>
                <input type="text" class="form-control form-control-sm dist-color" value="${v.color || ''}" list="listColoresSugeridos-${idx}" oninput="actualizarVarianteTemporal(${idx}, 'color', this.value)">
                <datalist id="listColoresSugeridos-${idx}">
                    ${coloresSugeridos.map(c => `<option value="${c}">`).join('')}
                </datalist>
            </td>
            <td>
                <input type="text" class="form-control form-control-sm dist-talla" value="${v.talla || ''}" placeholder="Talla" oninput="actualizarVarianteTemporal(${idx}, 'talla', this.value)">
            </td>
            <td>
                <input type="number" class="form-control form-control-sm dist-sede" value="${v.alcala || 0}" min="0" oninput="actualizarVarianteTemporal(${idx}, 'alcala', this.value)">
                <div style="font-size: 10px; color: #64748b; text-align: center; margin-top: 2px;">Stock: <strong>${st.alcala}</strong></div>
            </td>
            <td>
                <input type="number" class="form-control form-control-sm dist-sede" value="${v.local01 || 0}" min="0" oninput="actualizarVarianteTemporal(${idx}, 'local01', this.value)">
                <div style="font-size: 10px; color: #64748b; text-align: center; margin-top: 2px;">Stock: <strong>${st.local01}</strong></div>
            </td>
            <td>
                <input type="number" class="form-control form-control-sm dist-sede" value="${v.jordan || 0}" min="0" oninput="actualizarVarianteTemporal(${idx}, 'jordan', this.value)">
                <div style="font-size: 10px; color: #64748b; text-align: center; margin-top: 2px;">Stock: <strong>${st.jordan}</strong></div>
            </td>
            <td>
                <input type="number" class="form-control form-control-sm dist-sede" value="${v.digital || 0}" min="0" oninput="actualizarVarianteTemporal(${idx}, 'digital', this.value)">
                <div style="font-size: 10px; color: #64748b; text-align: center; margin-top: 2px;">Stock: <strong>${st.digital}</strong></div>
            </td>
            <td class="text-center" style="vertical-align: middle;">
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="eliminarFilaDistribucion(${idx})">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function agregarFilaDistribucionCompra() {
    variantesDistribucionActual.push({
        color: '', talla: 'Única',
        alcala: 0, local01: 0, jordan: 0, digital: 0,
        url_imagen: '',
        stock_actual: { alcala: 0, local01: 0, jordan: 0, digital: 0 }
    });
    renderizarTablaDistribucion();
}
window.agregarFilaDistribucionCompra = agregarFilaDistribucionCompra;

function eliminarFilaDistribucion(idx) {
    variantesDistribucionActual.splice(idx, 1);
    renderizarTablaDistribucion();
    calcularSumaDistribucion();
}
window.eliminarFilaDistribucion = eliminarFilaDistribucion;

function actualizarVarianteTemporal(idx, campo, valor) {
    if (!variantesDistribucionActual[idx]) return;
    if (['alcala', 'local01', 'jordan', 'digital'].includes(campo)) {
        variantesDistribucionActual[idx][campo] = parseInt(valor) || 0;
        calcularSumaDistribucion();
    } else {
        variantesDistribucionActual[idx][campo] = valor;
    }
}
window.actualizarVarianteTemporal = actualizarVarianteTemporal;

async function subirImagenVarianteCompra(idx) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            showToast('Subiendo imagen de variante...', 'info');
            // Usar la función global subirImagen (definida en admin.js)
            const publicUrl = await window.subirImagen(file, 'productos-imagenes');
            if (publicUrl) {
                variantesDistribucionActual[idx].url_imagen = publicUrl;
                renderizarTablaDistribucion();
                showToast('Imagen subida con éxito');
            }
        } catch (err) {
            console.error('Error subiendo imagen de variante:', err);
            showToast('Error al subir imagen', 'error');
        }
    };
    input.click();
}
window.subirImagenVarianteCompra = subirImagenVarianteCompra;

function calcularSumaDistribucion() {
    let suma = 0;
    variantesDistribucionActual.forEach(v => {
        suma += (v.alcala + v.local01 + v.jordan + v.digital);
    });

    const elSuma = document.getElementById('distTotalSuma');
    if (elSuma) elSuma.textContent = suma;

    const item = compraItemsProvisionales[indexDistribucionActual];
    const errEl = document.getElementById('distError');

    if (item && suma === item.cantidad_total) {
        if (errEl) errEl.style.display = 'none';
        if (elSuma) elSuma.style.color = '#22c55e'; // Verde
    } else {
        if (errEl) errEl.style.display = 'block';
        if (elSuma) elSuma.style.color = '#ef4444'; // Rojo 
    }

    return suma;
}

function guardarDistribucion() {
    if (indexDistribucionActual === -1) return;
    const item = compraItemsProvisionales[indexDistribucionActual];

    const suma = calcularSumaDistribucion();

    if (suma !== item.cantidad_total) {
        showToast(`La cantidad distribuida (${suma}) debe ser exactamente igual a la total (${item.cantidad_total})`, 'warning');
        return;
    }

    // Guardar detalle para persistencia
    item.distribucion_detallada = [...variantesDistribucionActual];

    // Mantener compatibilidad con cabeceras globales
    item.distribucion = {
        alcala: variantesDistribucionActual.reduce((acc, v) => acc + (v.alcala || 0), 0),
        local01: variantesDistribucionActual.reduce((acc, v) => acc + (v.local01 || 0), 0),
        jordan: variantesDistribucionActual.reduce((acc, v) => acc + (v.jordan || 0), 0),
        digital: variantesDistribucionActual.reduce((acc, v) => acc + (v.digital || 0), 0)
    };

    const setsColores = new Set(variantesDistribucionActual.map(v => v.color).filter(Boolean));
    item.colores = Array.from(setsColores).join(', ');

    cerrarModalDistribucion();
    actualizarCalculosItem(indexDistribucionActual, 'cantidad', item.cantidad_total);
}
window.guardarDistribucion = guardarDistribucion;

function cerrarModalDistribucion() {
    document.getElementById('modalDistribucion').style.display = 'none';
}
window.cerrarModalDistribucion = cerrarModalDistribucion;


// GUARDAR COMPRA FINAL
async function guardarCompra() {
    const proveedorNombre = document.getElementById('compraProveedor').value;
    const factura = document.getElementById('compraFactura').value;
    const anio = parseInt(document.getElementById('compraAnio').value);
    const mes = document.getElementById('compraMes')?.value || 'N/A';
    const estadoPago = document.getElementById('compraEstado').value;

    // Calcular valor total
    const valorCalculado = compraItemsProvisionales.reduce((s, i) => s + i.subtotal, 0);

    if (!proveedorNombre) return showToast('Selecciona un proveedor', 'warning');
    if (compraItemsProvisionales.length === 0) return showToast('Agrega productos', 'warning');

    let proveedorId = null;
    const provMatch = window.proveedoresData ? proveedoresData.find(p => p.razon_social === proveedorNombre) : null;
    // Si no hay proveedoresData global, intentar buscarlo o alertar. (Asumimos que admin.js cargó proveedoresData)
    // Pero si estamos en admin-compras.js, necesitamos acceso a proveedoresData.
    // Lo más seguro es buscar en Supabase si no está en memoria.

    if (provMatch) {
        proveedorId = provMatch.id;
    } else {
        // Fallback: buscar en DB
        const { data: p } = await supabaseClient.from('proveedores').select('id').eq('razon_social', proveedorNombre).maybeSingle();
        if (p) proveedorId = p.id;
        else return showToast('Proveedor no válido', 'error');
    }

    try {
        const headerData = {
            proveedor_id: proveedorId,
            anio: anio,
            mes_compra: mes,
            numero_factura: factura,
            valor_compra: valorCalculado,
            estado: estadoPago === 'pagado' ? 'CERRADO' : 'ABIERTO'
        };

        const { data: compraHeader, error: errHeader } = await supabaseClient
            .from('compras_proveedor')
            .insert(headerData)
            .select()
            .single();

        if (errHeader) throw errHeader;
        const compraId = compraHeader.id;

        // 3. Preparar detalles de productos (DESDOBLANDO POR VARIANTE)
        const detallesData = [];
        compraItemsProvisionales.forEach(item => {
            // Si tiene distribución detallada (nuevo sistema), crear una fila por cada variante real
            if (Array.isArray(item.distribucion_detallada) && item.distribucion_detallada.length > 0) {
                item.distribucion_detallada.forEach(v => {
                    const cantVar = (v.alcala + v.local01 + v.jordan + v.digital);
                    if (cantVar > 0) {
                        detallesData.push({
                            compra_id: compraId,
                            nombre_producto: item.nombre_producto,
                            producto_id: item.producto_id || 'N/A',
                            cantidad_total: cantVar,
                            costo_unitario: item.costo_unitario,
                            precio_venta_sugerido: item.precio_venta,
                            subtotal: cantVar * item.costo_unitario,
                            cantidad_alcala: v.alcala,
                            cantidad_local01: v.local01,
                            cantidad_jordan: v.jordan,
                            cantidad_digital: v.digital,
                            colores: v.color,
                            talla: v.talla,
                            url_imagen: v.url_imagen || ''
                        });
                    }
                });
            } else {
                // Fallback para items sin distribución detallada (si no se abrió el modal)
                detallesData.push({
                    compra_id: compraId,
                    nombre_producto: item.nombre_producto,
                    producto_id: item.producto_id || 'N/A',
                    cantidad_total: item.cantidad_total,
                    costo_unitario: item.costo_unitario,
                    precio_venta_sugerido: item.precio_venta,
                    subtotal: item.subtotal,
                    cantidad_alcala: item.distribucion?.alcala || 0,
                    cantidad_local01: item.distribucion?.local01 || 0,
                    cantidad_jordan: item.distribucion?.jordan || 0,
                    cantidad_digital: item.distribucion?.digital || 0,
                    colores: item.colores,
                    talla: 'Única',
                    url_imagen: ''
                });
            }
        });

        const { error: errDetalles } = await supabaseClient
            .from('compras_detalles')
            .insert(detallesData);

        if (errDetalles) throw errDetalles;

        showToast('Compra guardada correctamente', 'success');
        cancelarFormCompra();
        cargarCompras();

    } catch (e) {
        console.error('Error guardando:', e);
        showToast('Error: ' + e.message, 'error');
    }
}
window.guardarCompra = guardarCompra;

async function seleccionarProductoCompra(input, index) {
    const val = input.value;
    // IMPORTANTE: Buscar en productosAutocomplete
    const prod = productosAutocomplete.find(p => p.nombre === val || p.id_producto === val);

    if (prod) {
        // Asignar datos del producto encontrado
        compraItemsProvisionales[index].producto_id = prod.id_producto;
        compraItemsProvisionales[index].nombre_producto = prod.nombre;

        // Cargar variantes actuales si no tiene colores escritos
        if (!compraItemsProvisionales[index].colores && prod.variantes) {
            if (Array.isArray(prod.variantes)) {
                // Manejar si son objetos (ej: {color: 'Rojo'}) o strings
                compraItemsProvisionales[index].colores = prod.variantes
                    .map(v => typeof v === 'object' ? (v.color || v.nombre || v.talla || JSON.stringify(v)) : v)
                    .join(', ');
            } else {
                compraItemsProvisionales[index].colores = prod.variantes;
            }
        }

        // Actualizar valores visuales
        const tr = document.getElementById(`itemRow-${index}`);
        const inputs = tr.querySelectorAll('input');

        // Formatear precio compra y venta
        inputs[2].value = '$' + formatearPrecio(prod.precio_compra || 0);
        inputs[3].value = '$' + formatearPrecio(prod.precio || 0);

        actualizarCalculosItem(index, 'costo', prod.precio_compra);
        actualizarCalculosItem(index, 'venta', prod.precio);

        // HISTORIAL DE COSTOS: Buscar el costo más reciente en compras_detalles
        try {
            const { data: rec } = await supabaseClient
                .from('compras_detalles')
                .select('costo_unitario, created_at')
                .eq('producto_id', prod.id_producto)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (rec) {
                const labelAnterior = document.getElementById(`costoAnterior-${index}`);
                if (labelAnterior) {
                    labelAnterior.style.display = 'block'; // Asegurar visibilidad
                    labelAnterior.textContent = `Ant: $${formatearPrecio(rec.costo_unitario)}`;
                    labelAnterior.title = `Última compra: ${new Date(rec.created_at).toLocaleDateString()}`;
                    console.log(`Costo anterior encontrado para item ${index}:`, rec.costo_unitario);
                }
                showToast(`Último costo: $${formatearPrecio(rec.costo_unitario)}`, 'info');
            } else {
                const labelAnterior = document.getElementById(`costoAnterior-${index}`);
                if (labelAnterior) labelAnterior.textContent = 'Sin historial';
            }
        } catch (e) { console.warn("Error buscando costo reciente", e); }

    } else {
        compraItemsProvisionales[index].nombre_producto = val;
    }
}
window.seleccionarProductoCompra = seleccionarProductoCompra;

function eliminarFilaItem(index) {
    const tr = document.getElementById(`itemRow-${index}`);
    if (tr) {
        tr.style.display = 'none'; // ocultar visualmente
        if (compraItemsProvisionales[index]) compraItemsProvisionales[index].subtotal = 0; // anular valor
        actualizarTotalGeneralCompra();
    }
}
window.eliminarFilaItem = eliminarFilaItem;

async function verDetalleCompra(id) {
    const modal = document.getElementById('modalDetalleCompra');
    if (!modal) return;

    modal.style.display = 'flex';
    document.getElementById('detalleCompraHeader').innerHTML = '<p>Cargando detalles...</p>';
    document.getElementById('tbodyDetalleCompraItems').innerHTML = '';
    document.getElementById('tbodyDetalleCompraPagos').innerHTML = '';

    try {
        // 1. Obtener cabecera con proveedor
        const { data: compra, error: errCompra } = await supabaseClient
            .from('compras_proveedor')
            .select('*, proveedores(razon_social, nit, contacto_telefono)')
            .eq('id', id)
            .single();

        if (errCompra) throw errCompra;

        // 2. Obtener detalles de productos
        const { data: detalles, error: errDetalles } = await supabaseClient
            .from('compras_detalles')
            .select('*')
            .eq('compra_id', id);

        if (errDetalles) throw errDetalles;

        // Renderizar Cabecera
        document.getElementById('detalleCompraHeader').innerHTML = `
            <div>
                <label style="display:block; font-size:0.8rem; color:#64748b;">Proveedor</label>
                <div style="font-weight:700; font-size:1.1rem;">${compra.proveedores?.razon_social || 'N/A'}</div>
                <div style="font-size:0.85rem;">NIT: ${compra.proveedores?.nit || 'S/N'} | Tel: ${compra.proveedores?.contacto_telefono || '-'}</div>
            </div>
            <div>
                <label style="display:block; font-size:0.8rem; color:#64748b;">Documento</label>
                <div style="font-weight:700;">FAC: ${compra.numero_factura || 'S/N'}</div>
                <div style="font-size:0.85rem;">Fecha: ${new Date(compra.created_at).toLocaleDateString()}</div>
                <div style="font-size:0.85rem;">Periodo: ${compra.anio} - ${compra.mes_compra || ''}</div>
            </div>
            <div>
                <label style="display:block; font-size:0.8rem; color:#64748b;">Estado</label>
                <span class="badge ${compra.estado === 'CERRADO' ? 'badge-success' : 'badge-warning'}">${compra.estado || 'PENDIENTE'}</span>
            </div>
        `;

        // Renderizar Items
        document.getElementById('tbodyDetalleCompraItems').innerHTML = detalles.map(item => `
            <tr>
                <td>
                    <div style="font-weight:600;">${item.nombre_producto}</div>
                    <div style="font-size:0.75rem; color:#64748b;">REF: ${item.producto_id || 'N/A'}</div>
                </td>
                <td style="text-align:center;">${item.cantidad_total}</td>
                <td style="text-align:right;">$${formatearPrecio(item.costo_unitario)}</td>
                <td style="text-align:right; font-weight:600;">$${formatearPrecio(item.subtotal)}</td>
                <td style="font-size:0.8rem;">
                    ${item.cantidad_alcala > 0 ? `📍Alc: ${item.cantidad_alcala} ` : ''}
                    ${item.cantidad_local01 > 0 ? `📍L01: ${item.cantidad_local01} ` : ''}
                    ${item.cantidad_jordan > 0 ? `📍Jor: ${item.cantidad_jordan} ` : ''}
                    ${item.cantidad_digital > 0 ? `📍Dig: ${item.cantidad_digital}` : ''}
                    <div style="color:var(--primary); font-size:0.7rem;">${item.colores || ''}</div>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="5" class="text-center">No se encontraron productos</td></tr>';

        // Renderizar Pagos (Unificar historial detallado y columnas legacy)
        const { data: historialPagos, error: errHistorial } = await supabaseClient
            .from('pagos_proveedor')
            .select('*')
            .eq('compra_id', id)
            .order('fecha_pago', { ascending: false });

        if (errHistorial) console.warn('Error cargando historial detallado:', errHistorial);

        let totalPagado = 0;
        let pagosHTML = '';
        const mesesMapeados = {}; // Para rastrear cuánto de cada mes ya se mostró en el historial detallado

        // 1. Mostrar registros de pagos_proveedor (Detalle moderno y POS)
        if (historialPagos && historialPagos.length > 0) {
            pagosHTML = historialPagos.map(p => {
                totalPagado += parseFloat(p.monto);

                // Rastrear mes si la referencia indica uno (ej: "Abono Mes: FEB")
                if (p.referencia && p.referencia.includes('Abono Mes:')) {
                    const mesCode = p.referencia.split(': ')[1].toLowerCase();
                    const key = `pago_${mesCode}`;
                    mesesMapeados[key] = (mesesMapeados[key] || 0) + parseFloat(p.monto);
                }

                return `
                    <tr>
                        <td>${p.referencia || 'N/A'}</td>
                        <td><span class="badge badge-outline-secondary" style="font-size:0.7rem;">${p.metodo_pago || 'S/N'}</span></td>
                        <td style="text-align:right;">$${formatearPrecio(p.monto)}</td>
                        <td style="text-align:center;">
                            ${p.comprobante_url ? `
                                <button class="btn btn-xs btn-outline-info" onclick="ampliarComprobante('${p.comprobante_url}')" title="Ver Comprobante">
                                    👁️ Ver
                                </button>
                            ` : '<span class="text-muted" style="font-size:0.7rem;">Sin foto</span>'}
                        </td>
                        <td style="font-size:0.85rem; color:#64748b;">${p.notas || '-'}</td>
                    </tr>
                `;
            }).join('');
        }

        // 2. Mostrar abonos de columnas mensuales que NO estén en pagos_proveedor (Legacy o Errores de sincronización)
        const meses = [
            { key: 'pago_ene', label: 'Enero' }, { key: 'pago_feb', label: 'Febrero' }, { key: 'pago_mar', label: 'Marzo' },
            { key: 'pago_abr', label: 'Abril' }, { key: 'pago_may', label: 'Mayo' }, { key: 'pago_jun', label: 'Junio' },
            { key: 'pago_jul', label: 'Julio' }, { key: 'pago_ago', label: 'Agosto' }, { key: 'pago_sep', label: 'Septiembre' },
            { key: 'pago_oct', label: 'Octubre' }, { key: 'pago_nov', label: 'Noviembre' }, { key: 'pago_dic', label: 'Diciembre' },
            // Extensiones 2025/2026 si existen en la data
            { key: 'pago_ene_2025', label: 'Ene 2025' }, { key: 'pago_feb_2025', label: 'Feb 2025' },
            { key: 'pago_ene_2026', label: 'Ene 2026' }, { key: 'pago_feb_2026', label: 'Feb 2026' }
        ];

        meses.forEach(m => {
            const montoColumna = parseFloat(compra[m.key]) || 0;
            const montoYaMostrado = mesesMapeados[m.key] || 0;
            const diferencia = montoColumna - montoYaMostrado;

            if (diferencia > 10) { // Margen de error para decimales
                if (montoYaMostrado === 0) {
                    totalPagado += diferencia;
                    pagosHTML += `
                        <tr>
                            <td>Abono Mes: ${m.label}</td>
                            <td><span class="badge badge-outline-secondary" style="font-size:0.7rem;">Migrado</span></td>
                            <td style="text-align:right;">$${formatearPrecio(diferencia)}</td>
                            <td style="text-align:center;"><small class="text-muted">N/A</small></td>
                            <td style="font-size:0.85rem; color:#64748b;">Abono previo al nuevo sistema</td>
                        </tr>
                    `;
                } else {
                    // Si ya hay algo mostrado pero la columna es mayor, mostrar el ajuste
                    totalPagado += diferencia;
                    pagosHTML += `
                        <tr>
                            <td>Ajuste Mes: ${m.label}</td>
                            <td><span class="badge badge-outline-secondary" style="font-size:0.7rem;">Legacy</span></td>
                            <td style="text-align:right;">$${formatearPrecio(diferencia)}</td>
                            <td style="text-align:center;"><small class="text-muted">N/A</small></td>
                            <td style="font-size:0.85rem; color:#64748b;">Diferencia en saldos antiguos</td>
                        </tr>
                    `;
                }
            }
        });

        document.getElementById('tbodyDetalleCompraPagos').innerHTML = pagosHTML || '<tr><td colspan="5" class="text-center">No hay pagos registrados</td></tr>';

        const saldo = (compra.valor_compra || 0) - totalPagado;
        document.getElementById('detalleTotalPagado').textContent = '$' + formatearPrecio(totalPagado);
        document.getElementById('detalleSaldoPendiente').textContent = '$' + formatearPrecio(saldo > 0 ? saldo : 0);

        // Configurar botones de acción en el modal
        document.getElementById('btnAbrirPagoDesdeDetalle').onclick = () => abrirModalPago(compra);
        document.getElementById('btnImprimirDesdeDetalle').onclick = () => imprimirCompra(id);

    } catch (e) {
        console.error('Error cargando detalle compra:', e);
        showToast('Error: ' + e.message, 'error');
    }
}
window.verDetalleCompra = verDetalleCompra;

function abrirModalPago(compra) {
    document.getElementById('pagoCompraId').value = compra.id;
    document.getElementById('pagoProveedorNombre').textContent = compra.proveedores?.razon_social || 'N/A';
    document.getElementById('pagoFacturaNum').textContent = compra.numero_factura || 'S/N';

    // Resetear campos nuevos
    document.getElementById('pagoMetodo').value = '';
    document.getElementById('pagoComprobanteFile').value = '';
    document.getElementById('pagoComprobantePreview').innerHTML = '<span style="font-size:10px; color:#999">N/A</span>';
    document.getElementById('pagoNotas').value = '';

    // Calcular saldo pendiente actual
    const mesesKeys = ['pago_ene', 'pago_feb', 'pago_mar', 'pago_abr', 'pago_may', 'pago_jun', 'pago_jul', 'pago_ago', 'pago_sep', 'pago_oct', 'pago_nov', 'pago_dic'];
    const totalPagado = mesesKeys.reduce((acc, mk) => acc + (parseFloat(compra[mk]) || 0), 0);
    const saldo = (compra.valor_compra || 0) - totalPagado;

    document.getElementById('pagoSaldoPendiente').textContent = '$' + formatearPrecio(saldo > 0 ? saldo : 0);
    document.getElementById('pagoMonto').value = '';
    document.getElementById('modalPagoCompra').style.display = 'flex';
}
window.abrirModalPago = abrirModalPago;

function cerrarModalPago() {
    document.getElementById('modalPagoCompra').style.display = 'none';
}
window.cerrarModalPago = cerrarModalPago;

function previsualizarComprobante(input) {
    const preview = document.getElementById('pagoComprobantePreview');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            preview.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">`;
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.innerHTML = '<span style="font-size:10px; color:#999">N/A</span>';
    }
}
window.previsualizarComprobante = previsualizarComprobante;

async function guardarPagoCompra() {
    const id = document.getElementById('pagoCompraId').value;
    const mesKey = document.getElementById('pagoMes').value;
    const metodo = document.getElementById('pagoMetodo').value;
    const monto = limpiarMoneda(document.getElementById('pagoMonto').value);
    const notas = document.getElementById('pagoNotas').value;
    const fileInput = document.getElementById('pagoComprobanteFile');

    if (!mesKey) return showToast('Selecciona un mes', 'warning');
    if (!metodo) return showToast('Selecciona un método de pago', 'warning');
    if (monto <= 0) return showToast('Ingresa un monto válido', 'warning');

    try {
        let comprobanteUrl = '';
        if (fileInput.files && fileInput.files[0]) {
            showToast('Subiendo comprobante...', 'info');
            // Usar la función global subirImagen de admin.js
            comprobanteUrl = await window.subirImagen(fileInput.files[0]);
        }

        // 1. Insertar en la tabla histórica de pagos (pagos_proveedor)
        const { error: errPago } = await supabaseClient
            .from('pagos_proveedor')
            .insert([{
                compra_id: id,
                monto: monto,
                metodo_pago: metodo,
                notas: notas,
                comprobante_url: comprobanteUrl,
                fecha_pago: new Date().toISOString(),
                // Guardamos el mes al que abona como referencia
                referencia: `Abono Mes: ${mesKey.replace('pago_', '').toUpperCase()}`
            }]);

        if (errPago) throw errPago;

        // 2. Actualizar la columna del mes en compras_proveedor para mantener consistencia con saldo_pendiente
        const { data: current } = await supabaseClient.from('compras_proveedor').select(mesKey).eq('id', id).single();
        const nuevoMonto = (parseFloat(current[mesKey]) || 0) + monto;

        const { error: errUpdate } = await supabaseClient
            .from('compras_proveedor')
            .update({ [mesKey]: nuevoMonto, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (errUpdate) throw errUpdate;

        showToast('Pago registrado correctamente', 'success');
        cerrarModalPago();
        verDetalleCompra(id); // Refrescar detalles
        cargarCompras(); // Refrescar tabla principal
    } catch (e) {
        console.error('Error guardando pago:', e);
        showToast('Error: ' + e.message, 'error');
    }
}
window.guardarPagoCompra = guardarPagoCompra;

function ampliarComprobante(url) {
    if (!url) return;
    // Abrir en nueva pestaña o crear un pequeño overlay
    window.open(url, '_blank');
}
window.ampliarComprobante = ampliarComprobante;

async function imprimirCompra(id) {
    try {
        const { data: compra, error: errC } = await supabaseClient
            .from('compras_proveedor')
            .select('*, proveedores(*)')
            .eq('id', id)
            .single();

        if (errC || !compra.proveedor_id) throw new Error("No hay proveedor");

        const { data: historial, error: errH } = await supabaseClient
            .from('compras_proveedor')
            .select('*')
            .eq('proveedor_id', compra.proveedor_id)
            .order('created_at', { ascending: true });

        if (errH) throw errH;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const logo = document.getElementById('headerLogo') || document.getElementById('mainLogo');
        if (logo) {
            try { doc.addImage(logo, 'JPEG', 15, 12, 22, 22); } catch (ex) { }
        }

        doc.setTextColor(255, 107, 0);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('MOTEROS SPORT LINE', 42, 20);

        doc.setTextColor(100, 116, 139);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Villavicencio, Meta', 42, 27);

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Estado de Cuenta', 195, 20, { align: 'right' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Fecha de emisión: ${new Date().toLocaleDateString()}`, 195, 27, { align: 'right' });

        doc.setDrawColor(226, 232, 240);
        doc.line(15, 38, 195, 38);

        // --- INFO PROVEEDOR ---
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('PROVEEDOR', 15, 52);
        doc.text('ID SISTEMA', 195, 52, { align: 'right' });

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(12);
        doc.text(compra.proveedores?.razon_social || 'N/A', 15, 60);
        doc.text(compra.proveedores?.codigo || 'S/N', 195, 60, { align: 'right' });

        // --- TABLA DE MOVIMIENTOS ---
        const mesesKeys = ['pago_ene', 'pago_feb', 'pago_mar', 'pago_abr', 'pago_may', 'pago_jun', 'pago_jul', 'pago_ago', 'pago_sep', 'pago_oct', 'pago_nov', 'pago_dic'];
        let saldoAcumulado = 0;
        const tableBody = [];

        // Obtener IDs de todas las compras del historial para traer sus pagos detallados
        const idsCompras = historial.map(h => h.id);
        const { data: todosLosPagos } = await supabaseClient
            .from('pagos_proveedor')
            .select('*')
            .in('compra_id', idsCompras);

        historial.forEach(c => {
            saldoAcumulado += (c.valor_compra || 0);
            tableBody.push([
                new Date(c.created_at).toLocaleDateString(),
                `Compra Factura ${c.numero_factura || 'S/N'}`,
                `$${formatearPrecio(c.valor_compra)}`,
                '-',
                `$${formatearPrecio(saldoAcumulado)}`
            ]);

            // 1. Pagos Modernos (desde pagos_proveedor)
            const pagosDeEstaCompra = (todosLosPagos || []).filter(p => p.compra_id === c.id);
            pagosDeEstaCompra.forEach(p => {
                saldoAcumulado -= parseFloat(p.monto);
                tableBody.push([
                    new Date(p.fecha_pago || p.created_at).toLocaleDateString(),
                    `PAGO (${p.metodo_pago || 'S/M'}) - FAC ${c.numero_factura}`,
                    '-',
                    `$${formatearPrecio(p.monto)}`,
                    `$${formatearPrecio(saldoAcumulado)}`
                ]);
            });

            // 2. Pagos Legacy (desde columnas de meses, solo si no hay pagos modernos para esta compra o para cubrir saldo antiguo)
            // Para evitar duplicados en reportes donde se mezclen ambos sistemas, 
            // solo sumamos legacy si la suma de pagos modernos es 0 para esa compra.
            if (pagosDeEstaCompra.length === 0) {
                mesesKeys.forEach(mk => {
                    const monto = parseFloat(c[mk]) || 0;
                    if (monto > 0) {
                        saldoAcumulado -= monto;
                        tableBody.push([
                            new Date(c.updated_at || c.created_at).toLocaleDateString(),
                            `PAGO (Legacy) - FAC ${c.numero_factura}`,
                            '-',
                            `$${formatearPrecio(monto)}`,
                            `$${formatearPrecio(saldoAcumulado)}`
                        ]);
                    }
                });
            }
        });

        doc.autoTable({
            startY: 70,
            head: [['FECHA', 'CONCEPTO / REFERENCIA', 'CARGO (+)', 'ABONO (-)', 'SALDO']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right', fontStyle: 'bold' }
            }
        });

        const finalY = doc.lastAutoTable.finalY + 10;

        doc.setFillColor(30, 41, 59);
        doc.roundedRect(130, finalY, 65, 20, 2, 2, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text('SALDO TOTAL PENDIENTE', 162, finalY + 7, { align: 'center' });
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`$${formatearPrecio(saldoAcumulado)}`, 162, finalY + 16, { align: 'center' });

        // --- PIE DE PÁGINA ---
        doc.setTextColor(150);
        doc.setFontSize(8);
        doc.text('Este documento es un resumen de movimientos internos de Moteros Sport Line y no constituye una factura legal.', 105, 285, { align: 'center' });

        doc.save(`Estado_Cuenta_${compra.proveedores?.razon_social}.pdf`);

    } catch (e) {
        console.error('Error generando PDF:', e);
        showToast('Error al generar PDF: ' + e.message, 'error');
    }
}
window.imprimirCompra = imprimirCompra;

async function eliminarCompra(id) {
    if (!confirm('¿Eliminar compra? Esto borrará el registro y sus detalles definitivamente.')) return;

    try {
        // Primero borrar detalles por la relación FK (si existe)
        const { error: errDetalles } = await supabaseClient
            .from('compras_detalles')
            .delete()
            .eq('compra_id', id);

        if (errDetalles) throw errDetalles;

        const { error: errHeader } = await supabaseClient
            .from('compras_proveedor')
            .delete()
            .eq('id', id);

        if (errHeader) throw errHeader;

        showToast('Compra eliminada correctamente', 'success');
        cargarCompras();
    } catch (e) {
        console.error('Error eliminando compra:', e);
        showToast('Error al eliminar: ' + e.message, 'error');
    }
}
window.eliminarCompra = eliminarCompra;

function actualizarResumenCompras() {
    if (!comprasData) return;

    const totalPorPagar = comprasData.reduce((acc, c) => {
        const mesesKeys = ['pago_ene', 'pago_feb', 'pago_mar', 'pago_abr', 'pago_may', 'pago_jun', 'pago_jul', 'pago_ago', 'pago_sep', 'pago_oct', 'pago_nov', 'pago_dic'];
        const totalPagado = mesesKeys.reduce((accP, mk) => accP + (parseFloat(c[mk]) || 0), 0);
        const saldo = (c.valor_compra || 0) - totalPagado;
        return acc + (saldo > 0 ? saldo : 0);
    }, 0);

    const abiertas = comprasData.filter(c => c.estado !== 'CERRADO').length;

    const hoy = new Date();
    const m = hoy.getMonth();
    const y = hoy.getFullYear();
    const pagadasMes = comprasData.filter(c => {
        if (c.estado !== 'CERRADO') return false;
        const f = new Date(c.updated_at || c.created_at);
        return f.getMonth() === m && f.getFullYear() === y;
    }).length;

    const elP = document.getElementById('comprasPendientes');
    const elA = document.getElementById('comprasAbiertas');
    const elM = document.getElementById('comprasPagadasMes');

    if (elP) elP.innerText = `$${formatearPrecio(totalPorPagar)}`;
    if (elA) elA.innerText = abiertas;
    if (elM) elM.innerText = pagadasMes;
}
window.actualizarResumenCompras = actualizarResumenCompras;
