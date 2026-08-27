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

        // Helpers de mapeo rápido — SUMAMOS cantidades por id_producto (un producto puede tener múltiples filas/tallas)
        function sumarPorProducto(items) {
            const map = new Map();
            (items || []).forEach(i => {
                const key = String(i.id_producto);
                map.set(key, (map.get(key) || 0) + (i.cantidad || 0));
            });
            return map;
        }
        const mapAlcala = sumarPorProducto(invAlcala.data);
        const mapLocal01 = sumarPorProducto(invLocal01.data);
        const mapJordan = sumarPorProducto(invJordan.data);

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
                stock_alcala: stockAlc, // Prioridad total al inventario real
                stock_local01: stock01,
                stock_jordan: stockJor,
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

const PLACEHOLDER_IMG_FALLBACK = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23f1f5f9" width="100" height="100"/><text fill="%2394a3b8" font-family="sans-serif" font-size="11" x="50%" y="50%" text-anchor="middle" dy="0.3em">Sin Foto</text></svg>';

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

        const imagen = p.url_imagen || PLACEHOLDER_IMG_FALLBACK;
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
                    <button onclick="duplicarProducto('${p.id}')" class="btn-icon" title="Duplicar" style="background:#06b6d4;">📑</button>
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
// FORMULARIO PRODUCTO (CERO MODALES - PANTALLA COMPLETA)
// ═══════════════════════════════════════════════════════════════

async function mostrarFormProducto() {
    const listaView = document.getElementById('vistaListaProductos');
    if (listaView) listaView.style.display = 'none';

    const form = document.getElementById('formProducto');
    if (form) {
        form.style.display = 'block';
        window.scrollTo({ top: form.offsetTop - 30, behavior: 'smooth' });
    }

    document.getElementById('formTituloProducto').textContent = '➕ Nuevo Producto';
    document.getElementById('productoId').value = '';
    const hiddenProdId = document.getElementById('productoIdProducto');
    if (hiddenProdId) hiddenProdId.value = '';

    // Reset inputs
    const ids = ['productoNombre', 'productoReferencia', 'productoCategoria', 'productoSubcategoria',
        'productoMarca', 'productoProveedor', 'productoPrecioCompra', 'productoPrecio', 'productoMargen',
        'productoEstado', 'stockAlcala', 'stockLocal01', 'stockJordan', 'stockBodega', 'stockDigital',
        'productoDescCorta', 'productoDescTecnica', 'productoImagen'];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = (id === 'productoEstado') ? 'Activo' : (id.startsWith('stock') ? '0' : '');
    });

    // Limpiar y preparar Matriz Unificada de Colores y Stock
    const containerMatriz = document.getElementById('containerMatrizColores');
    if (containerMatriz) {
        containerMatriz.innerHTML = '';
        // Tarjeta inicial por defecto
        agregarTarjetaColor('', '', [{ talla: 'Única', alcala: 0, local01: 0, jordan: 0, bodega: 0 }]);
    }

    // Limpiar memoria de archivo temporal y vista previa de imagen principal
    if (window.archivosTemporal) window.archivosTemporal.producto = null;
    if (typeof archivosTemporal !== 'undefined') archivosTemporal.producto = null;
    removerPreview('producto');
    await cargarProveedoresEnSelectProducto();
    await cargarCategoriasSelect();
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

// Cargar Categorías Dinámicas
const categoriasCache = [];

async function cargarCategoriasSelect(seleccionado = null) {
    const select = document.getElementById('productoCategoria');
    if (!select) return;

    if (!seleccionado && select.value) seleccionado = select.value;

    select.innerHTML = '<option value="">Seleccionar...</option>';

    if (categoriasCache.length === 0) {
        try {
            const { data, error } = await supabaseClient
                .from('categorias')
                .select('nombre')
                .order('nombre');

            if (error) throw error;

            if (data && data.length > 0) {
                categoriasCache.push(...data.map(c => c.nombre));
            } else {
                categoriasCache.push('CASCOS', 'INDUMENTARIA', 'IMPERMEABLES', 'ACCESORIOS', 'MALETEROS', 'REPUESTOS');
            }
        } catch (e) {
            console.error('Error cargando categorias:', e);
            categoriasCache.push('CASCOS', 'INDUMENTARIA', 'IMPERMEABLES', 'ACCESORIOS', 'MALETEROS', 'REPUESTOS');
        }
    }

    categoriasCache.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        if (cat === seleccionado) opt.selected = true;
        select.appendChild(opt);
    });
}

function actualizarFormularioPorCategoria() {
    const cat = document.getElementById('productoCategoria')?.value?.toUpperCase() || '';
    const esMaletero = window.CATEGORIAS_MALETEROS?.includes(cat) || false;
    const place = esMaletero ? 'Ej: 30L, 45L' : 'Ej: S, M, 40...';

    document.querySelectorAll('.input-talla').forEach(inp => {
        inp.placeholder = place;
    });
}

// Listener para cambios
document.addEventListener('DOMContentLoaded', () => {
    const catSelect = document.getElementById('productoCategoria');
    if (catSelect) {
        catSelect.addEventListener('change', actualizarFormularioPorCategoria);
    }
});

function cancelarFormProducto() {
    if (window.archivosTemporal) window.archivosTemporal.producto = null;
    if (typeof archivosTemporal !== 'undefined') archivosTemporal.producto = null;
    removerPreview('producto');

    const form = document.getElementById('formProducto');
    if (form) form.style.display = 'none';

    const listaView = document.getElementById('vistaListaProductos');
    if (listaView) listaView.style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ═══════════════════════════════════════════════════════════════
// MATRIZ UNIFICADA DE VARIANTES: COLOR + FOTO + TALLAS Y STOCK
// ═══════════════════════════════════════════════════════════════

window.agregarTarjetaColor = function (color = '', url = '', tallas = []) {
    const container = document.getElementById('containerMatrizColores');
    if (!container) return;

    const cardId = 'color_card_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const card = document.createElement('div');
    card.className = 'card-color-variante';
    card.id = cardId;
    card.style.background = '#ffffff';
    card.style.border = '1px solid #cbd5e1';
    card.style.borderRadius = '0.85rem';
    card.style.padding = '1.25rem';
    card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '1rem';

    const imgUrl = url || PLACEHOLDER_IMG_FALLBACK;

    card.innerHTML = `
        <!-- CABECERA DEL COLOR: NOMBRE + FOTO + ACCIONES -->
        <div style="display: flex; gap: 1rem; align-items: center; justify-content: space-between; flex-wrap: wrap; background: #f8fafc; padding: 0.85rem 1rem; border-radius: 0.65rem; border: 1px solid #e2e8f0;">
            <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 260px;">
                <span style="font-size: 1.25rem;">🎨</span>
                <input type="text" class="form-control form-control-sm input-color-nombre" value="${color}" placeholder="Nombre del Color (ej: Negro - Gris - Rosado)" style="font-weight: 700; font-size: 0.95rem; color: #1e293b;">
            </div>
            
            <div style="display: flex; align-items: center; gap: 0.65rem;">
                <input type="hidden" class="input-color-url" value="${url}">
                <div class="color-preview-img" style="width: 46px; height: 46px; background: #f1f5f9; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1; flex-shrink: 0;">
                    <img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <button type="button" class="btn btn-sm btn-outline-primary" onclick="subirImagenColorTarjeta('${cardId}')" title="Subir foto para este color" style="display: flex; align-items: center; gap: 0.35rem; font-weight: 600;">
                    📷 Foto
                </button>
                <button type="button" class="btn btn-sm btn-outline-secondary" onclick="limpiarFotoColorTarjeta('${cardId}')" title="Quitar foto de este color">
                    ❌
                </button>
                <button type="button" class="btn btn-sm btn-danger" onclick="removerTarjetaColor('${cardId}')" title="Eliminar este color completo con su inventario" style="margin-left: 0.5rem;">
                    🗑️ Quitar Color
                </button>
            </div>
        </div>

        <!-- TABLA DE TALLAS Y STOCK PARA ESTE COLOR -->
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 0.5rem; overflow: hidden;">
            <table class="table table-sm table-bordered" style="margin-bottom: 0; width: 100%; font-size: 0.88rem;">
                <thead style="background: #f1f5f9; color: #334155; font-weight: 600;">
                    <tr>
                        <th style="width: 25%; padding: 0.5rem 0.75rem;">📏 Talla</th>
                        <th style="width: 15%; padding: 0.5rem 0.75rem;">🏪 Alcalá</th>
                        <th style="width: 15%; padding: 0.5rem 0.75rem;">🏬 Local 01</th>
                        <th style="width: 15%; padding: 0.5rem 0.75rem;">🏢 Jordán</th>
                        <th style="width: 15%; padding: 0.5rem 0.75rem;">📦 Bodega</th>
                        <th style="width: 15%; text-align: center; padding: 0.5rem 0.75rem;">Acción</th>
                    </tr>
                </thead>
                <tbody class="tbody-tallas-color" id="tbody_${cardId}">
                    <!-- Filas de tallas de este color -->
                </tbody>
            </table>
        </div>

        <div style="display: flex; justify-content: flex-start;">
            <button type="button" class="btn btn-sm btn-outline-info" onclick="agregarFilaTallaAColor('${cardId}')" style="font-weight: 600;">
                + Agregar Talla a este Color
            </button>
        </div>
    `;

    container.appendChild(card);

    // Precargar tallas o agregar fila inicial
    const listaTallas = Array.isArray(tallas) && tallas.length > 0 ? tallas : [{ talla: 'Única', alcala: 0, local01: 0, jordan: 0, bodega: 0 }];
    listaTallas.forEach(t => {
        agregarFilaTallaAColor(cardId, t.talla || 'Única', t.alcala || 0, t.local01 || 0, t.jordan || 0, t.bodega || 0);
    });

    sumarStocksGenerales();
};

window.agregarFilaTallaAColor = function (cardId, talla = '', a = 0, l = 0, j = 0, b = 0) {
    const tbody = document.getElementById(`tbody_${cardId}`);
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.className = 'fila-talla';

    const cat = document.getElementById('productoCategoria')?.value?.toUpperCase() || '';
    const esMaletero = window.CATEGORIAS_MALETEROS?.includes(cat) || false;
    const place = esMaletero ? 'Ej: 30L, 45L' : 'Ej: S, M, 40...';

    tr.innerHTML = `
        <td style="padding: 4px 8px;">
            <input type="text" class="form-control form-control-sm input-talla" value="${talla}" placeholder="${place}" style="height: 32px; font-weight: 600;">
        </td>
        <td style="padding: 4px 8px;">
            <input type="number" class="form-control form-control-sm input-stock-alcala" value="${a}" min="0" style="height: 32px;" oninput="sumarStocksGenerales()">
        </td>
        <td style="padding: 4px 8px;">
            <input type="number" class="form-control form-control-sm input-stock-local01" value="${l}" min="0" style="height: 32px;" oninput="sumarStocksGenerales()">
        </td>
        <td style="padding: 4px 8px;">
            <input type="number" class="form-control form-control-sm input-stock-jordan" value="${j}" min="0" style="height: 32px;" oninput="sumarStocksGenerales()">
        </td>
        <td style="padding: 4px 8px;">
            <input type="number" class="form-control form-control-sm input-stock-bodega" value="${b}" min="0" style="height: 32px;" oninput="sumarStocksGenerales()">
        </td>
        <td style="padding: 4px 8px; text-align: center;">
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('tr').remove(); sumarStocksGenerales();" title="Quitar talla" style="padding: 2px 8px;">
                🗑️
            </button>
        </td>
    `;

    tbody.appendChild(tr);
    sumarStocksGenerales();
};

window.removerTarjetaColor = function (cardId) {
    const card = document.getElementById(cardId);
    if (card) card.remove();
    sumarStocksGenerales();
};

window.limpiarFotoColorTarjeta = function (cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const urlInput = card.querySelector('.input-color-url');
    const imgEl = card.querySelector('.color-preview-img img');
    if (urlInput) urlInput.value = '';
    if (imgEl) imgEl.src = PLACEHOLDER_IMG_FALLBACK;
    showToast('Foto del color eliminada', 'info');
};

window.subirImagenColorTarjeta = async function (cardId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            showToast('Subiendo imagen de color...', 'info');
            const publicUrl = await window.subirImagen(file, 'productos-imagenes');
            if (!publicUrl) return;

            const card = document.getElementById(cardId);
            if (card) {
                card.querySelector('.input-color-url').value = publicUrl;
                card.querySelector('.color-preview-img img').src = publicUrl;
            }
            showToast('Imagen subida con éxito');
        } catch (err) {
            console.error('Error subiendo imagen de color:', err);
            showToast('Error al subir imagen', 'error');
        }
    };
    input.click();
};

window.sumarStocksGenerales = function () {
    let totalA = 0, totalL = 0, totalJ = 0, totalB = 0;
    document.querySelectorAll('.card-color-variante').forEach(card => {
        card.querySelectorAll('.fila-talla').forEach(tr => {
            totalA += parseInt(tr.querySelector('.input-stock-alcala')?.value) || 0;
            totalL += parseInt(tr.querySelector('.input-stock-local01')?.value) || 0;
            totalJ += parseInt(tr.querySelector('.input-stock-jordan')?.value) || 0;
            totalB += parseInt(tr.querySelector('.input-stock-bodega')?.value) || 0;
        });
    });

    if (document.getElementById('stockAlcala')) document.getElementById('stockAlcala').value = totalA;
    if (document.getElementById('stockLocal01')) document.getElementById('stockLocal01').value = totalL;
    if (document.getElementById('stockJordan')) document.getElementById('stockJordan').value = totalJ;
    if (document.getElementById('stockBodega')) document.getElementById('stockBodega').value = totalB;
};

// ═══════════════════════════════════════════════════════════════
// GUARDAR / EDITAR
// ═══════════════════════════════════════════════════════════════

async function guardarProducto() {
    const id = document.getElementById('productoId').value;
    const nombre = document.getElementById('productoNombre').value.trim();
    const categoria = document.getElementById('productoCategoria').value;
    const subcategoria = document.getElementById('productoSubcategoria').value.trim();
    const precio = document.getElementById('productoPrecio').value;
    const precioCompra = document.getElementById('productoPrecioCompra').value || 0;
    const marca = document.getElementById('productoMarca').value.trim();
    const proveedorId = document.getElementById('productoProveedor').value || null;
    const estado = document.getElementById('productoEstado').value;
    const referencia = document.getElementById('productoReferencia').value;
    const descripcionCorta = document.getElementById('productoDescCorta').value;
    const descripcionTecnica = document.getElementById('productoDescTecnica').value;
    let urlImagen = document.getElementById('productoImagen').value.trim();

    if (!nombre || parseFloat(precio) <= 0) {
        showToast('Nombre y Precio son obligatorios', 'warning');
        return;
    }

    const btnGuardar = document.querySelector('button[onclick="guardarProducto()"]');
    if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...'; }

    try {
        // 1. Imagen principal
        if (window.archivosTemporal?.producto) {
            try {
                showToast('Subiendo imagen principal...', 'info');
                const urlSubida = await window.subirImagen(window.archivosTemporal.producto, 'productos-imagenes');
                if (urlSubida) urlImagen = urlSubida;
            } catch (err) {
                console.error('Error subiendo imagen:', err);
            } finally {
                window.archivosTemporal.producto = null;
                if (typeof archivosTemporal !== 'undefined') archivosTemporal.producto = null;
            }
        }

        // 2. Extraer Variantes de Color e Inventario de la Matriz Unificada
        const tarjetasColores = document.querySelectorAll('#containerMatrizColores .card-color-variante');
        const variantesData = [];
        const inventarioData = [];

        tarjetasColores.forEach(card => {
            const colorName = card.querySelector('.input-color-nombre')?.value.trim() || '';
            const colorUrl = card.querySelector('.input-color-url')?.value.trim() || '';

            if (colorName || colorUrl) {
                variantesData.push({ color: colorName || 'Único', url: colorUrl });
            }

            const filasTalla = card.querySelectorAll('.fila-talla');
            filasTalla.forEach(tr => {
                const tallaName = tr.querySelector('.input-talla')?.value.trim() || 'Única';
                const sA = parseInt(tr.querySelector('.input-stock-alcala')?.value) || 0;
                const sL = parseInt(tr.querySelector('.input-stock-local01')?.value) || 0;
                const sJ = parseInt(tr.querySelector('.input-stock-jordan')?.value) || 0;
                const sB = parseInt(tr.querySelector('.input-stock-bodega')?.value) || 0;

                inventarioData.push({
                    color: colorName || '',
                    talla: tallaName,
                    alcala: sA,
                    local01: sL,
                    jordan: sJ,
                    bodega: sB
                });
            });
        });

        // Si no se agregaron filas, crear una por defecto
        if (inventarioData.length === 0) {
            inventarioData.push({
                color: '',
                talla: 'Única',
                alcala: 0,
                local01: 0,
                jordan: 0,
                bodega: 0
            });
        }

        const stockDigital = parseInt(document.getElementById('stockDigital').value) || 0;

        const productoData = {
            nombre, referencia, categoria, subcategoria, marca,
            proveedor: proveedorId,
            variantes: variantesData,
            tallas: Array.from(new Set(inventarioData.map(i => i.talla))),
            precio: parseFloat(precio),
            precio_compra: parseFloat(precioCompra),
            stock_digital: stockDigital,
            estado,
            descripcion_corta: descripcionCorta,
            descripcion_tecnica: descripcionTecnica,
            url_imagen: urlImagen,
            en_oferta: document.getElementById('productoEnOferta')?.checked || false,
            es_nuevo: document.getElementById('productoEsNuevo')?.checked || false,
            fecha_oferta_hasta: document.getElementById('productoOfertaHasta')?.value || null,
            fecha_nuevo_hasta: document.getElementById('productoNuevoHasta')?.value || null,
            porcentaje_oferta: parseInt(document.getElementById('productoPorcentajeOferta')?.value) || null
        };

        let prodTextId;
        if (id) {
            const { data, error } = await supabaseClient.from('productos').update(productoData).eq('id', id).select();
            if (error) throw error;
            prodTextId = data[0].id_producto || data[0].id;
        } else {
            // INSERTAR NUEVO con ID ROBUSTO
            let slugBase = 'producto';
            try {
                if (typeof window.normalizarTexto === 'function') {
                    slugBase = window.normalizarTexto(nombre);
                } else if (typeof normalizarTexto === 'function') {
                    slugBase = normalizarTexto(nombre);
                } else {
                    slugBase = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                }
            } catch (e) {
                slugBase = nombre.replace(/[^a-zA-Z0-9 ]/g, '');
            }

            slugBase = (slugBase || 'nuevo').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const randomSuffix = Math.floor(Math.random() * 100000);
            const newIdProducto = `${slugBase}-${randomSuffix}`;

            productoData.id_producto = newIdProducto;

            const { data, error } = await supabaseClient.from('productos').insert(productoData).select();
            if (error) throw error;
            prodTextId = data[0].id_producto || data[0].id;
        }

        // GUARDAR INVENTARIO (ESTRATEGIA DELETE-INSERT PARA EVITAR 409)
        // 1. Sedes físicas con tablas dedicadas por variante (talla/color)
        const sedesTiendas = [
            { id: 'Alcalá', tabla: 'inventario_alcala', key: 'alcala' },
            { id: 'Local 01', tabla: 'inventario_01', key: 'local01' },
            { id: 'Jordán', tabla: 'inventario_jordan', key: 'jordan' }
        ];

        for (const sede of sedesTiendas) {
            await supabaseClient.from(sede.tabla).delete().eq('id_producto', prodTextId);

            const opsSede = inventarioData.map(i => ({
                id_producto: prodTextId,
                talla: i.talla,
                color: i.color,
                cantidad: i[sede.key],
                ultima_actualizacion: new Date().toISOString()
            })).filter(op => op.cantidad >= 0);

            if (opsSede.length > 0) {
                const { error: errInsert } = await supabaseClient.from(sede.tabla).insert(opsSede);
                if (errInsert) {
                    console.error(`Error guardando inventario ${sede.id}:`, errInsert);
                    for (const op of opsSede) {
                        await supabaseClient.from(sede.tabla).insert(op);
                    }
                }
            }
        }

        // 2. Sincronización segura de Bodega
        try {
            const totalBodega = inventarioData.reduce((acc, i) => acc + (parseInt(i.bodega) || 0), 0);
            await supabaseClient.from('inventario_bodega').delete().eq('id_producto', prodTextId);
            if (totalBodega > 0) {
                await supabaseClient.from('inventario_bodega').insert({
                    id_producto: prodTextId,
                    cantidad: totalBodega,
                    updated_at: new Date().toISOString()
                });
            }
        } catch (eBod) {
            console.warn('[Bodega] Sincronización opcional legacy omitida:', eBod);
        }

        // 3. Actualizar Tabla Unificada 'inventario'
        await supabaseClient.from('inventario').delete().eq('producto_id', prodTextId);

        const todasSedes = [
            { id: 'Alcalá', key: 'alcala' },
            { id: 'Local 01', key: 'local01' },
            { id: 'Jordán', key: 'jordan' },
            { id: 'Bodega', key: 'bodega' }
        ];

        const opsUnified = [];
        for (const i of inventarioData) {
            for (const sede of todasSedes) {
                if (i[sede.key] !== undefined && i[sede.key] !== null) {
                    opsUnified.push({
                        producto_id: prodTextId,
                        local_id: sede.id,
                        talla: i.talla,
                        color: i.color || '',
                        cantidad: i[sede.key],
                        ultima_actualizacion: new Date().toISOString()
                    });
                }
            }
        }

        if (opsUnified.length > 0) {
            const { error: errUni } = await supabaseClient.from('inventario').insert(opsUnified);
            if (errUni) {
                console.error('Error guardando inventario unificado:', errUni);
                for (const op of opsUnified) {
                    await supabaseClient.from('inventario').insert(op);
                }
            }
        }

        // Limpiar memoria residual
        if (window.archivosTemporal) window.archivosTemporal.producto = null;
        if (typeof archivosTemporal !== 'undefined') archivosTemporal.producto = null;

        showToast('Producto y Stock guardados correctamente');
        cancelarFormProducto();
        cargarProductos();

    } catch (err) {
        console.error('Error guardando producto:', err);
        showToast('Error al guardar: ' + err.message, 'error');
    } finally {
        if (window.archivosTemporal) window.archivosTemporal.producto = null;
        if (typeof archivosTemporal !== 'undefined') archivosTemporal.producto = null;
        if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.innerHTML = '💾 Guardar Producto'; }
    }
}

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE IMÁGENES (BUCKET SUPABASE)
// ═══════════════════════════════════════════════════════════════

function handleFileSelect(event, tipo) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showToast('La imagen no debe superar los 5MB', 'error');
        return;
    }

    if (!window.archivosTemporal) window.archivosTemporal = {};
    window.archivosTemporal[tipo] = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById(`preview${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
        const container = document.getElementById(`previewContainer${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
        const dropzone = document.getElementById(`dropzone${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);

        if (preview && container) {
            preview.src = e.target.result;
            container.style.display = 'block';
            if (dropzone) {
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
    if (window.archivosTemporal) window.archivosTemporal[tipo] = null;
    if (typeof archivosTemporal !== 'undefined') archivosTemporal[tipo] = null;

    const input = document.getElementById(`fileInput${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
    if (input) input.value = '';

    const imgUrlInput = document.getElementById(tipo === 'producto' ? 'productoImagen' : `${tipo}Imagen`);
    if (imgUrlInput) imgUrlInput.value = '';

    const container = document.getElementById(`previewContainer${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
    const dropzone = document.getElementById(`dropzone${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
    const previewImg = document.getElementById(`preview${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
    if (previewImg) previewImg.src = '';

    if (container) container.style.display = 'none';
    if (dropzone) {
        Array.from(dropzone.children).forEach(child => {
            child.style.visibility = 'visible';
        });
    }
}

window.handleFileSelect = handleFileSelect;
window.removerPreview = removerPreview;

async function editarProducto(id) {
    const p = productosCache.find(x => x.id === id);
    if (!p) return;

    await mostrarFormProducto();
    document.getElementById('formTituloProducto').textContent = `✏️ Editando: ${p.nombre}`;
    document.getElementById('productoId').value = p.id;
    const hiddenProdId = document.getElementById('productoIdProducto');
    if (hiddenProdId) hiddenProdId.value = p.id_producto || p.id;

    document.getElementById('productoNombre').value = p.nombre;
    document.getElementById('productoReferencia').value = p.referencia || '';
    document.getElementById('productoCategoria').value = p.categoria;
    actualizarFormularioPorCategoria();
    document.getElementById('productoSubcategoria').value = p.subcategoria || '';
    document.getElementById('productoMarca').value = p.marca;

    await cargarProveedoresEnSelectProducto(p.proveedor);

    document.getElementById('productoPrecio').value = p.precio;
    document.getElementById('productoPrecioCompra').value = p.precio_compra || 0;

    const m = p.precio > 0 ? ((p.precio - (p.precio_compra || 0)) / p.precio) * 100 : 0;
    document.getElementById('productoMargen').value = m.toFixed(1) + '%';

    document.getElementById('productoEstado').value = p.estado;
    document.getElementById('productoDescCorta').value = p.descripcion_corta || '';
    document.getElementById('productoDescTecnica').value = p.descripcion_tecnica || '';
    document.getElementById('productoImagen').value = p.url_imagen || '';

    // Cargar etiquetas
    const chkOf = document.getElementById('productoEnOferta'); if (chkOf) { chkOf.checked = !!p.en_oferta; if (window.toggleFechaOferta) toggleFechaOferta(); }
    const chkNu = document.getElementById('productoEsNuevo'); if (chkNu) { chkNu.checked = !!p.es_nuevo; if (window.toggleFechaNuevo) toggleFechaNuevo(); }
    if (p.fecha_oferta_hasta) { const el = document.getElementById('productoOfertaHasta'); if (el) el.value = p.fecha_oferta_hasta.substring(0, 10); }
    if (p.fecha_nuevo_hasta) { const el = document.getElementById('productoNuevoHasta'); if (el) el.value = p.fecha_nuevo_hasta.substring(0, 10); }
    if (p.porcentaje_oferta) { const el = document.getElementById('productoPorcentajeOferta'); if (el) el.value = p.porcentaje_oferta; }

    const preview = document.getElementById('previewProducto');
    const container = document.getElementById('previewContainerProducto');
    const dropzone = document.getElementById('dropzoneProducto');
    if (preview && container) {
        if (p.url_imagen) {
            preview.src = p.url_imagen;
            container.style.display = 'block';
            if (dropzone) {
                Array.from(dropzone.children).forEach(child => {
                    if (child.id !== 'previewContainerProducto' && child.type !== 'file') {
                        child.style.visibility = 'hidden';
                    }
                });
            }
        } else {
            preview.src = '';
            container.style.display = 'none';
            if (dropzone) {
                Array.from(dropzone.children).forEach(child => {
                    child.style.visibility = 'visible';
                });
            }
        }
    }

    // CARGAR MATRIZ UNIFICADA DE VARIANTES Y STOCK
    const containerMatriz = document.getElementById('containerMatrizColores');
    if (containerMatriz) containerMatriz.innerHTML = '<div class="text-center p-3">Cargando variantes y stock...</div>';

    try {
        const idProd = p.id_producto || p.id;

        const [invA, invL, invJ, invBod] = await Promise.all([
            supabaseClient.from('inventario_alcala').select('talla, color, cantidad').eq('id_producto', idProd),
            supabaseClient.from('inventario_01').select('talla, color, cantidad').eq('id_producto', idProd),
            supabaseClient.from('inventario_jordan').select('talla, color, cantidad').eq('id_producto', idProd),
            supabaseClient.from('inventario').select('talla, color, cantidad').eq('producto_id', idProd).eq('local_id', 'Bodega')
        ]);

        const rawA = invA.data || [];
        const rawL = invL.data || [];
        const rawJ = invJ.data || [];
        const rawB = invBod.data || [];

        const coloresMap = {};

        if (p.variantes && Array.isArray(p.variantes)) {
            p.variantes.forEach(v => {
                const cName = (typeof v === 'string' ? v : v.color || '').trim();
                const cUrl = (typeof v === 'string' ? '' : v.url || '').trim();
                if (cName || cUrl) {
                    coloresMap[cName] = { url: cUrl, tallas: [] };
                }
            });
        }

        const todasCombinaciones = [];
        [rawA, rawL, rawJ, rawB].forEach(list => {
            list.forEach(i => {
                const c = (i.color || '').trim();
                const t = (i.talla || 'Única').trim();
                if (!coloresMap[c]) {
                    coloresMap[c] = { url: '', tallas: [] };
                }
                const existe = todasCombinaciones.some(x => x.color === c && x.talla === t);
                if (!existe) todasCombinaciones.push({ color: c, talla: t });
            });
        });

        todasCombinaciones.forEach(comb => {
            const sA = rawA.find(i => (i.color || '').trim() === comb.color && (i.talla || 'Única').trim() === comb.talla)?.cantidad || 0;
            const sL = rawL.find(i => (i.color || '').trim() === comb.color && (i.talla || 'Única').trim() === comb.talla)?.cantidad || 0;
            const sJ = rawJ.find(i => (i.color || '').trim() === comb.color && (i.talla || 'Única').trim() === comb.talla)?.cantidad || 0;
            const sB = rawB.find(i => (i.color || '').trim() === comb.color && (i.talla || 'Única').trim() === comb.talla)?.cantidad || 0;

            if (coloresMap[comb.color]) {
                coloresMap[comb.color].tallas.push({
                    talla: comb.talla,
                    alcala: sA,
                    local01: sL,
                    jordan: sJ,
                    bodega: sB
                });
            }
        });

        if (containerMatriz) containerMatriz.innerHTML = '';

        const keysColores = Object.keys(coloresMap);
        if (keysColores.length === 0) {
            // Producto sin variantes
            agregarTarjetaColor('', '', [{ talla: 'Única', alcala: 0, local01: 0, jordan: 0, bodega: 0 }]);
        } else {
            keysColores.forEach(cName => {
                const item = coloresMap[cName];
                agregarTarjetaColor(cName, item.url, item.tallas);
            });
        }

        sumarStocksGenerales();

    } catch (eInv) {
        console.error('Error cargando inventario detallado para editar:', eInv);
        if (containerMatriz) {
            containerMatriz.innerHTML = '';
            agregarTarjetaColor('', '', [{ talla: 'Única', alcala: 0, local01: 0, jordan: 0, bodega: 0 }]);
        }
    }
}

async function duplicarProducto(id) {
    const p = productosCache.find(x => x.id === id);
    if (!p) {
        showToast('Producto no encontrado', 'error');
        return;
    }

    await mostrarFormProducto();
    document.getElementById('formTituloProducto').textContent = '📑 Duplicar Producto';
    document.getElementById('productoId').value = ''; // Vacío para crear nuevo

    // Copiar todos los datos excepto el ID
    document.getElementById('productoNombre').value = p.nombre + ' (Copia)';
    document.getElementById('productoReferencia').value = p.referencia || '';
    document.getElementById('productoCategoria').value = p.categoria;
    actualizarFormularioPorCategoria();

    document.getElementById('productoSubcategoria').value = p.subcategoria || '';
    document.getElementById('productoMarca').value = p.marca;

    await cargarProveedoresEnSelectProducto(p.proveedor_id || p.proveedor);

    // Cargar Variantes en la Matriz Unificada
    const containerMatriz = document.getElementById('containerMatrizColores');
    if (containerMatriz) containerMatriz.innerHTML = '';

    if (p.variantes && Array.isArray(p.variantes) && p.variantes.length > 0) {
        p.variantes.forEach(v => {
            const cName = (typeof v === 'string' ? v : v.color || '').trim();
            const cUrl = (typeof v === 'string' ? '' : v.url || '').trim();
            agregarTarjetaColor(cName, cUrl, [{ talla: 'Única', alcala: 0, local01: 0, jordan: 0, bodega: 0 }]);
        });
    } else {
        agregarTarjetaColor('', '', [{ talla: 'Única', alcala: 0, local01: 0, jordan: 0, bodega: 0 }]);
    }

    document.getElementById('productoPrecio').value = p.precio;
    document.getElementById('productoPrecioCompra').value = p.precio_compra || 0;

    const m = p.precio > 0 ? ((p.precio - (p.precio_compra || 0)) / p.precio) * 100 : 0;
    document.getElementById('productoMargen').value = m.toFixed(1) + '%';

    document.getElementById('productoEstado').value = p.estado;
    document.getElementById('productoDescCorta').value = p.descripcion_corta || '';
    document.getElementById('productoDescTecnica').value = p.descripcion_tecnica || '';
    document.getElementById('productoImagen').value = '';

    removerPreview('producto');
    document.getElementById('stockDigital').value = p.stock_digital || 0;

    sumarStocksGenerales();
    showToast('Datos copiados a nuevo producto. Modifica y guarda.', 'info');
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
window.duplicarProducto = duplicarProducto;
window.eliminarProducto = eliminarProducto;
window.filtrarProductosAdmin = filtrarProductosAdmin;
window.exportarProductosExcel = exportarProductosExcel;
window.exportarProductosPDF = exportarProductosPDF;
window.exportarProductosExcel = exportarProductosExcel;
window.exportarProductosPDF = exportarProductosPDF;
// window.actualizarStatsDashboard = actualizarStatsDashboard; // duplicated line? ensuring cleanup if needed but keeping structure
// Replacing global export to new name
window.cargarCategoriasSelect = cargarCategoriasSelect;

window.actualizarStatsDashboard = actualizarStatsDashboard;

// ═══════════════════════════════════════════════════════════════
// SINCRONIZACIÓN STOCK (TABLA -> TOTALES)
// ═══════════════════════════════════════════════════════════════

window.sumarStocksGenerales = function () {
    const sedes = [
        { idInput: 'stockAlcala', classInput: '.input-stock-alcala' },
        { idInput: 'stockLocal01', classInput: '.input-stock-local01' },
        { idInput: 'stockJordan', classInput: '.input-stock-jordan' }
    ];

    sedes.forEach(sede => {
        const inputs = document.querySelectorAll(sede.classInput);
        let total = 0;
        inputs.forEach(inp => {
            total += (parseInt(inp.value) || 0);
        });

        const elTotal = document.getElementById(sede.idInput);
        if (elTotal) {
            elTotal.value = total;
            // Visual feedback (opcional)
            elTotal.style.backgroundColor = '#f0fdf4'; // Light green to indicate "calculated"
        }
    });

    // Digital suele ser manual, pero si se quisiera sumar de tabla se agregaría aqui.
    // Por ahora Digital sigue siendo manual separado o sin desglose.
};

// Se elimina initStockSync (Total -> Tabla) para evitar conflictos.
// La fuente de la verdad es ahora la tabla de detalles.
