// ═══════════════════════════════════════════════════════════════
// MOTEROS SPORTS LINE - ADMIN PANEL JS
// Versión: 3.0 | Fecha: 22/12/2025
// UNIFICADO: Destacados + Selector Visual de Promociones
// ═══════════════════════════════════════════════════════════════

const { createClient } = supabase;
const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
const ADMIN_PASSWORD = 'moteros2025';

// ═══════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════════════════
let productos = [];
let inventarios = { alcala: [], local01: [], jordan: [] };
let promociones = [];
let posts = [];
let ventas = [];
let chartStockLocales = null;
let chartCategorias = null;
let chartMetodosPago = null;
let chartVentasLocales = null;

// Archivos temporales para subir
let archivosTemporal = { producto: null, post: null, logo: null };

// Estado para destacados
const MAX_DESTACADOS = 8;
let productosDestacadosFiltrados = [];

// 🔥 Estado para selector de promociones
let productosSeleccionadosPromo = [];
let productosPromoFiltrados = [];

// ═══════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type] || icons.info}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100px)'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function formatearPrecio(precio) { return parseInt(precio || 0).toLocaleString('es-CO'); }
function formatearFecha(fecha) { return new Date(fecha).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }); }
function formatearHora(fecha) { return new Date(fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }); }

// ═══════════════════════════════════════════════════════════════
// LOGIN / LOGOUT
// ═══════════════════════════════════════════════════════════════
function loginAdmin() {
    const password = document.getElementById('adminPassword').value;
    if (password === ADMIN_PASSWORD) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        inicializarAdmin();
        showToast('¡Bienvenido al panel de administración!');
    } else {
        document.getElementById('loginError').textContent = '❌ Contraseña incorrecta';
        document.getElementById('adminPassword').value = '';
    }
}

function logout() {
    if (confirm('¿Cerrar sesión?')) {
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('adminPassword').value = '';
        document.getElementById('loginError').textContent = '';
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
}

// ═══════════════════════════════════════════════════════════════
// NAVEGACIÓN
// ═══════════════════════════════════════════════════════════════
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const section = this.dataset.section;
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            const targetSection = document.getElementById(section + 'Section');
            if (targetSection) targetSection.classList.add('active');
            if (window.innerWidth <= 1024) toggleSidebar();
            cargarSeccion(section);
        });
    });
}

async function cargarSeccion(section) {
    switch(section) {
        case 'dashboard': await cargarDashboard(); break;
        case 'estadisticas': await cargarEstadisticasLocales(); break;
        case 'productos': await cargarProductos(); break;
        case 'destacados': await cargarDestacadosAdmin(); break;
        case 'ventas': await cargarVentasDia(); break;
        case 'inventario': break;
        case 'alertas': await cargarAlertasStock(); break;
        case 'promociones': await cargarPromociones(); break;
        case 'blog': await cargarPosts(); break;
        case 'configuracion': await cargarConfiguracion(); break;
    }
}

async function inicializarAdmin() {
    showToast('Cargando datos...', 'info');
    try {
        await Promise.all([cargarProductos(), cargarTodosLosInventarios()]);
        await cargarDashboard();
        showToast('Panel listo');
    } catch (error) { showToast('Error al cargar datos', 'error'); console.error(error); }
}

// ═══════════════════════════════════════════════════════════════
// DRAG & DROP IMÁGENES
// ═══════════════════════════════════════════════════════════════
function setupDropzones() {
    ['Producto', 'Post', 'Logo'].forEach(tipo => {
        const dropzone = document.getElementById('dropzone' + tipo);
        if (!dropzone) return;
        ['dragover', 'dragenter'].forEach(event => { dropzone.addEventListener(event, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); }); });
        ['dragleave', 'dragend'].forEach(event => { dropzone.addEventListener(event, () => { dropzone.classList.remove('dragover'); }); });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault(); dropzone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) { procesarArchivo(file, tipo.toLowerCase()); }
            else { showToast('Solo se permiten imágenes', 'warning'); }
        });
    });
}

function handleFileSelect(event, tipo) { const file = event.target.files[0]; if (file) procesarArchivo(file, tipo); }

function procesarArchivo(file, tipo) {
    if (file.size > 5 * 1024 * 1024) { showToast('Imagen muy grande. Máximo 5MB.', 'error'); return; }
    if (!file.type.startsWith('image/')) { showToast('Solo se permiten imágenes', 'error'); return; }
    archivosTemporal[tipo] = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        const tipoCapitalizado = tipo.charAt(0).toUpperCase() + tipo.slice(1);
        const preview = document.getElementById('preview' + tipoCapitalizado);
        const container = document.getElementById('previewContainer' + tipoCapitalizado);
        if (preview && container) { preview.src = e.target.result; container.style.display = 'inline-block'; }
    };
    reader.readAsDataURL(file);
    showToast('Imagen cargada', 'info');
}

function removerPreview(tipo) {
    archivosTemporal[tipo] = null;
    const tipoCapitalizado = tipo.charAt(0).toUpperCase() + tipo.slice(1);
    const container = document.getElementById('previewContainer' + tipoCapitalizado);
    const fileInput = document.getElementById('fileInput' + tipoCapitalizado);
    if (container) container.style.display = 'none';
    if (fileInput) fileInput.value = '';
}

async function subirImagen(file, carpeta = 'productos-imagenes') {
    try {
        const timestamp = Date.now();
        const extension = file.name.split('.').pop().toLowerCase();
        const nombreArchivo = `${timestamp}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
        const { data, error } = await supabaseClient.storage.from(carpeta).upload(nombreArchivo, file, { cacheControl: '3600', upsert: false });
        if (error) throw error;
        const { data: urlData } = supabaseClient.storage.from(carpeta).getPublicUrl(nombreArchivo);
        return urlData.publicUrl;
    } catch (error) { console.error('Error subiendo imagen:', error); showToast('Error al subir imagen: ' + error.message, 'error'); return null; }
}

// ═══════════════════════════════════════════════════════════════
// EMBED DE VIDEOS
// ═══════════════════════════════════════════════════════════════
function getVideoEmbed(url) {
    if (!url) return '';
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = '';
        if (url.includes('youtu.be/')) { videoId = url.split('youtu.be/')[1].split('?')[0]; }
        else if (url.includes('shorts/')) { videoId = url.split('shorts/')[1].split('?')[0]; }
        else { const match = url.match(/[?&]v=([^&]+)/); videoId = match ? match[1] : ''; }
        if (videoId) { return `<div class="video-embed"><iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe></div>`; }
    }
    const tiktokMatch = url.match(/tiktok\.com.*\/video\/(\d+)/);
    if (tiktokMatch) { return `<div class="video-embed"><iframe src="https://www.tiktok.com/embed/v2/${tiktokMatch[1]}" allowfullscreen></iframe></div>`; }
    return `<a href="${url}" target="_blank" class="btn btn-secondary">🔗 Ver Video</a>`;
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
async function cargarDashboard() {
    const productosActivos = productos.filter(p => p.estado === 'Activo').length;
    const statProd = document.getElementById('statProductos'); if (statProd) statProd.textContent = productosActivos;
    const todosInv = [...inventarios.alcala, ...inventarios.local01, ...inventarios.jordan];
    const stockTotal = todosInv.reduce((sum, i) => sum + (i.cantidad || 0), 0);
    const statStock = document.getElementById('statStockTotal'); if (statStock) statStock.textContent = stockTotal.toLocaleString('es-CO');
    const stockBajo = todosInv.filter(i => i.cantidad > 0 && i.cantidad <= (i.stock_minimo || 5)).length;
    const statBajo = document.getElementById('statStockBajo'); if (statBajo) statBajo.textContent = stockBajo;
    const agotados = todosInv.filter(i => i.cantidad === 0).length;
    const statAgot = document.getElementById('statAgotados'); if (statAgot) statAgot.textContent = agotados;
    renderizarChartsDashboard();
}

function renderizarChartsDashboard() {
    const ctx1 = document.getElementById('chartStockLocales'); if (!ctx1) return;
    if (chartStockLocales) chartStockLocales.destroy();
    chartStockLocales = new Chart(ctx1.getContext('2d'), {
        type: 'bar',
        data: { labels: ['Alcalá', 'Local 01', 'Jordán'], datasets: [{ label: 'Unidades en Stock', data: [inventarios.alcala.reduce((s, i) => s + (i.cantidad || 0), 0), inventarios.local01.reduce((s, i) => s + (i.cantidad || 0), 0), inventarios.jordan.reduce((s, i) => s + (i.cantidad || 0), 0)], backgroundColor: ['#ff6b00', '#10b981', '#3b82f6'], borderRadius: 8 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
    const ctx2 = document.getElementById('chartCategorias'); if (!ctx2) return;
    if (chartCategorias) chartCategorias.destroy();
    const categorias = {}; productos.filter(p => p.estado === 'Activo').forEach(p => { categorias[p.categoria] = (categorias[p.categoria] || 0) + 1; });
    chartCategorias = new Chart(ctx2.getContext('2d'), {
        type: 'doughnut',
        data: { labels: Object.keys(categorias), datasets: [{ data: Object.values(categorias), backgroundColor: ['#ff6b00', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'] }] },
        options: { responsive: true, plugins: { legend: { position: 'right' } } }
    });
}

// ═══════════════════════════════════════════════════════════════
// INVENTARIOS
// ═══════════════════════════════════════════════════════════════
async function cargarTodosLosInventarios() {
    try {
        const [alcala, local01, jordan] = await Promise.all([
            supabaseClient.from('inventario_alcala').select('*'),
            supabaseClient.from('inventario_01').select('*'),
            supabaseClient.from('inventario_jordan').select('*')
        ]);
        inventarios.alcala = alcala.data || [];
        inventarios.local01 = local01.data || [];
        inventarios.jordan = jordan.data || [];
    } catch (error) { console.error('Error cargando inventarios:', error); }
}

async function cargarInventarioLocal() {
    const tabla = document.getElementById('inventarioLocal').value;
    const contenido = document.getElementById('contenidoInventario');
    if (!tabla) { contenido.innerHTML = '<div class="card-body"><div class="alert alert-info">👆 Selecciona un local</div></div>'; return; }
    contenido.innerHTML = '<div class="card-body"><div class="loading"><div class="spinner"></div><p>Cargando...</p></div></div>';
    try {
        const { data, error } = await supabaseClient.from(tabla).select('*').order('id_producto');
        if (error) throw error;
        if (!data || data.length === 0) { contenido.innerHTML = '<div class="card-body"><div class="alert alert-warning">No hay datos</div></div>'; return; }
        contenido.innerHTML = `<div class="table-container"><table class="data-table"><thead><tr><th>ID</th><th>Producto</th><th>Cantidad</th><th>Stock Mín.</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${data.map(inv => {
            const producto = productos.find(p => p.id_producto === inv.id_producto);
            let badge = 'badge-success', texto = 'OK';
            if (inv.cantidad === 0) { badge = 'badge-danger'; texto = 'Agotado'; }
            else if (inv.cantidad <= (inv.stock_minimo || 5)) { badge = 'badge-warning'; texto = 'Bajo'; }
            return `<tr><td><code>${inv.id_producto}</code></td><td><strong>${producto?.nombre || 'N/A'}</strong></td><td style="font-size:1.1rem; font-weight:700;">${inv.cantidad}</td><td>${inv.stock_minimo || 5}</td><td><span class="badge ${badge}">${texto}</span></td><td><button onclick="ajustarStock('${tabla}','${inv.id}',${inv.cantidad})" class="btn btn-secondary btn-sm">✏️</button></td></tr>`;
        }).join('')}</tbody></table></div>`;
    } catch (error) { contenido.innerHTML = `<div class="card-body"><div class="alert alert-danger">Error: ${error.message}</div></div>`; }
}

async function ajustarStock(tabla, id, actual) {
    const nueva = prompt(`Stock actual: ${actual}\n\nNueva cantidad:`, actual);
    if (nueva === null || isNaN(parseInt(nueva))) return;
    try {
        const { error } = await supabaseClient.from(tabla).update({ cantidad: parseInt(nueva), ultima_actualizacion: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        showToast('Stock actualizado'); cargarInventarioLocal(); await cargarTodosLosInventarios();
    } catch (error) { showToast('Error: ' + error.message, 'error'); }
}

function exportarInventario() {
    const tabla = document.getElementById('inventarioLocal').value;
    if (!tabla) { showToast('Selecciona un local', 'warning'); return; }
    const inv = tabla === 'inventario_alcala' ? inventarios.alcala : tabla === 'inventario_01' ? inventarios.local01 : inventarios.jordan;
    const nombreLocal = tabla.replace('inventario_', '').toUpperCase();
    let csv = 'ID_Producto,Nombre,Cantidad,Stock_Minimo,Estado\n';
    inv.forEach(i => { const p = productos.find(x => x.id_producto === i.id_producto); const estado = i.cantidad === 0 ? 'Agotado' : i.cantidad <= (i.stock_minimo || 5) ? 'Bajo' : 'OK'; csv += `${i.id_producto},"${p?.nombre || 'N/A'}",${i.cantidad},${i.stock_minimo || 5},${estado}\n`; });
    descargarCSV(csv, `inventario_${nombreLocal}_${new Date().toISOString().split('T')[0]}.csv`);
}

function descargarCSV(contenido, nombre) {
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = nombre; a.click(); URL.revokeObjectURL(url);
    showToast('CSV descargado');
}

// ═══════════════════════════════════════════════════════════════
// ESTADÍSTICAS LOCALES
// ═══════════════════════════════════════════════════════════════
async function cargarEstadisticasLocales() {
    await cargarTodosLosInventarios();
    const totalProd = document.getElementById('totalProductosGlobal'); if (totalProd) totalProd.textContent = productos.filter(p => p.estado === 'Activo').length;
    const todosInv = [...inventarios.alcala, ...inventarios.local01, ...inventarios.jordan];
    const totalUni = document.getElementById('totalUnidadesGlobal'); if (totalUni) totalUni.textContent = todosInv.reduce((s, i) => s + (i.cantidad || 0), 0).toLocaleString('es-CO');
    let valorTotal = 0; todosInv.forEach(inv => { const producto = productos.find(p => p.id_producto === inv.id_producto); if (producto) valorTotal += (producto.precio || 0) * (inv.cantidad || 0); });
    const valorInv = document.getElementById('valorInventarioGlobal'); if (valorInv) valorInv.textContent = '$' + Math.round(valorTotal/1000000) + 'M';
    const alertasEl = document.getElementById('alertasGlobal'); if (alertasEl) alertasEl.textContent = todosInv.filter(i => i.cantidad <= (i.stock_minimo || 5)).length;
    const localesData = [{ nombre: 'Alcalá', icono: '🏪', data: inventarios.alcala }, { nombre: 'Local 01', icono: '🏬', data: inventarios.local01 }, { nombre: 'Jordán', icono: '🏢', data: inventarios.jordan }];
    const grid = document.getElementById('localesStatsGrid');
    if (grid) { grid.innerHTML = localesData.map(local => { const stats = calcularEstadisticasLocal(local.data); return `<div class="local-card"><div class="local-card-header"><h4>${local.icono} ${local.nombre}</h4><span class="badge badge-success">Activo</span></div><div class="local-card-body"><div class="local-stat-row"><span class="label">Stock Total</span><span class="value">${stats.stockTotal.toLocaleString('es-CO')}</span></div><div class="local-stat-row"><span class="label">Productos</span><span class="value">${stats.productos}</span></div><div class="local-stat-row"><span class="label">Stock Bajo</span><span class="value" style="color:${stats.stockBajo > 0 ? '#f59e0b' : '#10b981'}">${stats.stockBajo}</span></div><div class="local-stat-row"><span class="label">Agotados</span><span class="value" style="color:${stats.agotados > 0 ? '#ef4444' : '#10b981'}">${stats.agotados}</span></div><div class="local-stat-row"><span class="label">Valor Est.</span><span class="value">$${Math.round(stats.valor/1000000)}M</span></div></div></div>`; }).join(''); }
    const tbody = document.getElementById('tbodyComparativa');
    if (tbody) { tbody.innerHTML = localesData.map(local => { const stats = calcularEstadisticasLocal(local.data); return `<tr><td><strong>${local.icono} ${local.nombre}</strong></td><td>${stats.stockTotal.toLocaleString('es-CO')}</td><td>${stats.productos}</td><td><span class="badge ${stats.stockBajo > 0 ? 'badge-warning' : 'badge-success'}">${stats.stockBajo}</span></td><td><span class="badge ${stats.agotados > 0 ? 'badge-danger' : 'badge-success'}">${stats.agotados}</span></td><td>$${Math.round(stats.valor/1000000)}M</td></tr>`; }).join(''); }
}

function calcularEstadisticasLocal(inventario) {
    let valor = 0; inventario.forEach(inv => { const producto = productos.find(p => p.id_producto === inv.id_producto); if (producto) valor += (producto.precio || 0) * (inv.cantidad || 0); });
    return { stockTotal: inventario.reduce((s, i) => s + (i.cantidad || 0), 0), productos: inventario.length, stockBajo: inventario.filter(i => i.cantidad > 0 && i.cantidad <= (i.stock_minimo || 5)).length, agotados: inventario.filter(i => i.cantidad === 0).length, valor };
}

// ═══════════════════════════════════════════════════════════════
// PRODUCTOS
// ═══════════════════════════════════════════════════════════════
async function cargarProductos() {
    const lista = document.getElementById('listaProductos'); if (lista) lista.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>';
    try {
        const { data, error } = await supabaseClient.from('productos').select('*').order('nombre');
        if (error) throw error;
        productos = data || [];
        renderizarProductos(productos);
    } catch (error) { console.error('Error:', error); if (lista) lista.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`; }
}

function renderizarProductos(lista) {
    const grid = document.getElementById('listaProductos'); if (!grid) return;
    if (lista.length === 0) { grid.innerHTML = '<div class="alert alert-info">No hay productos</div>'; return; }
    grid.innerHTML = lista.map(p => `<div class="producto-admin-card"><div class="producto-admin-img"><img src="${p.url_imagen || 'https://via.placeholder.com/400x300?text=Sin+Imagen'}" onerror="this.src='https://via.placeholder.com/400x300?text=Error'"></div><div class="producto-admin-info"><span class="badge ${p.estado === 'Activo' ? 'badge-success' : 'badge-warning'}">${p.estado}</span><h4>${p.nombre}</h4><p class="meta">${p.marca} • ${p.categoria}</p><p class="precio">$${formatearPrecio(p.precio)}</p><div class="producto-admin-actions"><button onclick="editarProducto('${p.id}')" class="btn btn-secondary btn-sm">✏️ Editar</button><button onclick="eliminarProducto('${p.id}')" class="btn btn-danger btn-sm">🗑️ Eliminar</button></div></div></div>`).join('');
}

function filtrarProductosAdmin() {
    const input = document.getElementById('buscarProductoAdmin');
    const busqueda = (input?.value || '').toLowerCase();
    const filtrados = productos.filter(p => (p.nombre || '').toLowerCase().includes(busqueda) || (p.marca || '').toLowerCase().includes(busqueda) || (p.categoria || '').toLowerCase().includes(busqueda) || (p.id_producto || '').toLowerCase().includes(busqueda));
    renderizarProductos(filtrados);
}

function mostrarFormProducto() { limpiarFormProducto(); document.getElementById('formTituloProducto').textContent = '➕ Nuevo Producto'; document.getElementById('formProducto').classList.add('active'); window.scrollTo({ top: 0, behavior: 'smooth' }); }

function limpiarFormProducto() {
    ['productoId', 'productoNombre', 'productoReferencia', 'productoMarca', 'productoPrecio', 'productoDescCorta', 'productoDescTecnica', 'productoImagen'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const cat = document.getElementById('productoCategoria'); if (cat) cat.value = '';
    const est = document.getElementById('productoEstado'); if (est) est.value = 'Activo';
    removerPreview('producto');
}

function cancelarFormProducto() { document.getElementById('formProducto').classList.remove('active'); limpiarFormProducto(); }

async function editarProducto(id) {
    try {
        const { data, error } = await supabaseClient.from('productos').select('*').eq('id', id).single();
        if (error || !data) { showToast('Error al cargar producto', 'error'); return; }
        document.getElementById('productoId').value = data.id;
        document.getElementById('productoNombre').value = data.nombre || '';
        document.getElementById('productoReferencia').value = data.referencia || '';
        document.getElementById('productoCategoria').value = data.categoria || '';
        document.getElementById('productoMarca').value = data.marca || '';
        document.getElementById('productoPrecio').value = data.precio || '';
        document.getElementById('productoDescCorta').value = data.descripcion_corta || '';
        document.getElementById('productoDescTecnica').value = data.descripcion_tecnica || '';
        document.getElementById('productoImagen').value = data.url_imagen || '';
        document.getElementById('productoEstado').value = data.estado || 'Activo';
        if (data.url_imagen) { const preview = document.getElementById('previewProducto'); const container = document.getElementById('previewContainerProducto'); if (preview && container) { preview.src = data.url_imagen; container.style.display = 'inline-block'; } }
        document.getElementById('formTituloProducto').textContent = '✏️ Editar Producto';
        document.getElementById('formProducto').classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function guardarProducto() {
    const id = document.getElementById('productoId').value;
    const nombre = document.getElementById('productoNombre').value.trim();
    const categoria = document.getElementById('productoCategoria').value;
    const marca = document.getElementById('productoMarca').value.trim();
    const precio = document.getElementById('productoPrecio').value;
    if (!nombre || !categoria || !marca || !precio) { showToast('Completa los campos obligatorios', 'warning'); return; }
    let urlImagen = document.getElementById('productoImagen').value.trim();
    if (archivosTemporal.producto) {
        showToast('Subiendo imagen...', 'info');
        const progressEl = document.getElementById('uploadProgressProducto'); if (progressEl) progressEl.classList.add('active');
        const urlSubida = await subirImagen(archivosTemporal.producto, 'productos-imagenes');
        if (progressEl) progressEl.classList.remove('active');
        if (urlSubida) { urlImagen = urlSubida; archivosTemporal.producto = null; showToast('Imagen subida correctamente', 'success'); }
        else { if (!confirm('Error al subir imagen. ¿Continuar sin imagen?')) { return; } }
    }
    const producto = { nombre, referencia: document.getElementById('productoReferencia').value.trim() || `REF-${Date.now()}`, categoria, marca, precio: parseFloat(precio) || 0, descripcion_corta: document.getElementById('productoDescCorta').value.trim(), descripcion_tecnica: document.getElementById('productoDescTecnica').value.trim(), url_imagen: urlImagen, estado: document.getElementById('productoEstado').value };
    try {
        if (id) { const { error } = await supabaseClient.from('productos').update(producto).eq('id', id); if (error) throw error; showToast('Producto actualizado correctamente'); }
        else { producto.id_producto = 'PROD' + Date.now(); const { error } = await supabaseClient.from('productos').insert([producto]); if (error) throw error; showToast('Producto creado correctamente'); }
        cancelarFormProducto(); await cargarProductos();
    } catch (error) { console.error('Error guardando:', error); showToast('Error: ' + error.message, 'error'); }
}

async function eliminarProducto(id) {
    const producto = productos.find(p => p.id === id); if (!producto) return;
    if (!confirm(`¿Eliminar "${producto.nombre}"?\n\nEsta acción es permanente.`)) return;
    try {
        if (producto.id_producto) { await Promise.all([supabaseClient.from('inventario_alcala').delete().eq('id_producto', producto.id_producto), supabaseClient.from('inventario_01').delete().eq('id_producto', producto.id_producto), supabaseClient.from('inventario_jordan').delete().eq('id_producto', producto.id_producto)]).catch(() => {}); }
        const { error } = await supabaseClient.from('productos').delete().eq('id', id);
        if (error) throw error;
        showToast('Producto eliminado'); await cargarProductos();
    } catch (error) { showToast('Error: ' + error.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════════
// VENTAS
// ═══════════════════════════════════════════════════════════════
async function cargarVentasDia() {
    const hoy = new Date().toISOString().split('T')[0];
    const fechaEl = document.getElementById('fechaHoy'); if (fechaEl) { fechaEl.textContent = new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
    const statsContainer = document.getElementById('ventasDiaStats');
    const tbody = document.getElementById('tbodyVentasDia');
    try {
        const { data, error } = await supabaseClient.from('ventas').select('*').gte('created_at', hoy + 'T00:00:00').lte('created_at', hoy + 'T23:59:59').order('created_at', { ascending: false });
        if (error) throw error;
        ventas = data || [];
        const totalVentas = ventas.reduce((sum, v) => sum + (v.total || 0), 0);
        const totalUnidades = ventas.reduce((sum, v) => sum + (v.cantidad || 0), 0);
        if (statsContainer) { statsContainer.innerHTML = `<div class="stat-card"><div class="stat-icon green">💰</div><div class="stat-info"><h3>$${formatearPrecio(totalVentas)}</h3><p>Total Vendido Hoy</p></div></div><div class="stat-card"><div class="stat-icon blue">🛒</div><div class="stat-info"><h3>${ventas.length}</h3><p>Transacciones</p></div></div><div class="stat-card"><div class="stat-icon orange">📦</div><div class="stat-info"><h3>${totalUnidades}</h3><p>Unidades Vendidas</p></div></div>`; }
        if (tbody) {
            if (ventas.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--gray-500);">No hay ventas hoy</td></tr>'; }
            else { tbody.innerHTML = ventas.map(v => `<tr><td>${formatearHora(v.created_at)}</td><td><strong>${v.local || 'N/A'}</strong></td><td>${v.nombre_producto || 'N/A'}</td><td>${v.cantidad || 0}</td><td><strong>$${formatearPrecio(v.total)}</strong></td><td><span class="badge badge-success">${v.metodo_pago || 'N/A'}</span></td></tr>`).join(''); }
        }
        renderizarChartsVentas(ventas);
    } catch (error) { console.error('Error cargando ventas:', error); if (statsContainer) { statsContainer.innerHTML = '<div class="alert alert-warning">No hay datos de ventas</div>'; } }
}

function renderizarChartsVentas(ventas) {
    const ctx1 = document.getElementById('chartMetodosPago');
    if (ctx1) {
        if (chartMetodosPago) chartMetodosPago.destroy();
        const metodos = {}; ventas.forEach(v => { const metodo = v.metodo_pago || 'Otro'; metodos[metodo] = (metodos[metodo] || 0) + (v.total || 0); });
        chartMetodosPago = new Chart(ctx1.getContext('2d'), { type: 'pie', data: { labels: Object.keys(metodos), datasets: [{ data: Object.values(metodos), backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'] }] }, options: { responsive: true, plugins: { legend: { position: 'bottom' } } } });
    }
    const ctx2 = document.getElementById('chartVentasLocales');
    if (ctx2) {
        if (chartVentasLocales) chartVentasLocales.destroy();
        const locales = {}; ventas.forEach(v => { const local = v.local || 'Otro'; locales[local] = (locales[local] || 0) + (v.total || 0); });
        chartVentasLocales = new Chart(ctx2.getContext('2d'), { type: 'bar', data: { labels: Object.keys(locales), datasets: [{ label: 'Ventas $', data: Object.values(locales), backgroundColor: ['#ff6b00', '#10b981', '#3b82f6'] }] }, options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } } });
    }
}

function exportarVentasDia() {
    if (ventas.length === 0) { showToast('No hay ventas para exportar', 'warning'); return; }
    let csv = 'Fecha,Hora,Local,Producto,Cantidad,Total,Metodo_Pago\n';
    ventas.forEach(v => { const fecha = new Date(v.created_at); csv += `${fecha.toLocaleDateString('es-CO')},${formatearHora(v.created_at)},"${v.local || ''}","${v.nombre_producto || ''}",${v.cantidad || 0},${v.total || 0},"${v.metodo_pago || ''}"\n`; });
    descargarCSV(csv, `ventas_${new Date().toISOString().split('T')[0]}.csv`);
}

// ═══════════════════════════════════════════════════════════════
// ALERTAS DE STOCK
// ═══════════════════════════════════════════════════════════════
async function cargarAlertasStock() {
    await cargarTodosLosInventarios();
    const alertas = [];
    const procesarLocal = (inv, nombre) => { inv.forEach(i => { if (i.cantidad <= (i.stock_minimo || 5)) { alertas.push({ local: nombre, id_producto: i.id_producto, producto: productos.find(p => p.id_producto === i.id_producto)?.nombre || i.id_producto, cantidad: i.cantidad, stockMin: i.stock_minimo || 5, tipo: i.cantidad === 0 ? 'agotado' : 'bajo' }); } }); };
    procesarLocal(inventarios.alcala, '🏪 Alcalá'); procesarLocal(inventarios.local01, '🏬 Local 01'); procesarLocal(inventarios.jordan, '🏢 Jordán');
    const contenido = document.getElementById('contenidoAlertas'); if (!contenido) return;
    if (alertas.length === 0) { contenido.innerHTML = '<div class="card-body"><div class="alert alert-success">✅ Todo el inventario está en orden</div></div>'; return; }
    alertas.sort((a, b) => a.cantidad - b.cantidad);
    contenido.innerHTML = `<div class="card-header"><h3>⚠️ ${alertas.length} alertas</h3></div><div class="table-container"><table class="data-table"><thead><tr><th>Estado</th><th>Local</th><th>Producto</th><th>Stock</th><th>Mínimo</th></tr></thead><tbody>${alertas.map(a => `<tr><td><span class="badge ${a.tipo === 'agotado' ? 'badge-danger' : 'badge-warning'}">${a.tipo === 'agotado' ? '❌ AGOTADO' : '⚠️ BAJO'}</span></td><td>${a.local}</td><td><strong>${a.producto}</strong></td><td style="font-weight:700; color:${a.tipo === 'agotado' ? 'var(--danger)' : 'var(--warning)'}">${a.cantidad}</td><td>${a.stockMin}</td></tr>`).join('')}</tbody></table></div>`;
}

// ═══════════════════════════════════════════════════════════════
// PROMOCIONES - CON SELECTOR VISUAL
// ═══════════════════════════════════════════════════════════════
async function cargarPromociones() {
    try {
        const { data, error } = await supabaseClient.from('promociones').select('*').order('id_promo');
        if (error) throw error;
        promociones = data || [];
        renderizarPromociones();
    } catch (error) { const container = document.getElementById('listaPromociones'); if (container) container.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`; }
}

function renderizarPromociones() {
    const container = document.getElementById('listaPromociones'); if (!container) return;
    if (promociones.length === 0) { container.innerHTML = '<div class="alert alert-info">No hay promociones</div>'; return; }
    container.innerHTML = `<div class="card"><div class="card-header"><h3>🏷️ Promociones (${promociones.length})</h3></div><div class="table-container"><table class="data-table"><thead><tr><th>ID</th><th>Nombre</th><th>Descuento</th><th>Productos</th><th>Vigencia</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${promociones.map(p => {
        const idsProductos = (p.productos_incluidos || '').split(',').map(id => id.trim()).filter(id => id);
        const nombresProductos = idsProductos.slice(0, 2).map(id => { const prod = productos.find(pr => pr.id === id || pr.id_producto === id); return prod ? prod.nombre.substring(0, 15) + '...' : id; }).join(', ');
        const masProductos = idsProductos.length > 2 ? ` +${idsProductos.length - 2}` : '';
        return `<tr><td><code>${p.id_promo}</code></td><td><strong>${p.nombre || ''}</strong></td><td><span class="badge badge-danger">${p.descuento || 0}%</span></td><td title="${idsProductos.join(', ')}">${nombresProductos}${masProductos || ''}</td><td>${p.fecha_inicio || '?'} → ${p.fecha_fin || '?'}</td><td><span class="badge ${p.estado === 'Activa' ? 'badge-success' : 'badge-warning'}">${p.estado || 'N/A'}</span></td><td><button onclick="editarPromocion('${p.id_promo}')" class="btn btn-secondary btn-sm">✏️</button><button onclick="eliminarPromocion('${p.id_promo}')" class="btn btn-danger btn-sm">🗑️</button></td></tr>`;
    }).join('')}</tbody></table></div></div>`;
}

function mostrarFormPromocion() {
    ['promocionIdOriginal', 'promocionId', 'promocionNombre', 'promocionDescuento', 'promocionProductos', 'promocionInicio', 'promocionFin', 'promocionLocales'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const est = document.getElementById('promocionEstado'); if (est) est.value = 'Activa';
    const idInput = document.getElementById('promocionId'); if (idInput) idInput.disabled = false;
    document.getElementById('formTituloPromocion').textContent = '➕ Nueva Promoción';
    
    // 🔥 Limpiar y cargar selector de productos
    productosSeleccionadosPromo = [];
    cargarProductosParaPromo();
    actualizarSeleccionPromo();
    
    document.getElementById('formPromocion').classList.add('active');
}

function cancelarFormPromocion() { 
    document.getElementById('formPromocion').classList.remove('active'); 
    productosSeleccionadosPromo = [];
}

function editarPromocion(id) {
    const promo = promociones.find(p => p.id_promo === id); if (!promo) return;
    document.getElementById('promocionIdOriginal').value = promo.id_promo;
    document.getElementById('promocionId').value = promo.id_promo;
    document.getElementById('promocionId').disabled = true;
    document.getElementById('promocionNombre').value = promo.nombre || '';
    document.getElementById('promocionDescuento').value = promo.descuento || '';
    document.getElementById('promocionInicio').value = promo.fecha_inicio || '';
    document.getElementById('promocionFin').value = promo.fecha_fin || '';
    document.getElementById('promocionLocales').value = promo.locales_aplicables || '';
    document.getElementById('promocionEstado').value = promo.estado || 'Activa';
    
    // 🔥 Cargar productos seleccionados existentes
    const idsExistentes = (promo.productos_incluidos || '').split(',').map(id => id.trim()).filter(id => id);
    productosSeleccionadosPromo = [...idsExistentes];
    cargarProductosParaPromo();
    actualizarSeleccionPromo();
    
    document.getElementById('formTituloPromocion').textContent = '✏️ Editar Promoción';
    document.getElementById('formPromocion').classList.add('active');
}

async function guardarPromocion() {
    const idOriginal = document.getElementById('promocionIdOriginal').value;
    const idPromo = document.getElementById('promocionId').value.trim();
    const nombre = document.getElementById('promocionNombre').value.trim();
    if (!idPromo || !nombre) { showToast('ID y Nombre son requeridos', 'warning'); return; }
    
    // 🔥 Obtener IDs desde el selector
    const productosIds = productosSeleccionadosPromo.join(',');
    
    const promo = {
        id_promo: idPromo, 
        nombre,
        descuento: parseFloat(document.getElementById('promocionDescuento').value) || 0,
        productos_incluidos: productosIds,
        fecha_inicio: document.getElementById('promocionInicio').value.trim(),
        fecha_fin: document.getElementById('promocionFin').value.trim(),
        locales_aplicables: document.getElementById('promocionLocales').value.trim() || 'Todos',
        estado: document.getElementById('promocionEstado').value
    };
    
    try {
        if (idOriginal) { const { error } = await supabaseClient.from('promociones').update(promo).eq('id_promo', idOriginal); if (error) throw error; showToast('Promoción actualizada'); }
        else { const { error } = await supabaseClient.from('promociones').insert(promo); if (error) throw error; showToast('Promoción creada'); }
        cancelarFormPromocion(); await cargarPromociones();
    } catch (error) { showToast('Error: ' + error.message, 'error'); }
}

async function eliminarPromocion(id) {
    if (!confirm('¿Eliminar esta promoción?')) return;
    try { const { error } = await supabaseClient.from('promociones').delete().eq('id_promo', id); if (error) throw error; showToast('Promoción eliminada'); await cargarPromociones(); }
    catch (error) { showToast('Error: ' + error.message, 'error'); }
}

// 🔥 FUNCIONES DEL SELECTOR VISUAL DE PRODUCTOS PARA PROMOCIONES
function cargarProductosParaPromo() {
    const productosActivos = productos.filter(p => p.estado === 'Activo');
    productosPromoFiltrados = [...productosActivos];
    renderizarProductosPromo();
}

function renderizarProductosPromo() {
    const container = document.getElementById('listaProductosPromo');
    if (!container) return;
    
    if (productosPromoFiltrados.length === 0) {
        container.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--gray-400);">No hay productos disponibles</div>';
        return;
    }
    
    container.innerHTML = productosPromoFiltrados.map(p => {
        const seleccionado = productosSeleccionadosPromo.includes(p.id) || productosSeleccionadosPromo.includes(p.id_producto);
        return `
            <div class="producto-promo-item ${seleccionado ? 'seleccionado' : ''}" onclick="toggleProductoPromo('${p.id}')">
                <img class="producto-promo-img" src="${p.url_imagen || 'https://via.placeholder.com/50'}" onerror="this.src='https://via.placeholder.com/50'" alt="${p.nombre}">
                <div class="producto-promo-info">
                    <h5>${p.nombre}</h5>
                    <p>${p.marca} • ${p.categoria}</p>
                    <span class="precio">$${formatearPrecio(p.precio)}</span>
                </div>
                <div class="producto-promo-check">${seleccionado ? '✓' : ''}</div>
            </div>
        `;
    }).join('');
}

function filtrarProductosPromo() {
    const input = document.getElementById('buscarProductoPromo');
    const busqueda = (input?.value || '').toLowerCase().trim();
    const productosActivos = productos.filter(p => p.estado === 'Activo');
    
    if (!busqueda) {
        productosPromoFiltrados = [...productosActivos];
    } else {
        productosPromoFiltrados = productosActivos.filter(p => 
            (p.nombre || '').toLowerCase().includes(busqueda) ||
            (p.marca || '').toLowerCase().includes(busqueda) ||
            (p.categoria || '').toLowerCase().includes(busqueda)
        );
    }
    
    renderizarProductosPromo();
}

function toggleProductoPromo(id) {
    const index = productosSeleccionadosPromo.indexOf(id);
    if (index > -1) {
        productosSeleccionadosPromo.splice(index, 1);
    } else {
        productosSeleccionadosPromo.push(id);
    }
    renderizarProductosPromo();
    actualizarSeleccionPromo();
}

function quitarProductoPromo(id) {
    const index = productosSeleccionadosPromo.indexOf(id);
    if (index > -1) {
        productosSeleccionadosPromo.splice(index, 1);
    }
    renderizarProductosPromo();
    actualizarSeleccionPromo();
}

function limpiarSeleccionPromo() {
    productosSeleccionadosPromo = [];
    renderizarProductosPromo();
    actualizarSeleccionPromo();
}

function actualizarSeleccionPromo() {
    const contador = document.getElementById('contadorProductosPromo');
    const containerSeleccionados = document.getElementById('productosSeleccionadosPromo');
    const listaSeleccionados = document.getElementById('listaProductosSeleccionados');
    const inputHidden = document.getElementById('promocionProductos');
    
    // Actualizar contador
    if (contador) contador.textContent = `${productosSeleccionadosPromo.length} seleccionados`;
    
    // Actualizar campo oculto
    if (inputHidden) inputHidden.value = productosSeleccionadosPromo.join(',');
    
    // Mostrar/ocultar contenedor de seleccionados
    if (containerSeleccionados && listaSeleccionados) {
        if (productosSeleccionadosPromo.length === 0) {
            containerSeleccionados.style.display = 'none';
        } else {
            containerSeleccionados.style.display = 'block';
            listaSeleccionados.innerHTML = productosSeleccionadosPromo.map(id => {
                const prod = productos.find(p => p.id === id || p.id_producto === id);
                const nombre = prod ? prod.nombre : id;
                return `<span class="producto-seleccionado-tag"><span class="nombre" title="${nombre}">${nombre.substring(0, 20)}${nombre.length > 20 ? '...' : ''}</span><button class="quitar" onclick="quitarProductoPromo('${id}')">×</button></span>`;
            }).join('');
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// BLOG
// ═══════════════════════════════════════════════════════════════
async function cargarPosts() {
    try { const { data, error } = await supabaseClient.from('posts').select('*').order('created_at', { ascending: false }); if (error) throw error; posts = data || []; renderizarPosts(); }
    catch (error) { const container = document.getElementById('listaPosts'); if (container) container.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`; }
}

function renderizarPosts() {
    const grid = document.getElementById('listaPosts'); if (!grid) return;
    if (posts.length === 0) { grid.innerHTML = '<div class="alert alert-info">No hay publicaciones</div>'; return; }
    grid.innerHTML = posts.map(p => `<div class="blog-card" style="background:var(--white); border-radius:var(--radius-lg); overflow:hidden; box-shadow:var(--shadow);"><div class="blog-card-img" style="height:200px; overflow:hidden; background:var(--gray-100);">${p.video_url ? getVideoEmbed(p.video_url) : p.imagen_url ? `<img src="${p.imagen_url}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;font-size:3rem;color:var(--gray-400);\\'>📝</div>'">` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:3rem;color:var(--gray-400);">📝</div>'}</div><div class="blog-card-body" style="padding:1.25rem;"><h4 style="font-size:1.1rem;font-weight:600;margin-bottom:0.5rem;">${p.titulo}</h4><p style="color:var(--gray-500);font-size:0.9rem;margin-bottom:1rem;">${(p.contenido || '').substring(0, 100)}${p.contenido?.length > 100 ? '...' : ''}</p><p style="font-size:0.8rem;color:var(--gray-400);margin-bottom:1rem;">📅 ${formatearFecha(p.created_at)}</p><div style="display:flex;gap:0.5rem;"><button onclick="editarPost('${p.id}')" class="btn btn-secondary btn-sm">✏️ Editar</button><button onclick="eliminarPost('${p.id}')" class="btn btn-danger btn-sm">🗑️</button></div></div></div>`).join('');
}

function mostrarFormPost() { ['postId', 'postTitulo', 'postContenido', 'postImagenUrl', 'postVideo'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); removerPreview('post'); document.getElementById('formTituloPost').textContent = '➕ Nueva Publicación'; document.getElementById('formPost').classList.add('active'); }
function cancelarFormPost() { document.getElementById('formPost').classList.remove('active'); removerPreview('post'); }

async function editarPost(id) {
    try { const { data, error } = await supabaseClient.from('posts').select('*').eq('id', id).single(); if (error || !data) { showToast('Error al cargar post', 'error'); return; }
    document.getElementById('postId').value = data.id; document.getElementById('postTitulo').value = data.titulo || ''; document.getElementById('postContenido').value = data.contenido || ''; document.getElementById('postImagenUrl').value = data.imagen_url || ''; document.getElementById('postVideo').value = data.video_url || '';
    if (data.imagen_url) { const preview = document.getElementById('previewPost'); const container = document.getElementById('previewContainerPost'); if (preview && container) { preview.src = data.imagen_url; container.style.display = 'inline-block'; } }
    document.getElementById('formTituloPost').textContent = '✏️ Editar Publicación'; document.getElementById('formPost').classList.add('active'); } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function guardarPost() {
    const id = document.getElementById('postId').value; const titulo = document.getElementById('postTitulo').value.trim(); const contenido = document.getElementById('postContenido').value.trim();
    if (!titulo || !contenido) { showToast('Título y contenido son requeridos', 'warning'); return; }
    let imagenUrl = document.getElementById('postImagenUrl').value.trim();
    if (archivosTemporal.post) { showToast('Subiendo imagen...', 'info'); const progressEl = document.getElementById('uploadProgressPost'); if (progressEl) progressEl.classList.add('active'); const urlSubida = await subirImagen(archivosTemporal.post, 'blog-imagenes'); if (progressEl) progressEl.classList.remove('active'); if (urlSubida) { imagenUrl = urlSubida; archivosTemporal.post = null; } }
    const post = { titulo, contenido, imagen_url: imagenUrl, video_url: document.getElementById('postVideo').value.trim() };
    try {
        if (id) { post.updated_at = new Date().toISOString(); const { error } = await supabaseClient.from('posts').update(post).eq('id', id); if (error) throw error; showToast('Publicación actualizada'); }
        else { const { error } = await supabaseClient.from('posts').insert(post); if (error) throw error; showToast('Publicación creada'); }
        cancelarFormPost(); await cargarPosts();
    } catch (error) { showToast('Error: ' + error.message, 'error'); }
}

async function eliminarPost(id) { if (!confirm('¿Eliminar esta publicación?')) return; try { const { error } = await supabaseClient.from('posts').delete().eq('id', id); if (error) throw error; showToast('Publicación eliminada'); await cargarPosts(); } catch (error) { showToast('Error: ' + error.message, 'error'); } }

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════
async function cargarConfiguracion() {
    try { const { data, error } = await supabaseClient.from('configuracion_sistema').select('*'); if (error) throw error;
    const config = (data || []).reduce((acc, item) => { acc[item.clave] = item.valor; return acc; }, {});
    const campos = { 'configWhatsapp': 'whatsapp', 'configFacebook': 'facebook', 'configInstagram': 'instagram', 'configTiktok': 'tiktok', 'configEmail': 'email', 'configTelefono': 'telefono', 'configDireccion': 'direccion', 'configLogo': 'logo_url', 'configNombre': 'nombre_tienda', 'configSlogan': 'slogan', 'configStockMinimo': 'stock_minimo', 'configMoneda': 'moneda' };
    Object.entries(campos).forEach(([elId, clave]) => { const el = document.getElementById(elId); if (el) el.value = config[clave] || ''; });
    const colorEl = document.getElementById('configColor'); if (colorEl) colorEl.value = config.color_primary || '#ff6b00';
    if (config.logo_url) { const preview = document.getElementById('previewLogo'); const container = document.getElementById('previewContainerLogo'); if (preview && container) { preview.src = config.logo_url; container.style.display = 'inline-block'; } } } catch (error) { console.error('Error cargando configuración:', error); }
}

async function guardarConfiguracion() {
    let logoUrl = document.getElementById('configLogo').value.trim();
    if (archivosTemporal.logo) { showToast('Subiendo logo...', 'info'); const urlSubida = await subirImagen(archivosTemporal.logo, 'configuracion'); if (urlSubida) { logoUrl = urlSubida; archivosTemporal.logo = null; } }
    const configs = [ { clave: 'whatsapp', valor: document.getElementById('configWhatsapp').value.trim() }, { clave: 'facebook', valor: document.getElementById('configFacebook').value.trim() }, { clave: 'instagram', valor: document.getElementById('configInstagram').value.trim() }, { clave: 'tiktok', valor: document.getElementById('configTiktok').value.trim() }, { clave: 'email', valor: document.getElementById('configEmail').value.trim() }, { clave: 'telefono', valor: document.getElementById('configTelefono').value.trim() }, { clave: 'direccion', valor: document.getElementById('configDireccion').value.trim() }, { clave: 'logo_url', valor: logoUrl }, { clave: 'nombre_tienda', valor: document.getElementById('configNombre').value.trim() }, { clave: 'slogan', valor: document.getElementById('configSlogan').value.trim() }, { clave: 'color_primary', valor: document.getElementById('configColor').value }, { clave: 'stock_minimo', valor: document.getElementById('configStockMinimo').value.trim() }, { clave: 'moneda', valor: document.getElementById('configMoneda').value } ];
    try { for (const config of configs) { const { error } = await supabaseClient.from('configuracion_sistema').upsert(config, { onConflict: 'clave' }); if (error) throw error; } showToast('Configuración guardada'); } catch (error) { showToast('Error: ' + error.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE PRODUCTOS DESTACADOS
// ═══════════════════════════════════════════════════════════════
async function cargarDestacadosAdmin() {
    if (productos.length === 0) { await cargarProductos(); }
    renderizarPanelesDestacados();
}

function renderizarPanelesDestacados() {
    const productosActivos = productos.filter(p => p.estado === 'Activo');
    const destacados = productosActivos.filter(p => p.destacado === true);
    const disponibles = productosActivos.filter(p => p.destacado !== true);
    productosDestacadosFiltrados = [...disponibles];
    const contadorDisp = document.getElementById('contadorDisponibles');
    const contadorAct = document.getElementById('contadorActivos');
    const contadorGen = document.getElementById('contadorDestacados');
    if (contadorDisp) contadorDisp.textContent = disponibles.length;
    if (contadorAct) { contadorAct.textContent = `${destacados.length} / ${MAX_DESTACADOS}`; contadorAct.classList.toggle('limite', destacados.length >= MAX_DESTACADOS); }
    if (contadorGen) contadorGen.textContent = `${destacados.length} de ${MAX_DESTACADOS} destacados`;
    renderizarProductosDisponibles(productosDestacadosFiltrados, destacados.length >= MAX_DESTACADOS);
    renderizarDestacadosActivos(destacados);
    renderizarPreviewDestacados(destacados);
}

function renderizarProductosDisponibles(lista, limiteAlcanzado) {
    const container = document.getElementById('listaProductosDisponibles'); if (!container) return;
    if (lista.length === 0) { container.innerHTML = `<div class="destacados-empty"><div class="destacados-empty-icon">📦</div><h4>No hay productos disponibles</h4><p>Todos los productos están destacados o no hay productos activos</p></div>`; return; }
    container.innerHTML = lista.map(p => `<div class="destacado-item" data-id="${p.id}"><img class="destacado-item-img" src="${p.url_imagen || 'https://via.placeholder.com/60'}" onerror="this.src='https://via.placeholder.com/60'" alt="${p.nombre}"><div class="destacado-item-info"><h4>${p.nombre}</h4><p>${p.marca} • ${p.categoria}</p><span class="precio">$${formatearPrecio(p.precio)}</span></div><button class="btn-agregar-destacado" onclick="agregarDestacado('${p.id}')" ${limiteAlcanzado ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>⭐ Agregar</button></div>`).join('');
}

function renderizarDestacadosActivos(destacados) {
    const container = document.getElementById('listaDestacadosActivos'); if (!container) return;
    if (destacados.length === 0) { container.innerHTML = `<div class="destacados-empty"><div class="destacados-empty-icon">⭐</div><h4>Sin productos destacados</h4><p>Haz clic en "Agregar" en un producto del panel izquierdo</p></div>`; return; }
    container.innerHTML = destacados.map((p, index) => `<div class="destacado-item destacado-activo" data-id="${p.id}"><span class="destacado-posicion">${index + 1}</span><img class="destacado-item-img" src="${p.url_imagen || 'https://via.placeholder.com/60'}" onerror="this.src='https://via.placeholder.com/60'" alt="${p.nombre}"><div class="destacado-item-info"><h4>${p.nombre}</h4><p>${p.marca} • ${p.categoria}</p><span class="precio">$${formatearPrecio(p.precio)}</span></div><button class="btn-quitar-destacado" onclick="quitarDestacado('${p.id}')">✕ Quitar</button></div>`).join('');
}

function renderizarPreviewDestacados(destacados) {
    const container = document.getElementById('previewDestacados'); if (!container) return;
    if (destacados.length === 0) { container.innerHTML = `<p style="color: var(--gray-400); grid-column: 1/-1; text-align: center;">Los productos destacados aparecerán aquí</p>`; return; }
    container.innerHTML = destacados.map(p => `<div class="preview-card"><img src="${p.url_imagen || 'https://via.placeholder.com/140x80'}" onerror="this.src='https://via.placeholder.com/140x80'" alt="${p.nombre}"><p>${p.nombre}</p></div>`).join('');
}

function filtrarProductosDestacados() {
    const input = document.getElementById('buscarDestacado');
    const busqueda = (input?.value || '').toLowerCase().trim();
    const productosActivos = productos.filter(p => p.estado === 'Activo' && p.destacado !== true);
    const destacadosCount = productos.filter(p => p.estado === 'Activo' && p.destacado === true).length;
    if (!busqueda) { productosDestacadosFiltrados = [...productosActivos]; }
    else { productosDestacadosFiltrados = productosActivos.filter(p => (p.nombre || '').toLowerCase().includes(busqueda) || (p.marca || '').toLowerCase().includes(busqueda) || (p.categoria || '').toLowerCase().includes(busqueda)); }
    renderizarProductosDisponibles(productosDestacadosFiltrados, destacadosCount >= MAX_DESTACADOS);
    const contadorDisp = document.getElementById('contadorDisponibles'); if (contadorDisp) contadorDisp.textContent = productosDestacadosFiltrados.length;
}

async function agregarDestacado(id) {
    const destacadosActuales = productos.filter(p => p.estado === 'Activo' && p.destacado === true).length;
    if (destacadosActuales >= MAX_DESTACADOS) { showToast(`Máximo ${MAX_DESTACADOS} productos destacados`, 'warning'); return; }
    try { showToast('Agregando a destacados...', 'info'); const { error } = await supabaseClient.from('productos').update({ destacado: true }).eq('id', id); if (error) throw error;
    const producto = productos.find(p => p.id === id); if (producto) { producto.destacado = true; showToast(`"${producto.nombre}" agregado a destacados ⭐`); }
    renderizarPanelesDestacados(); } catch (error) { console.error('Error agregando destacado:', error); showToast('Error al agregar: ' + error.message, 'error'); }
}

async function quitarDestacado(id) {
    try { showToast('Quitando de destacados...', 'info'); const { error } = await supabaseClient.from('productos').update({ destacado: false }).eq('id', id); if (error) throw error;
    const producto = productos.find(p => p.id === id); if (producto) { producto.destacado = false; showToast(`"${producto.nombre}" quitado de destacados`); }
    renderizarPanelesDestacados(); } catch (error) { console.error('Error quitando destacado:', error); showToast('Error al quitar: ' + error.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏍️ Iniciando Moteros Admin Panel v3.0...');
    setupNavigation();
    setupDropzones();
    const passInput = document.getElementById('adminPassword');
    if (passInput) { passInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') loginAdmin(); }); }
    console.log('✅ Moteros Admin Panel v3.0 - Listo');
});

// ═══════════════════════════════════════════════════════════════
// EXPORTAR FUNCIONES GLOBALES
// ═══════════════════════════════════════════════════════════════
window.loginAdmin = loginAdmin;
window.logout = logout;
window.toggleSidebar = toggleSidebar;
window.cargarProductos = cargarProductos;
window.mostrarFormProducto = mostrarFormProducto;
window.cancelarFormProducto = cancelarFormProducto;
window.editarProducto = editarProducto;
window.guardarProducto = guardarProducto;
window.eliminarProducto = eliminarProducto;
window.filtrarProductosAdmin = filtrarProductosAdmin;
window.cargarInventarioLocal = cargarInventarioLocal;
window.ajustarStock = ajustarStock;
window.exportarInventario = exportarInventario;
window.cargarAlertasStock = cargarAlertasStock;
window.cargarPromociones = cargarPromociones;
window.mostrarFormPromocion = mostrarFormPromocion;
window.cancelarFormPromocion = cancelarFormPromocion;
window.editarPromocion = editarPromocion;
window.guardarPromocion = guardarPromocion;
window.eliminarPromocion = eliminarPromocion;
window.cargarPosts = cargarPosts;
window.mostrarFormPost = mostrarFormPost;
window.cancelarFormPost = cancelarFormPost;
window.editarPost = editarPost;
window.guardarPost = guardarPost;
window.eliminarPost = eliminarPost;
window.cargarConfiguracion = cargarConfiguracion;
window.guardarConfiguracion = guardarConfiguracion;
window.handleFileSelect = handleFileSelect;
window.removerPreview = removerPreview;
window.exportarVentasDia = exportarVentasDia;
// Destacados
window.cargarDestacadosAdmin = cargarDestacadosAdmin;
window.filtrarProductosDestacados = filtrarProductosDestacados;
window.agregarDestacado = agregarDestacado;
window.quitarDestacado = quitarDestacado;
// Selector Promociones
window.filtrarProductosPromo = filtrarProductosPromo;
window.toggleProductoPromo = toggleProductoPromo;
window.quitarProductoPromo = quitarProductoPromo;
window.limpiarSeleccionPromo = limpiarSeleccionPromo;