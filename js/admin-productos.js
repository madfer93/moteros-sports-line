// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE PRODUCTOS (FIXED: SIN JOIN RELACIONAL FALLIDO)
// ═══════════════════════════════════════════════════════════════

let productosCache = [];
let proveedoresCache = {}; // Cache manual id -> data

async function cargarProductos() {
    const grid = document.getElementById('listaProductos');
    if (grid && grid.innerHTML.trim() === '') grid.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando catálogo...</p></div>';

    try {
        // 1. Cargar proveedores (Cache)
        if (Object.keys(proveedoresCache).length === 0) {
            const { data: provs } = await supabaseClient.from('proveedores').select('id, razon_social, nombre_comercial');
            if (provs) provs.forEach(p => proveedoresCache[p.id] = p.razon_social || p.nombre_comercial);
        }

        // 2. Cargar Productos base
        const { data: productosBase, error } = await supabaseClient
            .from('productos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 3. Cargar Inventarios de Tiendas (FIX: Carga Relacional Manual)
        const [invAlcala, invLocal01, invJordan] = await Promise.all([
            supabaseClient.from('inventario_alcala').select('id_producto, cantidad'),
            supabaseClient.from('inventario_01').select('id_producto, cantidad'),
            supabaseClient.from('inventario_jordan').select('id_producto, cantidad')
        ]);

        // Helpers de mapeo rápido
        // NOTA: Algunas tablas usan UUID y otras ID numérico antiguo. 
        // Creamos Map stringify para asegurar match.
        const mapAlcala = new Map(invAlcala.data?.map(i => [String(i.id_producto), i.cantidad]) || []);
        const mapLocal01 = new Map(invLocal01.data?.map(i => [String(i.id_producto), i.cantidad]) || []);
        const mapJordan = new Map(invJordan.data?.map(i => [String(i.id_producto), i.cantidad]) || []);

        // 4. Merge de datos
        productosCache = (productosBase || []).map(p => {
            // Buscamos por UUID (p.id) O por ID Legacy (p.id_producto)
            // Convertimos a string para match seguro con el Map
            const keyUUID = String(p.id);
            const keyLegacy = p.id_producto ? String(p.id_producto) : null;

            const stockAlc = mapAlcala.get(keyUUID) || (keyLegacy ? mapAlcala.get(keyLegacy) : 0) || 0;
            const stock01 = mapLocal01.get(keyUUID) || (keyLegacy ? mapLocal01.get(keyLegacy) : 0) || 0;
            const stockJor = mapJordan.get(keyUUID) || (keyLegacy ? mapJordan.get(keyLegacy) : 0) || 0;

            return {
                ...p,
                stock_alcala: p.stock_alcala || stockAlc,
                stock_local01: p.stock_local01 || stock01,
                stock_jordan: p.stock_jordan || stockJor,
                stock_digital: p.stock_digital || 0
            };
        });

        // Sincronizar Global
        window.productos = productosCache;
        if (typeof productos !== 'undefined') productos = productosCache;

        // 5. Renderizar
        if (grid) renderizarProductos(productosCache);

        // Actualizar Dashboard (Gráficos)
        actualizarStatsDashboard(productosCache);

    } catch (e) {
        console.error('Error Cargar Productos:', e);
        if (grid) {
            if (e.code === 'PGRST200') {
                grid.innerHTML = '<div class="empty-state">Error DB: Relación no encontrada.</div>';
            } else {
                grid.innerHTML = '<div class="empty-state">Error al cargar productos</div>';
            }
        }
    }
}

function renderizarProductos(lista) {
    const grid = document.getElementById('listaProductos');
    if (!grid) return;

    if (lista.length === 0) {
        grid.innerHTML = '<div class="empty-state">No hay productos registrados</div>';
        return;
    }

    grid.innerHTML = lista.map(p => {
        let stockTotal = 0;
        // Calcular stock total sumando tiendas
        // Priority: columnas individuales (más probable)
        const sAlcala = parseInt(p.stock_alcala || p.stock_tiendas?.alcala || 0);
        const sLocal01 = parseInt(p.stock_local01 || p.stock_tiendas?.local01 || 0);
        const sJordan = parseInt(p.stock_jordan || p.stock_tiendas?.jordan || 0);
        const sDigital = parseInt(p.stock_digital || p.stock_tiendas?.digital || 0);

        stockTotal = sAlcala + sLocal01 + sJordan + sDigital;

        const imagen = p.url_imagen || 'https://via.placeholder.com/150?text=Sin+Imagen';
        // Usar cache proveedores
        const provName = proveedoresCache[p.proveedor_id] || 'Sin Proveedor';

        return `
        <div class="producto-card-admin">
            <div class="producto-img-wrapper">
                <img src="${imagen}" alt="${p.nombre}" loading="lazy">
                <span class="badge badge-${p.estado === 'Activo' ? 'success' : 'danger'}">${p.estado}</span>
            </div>
            <div class="producto-info-admin">
                <h4>${p.nombre}</h4>
                <div class="producto-meta">
                    <span>${p.categoria}</span> • <span>${p.marca}</span>
                </div>
                <div class="producto-meta" style="color:#64748b; font-size:0.8rem;">
                    Prov: ${provName}
                </div>
                <div class="producto-precios">
                    <div class="precio-item">
                        <label>Venta</label>
                        <strong>$${parseInt(p.precio).toLocaleString('es-CO')}</strong>
                    </div>
                     <div class="precio-item">
                        <label>Costo</label>
                        <span class="text-muted">$${parseInt(p.precio_compra || 0).toLocaleString('es-CO')}</span>
                    </div>
                </div>
                <div class="producto-stock">
                    <span>Stock Total: <strong>${stockTotal}</strong></span>
                </div>
                <div class="producto-actions">
                    <button onclick="editarProducto('${p.id}')" class="btn-icon" title="Editar">✏️</button>
                    <button onclick="eliminarProducto('${p.id}')" class="btn-icon delete" title="Eliminar">🗑️</button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function filtrarProductosAdmin() {
    const q = document.getElementById('buscarProductoAdmin').value.toLowerCase();
    const filtrados = productosCache.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        p.referencia?.toLowerCase().includes(q) ||
        p.marca.toLowerCase().includes(q)
    );
    renderizarProductos(filtrados);
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD STATS (IMPLEMENTACIÓN NUEVA)
// ═══════════════════════════════════════════════════════════════

// Variables globales para gráficos (para poder destruirlos al actualizar)
let chartStockInstance = null;
let chartCategoriaInstance = null;
function actualizarStatsDashboard(productos) {
    // Solo ejecutar si estamos en el dashboard (elementos existen)
    const elTotal = document.getElementById('statProductos');
    if (!elTotal) return; // No estamos en dashboard o no existen ids

    // 1. Calcular KPIs
    let totalItems = productos.length;
    let stockGlobal = 0;
    let stockBajo = 0;
    let agotados = 0;

    // Acumuladores para gráficos y tablas
    let stockPorTienda = { alcala: 0, local01: 0, jordan: 0, digital: 0 };
    let productosPorCategoria = {}; // Para gráfico (count productos)
    let stockPorCategoriaDetalle = {}; // Para tabla (sum stock por tienda)

    productos.forEach(p => {
        const sAlcala = parseInt(p.stock_alcala || p.stock_tiendas?.alcala || 0);
        const sLocal01 = parseInt(p.stock_local01 || p.stock_tiendas?.local01 || 0);
        const sJordan = parseInt(p.stock_jordan || p.stock_tiendas?.jordan || 0);
        const sDigital = parseInt(p.stock_digital || p.stock_tiendas?.digital || 0);

        const totalP = sAlcala + sLocal01 + sJordan + sDigital;
        stockGlobal += totalP;

        if (totalP === 0) agotados++;
        else if (totalP < 5) stockBajo++;

        stockPorTienda.alcala += sAlcala;
        stockPorTienda.local01 += sLocal01;
        stockPorTienda.jordan += sJordan;
        stockPorTienda.digital += sDigital;

        // NORMALIZACIÓN
        const cat = (p.categoria || 'SIN CATEGORÍA').toUpperCase().trim();

        // Count para gráfico DOUGHNUT (Cantidad de REFERENCIAS)
        productosPorCategoria[cat] = (productosPorCategoria[cat] || 0) + 1;

        // Detalle para TABLA (Cantidad de UNIDADES DE STOCK)
        if (!stockPorCategoriaDetalle[cat]) {
            stockPorCategoriaDetalle[cat] = { alcala: 0, local01: 0, jordan: 0, digital: 0, total: 0 };
        }
        stockPorCategoriaDetalle[cat].alcala += sAlcala;
        stockPorCategoriaDetalle[cat].local01 += sLocal01;
        stockPorCategoriaDetalle[cat].jordan += sJordan;
        stockPorCategoriaDetalle[cat].digital += sDigital;
        stockPorCategoriaDetalle[cat].total += totalP;
    });

    // 2. Actualizar DOM Stats Generales
    if (document.getElementById('statProductos')) document.getElementById('statProductos').textContent = totalItems;
    if (document.getElementById('statStockTotal')) document.getElementById('statStockTotal').textContent = stockGlobal;
    if (document.getElementById('statStockBajo')) document.getElementById('statStockBajo').textContent = stockBajo;
    if (document.getElementById('statAgotados')) document.getElementById('statAgotados').textContent = agotados;

    // 3. Renderizar Gráficos
    renderizarGraficoStock(stockPorTienda);
    renderizarGraficoCategorias(productosPorCategoria);

    // 4. Renderizar Tabla Distribución (NUEVO)
    const tbodyCat = document.getElementById('tbodyDistribucionCategorias');
    if (tbodyCat) {
        if (Object.keys(stockPorCategoriaDetalle).length === 0) {
            tbodyCat.innerHTML = '<tr><td colspan="5" class="text-center">No hay datos</td></tr>';
        } else {
            tbodyCat.innerHTML = Object.keys(stockPorCategoriaDetalle).sort().map(cat => {
                const d = stockPorCategoriaDetalle[cat];
                return `<tr>
                    <td><strong>${cat}</strong></td>
                    <td>${d.alcala}</td>
                    <td>${d.local01}</td>
                    <td>${d.jordan}</td>
                    <td><span class="badge badge-info">${d.total}</span></td>
                </tr>`;
            }).join('');
        }
    }

    // 5. Cargar Leads (Restauración Crítica)
    cargarStatsLeads();
}

// RESTAURACIÓN LEADS (Migrado de admin.js para estabilidad)
async function cargarStatsLeads() {
    try {
        const hoy = new Date().toISOString().split('T')[0];
        const mesInicio = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-01';

        // Leads Hoy
        const { count: leadsHoy } = await supabaseClient.from('leads_ia')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', hoy + 'T00:00:00');

        // Leads Mes
        const { count: leadsMes } = await supabaseClient.from('leads_ia')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', mesInicio + 'T00:00:00');

        if (document.getElementById('statLeadsHoy')) document.getElementById('statLeadsHoy').textContent = leadsHoy || 0;
        if (document.getElementById('statLeadsMes')) document.getElementById('statLeadsMes').textContent = leadsMes || 0;
    } catch (e) {
        console.error('Error Leads Backup:', e);
    }
}
window.cargarStatsLeads = cargarStatsLeads;


// FIX REPORTE MARGEN (Sobreescribe admin.js para arreglar duplicados)
async function cargarReporteMargen() {
    const body = document.getElementById('bodyReporte');
    const container = document.getElementById('contenidoReporte');
    if (!body || !container) return; // Si no existen en DOM

    container.style.display = 'block';
    if (document.getElementById('tituloReporte')) document.getElementById('tituloReporte').textContent = '📊 Margen por Categoría';
    body.innerHTML = '<div class="loading"><div class="spinner"></div><p>Analizando datos...</p></div>';

    // Scroll hacia el reporte
    container.scrollIntoView({ behavior: 'smooth' });

    try {
        const { data, error } = await supabaseClient.from('v_margen_categoria').select('*');
        if (error) throw error;

        if (!data || data.length === 0) {
            body.innerHTML = '<p class="text-center">No hay datos disponibles</p>';
            return;
        }

        // AGRUPAR DATOS (Fix Duplicados DB)
        const agrupado = {};

        data.forEach(r => {
            const cat = (r.categoria || 'OTROS').toUpperCase().trim();
            if (!agrupado[cat]) {
                agrupado[cat] = {
                    categoria: cat,
                    total_productos: 0,
                    costo_total_pond: 0,
                    precio_total_pond: 0
                };
            }
            // Ponderado aproximado
            const n = parseInt(r.total_productos || 0);
            agrupado[cat].total_productos += n;
            agrupado[cat].costo_total_pond += (parseFloat(r.costo_promedio || 0) * n);
            agrupado[cat].precio_total_pond += (parseFloat(r.precio_venta_promedio || 0) * n);
        });

        // Convertir back a array
        const reporteFinal = Object.values(agrupado).map(item => {
            const costoProm = item.total_productos > 0 ? item.costo_total_pond / item.total_productos : 0;
            const precioProm = item.total_productos > 0 ? item.precio_total_pond / item.total_productos : 0;
            const margen = precioProm > 0 ? ((precioProm - costoProm) / precioProm) * 100 : 0;
            return {
                categoria: item.categoria,
                total_productos: item.total_productos,
                costo_promedio: costoProm,
                precio_promedio: precioProm,
                margen_porcentaje: margen
            };
        });

        // Render Tabla
        body.innerHTML = `
            <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Categoría</th>
                        <th>Productos #</th>
                        <th>Costo Prom.</th>
                        <th>Precio Prom.</th>
                        <th>Margen %</th>
                    </tr>
                </thead>
                <tbody>
                    ${reporteFinal.map(r => `
                    <tr>
                        <td><strong>${r.categoria}</strong></td>
                        <td>${r.total_productos}</td>
                        <td>$${parseInt(r.costo_promedio).toLocaleString('es-CO')}</td>
                        <td>$${parseInt(r.precio_promedio).toLocaleString('es-CO')}</td>
                        <td>
                             <span class="badge badge-${r.margen_porcentaje >= 30 ? 'success' : 'warning'}">
                                ${r.margen_porcentaje.toFixed(1)}%
                            </span>
                        </td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            </div>`;

    } catch (e) {
        console.error(e);
        body.innerHTML = '<p class="text-danger">Error cargando reporte</p>';
    }
}
window.cargarReporteMargen = cargarReporteMargen;

function renderizarGraficoStock(data) {
    const canvas = document.getElementById('chartStockLocales');
    if (!canvas) return;

    // Validación de seguridad para Chart.js
    if (typeof Chart === 'undefined') {
        canvas.parentNode.innerHTML = '<p class="text-danger">Error: Librería Gráfica no cargada</p>';
        return;
    }

    try {
        // Destrucción segura
        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();
        if (window.chartStockInstance) {
            window.chartStockInstance.destroy();
            window.chartStockInstance = null;
        }

        // Verificar datos
        const totalStock = (data.alcala + data.local01 + data.jordan + data.digital);
        if (totalStock === 0) {
            // Mostrar gráfico vacío pero con ejes, o mensaje
            console.warn('Grafico Stock: Datos en 0', data);
        }

        const config = {
            type: 'bar',
            data: {
                labels: ['Alcalá', 'Local 01', 'Jordán', 'Digital'],
                datasets: [{
                    label: 'Unidades en Stock',
                    data: [data.alcala, data.local01, data.jordan, data.digital],
                    backgroundColor: ['#f97316', '#22c55e', '#3b82f6', '#8b5cf6'],
                    borderWidth: 0,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return `Stock: ${context.raw} un.`;
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, grid: { borderDash: [2, 4] } },
                    x: { grid: { display: false } }
                }
            }
        };
        window.chartStockInstance = new Chart(canvas, config);
    } catch (e) {
        console.error('Error renderizando chart stock:', e);
        canvas.parentNode.innerHTML = `<p class="text-danger">Error: ${e.message}</p>`;
    }
}

function renderizarGraficoCategorias(dataMap) {
    const canvas = document.getElementById('chartCategorias');
    if (!canvas) return;

    if (typeof Chart === 'undefined') return;

    try {
        // Destrucción segura
        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();
        if (window.chartCategoriaInstance) {
            window.chartCategoriaInstance.destroy();
            window.chartCategoriaInstance = null;
        }

        const labels = Object.keys(dataMap);
        const values = Object.values(dataMap);

        // Colores fijos para categorías comunes para consistencia
        const colorPalette = [
            '#f97316', '#3b82f6', '#10b981', '#ef4444',
            '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899',
            '#6366f1', '#84cc16', '#14b8a6', '#d946ef'
        ];

        const backgroundColors = labels.map((_, i) => colorPalette[i % colorPalette.length]);

        const config = {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: backgroundColors,
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } }
                },
                layout: { padding: 10 }
            }
        };

        window.chartCategoriaInstance = new Chart(canvas, config);
    } catch (e) {
        console.error('Error renderizando chart categorias:', e);
    }
}

// ═══════════════════════════════════════════════════════════════
// FORMULARIO PRODUCTO
// ═══════════════════════════════════════════════════════════════

async function mostrarFormProducto() {
    const modal = document.getElementById('formProducto');
    if (modal) {
        modal.classList.add('active');
        if (modal.style) modal.style.display = 'flex';
    }

    document.getElementById('formTituloProducto').textContent = '➕ Nuevo Producto';
    document.getElementById('productoId').value = '';

    // Reset inputs
    const ids = ['productoNombre', 'productoReferencia', 'productoCategoria',
        'productoMarca', 'productoProveedor', 'productoVariantes',
        'productoPrecioCompra', 'productoPrecio', 'productoMargen',
        'productoEstado', 'stockAlcala', 'stockLocal01', 'stockJordan', 'stockDigital',
        'productoDescCorta', 'productoDescTecnica', 'productoImagen'];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = (id === 'productoEstado') ? 'Activo' : '';
    });

    await cargarProveedoresEnSelectProducto();
}

async function cargarProveedoresEnSelectProducto(seleccionado = null) {
    const select = document.getElementById('productoProveedor');
    if (!select) return;

    select.innerHTML = '<option value="">Seleccionar...</option>';

    // Usar cache si existe, o pedir
    if (Object.keys(proveedoresCache).length === 0) {
        // Fetch
        const { data } = await supabaseClient.from('proveedores').select('id,razon_social,nombre_comercial').order('razon_social');
        if (data) {
            data.forEach(p => {
                proveedoresCache[p.id] = p.razon_social || p.nombre_comercial;
                agregarOption(select, p.id, proveedoresCache[p.id], seleccionado);
            });
        }
    } else {
        // Usar Cache
        for (const [id, nombre] of Object.entries(proveedoresCache)) {
            agregarOption(select, id, nombre, seleccionado);
        }
    }
}

function agregarOption(select, value, text, selectedVal) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    if (value == selectedVal) opt.selected = true;
    select.appendChild(opt);
}

function cancelarFormProducto() {
    const modal = document.getElementById('formProducto');
    if (modal) modal.style.display = 'none';
    if (modal) modal.classList.remove('active');
}

async function guardarProducto() {
    const id = document.getElementById('productoId').value;
    const nombre = document.getElementById('productoNombre').value;
    const precio = parseFloat(document.getElementById('productoPrecio').value) || 0;
    const precioCompra = parseFloat(document.getElementById('productoPrecioCompra').value) || 0;

    if (!nombre || precio <= 0) {
        showToast('Nombre y Precio validados', 'warning');
        return;
    }

    // 1. Manejar subida de imagen si existe archivo temporal
    let urlImagen = document.getElementById('productoImagen').value;
    if (archivosTemporal.producto) {
        try {
            showToast('Subiendo imagen...', 'info');
            const urlSubida = await subirImagenSupabase(archivosTemporal.producto, 'productos-imagenes');
            if (urlSubida) urlImagen = urlSubida;
        } catch (err) {
            console.error('Error subiendo imagen:', err);
            showToast('Error al subir imagen, se usará URL manual si existe', 'warning');
        }
    }

    const data = {
        nombre: nombre,
        referencia: document.getElementById('productoReferencia').value,
        categoria: document.getElementById('productoCategoria').value,
        marca: document.getElementById('productoMarca').value,
        proveedor: document.getElementById('productoProveedor').value || null,
        variantes: document.getElementById('productoVariantes').value.split(',').map(s => s.trim()).filter(Boolean),
        precio: precio,
        precio_compra: precioCompra,
        estado: document.getElementById('productoEstado').value,
        descripcion_corta: document.getElementById('productoDescCorta').value,
        descripcion_tecnica: document.getElementById('productoDescTecnica').value,
        url_imagen: urlImagen
    };

    try {
        let result;
        if (id) {
            result = await supabaseClient.from('productos').update(data).eq('id', id);
        } else {
            result = await supabaseClient.from('productos').insert(data);
        }

        if (result.error) throw result.error;

        showToast('Producto guardado', 'success');
        removerPreview('producto'); // Limpiar imagen temporal
        cancelarFormProducto();
        cargarProductos();

        // Refrescar categorías por si acaso cambió el nombre de una o se añadió nueva
        if (typeof cargarCategorias === 'function') cargarCategorias();

    } catch (e) {
        console.error(e);
        showToast('Error guardar: ' + e.message, 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE IMÁGENES (BOCKET SUPABASE)
// ═══════════════════════════════════════════════════════════════

async function handleFileSelect(event, tipo) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('El archivo es muy pesado (máx 5MB)', 'error');
        return;
    }

    archivosTemporal[tipo] = file;

    // Previsualización
    const reader = new FileReader();
    reader.onload = (e) => {
        const previewImg = document.getElementById(`preview${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
        const container = document.getElementById(`previewContainer${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
        const dropzone = document.getElementById(`dropzone${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);

        if (previewImg && container) {
            previewImg.src = e.target.result;
            container.style.display = 'block';
            if (dropzone) {
                // Ocultar textos del dropzone cuando hay preview
                Array.from(dropzone.children).forEach(child => {
                    if (child.id !== `previewContainer${tipo.charAt(0).toUpperCase() + tipo.slice(1)}` && child.type !== 'file') {
                        child.style.visibility = 'hidden';
                    }
                });
            }
        }
    };
    reader.readAsDataURL(file);
}

function removerPreview(tipo) {
    archivosTemporal[tipo] = null;
    const input = document.getElementById(`fileInput${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
    if (input) input.value = '';

    const container = document.getElementById(`previewContainer${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
    const dropzone = document.getElementById(`dropzone${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);

    if (container) container.style.display = 'none';
    if (dropzone) {
        Array.from(dropzone.children).forEach(child => {
            child.style.visibility = 'visible';
        });
    }
}

async function subirImagenSupabase(file, bucket) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = fileName;

    const { data, error } = await supabaseClient.storage
        .from(bucket)
        .upload(filePath, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabaseClient.storage
        .from(bucket)
        .getPublicUrl(filePath);

    return publicUrl;
}

window.handleFileSelect = handleFileSelect;
window.removerPreview = removerPreview;

async function editarProducto(id) {
    const p = productosCache.find(x => x.id === id);
    if (!p) return;

    await mostrarFormProducto();
    document.getElementById('formTituloProducto').textContent = '✏️ Editar Producto';
    document.getElementById('productoId').value = p.id;

    document.getElementById('productoNombre').value = p.nombre;
    document.getElementById('productoReferencia').value = p.referencia || '';
    document.getElementById('productoCategoria').value = p.categoria;
    document.getElementById('productoMarca').value = p.marca;

    await cargarProveedoresEnSelectProducto(p.proveedor_id);

    if (p.variantes && Array.isArray(p.variantes)) {
        document.getElementById('productoVariantes').value = p.variantes.join(', ');
    }

    document.getElementById('productoPrecio').value = p.precio;
    document.getElementById('productoPrecioCompra').value = p.precio_compra || 0;

    const m = p.precio > 0 ? ((p.precio - (p.precio_compra || 0)) / p.precio) * 100 : 0;
    document.getElementById('productoMargen').value = m.toFixed(1) + '%';

    document.getElementById('productoEstado').value = p.estado;
    document.getElementById('productoDescCorta').value = p.descripcion_corta || '';
    document.getElementById('productoDescTecnica').value = p.descripcion_tecnica || '';
    document.getElementById('productoImagen').value = p.url_imagen || '';

    // Stocks
    document.getElementById('stockAlcala').value = p.stock_alcala || p.stock_tiendas?.alcala || 0;
    document.getElementById('stockLocal01').value = p.stock_local01 || p.stock_tiendas?.local01 || 0;
    document.getElementById('stockJordan').value = p.stock_jordan || p.stock_tiendas?.jordan || 0;
    document.getElementById('stockDigital').value = p.stock_digital || p.stock_tiendas?.digital || 0;
}

async function eliminarProducto(id) {
    if (!confirm('¿Eliminar permanente?')) return;
    try {
        const { error } = await supabaseClient.from('productos').delete().eq('id', id);
        if (error) throw error;
        showToast('Eliminado', 'success');
        cargarProductos();
    } catch (e) {
        showToast('Error al eliminar', 'error');
    }
}

// Export Stubs
function exportarProductosExcel() { alert('Función pronto'); }
function exportarProductosPDF() { alert('Función pronto'); }

// Global
window.cargarProductos = cargarProductos;
window.mostrarFormProducto = mostrarFormProducto;
window.cancelarFormProducto = cancelarFormProducto;
window.guardarProducto = guardarProducto;
window.editarProducto = editarProducto;
window.eliminarProducto = eliminarProducto;
window.filtrarProductosAdmin = filtrarProductosAdmin;
window.exportarProductosExcel = exportarProductosExcel;
window.exportarProductosPDF = exportarProductosPDF;
window.actualizarStatsDashboard = actualizarStatsDashboard;
