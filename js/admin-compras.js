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
        const { data, error } = await supabaseClient.from('productos').select('id, nombre, id_producto, precio, precio_compra');
        if (!error && data) {
            productosAutocomplete = data;
        }
    } catch (e) { console.error('Error cache productos autocomplete', e); }
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
    await cargarProductosAutocomplete();

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
            <input type="number" class="form-control" value="1" min="1" 
                onchange="actualizarCalculosItem(${index}, 'cantidad', this.value)">
        </td>
        <td>
            <input type="text" class="form-control" placeholder="$0" 
                onchange="actualizarCalculosItem(${index}, 'costo', this.value)" onblur="formatearMonedaInput(this)">
        </td>
        <td>
            <input type="text" class="form-control" placeholder="$0" 
                onchange="actualizarCalculosItem(${index}, 'venta', this.value)" onblur="formatearMonedaInput(this)">
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

    const subtotalEl = document.getElementById(`subtotalItem-${index}`);
    if (subtotalEl) subtotalEl.textContent = '$' + formatearPrecio(item.subtotal);

    actualizarTotalGeneralCompra();
}
window.actualizarCalculosItem = actualizarCalculosItem;

function actualizarTotalGeneralCompra() {
    const total = compraItemsProvisionales.reduce((acc, item) => acc + (item.subtotal || 0), 0);
    const el = document.getElementById('compraTotalGeneral');
    if (el) el.textContent = '$' + formatearPrecio(total);
}

// Distribución
let indexDistribucionActual = -1;

function abrirModalDistribucion(index) {
    indexDistribucionActual = index;
    const item = compraItemsProvisionales[index];
    if (!item) return;

    document.getElementById('modalDistribucion').style.display = 'flex';
    document.getElementById('distProductoTitulo').textContent = item.nombre_producto || 'Producto Nuevo';

    document.getElementById('distColores').value = item.colores || '';
    document.getElementById('distCantAlcala').value = item.distribucion.alcala || 0;
    document.getElementById('distCantLocal01').value = item.distribucion.local01 || 0;
    document.getElementById('distCantJordan').value = item.distribucion.jordan || 0;
    document.getElementById('distCantDigital').value = item.distribucion.digital || 0;

    calcularSumaDistribucion();
}
window.abrirModalDistribucion = abrirModalDistribucion;

function cerrarModalDistribucion() {
    document.getElementById('modalDistribucion').style.display = 'none';
}
window.cerrarModalDistribucion = cerrarModalDistribucion;

function calcularSumaDistribucion() {
    const inputs = document.querySelectorAll('.dist-input');
    let suma = 0;
    inputs.forEach(inp => suma += (parseInt(inp.value) || 0));
    document.getElementById('distTotalSuma').textContent = suma;
    return suma;
}

// Listener global delegado
document.addEventListener('input', function (e) {
    if (e.target.classList.contains('dist-input')) {
        calcularSumaDistribucion();
    }
});

function guardarDistribucion() {
    if (indexDistribucionActual === -1) return;
    const item = compraItemsProvisionales[indexDistribucionActual];

    const suma = calcularSumaDistribucion();

    if (suma > item.cantidad_total) {
        if (confirm(`La suma distribuida (${suma}) es mayor a la cantidad total (${item.cantidad_total}). ¿Actualizar cantidad total?`)) {
            item.cantidad_total = suma;
        }
    }

    item.distribucion.alcala = parseInt(document.getElementById('distCantAlcala').value) || 0;
    item.distribucion.local01 = parseInt(document.getElementById('distCantLocal01').value) || 0;
    item.distribucion.jordan = parseInt(document.getElementById('distCantJordan').value) || 0;
    item.distribucion.digital = parseInt(document.getElementById('distCantDigital').value) || 0;
    item.colores = document.getElementById('distColores').value;

    cerrarModalDistribucion();
    actualizarCalculosItem(indexDistribucionActual, 'cantidad', item.cantidad_total); // Recalcular
}
window.guardarDistribucion = guardarDistribucion;


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

        const detallesData = compraItemsProvisionales.map(item => ({
            compra_id: compraId,
            nombre_producto: item.nombre_producto,
            producto_id: item.producto_id || 'N/A',
            cantidad_total: item.cantidad_total,
            costo_unitario: item.costo_unitario,
            precio_venta_sugerido: item.precio_venta,
            subtotal: item.subtotal,
            cantidad_alcala: item.distribucion.alcala,
            cantidad_local01: item.distribucion.local01,
            cantidad_jordan: item.distribucion.jordan,
            cantidad_digital: item.distribucion.digital,
            colores: item.colores
        }));

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

function seleccionarProductoCompra(input, index) {
    const val = input.value;
    // IMPORTANTE: Buscar en productosAutocomplete
    const prod = productosAutocomplete.find(p => p.nombre === val || p.id_producto === val);

    if (prod) {
        // Asignar datos del producto encontrado
        compraItemsProvisionales[index].producto_id = prod.id_producto;
        compraItemsProvisionales[index].nombre_producto = prod.nombre;

        // Actualizar valores visuales
        const tr = document.getElementById(`itemRow-${index}`);
        const inputs = tr.querySelectorAll('input');
        // inputs[0] es el nombre
        // inputs[1] es cantidad
        // inputs[2] costo con formato
        // inputs[3] venta con formato

        // Formatear precio compra y venta
        inputs[2].value = '$' + formatearPrecio(prod.precio_compra || 0);
        inputs[3].value = '$' + formatearPrecio(prod.precio || 0);

        actualizarCalculosItem(index, 'costo', prod.precio_compra);
        actualizarCalculosItem(index, 'venta', prod.precio);
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

        // Renderizar Pagos (Basado en columnas pago_ene, pago_feb...)
        const meses = [
            { key: 'pago_ene', label: 'Enero' },
            { key: 'pago_feb', label: 'Febrero' },
            { key: 'pago_mar', label: 'Marzo' },
            { key: 'pago_abr', label: 'Abril' },
            { key: 'pago_may', label: 'Mayo' },
            { key: 'pago_jun', label: 'Junio' },
            { key: 'pago_jul', label: 'Julio' },
            { key: 'pago_ago', label: 'Agosto' },
            { key: 'pago_sep', label: 'Septiembre' },
            { key: 'pago_oct', label: 'Octubre' },
            { key: 'pago_nov', label: 'Noviembre' },
            { key: 'pago_dic', label: 'Diciembre' }
        ];

        let totalPagado = 0;
        const pagosHTML = meses.map(m => {
            const monto = parseFloat(compra[m.key]) || 0;
            if (monto === 0) return '';
            totalPagado += monto;
            return `
                <tr>
                    <td>${m.label}</td>
                    <td style="text-align:right;">$${formatearPrecio(monto)}</td>
                    <td style="font-size:0.85rem; color:#64748b;">Abono mensual registrado</td>
                </tr>
            `;
        }).filter(x => x !== '').join('');

        document.getElementById('tbodyDetalleCompraPagos').innerHTML = pagosHTML || '<tr><td colspan="3" class="text-center">No hay pagos registrados</td></tr>';

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

    // Calcular saldo pendiente actual
    const mesesKeys = ['pago_ene', 'pago_feb', 'pago_mar', 'pago_abr', 'pago_may', 'pago_jun', 'pago_jul', 'pago_ago', 'pago_sep', 'pago_oct', 'pago_nov', 'pago_dic'];
    const totalPagado = mesesKeys.reduce((acc, mk) => acc + (parseFloat(compra[mk]) || 0), 0);
    const saldo = compra.valor_compra - totalPagado;

    document.getElementById('pagoSaldoPendiente').textContent = '$' + formatearPrecio(saldo > 0 ? saldo : 0);
    document.getElementById('pagoMonto').value = '';
    document.getElementById('modalPagoCompra').style.display = 'flex';
}
window.abrirModalPago = abrirModalPago;

function cerrarModalPago() {
    document.getElementById('modalPagoCompra').style.display = 'none';
}
window.cerrarModalPago = cerrarModalPago;

async function guardarPagoCompra() {
    const id = document.getElementById('pagoCompraId').value;
    const mesKey = document.getElementById('pagoMes').value;
    const monto = limpiarMoneda(document.getElementById('pagoMonto').value);

    if (!mesKey) return showToast('Selecciona un mes', 'warning');
    if (monto <= 0) return showToast('Ingresa un monto válido', 'warning');

    try {
        // En este esquema de columnas, el "pago" simplemente actualiza la columna del mes.
        // Podríamos sumar si ya hay algo, o simplemente sobreescribir.
        // Vamos a intentar obtener el valor actual para sumar.
        const { data: current } = await supabaseClient.from('compras_proveedor').select(mesKey).eq('id', id).single();
        const nuevoMonto = (parseFloat(current[mesKey]) || 0) + monto;

        const { error } = await supabaseClient
            .from('compras_proveedor')
            .update({ [mesKey]: nuevoMonto })
            .eq('id', id);

        if (error) throw error;

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

        historial.forEach(c => {
            saldoAcumulado += (c.valor_compra || 0);
            tableBody.push([
                new Date(c.created_at).toLocaleDateString(),
                `Compra Factura ${c.numero_factura || 'S/N'}`,
                `$${formatearPrecio(c.valor_compra)}`,
                '-',
                `$${formatearPrecio(saldoAcumulado)}`
            ]);

            mesesKeys.forEach(mk => {
                const monto = parseFloat(c[mk]) || 0;
                if (monto > 0) {
                    saldoAcumulado -= monto;
                    tableBody.push([
                        new Date(c.updated_at || c.created_at).toLocaleDateString(),
                        `PAGO REGISTRADO - FAC ${c.numero_factura}`,
                        '-',
                        `$${formatearPrecio(monto)}`,
                        `$${formatearPrecio(saldoAcumulado)}`
                    ]);
                }
            });
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
