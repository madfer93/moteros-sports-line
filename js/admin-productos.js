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
    const ids = ['productoNombre', 'productoReferencia', 'productoCategoria', 'productoSubcategoria',
        'productoMarca', 'productoProveedor', 'productoVariantes',
        'productoPrecioCompra', 'productoPrecio', 'productoMargen',
        'productoEstado', 'stockAlcala', 'stockLocal01', 'stockJordan', 'stockDigital',
        'productoDescCorta', 'productoDescTecnica', 'productoImagen'];

    // Hacer readonly los inputs de totales para evitar edición manual (se calculan de la tabla)
    ['stockAlcala', 'stockLocal01', 'stockJordan'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.setAttribute('readonly', true);
            el.style.backgroundColor = '#f3f4f6';
            el.title = "Calculado automáticamente desde la tabla de tallas";
        }
    });

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = (id === 'productoEstado') ? 'Activo' : '';
    });

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

// NUEVO: Cargar Categorías Dinámicas
const categoriasCache = [];

async function cargarCategoriasSelect(seleccionado = null) {
    const select = document.getElementById('productoCategoria');
    if (!select) return;

    // Guardar selección actual si no se pasa explícitamente y el select ya tiene valor
    if (!seleccionado && select.value) seleccionado = select.value;

    select.innerHTML = '<option value="">Seleccionar...</option>';

    if (categoriasCache.length === 0) {
        try {
            const { data, error } = await supabaseClient
                .from('categorias')
                .select('nombre')
                .order('nombre');

            if (error) throw error;

            if (data) {
                data.forEach(c => categoriasCache.push(c.nombre));
            }
        } catch (err) {
            console.error('Error cargando categorías:', err);
            // Fallback a las básicas si falla la DB
            ['Cascos', 'Guantes', 'Protecciones', 'Accesorios'].forEach(c => categoriasCache.push(c));
        }
    }

    categoriasCache.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        if (cat === seleccionado) opt.selected = true;
        select.appendChild(opt);
    });

    // Trigger para actualizar UI
    actualizarFormularioPorCategoria();
}

// ═══════════════════════════════════════════════════════════════
// LOGICA CATEGORIAS (UI DINAMICA)
// ═══════════════════════════════════════════════════════════════
const CATEGORIAS_CON_TALLA = [
    'CASCOS', 'GUANTES', 'TRAJES DE PROTECCION', 'TRAJES DE PROTECCIÓN',
    'IMPERMEABLES Y BOTAS', 'MALETEROS', 'IMPERMEABLES', 'BOTAS'
];
const CATEGORIAS_MALETEROS = ['MALETEROS'];

function actualizarFormularioPorCategoria() {
    const catInput = document.getElementById('productoCategoria');
    const container = document.getElementById('containerTallasStock');

    if (!catInput || !container) return;

    const cat = catInput.value.trim().toUpperCase();
    const tieneColores = document.querySelectorAll('.input-color-nombre').length > 0;

    // 1. Mostrar/Ocultar Tabla de Tallas/Stock
    // Se muestra si la categoría usa tallas O si el usuario ha definido colores
    const usaTalla = CATEGORIAS_CON_TALLA.includes(cat);

    if (usaTalla || tieneColores) {
        container.style.display = 'block';

        // 2. Personalizar Header (Talla vs Capacidad)
        const thTalla = document.querySelector('#tablaTallasStock th:nth-child(2)'); // Segunda columna es Talla
        const placeholders = document.querySelectorAll('.input-talla');

        if (CATEGORIAS_MALETEROS.includes(cat)) {
            if (thTalla) thTalla.textContent = 'Capacidad (Litros)';
            placeholders.forEach(i => i.placeholder = 'Ej: 30L, 45L...');
        } else {
            if (thTalla) thTalla.textContent = 'Talla';
            placeholders.forEach(i => i.placeholder = 'Ej: S, M, 40...');
        }
    } else {
        container.style.display = 'none';
    }
}

// Listener para cambios
document.addEventListener('DOMContentLoaded', () => {
    const catSelect = document.getElementById('productoCategoria');
    if (catSelect) {
        catSelect.addEventListener('change', actualizarFormularioPorCategoria);
    }
});

function cancelarFormProducto() {
    const modal = document.getElementById('formProducto');
    if (modal) modal.style.display = 'none';
    if (modal) modal.classList.remove('active');
}

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE TALLAS Y STOCK (NUEVO)
// ═══════════════════════════════════════════════════════════════

// --- GESTIÓN DE COLORES CON FOTOS ---
window.agregarFilaColor = function (color = '', url = '') {
    const container = document.getElementById('containerColoresFotos');
    if (!container) return;
    const index = container.children.length;

    const div = document.createElement('div');
    div.className = 'fila-color';
    div.style.display = 'flex';
    div.style.gap = '1rem';
    div.style.alignItems = 'center';
    div.style.background = 'white';
    div.style.padding = '1rem';
    div.style.borderRadius = '0.75rem';
    div.style.border = '1px solid #e2e8f0';
    div.id = `fila-color-${index}`;

    div.innerHTML = `
        <div style="flex: 1;">
            <input type="text" class="form-control input-color-nombre" value="${color}" placeholder="Nombre del Color (ej: Rojo Mate)" oninput="actualizarSelectsColor()">
        </div>
        <div style="flex: 1; display: flex; align-items: center; gap: 0.5rem;">
            <input type="text" class="form-control input-color-url" value="${url}" placeholder="URL de Imagen o sube una">
            <button type="button" class="btn btn-sm btn-outline-info" onclick="subirImagenColor(${index})">📷</button>
        </div>
        <div class="color-preview-img" style="width: 50px; height: 50px; background: #f1f5f9; border-radius: 4px; overflow: hidden; border: 1px solid #e2e8f0;">
            <img src="${url || 'https://via.placeholder.com/50'}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
        <button type="button" class="btn btn-sm btn-danger" onclick="removerFilaColor(${index})">🗑️</button>
    `;
    container.appendChild(div);
    actualizarSelectsColor();
    actualizarFormularioPorCategoria(); // Asegurar que se muestre la tabla de stock
};

window.removerFilaColor = function (index) {
    const div = document.getElementById(`fila-color-${index}`);
    if (div) div.remove();
    actualizarSelectsColor();
    actualizarFormularioPorCategoria();
};

window.actualizarSelectsColor = function () {
    const nombres = Array.from(document.querySelectorAll('.input-color-nombre')).map(i => i.value.trim()).filter(v => v !== '');
    const selects = document.querySelectorAll('.select-color-stock');

    selects.forEach(select => {
        const valActual = select.value;
        select.innerHTML = '<option value="">Color...</option>' + nombres.map(n => `<option value="${n}" ${n === valActual ? 'selected' : ''}>${n}</option>`).join('');
    });
};

window.subirImagenColor = async function (index) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            showToast('Subiendo imagen de color...', 'info');

            // Usar la función global subirImagen (definida en admin.js)
            const publicUrl = await window.subirImagen(file, 'productos-imagenes');
            if (!publicUrl) return;

            const fila = document.getElementById(`fila-color-${index}`);
            if (fila) {
                fila.querySelector('.input-color-url').value = publicUrl;
                fila.querySelector('.color-preview-img img').src = publicUrl;
            }
            showToast('Imagen subida con éxito');
        } catch (err) {
            console.error('Error subiendo imagen de color:', err);
            showToast('Error al subir imagen', 'error');
        }
    };
    input.click();
};

window.agregarFilaTalla = function (talla = '', color = '', stockA = 0, stockL = 0, stockJ = 0) {
    const tbody = document.getElementById('tbodyTallasStock');
    if (!tbody) return;
    const tr = document.createElement('tr');

    // Obtener nombres de colores actuales
    const nombresColores = Array.from(document.querySelectorAll('.input-color-nombre'))
        .map(i => i.value.trim())
        .filter(v => v !== '');

    const cat = document.getElementById('productoCategoria')?.value?.toUpperCase() || '';
    const esMaletero = window.CATEGORIAS_MALETEROS?.includes(cat) || false;
    const place = esMaletero ? 'Ej: 30L' : 'Ej: S, 40...';

    tr.innerHTML = `
        <td style="padding: 4px;">
            <select class="form-control form-control-sm select-color-stock" style="padding: 2px 4px; height: 30px;">
                <option value="">Color...</option>
                ${nombresColores.map(n => `<option value="${n}" ${n === color ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
        </td>
        <td style="padding: 4px;"><input type="text" class="form-control form-control-sm input-talla" value="${talla}" placeholder="${place}" style="padding: 2px 4px; height: 30px;"></td>
        <td style="padding: 4px;"><input type="number" class="form-control form-control-sm input-stock-alcala" value="${stockA}" min="0" style="padding: 2px 4px; height: 30px;" oninput="sumarStocksGenerales()"></td>
        <td style="padding: 4px;"><input type="number" class="form-control form-control-sm input-stock-local01" value="${stockL}" min="0" style="padding: 2px 4px; height: 30px;" oninput="sumarStocksGenerales()"></td>
        <td style="padding: 4px;"><input type="number" class="form-control form-control-sm input-stock-jordan" value="${stockJ}" min="0" style="padding: 2px 4px; height: 30px;" oninput="sumarStocksGenerales()"></td>
        <td style="padding: 4px; text-align: center;"><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('tr').remove(); sumarStocksGenerales();" title="Eliminar Variantes" style="padding: 0 6px;">🗑️</button></td>
    `;
    tbody.appendChild(tr);
    sumarStocksGenerales(); // Actualizar al agregar fila (si viene con datos)
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
    let urlImagen = document.getElementById('productoImagen').value;

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
                // Usar la función global subirImagen
                const urlSubida = await window.subirImagen(window.archivosTemporal.producto, 'productos-imagenes');
                if (urlSubida) urlImagen = urlSubida;
            } catch (err) {
                console.error('Error subiendo imagen:', err);
            }
        }

        // 2. Colores e Imágenes (Variantes modernas)
        const filasColores = document.querySelectorAll('#containerColoresFotos .fila-color');
        const variantesData = [];
        filasColores.forEach(fila => {
            const colorName = fila.querySelector('.input-color-nombre').value.trim();
            const colorUrl = fila.querySelector('.input-color-url').value.trim();
            if (colorName) {
                variantesData.push({ color: colorName, url: colorUrl });
            }
        });

        // 3. Matriz de Stock (Color + Talla)
        const filasStock = document.querySelectorAll('#tbodyTallasStock tr');
        const inventarioData = [];
        filasStock.forEach(row => {
            const color = row.querySelector('.select-color-stock').value;
            const talla = row.querySelector('.input-talla').value.trim();
            const sA = parseInt(row.querySelector('.input-stock-alcala').value) || 0;
            const sL = parseInt(row.querySelector('.input-stock-local01').value) || 0;
            const sJ = parseInt(row.querySelector('.input-stock-jordan').value) || 0;

            if (talla || color) {
                inventarioData.push({
                    color: color || '',
                    talla: talla || 'Única',
                    alcala: sA,
                    local01: sL,
                    jordan: sJ
                });
            }
        });

        const stockDigital = parseInt(document.getElementById('stockDigital').value) || 0;

        const productoData = {
            nombre, referencia, categoria, subcategoria, marca,
            proveedor: proveedorId,
            variantes: variantesData, // Array de objetos {color, url}
            tallas: Array.from(new Set(inventarioData.map(i => i.talla))),
            precio: parseFloat(precio),
            precio_compra: parseFloat(precioCompra),
            stock_digital: stockDigital,
            estado,
            descripcion_corta: descripcionCorta,
            descripcion_tecnica: descripcionTecnica,
            stock_digital: stockDigital,
            estado,
            descripcion_corta: descripcionCorta,
            descripcion_tecnica: descripcionTecnica,
            url_imagen: urlImagen,
            // Etiquetas Promocionales
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
            const { data, error } = await supabaseClient.from('productos').insert(productoData).select();
            if (error) throw error;
            prodTextId = data[0].id_producto || data[0].id;
        }

        // GUARDAR INVENTARIO (ESTRATEGIA DELETE-INSERT PARA EVITAR 409)
        const sedes = [
            { id: 'Alcalá', tabla: 'inventario_alcala', key: 'alcala' },
            { id: 'Local 01', tabla: 'inventario_01', key: 'local01' },
            { id: 'Jordán', tabla: 'inventario_jordan', key: 'jordan' }
        ];

        for (const sede of sedes) {
            // 1. Borrar TODO el inventario de este producto en la sede
            // Esto es más seguro que upsert cuando las constraints son dudosas o hay conflictos de PK
            await supabaseClient.from(sede.tabla).delete().eq('id_producto', prodTextId);

            // 2. Insertar los nuevos registros
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
                    // Si falla insert masivo, intentar uno a uno (fallback)
                    for (const op of opsSede) {
                        await supabaseClient.from(sede.tabla).insert(op);
                    }
                }
            }
        }

        // 3. Actualizar Tabla Unificada 'inventario'
        // ESTRATEGIA DELETE-INSERT (Igual que por sedes, para evitar conflictos y asegurar limpieza)
        await supabaseClient.from('inventario').delete().eq('producto_id', prodTextId);

        const opsUnified = [];
        for (const i of inventarioData) {
            for (const sede of sedes) {
                // Solo agregar si la cantidad es válida (aunque sea 0)
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
                // Fallback uno a uno si falla lote
                for (const op of opsUnified) {
                    await supabaseClient.from('inventario').insert(op);
                }
            }
        }

        showToast('Producto y Stock guardados correctamente');
        cancelarFormProducto();
        cargarProductos();

    } catch (err) {
        console.error('Error guardando producto:', err);
        showToast('Error al guardar: ' + err.message, 'error');
    } finally {
        if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.innerHTML = 'Guardar Producto'; }
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

// La función subirImagenSupabase ha sido reemplazada por window.subirImagen (en admin.js)
// para mantener la consistencia y evitar duplicidad de lógica.

window.handleFileSelect = handleFileSelect;
window.removerPreview = removerPreview;

async function editarProducto(id) {
    const p = productosCache.find(x => x.id === id);
    if (!p) return;

    await mostrarFormProducto(); // This function now also clears the form and sets title
    document.getElementById('formTituloProducto').textContent = '✏️ Editar Producto';
    document.getElementById('productoId').value = p.id;

    document.getElementById('productoNombre').value = p.nombre;
    document.getElementById('productoReferencia').value = p.referencia || '';
    document.getElementById('productoCategoria').value = p.categoria;
    // Trigger update UI for category
    actualizarFormularioPorCategoria();
    document.getElementById('productoSubcategoria').value = p.subcategoria || '';
    document.getElementById('productoMarca').value = p.marca;

    await cargarProveedoresEnSelectProducto(p.proveedor);

    // Cargar Colores y Fotos
    document.getElementById('containerColoresFotos').innerHTML = '';
    if (p.variantes && Array.isArray(p.variantes)) {
        p.variantes.forEach(v => {
            if (typeof v === 'string') {
                agregarFilaColor(v, '');
            } else {
                agregarFilaColor(v.color, v.url);
            }
        });
    }

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

    const preview = document.getElementById('previewImgProducto');
    const container = document.getElementById('previewContainerProducto');
    if (preview && container) {
        if (p.url_imagen) {
            preview.src = p.url_imagen;
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
        }
    }

    // CARGAR TALLAS Y STOCK
    // Consultamos las tablas de inventario para este producto
    document.getElementById('tbodyTallasStock').innerHTML = '<tr><td colspan="6" class="text-center">Cargando inventario...</td></tr>';

    try {
        // Obtenemos id_producto (texto) si existe, o usamos el ID numérico/UUID como fallback
        const idProd = p.id_producto || p.id;

        const [invA, invL, invJ] = await Promise.all([
            supabaseClient.from('inventario_alcala').select('talla, color, cantidad').eq('id_producto', idProd),
            supabaseClient.from('inventario_01').select('talla, color, cantidad').eq('id_producto', idProd),
            supabaseClient.from('inventario_jordan').select('talla, color, cantidad').eq('id_producto', idProd)
        ]);

        // Unificar tallas y colores
        const combinaciones = new Set();
        (invA.data || []).forEach(i => combinaciones.add(JSON.stringify({ t: i.talla, c: i.color || '' })));
        (invL.data || []).forEach(i => combinaciones.add(JSON.stringify({ t: i.talla, c: i.color || '' })));
        (invJ.data || []).forEach(i => combinaciones.add(JSON.stringify({ t: i.talla, c: i.color || '' })));

        // Calcular Totales por Sede para los inputs legacy (visibilidad y backup)
        const totalA = (invA.data || []).reduce((acc, i) => acc + (parseInt(i.cantidad) || 0), 0);
        const totalL = (invL.data || []).reduce((acc, i) => acc + (parseInt(i.cantidad) || 0), 0);
        const totalJ = (invJ.data || []).reduce((acc, i) => acc + (parseInt(i.cantidad) || 0), 0);

        if (document.getElementById('stockAlcala')) document.getElementById('stockAlcala').value = totalA;
        if (document.getElementById('stockLocal01')) document.getElementById('stockLocal01').value = totalL;
        if (document.getElementById('stockJordan')) document.getElementById('stockJordan').value = totalJ;
        if (document.getElementById('stockDigital')) document.getElementById('stockDigital').value = p.stock_digital || 0;

        document.getElementById('tbodyTallasStock').innerHTML = '';

        if (combinaciones.size === 0) {
            // Si no hay datos detallados de tallas, lo tratamos como producto simple
            // Usamos los totales encontrados para pre-llenar la fila Única
            agregarFilaTalla('Única', '', totalA, totalL, totalJ);
        } else {
            // Ordenar tallas si es posible (alfabético o numérico)
            const tallasColoresOrdenadas = Array.from(combinaciones).map(s => JSON.parse(s)).sort((a, b) => {
                const compT = (a.t || '').toString().localeCompare((b.t || '').toString());
                if (compT !== 0) return compT;
                return (a.c || '').toString().localeCompare((b.c || '').toString());
            });

            tallasColoresOrdenadas.forEach(comb => {
                const sA = (invA.data || []).find(i => i.talla === comb.t && (i.color || '') === comb.c)?.cantidad || 0;
                const sL = (invL.data || []).find(i => i.talla === comb.t && (i.color || '') === comb.c)?.cantidad || 0;
                const sJ = (invJ.data || []).find(i => i.talla === comb.t && (i.color || '') === comb.c)?.cantidad || 0;
                agregarFilaTalla(comb.t, comb.c, sA, sL, sJ);
            });
        }

    } catch (e) {
        console.error('Error cargando stock detallado:', e);
        document.getElementById('tbodyTallasStock').innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error cargando stock</td></tr>';
    }
    // Recalcular totales basados en lo cargado
    sumarStocksGenerales();
}

async function duplicarProducto(id) {
    const p = productosCache.find(x => x.id === id);
    if (!p) {
        showToast('Producto no encontrado', 'error');
        return;
    }

    await mostrarFormProducto();
    document.getElementById('formTituloProducto').textContent = '📑 Duplicar Producto';
    document.getElementById('productoId').value = ''; // CRÍTICO: vacío para crear nuevo

    // Copiar todos los datos excepto el ID
    document.getElementById('productoNombre').value = p.nombre + ' (Copia)';
    document.getElementById('productoReferencia').value = p.referencia || '';
    document.getElementById('productoCategoria').value = p.categoria;

    // Trigger update UI for category
    actualizarFormularioPorCategoria();

    document.getElementById('productoSubcategoria').value = p.subcategoria || '';
    document.getElementById('productoMarca').value = p.marca;

    await cargarProveedoresEnSelectProducto(p.proveedor_id);

    // Cargar Variantes (Colores) al estilo nuevo
    document.getElementById('containerColoresFotos').innerHTML = '';
    if (p.variantes && Array.isArray(p.variantes)) {
        p.variantes.forEach(v => {
            if (typeof v === 'string') {
                agregarFilaColor(v, '');
            } else {
                agregarFilaColor(v.color, v.url);
            }
        });
    }

    document.getElementById('productoPrecio').value = p.precio;
    document.getElementById('productoPrecioCompra').value = p.precio_compra || 0;

    const m = p.precio > 0 ? ((p.precio - (p.precio_compra || 0)) / p.precio) * 100 : 0;
    document.getElementById('productoMargen').value = m.toFixed(1) + '%';

    document.getElementById('productoEstado').value = p.estado;
    document.getElementById('productoDescCorta').value = p.descripcion_corta || '';
    document.getElementById('productoDescTecnica').value = p.descripcion_tecnica || '';
    document.getElementById('productoImagen').value = '';

    // IMPORTANTE: Limpiar preview de imagen principal al duplicar
    const previewContainer = document.getElementById('previewContainerProducto');
    const dropzone = document.getElementById('dropzoneProducto');
    if (previewContainer) previewContainer.style.display = 'none';
    if (dropzone) {
        Array.from(dropzone.children).forEach(child => {
            child.style.visibility = 'visible';
        });
    }

    if (window.archivosTemporal) window.archivosTemporal['producto'] = null;
    const fileInput = document.getElementById('fileInputProducto');
    if (fileInput) fileInput.value = '';


    document.getElementById('stockDigital').value = p.stock_digital || p.stock_tiendas?.digital || 0;

    // Limpiar tabla de tallas para el duplicado (o podríamos copiar la estructura sin stock, pero mejor limpiar)
    document.getElementById('tbodyTallasStock').innerHTML = '';
    agregarFilaTalla(); // Agregar fila vacía
    showToast('Datos copiados. Modifica y guarda.', 'info');
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
