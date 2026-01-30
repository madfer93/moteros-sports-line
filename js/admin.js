// ═══════════════════════════════════════════════════════════════
// MOTEROS SPORTS LINE - ADMIN PANEL JS
// Versión: 4.1 | Fecha: 27/12/2025
// Con formulario de compras corregido y modal completo
// ═══════════════════════════════════════════════════════════════

// El cliente de Supabase ahora viene globalmente desde config.js
const supabaseClient = window.supabaseClient;

// ═══════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════════════════
let productos = [];
let inventarios = { alcala: [], local01: [], jordan: [] };
let promociones = [];
let posts = [];
let ventas = [];
let comprasData = [];
let enviosData = []; // Cache de envíos para acceso rápido
let chartStockLocales = null;
let chartCategorias = null;
let chartMetodosPago = null;
let chartVentasLocales = null;
let archivosTemporal = { producto: null, post: null, logo: null };
const MAX_DESTACADOS = 8;
let productosDestacadosFiltrados = [];
let productosSeleccionadosPromo = [];
let productosPromoFiltrados = [];
let todosDeudores = [];
let todosProveedores = [];
let leadsIAData = [];

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

function formatearMonedaInput(input) {
    let valor = input.value.replace(/[^\d]/g, '');
    if (valor) {
        valor = parseInt(valor).toLocaleString('es-CO');
        input.value = '$' + valor;
    }
}

function limpiarMoneda(valor) {
    if (typeof valor === 'number') return valor;
    if (valor === undefined || valor === null || valor === '') return 0;
    const valStr = String(valor);
    if (!valStr.includes('$') && !valStr.includes(',') && !valStr.includes('.')) {
        return parseFloat(valStr) || 0;
    }
    // Si tiene formato de moneda ($, . o ,), limpiamos todo lo no numérico
    // Para COP, usualmente 50.000 es cincuenta mil.
    return parseFloat(valStr.replace(/[^\d]/g, '')) || 0;
}


window.activarMenu = function (sectionId) {
    // Nav links
    document.querySelectorAll('.nav-dropdown-content a').forEach(a => {
        a.classList.remove('active');
        if (a.dataset.section === sectionId) a.classList.add('active');
    });
    // Section visibility
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

    // Buscar por ID exacto de sección
    const target = document.getElementById(sectionId + 'Section');
    if (target) {
        target.classList.add('active');
        // Scroll top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// ═══════════════════════════════════════════════════════════════
// LOGIN / LOGOUT CON SUPABASE AUTH (SEGURIDAD FULL)
// ═══════════════════════════════════════════════════════════════

async function checkSession() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        return !!session;
    } catch (e) {
        console.error('Error verificando sesión:', e);
        return false;
    }
}

// Escuchar cambios de estado de auth
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        if (!window.adminInicializado) {
            inicializarAdmin();
            window.adminInicializado = true;
        }
    } else if (event === 'SIGNED_OUT') {
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
        window.adminInicializado = false;
    }
});

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar sesión al cargar
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        if (!window.adminInicializado) {
            inicializarAdmin();
            window.adminInicializado = true;
        }
    } else {
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
    }
});

async function loginAdmin() {
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    const loginBtn = document.querySelector('.login-btn');

    if (!email || !password) {
        document.getElementById('loginError').textContent = '❌ Ingresa correo y contraseña';
        document.getElementById('loginError').style.display = 'block';
        return;
    }

    if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = 'Verificando...'; }

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        // Login exitoso - onAuthStateChange manejará la UI
        showToast('¡Bienvenido al panel de administración!', 'success');

    } catch (err) {
        console.error('Login error:', err);
        const msg = err.message === 'Invalid login credentials' ? 'Credenciales inválidas' : err.message;
        document.getElementById('loginError').textContent = `❌ Error: ${msg}`;
        document.getElementById('loginError').style.display = 'block';
    } finally {
        if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'Iniciar Sesión'; }
    }
}

async function logout() {
    if (confirm('¿Cerrar sesión?')) {
        await supabaseClient.auth.signOut();
        // UI se actualiza via onAuthStateChange
    }
}





function mostrarCambiarPassword() {
    const modal = document.getElementById('modalCambiarPassword');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('passwordActual').value = '';
        document.getElementById('passwordNueva').value = '';
        document.getElementById('passwordConfirmar').value = '';
    }
}

function cerrarModalPassword() {
    const modal = document.getElementById('modalCambiarPassword');
    if (modal) modal.style.display = 'none';
}

async function cambiarPassword() {
    const actual = document.getElementById('passwordActual').value;
    const nueva = document.getElementById('passwordNueva').value;
    const confirmar = document.getElementById('passwordConfirmar').value;

    if (!actual || !nueva || !confirmar) { showToast('Completa todos los campos', 'warning'); return; }
    if (nueva !== confirmar) { showToast('Las contraseñas nuevas no coinciden', 'error'); return; }
    if (nueva.length < 6) { showToast('La contraseña debe tener al menos 6 caracteres', 'warning'); return; }

    try {
        // Actualizar contraseña en Auth de Supabase
        const { error } = await supabaseClient.auth.updateUser({ password: nueva });

        if (error) throw error;

        showToast('¡Contraseña actualizada correctamente!', 'success');
        cerrarModalPassword();

        // Opcional: Cerrar sesión para obligar a entrar con nueva clave
        // await logout();

    } catch (err) {
        console.error('Error cambio password:', err);
        showToast('Error al cambiar la contraseña: ' + err.message, 'error');
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
        item.addEventListener('click', function () {
            const section = this.dataset.section;
            if (!section) return;
            navegarASeccion(section);
        });
    });

    document.querySelectorAll('.nav-dropdown-content a[data-section], .mobile-nav-group a[data-section]').forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            const section = this.dataset.section;
            if (!section) return;
            navegarASeccion(section);
        });
    });
}

function navegarASeccion(section) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const targetSection = document.getElementById(section + 'Section');
    if (targetSection) targetSection.classList.add('active');
    const mobileNav = document.getElementById('mobileNav');
    if (mobileNav && mobileNav.classList.contains('active')) mobileNav.classList.remove('active');
    cargarSeccion(section);
}

function toggleMobileMenu() {
    const mobileNav = document.getElementById('mobileNav');
    if (mobileNav) mobileNav.classList.toggle('active');
}

async function cargarSeccion(section) {
    switch (section) {
        case 'dashboard': await cargarDashboard(); break;
        case 'estadisticas': await cargarEstadisticasLocales(); break;
        case 'productos': await cargarProductos(); break;
        case 'categorias': await cargarCategorias(); break;
        case 'destacados': await cargarDestacadosAdmin(); break;
        case 'ventas': await cargarVentasDia(); break;
        case 'envios': await cargarEnvios(); break;
        case 'envios-estadisticas': await cargarEstadisticasEnvios(); break;
        case 'alertas': await cargarAlertasStock(); break;
        case 'cierres': await cargarCierresCaja(); break;
        case 'gastos': await cargarGastos(); break;
        case 'deudores': await cargarDeudores(); break;
        case 'proveedores': await cargarProveedores(); break;
        case 'compras': await cargarCompras(); break;
        case 'deudas': await cargarDeudasNegocio(); break;
        case 'creditos': await cargarCreditos(); break;
        case 'promociones': await cargarPromociones(); break;
        case 'blog': await cargarPosts(); break;
        case 'alianzas': await cargarAlianzas(); break;
        case 'leads': await cargarLeadsIA(); break;
        case 'contenido': await cargarContenidoSitio(); break;
        case 'configuracion': await cargarConfiguracion(); break;
        case 'nomina': await cargarNomina(); break;
        case 'eventos': await cargarEventos(); break;
        case 'comisiones': await cargarComisiones(); break;
        case 'rrhh':
        case 'empleados': await cargarEmpleados(); break;
        case 'traslados': await cargarTraslados(); break;
        case 'feedback': await cargarFeedback(); break;
        case 'metas':
            await Promise.all([cargarMetas(), cargarMetasProveedores()]);
            break;
        case 'servicios': await cargarServiciosAdmin(); break;
    }
}

async function inicializarAdmin() {
    showToast('Cargando datos...', 'info');
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();


        await Promise.all([cargarProductos(), cargarTodosLosInventarios()]);
        await cargarDashboard();
        showToast('Panel listo');
    } catch (error) { showToast('Error al cargar datos', 'error'); if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", error); }
}



// ═══════════════════════════════════════════════════════════════
// COMPRAS AVANZADAS (NUEVO SISTEMA FASE 3)
// ═══════════════════════════════════════════════════════════════

let itemsCompra = []; // Array temporal para items
let compraActualId = null;

// Funciones de Proveedores para Compra
async function cargarProveedoresDatalist() {
    const dataList = document.getElementById('listaProveedoresDatalist');
    if (!dataList) return;
    dataList.innerHTML = '';

    try {
        const { data, error } = await supabaseClient
            .from('proveedores')
            .select('id, razon_social')
            .order('razon_social');

        if (error) throw error;

        window.proveedoresCache = data;

        data.forEach(p => {
            const option = document.createElement('option');
            option.value = p.razon_social;
            dataList.appendChild(option);
        });
    } catch (e) {
        console.error('Error cargando proveedores list:', e);
    }
}

function detectarProveedor(nombre) {
    // Helper para lógica futura si necesitamos validar o obtener ID

}

function mostrarFormCompra() {
    itemsCompra = [];
    compraActualId = null;
    limpiarFormularioCompra();
    agregarFilaCompra(); // Agregar primera fila vacía
    cargarProveedoresDatalist();

    // Set fecha hoy
    const fechaEl = document.getElementById('compraFecha');
    if (fechaEl) fechaEl.value = new Date().toISOString().split('T')[0];

    const el = document.getElementById('formCompra');
    if (el) {
        el.style.display = 'flex';
        el.classList.add('active');
    }
    document.getElementById('formTituloCompra').textContent = '➕ Nueva Compra a Proveedor';
}

function cerrarFormCompra() {
    document.getElementById('formCompra').style.display = 'none';
}

function limpiarFormularioCompra() {
    document.getElementById('compraId').value = '';
    document.getElementById('compraProveedor').value = '';
    document.getElementById('compraFactura').value = '';
    document.getElementById('compraVencimiento').value = '';
    document.getElementById('compraResponsable').value = '';
    document.getElementById('compraMetodo').value = 'CREDITO';
    document.getElementById('compraObservaciones').value = '';
    document.getElementById('tbodyDetallesCompra').innerHTML = '';
    actualizarTotalesCompra();
}

function agregarFilaCompra(itemData = null) {
    const tbody = document.getElementById('tbodyDetallesCompra');
    const index = itemsCompra.length;

    // Estructura de item vacía
    const item = itemData || {
        producto_id: '',
        producto_nombre: '',
        costo: 0,
        precio_venta: 0,
        margen: 0,
        cant_alcala: 0,
        cant_local01: 0,
        cant_jordan: 0,
        cant_digital: 0,
        subtotal: 0
    };

    itemsCompra.push(item);

    const tr = document.createElement('tr');
    tr.id = `fila-compra-${index}`;
    tr.innerHTML = `
        <td>
            <div class="search-product-input">
                <div style="display:flex; gap:0.25rem;">
                    <input type="text" class="form-control form-control-sm" placeholder="Buscar..." 
                        oninput="buscarProductoParaCompra(this, ${index})" 
                        value="${item.producto_nombre}" style="flex:1;">
                </div>
                <input type="hidden" id="item-id-${index}" value="${item.producto_id}">
                <div class="search-results-dropdown" id="results-${index}" style="display:none;"></div>
            </div>
        </td>
        <td><input type="number" class="form-control form-control-sm" value="${item.costo || ''}" oninput="calcFila(${index})" id="costo-${index}"></td>
        <td><input type="number" class="form-control form-control-sm" value="${item.precio_venta || ''}" oninput="calcFila(${index})" id="venta-${index}"></td>
        <td><span class="badge badge-info" id="margen-${index}">${(item.margen || 0).toFixed(1)}%</span></td>
        
        <!-- Cantidad Total y Distribución -->
        <td>
            <input type="number" class="form-control form-control-sm" value="${item.cantidad_total || ''}" 
                oninput="calcFila(${index})" id="cant-total-${index}" placeholder="0">
        </td>
        <td>
            <button class="btn btn-sm btn-outline-primary" style="width:100%;" 
                onclick="abrirDistribucionAvanzada(${index})">
                📦 Distribuir
            </button>
        </td>
        
        <td><strong id="subtotal-${index}">$${formatearPrecio(item.subtotal)}</strong></td>
        <td><button class="btn btn-sm btn-danger" onclick="eliminarFilaCompra(${index})">×</button></td>
    `;

    tbody.appendChild(tr);
}

function buscarProductoParaCompra(input, index) {
    const termino = input.value.toLowerCase();
    const resultsDiv = document.getElementById(`results-${index}`);

    if (termino.length < 2) {
        resultsDiv.style.display = 'none';
        return;
    }

    const encontrados = productos.filter(p => p.nombre.toLowerCase().includes(termino) || (p.referencia && p.referencia.toLowerCase().includes(termino))).slice(0, 5);

    if (encontrados.length > 0) {
        resultsDiv.innerHTML = encontrados.map(p => `
            <div class="search-result-item" onclick="seleccionarProductoCompra(${index}, '${p.id}', '${p.nombre.replace(/'/g, "\\'")}', ${p.precio || 0})">
                <img src="${p.imagen || 'https://via.placeholder.com/30'}" width="30">
                <div>
                    <strong>${p.nombre}</strong>
                    <small>${p.referencia || ''}</small>
                </div>
            </div>
        `).join('');
        resultsDiv.style.display = 'block';
    } else {
        resultsDiv.style.display = 'none';
    }
}

function seleccionarProductoCompra(index, id, nombre, precioVentaActual) {
    document.getElementById(`item-id-${index}`).value = id;
    document.querySelector(`#fila-compra-${index} input[type="text"]`).value = nombre;
    document.getElementById(`venta-${index}`).value = precioVentaActual;
    document.getElementById(`results-${index}`).style.display = 'none';

    // Mostrar botón de variantes solo si el producto las tiene
    const btnVar = document.getElementById(`btn-var-${index}`);
    const producto = productos.find(p => p.id === id);
    if (btnVar && producto && producto.variantes && producto.variantes.length > 0) {
        btnVar.style.display = 'block';
    } else if (btnVar) {
        btnVar.style.display = 'none';
    }

    itemsCompra[index].producto_id = id;
    itemsCompra[index].producto_nombre = nombre;
    itemsCompra[index].precio_venta = precioVentaActual;

    // Check Variants
    if (producto && producto.variantes && producto.variantes.length > 0) {
        mostrarModalVariantesCompra(index, producto);
    }
}

function abrirVariantesManual(index) {
    const id = document.getElementById(`item-id-${index}`).value;
    if (!id) return showToast('Selecciona un producto primero', 'warning');
    const producto = productos.find(p => p.id === id);
    if (producto) {
        mostrarModalVariantesCompra(index, producto);
    } else {
        showToast('Info de producto no cargada', 'error');
    }
}
window.abrirVariantesManual = abrirVariantesManual;

function calcFila(index) {
    const costo = parseFloat(document.getElementById(`costo-${index}`).value) || 0;
    const venta = parseFloat(document.getElementById(`venta-${index}`).value) || 0;

    // Ahora leemos el total directamente
    let cantidadTotal = parseInt(document.getElementById(`cant-total-${index}`).value) || 0;

    // Si hay distribución guardada, sus sumas deberían coincidir idealmente, pero permitimos edición
    // Si edita el total, "desincroniza" la distribución hasta que vuelva a abrir el modal.
    // No sobreescribimos cantidadTotal basado en distribución aquí, porque el usuario está escribiendo.

    const subtotal = cantidadTotal * costo;

    // Margen
    let margen = 0;
    if (venta > 0) {
        margen = ((venta - costo) / venta) * 100;
    }

    // UI Updates
    document.getElementById(`margen-${index}`).textContent = margen.toFixed(1) + '%';
    document.getElementById(`margen-${index}`).className = `badge ${margen < 20 ? 'badge-danger' : (margen < 35 ? 'badge-warning' : 'badge-success')}`;
    document.getElementById(`subtotal-${index}`).textContent = '$' + formatearPrecio(subtotal);

    // Update Array logic
    // Mantenemos las cantidades parciales previas si existen
    const prevItem = itemsCompra[index];
    itemsCompra[index] = {
        ...prevItem,
        costo, venta, margen,
        cantidad_total: cantidadTotal,
        subtotal,
        // Mantener dist y parciales si existen, no resetear a 0
        cant_alcala: prevItem.cant_alcala || 0,
        cant_local01: prevItem.cant_local01 || 0,
        cant_jordan: prevItem.cant_jordan || 0,
        cant_digital: prevItem.cant_digital || 0,
        distribucion: prevItem.distribucion || []
    };

    actualizarTotalesCompra();
}

function eliminarFilaCompra(index) {
    // Soft delete visual or rebuild? Rebuild is safer for indexes.
    itemsCompra.splice(index, 1);
    const tbody = document.getElementById('tbodyDetallesCompra');
    tbody.innerHTML = '';
    // Re-render
    itemsCompra.forEach((item, newIndex) => {
        // ... Logica de re-render sería compleja aquí por los event listeners inline.
        // Simplificación: Ocultar fila y marcar como eliminada.
    });
    // Mejor estrategia rápida: Marcar fila a null y filtrar al guardar.
    document.getElementById(`fila-compra-${index}`).style.display = 'none';
    itemsCompra[index] = null;
    actualizarTotalesCompra();
}

function actualizarTotalesCompra() {
    const validItems = itemsCompra.filter(i => i !== null);
    const totalUnidades = validItems.reduce((sum, i) => sum + (i.cantidad_total || 0), 0);
    const totalValor = validItems.reduce((sum, i) => sum + (i.subtotal || 0), 0);

    document.getElementById('totalUnidadesCompra').textContent = totalUnidades;
    document.getElementById('totalValorCompra').textContent = '$' + formatearPrecio(totalValor);
}

// DEPRECATED: Usar logic de admin-compras.js
async function guardarCompraAvanzada_DEPRECATED() {
    console.error('Esta función está obsoleta. Use guardarCompra de admin-compras.js');
}


async function sincronizarVariantesProducto(item) {
    if (!item.distribucion || item.distribucion.length === 0) return;

    // Obtener producto actual
    const { data: prod } = await supabaseClient.from('productos').select('variantes').eq('id', item.producto_id).single();
    if (!prod) return;

    let variantesActuales = prod.variantes || [];
    let nuevasVariantes = [];

    item.distribucion.forEach(d => {
        const v = d.variante.trim();
        if (v && !variantesActuales.includes(v)) {
            variantesActuales.push(v);
            nuevasVariantes.push(v);
        }
    });

    if (nuevasVariantes.length > 0) {
        // Actualizar producto con las nuevas variantes encontradas
        await supabaseClient.from('productos').update({ variantes: variantesActuales }).eq('id', item.producto_id);

    }
}

async function actualizarInventarioCompra(item) {
    async function updateSede(tabla, cantidad, tiendaKey) {
        // ... (Lógica existente) ...
        // Nota: Si cantidad es 0 pero hay variantes, igual debemos revisar si impacta algo, 
        // pero la suma total manda.
        if (!cantidad && cantidad !== 0) return;

        // Buscar producto en esa tabla
        const { data: existe } = await supabaseClient.from(tabla).select('cantidad').eq('id_producto', item.producto_id).single();

        if (existe) {
            await supabaseClient.from(tabla).update({
                cantidad: existe.cantidad + (cantidad || 0),
                ultima_actualizacion: new Date().toISOString()
            }).eq('id_producto', item.producto_id);
        } else {
            await supabaseClient.from(tabla).insert({
                id_producto: item.producto_id,
                cantidad: (cantidad || 0),
                stock_minimo: 5,
                ultima_actualizacion: new Date().toISOString()
            });
        }
    }

    try {
        await updateSede('inventario_alcala', item.cant_alcala, 'alc');
        await updateSede('inventario_01', item.cant_local01, 'l01');
        await updateSede('inventario_jordan', item.cant_jordan, 'jor');
        try { await updateSede('inventario_digital', item.cant_digital, 'dig'); } catch (e) { }
    } catch (e) {
        console.error("Error actualizando inventarios parciales:", e);
    }
}


async function buscarOcrearProveedor(nombre) {
    // Buscar
    const { data } = await supabaseClient.from('proveedores').select('id').ilike('razon_social', nombre).single();
    if (data) return data;

    // Crear
    const { data: newProv, error } = await supabaseClient.from('proveedores').insert({ razon_social: nombre }).select().single();
    if (error) throw error;
    return newProv;
}



async function cargarCompras() {
    const tbody = document.getElementById('tbodyCompras');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="10" class="text-center">Cargando...</td></tr>';
    try {
        const estadoFiltro = document.getElementById('comprasEstadoFiltro')?.value || '';

        // Query corregida para usar la relación explícita
        let query = supabaseClient
            .from('compras_proveedor')
            .select(`
                *,
                proveedores:proveedor_id ( razon_social )
            `)
            .order('created_at', { ascending: false })
            .limit(50);

        if (estadoFiltro) query = query.eq('estado', estadoFiltro);

        const { data, error } = await query;
        if (error) throw error;

        comprasData = data || [];
        renderizarTablaCompras(comprasData);
        if (typeof actualizarStatsCompras === 'function') actualizarStatsCompras(comprasData);

    } catch (error) {
        console.error('Error cargando compras:', error);
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando compras:', error);
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-danger">Error al cargar compras. Verifica conexión.</td></tr>';
    }
}

function renderizarTablaCompras(lista) {
    const tbody = document.getElementById('tbodyCompras');
    if (!lista || lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">No hay compras registradas</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(c => {
        const proveedorNombre = c.proveedores?.razon_social || 'Desconocido';
        const proveedorId = c.proveedor_id;
        const saldo = c.saldo_pendiente !== undefined ? c.saldo_pendiente : c.valor_compra; // Fallback
        const estadoBadge = saldo <= 0 ? 'badge-success' : 'badge-warning';
        const estadoTexto = saldo <= 0 ? 'PAGADO' : 'PENDIENTE';

        // Link en el nombre del proveedor para ver historial
        const linkProveedor = `<a href="javascript:void(0)" onclick="abrirModalHistorialProveedor('${proveedorId}', '${proveedorNombre}')" style="font-weight:bold; color:#2563eb; text-decoration:underline;">${proveedorNombre}</a>`;

        return `
        <tr>
            <td>${linkProveedor}</td>
            <td>${c.numero_factura || '-'}</td>
            <td>${c.fecha_compra ? formatearFecha(c.fecha_compra) : formatearFecha(c.created_at)}</td>
            <td>${c.fecha_vencimiento ? formatearFecha(c.fecha_vencimiento) : '-'}</td>
            <td>$${formatearPrecio(c.valor_compra)}</td>
            <td><strong style="color:${saldo > 0 ? 'var(--danger)' : 'var(--success)'}">$${formatearPrecio(saldo)}</strong></td>
            <td><span class="badge ${estadoBadge}">${estadoTexto}</span></td>
            <td style="white-space:nowrap;">
                <button class="btn btn-sm btn-success" onclick="window.abrirModalPagoManualCompra('${c.id}')" title="Registrar Pago Manual">💰</button>
                <button class="btn btn-sm btn-danger" onclick="window.eliminarCompra('${c.id}')" title="Eliminar Compra">🗑️</button>
            </td>
        </tr>`;
    }).join('');
}

// ═══════════════════════════════════════════════════════════════
// HISTORIAL Y REPORTE DE PROVEEDORES
// ═══════════════════════════════════════════════════════════════

async function abrirModalHistorialProveedor(id, nombre) {
    // Crear modal dinámicamente si no existe
    let modal = document.getElementById('modalHistorialProveedor');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalHistorialProveedor';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:9999; align-items:center; justify-content:center; padding:1rem;';

        modal.innerHTML = `
        <div class="modal" style="width: 100%; max-width: 950px; background:white; border-radius:1rem; max-height: 90vh; display: flex; flex-direction: column; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
            <div class="modal-header" style="background:#1e293b; color:white; padding:1.25rem 1.5rem; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:0.75rem;">
                    <span style="font-size:1.5rem;">📜</span>
                    <h3 style="margin:0; font-size:1.25rem;">Historial de Cuenta: <span id="historialProvNombre" style="color:#fb923c;"></span></h3>
                </div>
                <button class="modal-close" onclick="document.getElementById('modalHistorialProveedor').style.display='none'" style="background:none; border:none; color:white; font-size:2rem; cursor:pointer; line-height:1;">&times;</button>
            </div>
            <div class="modal-body" style="flex: 1; overflow-y: auto; padding:1.5rem; background:#f8fafc;">
                <!-- Resumen de Saldos -->
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
                    <div style="background:white; padding:1.25rem; border-radius:0.75rem; border:1px solid #e2e8f0; display:flex; flex-direction:column; gap:0.25rem; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                        <small style="color:#64748b; font-weight:700; text-transform:uppercase; font-size:0.7rem;">Saldo Total Pendiente</small>
                        <div id="historialProvSaldo" style="font-size:1.75rem; color:#ef4444; font-weight:800;">$0</div>
                    </div>
                </div>

                <div class="table-responsive" style="background:white; border-radius:0.75rem; border:1px solid #e2e8f0; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                    <table class="table" style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                        <thead style="background:#f1f5f9; border-bottom:1px solid #e2e8f0;">
                            <tr>
                                <th style="padding:1rem; text-align:left; color:#475569; font-weight:700;">Fecha</th>
                                <th style="padding:1rem; text-align:left; color:#475569; font-weight:700;">Concepto</th>
                                <th style="padding:1rem; text-align:left; color:#475569; font-weight:700;">Ref / Notas</th>
                                <th style="padding:1rem; text-align:right; color:#475569; font-weight:700;">Cargo (+)</th>
                                <th style="padding:1rem; text-align:right; color:#475569; font-weight:700;">Abono (-)</th>
                                <th style="padding:1rem; text-align:right; color:#475569; font-weight:700; background:#f8fafc;">Saldo</th>
                            </tr>
                        </thead>
                        <tbody id="tbodyHistorialProv"></tbody>
                    </table>
                </div>
            </div>
            <div class="modal-footer" style="padding:1.25rem 1.5rem; background:#f1f5f9; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                <button class="btn btn-secondary" onclick="document.getElementById('modalHistorialProveedor').style.display='none'" style="padding:0.6rem 1.25rem; border-radius:0.5rem; font-weight:600;">Cerrar</button>
                <div style="display:flex; gap:0.75rem;">
                    <button class="btn btn-primary" onclick="imprimirReporteProveedor()" style="padding:0.6rem 1.5rem; border-radius:0.5rem; font-weight:700; background:#2563eb; display:flex; align-items:center; gap:0.5rem;">
                        <span>🖨️</span> Imprimir Estado de Cuenta
                    </button>
                </div>
            </div>
        </div>`;
        document.body.appendChild(modal);
    }

    document.getElementById('historialProvNombre').textContent = nombre;
    document.getElementById('tbodyHistorialProv').innerHTML = '<tr><td colspan="6" class="text-center">Cargando movimientos...</td></tr>';
    modal.style.display = 'flex';

    try {
        // 1. Obtener Compras
        const { data: compras } = await supabaseClient
            .from('compras_proveedor')
            .select('*')
            .eq('proveedor_id', id);

        // 2. Obtener Pagos
        const { data: pagos } = await supabaseClient
            .from('pagos_proveedor')
            .select('*')
            .eq('proveedor_id', id);

        // 3. Unificar y Ordenar
        const movimientos = [];

        (compras || []).forEach(c => {
            const fecha = c.fecha_compra || c.created_at;
            movimientos.push({
                fecha: fecha,
                timestamp: new Date(fecha).getTime(),
                tipo: 'COMPRA',
                concepto: 'Compra Factura ' + (c.numero_factura || 'S/N'),
                ref: c.observaciones || '',
                cargo: c.valor_compra,
                abono: 0
            });
        });

        (pagos || []).forEach(p => {
            const fecha = p.fecha_pago || p.created_at;
            movimientos.push({
                fecha: fecha,
                timestamp: new Date(fecha).getTime(),
                tipo: 'PAGO',
                concepto: 'Abono - ' + (p.metodo_pago || 'Pago'),
                ref: (p.referencia || '') + ' ' + (p.notas || ''),
                cargo: 0,
                abono: p.monto
            });
        });

        // Ordenar Ascendente
        movimientos.sort((a, b) => a.timestamp - b.timestamp);

        // Calcular saldos acumulados
        let saldoAcumulado = 0;
        const filasHTML = movimientos.map(m => {
            saldoAcumulado += m.cargo - m.abono;
            const esCompra = m.tipo === 'COMPRA';

            return `
            <tr style="border-bottom:1px solid #f1f5f9; transition:background 0.2s;">
                <td style="padding:0.75rem 1rem; color:#64748b; font-family:monospace;">${formatearFecha(m.fecha)}</td>
                <td style="padding:0.75rem 1rem;">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <span style="background:${esCompra ? '#fff7ed' : '#f0fdf4'}; color:${esCompra ? '#c2410c' : '#15803d'}; padding:0.2rem 0.6rem; border-radius:2rem; font-size:0.75rem; font-weight:700; border:1px solid ${esCompra ? '#fdba74' : '#86efac'};">
                            ${m.tipo}
                        </span>
                        <span style="color:#1e293b; font-weight:500;">${m.concepto}</span>
                    </div>
                </td>
                <td style="padding:0.75rem 1rem; color:#64748b; font-size:0.8rem; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${m.ref}">${m.ref || '-'}</td>
                <td style="padding:0.75rem 1rem; text-align:right; color:#ef4444; font-weight:600;">${m.cargo > 0 ? '$' + formatearPrecio(m.cargo) : '-'}</td>
                <td style="padding:0.75rem 1rem; text-align:right; color:#10b981; font-weight:600;">${m.abono > 0 ? '$' + formatearPrecio(m.abono) : '-'}</td>
                <td style="padding:0.75rem 1rem; text-align:right; background:#f8fafc; font-weight:700; color:#0f172a;">$${formatearPrecio(saldoAcumulado)}</td>
            </tr>`;
        }).join('');

        document.getElementById('tbodyHistorialProv').innerHTML = filasHTML || '<tr><td colspan="6" class="text-center">No hay movimientos</td></tr>';
        document.getElementById('historialProvSaldo').textContent = '$' + formatearPrecio(saldoAcumulado);

        // Guardar datos temporalmente para imprimir
        window.tempReporteProveedor = { nombre, movimientos, saldoFinal: saldoAcumulado };

    } catch (error) {
        console.error('Error historial:', error);
        document.getElementById('tbodyHistorialProv').innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error cargando historial</td></tr>';
    }
}

function imprimirReporteProveedor() {
    const data = window.tempReporteProveedor;
    if (!data) return;

    let ventana = window.open('', 'PRINT', 'height=800,width=1000');
    ventana.document.write(`
        <html>
        <head>
            <title>Reporte Proveedor - ${data.nombre}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
                body { font-family: 'Inter', sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
                .company-info h1 { margin: 0; color: #ff6b00; font-size: 1.5rem; text-transform: uppercase; letter-spacing: 1px; }
                .report-title { text-align: right; }
                .report-title h2 { margin: 0; color: #1e293b; font-size: 1.25rem; }
                .report-title p { margin: 5px 0 0 0; color: #64748b; font-size: 0.875rem; }
                
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
                .info-box h3 { margin: 0 0 10px 0; font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
                .info-box p { margin: 0; font-size: 1.125rem; font-weight: 700; }
                
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.875rem; }
                th { background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 700; text-transform: uppercase; padding: 12px 15px; text-align: left; }
                td { padding: 12px 15px; border-bottom: 1px solid #f1f5f9; }
                .text-right { text-align: right; }
                
                .badge { padding: 3px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; display: inline-block; }
                .badge-compra { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
                .badge-pago { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
                
                .total-footer { margin-top: 40px; display: flex; justify-content: flex-end; }
                .total-card { background: #1e293b; color: white; padding: 20px 30px; border-radius: 8px; text-align: right; min-width: 250px; }
                .total-card small { display: block; font-size: 0.75rem; text-transform: uppercase; opacity: 0.8; margin-bottom: 5px; }
                .total-card div { font-size: 1.5rem; font-weight: 800; }
                
                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="company-info" style="display:flex; align-items:center; gap:15px;">
                    <img src="https://pbblthbrdkevuyjxyuar.supabase.co/storage/v1/object/public/productos-imagenes/moteros%20logo.jpg" style="width:60px; height:60px; border-radius:50%; object-fit:cover;">
                    <div>
                        <h1>Moteros Sport Line</h1>
                        <p style="margin:5px 0 0 0; color:#64748b; font-size:0.8rem;">Villavicencio, Meta</p>
                    </div>
                </div>
                <div class="report-title">
                    <h2>Estado de Cuenta</h2>
                    <p>Fecha de emisión: ${new Date().toLocaleDateString('es-CO')}</p>
                </div>
            </div>

            <div class="info-grid">
                <div class="info-box">
                    <h3>Proveedor</h3>
                    <p>${data.nombre}</p>
                </div>
                <div class="info-box" style="text-align:right;">
                    <h3>ID Sistema</h3>
                    <p>PROV-${Math.random().toString(36).substring(7).toUpperCase()}</p>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th style="width:120px;">Fecha</th>
                        <th>Concepto / Referencia</th>
                        <th class="text-right">Cargo (+)</th>
                        <th class="text-right">Abono (-)</th>
                        <th class="text-right" style="background:#f1f5f9;">Saldo</th>
                    </tr>
                </thead>
                <tbody>
    `);

    let saldo = 0;
    data.movimientos.forEach(m => {
        saldo += m.cargo - m.abono;
        ventana.document.write(`
            <tr>
                <td style="color:#64748b; font-family:monospace;">${formatearFecha(m.fecha)}</td>
                <td>
                    <span class="badge ${m.tipo === 'PAGO' ? 'badge-pago' : 'badge-compra'}">${m.tipo}</span>
                    <span style="font-weight:600; margin-left:5px;">${m.concepto}</span>
                    <br><small style="color:#94a3b8; font-size:0.75rem;">${m.ref || ''}</small>
                </td>
                <td class="text-right" style="color:#ef4444; font-weight:600;">${m.cargo > 0 ? '$' + formatearPrecio(m.cargo) : '-'}</td>
                <td class="text-right" style="color:#10b981; font-weight:600;">${m.abono > 0 ? '$' + formatearPrecio(m.abono) : '-'}</td>
                <td class="text-right" style="background:#f8fafc; font-weight:700;">$${formatearPrecio(saldo)}</td>
            </tr>
        `);
    });

    ventana.document.write(`
                </tbody>
            </table>

            <div class="total-footer">
                <div class="total-card">
                    <small>Saldo Total Pendiente</small>
                    <div>$${formatearPrecio(data.saldoFinal)}</div>
                </div>
            </div>
            
            <div style="margin-top:60px; border-top:1px solid #e2e8f0; padding-top:20px; color:#94a3b8; font-size:0.75rem; text-align:center;">
                Este documento es un resumen de movimientos internos de Moteros Sport Line y no constituye una factura legal.
            </div>
        </body>
        </html>
    `);

    ventana.document.close();
    ventana.focus();
    setTimeout(() => { ventana.print(); ventana.close(); }, 700);
}

function actualizarStatsCompras(lista) {
    const pendientes = lista.filter(c => (c.saldo_pendiente || 0) > 0);
    const totalDeuda = pendientes.reduce((sum, c) => sum + (c.saldo_pendiente || 0), 0);

    // Actualizar Dashboards si existen elementos
    const elDeuda = document.getElementById('statProveedores');
    if (elDeuda) elDeuda.textContent = '$' + formatearPrecio(totalDeuda);
}

async function eliminarCompra(id) {
    if (!confirm('¿Estás seguro de eliminar esta compra?\n\nEsto no revertirá el inventario automáticamente por seguridad.')) return;
    try {
        const { error } = await supabaseClient.from('compras_proveedor').delete().eq('id', id);
        if (error) throw error;
        showToast('Compra eliminada', 'success');
        cargarCompras();
    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error eliminando:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

async function mostrarModalPago(id) {
    const compra = comprasData.find(c => c.id === id);
    if (!compra) { showToast('Compra no encontrada', 'error'); return; }

    document.getElementById('pagoCompraId').value = id;
    document.getElementById('pagoProveedorNombre').textContent = compra.proveedor?.razon_social || '-';
    document.getElementById('pagoFacturaNum').textContent = compra.numero_factura || '-';
    document.getElementById('pagoSaldoPendiente').textContent = '$' + formatearPrecio(compra.saldo_pendiente);
    document.getElementById('pagoMes').value = '';
    document.getElementById('pagoMonto').value = '';
    document.getElementById('pagoNotas').value = '';
    document.getElementById('modalPagoCompra').style.display = 'flex';
}

function cerrarModalPago() { document.getElementById('modalPagoCompra').style.display = 'none'; }

async function abrirModalPagoManualCompra(id) {

    try {
        const client = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
        if (!client) throw new Error('El cliente de Supabase no está inicializado.');

        const { data: compra, error } = await client
            .from('compras_proveedor')
            .select('*, proveedores:proveedor_id ( razon_social )')
            .eq('id', id)
            .single();

        if (error || !compra) {
            console.error("❌ Error Supabase:", error);
            throw new Error('No se pudo cargar la info de la compra: ' + (error?.message || 'No data'));
        }

        const saldo = compra.saldo_pendiente !== undefined ? compra.saldo_pendiente : compra.valor_compra;
        const proveedorNombre = compra.proveedores?.razon_social || 'Proveedor';

        // Eliminar modal previo si existe
        const prev = document.getElementById('modalPagoManualCompra');
        if (prev) prev.remove();

        // Usamos la clase 'active' para que el CSS de admin.css lo muestre correctamente
        const modalHtml = `
            <div id="modalPagoManualCompra" class="modal-overlay active" style="display: flex !important; align-items:center; justify-content:center;">
                <div class="modal" style="width:100%; max-width:550px; border-radius:1rem; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); background: white;">
                    <div class="modal-header" style="background:linear-gradient(135deg, #10b981, #059669); color:white; padding:1.5rem; display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin:0; font-size:1.5rem;">💰 Registrar Pago Manual</h3>
                        <button onclick="document.getElementById('modalPagoManualCompra').remove()" style="background:none; border:none; color:white; font-size:2rem; cursor:pointer; line-height: 1;">&times;</button>
                    </div>
                    <div class="modal-body" style="padding:2rem; background:white;">
                        <input type="hidden" id="pagoManual_compraId" value="${id}">
                        <input type="hidden" id="pagoManual_proveedorId" value="${compra.proveedor_id}">
                        
                        <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:1rem; border-radius:0.75rem; margin-bottom:1.5rem; display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                            <div>
                                <small style="color:#065f46; text-transform:uppercase; font-weight:bold; font-size:0.7rem;">Proveedor</small>
                                <div style="font-weight:700; color:#064e3b;">${proveedorNombre}</div>
                            </div>
                            <div>
                                <small style="color:#065f46; text-transform:uppercase; font-weight:bold; font-size:0.7rem;">Saldo Pendiente</small>
                                <div style="font-weight:700; color:#059669; font-size:1.2rem;">$${formatearPrecio(saldo)}</div>
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-bottom:1.5rem;">
                            <div>
                                <label style="display:block; margin-bottom:0.5rem; font-weight:600; color:#374151;">Monto del Pago *</label>
                                <input type="text" id="pagoManual_monto" class="form-control" style="font-size:1.2rem; font-weight:bold;" placeholder="$0" oninput="formatearMonedaInput(this)" value="${saldo}">
                            </div>
                            <div>
                                <label style="display:block; margin-bottom:0.5rem; font-weight:600; color:#374151;">Método de Pago *</label>
                                <select id="pagoManual_metodo" class="form-control">
                                    <option value="EFECTIVO">💵 Efectivo</option>
                                    <option value="TRANSFERENCIA">📱 Transferencia</option>
                                    <option value="CONSIGNACION">🏦 Consignación</option>
                                    <option value="TARJETA">💳 Tarjeta</option>
                                    <option value="OTRO">✨ Otro</option>
                                </select>
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-bottom:1.5rem;">
                            <div>
                                <label style="display:block; margin-bottom:0.5rem; font-weight:600; color:#374151;">Referencia / Banco</label>
                                <input type="text" id="pagoManual_referencia" class="form-control" placeholder="Ej: Bancolombia #123">
                            </div>
                            <div>
                                <label style="display:block; margin-bottom:0.5rem; font-weight:600; color:#374151;">Fecha</label>
                                <input type="date" id="pagoManual_fecha" class="form-control" value="${new Date().toISOString().split('T')[0]}">
                            </div>
                        </div>

                        <div>
                            <label style="display:block; margin-bottom:0.5rem; font-weight:600; color:#374151;">Notas Adicionales</label>
                            <textarea id="pagoManual_notas" class="form-control" rows="2" placeholder="Información extra del pago..."></textarea>
                        </div>
                    </div>
                    <div class="modal-footer" style="padding:1.5rem; background:#f9fafb; display:flex; gap:1rem; border-top:1px solid #e5e7eb;">
                        <button onclick="document.getElementById('modalPagoManualCompra').remove()" style="flex:1; padding:0.75rem; background:white; border:1px solid #d1d5db; border-radius:0.5rem; font-weight:600; cursor:pointer; color:#4b5563;">Cancelar</button>
                        <button onclick="guardarPagoManualCompra()" style="flex:2; padding:0.75rem; background:#10b981; color:white; border:none; border-radius:0.5rem; font-weight:700; cursor:pointer; transition:background 0.2s;">✅ Confirmar Pago</button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Auto-formatear el monto inicial
        const montoInput = document.getElementById('pagoManual_monto');
        if (montoInput) {
            formatearMonedaInput(montoInput);
        }



    } catch (error) {
        console.error("🔥 Error en abrirModalPagoManualCompra:", error);
        showToast(error.message, 'error');
    }
}

async function guardarPagoManualCompra() {

    const compraId = document.getElementById('pagoManual_compraId').value;
    const proveedorId = document.getElementById('pagoManual_proveedorId').value;
    const monto = limpiarMoneda(document.getElementById('pagoManual_monto').value);
    const metodo = document.getElementById('pagoManual_metodo').value;
    const referencia = document.getElementById('pagoManual_referencia').value;
    const fecha = document.getElementById('pagoManual_fecha').value;
    const notas = document.getElementById('pagoManual_notas').value;

    if (!monto || monto <= 0) return showToast('Ingresa un monto válido', 'warning');

    try {
        // 1. Obtener compra actual
        const { data: compra } = await supabaseClient.from('compras_proveedor').select('*').eq('id', compraId).single();
        if (!compra) throw new Error('Compra no encontrada');

        // 2. Determinar columna de pago según la fecha
        const fechaPago = new Date(fecha);
        const mes = fechaPago.getMonth(); // 0-11
        const anio = fechaPago.getFullYear();

        const mesesNombres = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        const mesNombre = mesesNombres[mes];

        let columna;

        // Para 2025 y años posteriores, usar columnas con sufijo de año
        if (anio >= 2025) {
            columna = `pago_${mesNombre}_${anio}`;
        } else {
            // Para 2024 o anteriores, usar las columnas base (pago_ene, pago_feb, etc.)
            columna = `pago_${mesNombre}`;
        }



        // 3. Actualizar el pago en la columna correspondiente
        const pagoActual = parseFloat(compra[columna] || 0);
        const nuevoPago = pagoActual + monto;

        const updateData = {
            [columna]: nuevoPago,
            metodo_pago: metodo,
            observaciones: `${compra.observaciones || ''}\n[${new Date().toLocaleDateString('es-CO')}] Pago ${metodo}: $${formatearPrecio(monto)}${referencia ? ` - Ref: ${referencia}` : ''}${notas ? ` - ${notas}` : ''}`.trim(),
            updated_at: new Date().toISOString()
        };

        const { error: errUpdate } = await supabaseClient
            .from('compras_proveedor')
            .update(updateData)
            .eq('id', compraId);

        if (errUpdate) throw errUpdate;

        showToast('✅ Pago registrado correctamente', 'success');
        document.getElementById('modalPagoManualCompra')?.remove();
        cargarCompras();

    } catch (error) {
        console.error("🔥 Error en guardarPagoManualCompra:", error);
        showToast('Error al registrar pago: ' + error.message, 'error');
    }
}


async function guardarPagoCompra() {
    const compraId = document.getElementById('pagoCompraId').value;
    const mesPago = document.getElementById('pagoMes').value;
    const monto = limpiarMoneda(document.getElementById('pagoMonto').value);

    if (!mesPago || !monto) { showToast('Selecciona el mes y el monto del pago', 'warning'); return; }

    try {
        const compra = comprasData.find(c => c.id === compraId);
        if (!compra) throw new Error('Compra no encontrada');

        const pagoActual = parseFloat(compra[mesPago] || 0);
        const nuevoPago = pagoActual + monto;
        const updateData = { [mesPago]: nuevoPago, updated_at: new Date().toISOString() };

        const saldoActual = parseFloat(compra.saldo_pendiente || 0);
        if (monto >= saldoActual) updateData.estado = 'CERRADO';

        const { error } = await supabaseClient.from('compras_proveedor').update(updateData).eq('id', compraId);
        if (error) throw error;

        showToast('Pago registrado correctamente', 'success');
        cerrarModalPago();
        cargarCompras();
    } catch (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error guardando pago:', error); showToast('Error: ' + error.message, 'error'); }
}

function registrarPagoCompra(id) { mostrarModalPago(id); }

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
    } catch (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error subiendo imagen:', error); showToast('Error al subir imagen: ' + error.message, 'error'); return null; }
}

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
    const productosActivos = productos.filter(p => p.estado && p.estado.toLowerCase() === 'activo').length;
    const statProd = document.getElementById('statProductos');
    if (statProd) statProd.textContent = productosActivos;

    const todosInv = [...inventarios.alcala, ...inventarios.local01, ...inventarios.jordan];

    // Calcular Stock Total y Valor del Inventario
    let stockTotal = 0;
    let valorInventario = 0;

    todosInv.forEach((inv, index) => {
        const cant = (inv.cantidad || 0);
        stockTotal += cant;

        // Buscar producto para obtener precio
        const producto = productos.find(p => p.id === inv.id_producto || p.id_producto === inv.id_producto);

        if (producto) {
            // Priorizar precio_compra, fallback a precio (venta)
            const costo = parseFloat(producto.precio_compra) || parseFloat(producto.precio) || 0;
            valorInventario += cant * costo;
        }
    });

    const statStock = document.getElementById('statStockTotal');
    if (statStock) statStock.textContent = stockTotal.toLocaleString('es-CO');

    const statValorInv = document.getElementById('statValorInventario');
    if (statValorInv) statValorInv.textContent = '$' + formatearPrecio(valorInventario);

    const stockBajo = todosInv.filter(i => i.cantidad > 0 && i.cantidad <= (i.stock_minimo || 5)).length;
    const statBajo = document.getElementById('statStockBajo'); if (statBajo) statBajo.textContent = stockBajo;

    const agotados = todosInv.filter(i => i.cantidad === 0).length;
    const statAgot = document.getElementById('statAgotados'); if (statAgot) statAgot.textContent = agotados;

    try {
        const { data: deudores } = await supabaseClient.from('deudores').select('saldo_actual, estado').eq('estado', 'activo');
        const deudoresActivos = deudores?.length || 0;
        const deudaTotal = deudores?.reduce((sum, d) => sum + parseFloat(d.saldo_actual || 0), 0) || 0;
        const statDeudores = document.getElementById('statDeudores');
        const statDeudaTotal = document.getElementById('statDeudaTotal');
        if (statDeudores) statDeudores.textContent = deudoresActivos;
        if (statDeudaTotal) statDeudaTotal.textContent = '$' + formatearPrecio(deudaTotal);
    } catch (e) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando deudores:', e); }

    try {
        const { data: compras } = await supabaseClient.from('compras_proveedor').select('saldo_pendiente').neq('estado', 'pagado');
        const totalProveedores = compras?.reduce((sum, c) => sum + parseFloat(c.saldo_pendiente || 0), 0) || 0;
        const statProv = document.getElementById('statProveedores');
        if (statProv) statProv.textContent = '$' + formatearPrecio(totalProveedores);
    } catch (e) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando proveedores:', e); }

    try {
        const hoy = new Date();
        const hoyStr = hoy.toISOString().split('T')[0];

        // Ventas Hoy (Tabla 'ventas')
        const { data: ventasHoy } = await supabaseClient
            .from('ventas')
            .select('total, metodo_pago')
            .gte('created_at', hoyStr + 'T00:00:00')
            .lte('created_at', hoyStr + 'T23:59:59');

        const totalVentasHoy = ventasHoy?.reduce((sum, v) => sum + parseFloat(v.total || 0), 0) || 0;

        // Promedio 30 dias (Tabla 'ventas')
        const hace30dias = new Date();
        hace30dias.setDate(hace30dias.getDate() - 30);

        const { data: ventasMes } = await supabaseClient
            .from('ventas')
            .select('total, created_at') // created_at para grafico 7 dias si lo sacaramos de aqui, pero mejor query aparte
            .gte('created_at', hace30dias.toISOString());

        const totalMes = ventasMes?.reduce((sum, v) => sum + parseFloat(v.total || 0), 0) || 0;
        const promedioDiario = totalMes / 30;

        // UI Update
        const statVentas = document.getElementById('statVentasHoy');
        const containerAdicional = document.getElementById('statsAdicionalesVentas');

        if (statVentas) statVentas.textContent = `$${formatearPrecio(totalVentasHoy)}`;

        if (containerAdicional) {
            containerAdicional.innerHTML = `
                <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 10px 15px; border-radius: 8px; margin-top: 10px; display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; color: #1e40af; font-weight: 700;">📈 Promedio Diario (30d)</span>
                    <span style="font-size: 1.1rem; font-weight: 800; color: #1e3a8a;">$${formatearPrecio(promedioDiario)}</span>
                </div>
            `;
        }

        // Preparar Datos para Gráficos

        // Leads Mes
        const { count: leadsMes } = await supabaseClient
            .from('leads_ia')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', mesInicio + 'T00:00:00');

        const statLH = document.getElementById('statLeadsHoy');
        const statLM = document.getElementById('statLeadsMes');
        if (statLH) statLH.textContent = leadsHoy || 0;
        if (statLM) statLM.textContent = leadsMes || 0;
    } catch (e) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando stats leads:', e); }


    // renderizarChartsDashboard(); // ⚠️ DESACTIVADO: Usar lógica centralizada en admin-productos.js
}

function renderizarChartsDashboard() {
    // 1. Stock por Local
    const ctx1 = document.getElementById('chartStockLocales');
    if (ctx1) {
        if (chartStockLocales) chartStockLocales.destroy();
        chartStockLocales = new Chart(ctx1.getContext('2d'), {
            type: 'bar',
            data: { labels: ['Alcalá', 'Local 01', 'Jordán'], datasets: [{ label: 'Unidades en Stock', data: [inventarios.alcala.reduce((s, i) => s + (i.cantidad || 0), 0), inventarios.local01.reduce((s, i) => s + (i.cantidad || 0), 0), inventarios.jordan.reduce((s, i) => s + (i.cantidad || 0), 0)], backgroundColor: ['#ff6b00', '#10b981', '#3b82f6'], borderRadius: 8 }] },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
    }

    // 2. Categorías
    const ctx2 = document.getElementById('chartCategorias');
    if (ctx2) {
        if (chartCategorias) chartCategorias.destroy();
        const categorias = {};
        productos.filter(p => p.estado === 'Activo').forEach(p => {
            // FIX: Normalizar a mayúsculas para evitar duplicados (Maleteros vs MALETEROS)
            let catNombre = p.categoria ? p.categoria.trim().toUpperCase() : 'SIN CATEGORÍA';
            // Mapeo manual para unificar singulares/plurales si fuera necesario (opcional)
            // if (catNombre === 'CASCO') catNombre = 'CASCOS';

            categorias[catNombre] = (categorias[catNombre] || 0) + 1;
        });

        const labels = Object.keys(categorias).sort(); // Ordenar alfabéticamente
        const dataValues = labels.map(l => categorias[l]);
        chartCategorias = new Chart(ctx2.getContext('2d'), {
            type: 'doughnut',
            data: { labels: labels, datasets: [{ data: dataValues, backgroundColor: ['#ff6b00', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'] }] },
            options: { responsive: true, plugins: { legend: { position: 'right' } } }
        });
    }

    // 3. Ventas por Método de Pago (Hoy) - NUEVO
    const ctx3 = document.getElementById('chartMetodosPagoDash');
    if (ctx3 && window.dashboardData?.ventasHoyList) {
        // Agrupar 'ventasHoyList' por metodo
        const metodos = {};
        window.dashboardData.ventasHoyList.forEach(v => {
            const m = v.metodo_pago || 'Desconocido';
            metodos[m] = (metodos[m] || 0) + (v.total || 0);
        });

        // Limpiar previo si existe (usando variable global genérica chartMetodosPago)
        if (chartMetodosPago) chartMetodosPago.destroy();

        chartMetodosPago = new Chart(ctx3.getContext('2d'), {
            type: 'pie',
            data: {
                labels: Object.keys(metodos),
                datasets: [{
                    data: Object.values(metodos),
                    backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' },
                    title: { display: true, text: 'Total Hoy: $' + formatearPrecio(Object.values(metodos).reduce((a, b) => a + b, 0)) }
                }
            }
        });
    }

    // 4. Ventas Últimos 7 Días - NUEVO
    const ctx4 = document.getElementById('chartVentas7Dias');
    if (ctx4 && window.dashboardData?.ventasMesList) {
        // Procesar ultimos 7 dias desde 'ventasMesList' (que trae 30 dias)
        const ultimos7 = {};
        // Inicializar ultimos 7 dias en 0
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            ultimos7[d.toLocaleDateString('es-CO')] = 0;
        }

        window.dashboardData.ventasMesList.forEach(v => {
            const fecha = new Date(v.created_at).toLocaleDateString('es-CO');
            if (ultimos7.hasOwnProperty(fecha)) {
                ultimos7[fecha] += (v.total || 0);
            }
        });

        if (chartVentasLocales) chartVentasLocales.destroy(); // Reusamos chartVentasLocales variable para este chart de linea

        chartVentasLocales = new Chart(ctx4.getContext('2d'), {
            type: 'line',
            data: {
                labels: Object.keys(ultimos7),
                datasets: [{
                    label: 'Ventas ($)',
                    data: Object.values(ultimos7),
                    borderColor: '#ff6b00',
                    backgroundColor: 'rgba(255, 107, 0, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { callback: function (val) { return '$' + val / 1000 + 'k'; } } }
                }
            }
        });
    }
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
    } catch (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando inventarios:', error); }
}

async function cargarInventarioLocal() {
    const tabla = document.getElementById('inventarioLocal').value;
    const contenido = document.getElementById('contenidoInventario');
    if (!tabla) { contenido.innerHTML = '<div class="card-body"><div class="alert alert-info">👆 Selecciona un local</div></div>'; return; }
    contenido.innerHTML = '<div class="card-body"><div class="loading"><div class="spinner"></div><p>Cargando...</p></div></div>';
    try {
        const { data, error } = await supabaseClient.from(tabla).select('*').order('id_producto');
        if (error) throw error;
        if (!data || data.length === 0) { contenido.innerHTML = '<div class="card-body"><div class="alert alert-warning">No hay productos en este inventario</div></div>'; return; }
        contenido.innerHTML = `<div class="table-container"><table class="data-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Cantidad</th><th>Stock Mín.</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${data.map(inv => {
            const producto = productos.find(p => p.id_producto === inv.id_producto);
            let badge = 'badge-success', texto = 'OK';
            if (inv.cantidad === 0) { badge = 'badge-danger'; texto = 'Agotado'; }
            else if (inv.cantidad <= (inv.stock_minimo || 5)) { badge = 'badge-warning'; texto = 'Bajo'; }
            return `<tr><td><strong>${producto?.nombre || inv.id_producto}</strong><br><small style="color:#666">${producto?.marca || ''}</small></td><td>${producto?.categoria || '-'}</td><td style="font-size:1.1rem; font-weight:700;">${inv.cantidad}</td><td>${inv.stock_minimo || 5}</td><td><span class="badge ${badge}">${texto}</span></td><td><button onclick="ajustarStock('${tabla}','${inv.id}',${inv.cantidad})" class="btn btn-secondary btn-sm">✏️ Ajustar</button></td></tr>`;
        }).join('')}</tbody></table></div>`;
    } catch (error) { contenido.innerHTML = `<div class="card-body"><div class="alert alert-danger">Error: ${error.message}</div></div>`; }
}

async function ajustarStock(tabla, id, actual) {
    // Buscar información del producto
    const inventario = tabla === 'inventario_alcala' ? inventarios.alcala
        : tabla === 'inventario_01' ? inventarios.local01
            : inventarios.jordan;
    const invItem = inventario?.find(i => i.id === id);
    const producto = productos.find(p => p.id_producto === invItem?.id_producto);
    const nombreProducto = producto?.nombre || 'Producto';
    const nombreLocal = tabla.replace('inventario_', '').toUpperCase();

    // Crear modal profesional
    const modal = document.createElement('div');
    modal.id = 'modalAjustarStock';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
    modal.onclick = function (e) { if (e.target === this) this.remove(); };

    modal.innerHTML = `
        <div style="background:white;border-radius:16px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);overflow:hidden;">
            <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;padding:1.25rem 1.5rem;">
                <h3 style="margin:0;font-size:1.2rem;">📦 Ajustar Stock</h3>
            </div>
            <div style="padding:1.5rem;">
                <div style="background:#f1f5f9;padding:1rem;border-radius:10px;margin-bottom:1.5rem;">
                    <div style="font-weight:700;color:#1e293b;font-size:1.1rem;">${nombreProducto}</div>
                    <div style="color:#64748b;font-size:0.9rem;margin-top:0.25rem;">Local: ${nombreLocal}</div>
                </div>

                <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;">
                    <div style="flex:1;text-align:center;padding:1rem;background:#fef3c7;border-radius:10px;">
                        <div style="font-size:0.8rem;color:#92400e;font-weight:600;">STOCK ACTUAL</div>
                        <div style="font-size:2rem;font-weight:800;color:#d97706;">${actual}</div>
                    </div>
                    <div style="font-size:1.5rem;color:#94a3b8;">→</div>
                    <div style="flex:1;text-align:center;padding:1rem;background:#dcfce7;border-radius:10px;">
                        <div style="font-size:0.8rem;color:#166534;font-weight:600;">NUEVO STOCK</div>
                        <input type="number" id="nuevoStockCantidad" value="${actual}" min="0"
                               style="width:100%;font-size:2rem;font-weight:800;color:#16a34a;text-align:center;border:none;background:transparent;outline:none;">
                    </div>
                </div>

                <div style="display:flex;gap:0.75rem;">
                    <button onclick="document.getElementById('modalAjustarStock').remove()"
                            style="flex:1;padding:0.875rem;border:2px solid #e2e8f0;background:white;border-radius:10px;font-weight:600;cursor:pointer;color:#64748b;">
                        Cancelar
                    </button>
                    <button onclick="confirmarAjusteStock('${tabla}','${id}')"
                            style="flex:1;padding:0.875rem;border:none;background:linear-gradient(135deg,#10b981,#059669);color:white;border-radius:10px;font-weight:700;cursor:pointer;">
                        ✅ Guardar
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.getElementById('nuevoStockCantidad').focus();
    document.getElementById('nuevoStockCantidad').select();
}

async function confirmarAjusteStock(tabla, id) {
    const nuevaCantidad = parseInt(document.getElementById('nuevoStockCantidad')?.value);

    if (isNaN(nuevaCantidad) || nuevaCantidad < 0) {
        showToast('Ingresa una cantidad válida', 'warning');
        return;
    }

    try {
        const { error } = await supabaseClient
            .from(tabla)
            .update({
                cantidad: nuevaCantidad,
                ultima_actualizacion: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        document.getElementById('modalAjustarStock')?.remove();
        showToast('✅ Stock actualizado correctamente', 'success');
        cargarInventarioLocal();
        await cargarTodosLosInventarios();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

window.confirmarAjusteStock = confirmarAjusteStock;

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

    let valorTotal = 0;
    todosInv.forEach(inv => {
        const producto = productos.find(p => p.id_producto === inv.id_producto || p.id === inv.id_producto);
        // AUDIT FIX: Usar precio de compra, fallback a precio venta
        if (producto) {
            const costo = parseFloat(producto.precio_compra) || parseFloat(producto.precio) || 0;
            valorTotal += costo * (inv.cantidad || 0);
        }
    });

    const valorInv = document.getElementById('valorInventarioGlobal'); if (valorInv) valorInv.textContent = '$' + Math.round(valorTotal / 1000000) + 'M';
    const alertasEl = document.getElementById('alertasGlobal'); if (alertasEl) alertasEl.textContent = todosInv.filter(i => i.cantidad <= (i.stock_minimo || 5)).length;
    const localesData = [{ nombre: 'Alcalá', icono: '🏪', data: inventarios.alcala }, { nombre: 'Local 01', icono: '🏬', data: inventarios.local01 }, { nombre: 'Jordán', icono: '🏢', data: inventarios.jordan }];
    const grid = document.getElementById('localesStatsGrid');
    if (grid) { grid.innerHTML = localesData.map(local => { const stats = calcularEstadisticasLocal(local.data); return `<div class="local-card"><div class="local-card-header"><h4>${local.icono} ${local.nombre}</h4><span class="badge badge-success">Activo</span></div><div class="local-card-body"><div class="local-stat-row"><span class="label">Stock Total</span><span class="value">${stats.stockTotal.toLocaleString('es-CO')}</span></div><div class="local-stat-row"><span class="label">Productos</span><span class="value">${stats.productos}</span></div><div class="local-stat-row"><span class="label">Stock Bajo</span><span class="value" style="color:${stats.stockBajo > 0 ? '#f59e0b' : '#10b981'}">${stats.stockBajo}</span></div><div class="local-stat-row"><span class="label">Agotados</span><span class="value" style="color:${stats.agotados > 0 ? '#ef4444' : '#10b981'}">${stats.agotados}</span></div><div class="local-stat-row"><span class="label">Valor Est.</span><span class="value">$${Math.round(stats.valor / 1000000)}M</span></div></div></div>`; }).join(''); }

    // Llenar resumen de rendimiento
    const resumenEl = document.getElementById('resumenRendimiento');
    if (resumenEl) {
        const statsLocales = localesData.map(l => ({ ...l, stats: calcularEstadisticasLocal(l.data) }));
        const mejorLocal = statsLocales.reduce((a, b) => a.stats.valor > b.stats.valor ? a : b);
        const peorSalud = statsLocales.reduce((a, b) => (a.stats.stockBajo + a.stats.agotados) > (b.stats.stockBajo + b.stats.agotados) ? a : b);
        const totalStock = statsLocales.reduce((sum, l) => sum + l.stats.stockTotal, 0);

        resumenEl.innerHTML = `
            <div style="background:linear-gradient(135deg,#10b981,#059669);color:white;padding:1.5rem;border-radius:1rem;">
                <h4 style="margin:0 0 0.5rem 0;opacity:0.9;">🏆 Mayor Valor en Inventario</h4>
                <p style="font-size:1.8rem;font-weight:700;margin:0;">${mejorLocal.icono} ${mejorLocal.nombre}</p>
                <p style="margin:0.5rem 0 0 0;opacity:0.9;">$${formatearPrecio(mejorLocal.stats.valor)} en productos</p>
            </div>
            <div style="background:linear-gradient(135deg,#f59e0b,#d97706);color:white;padding:1.5rem;border-radius:1rem;">
                <h4 style="margin:0 0 0.5rem 0;opacity:0.9;">⚠️ Requiere Atención</h4>
                <p style="font-size:1.8rem;font-weight:700;margin:0;">${peorSalud.icono} ${peorSalud.nombre}</p>
                <p style="margin:0.5rem 0 0 0;opacity:0.9;">${peorSalud.stats.stockBajo} bajo stock + ${peorSalud.stats.agotados} agotados</p>
            </div>
            <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;padding:1.5rem;border-radius:1rem;">
                <h4 style="margin:0 0 0.5rem 0;opacity:0.9;">📊 Participación del Stock</h4>
                ${statsLocales.map(l => {
            const pct = totalStock > 0 ? Math.round((l.stats.stockTotal / totalStock) * 100) : 0;
            return `<div style="display:flex;justify-content:space-between;margin-bottom:0.25rem;"><span>${l.icono} ${l.nombre}</span><strong>${pct}%</strong></div>`;
        }).join('')}
            </div>
        `;
    }

    // Llenar distribución por categoría
    const tbodyCat = document.getElementById('tbodyDistribucionCategorias');
    if (tbodyCat) {
        // FIX: Normalizar categorías a mayúsculas para evitar duplicados en la tabla
        const categorias = [...new Set(productos.filter(p => p.estado === 'Activo').map(p => (p.categoria || 'SIN CATEGORÍA').toUpperCase()))].filter(Boolean).sort();

        const getCantidadCategoria = (inv, cat) => {
            return inv.reduce((sum, item) => {
                const prod = productos.find(p => p.id_producto === item.id_producto);
                const prodCat = (prod?.categoria || 'SIN CATEGORÍA').toUpperCase();
                return sum + (prod && prodCat === cat ? (item.cantidad || 0) : 0);
            }, 0);
        };

        tbodyCat.innerHTML = categorias.map(cat => {
            const alcala = getCantidadCategoria(inventarios.alcala, cat);
            const local01 = getCantidadCategoria(inventarios.local01, cat);
            const jordan = getCantidadCategoria(inventarios.jordan, cat);
            const total = alcala + local01 + jordan;
            return `<tr>
                <td><strong>${cat}</strong></td>
                <td>${alcala.toLocaleString('es-CO')}</td>
                <td>${local01.toLocaleString('es-CO')}</td>
                <td>${jordan.toLocaleString('es-CO')}</td>
                <td><strong style="color:var(--primary);">${total.toLocaleString('es-CO')}</strong></td>
            </tr>`;
        }).join('');
    }
}

function calcularEstadisticasLocal(inventario) {
    let valor = 0;
    inventario.forEach(inv => {
        const producto = productos.find(p => p.id_producto === inv.id_producto || p.id === inv.id_producto);
        if (producto) {
            const costo = parseFloat(producto.precio_compra) || parseFloat(producto.precio) || 0;
            valor += costo * (inv.cantidad || 0);
        }
    });
    return { stockTotal: inventario.reduce((s, i) => s + (i.cantidad || 0), 0), productos: inventario.length, stockBajo: inventario.filter(i => i.cantidad > 0 && i.cantidad <= (i.stock_minimo || 5)).length, agotados: inventario.filter(i => i.cantidad === 0).length, valor };
}

// ═══════════════════════════════════════════════════════════════
// REPORTES
// ═══════════════════════════════════════════════════════════════

// Variable global para almacenar los datos del reporte actual (para exportación)
let datosReporteActual = [];
let columnasReporteActual = [];
let tituloReporteActual = '';

async function cargarReporteMargen() {
    const contenedor = document.getElementById('contenidoReporte');
    const body = document.getElementById('bodyReporte');
    const titulo = document.getElementById('tituloReporte');
    if (!contenedor || !body) return;

    contenedor.style.display = 'block';
    titulo.textContent = 'Reporte de Margen por Categoría';
    tituloReporteActual = 'Margen_Categoria';
    body.innerHTML = '<div class="loading"><div class="spinner"></div><p>Calculando margenes...</p></div>';

    try {
        // 1. Obtener todas las ventas completadas
        const { data: ventas, error } = await supabaseClient
            .from('ventas')
            .select('*')
            .eq('estado', 'pagado');

        if (error) throw error;

        // *Nota: Como los items de venta están en 'productos' (JSON) dentro de la venta en algunas versiones, 
        // o si tienes tabla 'detalle_ventas', ajustaremos. 
        // Asumiendo estructura actual donde 'productos' es un JSONB en la tabla 'ventas' (según pos.js).

        const categoriasStats = {};

        ventas.forEach(v => {
            const items = v.productos || []; // Array de items vendidos
            items.forEach(item => {
                // NORMALIZAR categoría para evitar duplicados (IMPERMEABLE vs Impermeable)
                const catRaw = item.categoria || 'Sin Categoría';
                const cat = catRaw.trim().toUpperCase();

                if (!categoriasStats[cat]) {
                    categoriasStats[cat] = {
                        cantidad: 0,
                        ventaTotal: 0,
                        costoTotal: 0
                    };
                }

                // Buscar costo real actual (o el guardado si existiera)
                // Usamos item.precio_compra si se guardó en el histórico, sino buscamos en productos global
                const productoRef = productos.find(p => p.id_producto === item.id_producto);
                const costoUnitario = productoRef?.precio_compra || 0;

                categoriasStats[cat].cantidad += (item.cantidad || 1);
                categoriasStats[cat].ventaTotal += (item.precio || 0) * (item.cantidad || 1);
                categoriasStats[cat].costoTotal += costoUnitario * (item.cantidad || 1);
            });
        });

        const filas = Object.keys(categoriasStats).map(cat => {
            const s = categoriasStats[cat];
            const margen = s.ventaTotal - s.costoTotal;
            const margenPorc = s.ventaTotal > 0 ? (margen / s.ventaTotal) * 100 : 0;
            return {
                categoria: cat,
                cantidad: s.cantidad,
                costo: s.costoTotal,
                venta: s.ventaTotal,
                margen: margen,
                porc: margenPorc
            };
        }).sort((a, b) => b.margen - a.margen);

        // Guardar para exportar
        datosReporteActual = filas.map(f => ({
            Categoría: f.categoria,
            'Cant. Vendida': f.cantidad,
            'Costo Total': f.costo,
            'Venta Total': f.venta,
            'Utilidad $': f.margen,
            'Margen %': f.porc.toFixed(2) + '%'
        }));
        columnasReporteActual = ['Categoría', 'Cant. Vendida', 'Costo Total', 'Venta Total', 'Utilidad $', 'Margen %'];

        // Renderizar Tabla
        body.innerHTML = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Categoría</th>
                            <th>Cant. Vendida</th>
                            <th>Costo Total</th>
                            <th>Venta Total</th>
                            <th>Utilidad $</th>
                            <th>Margen %</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filas.map(f => `
                            <tr>
                                <td><strong>${f.categoria}</strong></td>
                                <td>${f.cantidad}</td>
                                <td>$${formatearPrecio(f.costo)}</td>
                                <td style="color:var(--primary); font-weight:700;">$${formatearPrecio(f.venta)}</td>
                                <td style="color:${f.margen >= 0 ? 'green' : 'red'}; font-weight:700;">$${formatearPrecio(f.margen)}</td>
                                <td><span class="badge ${f.porc > 30 ? 'badge-success' : 'badge-warning'}">${f.porc.toFixed(1)}%</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background:#f8fafc; font-weight:800;">
                            <td>TOTALES</td>
                            <td>${filas.reduce((s, f) => s + f.cantidad, 0)}</td>
                            <td>$${formatearPrecio(filas.reduce((s, f) => s + f.costo, 0))}</td>
                            <td>$${formatearPrecio(filas.reduce((s, f) => s + f.venta, 0))}</td>
                            <td>$${formatearPrecio(filas.reduce((s, f) => s + f.margen, 0))}</td>
                            <td>-</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

    } catch (e) {
        body.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`;
    }
}

async function cargarReporteTop() {
    const contenedor = document.getElementById('contenidoReporte');
    const body = document.getElementById('bodyReporte');
    const titulo = document.getElementById('tituloReporte');
    if (!contenedor || !body) return;

    contenedor.style.display = 'block';
    titulo.textContent = 'Top 20 Productos Más Vendidos';
    tituloReporteActual = 'Top_Productos';
    body.innerHTML = '<div class="loading"><div class="spinner"></div><p>Analizando ventas...</p></div>';

    try {
        const { data: ventas, error } = await supabaseClient.from('ventas').select('*').eq('estado', 'pagado');
        if (error) throw error;

        const productosRanking = {};

        ventas.forEach(v => {
            (v.productos || []).forEach(item => {
                const id = item.id_producto;
                if (!productosRanking[id]) {
                    productosRanking[id] = {
                        nombre: item.nombre,
                        cantidad: 0,
                        total: 0
                    };
                }
                productosRanking[id].cantidad += (item.cantidad || 1);
                productosRanking[id].total += (item.precio || 0) * (item.cantidad || 1);
            });
        });

        const ranking = Object.values(productosRanking)
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, 20);

        datosReporteActual = ranking.map((r, i) => ({
            '#': i + 1,
            Producto: r.nombre,
            'Unidades Vendidas': r.cantidad,
            'Total Recaudado': r.total
        }));
        columnasReporteActual = ['#', 'Producto', 'Unidades Vendidas', 'Total Recaudado'];

        body.innerHTML = `
            <div class="table-container">
                <table class="data-table">
                    <thead><tr><th>#</th><th>Producto</th><th>Unidades</th><th>Total Ventas</th></tr></thead>
                    <tbody>
                        ${ranking.map((r, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td><strong>${r.nombre}</strong></td>
                                <td style="font-size:1.1rem;">${r.cantidad}</td>
                                <td>$${formatearPrecio(r.total)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

    } catch (e) { body.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`; }
}

async function cargarReporteMetodos() {
    const contenedor = document.getElementById('contenidoReporte');
    const body = document.getElementById('bodyReporte');
    const titulo = document.getElementById('tituloReporte');
    if (!contenedor || !body) return;

    contenedor.style.display = 'block';
    titulo.textContent = 'Ventas por Método de Pago';
    tituloReporteActual = 'Metodos_Pago';
    body.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando datos...</p></div>';

    try {
        const { data: ventas, error } = await supabaseClient.from('ventas').select('*').eq('estado', 'pagado');
        if (error) throw error;

        const metodos = {};
        ventas.forEach(v => {
            const m = v.metodo_pago || 'Otros';
            metodos[m] = (metodos[m] || 0) + (v.total || 0);
        });

        const totalGlobal = Object.values(metodos).reduce((a, b) => a + b, 0);

        datosReporteActual = Object.keys(metodos).map(m => ({
            'Método': m,
            'Total': metodos[m],
            'Participación': ((metodos[m] / totalGlobal) * 100).toFixed(2) + '%'
        }));
        columnasReporteActual = ['Método', 'Total', 'Participación'];

        body.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:2rem;">
                <div class="table-container">
                    <table class="data-table">
                        <thead><tr><th>Método</th><th>Total</th><th>%</th></tr></thead>
                        <tbody>
                            ${Object.keys(metodos).map(m => `
                                <tr>
                                    <td><strong>${m}</strong></td>
                                    <td>$${formatearPrecio(metodos[m])}</td>
                                    <td>${((metodos[m] / totalGlobal) * 100).toFixed(1)}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div style="height:300px;">
                    <canvas id="chartReporteMetodos"></canvas>
                </div>
            </div>
        `;

        // Render chart
        setTimeout(() => {
            const ctx = document.getElementById('chartReporteMetodos');
            if (ctx) {
                new Chart(ctx.getContext('2d'), {
                    type: 'pie',
                    data: {
                        labels: Object.keys(metodos),
                        datasets: [{
                            data: Object.values(metodos),
                            backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b']
                        }]
                    }
                });
            }
        }, 100);

    } catch (e) { body.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`; }
}

async function cargarReportePromedioVentas() {
    const contenedor = document.getElementById('contenidoReporte');
    const body = document.getElementById('bodyReporte');
    const titulo = document.getElementById('tituloReporte');
    if (!contenedor || !body) return;

    contenedor.style.display = 'block';
    titulo.textContent = 'Análisis de Promedios';
    tituloReporteActual = 'Promedios_Venta';
    body.innerHTML = '<div class="loading"><div class="spinner"></div><p>Calculando...</p></div>';

    try {
        const { data: ventas, error } = await supabaseClient.from('ventas').select('*').eq('estado', 'pagado');
        if (error) throw error;

        const totalVentas = ventas.reduce((s, v) => s + (v.total || 0), 0);
        const ticketPromedio = ventas.length > 0 ? totalVentas / ventas.length : 0;

        // Ventas por día de semana
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const diasStats = [0, 0, 0, 0, 0, 0, 0];

        ventas.forEach(v => {
            const d = new Date(v.created_at).getDay();
            diasStats[d]++;
        });

        datosReporteActual = [
            { Indicador: 'Ticket Promedio', Valor: '$' + formatearPrecio(ticketPromedio) },
            { Indicador: 'Total Transacciones', Valor: ventas.length },
            ...dias.map((d, i) => ({ Indicador: 'Ventas en ' + d, Valor: diasStats[i] }))
        ];
        columnasReporteActual = ['Indicador', 'Valor'];

        body.innerHTML = `
            <div class="stats-grid" style="margin-bottom:2rem;">
                <div class="stat-card">
                    <div class="stat-icon blue">🎟️</div>
                    <div class="stat-info">
                        <h3>$${formatearPrecio(ticketPromedio)}</h3>
                        <p>Ticket Promedio</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green">🛒</div>
                    <div class="stat-info">
                        <h3>${ventas.length}</h3>
                        <p>Transacciones Totales</p>
                    </div>
                </div>
            </div>
            
            <h4>Distribución por Día de la Semana</h4>
            <div style="height:300px; margin-top:1rem;">
                <canvas id="chartDiasSemana"></canvas>
            </div>
        `;

        setTimeout(() => {
            const ctx = document.getElementById('chartDiasSemana');
            if (ctx) {
                new Chart(ctx.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: dias,
                        datasets: [{
                            label: 'Cantidad de Ventas',
                            data: diasStats,
                            backgroundColor: '#6366f1',
                            borderRadius: 6
                        }]
                    },
                    options: { responsive: true, scales: { y: { beginAtZero: true } } }
                });
            }
        }, 100);

    } catch (e) { body.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`; }
}

function exportarReporte() {
    if (!datosReporteActual || datosReporteActual.length === 0) {
        showToast('No hay datos para exportar', 'warning');
        return;
    }

    // Crear modal de selección
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:400px;">
            <div class="modal-header">
                <h3>📥 Exportar Reporte</h3>
                <button onclick="this.closest('.modal-overlay').remove()" class="btn-cerrar">×</button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom:1.5rem; color:#64748b;">Selecciona el formato de exportación:</p>
                <div style="display:flex; flex-direction:column; gap:1rem;">
                    <button onclick="exportarReporteExcel(); this.closest('.modal-overlay').remove();" 
                        class="btn btn-success" style="width:100%; justify-content:center;">
                        📊 Exportar a Excel
                    </button>
                    <button onclick="exportarReportePDF(); this.closest('.modal-overlay').remove();" 
                        class="btn btn-danger" style="width:100%; justify-content:center;">
                        📄 Exportar a PDF
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function exportarReporteExcel() {
    if (!datosReporteActual || datosReporteActual.length === 0) {
        showToast('No hay datos para exportar', 'warning');
        return;
    }

    try {
        const worksheet = XLSX.utils.json_to_sheet(datosReporteActual);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte");
        XLSX.writeFile(workbook, `Reporte_${tituloReporteActual}_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('✅ Reporte Excel descargado');
    } catch (error) {
        console.error('Error exportando Excel:', error);
        showToast('❌ Error al exportar Excel', 'error');
    }
}


function exportarReportePDF() {
    if (!window.jspdf) { showToast('Librería PDF no cargada', 'error'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Título
    doc.setFontSize(18);
    doc.text(tituloReporteActual.replace(/_/g, ' '), 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generado el: ${new Date().toLocaleString('es-CO')}`, 14, 30);

    // Tabla
    // Transformar datos a formato array para autoTable
    const headers = [columnasReporteActual];
    const data = datosReporteActual.map(obj => columnasReporteActual.map(col => obj[col]));

    doc.autoTable({
        head: headers,
        body: data,
        startY: 40,
        theme: 'striped',
        headStyles: { fillColor: [255, 107, 0] }, // Naranja marca
        styles: { fontSize: 10 }
    });

    doc.save(`Reporte_${tituloReporteActual}.pdf`);
    showToast('✅ Reporte PDF descargado');
}

// (Bloque de categorías duplicado eliminado - Se usa la versión unificada al final del archivo)

// ═══════════════════════════════════════════════════════════════
// PRODUCTOS
// ═══════════════════════════════════════════════════════════════
async function cargarProductos() {
    const lista = document.getElementById('listaProductos'); if (lista) lista.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>';
    try {
        const { data, error } = await supabaseClient.from('productos').select('*').order('nombre');
        if (error) throw error;
        productos = data || [];

        // Cargar reseñas para calificación
        const { data: resenas } = await supabaseClient.from('producto_resenas').select('id_producto, estrellas');
        const calificaciones = {};
        if (resenas) {
            resenas.forEach(r => {
                const id = r.id_producto; // Puede ser UUID o ID corto, normalizar si es necesario
                if (!calificaciones[id]) calificaciones[id] = { sum: 0, count: 0 };
                calificaciones[id].sum += r.estrellas;
                calificaciones[id].count++;
            });
        }

        // Adjuntar calificación a productos
        productos.forEach(p => {
            const cal = calificaciones[p.id] || calificaciones[p.id_producto];
            p.rating = cal ? (cal.sum / cal.count).toFixed(1) : 0;
            p.ratingCount = cal ? cal.count : 0;
        });

        renderizarProductos(productos);
    } catch (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error:', error); if (lista) lista.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`; }
}

// Placeholder SVG para productos sin imagen
const PLACEHOLDER_IMG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect fill="#f1f5f9" width="400" height="300"/><text fill="#94a3b8" font-family="system-ui" font-size="16" x="50%" y="50%" text-anchor="middle" dy="0.3em">Sin imagen</text></svg>');

function renderizarProductos(lista) {
    const grid = document.getElementById('listaProductos'); if (!grid) return;
    if (lista.length === 0) { grid.innerHTML = '<div class="alert alert-info">No hay productos</div>'; return; }
    grid.innerHTML = lista.map(p => {
        const imgSrc = p.url_imagen || PLACEHOLDER_IMG;
        return `<div class="producto-admin-card">
            <div class="producto-admin-img">
                <img src="${imgSrc}" onerror="this.src='${PLACEHOLDER_IMG}'">
            </div>
            <div class="producto-admin-info">
                <span class="badge ${p.estado === 'Activo' ? 'badge-success' : 'badge-warning'}">${p.estado}</span>
                <h4>${p.nombre}</h4>
                <p class="meta">${p.marca} • ${p.categoria}</p>
                <p class="precio">$${formatearPrecio(p.precio)}</p>
                <div style="margin-bottom:0.5rem; font-size:0.9rem; color:#f59e0b;">
                    ${p.ratingCount > 0 ? `⭐ ${p.rating} (${p.ratingCount})` : '<span style="color:#cbd5e1;">☆ Sin calificar</span>'}
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                     ${p.destacado ? '<span class="badge badge-warning">⭐ Destacado</span>' : '<span></span>'}
                     <button class="btn btn-sm ${p.destacado ? 'btn-outline-warning' : 'btn-outline-secondary'}" onclick="toggleDestacado('${p.id}', ${!p.destacado})" style="font-size:0.75rem;">
                        ${p.destacado ? 'Quitar Destacado' : '⭐ Destacar'}
                     </button>
                </div>
                <div class="producto-admin-actions">
                    <button onclick="editarProducto('${p.id}')" class="btn btn-secondary btn-sm">✏️ Editar</button>
                    <button onclick="eliminarProducto('${p.id}')" class="btn btn-danger btn-sm">🗑️ Eliminar</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function filtrarProductosAdmin() {
    const input = document.getElementById('buscarProductoAdmin');
    const busqueda = (input?.value || '').toLowerCase();
    const filtrados = productos.filter(p => (p.nombre || '').toLowerCase().includes(busqueda) || (p.marca || '').toLowerCase().includes(busqueda) || (p.categoria || '').toLowerCase().includes(busqueda) || (p.id_producto || '').toLowerCase().includes(busqueda));
    renderizarProductos(filtrados);
}

function mostrarFormProducto() {
    limpiarFormProducto();
    document.getElementById('formTituloProducto').textContent = '➕ Nuevo Producto';
    document.getElementById('formProducto').style.display = 'block';

    // Ocultar campos de precio y stock al crear (se maneja en Compras/Inventario)
    const precioCompraGroup = document.getElementById('productoPrecioCompra')?.closest('.form-group');
    if (precioCompraGroup) precioCompraGroup.style.display = 'none';

    const margenGroup = document.getElementById('productoMargen')?.closest('.form-group');
    if (margenGroup) margenGroup.style.display = 'none';

    // Precio venta se mantiene visible porque es obligatorio, pero podemos ponerlo opcional si se desea
    // Por ahora lo dejamos visible para no romper validaciones, o le ponemos 0 por defecto
    document.getElementById('productoPrecio').value = '0'; // Default

    cargarStockTiendas(null);
    cargarCategoriasEnFormulario(); // Cargar categorías dinámicamente
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Nueva función para cargar categorías en el select
async function cargarCategoriasEnFormulario() {
    const select = document.getElementById('productoCategoria');
    if (!select) return;

    try {
        // Guardar valor actual si estamos editando
        const valorActual = select.value;

        const { data: categorias, error } = await supabaseClient
            .from('categorias')
            .select('nombre, icono')
            .order('nombre');

        if (error) throw error;

        // Limpiar y mantener default
        select.innerHTML = '<option value="">Seleccionar...</option>';

        (categorias || []).forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.nombre; // Usamos el nombre como valor para compatibilidad
            option.textContent = `${cat.icono || ''} ${cat.nombre}`;
            select.appendChild(option);
        });

        // Restaurar valor si existe en la nueva lista
        if (valorActual) {
            select.value = valorActual;
        }

    } catch (e) {
        console.error('Error cargando categorías al formulario:', e);
        // Fallback silencioso o alert
    }
}

function limpiarFormProducto() {
    ['productoId', 'productoIdProducto', 'productoNombre', 'productoReferencia', 'productoMarca', 'productoVariantes', 'productoPrecioCompra', 'productoPrecio', 'productoMargen', 'productoDescCorta', 'productoDescTecnica', 'productoImagen', 'stockAlcala', 'stockLocal01', 'stockJordan', 'stockDigital'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = id.startsWith('stock') ? '0' : '';
    });
    const cat = document.getElementById('productoCategoria'); if (cat) cat.value = '';
    const est = document.getElementById('productoEstado'); if (est) est.value = 'Activo';
    const margen = document.getElementById('productoMargen'); if (margen) margen.value = '0%';
    removerPreview('producto');
}

function cancelarFormProducto() { document.getElementById('formProducto').style.display = 'none'; limpiarFormProducto(); }

async function editarProducto(id) {
    try {
        const { data, error } = await supabaseClient.from('productos').select('*').eq('id', id).single();
        if (error || !data) { showToast('Error al cargar producto', 'error'); return; }

        // Cargar categorías antes de asignar valores para que el select coincida
        await cargarCategoriasEnFormulario();

        document.getElementById('productoId').value = data.id;
        document.getElementById('productoIdProducto').value = data.id_producto || '';
        document.getElementById('productoNombre').value = data.nombre || '';
        document.getElementById('productoReferencia').value = data.referencia || '';
        document.getElementById('productoCategoria').value = data.categoria || '';
        document.getElementById('productoMarca').value = data.marca || '';
        document.getElementById('productoVariantes').value = Array.isArray(data.variantes) ? data.variantes.join(', ') : '';
        document.getElementById('productoPrecioCompra').value = data.precio_compra || '';
        document.getElementById('productoPrecio').value = data.precio || '';
        document.getElementById('productoDescCorta').value = data.descripcion_corta || '';
        document.getElementById('productoDescTecnica').value = data.descripcion_tecnica || '';
        document.getElementById('productoImagen').value = data.url_imagen || '';
        document.getElementById('productoEstado').value = data.estado || 'Activo';
        calcularMargen();
        if (data.url_imagen) { const preview = document.getElementById('previewProducto'); const container = document.getElementById('previewContainerProducto'); if (preview && container) { preview.src = data.url_imagen; container.style.display = 'inline-block'; } }
        await cargarStockTiendas(data.id_producto);
        document.getElementById('formTituloProducto').textContent = '✏️ Editar Producto';
        document.getElementById('formProducto').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function cargarStockTiendas(idProducto) {
    document.getElementById('stockAlcala').value = 0;
    document.getElementById('stockLocal01').value = 0;
    document.getElementById('stockJordan').value = 0;
    const stockDigital = document.getElementById('stockDigital');
    if (stockDigital) stockDigital.value = 0;
    if (!idProducto) return;
    try {
        const [alcala, local01, jordan, digital] = await Promise.all([
            supabaseClient.from('inventario_alcala').select('cantidad').eq('id_producto', idProducto),
            supabaseClient.from('inventario_01').select('cantidad').eq('id_producto', idProducto),
            supabaseClient.from('inventario_jordan').select('cantidad').eq('id_producto', idProducto),
            supabaseClient.from('inventario_digital').select('cantidad').eq('id_producto', idProducto)
        ]);
        if (alcala.data && alcala.data.length > 0) document.getElementById('stockAlcala').value = alcala.data[0].cantidad || 0;
        if (local01.data && local01.data.length > 0) document.getElementById('stockLocal01').value = local01.data[0].cantidad || 0;
        if (jordan.data && jordan.data.length > 0) document.getElementById('stockJordan').value = jordan.data[0].cantidad || 0;
        if (digital?.data && digital.data.length > 0 && stockDigital) stockDigital.value = digital.data[0].cantidad || 0;
    } catch (e) { }
}

function calcularMargen() {
    const precioCompra = parseFloat(document.getElementById('productoPrecioCompra')?.value) || 0;
    const precioVenta = parseFloat(document.getElementById('productoPrecio')?.value) || 0;
    const margenEl = document.getElementById('productoMargen');
    if (margenEl && document.activeElement !== margenEl) { // No sobreescribir si el usuario está escribiendo en margen
        if (precioCompra > 0 && precioVenta > 0) {
            const margen = ((precioVenta - precioCompra) / precioCompra * 100).toFixed(1);
            margenEl.value = margen + '%';
        } else { margenEl.value = '0%'; }
    }
}

function calcularPrecioDesdeMargen() {
    const precioCompra = parseFloat(document.getElementById('productoPrecioCompra')?.value) || 0;
    const margenTexto = document.getElementById('productoMargen')?.value || '';
    const margen = parseFloat(margenTexto.replace(/[^\d.-]/g, '')) || 0;

    const precioEl = document.getElementById('productoPrecio');
    if (precioEl && precioCompra > 0) {
        const nuevoPrecio = Math.round(precioCompra * (1 + (margen / 100)));
        precioEl.value = nuevoPrecio;
    }
}

async function guardarProducto() {
    const id = document.getElementById('productoId').value;
    const nombre = document.getElementById('productoNombre').value.trim();
    const categoria = document.getElementById('productoCategoria').value;
    const marca = document.getElementById('productoMarca').value.trim();
    const precio = document.getElementById('productoPrecio').value;
    const precioCompra = document.getElementById('productoPrecioCompra').value;

    // Validación simplificada: Si no pone precio, se va en 0
    if (!nombre || !categoria || !marca) {
        showToast('Nombre, Categoría y Marca son obligatorios', 'warning');
        return;
    }
    let urlImagen = document.getElementById('productoImagen').value.trim();
    if (archivosTemporal.producto) {
        showToast('Subiendo imagen...', 'info');
        const urlSubida = await subirImagen(archivosTemporal.producto, 'productos-imagenes');
        if (urlSubida) { urlImagen = urlSubida; archivosTemporal.producto = null; showToast('Imagen subida correctamente', 'success'); }
        else { if (!confirm('Error al subir imagen. ¿Continuar sin imagen?')) { return; } }
    }
    const id_producto = document.getElementById('productoIdProducto').value || (id ? null : 'PROD' + Date.now());
    let idProductoFinal = id_producto;
    if (id && !id_producto) {
        const { data: prodExistente } = await supabaseClient.from('productos').select('id_producto').eq('id', id).single();
        if (prodExistente) idProductoFinal = prodExistente.id_producto;
        else idProductoFinal = 'PROD' + Date.now();
    }
    const variantesInput = document.getElementById('productoVariantes').value;
    const variantes = variantesInput ? variantesInput.split(',').map(v => v.trim()).filter(v => v) : [];
    const producto = { nombre, referencia: document.getElementById('productoReferencia').value.trim() || `REF-${Date.now()}`, categoria, marca, variantes, precio: parseFloat(precio) || 0, precio_compra: parseFloat(precioCompra) || 0, descripcion_corta: document.getElementById('productoDescCorta').value.trim(), descripcion_tecnica: document.getElementById('productoDescTecnica').value.trim(), url_imagen: urlImagen, estado: document.getElementById('productoEstado').value, id_producto: idProductoFinal };
    const stockAlcala = parseInt(document.getElementById('stockAlcala')?.value) || 0;
    const stockLocal01 = parseInt(document.getElementById('stockLocal01')?.value) || 0;
    const stockJordan = parseInt(document.getElementById('stockJordan')?.value) || 0;
    const stockDigital = parseInt(document.getElementById('stockDigital')?.value) || 0;
    try {
        if (id) { delete producto.id_producto; const { error } = await supabaseClient.from('productos').update(producto).eq('id', id); if (error) throw error; showToast('Producto actualizado correctamente'); }
        else { producto.id_producto = idProductoFinal; const { error } = await supabaseClient.from('productos').insert([producto]); if (error) throw error; showToast('Producto creado correctamente'); }
        await guardarStockTiendas(idProductoFinal, stockAlcala, stockLocal01, stockJordan, stockDigital);
        cancelarFormProducto(); await cargarProductos(); await cargarTodosLosInventarios();
    } catch (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error guardando:', error); showToast('Error: ' + error.message, 'error'); }
}

async function guardarStockTiendas(idProducto, alcala, local01, jordan, digital) {
    const ahora = new Date().toISOString();
    const upsertStock = async (tabla, cantidad) => {
        try {
            const { data } = await supabaseClient.from(tabla).select('id').eq('id_producto', idProducto);
            if (data && data.length > 0) {
                await supabaseClient.from(tabla).update({ cantidad: parseInt(cantidad) || 0, updated_at: ahora }).eq('id_producto', idProducto);
            } else {
                await supabaseClient.from(tabla).insert({ id_producto: idProducto, cantidad: parseInt(cantidad) || 0, stock_minimo: 3, ultima_actualizacion: ahora });
            }
        } catch (e) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", `Error en upsertStock ${tabla}:`, e); }
    };
    try {
        await upsertStock('inventario_alcala', alcala);
        await upsertStock('inventario_01', local01);
        await upsertStock('inventario_jordan', jordan);
        try { await upsertStock('inventario_digital', digital); } catch (e) { }
        showToast('Stock guardado en todas las tiendas', 'success');
    } catch (e) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error guardando stock:', e); showToast('Error guardando stock: ' + e.message, 'error'); }
}

async function eliminarProducto(id) {
    const producto = productos.find(p => p.id === id); if (!producto) return;
    if (!confirm(`¿Eliminar "${producto.nombre}"?\n\nEsta acción es permanente.`)) return;
    try {
        if (producto.id_producto) { await Promise.all([supabaseClient.from('inventario_alcala').delete().eq('id_producto', producto.id_producto), supabaseClient.from('inventario_01').delete().eq('id_producto', producto.id_producto), supabaseClient.from('inventario_jordan').delete().eq('id_producto', producto.id_producto)]).catch(() => { }); }
        const { error } = await supabaseClient.from('productos').delete().eq('id', id);
        if (error) throw error;
        showToast('Producto eliminado'); await cargarProductos();
    } catch (error) { showToast('Error: ' + error.message, 'error'); }
}

async function toggleDestacado(id, valor) {
    try {
        const { error } = await supabaseClient.from('productos').update({ destacado: valor }).eq('id', id);
        if (error) throw error;
        showToast(valor ? 'Producto destacado' : 'Quitado de destacados', 'success');
        // Actualizar visualmente sin recargar todo si es posible, pero cargarProductos es seguro
        cargarProductos();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}
window.toggleDestacado = toggleDestacado;

// ═══════════════════════════════════════════════════════════════
// VENTAS
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// VENTAS
// ═══════════════════════════════════════════════════════════════
let ventasActuales = []; // Variable global para almacenar ventas cargadas
let rangoActual = 'dia';

async function cargarVentasDia() {
    await cargarVentasRango('dia');
}

async function cargarVentasRango(rango) {
    rangoActual = rango;
    const statsContainer = document.getElementById('ventasDiaStats');
    const tbody = document.getElementById('tbodyVentasDia');
    const titulo = document.getElementById('tituloVentas');

    // Actualizar botones activos
    document.querySelectorAll('[id^="btnVentas"]').forEach(btn => {
        btn.classList.remove('btn-active');
        btn.classList.add('btn-outline');
    });
    const btnActivo = document.getElementById(`btnVentas${rango.charAt(0).toUpperCase() + rango.slice(1)}`);
    if (btnActivo) {
        btnActivo.classList.remove('btn-outline');
        btnActivo.classList.add('btn-active');
    }

    try {
        const hoy = new Date();
        let fechaInicio = new Date();
        let fechaFin = new Date();
        let textoFecha = '';

        if (rango === 'dia') {
            textoFecha = hoy.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            if (titulo) titulo.textContent = '📊 Ventas del Día';
            // Inicio y fin del día actual
            fechaInicio.setHours(0, 0, 0, 0);
            fechaFin.setHours(23, 59, 59, 999);
        } else if (rango === 'semana') {
            // Inicio de semana (lunes)
            const diaSemana = hoy.getDay(); // 0 domingo, 1 lunes...
            const diff = hoy.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
            fechaInicio.setDate(diff);
            fechaInicio.setHours(0, 0, 0, 0);

            // Fin de semana (domingo)
            fechaFin.setDate(fechaInicio.getDate() + 6);
            fechaFin.setHours(23, 59, 59, 999);

            textoFecha = `${fechaInicio.toLocaleDateString('es-CO')} - ${fechaFin.toLocaleDateString('es-CO')}`;
            if (titulo) titulo.textContent = '📊 Ventas de la Semana';
        } else if (rango === 'mes') {
            // Inicio del mes
            fechaInicio.setDate(1);
            fechaInicio.setHours(0, 0, 0, 0);
            // Fin del mes
            fechaFin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
            fechaFin.setHours(23, 59, 59, 999);

            textoFecha = hoy.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
            if (titulo) titulo.textContent = '📊 Ventas del Mes';
        }

        const fechaEl = document.getElementById('fechaHoy');
        if (fechaEl) fechaEl.textContent = textoFecha;

        // Mostrar loading
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando...</td></tr>';

        // Consulta Supabase con rangos correctos
        // Ajustamos fechas a ISO string formato local si es posible, o UTC
        // Supabase usa UTC. created_at es timestamptz?
        // En migraciones vi TIMESTAMP DEFAULT NOW(). Asumo que guarda UTC.

        const { data, error } = await supabaseClient
            .from('ventas')
            .select('*')
            .gte('created_at', fechaInicio.toISOString())
            .lte('created_at', fechaFin.toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;

        ventasActuales = data || [];
        renderizarTablaVentas(ventasActuales, statsContainer, tbody);
        actualizarGraficosVentas(ventasActuales);

    } catch (error) {
        console.error('Error cargando ventas:', error);
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando ventas rango ' + rango, error);
        if (statsContainer) {
            statsContainer.innerHTML = '<div class="alert alert-warning">Error cargando datos de ventas</div>';
        }
    }
}

function renderizarTablaVentas(ventas, statsContainer, tbody) {
    const totalVentas = ventas.reduce((sum, v) => sum + (v.total || 0), 0);
    const totalUnidades = ventas.reduce((sum, v) => sum + (v.cantidad || 0), 0);

    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon green">💰</div>
                <div class="stat-info">
                    <h3>$${formatearPrecio(totalVentas)}</h3>
                    <p>Total Vendido</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon blue">🛒</div>
                <div class="stat-info">
                    <h3>${ventas.length}</h3>
                    <p>Transacciones</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon orange">📦</div>
                <div class="stat-info">
                    <h3>${totalUnidades}</h3>
                    <p>Unidades Vendidas</p>
                </div>
            </div>
        `;
    }

    if (tbody) {
        if (ventas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--gray-500);">No hay ventas en este periodo</td></tr>';
        } else {
            // Actualizar encabezado si es necesario (asumiendo que está en el HTML)
            // En admin.html ya lo tiene
            tbody.innerHTML = ventas.map(v => `
                <tr>
                    <td>
                        <div>${new Date(v.created_at).toLocaleDateString('es-CO')}</div>
                        <small style="color:#888">${formatearHora(v.created_at)}</small>
                    </td>
                    <td><strong>${v.local || 'N/A'}</strong></td>
                    <td>${v.nombre_producto || 'N/A'}</td>
                    <td>${v.cantidad || 0}</td>
                    <td><strong>$${formatearPrecio(v.total)}</strong></td>
                    <td><span class="badge badge-success">${v.metodo_pago || 'N/A'}</span></td>
                    <td><small style="font-weight:600; color:var(--primary)">${v.voucher_code || '-'}</small></td>
                </tr>
            `).join('');
        }
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
// DEUDORES
// ═══════════════════════════════════════════════════════════════
async function cargarDeudores() {
    try {
        const estado = document.getElementById('deudoresEstadoFiltro')?.value || 'ABIERTO';
        const local = document.getElementById('deudoresLocalFiltro')?.value || '';
        let query = supabaseClient.from('deudores').select('*').order('saldo_actual', { ascending: false });
        if (estado) query = query.eq('estado', estado);
        if (local) query = query.ilike('sede_venta', `%${local}%`);
        const { data, error } = await query;
        if (error) throw error;
        todosDeudores = data || [];
        renderizarDeudores(todosDeudores);
        const { data: todos } = await supabaseClient.from('deudores').select('*');
        const abiertos = todos?.filter(d => d.estado === 'ABIERTO') || [];
        const totalDeuda = abiertos.reduce((s, d) => s + (d.saldo_actual || 0), 0);
        document.getElementById('deudoresTotalDeuda').textContent = '$' + formatearPrecio(totalDeuda);
        document.getElementById('deudoresActivos').textContent = abiertos.length;
        document.getElementById('deudoresCerrados').textContent = todos?.filter(d => d.estado === 'CERRADO').length || 0;
    } catch (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando deudores:', error); showToast('Error al cargar deudores', 'error'); }
}

function renderizarDeudores(lista) {
    const tbody = document.getElementById('tbodyDeudores');
    if (!lista || lista.length === 0) { tbody.innerHTML = '<tr><td colspan="9" class="text-center" style="padding:2rem;color:var(--gray-500);">No hay deudores</td></tr>'; return; }
    tbody.innerHTML = lista.map(d => {
        const fechaRef = d.ultimo_pago || d.fecha_compra;
        let diasSinPago = 0; if (fechaRef) { diasSinPago = Math.floor((new Date() - new Date(fechaRef)) / (1000 * 60 * 60 * 24)); }
        const estadoBadge = d.estado === 'ABIERTO' ? (diasSinPago > 30 ? 'badge-danger' : 'badge-warning') : 'badge-success';
        return `<tr><td><strong>${d.nombre_completo}</strong></td><td>${d.telefono || '-'}</td><td>${d.sede_venta || '-'}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">${d.descripcion_compra || '-'}</td><td>$${formatearPrecio(d.monto_original || 0)}</td><td><strong style="color:${d.saldo_actual > 0 ? 'var(--danger)' : 'var(--success)'}">$${formatearPrecio(d.saldo_actual || 0)}</strong></td><td><span class="badge ${diasSinPago > 30 ? 'badge-danger' : 'badge-info'}">${diasSinPago} días</span></td><td><span class="badge ${estadoBadge}">${d.estado}</span></td><td><button onclick="editarDeudor('${d.id}')" class="btn btn-sm btn-secondary">✏️</button><button onclick="registrarPagoDeudor('${d.id}')" class="btn btn-sm btn-success">💰</button><a href="https://wa.me/57${(d.telefono || '').replace(/\D/g, '')}" target="_blank" class="btn btn-sm" style="background:#25D366;color:white;">📱</a></td></tr>`;
    }).join('');
}

function buscarDeudores() {
    const query = document.getElementById('deudoresBuscar').value.toLowerCase();
    if (!query) { renderizarDeudores(todosDeudores); return; }
    renderizarDeudores(todosDeudores.filter(d => d.nombre_completo?.toLowerCase().includes(query) || d.telefono?.includes(query)));
}

// ═══════════════════════════════════════════════════════════════
// PRODUCTOS
// ═══════════════════════════════════════════════════════════════


async function cargarProductos() {
    const list = document.getElementById('listaProductos');
    if (list) list.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando productos...</p></div>';

    try {
        const [pQ, iA, i01, iJ, iD] = await Promise.all([
            supabaseClient.from('productos').select('*').order('nombre'),
            supabaseClient.from('inventario_alcala').select('*'),
            supabaseClient.from('inventario_01').select('*'),
            supabaseClient.from('inventario_jordan').select('*'),
            supabaseClient.from('inventario_digital').select('*')
        ]);

        if (pQ.error) throw pQ.error;

        productos = pQ.data || [];
        inventarios.alcala = iA.data || [];
        inventarios.local01 = i01.data || [];
        inventarios.jordan = iJ.data || [];
        inventarios.digital = iD.data || [];



        renderizarProductosAdmin();

        // Actualizar stats dashboard si existen
        if (document.getElementById('statProductos')) document.getElementById('statProductos').textContent = productos.length;

        // También intentar renderizar categorias en charts si existen
        if (typeof renderizarChartsDashboard === 'function') renderizarChartsDashboard();

    } catch (e) {
        console.error(e);
        if (list) list.innerHTML = '<p class="text-danger">Error cargando productos: ' + e.message + '</p>';
    }
}

function renderizarProductosAdmin(lista = productos) {
    const container = document.getElementById('listaProductos');
    if (!container) return;

    if (lista.length === 0) {
        container.innerHTML = '<p class="text-center p-5">No hay productos encontrados.</p>';
        return;
    }

    container.innerHTML = lista.map((p, index) => {
        // FIX: Usar p.id_producto que es el campo correcto para hacer match con inventario
        const pId = p.id_producto; // Este campo contiene "PROD..." que coincide con inventario.id_producto
        const stockA = (inventarios.alcala.find(i => i.id_producto === pId)?.cantidad) || 0;
        const stock01 = (inventarios.local01.find(i => i.id_producto === pId)?.cantidad) || 0;
        const stockJ = (inventarios.jordan.find(i => i.id_producto === pId)?.cantidad) || 0;
        const stockD = (inventarios.digital.find(i => i.id_producto === pId)?.cantidad) || 0;



        const total = stockA + stock01 + stockJ + stockD;

        return `
        <div class="producto-admin-card">
            <div class="producto-admin-img">
                <img src="${p.url_imagen || p.imagen || 'https://via.placeholder.com/280x180'}" alt="${p.nombre}">
            </div>
            <div class="producto-admin-info">
                <h4>${p.nombre}</h4>

                <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin:0.75rem 0; font-size:0.85rem;">
                    <span title="Alcalá">🏪 ${stockA}</span>
                    <span title="Local 01">🏬 ${stock01}</span>
                    <span title="Jordán">🏢 ${stockJ}</span>
                    <span title="Digital">🌐 ${stockD}</span>
                    <span style="font-weight:700; color:var(--success)">Total: ${total}</span>
                </div>
                <div class="precio">$${formatearPrecio(p.precio)}</div>
            </div>
            <div class="producto-admin-actions">
                <button onclick="editarProducto('${p.id}')" class="btn btn-sm btn-primary">EDITAR</button>
            </div>
        </div>`;
    }).join('');
}

// ═══════════════════════════════════════════════════════════════
// METAS DE VENTAS
// ═══════════════════════════════════════════════════════════════

async function cargarMetas() {
    const tbody = document.getElementById('listaMetas');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando metas...</td></tr>';

    try {
        const { data: metas, error } = await supabaseClient
            .from('metas_locales')
            .select('*')
            .order('anio', { ascending: false })
            .order('mes', { ascending: false });

        if (error) throw error;

        if (!metas || metas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay metas configuradas</td></tr>';
            return;
        }

        // Obtener ventas del mes para comparar
        // Esto es un cálculo pesado si hay muchas metas, optimización: cargar ventas del año actual globalmente o por demanda
        // Para simplificar, calcularemos el progreso basado en 'ventas' del mes.

        // Vamos a hacer una aproximación rápida:
        // 1. Obtener todas las ventas del año/mes relevantes (quizás mejor solo mostrar meta y dejar progreso para reporte detallado?
        // El usuario quiere ver si "sirve".

        // Mejor approach: Mostrar las metas configuradas simplemente. El cálculo de progreso lo haremos si el usuario lo pide o en dashboard.
        // Pero para que se vea "bonito", intentemos calcularlo.

        tbody.innerHTML = '';

        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        for (const m of metas) {
            // Calcular ventas reales para este mes/local
            let alcanzado = 0;
            // *Nota: Esto debería hacerse en backend o con una query optimizada, no en loop aquí.
            // Por ahora, mostraré 0 en alcanzado o la almacenada si tuviéramos campo cached.

            // Query simple para ventas del mes/local específico
            const inicioMes = new Date(m.anio, m.mes - 1, 1).toISOString();
            const finMes = new Date(m.anio, m.mes, 0, 23, 59, 59).toISOString();

            // FAKE DATA para no bloquear por query lenta a supabase en loop:
            // alcanzado = 0; // Idealmente fetch sum(ventas) where local=... and date=...

            const porcentaje = 0; // m.valor_meta > 0 ? (alcanzado / m.valor_meta) * 100 : 0;
            const colorProgreso = '#f59e0b'; // Gris/Naranja por defecto

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${meses[m.mes - 1]} ${m.anio}</strong></td>
                <td>${m.local.toUpperCase()}</td>
                <td style="font-weight:600;">$${formatearPrecio(m.valor_meta)}</td>
                <td style="color:#64748b;">$${formatearPrecio(alcanzado)} <small>(Calc. Pendiente)</small></td>
                <td>
                    <div style="width:100px; background:#e2e8f0; border-radius:10px; height:8px; overflow:hidden;">
                        <div style="width:${Math.min(porcentaje, 100)}%; background:${colorProgreso}; height:100%;"></div>
                    </div>
                    <small style="font-weight:700; color:${colorProgreso}">${porcentaje.toFixed(1)}%</small>
                </td>
                <td><span class="badge badge-warning">EN PROCESO</span></td>
                <td>
                    <button onclick="eliminarMeta('${m.id}')" class="btn btn-sm btn-outline-danger">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        }

    } catch (e) {
        console.error(e);
        showToast('Error al cargar metas', 'error');
    }
}

function abrirModalMeta() {
    document.getElementById('modalMeta').style.display = 'flex';
    document.getElementById('metaId').value = '';
    document.getElementById('metaMonto').value = '';
    const hoy = new Date();
    document.getElementById('metaMes').value = hoy.getMonth() + 1;
    document.getElementById('metaAnio').value = hoy.getFullYear();
}

function cerrarModalMeta() {
    document.getElementById('modalMeta').style.display = 'none';
}

async function guardarMeta() {
    const id = document.getElementById('metaId').value;
    const mes = parseInt(document.getElementById('metaMes').value);
    const anio = parseInt(document.getElementById('metaAnio').value);
    const local = document.getElementById('metaLocal').value;
    const monto = limpiarMoneda(document.getElementById('metaMonto').value);

    if (monto <= 0) return showToast('Ingresa un monto válido para la meta', 'warning');

    try {
        const obj = { mes, anio, local, valor_meta: monto };
        let res;
        if (id) {
            res = await supabaseClient.from('metas_locales').update(obj).eq('id', id);
        } else {
            res = await supabaseClient.from('metas_locales').insert(obj);
        }

        if (res.error) throw res.error;

        showToast('Meta guardada exitosamente');
        cerrarModalMeta();
        cargarMetas();
    } catch (e) {
        console.error(' Error al guardar meta:', e);
        showToast('Error al guardar meta: ' + (e.message || e.toString()), 'error');
    }
}

async function eliminarMeta(id) {
    if (!confirm('¿Estás seguro de eliminar esta meta?')) return;
    try {
        const { error } = await supabaseClient.from('metas_locales').delete().eq('id', id);
        if (error) throw error;
        showToast('Meta eliminada');
        cargarMetas();
    } catch (e) {
        showToast('Error al eliminar meta', 'error');
    }
}

async function exportarMetasPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.text("Reporte de Cumplimiento de Metas", 20, 20);
    doc.setFontSize(12);
    doc.text(`Generado el: ${new Date().toLocaleString()}`, 20, 30);

    const rows = [];
    const table = document.getElementById('listaMetas');
    Array.from(table.rows).forEach(row => {
        const cells = Array.from(row.cells).map(c => c.textContent.trim().split('%')[0] + (c.textContent.includes('%') ? '%' : ''));
        rows.push(cells.slice(0, 6)); // Quitamos la columna de acciones
    });

    doc.autoTable({
        startY: 40,
        head: [['Mes/Año', 'Local', 'Meta', 'Alcanzado', 'Progreso', 'Estado']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] }
    });

    doc.save(`Metas_Ventas_Moteros_${new Date().getMonth() + 1}_${new Date().getFullYear()}.pdf`);
}

function mostrarFormDeudor() {
    ['deudorId', 'deudorNombre', 'deudorTelefono', 'deudorSede', 'deudorDescripcion', 'deudorMontoOriginal', 'deudorSaldo', 'deudorReferencia'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const fechaEl = document.getElementById('deudorFecha');
    if (fechaEl) fechaEl.value = new Date().toISOString().split('T')[0];

    // Titulo default
    const tituloEl = document.getElementById('formTituloDeudor');
    if (tituloEl) tituloEl.textContent = '➕ Nuevo Deudor';

    // Mostrar Modal
    const modal = document.getElementById('modalDeudor');
    if (modal) modal.style.display = 'flex';
}
window.mostrarFormDeudor = mostrarFormDeudor;

function cancelarFormDeudor() {
    const modal = document.getElementById('modalDeudor');
    if (modal) modal.style.display = 'none';
}
window.cancelarFormDeudor = cancelarFormDeudor;

async function guardarDeudor() {
    const nombre = document.getElementById('deudorNombre').value;
    const sede = document.getElementById('deudorSede').value;
    const descripcion = document.getElementById('deudorDescripcion').value;
    const montoOriginal = parseFloat(document.getElementById('deudorMontoOriginal').value);
    const saldo = parseFloat(document.getElementById('deudorSaldo').value);
    if (!nombre || !sede || !descripcion || !montoOriginal || !saldo) { showToast('Completa los campos obligatorios', 'warning'); return; }
    try {
        const deudor = { nombre_completo: nombre, telefono: document.getElementById('deudorTelefono').value, sede_venta: sede, descripcion_compra: descripcion, monto_original: montoOriginal, saldo_actual: saldo, fecha_compra: document.getElementById('deudorFecha').value || null, contacto_referencia: document.getElementById('deudorReferencia').value, estado: saldo > 0 ? 'ABIERTO' : 'CERRADO' };
        const id = document.getElementById('deudorId').value;
        if (id) { const { error } = await supabaseClient.from('deudores').update(deudor).eq('id', id); if (error) throw error; showToast('Deudor actualizado', 'success'); }
        else { const { error } = await supabaseClient.from('deudores').insert(deudor); if (error) throw error; showToast('Deudor registrado', 'success'); }
        cancelarFormDeudor(); cargarDeudores();
    } catch (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error guardando deudor:', error); showToast('Error al guardar', 'error'); }
}

async function editarDeudor(id) {
    try {
        const { data, error } = await supabaseClient.from('deudores').select('*').eq('id', id).single();
        if (error) throw error;
        document.getElementById('formDeudor').style.display = 'block';
        document.getElementById('formTituloDeudor').textContent = '✏️ Editar Deudor';
        document.getElementById('deudorId').value = data.id;
        document.getElementById('deudorNombre').value = data.nombre_completo || '';
        document.getElementById('deudorTelefono').value = data.telefono || '';
        document.getElementById('deudorSede').value = data.sede_venta || '';
        document.getElementById('deudorFecha').value = data.fecha_compra || '';
        document.getElementById('deudorDescripcion').value = data.descripcion_compra || '';
        document.getElementById('deudorMontoOriginal').value = data.monto_original || '';
        document.getElementById('deudorSaldo').value = data.saldo_actual || '';
        document.getElementById('deudorReferencia').value = data.contacto_referencia || '';
    } catch (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando deudor:', error); showToast('Error al cargar datos', 'error'); }
}

async function registrarPagoDeudor(id) {
    const monto = prompt('Ingrese el monto del pago:');
    if (!monto || isNaN(monto)) return;
    try {
        const { data: deudor } = await supabaseClient.from('deudores').select('*').eq('id', id).single();
        const nuevoSaldo = Math.max(0, (deudor.saldo_actual || 0) - parseFloat(monto));
        await supabaseClient.from('pagos_deudor').insert({ deudor_id: id, monto: parseFloat(monto), fecha_pago: new Date().toISOString().split('T')[0], saldo_anterior: deudor.saldo_actual, saldo_nuevo: nuevoSaldo });
        await supabaseClient.from('deudores').update({ saldo_actual: nuevoSaldo, ultimo_pago: new Date().toISOString().split('T')[0], estado: nuevoSaldo === 0 ? 'CERRADO' : 'ABIERTO' }).eq('id', id);
        showToast('Pago registrado correctamente', 'success'); cargarDeudores();
    } catch (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error registrando pago:', error); showToast('Error al registrar pago', 'error'); }
}



// ═══════════════════════════════════════════════════════════════
// DEUDAS DEL NEGOCIO, CRÉDITOS, BODEGAS, ALIANZAS
// ═══════════════════════════════════════════════════════════════
async function cargarDeudasNegocio() {

    const tbody = document.getElementById('tbodyDeudas');
    if (!tbody) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", '❌ No se encontró tbodyDeudas'); return; }
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando...</td></tr>';

    try {
        const { data, error } = await supabaseClient.from('deudas_negocio').select('*').order('saldo_actual', { ascending: false });
        if (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", '❌ Error Supabase:', error); throw error; }



        // Calcular estadísticas
        const lista = data || [];
        const totalOriginal = lista.reduce((s, d) => s + parseFloat(d.monto_original || 0), 0);
        const totalSaldo = lista.reduce((s, d) => s + parseFloat(d.saldo_actual || 0), 0);
        const totalPagado = totalOriginal - totalSaldo;
        const activas = lista.filter(d => d.estado === 'ABIERTO').length;

        const elSaldo = document.getElementById('deudasTotalSaldo');
        const elOriginal = document.getElementById('deudasMontoOriginal');
        const elPagado = document.getElementById('deudasPagado');
        const elActivas = document.getElementById('deudasActivas');

        if (elSaldo) elSaldo.textContent = '$' + formatearPrecio(totalSaldo);
        if (elOriginal) elOriginal.textContent = '$' + formatearPrecio(totalOriginal);
        if (elPagado) elPagado.textContent = '$' + formatearPrecio(totalPagado);
        if (elActivas) elActivas.textContent = activas;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay deudas registradas</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(d => `<tr>
            <td><strong>${d.concepto}</strong></td>
            <td>${d.numero_factura || '-'}</td>
            <td>${d.acreedor || '-'}</td>
            <td>$${formatearPrecio(d.monto_original || 0)}</td>
            <td><strong class="${(d.saldo_actual || 0) > 0 ? 'text-danger' : 'text-success'}">$${formatearPrecio(d.saldo_actual || 0)}</strong></td>
            <td><span class="badge ${d.estado === 'ABIERTO' ? 'badge-danger' : 'badge-success'}">${d.estado}</span></td>
            <td>
                <button onclick="editarDeudaNegocio('${d.id}')" class="btn btn-sm btn-info" title="Editar">✏️</button>
                <button onclick="registrarPagoDeuda('${d.id}')" class="btn btn-sm btn-success" ${d.saldo_actual <= 0 ? 'disabled' : ''} title="Registrar Pago">💰</button>
            </td>
        </tr>`).join('');


    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", '❌ Error cargando deudas:', error);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error: ${error.message}</td></tr>`;
        showToast('Error al cargar deudas: ' + error.message, 'error');
    }
}

function mostrarFormDeuda() { document.getElementById('formDeuda').style.display = 'flex';['deudaId', 'deudaConcepto', 'deudaFactura', 'deudaAcreedor', 'deudaMontoOriginal', 'deudaSaldo', 'deudaNotas'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); }
function cancelarFormDeuda() { document.getElementById('formDeuda').style.display = 'none'; }

async function guardarDeudaNegocio() {
    const concepto = document.getElementById('deudaConcepto').value;
    const montoOriginal = parseFloat(document.getElementById('deudaMontoOriginal').value);
    const saldo = parseFloat(document.getElementById('deudaSaldo').value);
    if (!concepto || !montoOriginal || !saldo) { showToast('Completa los campos obligatorios', 'warning'); return; }
    try {
        const deuda = { concepto, numero_factura: document.getElementById('deudaFactura').value, acreedor: document.getElementById('deudaAcreedor').value, monto_original: montoOriginal, saldo_actual: saldo, notas: document.getElementById('deudaNotas').value, estado: saldo > 0 ? 'ABIERTO' : 'CERRADO' };
        const id = document.getElementById('deudaId').value;
        if (id) { const { error } = await supabaseClient.from('deudas_negocio').update(deuda).eq('id', id); if (error) throw error; showToast('Deuda actualizada', 'success'); }
        else { const { error } = await supabaseClient.from('deudas_negocio').insert(deuda); if (error) throw error; showToast('Deuda registrada', 'success'); }
        cancelarFormDeuda(); cargarDeudasNegocio();
    } catch (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error guardando deuda:', error); showToast('Error al guardar', 'error'); }
}

async function editarDeudaNegocio(id) {
    try {
        const { data, error } = await supabaseClient.from('deudas_negocio').select('*').eq('id', id).single();
        if (error || !data) { showToast('Error al cargar deuda', 'error'); return; }
        document.getElementById('formDeuda').style.display = 'flex';
        document.getElementById('deudaId').value = data.id;
        document.getElementById('deudaConcepto').value = data.concepto || '';
        document.getElementById('deudaFactura').value = data.numero_factura || '';
        document.getElementById('deudaAcreedor').value = data.acreedor || '';
        document.getElementById('deudaMontoOriginal').value = data.monto_original || '';
        document.getElementById('deudaSaldo').value = data.saldo_actual || '';
        document.getElementById('deudaNotas').value = data.notas || '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error editando deuda:', error); showToast('Error: ' + error.message, 'error'); }
}

async function registrarPagoDeuda(id) {
    try {
        const { data: deuda, error } = await supabaseClient
            .from('deudas_negocio')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        const saldoPendiente = deuda.saldo_actual || 0;

        // Crear modal profesional
        const modal = document.createElement('div');
        modal.id = 'modalPagoDeuda';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
        modal.onclick = function (e) { if (e.target === this) this.remove(); };

        modal.innerHTML = `
            <div style="background:white;border-radius:16px;max-width:450px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);overflow:hidden;">
                <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);color:white;padding:1.25rem 1.5rem;">
                    <h3 style="margin:0;font-size:1.2rem;">💰 Registrar Pago de Deuda</h3>
                </div>
                <div style="padding:1.5rem;">
                    <div style="background:#fef2f2;border:1px solid #fecaca;padding:1rem;border-radius:10px;margin-bottom:1.5rem;">
                        <div style="font-weight:700;color:#991b1b;font-size:1rem;">${deuda.concepto || 'Deuda'}</div>
                        <div style="color:#b91c1c;font-size:0.9rem;margin-top:0.25rem;">Acreedor: ${deuda.acreedor || 'N/A'}</div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;">
                        <div style="text-align:center;padding:1rem;background:#f8fafc;border-radius:10px;">
                            <div style="font-size:0.75rem;color:#64748b;font-weight:600;">MONTO ORIGINAL</div>
                            <div style="font-size:1.3rem;font-weight:700;color:#475569;">$${formatearPrecio(deuda.monto_original || 0)}</div>
                        </div>
                        <div style="text-align:center;padding:1rem;background:#fef2f2;border-radius:10px;">
                            <div style="font-size:0.75rem;color:#991b1b;font-weight:600;">SALDO PENDIENTE</div>
                            <div style="font-size:1.3rem;font-weight:800;color:#dc2626;">$${formatearPrecio(saldoPendiente)}</div>
                        </div>
                    </div>

                    <div style="margin-bottom:1.5rem;">
                        <label style="display:block;font-weight:600;color:#374151;margin-bottom:0.5rem;">Monto a Pagar *</label>
                        <input type="number" id="montoPagoDeuda" value="${saldoPendiente}"
                               style="width:100%;padding:1rem;font-size:1.5rem;font-weight:700;text-align:center;border:2px solid #e5e7eb;border-radius:10px;color:#16a34a;"
                               min="0" max="${saldoPendiente}" step="1000" oninput="calcularPorcentajesLocales()">
                        <div style="display:flex;gap:0.5rem;margin-top:0.75rem;">
                            <button onclick="document.getElementById('montoPagoDeuda').value=${Math.round(saldoPendiente / 2)};calcularPorcentajesLocales();"
                                    style="flex:1;padding:0.5rem;border:1px solid #e5e7eb;background:#f9fafb;border-radius:6px;cursor:pointer;font-size:0.8rem;">
                                50% ($${formatearPrecio(Math.round(saldoPendiente / 2))})
                            </button>
                            <button onclick="document.getElementById('montoPagoDeuda').value=${saldoPendiente};calcularPorcentajesLocales();"
                                    style="flex:1;padding:0.5rem;border:1px solid #e5e7eb;background:#f9fafb;border-radius:6px;cursor:pointer;font-size:0.8rem;">
                                Total ($${formatearPrecio(saldoPendiente)})
                            </button>
                        </div>
                    </div>

                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:1rem;margin-bottom:1.5rem;">
                        <div style="font-weight:600;color:#475569;margin-bottom:0.75rem;font-size:0.9rem;display:flex;justify-content:space-between;">
                            <span>💼 Distribución por Local</span>
                            <span id="labelTotalPorcentaje" style="color:#059669;font-weight:800;">100%</span>
                        </div>
                        <div id="desglosePorcentajes" style="display:grid;gap:0.75rem;">
                            <!-- Alcalá -->
                            <div style="display:flex;gap:0.5rem;align-items:center;background:white;padding:0.5rem;border-radius:8px;border:1px solid #e2e8f0;">
                                <span style="font-size:0.8rem;width:80px;font-weight:600;">🏪 Alcalá</span>
                                <input type="number" id="porcentaje_alcala" value="33.3" step="0.1" style="width:60px;padding:0.25rem;border:1px solid #cbd5e1;border-radius:4px;text-align:center;font-size:0.85rem;" oninput="ajustarDistribucionPorPorcentaje()">
                                <span style="font-size:0.85rem;">%</span>
                                <span style="flex:1;text-align:right;font-weight:700;color:#059669;font-size:0.9rem;" id="alcalaPago">$0</span>
                            </div>
                            <!-- Local 01 -->
                            <div style="display:flex;gap:0.5rem;align-items:center;background:white;padding:0.5rem;border-radius:8px;border:1px solid #e2e8f0;">
                                <span style="font-size:0.8rem;width:80px;font-weight:600;">🏬 Local 01</span>
                                <input type="number" id="porcentaje_local01" value="33.3" step="0.1" style="width:60px;padding:0.25rem;border:1px solid #cbd5e1;border-radius:4px;text-align:center;font-size:0.85rem;" oninput="ajustarDistribucionPorPorcentaje()">
                                <span style="font-size:0.85rem;">%</span>
                                <span style="flex:1;text-align:right;font-weight:700;color:#059669;font-size:0.9rem;" id="local01Pago">$0</span>
                            </div>
                            <!-- Jordán -->
                            <div style="display:flex;gap:0.5rem;align-items:center;background:white;padding:0.5rem;border-radius:8px;border:1px solid #e2e8f0;">
                                <span style="font-size:0.8rem;width:80px;font-weight:600;">🏢 Jordán</span>
                                <input type="number" id="porcentaje_jordan" value="33.4" step="0.1" style="width:60px;padding:0.25rem;border:1px solid #cbd5e1;border-radius:4px;text-align:center;font-size:0.85rem;" oninput="ajustarDistribucionPorPorcentaje()">
                                <span style="font-size:0.85rem;">%</span>
                                <span style="flex:1;text-align:right;font-weight:700;color:#059669;font-size:0.9rem;" id="jordanPago">$0</span>
                            </div>
                        </div>
                        <div id="msgAvisoDistribucion" style="margin-top:0.5rem;font-size:0.7rem;color:#64748b;text-align:center;">Puedes ajustar los porcentajes manualmente según la capacidad de cada tienda.</div>
                    </div>

                    <div style="display:flex;gap:0.75rem;">
                        <button onclick="document.getElementById('modalPagoDeuda').remove()"
                                style="flex:1;padding:0.875rem;border:2px solid #e2e8f0;background:white;border-radius:10px;font-weight:600;cursor:pointer;color:#64748b;">
                            Cancelar
                        </button>
                        <button onclick="confirmarPagoDeuda('${id}')"
                                style="flex:1;padding:0.875rem;border:none;background:linear-gradient(135deg,#10b981,#059669);color:white;border-radius:10px;font-weight:700;cursor:pointer;">
                            ✅ Registrar Pago
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.getElementById('montoPagoDeuda').focus();
        document.getElementById('montoPagoDeuda').select();

        // Calcular porcentajes iniciales
        calcularPorcentajesLocales();

    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando deuda:', error);
        showToast('Error al cargar deuda', 'error');
    }
}

window.calcularPorcentajesLocales = function () {
    const monto = parseFloat(document.getElementById('montoPagoDeuda')?.value) || 0;
    const pAlcala = parseFloat(document.getElementById('porcentaje_alcala')?.value) || 0;
    const pLocal01 = parseFloat(document.getElementById('porcentaje_local01')?.value) || 0;
    const pJordan = parseFloat(document.getElementById('porcentaje_jordan')?.value) || 0;

    const totalPerc = pAlcala + pLocal01 + pJordan;
    const labelTotal = document.getElementById('labelTotalPorcentaje');
    if (labelTotal) {
        labelTotal.textContent = totalPerc.toFixed(1) + '%';
        labelTotal.style.color = Math.abs(totalPerc - 100) < 0.2 ? '#059669' : '#dc2626';
    }

    const valAlcala = Math.round(monto * (pAlcala / 100));
    const valLocal01 = Math.round(monto * (pLocal01 / 100));
    const valJordan = Math.round(monto * (pJordan / 100));

    if (document.getElementById('alcalaPago')) document.getElementById('alcalaPago').textContent = '$' + formatearPrecio(valAlcala);
    if (document.getElementById('local01Pago')) document.getElementById('local01Pago').textContent = '$' + formatearPrecio(valLocal01);
    if (document.getElementById('jordanPago')) document.getElementById('jordanPago').textContent = '$' + formatearPrecio(valJordan);
};

window.ajustarDistribucionPorPorcentaje = function () {
    // Al cambiar un porcentaje, simplemente recalculamos los montos en base al monto total actual
    window.calcularPorcentajesLocales();
};

async function confirmarPagoDeuda(id) {
    const monto = parseFloat(document.getElementById('montoPagoDeuda')?.value);
    const pAlcala = parseFloat(document.getElementById('porcentaje_alcala')?.value) || 0;
    const pLocal01 = parseFloat(document.getElementById('porcentaje_local01')?.value) || 0;
    const pJordan = parseFloat(document.getElementById('porcentaje_jordan')?.value) || 0;

    const totalPerc = pAlcala + pLocal01 + pJordan;
    if (Math.abs(totalPerc - 100) > 0.5) {
        if (!confirm(`La distribución total es de ${totalPerc.toFixed(1)}%. Se recomienda que sea 100%. ¿Deseas continuar de todos modos?`)) {
            return;
        }
    }

    if (!monto || isNaN(monto) || monto <= 0) {
        showToast('Ingresa un monto válido', 'warning');
        return;
    }

    try {
        const { data: deuda } = await supabaseClient
            .from('deudas_negocio')
            .select('*')
            .eq('id', id)
            .single();

        const nuevoSaldo = Math.max(0, (deuda.saldo_actual || 0) - monto);

        // Calcular valores para la nota
        const vA = Math.round(monto * (pAlcala / 100));
        const vL = Math.round(monto * (pLocal01 / 100));
        const vJ = Math.round(monto * (pJordan / 100));
        const desgloseNota = `Distribución: Alcalá: $${formatearPrecio(vA)} (${pAlcala}%), Local 01: $${formatearPrecio(vL)} (${pLocal01}%), Jordán: $${formatearPrecio(vJ)} (${pJordan}%)`;

        await supabaseClient.from('pagos_deuda_negocio').insert({
            deuda_id: id,
            monto: monto,
            fecha_pago: new Date().toISOString().split('T')[0],
            notas: desgloseNota
        });

        await supabaseClient.from('deudas_negocio').update({
            saldo_actual: nuevoSaldo,
            estado: nuevoSaldo === 0 ? 'CERRADO' : 'ABIERTO'
        }).eq('id', id);

        document.getElementById('modalPagoDeuda')?.remove();
        showToast('✅ Pago registrado correctamente', 'success');
        cargarDeudasNegocio();

    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error registrando pago:', error);
        showToast('Error al registrar pago: ' + error.message, 'error');
    }
}

window.confirmarPagoDeuda = confirmarPagoDeuda;

// CRÉDITOS MOTERO - NO TOCAR - SOLO SE CREAN DESDE TIENDA
async function cargarCreditos() {
    const tbody = document.getElementById('tbodyCreditos');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center">Cargando...</td></tr>';

    try {
        const { data: todosCreditos, error: errTodos } = await supabaseClient
            .from('creditos_motero')
            .select('*, clientes_credito(*)')
            .order('created_at', { ascending: false });

        if (errTodos) throw errTodos;

        const hoy = new Date();
        const creditos = (todosCreditos || []).map(c => {
            // Lógica de Mora Automática (Si han pasado > 30 días del último pago o inicio y tiene saldo)
            if (c.saldo_pendiente > 0 && c.estado !== 'pagado' && c.estado !== 'cerrado') {
                const fechaRef = new Date(c.ultimo_pago_fecha || c.fecha_inicio || c.created_at);
                const diffDias = Math.floor((hoy - fechaRef) / (1000 * 60 * 60 * 24));

                if (diffDias > 30 && c.estado !== 'mora') {
                    c.estado = 'mora';
                    // Actualización silenciosa en Supabase
                    supabaseClient.from('creditos_motero').update({ estado: 'mora' }).eq('id', c.id).then();
                }
            }
            return c;
        });

        const normalizar = (estado) => (estado || '').toLowerCase().trim();
        const esActivo = (estado) => ['activo', 'abierto'].includes(normalizar(estado));
        const esMora = (estado) => normalizar(estado) === 'mora';
        const esPagado = (estado) => ['pagado', 'cerrado'].includes(normalizar(estado));

        // Stats
        const activosCount = creditos.filter(c => esActivo(c.estado)).length;
        const saldoTotal = creditos.filter(c => !esPagado(c.estado)).reduce((sum, c) => sum + parseFloat(c.saldo_pendiente || 0), 0);
        const moraCount = creditos.filter(c => esMora(c.estado)).length;
        const pagadosCount = creditos.filter(c => esPagado(c.estado)).length;

        if (document.getElementById('creditosActivos')) document.getElementById('creditosActivos').textContent = activosCount;
        if (document.getElementById('creditosSaldoTotal')) document.getElementById('creditosSaldoTotal').textContent = '$' + formatearPrecio(saldoTotal);
        if (document.getElementById('creditosMora')) document.getElementById('creditosMora').textContent = moraCount;
        if (document.getElementById('creditosPagados')) document.getElementById('creditosPagados').textContent = pagadosCount;

        // Filtro y Búsqueda
        let estadoFiltro = document.getElementById('creditosEstadoFiltro')?.value || '';
        let queryBusqueda = document.getElementById('creditosBuscar')?.value.toLowerCase().trim() || '';

        let datosFiltrados = creditos;

        if (estadoFiltro) {
            if (estadoFiltro === 'activo') datosFiltrados = datosFiltrados.filter(c => esActivo(c.estado));
            else if (estadoFiltro === 'mora') datosFiltrados = datosFiltrados.filter(c => esMora(c.estado));
            else if (estadoFiltro === 'pagado') datosFiltrados = datosFiltrados.filter(c => esPagado(c.estado));
        }

        if (queryBusqueda) {
            datosFiltrados = datosFiltrados.filter(c => {
                const cliente = c.clientes_credito;
                const nombre = (cliente?.nombres + ' ' + (cliente?.apellidos || '')).toLowerCase() || (c.notas || '').toLowerCase();
                const cedula = (cliente?.cedula || cliente?.identificacion || '').toLowerCase() || (c.notas || '').toLowerCase();
                return nombre.includes(queryBusqueda) || cedula.includes(queryBusqueda);
            });
        }

        if (tbody) {
            if (datosFiltrados.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" class="text-center">No se encontraron créditos</td></tr>';
                return;
            }

            tbody.innerHTML = datosFiltrados.map(c => {
                const cliente = c.clientes_credito;
                let nombre = 'Sin cliente';
                let cedula = '-';
                let telefono = '';
                let tienda = c.local_origen || 'N/A';

                if (cliente) {
                    nombre = `${cliente.nombres} ${cliente.apellidos || ''}`;
                    cedula = cliente.cedula || cliente.identificacion || '-';
                    telefono = cliente.telefono || '';
                } else if (c.notas) {
                    const matchNombre = c.notas.match(/Crédito:\s*([^|]+)/i);
                    const matchCC = c.notas.match(/CC:\s*([^|]+)/i);
                    const matchTel = c.notas.match(/Tel:\s*(\d+)/i);
                    if (matchNombre) nombre = matchNombre[1].trim();
                    if (matchCC) cedula = matchCC[1].trim();
                    if (matchTel) telefono = matchTel[1].trim();
                }

                const rowStyle = esPagado(c.estado) ? 'background:#f0fdf4;' : (esMora(c.estado) ? 'background:#fef2f2;' : '');
                const estadoBadge = esPagado(c.estado) ? 'background:#10b981;color:white;' : (esMora(c.estado) ? 'background:#ef4444;color:white;' : 'background:#f59e0b;color:white;');

                // Mensajes de WhatsApp
                let msgWA = '';
                let tipWA = '';
                if (esPagado(c.estado)) {
                    msgWA = `🌟 ¡Hola ${nombre.split(' ')[0]}! 🏍️\n\nEn **MOTEROS SPORT LINE** valoramos tu compromiso y te agradecemos por ser un excelente cliente. 🙌\n\nDuebido a tu impecable historial de pagos, nos complace informarte que ¡tienes disponible un **NUEVO CRÉDITO** para que sigas rodando con lo mejor! 🚀\n\n¡Te esperamos en nuestras sedes para estrenar hoy mismo! 🫶\n\n📲 Contáctanos al 311 340 8416\n¡Gracias por ser parte de nuestra familia! 🙌`;
                    tipWA = 'Ofrecer nuevo crédito';
                } else {
                    msgWA = `📌 Recordatorio MOTEROS SPORT LINE 🏍️\n\nEstimad@ ${nombre}, te recordamos que tienes un saldo pendiente con Nosotros 😁 Realiza tus abonos para seguir disfrutando de todos nuestros beneficios 🫶\n\nSi ya realizaste el pago, por favor ignora este mensaje. 🤗\n📲Para más información contáctanos al 311 340 8416\n\n¡Gracias por ser parte de la familia MOTEROS SPORT LINE! 🙌\n\nAtt.: Área de cartera.`;
                    tipWA = 'Enviar recordatorio de pago';
                }

                return `<tr style="${rowStyle}">
                    <td><strong>${nombre}</strong></td>
                    <td>${cedula}</td>
                    <td>${telefono || '-'}</td>
                    <td>$${formatearPrecio(c.monto_total)}</td>
                    <td><strong style="color:${c.saldo_pendiente > 0 ? '#dc2626' : '#16a34a'}">$${formatearPrecio(c.saldo_pendiente)}</strong></td>
                    <td>${tienda}</td>
                    <td><span class="badge badge-info">${c.cuotas_pagadas || 0}/${c.numero_cuotas || 1}</span></td>
                    <td><span style="${estadoBadge}padding:0.2rem 0.6rem;border-radius:1rem;font-size:0.75rem;">${(c.estado || 'activo').toUpperCase()}</span></td>
                    <td style="white-space:nowrap;">
                        <button onclick="editarNombreCredito('${c.id}', '${nombre.replace(/'/g, "\\'")}')" class="btn btn-sm btn-info" title="Editar nombre de cliente">✏️</button>
                        <button onclick="verDetalleCredito('${c.id}')" class="btn btn-sm btn-secondary" title="Ver detalle e imprimir">👁️</button>
                        ${c.saldo_pendiente > 0 ? `<button onclick="registrarPagoCredito('${c.id}')" class="btn btn-sm btn-success" title="Registrar abono">💰</button>` : ''}
                        ${telefono ? `<a href="https://wa.me/57${telefono.replace(/\D/g, '')}?text=${encodeURIComponent(msgWA)}" target="_blank" class="btn btn-sm" style="background:#25D366;color:white;" title="${tipWA}">📱</a>` : ''}
                    </td>
                </tr>`;
            }).join('');
        }
    } catch (e) {
        console.error('Error:', e);
        showToast('Error al cargar créditos', 'error');
    }
}
window.cargarCreditos = cargarCreditos;

async function editarNombreCredito(id, nombreActual) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modalEditarNombre';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);transition:all 0.3s ease;';

    modal.innerHTML = `
        <div class="modal-content" style="width:90%;max-width:400px;background:white;border-radius:1.5rem;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);overflow:hidden;animation:modalIn 0.3s ease-out;">
            <div class="modal-header" style="padding:1.5rem;background:linear-gradient(135deg, #1e293b, #334155);color:white;display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;font-size:1.25rem;">✏️ Editar Nombre</h3>
                <button onclick="document.getElementById('modalEditarNombre').remove()" style="background:none;border:none;color:white;font-size:1.5rem;cursor:pointer;line-height:1;">&times;</button>
            </div>
            <div class="modal-body" style="padding:1.5rem;">
                <div class="form-group" style="margin-bottom:0;">
                    <label style="display:block;margin-bottom:0.75rem;font-weight:600;color:#475569;">Nombre del Cliente</label>
                    <input type="text" id="inputNuevoNombre" class="form-control" value="${nombreActual}" 
                        style="width:100%;padding:0.875rem;border:2px solid #e2e8f0;border-radius:0.75rem;font-size:1rem;transition:border-color 0.2s;"
                        onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'">
                </div>
            </div>
            <div class="modal-footer" style="padding:1.5rem;background:#f8fafc;display:flex;gap:1rem;">
                <button id="btnGuardarNombre" class="btn btn-primary" style="flex:2;padding:0.875rem;border-radius:0.75rem;font-weight:600;display:flex;align-items:center;justify-content:center;gap:0.5rem;">
                    <span>✓</span> Guardar Cambios
                </button>
                <button onclick="document.getElementById('modalEditarNombre').remove()" class="btn btn-secondary" style="flex:1;padding:0.875rem;border-radius:0.75rem;font-weight:600;background:#e2e8f0;color:#475569;border:none;">
                    Cancelar
                </button>
            </div>
        </div>
        <style>
            @keyframes modalIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        </style>
    `;

    document.body.appendChild(modal);
    const input = document.getElementById('inputNuevoNombre');
    input.focus();
    input.select();

    document.getElementById('btnGuardarNombre').onclick = async () => {
        const nuevoNombre = input.value.trim();
        if (!nuevoNombre || nuevoNombre === nombreActual) {
            document.getElementById('modalEditarNombre').remove();
            return;
        }

        const btn = document.getElementById('btnGuardarNombre');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-small"></span> Guardando...';

        try {
            const { data: credito, error: errC } = await supabaseClient
                .from('creditos_motero')
                .select('*, clientes_credito(*)')
                .eq('id', id)
                .single();

            if (errC) throw errC;

            if (credito.cliente_id) {
                const { error: errU } = await supabaseClient
                    .from('clientes_credito')
                    .update({ nombres: nuevoNombre, apellidos: '' })
                    .eq('id', credito.cliente_id);
                if (errU) throw errU;
            } else {
                let notas = credito.notas || '';
                if (notas.includes('Crédito:')) {
                    notas = notas.replace(/Crédito:\s*([^|]+)/i, `Crédito: ${nuevoNombre} `);
                } else {
                    notas = `Crédito: ${nuevoNombre} | ` + notas;
                }
                const { error: errN } = await supabaseClient
                    .from('creditos_motero')
                    .update({ notas: notas })
                    .eq('id', id);
                if (errN) throw errN;
            }

            showToast('Nombre actualizado correctamente', 'success');
            document.getElementById('modalEditarNombre').remove();
            cargarCreditos();
        } catch (e) {
            console.error('Error al editar nombre:', e);
            showToast('Error: ' + e.message, 'error');
            btn.disabled = false;
            btn.innerHTML = '<span>✓</span> Guardar Cambios';
        }
    };
}
window.editarNombreCredito = editarNombreCredito;

function buscarCreditos() {
    cargarCreditos(); // Simplemente recargamos con el filtro del input
}

async function verDetalleCredito(id) {
    try {
        const { data: c, error } = await supabaseClient
            .from('creditos_motero')
            .select('*, clientes_credito(*)')
            .eq('id', id)
            .single();

        if (error) throw error;

        // Cargar pagos
        const { data: pagos } = await supabaseClient
            .from('pagos_credito')
            .select('*')
            .eq('credito_id', id)
            .order('fecha_pago', { ascending: false });

        let clienteNombre = 'Sin cliente';
        let clienteID = '-';
        if (c.clientes_credito) {
            clienteNombre = `${c.clientes_credito.nombres} ${c.clientes_credito.apellidos || ''}`;
            clienteID = c.clientes_credito.identificacion || c.clientes_credito.cedula || '-';
        } else if (c.notas) {
            const mN = c.notas.match(/Crédito:\s*([^|]+)/i);
            const mC = c.notas.match(/CC:\s*([^|]+)/i);
            if (mN) clienteNombre = mN[1].trim();
            if (mC) clienteID = mC[1].trim();
        }

        const modalDiv = document.createElement('div');
        modalDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
        modalDiv.onclick = (e) => { if (e.target === modalDiv) modalDiv.remove(); };

        modalDiv.innerHTML = `
            <div style="background:white;width:90%;max-width:500px;max-height:90vh;overflow-y:auto;border-radius:1rem;display:flex;flex-direction:column;">
                <div style="padding:1.5rem;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
                    <h3 style="margin:0;">👁️ Detalle de Crédito</h3>
                    <button onclick="this.closest('div[style*=\"fixed\"]').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;">&times;</button>
                </div>
                <div id="ticketImprimir" style="padding:2rem;font-family:monospace;font-size:0.9rem;line-height:1.2;">
                    <div style="text-align:center;margin-bottom:1rem;">
                        <img src="https://pbblthbrdkevuyjxyuar.supabase.co/storage/v1/object/public/productos-imagenes/moteros%20logo.jpg" style="width:60px;margin-bottom:0.5rem;">
                        <div style="font-weight:bold;font-size:1.1rem;">MOTEROS SPORT LINE</div>
                        <div>Villavicencio - Meta</div>
                        <div>NIT: 123456789-0</div>
                        <div style="margin-top:0.5rem;border-top:1px dashed #000;padding-top:0.5rem;">BOLETA DE CRÉDITO</div>
                        <div style="font-weight:bold;"># ${c.numero_credito}</div>
                    </div>
                    
                    <div style="margin-bottom:1rem;">
                        <div>CLIENTE: ${clienteNombre}</div>
                        <div>C.C.: ${clienteID}</div>
                        <div>FECHA INICIO: ${new Date(c.fecha_inicio).toLocaleDateString()}</div>
                        <div>TIENDA: ${c.local_origen || 'Principal'}</div>
                    </div>

                    <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:0.5rem 0;margin-bottom:1rem;">
                        <div style="display:flex;justify-content:space-between;">
                            <span>MONTO TOTAL:</span>
                            <span>$${formatearPrecio(c.monto_total)}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span>NRO. CUOTAS:</span>
                            <span>${c.numero_cuotas}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;font-weight:bold;">
                            <span>SALDO PEND.:</span>
                            <span>$${formatearPrecio(c.saldo_pendiente)}</span>
                        </div>
                    </div>

                    <div style="font-weight:bold;text-align:center;margin-bottom:0.5rem;">HISTORIAL DE ABONOS</div>
                    <table style="width:100%;font-size:0.8rem;margin-bottom:1rem;">
                        <thead>
                            <tr style="border-bottom:1px solid #ccc;">
                                <th align="left">Fecha</th>
                                <th align="right">Monto</th>
                                <th align="right">Local</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(pagos || []).length > 0 ? pagos.map(p => `
                                <tr>
                                    <td>${new Date(p.fecha_pago).toLocaleDateString()}</td>
                                    <td align="right">$${formatearPrecio(p.monto_pagado)}</td>
                                    <td align="right">${p.local || 'Admin'}</td>
                                </tr>
                            `).join('') : '<tr><td colspan="3" align="center">Sin abonos registrados</td></tr>'}
                        </tbody>
                    </table>

                    <div style="text-align:center;font-size:0.75rem;margin-top:1.5rem;border-top:1px dashed #000;padding-top:0.5rem;">
                        ¡Gracias por confiar en Nosotros! 😁<br>
                        MOTEROS SPORT LINE
                    </div>
                </div>
                <div style="padding:1.5rem;background:#f8fafc;display:flex;gap:1rem;">
                    <button onclick="imprimirTicketCredito()" style="flex:1;padding:0.75rem;background:#3b82f6;color:white;border:none;border-radius:0.5rem;font-weight:700;cursor:pointer;">🖨️ Imprimir Ticket</button>
                    ${c.saldo_pendiente > 0 ? `<button onclick="this.closest('div[style*=\"fixed\"]').remove(); registrarPagoCredito('${id}')" style="flex:1;padding:0.75rem;background:#10b981;color:white;border:none;border-radius:0.5rem;font-weight:700;cursor:pointer;">💰 Abonar</button>` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(modalDiv);

    } catch (e) {
        console.error(e);
        showToast('Error al ver detalle', 'error');
    }
}

function imprimirTicketCredito() {
    const ticket = document.getElementById('ticketImprimir').innerHTML;
    const ventana = window.open('', 'PRINT', 'height=600,width=400');
    ventana.document.write('<html><head><title>Imprimir Ticket</title>');
    ventana.document.write('<style>body { font-family: monospace; font-size:12px; margin:0; padding:10px; width:300px; }</style>');
    ventana.document.write('</head><body>');
    ventana.document.write(ticket);
    ventana.document.write('</body></html>');
    ventana.document.close();
    ventana.focus();
    setTimeout(() => { ventana.print(); ventana.close(); }, 500);
}


async function registrarPagoCredito(id) {
    try {
        const { data: credito } = await supabaseClient.from('creditos_motero').select('*, clientes_credito(*)').eq('id', id).single();
        if (!credito) { showToast('Crédito no encontrado', 'error'); return; }

        const cliente = credito.clientes_credito;
        const nombreCliente = cliente ? `${cliente.nombres} ${cliente.apellidos || ''}` : 'Cliente';
        const cuotaSugerida = credito.numero_cuotas > 0 ? Math.ceil(credito.saldo_pendiente / (credito.numero_cuotas - credito.cuotas_pagadas)) : credito.saldo_pendiente;

        const modal = document.createElement('div');
        modal.id = 'modalPagoCredito';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
        modal.onclick = function (e) { if (e.target === this) this.remove(); };

        modal.innerHTML = `
            <div style="background:white;border-radius:1rem;max-width:450px;width:90%;padding:2rem;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                    <h3 style="margin:0;color:#1e293b;">💰 Registrar Pago</h3>
                    <button onclick="document.getElementById('modalPagoCredito').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#64748b;">&times;</button>
                </div>

                <div style="background:#f8fafc;padding:1rem;border-radius:0.5rem;margin-bottom:1.5rem;">
                    <p style="margin:0 0 0.5rem;color:#64748b;font-size:0.9rem;">Cliente</p>
                    <p style="margin:0;font-weight:600;color:#1e293b;">${nombreCliente}</p>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;">
                    <div style="background:#fef2f2;padding:1rem;border-radius:0.5rem;text-align:center;">
                        <small style="color:#991b1b;">Saldo Pendiente</small>
                        <p style="margin:0;font-weight:700;font-size:1.2rem;color:#dc2626;">$${formatearPrecio(credito.saldo_pendiente || 0)}</p>
                    </div>
                    <div style="background:#f0fdf4;padding:1rem;border-radius:0.5rem;text-align:center;">
                        <small style="color:#166534;">Cuota Sugerida</small>
                        <p style="margin:0;font-weight:700;font-size:1.2rem;color:#16a34a;">$${formatearPrecio(cuotaSugerida)}</p>
                    </div>
                </div>

                <div style="margin-bottom:1.5rem;">
                    <label style="display:block;font-weight:600;margin-bottom:0.5rem;color:#374151;">Monto a Pagar *</label>
                    <input type="number" id="montoPagoCredito" value="${cuotaSugerida}" min="1" max="${credito.saldo_pendiente}" style="width:100%;padding:1rem;border:2px solid #e5e7eb;border-radius:0.5rem;font-size:1.2rem;font-weight:600;" placeholder="Ingrese el monto">
                </div>

                <div style="display:flex;gap:1rem;">
                    <button onclick="confirmarPagoCredito('${id}')" style="flex:1;padding:1rem;background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;border-radius:0.5rem;font-weight:600;font-size:1rem;cursor:pointer;">
                        ✓ Confirmar Pago
                    </button>
                    <button onclick="document.getElementById('modalPagoCredito').remove()" style="padding:1rem 1.5rem;background:#f1f5f9;color:#374151;border:none;border-radius:0.5rem;font-weight:600;cursor:pointer;">
                        Cancelar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('montoPagoCredito').focus();
    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error:', error);
        showToast('Error al cargar datos del crédito', 'error');
    }
}

async function confirmarPagoCredito(id) {
    const montoInput = document.getElementById('montoPagoCredito');
    const monto = parseFloat(montoInput?.value);

    if (!monto || isNaN(monto) || monto <= 0) {
        showToast('Ingrese un monto válido', 'warning');
        return;
    }

    try {
        const { data: credito } = await supabaseClient.from('creditos_motero').select('*').eq('id', id).single();
        const nuevoSaldo = Math.max(0, (credito.saldo_pendiente || 0) - monto);
        const nuevasCuotasPagadas = (credito.cuotas_pagadas || 0) + 1;

        await supabaseClient.from('pagos_credito').insert({
            credito_id: id,
            numero_cuota: nuevasCuotasPagadas,
            monto_pagado: monto,
            fecha_pago: new Date().toISOString(),
            local: 'Admin'
        });

        await supabaseClient.from('creditos_motero').update({
            saldo_pendiente: nuevoSaldo,
            cuotas_pagadas: nuevasCuotasPagadas,
            ultimo_pago_fecha: new Date().toISOString().split('T')[0],
            estado: nuevoSaldo === 0 ? 'pagado' : 'activo'
        }).eq('id', id);

        document.getElementById('modalPagoCredito').remove();
        showToast(`Pago de $${formatearPrecio(monto)} registrado correctamente`, 'success');
        cargarCreditos();
    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error registrando pago:', error);
        showToast('Error al registrar pago', 'error');
    }
}

function mostrarFormCredito() {
    showToast('Los créditos solo se pueden crear desde el POS de cada tienda para vincularlos correctamente a una venta e inventario.', 'info');
}

// BODEGAS
async function cargarBodegas() {
    const tbody = document.getElementById('tbodyBodegas');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Cargando...</td></tr>';
    try {
        const { data, error } = await supabaseClient.from('inventario_bodega').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay inventario en bodegas</td></tr>'; return; }
        const idsProductos = [...new Set(data.map(d => d.id_producto))];
        const { data: prods } = await supabaseClient.from('productos').select('id_producto, nombre').in('id_producto', idsProductos);
        const productosMap = {}; (prods || []).forEach(p => productosMap[p.id_producto] = p.nombre);
        tbody.innerHTML = data.map(item => `<tr><td>${item.bodega_id || '-'}</td><td>${productosMap[item.id_producto] || item.id_producto}</td><td><strong>${item.cantidad || 0}</strong></td><td>${item.ubicacion || '-'}</td><td><button onclick="moverDeBodega('${item.id}')" class="btn btn-sm btn-secondary">🔄 Mover</button></td></tr>`).join('');
    } catch (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando bodegas:', error); tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error al cargar</td></tr>'; }
}

function cargarBodega() { cargarBodegas(); }
function mostrarFormMovimiento() { showToast('Funcionalidad en desarrollo', 'info'); }

async function moverDeBodega(id) {
    const destino = prompt('¿A qué tienda mover?\n\n1. Alcalá\n2. Local 01\n3. Jordán\n\nIngresa el número:');
    if (!destino || !['1', '2', '3'].includes(destino)) { showToast('Destino no válido', 'warning'); return; }
    const cantidad = prompt('¿Cuántas unidades mover?');
    if (!cantidad || isNaN(cantidad) || parseInt(cantidad) <= 0) { showToast('Cantidad no válida', 'warning'); return; }
    const tablaDestino = destino === '1' ? 'inventario_alcala' : destino === '2' ? 'inventario_01' : 'inventario_jordan';
    const nombreDestino = destino === '1' ? 'Alcalá' : destino === '2' ? 'Local 01' : 'Jordán';
    try {
        const { data: itemBodega } = await supabaseClient.from('inventario_bodega').select('*').eq('id', id).single();
        if (!itemBodega) throw new Error('Item no encontrado');
        if (itemBodega.cantidad < parseInt(cantidad)) { showToast('No hay suficiente stock en bodega', 'error'); return; }
        await supabaseClient.from('inventario_bodega').update({ cantidad: itemBodega.cantidad - parseInt(cantidad), updated_at: new Date().toISOString() }).eq('id', id);
        const { data: invDestino } = await supabaseClient.from(tablaDestino).select('*').eq('id_producto', itemBodega.id_producto);
        if (invDestino && invDestino.length > 0) { await supabaseClient.from(tablaDestino).update({ cantidad: invDestino[0].cantidad + parseInt(cantidad), updated_at: new Date().toISOString() }).eq('id_producto', itemBodega.id_producto); }
        else { await supabaseClient.from(tablaDestino).insert({ id_producto: itemBodega.id_producto, cantidad: parseInt(cantidad), stock_minimo: 3 }); }
        showToast(`${cantidad} unidades movidas a ${nombreDestino}`, 'success');
        cargarBodegas();
    } catch (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error moviendo de bodega:', error); showToast('Error al mover: ' + error.message, 'error'); }
}

// ALIANZAS
async function cargarAlianzas() {
    const tbody = document.getElementById('tbodyAlianzas');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando...</td></tr>';
    try {
        const { data, error } = await supabaseClient.from('alianzas').select('*').order('nombre');
        if (error) throw error;
        if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay alianzas registradas</td></tr>'; return; }
        tbody.innerHTML = data.map(a => `<tr><td><strong>${a.nombre}</strong></td><td>${a.tipo || '-'}</td><td>${a.descripcion || '-'}</td><td>${a.contacto_nombre || '-'}</td><td>${a.es_procesador_pagos ? '✅ Sí' : '❌ No'}</td><td><span class="badge badge-${a.activo ? 'success' : 'danger'}">${a.activo ? 'Activo' : 'Inactivo'}</span></td><td><button onclick="editarAlianza('${a.id}')" class="btn btn-sm btn-secondary">✏️</button></td></tr>`).join('');
    } catch (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando alianzas:', error); tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error al cargar</td></tr>'; }
}

function mostrarFormAlianza() {
    const nombre = prompt('Nombre de la alianza:'); if (!nombre) return;
    const tipo = prompt('Tipo (Financiera, Comercial, Logística):');
    const descripcion = prompt('Descripción:');
    const contacto = prompt('Nombre del contacto:');
    const telefono = prompt('Teléfono de contacto:');
    const esProcesador = confirm('¿Es procesador de pagos?');
    guardarNuevaAlianza(nombre, tipo, descripcion, contacto, telefono, esProcesador);
}

async function guardarNuevaAlianza(nombre, tipo, descripcion, contacto, telefono, esProcesador) {
    try {
        const { error } = await supabaseClient.from('alianzas').insert({ nombre, tipo, descripcion, contacto_nombre: contacto, contacto_telefono: telefono, es_procesador_pagos: esProcesador, activo: true });
        if (error) throw error;
        showToast('Alianza creada correctamente', 'success'); cargarAlianzas();
    } catch (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error guardando alianza:', error); showToast('Error: ' + error.message, 'error'); }
}

async function editarAlianza(id) {
    try {
        const { data, error } = await supabaseClient.from('alianzas').select('*').eq('id', id).single();
        if (error || !data) { showToast('Error al cargar alianza', 'error'); return; }

        const modalContent = `
            <div id="modalEditarAlianza" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;" onclick="if(event.target===this)this.remove()">
                <div style="background:white;border-radius:1rem;max-width:500px;width:90%;max-height:90vh;overflow-y:auto;padding:2rem;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;border-bottom:2px solid #f1f5f9;padding-bottom:1rem;">
                        <h3 style="margin:0;color:#1e293b;">✏️ Editar Alianza</h3>
                        <button onclick="document.getElementById('modalEditarAlianza').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#64748b;">&times;</button>
                    </div>
                    <div style="display:grid;gap:1rem;">
                        <div>
                            <label style="display:block;font-weight:600;margin-bottom:0.5rem;color:#374151;">Nombre *</label>
                            <input type="text" id="editAlianzaNombre" value="${data.nombre || ''}" style="width:100%;padding:0.75rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:1rem;" required>
                        </div>
                        <div>
                            <label style="display:block;font-weight:600;margin-bottom:0.5rem;color:#374151;">Tipo</label>
                            <select id="editAlianzaTipo" style="width:100%;padding:0.75rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:1rem;">
                                <option value="proveedor" ${data.tipo === 'proveedor' ? 'selected' : ''}>Proveedor</option>
                                <option value="financiero" ${data.tipo === 'financiero' ? 'selected' : ''}>Financiero</option>
                                <option value="marketing" ${data.tipo === 'marketing' ? 'selected' : ''}>Marketing</option>
                                <option value="otro" ${data.tipo === 'otro' ? 'selected' : ''}>Otro</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-weight:600;margin-bottom:0.5rem;color:#374151;">Descripción</label>
                            <textarea id="editAlianzaDesc" rows="3" style="width:100%;padding:0.75rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:1rem;resize:vertical;">${data.descripcion || ''}</textarea>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                            <div>
                                <label style="display:block;font-weight:600;margin-bottom:0.5rem;color:#374151;">Contacto</label>
                                <input type="text" id="editAlianzaContacto" value="${data.contacto_nombre || ''}" style="width:100%;padding:0.75rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:1rem;">
                            </div>
                            <div>
                                <label style="display:block;font-weight:600;margin-bottom:0.5rem;color:#374151;">Teléfono</label>
                                <input type="text" id="editAlianzaTelefono" value="${data.contacto_telefono || ''}" style="width:100%;padding:0.75rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:1rem;">
                            </div>
                        </div>
                        <div style="display:flex;gap:1rem;align-items:center;">
                            <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
                                <input type="checkbox" id="editAlianzaProcesador" ${data.es_procesador_pagos ? 'checked' : ''}>
                                <span style="color:#374151;">Es procesador de pagos</span>
                            </label>
                            <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
                                <input type="checkbox" id="editAlianzaActivo" ${data.activo ? 'checked' : ''}>
                                <span style="color:#374151;">Activo</span>
                            </label>
                        </div>
                        <div style="display:flex;gap:1rem;margin-top:1rem;">
                            <button onclick="guardarEdicionAlianza('${id}')" style="flex:1;padding:0.875rem;background:linear-gradient(135deg,#ff6b00,#ff8533);color:white;border:none;border-radius:0.5rem;font-weight:600;cursor:pointer;">
                                💾 Guardar Cambios
                            </button>
                            <button onclick="document.getElementById('modalEditarAlianza').remove()" style="padding:0.875rem 1.5rem;background:#f1f5f9;color:#374151;border:none;border-radius:0.5rem;font-weight:600;cursor:pointer;">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalContent);
    } catch (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error editando alianza:', error); showToast('Error: ' + error.message, 'error'); }
}

async function guardarEdicionAlianza(id) {
    try {
        const nombre = document.getElementById('editAlianzaNombre').value.trim();
        if (!nombre) { showToast('El nombre es requerido', 'warning'); return; }

        const alianzaData = {
            nombre,
            tipo: document.getElementById('editAlianzaTipo').value,
            descripcion: document.getElementById('editAlianzaDesc').value.trim(),
            contacto_nombre: document.getElementById('editAlianzaContacto').value.trim(),
            contacto_telefono: document.getElementById('editAlianzaTelefono').value.trim(),
            es_procesador_pagos: document.getElementById('editAlianzaProcesador').checked,
            activo: document.getElementById('editAlianzaActivo').checked,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabaseClient.from('alianzas').update(alianzaData).eq('id', id);
        if (error) throw error;

        document.getElementById('modalEditarAlianza').remove();
        showToast('Alianza actualizada correctamente', 'success');
        cargarAlianzas();
    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error guardando alianza:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// PROMOCIONES, BLOG, CONFIGURACIÓN, CIERRES, GASTOS
// ═══════════════════════════════════════════════════════════════
async function cargarPromociones() { try { const { data, error } = await supabaseClient.from('promociones').select('*').order('id_promo'); if (error) throw error; promociones = data || []; renderizarPromociones(); } catch (error) { const container = document.getElementById('listaPromociones'); if (container) container.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`; } }
function renderizarPromociones() {
    const container = document.getElementById('listaPromociones');
    if (!container) return;
    if (promociones.length === 0) { container.innerHTML = '<div class="alert alert-info">No hay promociones</div>'; return; }

    container.innerHTML = `
        <div class="card">
            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                <h3>🏷️ Promociones (${promociones.length})</h3>
                <button onclick="renombrarPromosCombo()" class="btn btn-outline-warning btn-sm" title="Convertir a Combos Estrictos">🔄 Validar Combos</button>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr><th>ID</th><th>Nombre</th><th>Descuento</th><th>Productos</th><th>Estado</th><th>Acciones</th></tr>
                    </thead>
                    <tbody>
                        ${promociones.map(p => {
        const numProductos = p.productos_incluidos ? p.productos_incluidos.split(',').filter(x => x.trim()).length : 0;
        return `<tr>
                                <td><code>${p.id_promo}</code></td>
                                <td><strong>${p.nombre || ''}</strong></td>
                                <td><span class="badge badge-danger" style="font-size:1rem;">-${p.descuento || 0}%</span></td>
                                <td><span class="badge badge-primary">${numProductos} productos</span></td>
                                <td><span class="badge ${p.estado === 'Activa' ? 'badge-success' : 'badge-warning'}">${p.estado || 'N/A'}</span></td>
                                <td style="white-space:nowrap;">
                                    <button onclick="editarPromocion('${p.id_promo}')" class="btn btn-secondary btn-sm" title="Editar">✏️</button>
                                    <button onclick="duplicarPromocion('${p.id_promo}')" class="btn btn-primary btn-sm" title="Duplicar">📋</button>
                                    <button onclick="eliminarPromocion('${p.id_promo}')" class="btn btn-danger btn-sm" title="Eliminar">🗑️</button>
                                </td>
                            </tr>`;
    }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}
async function mostrarFormPromocion() {
    ['promocionIdOriginal', 'promocionId', 'promocionNombre', 'promocionDescuento', 'promocionProductos', 'promocionInicio', 'promocionFin', 'promocionLocales'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const est = document.getElementById('promocionEstado'); if (est) est.value = 'Activa';
    const idInput = document.getElementById('promocionId'); if (idInput) idInput.disabled = false;
    document.getElementById('formTituloPromocion').textContent = '➕ Nueva Promoción';
    productosSeleccionadosPromo = [];
    const form = document.getElementById('formPromocion'); if (form) form.style.display = 'flex';

    // Event listeners para actualizar preview en tiempo real
    const nombreInput = document.getElementById('promocionNombre');
    const descuentoInput = document.getElementById('promocionDescuento');
    if (nombreInput) nombreInput.oninput = actualizarPreviewPromo;
    if (descuentoInput) descuentoInput.oninput = actualizarPreviewPromo;

    // Cargar productos para seleccionar
    await cargarProductosParaPromocion();
}
function cancelarFormPromocion() { const form = document.getElementById('formPromocion'); if (form) form.style.display = 'none'; productosSeleccionadosPromo = []; }
async function editarPromocion(id) {
    const promo = promociones.find(p => p.id_promo === id);
    if (!promo) return;
    document.getElementById('promocionIdOriginal').value = promo.id_promo;
    document.getElementById('promocionId').value = promo.id_promo;
    document.getElementById('promocionId').disabled = true;
    document.getElementById('promocionNombre').value = promo.nombre || '';
    document.getElementById('promocionDescuento').value = promo.descuento || '';
    document.getElementById('promocionInicio').value = promo.fecha_inicio || '';
    document.getElementById('promocionFin').value = promo.fecha_fin || '';
    document.getElementById('promocionLocales').value = promo.locales_aplicables || '';
    document.getElementById('promocionEstado').value = promo.estado || 'Activa';
    document.getElementById('formTituloPromocion').textContent = '✏️ Editar Promoción';
    // Cargar productos seleccionados de la promoción
    productosSeleccionadosPromo = promo.productos_incluidos ? promo.productos_incluidos.split(',').filter(p => p.trim()) : [];
    const form = document.getElementById('formPromocion');
    if (form) form.style.display = 'flex';

    // Event listeners para actualizar preview en tiempo real
    const nombreInput = document.getElementById('promocionNombre');
    const descuentoInput = document.getElementById('promocionDescuento');
    if (nombreInput) nombreInput.oninput = actualizarPreviewPromo;
    if (descuentoInput) descuentoInput.oninput = actualizarPreviewPromo;

    // Cargar lista de productos con los seleccionados marcados
    await cargarProductosParaPromocion();
}
async function guardarPromocion() { const idOriginal = document.getElementById('promocionIdOriginal').value; const idPromo = document.getElementById('promocionId').value.trim(); const nombre = document.getElementById('promocionNombre').value.trim(); if (!idPromo || !nombre) { showToast('ID y Nombre son requeridos', 'warning'); return; } const promo = { id_promo: idPromo, nombre, descuento: parseFloat(document.getElementById('promocionDescuento').value) || 0, productos_incluidos: productosSeleccionadosPromo.join(','), fecha_inicio: document.getElementById('promocionInicio').value.trim(), fecha_fin: document.getElementById('promocionFin').value.trim(), locales_aplicables: document.getElementById('promocionLocales').value.trim() || 'Todos', estado: document.getElementById('promocionEstado').value }; try { if (idOriginal) { const { error } = await supabaseClient.from('promociones').update(promo).eq('id_promo', idOriginal); if (error) throw error; showToast('Promoción actualizada'); } else { const { error } = await supabaseClient.from('promociones').insert(promo); if (error) throw error; showToast('Promoción creada'); } cancelarFormPromocion(); await cargarPromociones(); } catch (error) { showToast('Error: ' + error.message, 'error'); } }
async function eliminarPromocion(id) { if (!confirm('¿Eliminar esta promoción?')) return; try { const { error } = await supabaseClient.from('promociones').delete().eq('id_promo', id); if (error) throw error; showToast('Promoción eliminada'); await cargarPromociones(); } catch (error) { showToast('Error: ' + error.message, 'error'); } }

async function duplicarPromocion(id) {
    const promo = promociones.find(p => p.id_promo === id);
    if (!promo) { showToast('Promoción no encontrada', 'error'); return; }

    // Generar nuevo ID
    const nuevoId = `${promo.id_promo}_COPIA_${Date.now().toString().slice(-4)}`;
    const nuevoNombre = `${promo.nombre} (Copia)`;

    const nuevaPromo = {
        id_promo: nuevoId,
        nombre: nuevoNombre,
        descuento: promo.descuento,
        productos_incluidos: promo.productos_incluidos,
        fecha_inicio: '',
        fecha_fin: '',
        locales_aplicables: promo.locales_aplicables,
        estado: 'Inactiva'
    };

    try {
        const { error } = await supabaseClient.from('promociones').insert(nuevaPromo);
        if (error) throw error;
        showToast(`Promoción duplicada: ${nuevoNombre}`, 'success');
        await cargarPromociones();
        // Abrir para editar
        setTimeout(() => editarPromocion(nuevoId), 500);
    } catch (error) {
        showToast('Error al duplicar: ' + error.message, 'error');
    }
}

// Cargar productos para seleccionar en promoción
async function cargarProductosParaPromocion() {
    const container = document.getElementById('listaProductosPromo');
    if (!container) return;
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando productos...</p></div>';

    try {
        if (productos.length === 0) {
            const { data, error } = await supabaseClient.from('productos').select('*').eq('estado', 'Activo').order('nombre');
            if (error) throw error;
            productos = data || [];
        }
        renderizarProductosPromo(productos);
    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando productos:', error);
        container.innerHTML = '<div class="alert alert-danger">Error al cargar productos</div>';
    }
}

function renderizarProductosPromo(lista) {
    const container = document.getElementById('listaProductosPromo');
    if (!container) return;
    if (lista.length === 0) { container.innerHTML = '<p style="padding:2rem;text-align:center;color:#64748b;">No hay productos disponibles</p>'; return; }

    const seleccionados = productos.filter(p => productosSeleccionadosPromo.includes(p.id_producto));
    const valorBusqueda = document.getElementById('buscarProductoPromo')?.value || '';

    // Obtener categorías únicas
    const categorias = [...new Set(productos.filter(p => p.estado === 'Activo').map(p => p.categoria))].filter(Boolean).sort();
    const categoriaActual = document.getElementById('filtroCategoria')?.value || '';

    container.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;overflow:hidden;">
            <!-- Barra de búsqueda y filtros -->
            <div style="padding:1rem;border-bottom:1px solid #e2e8f0;background:white;">
                <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
                    <input type="text" id="buscarProductoPromo" class="form-control" placeholder="🔍 Buscar..." oninput="filtrarProductosPromo()" value="${valorBusqueda}" style="flex:1;min-width:150px;max-width:250px;">
                    <select id="filtroCategoria" class="form-control" onchange="filtrarProductosPromo()" style="min-width:140px;max-width:180px;">
                        <option value="">📁 Todas las categorías</option>
                        ${categorias.map(c => `<option value="${c}" ${c === categoriaActual ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                    <span style="background:${seleccionados.length > 0 ? '#10b981' : '#94a3b8'};color:white;padding:0.5rem 1rem;border-radius:2rem;font-size:0.9rem;font-weight:600;">✅ ${seleccionados.length}</span>
                    ${seleccionados.length > 0 ? `<button onclick="limpiarSeleccionPromo();filtrarProductosPromo();" style="background:#ef4444;color:white;border:none;padding:0.5rem 0.75rem;border-radius:0.5rem;cursor:pointer;font-size:0.85rem;">🗑️</button>` : ''}
                </div>
            </div>

            <!-- Chips de seleccionados -->
            ${seleccionados.length > 0 ? `
            <div style="padding:0.75rem 1rem;background:#fff7ed;border-bottom:1px solid #fed7aa;max-height:90px;overflow-y:auto;">
                <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
                    ${seleccionados.map(p => `
                        <div style="display:inline-flex;align-items:center;gap:0.4rem;background:white;padding:0.3rem 0.6rem;border-radius:2rem;font-size:0.8rem;border:1px solid #fb923c;">
                            <img src="${p.url_imagen || ''}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'">
                            <span style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.nombre}</span>
                            <button onclick="event.stopPropagation();toggleProductoPromo('${p.id_producto}');" style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:1rem;line-height:1;">×</button>
                        </div>
                    `).join('')}
                </div>
            </div>` : ''}

            <!-- Grid de productos (usa todo el espacio) -->
            <div style="flex:1;overflow-y:auto;padding:1rem;display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:0.75rem;align-content:start;">
                ${lista.map(p => {
        const isSelected = productosSeleccionadosPromo.includes(p.id_producto);
        const imgSrc = p.url_imagen || '';
        return `<div onclick="toggleProductoPromo('${p.id_producto}')" style="padding:0.75rem;border:2px solid ${isSelected ? '#ff6b00' : '#e2e8f0'};border-radius:0.75rem;cursor:pointer;background:${isSelected ? '#fff7ed' : 'white'};transition:all 0.15s ease;display:flex;align-items:center;gap:0.75rem;">
                        <div style="width:50px;height:50px;flex-shrink:0;border-radius:0.5rem;overflow:hidden;background:#f1f5f9;display:flex;align-items:center;justify-content:center;">
                            ${imgSrc ? `<img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<span style=\\'font-size:1.5rem;\\'>🏍️</span>'">` : '<span style="font-size:1.5rem;">🏍️</span>'}
                        </div>
                        <div style="flex:1;min-width:0;">
                            <div style="display:flex;align-items:center;gap:0.4rem;">
                                <input type="checkbox" ${isSelected ? 'checked' : ''} style="pointer-events:none;width:16px;height:16px;accent-color:#ff6b00;">
                                <strong style="font-size:0.85rem;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;">${p.nombre}</strong>
                            </div>
                            <p style="font-size:0.75rem;color:#64748b;margin:0.15rem 0 0 0;">${p.marca || '-'}</p>
                            <p style="font-size:0.9rem;color:#ff6b00;margin:0.15rem 0 0 0;font-weight:700;">$${formatearPrecio(p.precio)}</p>
                        </div>
                    </div>`;
    }).join('')}
            </div>

            <!-- Footer -->
            <div style="padding:0.75rem 1rem;background:#f1f5f9;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;">
                <span style="color:#64748b;">Mostrando ${lista.length} productos</span>
                <span style="color:#1e293b;font-weight:600;">Total en promoción: ${seleccionados.length}</span>
            </div>
        </div>
    `;
    actualizarPreviewPromo();
}

function actualizarPreviewPromo() {
    const previewEl = document.getElementById('previewPromoCard');
    if (!previewEl) return;

    const nombre = document.getElementById('promocionNombre')?.value || '';
    const descuento = document.getElementById('promocionDescuento')?.value || '';
    const seleccionados = productos.filter(p => productosSeleccionadosPromo.includes(p.id_producto));

    if (!nombre && !descuento && seleccionados.length === 0) {
        previewEl.innerHTML = '<p style="font-size:0.9rem;color:#64748b;">Completa los datos para ver la vista previa</p>';
        return;
    }

    const primerProducto = seleccionados[0];
    const precioOriginal = primerProducto ? primerProducto.precio : 100000;
    const precioConDescuento = descuento ? Math.round(precioOriginal * (1 - descuento / 100)) : precioOriginal;

    previewEl.innerHTML = `
        <div style="text-align:center;">
            ${nombre ? `<p style="font-weight:700;color:#1e293b;margin-bottom:0.5rem;">${nombre}</p>` : ''}
            ${descuento ? `<span style="background:#ef4444;color:white;padding:0.25rem 0.75rem;border-radius:1rem;font-size:1.1rem;font-weight:700;">-${descuento}%</span>` : ''}
            ${primerProducto ? `
                <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px dashed #e2e8f0;">
                    <p style="font-size:0.8rem;color:#64748b;margin-bottom:0.25rem;">${primerProducto.nombre}</p>
                    <p style="margin:0;">
                        <span style="text-decoration:line-through;color:#94a3b8;font-size:0.9rem;">$${formatearPrecio(precioOriginal)}</span>
                        <span style="color:#10b981;font-weight:700;font-size:1.1rem;margin-left:0.5rem;">$${formatearPrecio(precioConDescuento)}</span>
                    </p>
                </div>
            ` : ''}
            ${seleccionados.length > 1 ? `<p style="font-size:0.75rem;color:#64748b;margin-top:0.5rem;">+${seleccionados.length - 1} productos más</p>` : ''}
        </div>
    `;
}

function filtrarProductosPromo() {
    const busqueda = (document.getElementById('buscarProductoPromo')?.value || '').toLowerCase();
    const categoriaFiltro = document.getElementById('filtroCategoria')?.value || '';
    const filtrados = productos.filter(p =>
        p.estado === 'Activo' &&
        (categoriaFiltro === '' || p.categoria === categoriaFiltro) &&
        ((p.nombre || '').toLowerCase().includes(busqueda) ||
            (p.marca || '').toLowerCase().includes(busqueda) ||
            (p.id_producto || '').toLowerCase().includes(busqueda))
    );
    renderizarProductosPromo(filtrados);
}

function toggleProductoPromo(id) {
    const index = productosSeleccionadosPromo.indexOf(id);
    if (index > -1) { productosSeleccionadosPromo.splice(index, 1); }
    else { productosSeleccionadosPromo.push(id); }
    // Re-renderizar para mostrar cambio
    filtrarProductosPromo();
}
function quitarProductoPromo(id) { const index = productosSeleccionadosPromo.indexOf(id); if (index > -1) { productosSeleccionadosPromo.splice(index, 1); } }
function limpiarSeleccionPromo() { productosSeleccionadosPromo = []; }

// BLOG
async function cargarPosts() { try { const { data, error } = await supabaseClient.from('posts').select('*').order('created_at', { ascending: false }); if (error) throw error; posts = data || []; renderizarPosts(); } catch (error) { const container = document.getElementById('listaPosts'); if (container) container.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`; } }

function obtenerMediaPreview(post) {
    // Si tiene imagen, mostrar imagen
    if (post.imagen_url) {
        return `<img src="${post.imagen_url}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;font-size:3rem;color:#94a3b8;\\'>🖼️</div>'">`;
    }
    // Si tiene video de YouTube, mostrar thumbnail
    if (post.video_url && post.video_url.includes('youtube')) {
        const videoId = post.video_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)?.[1];
        if (videoId) {
            return `<div style="position:relative;width:100%;height:100%;"><img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" style="width:100%;height:100%;object-fit:cover;"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:3rem;">▶️</div></div>`;
        }
    }
    // Si tiene video de TikTok, mostrar ícono de TikTok
    if (post.video_url && post.video_url.includes('tiktok')) {
        return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:linear-gradient(135deg,#000,#25f4ee,#fe2c55);"><span style="font-size:3rem;">🎵</span><span style="color:white;font-weight:bold;margin-top:0.5rem;">TikTok</span></div>`;
    }
    // Sin media
    return '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:3rem;color:#94a3b8;">📝</div>';
}

function renderizarPosts() {
    const grid = document.getElementById('listaPosts');
    if (!grid) return;
    if (posts.length === 0) { grid.innerHTML = '<div class="alert alert-info">No hay publicaciones</div>'; return; }

    grid.innerHTML = posts.map(p => `
        <div class="blog-card" style="background:white; border-radius:1rem; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.05);">
            <div class="blog-card-img" style="height:200px; overflow:hidden; background:#f1f5f9;">
                ${obtenerMediaPreview(p)}
            </div>
            <div style="padding:1.25rem;">
                <h4 style="font-size:1.1rem;font-weight:600;margin-bottom:0.5rem;">${p.titulo}</h4>
                <p style="color:#64748b;font-size:0.9rem;margin-bottom:1rem;">${(p.contenido || '').substring(0, 100)}${p.contenido?.length > 100 ? '...' : ''}</p>
                ${p.video_url ? `<p style="font-size:0.8rem;color:#3b82f6;margin-bottom:0.5rem;">🎬 Tiene video adjunto</p>` : ''}
                <p style="font-size:0.8rem;color:#94a3b8;margin-bottom:1rem;">📅 ${formatearFecha(p.created_at)}</p>
                <div style="display:flex;gap:0.5rem;">
                    <button onclick="editarPost('${p.id}')" class="btn btn-secondary btn-sm">✏️ Editar</button>
                    <button onclick="eliminarPost('${p.id}')" class="btn btn-danger btn-sm">🗑️</button>
                    ${p.video_url ? `<a href="${p.video_url}" target="_blank" class="btn btn-sm" style="background:#3b82f6;color:white;">▶️ Ver</a>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}
function mostrarFormPost() { ['postId', 'postTitulo', 'postContenido', 'postImagenUrl', 'postVideo'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); removerPreview('post'); document.getElementById('formTituloPost').textContent = '➕ Nueva Publicación'; document.getElementById('formPost').style.display = 'block'; }
function cancelarFormPost() { document.getElementById('formPost').style.display = 'none'; removerPreview('post'); }
async function editarPost(id) { try { const { data, error } = await supabaseClient.from('posts').select('*').eq('id', id).single(); if (error || !data) { showToast('Error al cargar post', 'error'); return; } document.getElementById('postId').value = data.id; document.getElementById('postTitulo').value = data.titulo || ''; document.getElementById('postContenido').value = data.contenido || ''; document.getElementById('postImagenUrl').value = data.imagen_url || ''; document.getElementById('postVideo').value = data.video_url || ''; if (data.imagen_url) { const preview = document.getElementById('previewPost'); const container = document.getElementById('previewContainerPost'); if (preview && container) { preview.src = data.imagen_url; container.style.display = 'inline-block'; } } document.getElementById('formTituloPost').textContent = '✏️ Editar Publicación'; document.getElementById('formPost').style.display = 'block'; } catch (err) { showToast('Error: ' + err.message, 'error'); } }
async function guardarPost() { const id = document.getElementById('postId').value; const titulo = document.getElementById('postTitulo').value.trim(); const contenido = document.getElementById('postContenido').value.trim(); if (!titulo || !contenido) { showToast('Título y contenido son requeridos', 'warning'); return; } let imagenUrl = document.getElementById('postImagenUrl').value.trim(); if (archivosTemporal.post) { showToast('Subiendo imagen...', 'info'); const urlSubida = await subirImagen(archivosTemporal.post, 'blog-imagenes'); if (urlSubida) { imagenUrl = urlSubida; archivosTemporal.post = null; } } const post = { titulo, contenido, imagen_url: imagenUrl, video_url: document.getElementById('postVideo').value.trim() }; try { if (id) { post.updated_at = new Date().toISOString(); const { error } = await supabaseClient.from('posts').update(post).eq('id', id); if (error) throw error; showToast('Publicación actualizada'); } else { const { error } = await supabaseClient.from('posts').insert(post); if (error) throw error; showToast('Publicación creada'); } cancelarFormPost(); await cargarPosts(); } catch (error) { showToast('Error: ' + error.message, 'error'); } }
async function eliminarPost(id) { if (!confirm('¿Eliminar esta publicación?')) return; try { const { error } = await supabaseClient.from('posts').delete().eq('id', id); if (error) throw error; showToast('Publicación eliminada'); await cargarPosts(); } catch (error) { showToast('Error: ' + error.message, 'error'); } }

// ═══════════════════════════════════════════════════════════════
// NÓMINA Y GESTIÓN HUMANA
// ═══════════════════════════════════════════════════════════════

async function cargarNomina() {
    const tbody = document.getElementById('tbodyNomina');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando pagos...</td></tr>';

    try {
        const { data, error } = await supabaseClient
            .from('nomina_pagos')
            .select('*, empleados_tienda(nombre)')
            .order('periodo_fin', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay registros de nómina</td></tr>';
        } else {
            tbody.innerHTML = data.map(p => `
                <tr>
                    <td>${formatearFecha(p.periodo_inicio)} - ${formatearFecha(p.periodo_fin)}</td>
                    <td><strong>${p.empleados_tienda?.nombre || 'N/A'}</strong></td>
                    <td>$${formatearPrecio(p.neto_pagar)}</td>
                    <td><span class="badge ${p.estado === 'Pagado' ? 'badge-success' : 'badge-warning'}">${p.estado}</span></td>
                    <td>${p.fecha_pago ? formatearFecha(p.fecha_pago) : '-'}</td>
                    <td>
                        <button onclick="verComprobanteNomina('${p.id}')" class="btn btn-sm btn-secondary">📄</button>
                    </td>
                </tr>
            `).join('');
        }

        // Cargar estadísticas rápidas
        actualizarStatsNomina();
    } catch (error) {
        showToast('Error al cargar nómina: ' + error.message, 'error');
    }
}

async function actualizarStatsNomina() {
    try {
        const { data: empleados } = await supabaseClient.from('empleados_tienda').select('id').eq('activo', true);
        const { data: pagosMes } = await supabaseClient
            .from('nomina_pagos')
            .select('neto_pagar')
            .gte('periodo_fin', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

        const elActivos = document.getElementById('statEmpleadosActivos');
        const elTotal = document.getElementById('statTotalNomina');

        if (elActivos) elActivos.textContent = empleados?.length || 0;
        if (elTotal) {
            const total = pagosMes?.reduce((sum, p) => sum + (p.neto_pagar || 0), 0) || 0;
            elTotal.textContent = '$' + formatearPrecio(total);
        }
    } catch (e) { }
}

async function cargarEventos() {
    const tbody = document.getElementById('tbodyEventos');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando eventos...</td></tr>';

    try {
        // Cargar eventos con personal (sin nested join)
        const { data, error } = await supabaseClient
            .from('eventos_tienda')
            .select('*, evento_personal(*)')
            .order('fecha_inicio', { ascending: false });

        if (error) {
            console.error("Error cargando eventos:", error);
            throw error;
        }

        if (data && data.length > 0 && data[0].evento_personal) {
            // Personal data loaded
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay eventos registrados</td></tr>';
            return;
        }

        // Cargar todos los empleados para mapear nombres
        const { data: empleados } = await supabaseClient
            .from('empleados_tienda')
            .select('id, nombre');

        const empleadosMap = {};
        (empleados || []).forEach(emp => {
            empleadosMap[emp.id] = emp.nombre;
        });

        tbody.innerHTML = data.map(ev => {
            let personal = 'Sin asignar';
            if (ev.evento_personal && ev.evento_personal.length > 0) {
                personal = ev.evento_personal
                    .map(p => empleadosMap[p.empleado_id] || 'Desconocido')
                    .join(', ');
            }

            return `
            <tr>
                <td><strong>${ev.nombre_evento}</strong></td>
                <td>${ev.fecha_inicio ? new Date(ev.fecha_inicio).toLocaleDateString() + ' ' + new Date(ev.fecha_inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</td>
                <td>${ev.fecha_fin ? new Date(ev.fecha_fin).toLocaleDateString() : 'N/A'}</td>
                <td>${ev.ubicación || 'N/A'}</td>
                <td style="font-size:0.85rem;">${personal}</td>
                <td><span class="badge ${ev.estado === 'Finalizado' ? 'badge-danger' : 'badge-success'}">${ev.estado}</span></td>
                <td>
                    <div style="display:flex; gap:0.3rem;">
                        <button class="btn btn-sm btn-outline-info" onclick="editarEvento('${ev.id}')" title="Editar Evento">✏️</button>
                        <button class="btn btn-sm btn-outline-primary" onclick="verRentabilidadEvento('${ev.id}')" title="Ver Rentabilidad">📊</button>
                        ${ev.estado !== 'Finalizado' ? `<button class="btn btn-sm btn-outline-warning" onclick="devolverProductosEvento('${ev.id}')" title="Retornar Mercancía">🔄</button>` : ''}
                        <button class="btn btn-sm btn-outline-secondary" onclick="exportarEventoPDF('${ev.id}')" title="Imprimir Reporte">🖨️</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="eliminarEvento('${ev.id}')" title="Eliminar">🗑️</button>
                    </div>
                </td>
            </tr>
        `}).join('');

        // Actualizar stats
        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();
        document.getElementById('statsEventosMes').textContent = data.filter(e => e.fecha_inicio >= inicioMes).length;

        const ingresosTotales = data.reduce((sum, e) => sum + (e.ganancias || 0), 0);
        document.getElementById('statsIngresosEventos').textContent = '$' + formatearPrecio(ingresosTotales);

    } catch (err) {
        showToast('Error al cargar eventos: ' + err.message, 'error');
    }
}




async function devolverProductosEvento(eventoId) {
    if (!confirm('¿Estás seguro de que deseas retornar el stock actual a sus sedes de origen? Esto finalizará el evento.')) return;

    try {
        showToast('Analizando orígenes y procesando retorno inteligente...', 'info');

        // 1. Obtener TODO el stock de inventario_evento
        const { data: stockEvento, error: errS } = await supabaseClient.from('inventario_evento').select('*');

        if (errS) throw errS;

        if (stockEvento && stockEvento.length > 0) {
            // Historial para saber de dónde vino cada cosa
            const { data: traslados } = await supabaseClient
                .from('movimientos_transferencia')
                .select('id_producto, origen')
                .eq('destino', 'Evento')
                .order('created_at', { ascending: false });

            const origenMap = {};
            (traslados || []).forEach(t => { if (!origenMap[t.id_producto]) origenMap[t.id_producto] = t.origen; });

            for (const item of stockEvento) {
                if (item.cantidad > 0) {
                    let sedeDestino = origenMap[item.id_producto] || 'Alcalá';
                    let tablaDestino = 'inventario_alcala';
                    if (sedeDestino === '01' || sedeDestino === 'Local 01') tablaDestino = 'inventario_01';
                    else if (sedeDestino === 'Jordán') tablaDestino = 'inventario_jordan';
                    else if (sedeDestino === 'Digital') tablaDestino = 'inventario_digital';

                    const { data: stockSede } = await supabaseClient.from(tablaDestino).select('cantidad').eq('id_producto', item.id_producto).single();
                    await supabaseClient.from(tablaDestino).update({
                        cantidad: (stockSede?.cantidad || 0) + item.cantidad,
                        updated_at: new Date().toISOString()
                    }).eq('id_producto', item.id_producto);

                    await supabaseClient.from('movimientos_transferencia').insert({
                        id_producto: item.id_producto,
                        cantidad: item.cantidad,
                        origen: 'Evento',
                        destino: sedeDestino,
                        notas: `Retorno automático al finalizar evento`,
                        usuario: 'Sistema'
                    });
                }
            }

            // 2. Limpiar inventario de evento (Opcional: poner en 0 o borrar)
            await supabaseClient.from('inventario_evento').update({ cantidad: 0 }).neq('id', 0);
        }

        // 3. Marcar evento como finalizado
        await supabaseClient.from('eventos_tienda').update({ estado: 'Finalizado' }).eq('id', eventoId);

        showToast('✅ Productos retornados y evento finalizado correctamente', 'success');
        cargarEventos();
    } catch (err) {
        console.error(err);
        showToast('Error en retorno: ' + err.message, 'error');
    }
}

async function verDetallesEvento(eventoId) {
    try {
        const { data: ev, error } = await supabaseClient
            .from('eventos_tienda')
            .select('*, evento_personal(valor_pactado, empleados_tienda(nombre))')
            .eq('id', eventoId)
            .single();

        if (error) throw error;

        // Calcular ventas reales en ese periodo para ese local 'Evento'
        const { data: ventas, error: errV } = await supabaseClient.from('ventas')
            .select('total')
            .eq('local', 'Evento')
            .gte('created_at', ev.fecha_inicio + 'T00:00:00')
            .lte('created_at', ev.fecha_fin + 'T23:59:59');

        const ingresosVentas = (ventas || []).reduce((sum, v) => sum + (v.total || 0), 0);
        const costoStand = ev.gastos || 0;
        const costoPersonal = (ev.evento_personal || []).reduce((sum, p) => sum + (p.valor_pactado || 0), 0);
        const gastosTotales = costoStand + costoPersonal;
        const utilidad = ingresosVentas - gastosTotales;

        const html = `
            <div id="modalRentabilidad" class="modal-overlay" style="display:flex;">
                <div class="modal" style="max-width:500px;">
                    <h3>📊 Rentabilidad: ${ev.nombre_evento}</h3>
                    <div style="margin: 1.5rem 0; display:grid; gap:1rem;">
                        <div style="display:flex; justify-content:space-between; padding:0.8rem; background:#f0fdf4; border-radius:8px;">
                            <span style="font-weight:600; color:#166534;">Ingresos por Ventas:</span>
                            <span style="font-weight:800; color:#166534;">$${formatearPrecio(ingresosVentas)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:0.5rem;">
                            <span>Costo del Stand:</span>
                            <span style="color:#ef4444;">-$${formatearPrecio(costoStand)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:0.5rem;">
                            <span>Costo de Personal:</span>
                            <span style="color:#ef4444;">-$${formatearPrecio(costoPersonal)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-top:0.5rem; font-size:1.1rem;">
                            <span style="font-weight:700;">Utilidad Neta:</span>
                            <span style="font-weight:800; color:${utilidad >= 0 ? '#10b981' : '#ef4444'};">
                                $${formatearPrecio(utilidad)}
                            </span>
                        </div>
                    </div>
                    <div class="modal-botones">
                        <button class="btn btn-secondary btn-full" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    } catch (err) {
        showToast('Error al cargar detalles: ' + err.message, 'error');
    }
}

async function exportarEventoPDF(eventoId) {
    const { jsPDF } = window.jspdf;
    try {
        const { data: ev, error } = await supabaseClient
            .from('eventos_tienda')
            .select('*, evento_personal(*, empleados_tienda(nombre))')
            .eq('id', eventoId)
            .single();

        if (error) throw error;

        const doc = new jsPDF();
        doc.setFontSize(22);
        doc.text(`Reporte de Evento: ${ev.nombre_evento}`, 20, 20);

        doc.setFontSize(14);
        doc.text(`Ubicación: ${ev.ubicación || 'N/A'}`, 20, 35);
        doc.text(`Periodo: ${ev.fecha_inicio} al ${ev.fecha_fin}`, 20, 42);

        doc.setFontSize(16);
        doc.text("Resumen Financiero", 20, 55);
        doc.setFontSize(12);
        doc.text(`Costo Stand: $${formatearPrecio(ev.gastos || 0)}`, 20, 65);

        const personal = (ev.evento_personal || []).map(p => `${p.empleados_tienda?.nombre}: $${formatearPrecio(p.valor_pactado)}`).join(', ');
        doc.text(`Personal: ${personal}`, 20, 72);

        // Ventas (sería ideal traer el desglose pero aquí ponemos el total)
        const { data: ventas } = await supabaseClient.from('ventas').select('total').eq('local', 'Evento').gte('created_at', ev.fecha_inicio).lte('created_at', ev.fecha_fin);
        const totalVentas = (ventas || []).reduce((s, v) => s + v.total, 0);
        doc.text(`Total Ventas en Evento: $${formatearPrecio(totalVentas)}`, 20, 85);

        doc.save(`Reporte_Evento_${ev.nombre_evento.replace(/\s+/g, '_')}.pdf`);
        showToast('📄 PDF generado con éxito');
    } catch (err) {
        showToast('Error al generar PDF: ' + err.message, 'error');
    }
}


async function cargarComisiones() {
    // Placeholder para futuro desarrollo
    showToast('Módulo de Comisiones en desarrollo', 'info');
}

// (Función antigua eliminada - Se usa la versión nueva definida al final del archivo)

async function cargarEmpleadosAlSelect(selectId) {
    const { data } = await supabaseClient.from('empleados_tienda').select('id, nombre').eq('activo', true);
    const select = document.getElementById(selectId);
    if (select && data) {
        data.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e.id;
            opt.textContent = e.nombre;
            select.appendChild(opt);
        });
    }
}

async function procesarLiquidacion() {
    const empId = document.getElementById('liqEmpleado').value;
    const inicio = document.getElementById('liqInicio').value;
    const fin = document.getElementById('liqFin').value;
    const base = parseFloat(document.getElementById('liqBase').value) || 0;
    const com = parseFloat(document.getElementById('liqComisiones').value) || 0;
    const ded = parseFloat(document.getElementById('liqDeducciones').value) || 0;
    const neto = base + com - ded;

    if (!empId || !inicio || !fin) {
        showToast('Completa los campos obligatorios', 'warning');
        return;
    }

    try {
        const { error } = await supabaseClient.from('nomina_pagos').insert({
            empleado_id: parseInt(empId),
            periodo_inicio: inicio,
            periodo_fin: fin,
            salario_base_periodo: base,
            comisiones: com,
            multas_descuentos: ded,
            neto_pagar: neto,
            estado: 'Pagado',
            fecha_pago: new Date().toISOString(),
            responsable_admin: 'Admin'
        });

        if (error) throw error;

        showToast('Liquidación procesada correctamente', 'success');
        const modal = document.getElementById('modalLiquidarNomina');
        if (modal) modal.remove();
        cargarNomina();

    } catch (err) {
        showToast('Error al procesar pago: ' + err.message, 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════
async function cargarConfiguracion() {
    try {
        const { data, error } = await supabaseClient.from('configuracion_sistema').select('*');
        if (error) throw error;
        const config = (data || []).reduce((acc, item) => { acc[item.clave] = item.valor; return acc; }, {});
        const campos = {
            'configWhatsapp': 'whatsapp',
            'configFacebook': 'facebook',
            'configInstagram': 'instagram',
            'configTiktok': 'tiktok',
            'configEmail': 'email',
            'configTelefono': 'telefono',
            'configDireccion': 'direccion',
            'configLogo': 'logo_url',
            'configNombre': 'nombre_tienda',
            'configSlogan': 'slogan',
            'configStockMinimo': 'stock_minimo',
            'configMoneda': 'moneda',
            'configHorarioAlcala': 'horario_alcala',
            'configHorarioLocal01': 'horario_local01',
            'configHorarioJordan': 'horario_jordan',
            'configAiIndex': 'ai_key_index',
            'configAiTienda': 'ai_key_tienda',
            'configAiAdmin': 'ai_key_admin',
            'configAiPos': 'ai_key_pos',
            'configAiExtra1': 'ai_key_extra1',
            'configAiExtra2': 'ai_key_extra2',
            'configAiExtra3': 'ai_key_extra3'
        };
        Object.entries(campos).forEach(([elId, clave]) => {
            const el = document.getElementById(elId);
            if (el) el.value = config[clave] || '';
        });
        const colorEl = document.getElementById('configColor');
        if (colorEl) colorEl.value = config.color_primary || '#ff6b00';
        if (config.logo_url) {
            const preview = document.getElementById('previewLogo');
            const container = document.getElementById('previewContainerLogo');
            if (preview && container) {
                preview.src = config.logo_url;
                container.style.display = 'inline-block';
            }
        }
        cargarEmpleados();
        cargarMetodosPagoConfig();
        if (typeof cargarLogsIA === 'function') cargarLogsIA();
        if (typeof cargarTelemetriaIA === 'function') cargarTelemetriaIA();
    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando configuración:', error);
    }
}
async function guardarConfiguracion() {
    let logoUrl = document.getElementById('configLogo').value.trim();
    if (archivosTemporal.logo) {
        showToast('Subiendo logo...', 'info');
        const urlSubida = await subirImagen(archivosTemporal.logo, 'configuracion');
        if (urlSubida) {
            logoUrl = urlSubida;
            archivosTemporal.logo = null;
        }
    }
    const configs = [
        { clave: 'whatsapp', valor: document.getElementById('configWhatsapp').value.trim() },
        { clave: 'facebook', valor: document.getElementById('configFacebook').value.trim() },
        { clave: 'instagram', valor: document.getElementById('configInstagram').value.trim() },
        { clave: 'tiktok', valor: document.getElementById('configTiktok').value.trim() },
        { clave: 'email', valor: document.getElementById('configEmail').value.trim() },
        { clave: 'telefono', valor: document.getElementById('configTelefono').value.trim() },
        { clave: 'direccion', valor: document.getElementById('configDireccion').value.trim() },
        { clave: 'logo_url', valor: logoUrl },
        { clave: 'nombre_tienda', valor: document.getElementById('configNombre').value.trim() },
        { clave: 'slogan', valor: document.getElementById('configSlogan').value.trim() },
        { clave: 'color_primary', valor: document.getElementById('configColor').value },
        { clave: 'stock_minimo', valor: document.getElementById('configStockMinimo').value.trim() },
        { clave: 'moneda', valor: document.getElementById('configMoneda').value },
        { clave: 'horario_alcala', valor: document.getElementById('configHorarioAlcala').value.trim() },
        { clave: 'horario_local01', valor: document.getElementById('configHorarioLocal01').value.trim() },
        { clave: 'horario_jordan', valor: document.getElementById('configHorarioJordan').value.trim() },
        { clave: 'ai_key_index', valor: document.getElementById('configAiIndex').value.trim() },
        { clave: 'ai_key_tienda', valor: document.getElementById('configAiTienda').value.trim() },
        { clave: 'ai_key_admin', valor: document.getElementById('configAiAdmin').value.trim() },
        { clave: 'ai_key_pos', valor: document.getElementById('configAiPos').value.trim() },
        { clave: 'ai_key_extra1', valor: document.getElementById('configAiExtra1').value.trim() },
        { clave: 'ai_key_extra2', valor: document.getElementById('configAiExtra2').value.trim() },
        { clave: 'ai_key_extra3', valor: document.getElementById('configAiExtra3').value.trim() }
    ];
    try {
        for (const config of configs) {
            const { error } = await supabaseClient.from('configuracion_sistema').upsert(config, { onConflict: 'clave' });
            if (error) throw error;
        }
        showToast('Configuración guardada');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function cargarLogsIA() {
    const container = document.getElementById('logsIaContainer');
    if (!container) return;

    try {
        const { data, error } = await supabaseClient
            .from('logs_sistema')
            .select('*')
            .eq('tipo', 'error_ia')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<p class="text-muted">No hay errores registrados.</p>';
            return;
        }

        container.innerHTML = data.map(log => `
            <div style="border-bottom: 1px solid #e2e8f0; padding: 0.5rem 0;">
                <span style="color: #64748b; font-size: 0.75rem;">${new Date(log.created_at).toLocaleString()}</span><br>
                <strong style="color: #ef4444;">${log.mensaje || 'Error desconocido'}</strong><br>
                <span style="color: #334155;">Contexto: ${log.contexto || '-'}</span>
            </div>
        `).join('');
    } catch (e) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando logs IA:', e);
        container.innerHTML = '<p class="text-danger">Error al cargar logs.</p>';
    }
}
window.cargarLogsIA = cargarLogsIA;

// CIERRES
// ═══════════════════════════════════════════════════════════════
// CIERRES DE CAJA (NUEVO SISTEMA)
// ═══════════════════════════════════════════════════════════════
let cierreLocalActual = 'alcala';
let cierreFechaActual = new Date().toISOString().split('T')[0];
let cierreDatosGuardados = null; // Para saber si estamos editando

async function cargarCierresCaja() {
    const fechaInput = document.getElementById('fechaCierre');
    if (fechaInput) {
        if (!fechaInput.value) fechaInput.value = cierreFechaActual;
        else cierreFechaActual = fechaInput.value;
    }

    // UI Reset Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const btnActivo = document.getElementById(`tab-cierre-${cierreLocalActual}`);
    if (btnActivo) btnActivo.classList.add('active');

    await cargarCierreFecha();
}

function cambiarTabCierre(local) {
    cierreLocalActual = local;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-cierre-${local}`).classList.add('active');

    // Actualizar título
    const nombreLocal = local === 'local01' ? 'Local 01' :
        local === 'jordan' ? 'Jordán' :
            local === 'digital' ? 'Digital' : 'Alcalá';
    document.getElementById('tituloCierreActual').textContent = `Cierre de Caja - ${nombreLocal}`;

    cargarCierreFecha();
}

async function cargarCierreFecha() {
    cierreFechaActual = document.getElementById('fechaCierre').value;
    if (!cierreFechaActual) return;

    // Resetear formulario
    limpiarFormularioCierre();
    cierreDatosGuardados = null;

    try {
        // 1. Obtener Ventas del Sistema para ese local y fecha
        // Normalizar nombre de local para coincidir con BD ('Alcala', 'Local 01', 'Jordan', 'Digital')
        let nombreLocalBD = 'Alcala';
        if (cierreLocalActual === 'local01') nombreLocalBD = 'Local 01';
        else if (cierreLocalActual === 'jordan') nombreLocalBD = 'Jordan';
        else if (cierreLocalActual === 'digital') nombreLocalBD = 'Digital'; // O 'Web'? Ajustar según BD

        const fechaInicio = cierreFechaActual + 'T00:00:00';
        const fechaFin = cierreFechaActual + 'T23:59:59';

        const { data: ventas, error: errVentas } = await supabaseClient
            .from('ventas')
            .select('*')
            .eq('local', nombreLocalBD)
            .gte('created_at', fechaInicio)
            .lte('created_at', fechaFin);

        if (errVentas) throw errVentas;

        // Calcular totales sistema
        const totalVentas = ventas.reduce((sum, v) => sum + (v.total || 0), 0);
        // Asumimos que 'Efectivo' es el método pago para efectivo esperado
        const efectivoEsperado = ventas
            .filter(v => (v.metodo_pago || '').toLowerCase().includes('efectivo'))
            .reduce((sum, v) => sum + (v.total || 0), 0);

        document.getElementById('totalVentasSistema').textContent = '$' + formatearPrecio(totalVentas);
        document.getElementById('totalVentasSistema').dataset.valor = totalVentas;

        document.getElementById('efectivoSistema').textContent = '$' + formatearPrecio(efectivoEsperado);
        document.getElementById('efectivoSistema').dataset.valor = efectivoEsperado;

        // 2. Obtener Gastos de ese día y local
        // TODO: Si hay módulo de gastos, sumar aquí. Por ahora 0 o lo que guarde el cierre.

        // 3. Buscar si ya existe un cierre guardado
        const { data: cierre, error: errCierre } = await supabaseClient
            .from('cierres_caja')
            .select('*')
            .eq('fecha', cierreFechaActual)
            .eq('local', nombreLocalBD) // Usar nombreLocalBD o el ID si se cambia
            .single();

        if (cierre) {
            cierreDatosGuardados = cierre;
            cargarDatosEnFormulario(cierre);
        } else {
            // Cargar valor base por defecto si existe configuración (pendiente Fase 9)
            document.getElementById('baseCaja').value = '$0'; // O cargar último cierre
        }

        calcularDiferenciaCierre();

    } catch (error) {
        console.error('Error cargando datos cierre:', error);
        showToast('Error cargando datos del cierre', 'error');
    }
}

function limpiarFormularioCierre() {
    const inputs = ['baseCaja', 'efectivoReal', 'totalDigital', 'ventasAddi', 'ventasCredito', 'dineroSobrante'];
    inputs.forEach(id => document.getElementById(id).value = '');
    document.getElementById('observacionesCierre').value = '';
    document.getElementById('gastosRegistrados').textContent = '$0';
    document.getElementById('diferenciaCierre').textContent = '$0';
    document.getElementById('estadoCierreBadge').className = 'badge badge-secondary';
    document.getElementById('estadoCierreBadge').textContent = 'PENDIENTE';
}

function cargarDatosEnFormulario(cierre) {
    document.getElementById('baseCaja').value = formatearMonedaInput(cierre.base_inicial);
    document.getElementById('efectivoReal').value = formatearMonedaInput(cierre.efectivo_real);
    document.getElementById('totalDigital').value = formatearMonedaInput(cierre.total_digital);
    document.getElementById('ventasAddi').value = formatearMonedaInput(cierre.ventas_addi);
    document.getElementById('ventasCredito').value = formatearMonedaInput(cierre.ventas_credito);
    document.getElementById('dineroSobrante').value = formatearMonedaInput(cierre.dinero_sobrante);
    document.getElementById('observacionesCierre').value = cierre.observaciones || '';

    // Gastos si se guardan en el cierre
    document.getElementById('gastosRegistrados').textContent = '$' + formatearPrecio(cierre.gastos_total || 0);
}

function calcularDiferenciaCierre() {
    // Totales Sistema
    const efectivoSistema = parseFloat(document.getElementById('efectivoSistema').dataset.valor || 0);

    // Entradas Formulario
    const base = limpiarMoneda(document.getElementById('baseCaja').value);
    const efectivoReal = limpiarMoneda(document.getElementById('efectivoReal').value);
    const gastos = parseFloat(document.getElementById('gastosRegistrados').textContent.replace(/[^\d.-]/g, '')) || 0;
    const sobrante = limpiarMoneda(document.getElementById('dineroSobrante').value);

    // Formula: (Efectivo Real - Base) + Gastos - Efectivo Esperado Sistema
    // "Efectivo Real" se supone que es todo el billete en caja (Ventas Efectivo + Base)
    // Entonces: Ventas Efectivo Real = Efectivo Real Total - Base

    const ventasEfectivoReal = efectivoReal - base;

    // Diferencia = (Ventas Efectivo Real + Gastos) - Efectivo Sistema
    // Si pagué gastos con efectivo de caja, ese dinero no está, así que lo sumo para "justificarlo"

    const diferencia = (ventasEfectivoReal + gastos) - efectivoSistema; // + sobrante? Sobrante es informativo o suma?

    // Si hay sobrante registrado explícitamente, ¿afecta al cuadre? Depende política.
    // Asumamos que sobrante es dinero que "aparentemente sobra" pero el cuadre matemático es lo que manda.

    const divDif = document.getElementById('diferenciaCierre');
    const badge = document.getElementById('estadoCierreBadge');

    divDif.textContent = '$' + formatearPrecio(diferencia);

    if (Math.abs(diferencia) < 1000) { // Tolerancia pequeña
        divDif.className = 'text-success';
        badge.className = 'badge badge-success';
        badge.textContent = 'CUADRADO';
    } else if (diferencia > 0) {
        divDif.className = 'text-info';
        badge.className = 'badge badge-info';
        badge.textContent = 'SOBRANTE'; // Sobra dinero respecto al sistema
    } else {
        divDif.className = 'text-danger';
        badge.className = 'badge badge-danger';
        badge.textContent = 'FALTANTE';
    }
}

async function guardarCierreCaja() {
    const fecha = cierreFechaActual;
    let nombreLocalBD = 'Alcala';
    if (cierreLocalActual === 'local01') nombreLocalBD = 'Local 01';
    else if (cierreLocalActual === 'jordan') nombreLocalBD = 'Jordan';
    else if (cierreLocalActual === 'digital') nombreLocalBD = 'Digital';

    const datos = {
        fecha: fecha,
        local: nombreLocalBD, // OJO: Asegurar que tabla cierres_caja tenga columna 'local' string o id
        base_inicial: limpiarMoneda(document.getElementById('baseCaja').value),
        efectivo_real: limpiarMoneda(document.getElementById('efectivoReal').value),
        total_digital: limpiarMoneda(document.getElementById('totalDigital').value),
        ventas_addi: limpiarMoneda(document.getElementById('ventasAddi').value),
        ventas_credito: limpiarMoneda(document.getElementById('ventasCredito').value),
        dinero_sobrante: limpiarMoneda(document.getElementById('dineroSobrante').value),
        observaciones: document.getElementById('observacionesCierre').value,
        gastos_total: parseFloat(document.getElementById('gastosRegistrados').textContent.replace(/[^\d.-]/g, '')) || 0,
        estado: document.getElementById('estadoCierreBadge').textContent,
        diferencia: parseFloat(document.getElementById('diferenciaCierre').textContent.replace(/[^\d.-]/g, '')) || 0,
        ventas_sistema: parseFloat(document.getElementById('totalVentasSistema').dataset.valor || 0),
        updated_at: new Date().toISOString()
    };

    // TODO: Validar si tabla de cierres tiene estas columnas. Si no, agregar en migración.
    // Asumiendo migracion_fase2.sql creó tabla cierres_de_caja o similar.
    // Verificando SQL anterior... cierres_caja existe?

    try {
        const { error } = await supabaseClient
            .from('cierres_caja')
            .upsert(datos, { onConflict: 'fecha, local' }); // Requiere constraint unique(fecha, local)

        if (error) throw error;

        showToast('Cierre guardado correctamente', 'success');
        cargarCierreFecha(); // Recargar

    } catch (error) {
        console.error('Error guardando cierre:', error);
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error guardando cierre', error);
        showToast('Error al guardar cierre: ' + error.message, 'error');
    }
}

function formatearMonedaInput(valor) {
    if (!valor && valor !== 0) return '';
    return '$' + formatearPrecio(valor);
}

window.cargarCierresCaja = cargarCierresCaja;
window.cambiarTabCierre = cambiarTabCierre;
window.cargarCierreFecha = cargarCierreFecha;
window.calcularDiferenciaCierre = calcularDiferenciaCierre;
window.guardarCierreCaja = guardarCierreCaja;

async function cargarCierresCaja() {
    const tbody = document.getElementById('tbodyCierres');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="10" class="text-center">Cargando historial...</td></tr>';

    try {
        const localFiltro = document.getElementById('cierresLocalFiltro')?.value || '';
        const fechaFiltro = document.getElementById('cierresFechaFiltro')?.value || '';

        let query = supabaseClient.from('cierres_caja').select('*').order('fecha', { ascending: false });

        if (localFiltro) query = query.eq('local', localFiltro);
        if (fechaFiltro) query = query.eq('fecha', fechaFiltro);

        const { data, error } = await query.limit(50);
        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center">No hay cierres registrados</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(c => {
            const dif = c.diferencia_total || 0;
            const difClase = dif === 0 ? 'text-success' : (Math.abs(dif) < 5000 ? 'text-warning' : 'text-danger');
            const estadoBadge = c.estado === 'cerrado' ? 'badge-success' : 'badge-warning';

            return `
                <tr>
                    <td><strong>${c.numero_cierre || '-'}</strong></td>
                    <td>${c.local}</td>
                    <td>${c.fecha}</td>
                    <td>${c.vendedor || 'Admin'}</td>
                    <td>$${formatearPrecio(c.total_ventas_sistema || 0)}</td>
                    <td>$${formatearPrecio(c.efectivo_contado || 0)}</td>
                    <td>$${formatearPrecio(c.total_gastos_dia || 0)}</td>
                    <td><strong class="${difClase}">$${formatearPrecio(dif)}</strong></td>
                    <td><span class="badge ${estadoBadge}">${(c.estado || 'abierto').toUpperCase()}</span></td>
                    <td>
                        <button onclick="verDetalleCierre('${c.id}')" class="btn btn-sm btn-outline-primary" title="Ver Detalle">👁️</button>
                        <button onclick="editarCierre('${c.id}')" class="btn btn-sm btn-outline-warning" title="Editar Cierre">✏️</button>
                        <button onclick="exportarCierreIndividual('${c.id}')" class="btn btn-sm btn-outline-success" title="Exportar PDF">📄</button>
                    </td>
                </tr>
            `;
        }).join('');

        // Actualizar Estadísticas si existen los elementos
        actualizarCardsCierres(data);

    } catch (error) {
        console.error('Error cargando cierres:', error);
        tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger">Error: ${error.message}</td></tr>`;
    }
}

function actualizarCardsCierres(data) {
    // Calcular ventas por local para los cards superiores
    const ventasAlcala = data.filter(c => c.local === 'Alcala').reduce((sum, c) => sum + (c.total_ventas_sistema || 0), 0);
    const ventas01 = data.filter(c => c.local === 'Local 01').reduce((sum, c) => sum + (c.total_ventas_sistema || 0), 0);
    const ventasJordan = data.filter(c => c.local === 'Jordan').reduce((sum, c) => sum + (c.total_ventas_sistema || 0), 0);
    const ventasDigital = data.filter(c => c.local === 'Digital').reduce((sum, c) => sum + (c.total_ventas_sistema || 0), 0);
    const ventasEventos = data.filter(c => c.local === 'Evento').reduce((sum, c) => sum + (c.total_ventas_sistema || 0), 0);
    const totalDiferencias = data.reduce((sum, c) => sum + (c.diferencia_total || 0), 0);

    const elAlcala = document.getElementById('cierresAlcalaHoy');
    const el01 = document.getElementById('cierres01Hoy');
    const elJordan = document.getElementById('cierresJordanHoy');
    const elDigital = document.getElementById('cierresDigitalHoy');
    const elEventos = document.getElementById('cierresEventosHoy');
    const elDif = document.getElementById('cierresDiferencias');

    if (elAlcala) elAlcala.textContent = '$' + formatearPrecio(ventasAlcala);
    if (el01) el01.textContent = '$' + formatearPrecio(ventas01);
    if (elJordan) elJordan.textContent = '$' + formatearPrecio(ventasJordan);
    if (elDigital) elDigital.textContent = '$' + formatearPrecio(ventasDigital);
    if (elEventos) elEventos.textContent = '$' + formatearPrecio(ventasEventos);
    if (elDif) {
        elDif.textContent = '$' + formatearPrecio(totalDiferencias);
        elDif.style.color = totalDiferencias < 0 ? '#ef4444' : (totalDiferencias > 0 ? '#10b981' : 'inherit');
    }
}

async function guardarCierreCaja() {
    const fecha = cierreFechaActual;
    let nombreLocalBD = 'Alcala';
    if (cierreLocalActual === 'local01') nombreLocalBD = 'Local 01';
    else if (cierreLocalActual === 'jordan') nombreLocalBD = 'Jordan';
    else if (cierreLocalActual === 'digital') nombreLocalBD = 'Digital';

    const { data: { user } } = await supabaseClient.auth.getUser();

    // Obtener valores de sistema del dashboard de cierre (IDs de admin.html)
    const ventasEfectivoSist = parseFloat(document.getElementById('efectivoSistema')?.dataset.valor || 0);
    const ventasTransferSist = parseFloat(document.getElementById('transferenciaSistema')?.dataset.valor || 0);
    const ventasTarjetaSist = parseFloat(document.getElementById('tarjetaSistema')?.dataset.valor || 0);
    const ventasNequiSist = parseFloat(document.getElementById('nequiSistema')?.dataset.valor || 0);
    const ventasDaviSist = parseFloat(document.getElementById('daviplataSistema')?.dataset.valor || 0);
    const ventasAddiSist = parseFloat(document.getElementById('addiSistema')?.dataset.valor || 0);
    const ventasDatafonoSist = parseFloat(document.getElementById('datafonoSistema')?.dataset.valor || 0);
    const totalVentasSist = parseFloat(document.getElementById('totalVentasSistema')?.dataset.valor || 0);

    // Obtener valores contados del formulario (Sincronizado con IDs de POS)
    const efecReal = limpiarMoneda(document.getElementById('efectivoContado')?.value);
    const transContadas = limpiarMoneda(document.getElementById('transferenciaContado')?.value);
    const nequiContado = limpiarMoneda(document.getElementById('nequiContado')?.value);
    const daviplataContado = limpiarMoneda(document.getElementById('daviplataContado')?.value);
    const tarjetaContada = limpiarMoneda(document.getElementById('tarjetaContado')?.value);
    const addiContado = limpiarMoneda(document.getElementById('addiContado')?.value);
    const sistecreditoContado = limpiarMoneda(document.getElementById('sistecreditoContado')?.value);
    const fodegasContado = limpiarMoneda(document.getElementById('fodegasContado')?.value);

    const baseFinal = limpiarMoneda(document.getElementById('montoInicial')?.value);

    const gastosTotal = parseFloat(document.getElementById('gastosRegistrados')?.textContent.replace(/[^\d.-]/g, '')) || 0;
    const diferencia = parseFloat(document.getElementById('diferenciaCierre')?.textContent.replace(/[^\d.-]/g, '')) || 0;
    const estado = document.getElementById('estadoCierreBadge')?.textContent.toLowerCase() === 'cuadrado' ? 'cerrado' : 'abierto';

    const numeroCierre = `C-${cierreLocalActual.toUpperCase().substring(0, 3)}-${Date.now()}`;

    const datos = {
        fecha: fecha,
        local: nombreLocalBD,
        vendedor: user?.email?.split('@')[0] || 'Admin',
        numero_cierre: numeroCierre,
        base_caja: baseFinal,
        ventas_efectivo_sistema: ventasEfectivoSist,
        ventas_transferencia_sistema: ventasTransferSist,
        ventas_tarjeta_sistema: ventasTarjetaSist,
        ventas_nequi_sistema: ventasNequiSist,
        ventas_daviplata_sistema: ventasDaviSist,
        ventas_addi_sistema: ventasAddiSist,
        ventas_datafono_sistema: ventasDatafonoSist,
        total_ventas_sistema: totalVentasSist,
        efectivo_contado: efecReal,
        transferencias_contadas: transContadas,
        addi_contado: addiContado,
        total_gastos_dia: gastosTotal,
        diferencia_total: diferencia,
        estado: estado,
        observaciones: document.getElementById('observacionesCierre')?.value || '',
        dinero_sobrante: limpiarMoneda(document.getElementById('dineroSobrante')?.value),
        updated_at: new Date().toISOString()
    };

    try {
        const { error } = await supabaseClient
            .from('cierres_caja')
            .upsert(datos, { onConflict: 'fecha, local' });

        if (error) throw error;

        showToast('Cierre guardado correctamente', 'success');
        cargarCierreFecha();
        if (typeof cargarCierresCaja === 'function') cargarCierresCaja();

    } catch (error) {
        console.error('Error guardando cierre:', error);
        showToast('Error al guardar cierre: ' + error.message, 'error');
    }
}

async function verDetalleCierre(id) {
    try {
        const { data, error } = await supabaseClient.from('cierres_caja').select('*').eq('id', id).single();
        if (error) throw error;

        const fecha = data.fecha ? new Date(data.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-';
        const difTotal = data.diferencia_total || 0;
        const colorEstado = difTotal === 0 ? '#10b981' : (Math.abs(difTotal) < 10000 ? '#f59e0b' : '#ef4444');

        // Crear modal
        const modal = document.createElement('div');
        modal.id = 'modalDetalleCierre';
        modal.className = 'modal-detalles-overlay';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15, 23, 42, 0.9);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem;';
        modal.onclick = function (e) { if (e.target === this) this.remove(); };

        modal.innerHTML = `
            <div class="modal-detalles-content" style="background:#fff; border-radius:2rem; max-width:1300px; width:98%; max-height:95vh; overflow-y:auto; box-shadow:0 30px 70px -12px rgba(0,0,0,0.6); border:1px solid #e2e8f0; animation: modalAppear 0.4s cubic-bezier(0.16, 1, 0.3, 1);">
                <!-- Header Premium -->
                <div style="background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding:1.5rem 2rem; color:white; display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; z-index:10;">
                    <div>
                        <h2 style="margin:0; font-size:1.4rem; letter-spacing:-0.025em; display:flex; align-items:center; gap:0.75rem;">
                            <span style="background:rgba(255,255,255,0.1); padding:0.5rem; border-radius:0.75rem;">📊</span>
                            Auditoría de Cierre ${data.numero_cierre || ''}
                        </h2>
                        <p style="margin:0.25rem 0 0 0; opacity:0.7; font-size:0.85rem; font-weight:500;">${fecha} • ${data.local}</p>
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        <button onclick="editarCierre('${data.id}')" style="background:rgba(245, 158, 11, 0.2); border:1px solid rgba(245, 158, 11, 0.3); color:#fbbf24; padding:0.5rem 1rem; border-radius:0.75rem; cursor:pointer; font-weight:600; font-size:0.85rem; display:flex; align-items:center; gap:0.5rem; transition:all 0.2s;">
                            ✏️ Editar
                        </button>
                        <button onclick="document.getElementById('modalDetalleCierre').remove()" style="background:rgba(255,255,255,0.1); border:none; color:white; width:36px; height:36px; border-radius:50%; cursor:pointer; font-size:1.2rem; display:flex; align-items:center; justify-content:center; transition:0.2s;">&times;</button>
                    </div>
                </div>

                <div style="padding:2rem;">
                    <!-- Tarjetas de Diferencia (KPIs) -->
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-bottom:2rem;">
                        <div style="background:#f8fafc; padding:1.5rem; border-radius:1.25rem; border:1px solid #e2e8f0; text-align:center; position:relative; overflow:hidden;">
                            <div style="position:absolute; top:0; left:0; width:4px; height:100%; background:${(data.diferencia_efectivo || 0) < 0 ? '#ef4444' : '#10b981'};"></div>
                            <small style="color:#64748b; font-weight:700; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; display:block; margin-bottom:0.5rem;">Diferencia Efectivo</small>
                            <p style="margin:0; font-size:2rem; font-weight:800; letter-spacing:-0.05em; color:${(data.diferencia_efectivo || 0) < 0 ? '#ef4444' : (data.diferencia_efectivo > 0 ? '#10b981' : '#1e293b')};">
                                $${formatearPrecio(data.diferencia_efectivo || 0)}
                            </p>
                        </div>
                        <div style="background:#f8fafc; padding:1.5rem; border-radius:1.25rem; border:1px solid #e2e8f0; text-align:center; position:relative; overflow:hidden;">
                            <div style="position:absolute; top:0; left:0; width:4px; height:100%; background:${(data.diferencia_total || 0) < 0 ? '#ef4444' : '#10b981'};"></div>
                            <small style="color:#64748b; font-weight:700; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; display:block; margin-bottom:0.5rem;">Diferencia Total</small>
                            <p style="margin:0; font-size:2rem; font-weight:800; letter-spacing:-0.05em; color:${(data.diferencia_total || 0) < 0 ? '#ef4444' : (data.diferencia_total > 0 ? '#10b981' : '#1e293b')};">
                                $${formatearPrecio(data.diferencia_total || 0)}
                            </p>
                        </div>
                    </div>

                    <!-- Resumen 3 Columnas (Mirror del POS) -->
                    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:1.5rem; margin-bottom:2rem;">
                        <!-- Bloque Ventas -->
                        <div style="background:#fff7ed; padding:1.5rem; border-radius:1.25rem; border:1px solid #fed7aa; border-left:6px solid #f97316;">
                            <h4 style="margin:0 0 1rem 0; font-size:0.85rem; color:#9a3412; display:flex; align-items:center; gap:0.5rem;">📦 PRODUCTOS</h4>
                            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; font-size:0.9rem;">
                                <span style="color:#64748b;">Subtotal Ventas:</span>
                                <span style="font-weight:700; color:#1e293b;">$${formatearPrecio(data.total_ventas_sistema || 0)}</span>
                            </div>
                        </div>

                        <!-- Bloque Otros Ingresos -->
                        <div style="background:#eff6ff; padding:1.5rem; border-radius:1.25rem; border:1px solid #dbeafe; border-left:6px solid #3b82f6;">
                            <h4 style="margin:0 0 1rem 0; font-size:0.85rem; color:#1e40af; display:flex; align-items:center; gap:0.5rem;">💳 OTROS INGRESOS</h4>
                            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; font-size:0.9rem;">
                                <span style="color:#64748b;">Abonos / Servicios:</span>
                                <span style="font-weight:700; color:#1e293b;">$${formatearPrecio((data.abonos_credito_sistema || 0) + (data.ingresos_servicios_sistema || 0))}</span>
                            </div>
                        </div>

                        <!-- Bloque Egresos -->
                        <div style="background:#fef2f2; padding:1.5rem; border-radius:1.25rem; border:1px solid #fecaca; border-left:6px solid #ef4444;">
                            <h4 style="margin:0 0 1rem 0; font-size:0.85rem; color:#991b1b; display:flex; align-items:center; gap:0.5rem;">💸 EGRESOS</h4>
                            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; font-size:0.9rem;">
                                <span style="color:#64748b;">Total Salidas:</span>
                                <span style="font-weight:700; color:#991b1b;">-$${formatearPrecio(data.total_gastos_dia || 0)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Tabla de Detalles (Comparativa) -->
                    <div style="background:white; border:1px solid #e2e8f0; border-radius:1rem; overflow:hidden; margin-bottom:1.5rem; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
                        <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                            <thead>
                                <tr style="background:#f1f5f9;">
                                    <th style="padding:1rem; text-align:left; color:#475569; font-weight:700; font-size:0.75rem; text-transform:uppercase;">Medio de Pago</th>
                                    <th style="padding:1rem; text-align:right; color:#475569; font-weight:700; font-size:0.75rem; text-transform:uppercase;">Sistema</th>
                                    <th style="padding:1rem; text-align:right; color:#475569; font-weight:700; font-size:0.75rem; text-transform:uppercase;">Contado/Reportado</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom:1px solid #f1f5f9;">
                                    <td style="padding:1rem; font-weight:600; color:#1e293b;">💵 Efectivo</td>
                                    <td style="padding:1rem; text-align:right;">$${formatearPrecio(data.ventas_efectivo_sistema || 0)}</td>
                                    <td style="padding:1rem; text-align:right; font-weight:700; color:#1e293b;">$${formatearPrecio(data.efectivo_contado || 0)}</td>
                                </tr>
                                <tr style="border-bottom:1px solid #f1f5f9;">
                                    <td style="padding:1rem; font-weight:600; color:#1e293b;">🏦 Transferencia / Nequi / Dav</td>
                                    <td style="padding:1rem; text-align:right;">$${formatearPrecio((data.ventas_transferencia_sistema || 0) + (data.ventas_nequi_sistema || 0) + (data.ventas_daviplata_sistema || 0))}</td>
                                    <td style="padding:1rem; text-align:right; font-weight:700;">$${formatearPrecio(data.transferencias_contadas || 0)}</td>
                                </tr>
                                <tr style="border-bottom:1px solid #f1f5f9;">
                                    <td style="padding:1rem; font-weight:600; color:#1e293b;">💳 Tarjeta / Dataf.</td>
                                    <td style="padding:1rem; text-align:right;">$${formatearPrecio((data.ventas_tarjeta_sistema || 0) + (data.ventas_datafono_sistema || 0))}</td>
                                    <td style="padding:1rem; text-align:right; font-weight:700;">$${formatearPrecio(data.tarjetas_contadas || 0)}</td>
                                </tr>
                                <tr style="border-bottom:1px solid #f1f5f9;">
                                    <td style="padding:1rem; font-weight:600; color:#1e293b;">💎 Addi / Sistecrédito</td>
                                    <td style="padding:1rem; text-align:right;">$${formatearPrecio((data.ventas_addi_sistema || 0) + (data.ventas_sistecredito_sistema || 0))}</td>
                                    <td style="padding:1rem; text-align:right; font-weight:700;">$${formatearPrecio((data.addi_contado || 0) + (data.sistecredito_contado || 0))}</td>
                                </tr>
                                <tr style="border-bottom:1px solid #f1f5f9;">
                                    <td style="padding:1rem; font-weight:600; color:#1e293b;">🏍️ Cred. Motero (Ventas)</td>
                                    <td style="padding:1rem; text-align:right;">$${formatearPrecio(data.ventas_credito_motero_sistema || 0)}</td>
                                    <td style="padding:1rem; text-align:right; color:#94a3b8;">-</td>
                                </tr>
                                <tr style="border-bottom:1px solid #f1f5f9;">
                                    <td style="padding:1rem; font-weight:600; color:#3b82f6;">📥 Abonos e Ingresos</td>
                                    <td style="padding:1rem; text-align:right;">$${formatearPrecio((data.abonos_credito_sistema || 0) + (data.ingresos_servicios_sistema || 0))}</td>
                                    <td style="padding:1rem; text-align:right; font-weight:700; color:#3b82f6;">$${formatearPrecio((data.nequi_contado || 0) + (data.daviplata_contado || 0) + (data.transferencias_contadas || 0) + (data.efectivo_contado || 0) - (data.ventas_efectivo_sistema || 0) - (data.ventas_nequi_sistema || 0) - (data.ventas_daviplata_sistema || 0) - (data.ventas_transferencia_sistema || 0))}*</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Observaciones y Detalles Avanzados -->
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem;">
                        <div style="background:#f8fafc; padding:1.5rem; border-radius:1.25rem; border:1px solid #e2e8f0;">
                            <h4 style="margin:0 0 1rem 0; font-size:0.85rem; color:#475569; display:flex; align-items:center; gap:0.5rem;">
                                📝 Observaciones y Desglose
                            </h4>
                            <div style="font-size:0.9rem; color:#1e293b; line-height:1.6;">
                                ${data.observaciones ? data.observaciones.split(' || ').map(part => `<div style="margin-bottom:0.5rem; padding-bottom:0.5rem; border-bottom:1px dashed #e2e8f0; last-child:border-none">${part}</div>`).join('') : '<i style="color:#94a3b8">Sin observaciones registradas.</i>'}
                            </div>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:1rem;">
                            ${data.dinero_sobrante > 0 ? `
                            <div style="background:#fff7ed; padding:1.25rem; border-radius:1rem; border:1px solid #fed7aa;">
                                <h4 style="margin:0 0 0.5rem 0; font-size:0.85rem; color:#9a3412; display:flex; align-items:center; gap:0.5rem;">
                                    💰 Dinero Sobrante
                                </h4>
                                <p style="margin:0; font-size:1.1rem; font-weight:800; color:#c2410c;">$${formatearPrecio(data.dinero_sobrante || 0)}</p>
                                <p style="margin:0.25rem 0 0 0; font-size:0.8rem; opacity:0.8; color:#9a3412;">Motivo: ${data.motivo_sobrante || 'No especificado'}</p>
                            </div>
                            ` : ''}
                            
                            <!-- Resumen de Auditoría Rápida -->
                            <div style="background:#f1f5f9; padding:1.25rem; border-radius:1.25rem; border:1px solid #e2e8f0;">
                                <h4 style="margin:0 0 0.75rem 0; font-size:0.8rem; color:#475569; font-weight:700; text-transform:uppercase;">Auditoría de Efectivo</h4>
                                <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem; font-size:0.85rem;">
                                    <span>Efectivo Contado:</span>
                                    <span style="font-weight:700;">$${formatearPrecio(data.efectivo_contado || 0)}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem; font-size:0.85rem;">
                                    <span>Base Inicial:</span>
                                    <span style="font-weight:600;">$${formatearPrecio(data.monto_inicial || 100000)}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; padding-top:0.4rem; border-top:1px solid #cbd5e1; font-weight:700; font-size:0.9rem; color:#1e293b;">
                                    <span>Diferencia:</span>
                                    <span style="color:${(data.diferencia_efectivo || 0) < 0 ? '#ef4444' : '#10b981'}">$${formatearPrecio(data.diferencia_efectivo || 0)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer Actions -->
                    <div style="margin-top:2.5rem; display:flex; justify-content:flex-end; gap:1rem;">
                        <button onclick="exportarCierreIndividual('${data.id}')" style="background:#10b981; color:white; border:none; padding:0.75rem 1.5rem; border-radius:1rem; cursor:pointer; font-weight:700; display:flex; align-items:center; gap:0.75rem; transition:0.2s;">
                            📄 Descargar Reporte PDF
                        </button>
                        <button onclick="document.getElementById('modalDetalleCierre').remove()" style="background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; padding:0.75rem 1.5rem; border-radius:1rem; cursor:pointer; font-weight:700; transition:0.2s;">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
            <style>
                @keyframes modalAppear {
                    from { opacity: 0; transform: scale(0.95) translateY(-20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            </style>
        `;

        document.body.appendChild(modal);

    } catch (e) {
        console.error(e);
        showToast('Error al cargar detalle: ' + e.message, 'error');
    }
}


async function editarCierre(id) {
    try {
        const { data, error } = await supabaseClient.from('cierres_caja').select('*').eq('id', id).single();
        if (error) throw error;

        const modal = document.createElement('div');
        modal.id = 'modalEditarCierre';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';

        modal.innerHTML = `
            <div style="background:white;border-radius:1rem;max-width:500px;width:90%;padding:2rem;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <h3 style="margin-bottom:1.5rem;">✏️ Corregir Cierre</h3>
                
                <div style="margin-bottom:1rem;">
                    <label style="display:block;margin-bottom:0.5rem;font-weight:600;">Efectivo Contado Real</label>
                    <input type="number" id="editEfectivoContado" value="${data.efectivo_contado || 0}" style="width:100%;padding:0.75rem;border:1px solid #ccc;border-radius:0.5rem;font-size:1.2rem;">
                </div>

                <div style="margin-bottom:1rem;">
                    <label style="display:block;margin-bottom:0.5rem;">Observaciones / Justificación</label>
                    <textarea id="editObservaciones" rows="3" style="width:100%;padding:0.75rem;border:1px solid #ccc;border-radius:0.5rem;">${data.observaciones || ''}</textarea>
                </div>

                <div style="display:flex;gap:1rem;margin-top:2rem;">
                    <button onclick="document.getElementById('modalEditarCierre').remove()" style="flex:1;padding:0.75rem;background:#ccc;border:none;border-radius:0.5rem;cursor:pointer;">Cancelar</button>
                    <button onclick="guardarEdicionCierre('${id}', ${data.base_caja || 0}, ${data.ventas_efectivo_sistema || 0}, ${data.total_ventas_sistema || 0}, ${data.total_gastos_dia || 0})" style="flex:1;padding:0.75rem;background:#3b82f6;color:white;border:none;border-radius:0.5rem;cursor:pointer;font-weight:bold;">Guardar Cambios</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

    } catch (e) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", e);
        showToast('Error al cargar datos para editar', 'error');
    }
}

async function guardarEdicionCierre(id, base, ventasEfecSist, totalVentasSist, gastos) {
    const nuevoEfectivo = parseFloat(document.getElementById('editEfectivoContado').value) || 0;
    const obs = document.getElementById('editObservaciones').value;

    // Recalcular diferencias
    // Diferencia Efectivo = Efectivo Contado - (Base + Ventas Efectivo Sistema - Gastos)
    // NOTA: La lógica original en POS incluía gastos en la resta si se sacaban de caja. Asumimos gastos salen de efectivo.

    const esperadoEfectivo = base + ventasEfecSist - gastos;
    const nuevaDifEfectivo = nuevoEfectivo - esperadoEfectivo;

    // Para diferencia total, necesitamos sumar todos los contados (tarjetas, etc).
    // Como solo editamos efectivo por ahora (lo más común), traemos los otros valores de la BD?
    // Simplificación: Solo actualizamos diferencia efectivo y el campo efectivo_contado.
    // Si queremos actualizar diferencia TOTAL, necesitamos saber cuanto sumaban los otros medios.
    // Haremos una query rápida para obtener el registro actual completo antes de guardar.

    try {
        const { data: current } = await supabaseClient.from('cierres_caja').select('*').eq('id', id).single();

        // Sumar todos los contados que NO son efectivo
        const otrosContados = (current.transferencias_contadas || 0) +
            (current.tarjetas_contadas || 0) +
            (current.daviplata_contado || 0) +
            (current.nequi_contado || 0) +
            (current.addi_contado || 0) +
            (current.datafono_contado || 0) +
            (current.sistecredito_contado || 0) +
            (current.fodegas_contado || 0);

        const nuevoTotalContado = nuevoEfectivo + otrosContados;
        const nuevaDifTotal = nuevoTotalContado - (base + totalVentasSist); // Base + Ventas Totales es lo que debería haber en TOTAL (dinero + papeles)

        const { error } = await supabaseClient.from('cierres_caja').update({
            efectivo_contado: nuevoEfectivo,
            diferencia_efectivo: nuevaDifEfectivo,
            diferencia_total: nuevaDifTotal,
            observaciones: obs,
            updated_at: new Date().toISOString() // Marca de edición
        }).eq('id', id);

        if (error) throw error;

        document.getElementById('modalEditarCierre').remove();
        showToast('✅ Cierre corregido exitosamente', 'success');
        cargarCierresCaja(); // Recargar tabla

    } catch (e) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", e);
        showToast('Error al guardar corrección: ' + e.message, 'error');
    }
}

async function exportarCierres() {
    showToast('Generando reporte de cierres...', 'info');

    try {
        const localFiltro = document.getElementById('cierresLocalFiltro')?.value || '';
        const fechaFiltro = document.getElementById('cierresFechaFiltro')?.value || '';

        let query = supabaseClient.from('cierres_caja').select('*').order('fecha', { ascending: false });

        if (localFiltro) query = query.eq('local', localFiltro);
        if (fechaFiltro) query = query.eq('fecha', fechaFiltro);

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            showToast('No hay datos para exportar con estos filtros', 'warning');
            return;
        }

        const dataExport = data.map(c => ({
            'N° Cierre': c.numero_cierre,
            'Local': c.local,
            'Fecha': c.fecha,
            'Vendedor': c.vendedor,
            'Ventas Sistema': c.total_ventas_sistema,
            'Efectivo Contado': c.efectivo_contado,
            'Total Gastos': c.total_gastos_dia,
            'Diferencia Total': c.diferencia_total,
            'Estado': c.estado?.toUpperCase() || 'ABIERTO',
            'Observaciones': c.observaciones || ''
        }));

        if (window.ReportExporter) {
            window.ReportExporter.toExcel(dataExport, `Cierres_Caja_${cierreLocalActual}_${new Date().toISOString().split('T')[0]}.xlsx`);
            showToast('✅ Reporte exportado con éxito');
        } else {
            console.error('ReportExporter no encontrado');
            showToast('Error: Módulo de exportación no cargado', 'error');
        }

    } catch (error) {
        console.error('Error exportando cierres:', error);
        showToast('Error al exportar reporte: ' + error.message, 'error');
    }
}

async function exportarCierreIndividual(id) {
    showToast('Generando PDF del cierre...', 'info');
    // Esta función podría usar jsPDF para crear un ticket de auditoría profesional
    // Por ahora, redirigimos a una alerta informativa o implementamos un PDF simple
    try {
        const { data, error } = await supabaseClient.from('cierres_caja').select('*').eq('id', id).single();
        if (error) throw error;

        if (window.ReportExporter && window.ReportExporter.toPDF) {
            // Nota: toPDF requiere que el contenido esté en el DOM o sea un objeto estructurado
            // Implementaremos un PDF estructurado si toPDF lo soporta o usaremos TicketPrinter
            if (window.TicketPrinter) {
                const html = `
                    <div style="font-family:monospace; font-size:12px;">
                        <h2 style="text-align:center;">AUDITORÍA DE CIERRE</h2>
                        <hr>
                        <p><strong>REPORTE:</strong> ${data.numero_cierre}</p>
                        <p><strong>FECHA:</strong> ${data.fecha}</p>
                        <p><strong>LOCAL:</strong> ${data.local}</p>
                        <p><strong>VENDEDOR:</strong> ${data.vendedor}</p>
                        <hr>
                        <table style="width:100%;">
                            <tr><td>Ventas Sistema:</td><td style="text-align:right;">$${formatearPrecio(data.total_ventas_sistema)}</td></tr>
                            <tr><td>Efectivo Real:</td><td style="text-align:right;">$${formatearPrecio(data.efectivo_contado)}</td></tr>
                            <tr><td>Gastos:</td><td style="text-align:right;">$${formatearPrecio(data.total_gastos_dia)}</td></tr>
                            <tr style="font-weight:bold;"><td>Diferencia:</td><td style="text-align:right;">$${formatearPrecio(data.diferencia_total)}</td></tr>
                        </table>
                        <hr>
                        <p><strong>Observaciones:</strong><br>${data.observaciones || 'Sin observaciones'}</p>
                        <div style="margin-top:20px; text-align:center;">
                            <p>_______________________<br>Firma Responsable</p>
                        </div>
                    </div>
                 `;
                window.TicketPrinter.print(`Cierre_${data.numero_cierre}`, html);
            } else {
                showToast('TicketPrinter no cargado', 'error');
            }
        } else {
            showToast('Módulo PDF no disponible', 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// GASTOS
let gastosData = [];

async function cargarGastos() {
    cargarProveedoresParaGastos();

    const tbody = document.getElementById('tbodyGastos');
    if (!tbody) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", '❌ No se encontró tbodyGastos'); return; }
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando...</td></tr>';

    try {
        const local = document.getElementById('gastosLocalFiltro')?.value || '';


        let query = supabaseClient.from('gastos_tienda').select('*').order('fecha_gasto', { ascending: false }).limit(100);
        if (local) query = query.eq('local', local);

        const { data, error } = await query;
        if (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", '❌ Error Supabase:', error); throw error; }


        gastosData = data || [];

        // Calcular totales generales y por local
        const totalGastos = gastosData.reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);
        const totalAlcala = gastosData.filter(g => g.local === 'Alcala').reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);
        const total01 = gastosData.filter(g => g.local === '01').reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);
        const totalJordan = gastosData.filter(g => g.local === 'Jordan').reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);
        const totalDigital = gastosData.filter(g => g.local === 'Digital').reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);
        const totalEvento = gastosData.filter(g => g.local === 'Evento').reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);

        // Actualizar tarjetas KPI
        const elTotal = document.getElementById('gastosTotalMes');
        const elAlcala = document.getElementById('gastosAlcala');
        const el01 = document.getElementById('gastos01');
        const elJordan = document.getElementById('gastosJordan');
        const elDigital = document.getElementById('gastosDigital');
        const elEvento = document.getElementById('gastosEvento');

        if (elTotal) elTotal.textContent = '$' + formatearPrecio(totalGastos);
        if (elAlcala) elAlcala.textContent = '$' + formatearPrecio(totalAlcala);
        if (el01) el01.textContent = '$' + formatearPrecio(total01);
        if (elJordan) elJordan.textContent = '$' + formatearPrecio(totalJordan);
        if (elDigital) elDigital.textContent = '$' + formatearPrecio(totalDigital);
        if (elEvento) elEvento.textContent = '$' + formatearPrecio(totalEvento);

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay gastos registrados</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(g => {
            const fecha = g.fecha_gasto ? new Date(g.fecha_gasto).toLocaleDateString('es-CO') : '-';
            return `<tr>
                <td>${fecha}</td>
                <td><strong>${g.local || '-'}</strong></td>
                <td><span style="font-size:0.8rem; background:#f1f5f9; padding:2px 6px; border-radius:4px; border:1px solid #e2e8f0;">${g.categoria || g.tipo || g.clasificacion || g.rubro || 'Sin categoría'}</span></td>
                <td>${g.descripcion || '-'}</td>
                <td>${g.proveedor || '<span style="color:#cbd5e1;">-</span>'}</td>
                <td><strong>$${formatearPrecio(g.monto)}</strong></td>
                <td><span class="badge badge-info">${g.metodo_pago || 'efectivo'}</span></td>
                <td>
                    <div style="display:flex; gap:0.5rem;">
                        <button onclick="editarGasto('${g.id}')" class="btn btn-sm btn-secondary" title="Editar">✏️</button>
                        <button onclick="eliminarGasto('${g.id}')" class="btn btn-sm btn-danger" title="Eliminar">🗑️</button>
                    </div>
                </td>
            </tr>`;
        }).join('');

    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", '❌ Error cargando gastos:', error);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error: ${error.message}</td></tr>`;
        showToast('Error al cargar gastos: ' + error.message, 'error');
    }
}

async function cargarProveedoresParaGastos() {
    try {
        const { data, error } = await supabaseClient.from('proveedores').select('razon_social').eq('activo', true).order('razon_social');
        if (error) throw error;
        const datalist = document.getElementById('listaProveedores');
        if (datalist && data) {
            datalist.innerHTML = data.map(p => `<option value="${p.razon_social}">`).join('');
        }
    } catch (e) {
        console.error('Error cargando proveedores:', e);
    }
}

function mostrarFormGasto() {
    document.getElementById('formGasto').style.display = 'block';
    document.getElementById('formTituloGasto').textContent = '➕ Nuevo Gasto';
    ['gastoId', 'gastoDescripcion', 'gastoMonto', 'gastoProveedor', 'gastoFactura', 'gastoNotas', 'gastoRegistradoPor'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('gastoLocal').value = '';
    document.getElementById('gastoCategoria').value = '';
    document.getElementById('gastoMetodo').value = 'efectivo';
    document.getElementById('gastoFecha').value = new Date().toISOString().split('T')[0];
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarFormGasto() {
    document.getElementById('formGasto').style.display = 'none';
}

async function guardarGasto() {
    const id = document.getElementById('gastoId')?.value;
    const local = document.getElementById('gastoLocal')?.value;
    const descripcion = document.getElementById('gastoDescripcion')?.value || '';
    const montoRaw = document.getElementById('gastoMonto')?.value;
    const monto = parseFloat(montoRaw);

    if (!local || !descripcion || !monto || isNaN(monto)) {
        showToast('Completa los campos obligatorios con valores válidos', 'warning');
        return;
    }

    try {
        const gasto = {
            local,
            descripcion,
            monto,
            metodo_pago: document.getElementById('gastoMetodo')?.value || 'efectivo',
            fecha_gasto: document.getElementById('gastoFecha')?.value || new Date().toISOString().split('T')[0]
        };

        // Esquema Correcto: categoria_id (Integer)
        // Buscamos el ID correspondiente al nombre seleccionado en el HTML
        const categoriaNombre = document.getElementById('gastoCategoria')?.value;
        if (categoriaNombre) {
            // Intentar buscar el ID en la tabla 'categorias_gastos'
            // Nota: Como no tenemos los IDs cargados en el HTML, hacemos una consulta rápida.
            // Optimización futura: Cargar IDs en el <select> al inicio.
            const { data: catData, error: catError } = await supabaseClient
                .from('categorias_gastos')
                .select('id')
                .eq('nombre', categoriaNombre) // Asumiendo que 'nombre' es la columna de texto
                .maybeSingle();

            if (catData?.id) {
                gasto.categoria_id = catData.id;
            } else {
                console.warn(`Categoría "${categoriaNombre}" no encontrada en DB. Guardando en notas.`);
                gasto.notas = (gasto.notas ? gasto.notas + ' ' : '') + `[Categoría: ${categoriaNombre}]`;
                // No enviamos 'categoria' string porque causa error 400
            }
        }

        const proveedor = document.getElementById('gastoProveedor')?.value;
        if (proveedor) gasto.proveedor = proveedor;

        const factura = document.getElementById('gastoFactura')?.value;
        if (factura) gasto.numero_factura_proveedor = factura;

        const registrado = document.getElementById('gastoRegistradoPor')?.value;
        if (registrado) gasto.registrado_por = registrado;

        const notas = document.getElementById('gastoNotas')?.value;
        if (notas) gasto.notas = notas; // Ya podría tener la categoría concatenada



        let res;
        if (id && id.trim() !== '') {
            res = await supabaseClient.from('gastos_tienda').update(gasto).eq('id', id);
        } else {
            res = await supabaseClient.from('gastos_tienda').insert([gasto]);
        }

        if (res.error) throw res.error;

        showToast(id ? '✅ Gasto actualizado' : '✅ Gasto registrado correctamente', 'success');
        cancelarFormGasto();
        await cargarGastos();

    } catch (error) {
        console.error('Error crítico guardando gasto:', error);
        showToast(`❌ Error: ${error.message}${error.details ? ' - ' + error.details : ''}`, 'error');
    }
}

async function eliminarGasto(id) {
    if (!confirm('¿Eliminar este gasto?')) return;


    try {
        const { error } = await supabaseClient.from('gastos_tienda').delete().eq('id', id);
        if (error) throw error;

        showToast('Gasto eliminado', 'success');
        await cargarGastos();
    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", '❌ Error eliminando gasto:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

async function editarGasto(id) {


    const gasto = gastosData.find(g => g.id === id);
    if (!gasto) {
        showToast('Gasto no encontrado', 'error');
        return;
    }

    document.getElementById('formGasto').style.display = 'block';
    document.getElementById('formTituloGasto').textContent = '✏️ Editar Gasto';
    document.getElementById('gastoId').value = gasto.id;
    document.getElementById('gastoLocal').value = gasto.local || '';
    document.getElementById('gastoCategoria').value = gasto.categoria || '';
    document.getElementById('gastoDescripcion').value = gasto.descripcion || '';
    document.getElementById('gastoMonto').value = gasto.monto || '';
    document.getElementById('gastoMetodo').value = gasto.metodo_pago || 'efectivo';
    document.getElementById('gastoProveedor').value = gasto.proveedor || '';
    document.getElementById('gastoFactura').value = gasto.numero_factura_proveedor || '';
    document.getElementById('gastoFecha').value = gasto.fecha_gasto || '';
    document.getElementById('gastoRegistradoPor').value = gasto.registrado_por || '';
    document.getElementById('gastoNotas').value = gasto.notas || '';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function exportarGastosExcel() {
    try {
        if (!window.ReportExporter) {
            showToast('Módulo de exportación no cargado', 'error');
            return;
        }

        const localFiltro = document.getElementById('gastosLocalFiltro')?.value;
        const dataFiltrada = localFiltro ? gastosData.filter(g => g.local === localFiltro) : gastosData;

        if (dataFiltrada.length === 0) {
            showToast('No hay datos para exportar con el filtro seleccionado', 'warning');
            return;
        }

        const dataExport = dataFiltrada.map(g => ({
            'Fecha': g.fecha_gasto || '-',
            'Local': g.local || '-',
            'Categoría': g.categoria || '-',
            'Descripción': g.descripcion || '-',
            'Proveedor': g.proveedor || '-',
            'Factura Prov.': g.numero_factura_proveedor || '-',
            'Monto': g.monto || 0,
            'Método Pago': g.metodo_pago || '-',
            'Registrado Por': g.registrado_por || '-',
            'Notas': g.notas || ''
        }));

        const nombreArchivo = `Gastos_${localFiltro || 'Todos'}_${new Date().toISOString().split('T')[0]}.xlsx`;
        window.ReportExporter.toExcel(dataExport, nombreArchivo);
        showToast('✅ Reporte de gastos exportado');

    } catch (error) {
        console.error('Error exportando gastos:', error);
        showToast('Error al exportar: ' + error.message, 'error');
    }
}
window.exportarGastosExcel = exportarGastosExcel;

// DESTACADOS
async function cargarDestacadosAdmin() { if (productos.length === 0) { await cargarProductos(); } renderizarPanelesDestacados(); }
function renderizarPanelesDestacados() { const productosActivos = productos.filter(p => p.estado === 'Activo'); const destacados = productosActivos.filter(p => p.destacado === true); const disponibles = productosActivos.filter(p => p.destacado !== true); productosDestacadosFiltrados = [...disponibles]; const contadorDisp = document.getElementById('contadorDisponibles'); const contadorAct = document.getElementById('contadorActivos'); const contadorGen = document.getElementById('contadorDestacados'); if (contadorDisp) contadorDisp.textContent = disponibles.length; if (contadorAct) { contadorAct.textContent = `${destacados.length} / ${MAX_DESTACADOS}`; contadorAct.classList.toggle('limite', destacados.length >= MAX_DESTACADOS); } if (contadorGen) contadorGen.textContent = `${destacados.length} de ${MAX_DESTACADOS} destacados`; renderizarProductosDisponibles(productosDestacadosFiltrados, destacados.length >= MAX_DESTACADOS); renderizarDestacadosActivos(destacados); }
// Placeholder pequeño para thumbnails
const PLACEHOLDER_THUMB = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><rect fill="#f1f5f9" width="60" height="60" rx="8"/><text fill="#94a3b8" font-family="system-ui" font-size="10" x="50%" y="50%" text-anchor="middle" dy="0.3em">📦</text></svg>');

function renderizarProductosDisponibles(lista, limiteAlcanzado) {
    const container = document.getElementById('listaProductosDisponibles');
    if (!container) return;
    if (lista.length === 0) { container.innerHTML = `<div class="destacados-empty"><div class="destacados-empty-icon">📦</div><h4>No hay productos disponibles</h4></div>`; return; }
    container.innerHTML = lista.map(p => `<div class="destacado-item" data-id="${p.id}"><img class="destacado-item-img" src="${p.url_imagen || PLACEHOLDER_THUMB}" onerror="this.src='${PLACEHOLDER_THUMB}'" alt="${p.nombre}"><div class="destacado-item-info"><h4>${p.nombre}</h4><p>${p.marca} • ${p.categoria}</p><span class="precio">$${formatearPrecio(p.precio)}</span></div><button class="btn-agregar-destacado" onclick="agregarDestacado('${p.id}')" ${limiteAlcanzado ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>⭐ Agregar</button></div>`).join('');
}
function renderizarDestacadosActivos(destacados) {
    const container = document.getElementById('listaDestacadosActivos');
    if (!container) return;
    if (destacados.length === 0) { container.innerHTML = `<div class="destacados-empty"><div class="destacados-empty-icon">⭐</div><h4>Sin productos destacados</h4></div>`; return; }
    container.innerHTML = destacados.map((p, index) => `<div class="destacado-item destacado-activo" data-id="${p.id}"><span class="destacado-posicion">${index + 1}</span><img class="destacado-item-img" src="${p.url_imagen || PLACEHOLDER_THUMB}" onerror="this.src='${PLACEHOLDER_THUMB}'" alt="${p.nombre}"><div class="destacado-item-info"><h4>${p.nombre}</h4><p>${p.marca} • ${p.categoria}</p><span class="precio">$${formatearPrecio(p.precio)}</span></div><button class="btn-quitar-destacado" onclick="quitarDestacado('${p.id}')">✕ Quitar</button></div>`).join('');
}
function filtrarProductosDestacados() { const input = document.getElementById('buscarDestacado'); const busqueda = (input?.value || '').toLowerCase().trim(); const productosActivos = productos.filter(p => p.estado === 'Activo' && p.destacado !== true); const destacadosCount = productos.filter(p => p.estado === 'Activo' && p.destacado === true).length; if (!busqueda) { productosDestacadosFiltrados = [...productosActivos]; } else { productosDestacadosFiltrados = productosActivos.filter(p => (p.nombre || '').toLowerCase().includes(busqueda) || (p.marca || '').toLowerCase().includes(busqueda) || (p.categoria || '').toLowerCase().includes(busqueda)); } renderizarProductosDisponibles(productosDestacadosFiltrados, destacadosCount >= MAX_DESTACADOS); const contadorDisp = document.getElementById('contadorDisponibles'); if (contadorDisp) contadorDisp.textContent = productosDestacadosFiltrados.length; }
async function agregarDestacado(id) { const destacadosActuales = productos.filter(p => p.estado === 'Activo' && p.destacado === true).length; if (destacadosActuales >= MAX_DESTACADOS) { showToast(`Máximo ${MAX_DESTACADOS} productos destacados`, 'warning'); return; } try { showToast('Agregando a destacados...', 'info'); const { error } = await supabaseClient.from('productos').update({ destacado: true }).eq('id', id); if (error) throw error; const producto = productos.find(p => p.id === id); if (producto) { producto.destacado = true; showToast(`"${producto.nombre}" agregado a destacados ⭐`); } renderizarPanelesDestacados(); } catch (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error agregando destacado:', error); showToast('Error al agregar: ' + error.message, 'error'); } }
async function quitarDestacado(id) { try { showToast('Quitando de destacados...', 'info'); const { error } = await supabaseClient.from('productos').update({ destacado: false }).eq('id', id); if (error) throw error; const producto = productos.find(p => p.id === id); if (producto) { producto.destacado = false; showToast(`"${producto.nombre}" quitado de destacados`); } renderizarPanelesDestacados(); } catch (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error quitando destacado:', error); showToast('Error al quitar: ' + error.message, 'error'); } }

// REPORTES
async function cargarReporteMargen() { const body = document.getElementById('bodyReporte'); if (!body) return; document.getElementById('contenidoReporte').style.display = 'block'; document.getElementById('tituloReporte').textContent = '📊 Margen por Categoría'; body.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>'; try { const { data, error } = await supabaseClient.from('v_margen_categoria').select('*'); if (error) throw error; if (!data || data.length === 0) { body.innerHTML = '<p class="text-center">No hay datos disponibles</p>'; return; } body.innerHTML = `<div class="table-container"><table class="data-table"><thead><tr><th>Categoría</th><th>Productos</th><th>Costo Prom.</th><th>Precio Prom.</th><th>Margen %</th></tr></thead><tbody>${data.map(r => `<tr><td><strong>${r.categoria}</strong></td><td>${r.total_productos}</td><td>$${formatearPrecio(r.costo_promedio)}</td><td>$${formatearPrecio(r.precio_venta_promedio)}</td><td><span class="badge badge-${r.margen_promedio >= 30 ? 'success' : 'warning'}">${r.margen_promedio || 0}%</span></td></tr>`).join('')}</tbody></table></div>`; } catch (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando reporte:', error); body.innerHTML = '<p class="text-danger">Error al cargar el reporte</p>'; } }
async function cargarReporteTop() {
    const body = document.getElementById('bodyReporte');
    if (!body) return;
    document.getElementById('contenidoReporte').style.display = 'block';

    // Título profesional
    const tituloContainer = document.getElementById('tituloReporte');
    tituloContainer.innerHTML = '<i class="fas fa-trophy" style="margin-right:10px; color:#eab308;"></i> Top Productos por Categoría';

    body.innerHTML = '<div class="loading"><div class="spinner"></div><p>Buscando campeones en ventas...</p></div>';

    try {
        // Consultar ventas de los últimos 30 días o histórico
        const { data: ventas, error: errorVentas } = await supabaseClient
            .from('ventas')
            .select('id_producto, nombre_producto, cantidad, total, created_at')
            .order('created_at', { ascending: false }); // Traer todo el historial para ranking global

        if (errorVentas) throw errorVentas;

        if (!ventas || ventas.length === 0) {
            body.innerHTML = `
                <div style="text-align:center; padding:3rem;">
                    <i class="fas fa-box-open" style="font-size:3rem; color:#cbd5e1; margin-bottom:1rem;"></i>
                    <p style="color:#64748b; font-size:1.1rem;">Aún no hay ventas registradas.</p>
                </div>`;
            return;
        }

        // Agrupar ventas por producto
        const ranking = {};

        ventas.forEach(v => {
            const id = v.id_producto;
            if (!id) return;

            if (!ranking[id]) {
                ranking[id] = {
                    id: id,
                    nombre: v.nombre_producto || 'Producto Eliminado',
                    cantidad: 0,
                    total: 0
                };
            }
            ranking[id].cantidad += (v.cantidad || 0);
            ranking[id].total += (v.total || 0);
        });

        // Convertir a array y ordenar por Cantidad vendida
        let topProductos = Object.values(ranking).sort((a, b) => b.cantidad - a.cantidad);

        // Consultar detalles adicionales (categoría, imagen) para los Top 20
        const topIds = topProductos.slice(0, 20).map(p => p.id);

        const { data: detalles, error: errorProd } = await supabaseClient
            .from('productos')
            .select('id, categoria, imagen')
            .in('id', topIds);

        if (!errorProd && detalles) {
            topProductos = topProductos.map(p => {
                const detalle = detalles.find(d => d.id === p.id);
                return {
                    ...p,
                    categoria: detalle ? detalle.categoria : 'Desconocida',
                    imagen: detalle ? detalle.imagen : null
                };
            });
        }

        // Calcular Categoría Líder
        const catStats = {};
        topProductos.forEach(p => {
            if (!catStats[p.categoria]) catStats[p.categoria] = 0;
            catStats[p.categoria] += p.total;
        });
        const topCategoria = Object.keys(catStats).sort((a, b) => catStats[b] - catStats[a])[0];

        // Renderizado
        const productoEstrella = topProductos[0];

        let html = `
            <div style="display:flex; gap:1.5rem; margin-bottom:2rem; align-items:flex-start; flex-wrap:wrap;">
                
                <!-- KPIs -->
                <div style="flex:1; min-width:300px; display:grid; gap:1rem;">
                    <div style="background:linear-gradient(135deg, #fffbeb 0%, #fff 100%); padding:1.5rem; border-radius:12px; border:1px solid #fcd34d; display:flex; align-items:center; gap:1.5rem; box-shadow:0 10px 15px -3px rgba(251, 191, 36, 0.1);">
                        <div style="position:relative;">
                             <img src="${productoEstrella.imagen || 'img/placeholder.jpg'}" 
                                  style="width:80px; height:80px; object-fit:cover; border-radius:12px; border:3px solid white; box-shadow:0 4px 6px rgba(0,0,0,0.1);"
                                  onerror="this.src='https://via.placeholder.com/80?text=Sin+Img'">
                             <div style="position:absolute; -10px; right:-10px; background:#eab308; color:white; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; border:2px solid white;">1</div>
                        </div>
                        <div>
                            <div style="font-size:0.85rem; color:#b45309; font-weight:700; text-transform:uppercase; margin-bottom:0.25rem;">PRODUCTO ESTRELLA</div>
                            <div style="font-size:1.25rem; color:#1e293b; font-weight:800; line-height:1.2;">${productoEstrella.nombre}</div>
                            <div style="margin-top:0.5rem; font-size:0.9rem; color:#78350f;">
                                <i class="fas fa-shopping-cart"></i> ${productoEstrella.cantidad} unidades vendidas
                            </div>
                        </div>
                    </div>

                    <div style="display:flex; gap:1rem;">
                         <div class="kpi-card" style="flex:1; background:#f8fafc; padding:1rem; border-radius:12px; border-left:4px solid #3b82f6; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                            <div style="font-size:0.85rem; color:#64748b; font-weight:600; text-transform:uppercase;">Categoría Líder</div>
                            <div style="font-size:1.4rem; color:#1e293b; font-weight:700; margin-top:0.25rem;">${topCategoria || '-'}</div>
                        </div>
                    </div>
                </div>

                <!-- Gráfica Top 5 -->
                <div style="flex:0 0 400px; background:white; padding:1rem; border-radius:12px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); border:1px solid #e2e8f0;">
                    <h4 style="margin:0 0 1rem 0; color:#475569; font-size:0.9rem;">Top 5 Productos</h4>
                    <div id="chartContainerTop" style="position:relative; height:200px; width:100%;">
                        <canvas id="chartTopProductos"></canvas>
                    </div>
                </div>
            </div>

            <div class="table-container" style="box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); border-radius:8px; overflow:hidden; border:1px solid #e2e8f0;">
                <table class="data-table" style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:#1e293b; color:white;">
                            <th style="padding:12px 16px; text-align:center;">#</th>
                            <th style="padding:12px 16px; text-align:left;">Producto</th>
                            <th style="padding:12px 16px; text-align:left;">Categoría</th>
                            <th style="padding:12px 16px; text-align:center;">Unidades</th>
                            <th style="padding:12px 16px; text-align:right;">Ventas Totales</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${topProductos.map((p, index) => `
                            <tr style="border-bottom:1px solid #e2e8f0; background:${index % 2 === 0 ? 'white' : '#f8fafc'}; transition:background 0.2s;">
                                <td style="padding:12px 16px; text-align:center; font-weight:700; color:${index < 3 ? '#eab308' : '#94a3b8'};">
                                    ${index + 1}
                                </td>
                                <td style="padding:12px 16px;">
                                    <div style="display:flex; align-items:center; gap:12px;">
                                         <img src="${p.imagen || 'img/placeholder.jpg'}" 
                                              style="width:40px; height:40px; object-fit:cover; border-radius:6px; border:1px solid #e2e8f0;"
                                              onerror="this.src='https://via.placeholder.com/40?text=IMG'">
                                         <span style="font-weight:600; color:#334155;">${p.nombre}</span>
                                    </div>
                                </td>
                                <td style="padding:12px 16px;">
                                    <span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:99px; font-size:0.75rem; font-weight:600;">
                                        ${p.categoria}
                                    </span>
                                </td>
                                <td style="padding:12px 16px; text-align:center; font-weight:600; color:#475569;">${p.cantidad}</td>
                                <td style="padding:12px 16px; text-align:right; font-weight:600; color:#1e293b;">$${formatearPrecio(p.total)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        body.innerHTML = html;

        // Guardar datos globales
        window.datosReporteActual = topProductos;
        window.tituloReporteActual = 'Top_Productos_Ventas';

        // Inicializar Gráfica Top 5
        if (window.chartTopInstance) window.chartTopInstance.destroy();

        // Validar Chart
        if (typeof Chart === 'undefined') return;

        try {
            const ctx = document.getElementById('chartTopProductos').getContext('2d');
            const top5 = topProductos.slice(0, 5);

            window.chartTopInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: top5.map(p => p.nombre.substring(0, 15) + '...'),
                    datasets: [{
                        label: 'Unidades Vendidas',
                        data: top5.map(p => p.cantidad),
                        backgroundColor: '#3b82f6',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { borderDash: [2, 4] } },
                        x: { grid: { display: false } }
                    }
                }
            });
        } catch (e) { console.error('Error chart top', e); }

    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando reporte top:', error);
        body.innerHTML = `<p class="text-danger">Error al cargar el reporte: ${error.message}</p>`;
    }
}
async function cargarReporteMetodos() {
    const body = document.getElementById('bodyReporte');
    if (!body) return;
    document.getElementById('contenidoReporte').style.display = 'block';

    // Título profesional con icono
    const tituloContainer = document.getElementById('tituloReporte');
    tituloContainer.innerHTML = '<i class="fas fa-credit-card" style="margin-right:10px; color:#ff6b00;"></i> Ventas por Método de Pago';

    body.innerHTML = '<div class="loading"><div class="spinner"></div><p>Analizando transacciones...</p></div>';

    try {
        // Consultar ventas de los últimos 30 días o todo el mes actual
        const fechaInicio = new Date();
        fechaInicio.setDate(1); // Primer día del mes actual

        // 1. Consultar datos RAW de ventas (id, total, metodo_pago)
        const { data, error } = await supabaseClient
            .from('ventas')
            .select('id_venta, total, metodo_pago, created_at')
            .gte('created_at', fechaInicio.toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            body.innerHTML = `
                <div style="text-align:center; padding:3rem;">
                    <i class="fas fa-search" style="font-size:3rem; color:#cbd5e1; margin-bottom:1rem;"></i>
                    <p style="color:#64748b; font-size:1.1rem;">No se encontraron transacciones en este periodo.</p>
                </div>`;
            return;
        }

        // 2. Procesamiento de datos (Agrupación)
        const metodosStats = {};
        let granTotal = 0;
        let totalTransacciones = 0;

        data.forEach(venta => {
            // Normalizar método (ej: "Nequi + Efectivo" -> contar como principal o separar? Por ahora string exacto)
            // Si es null, categorizar como "Sin Especificar"
            let metodo = venta.metodo_pago ? venta.metodo_pago.trim() : 'Sin Especificar';

            // Capitalizar primera letra
            metodo = metodo.charAt(0).toUpperCase() + metodo.slice(1);

            if (!metodosStats[metodo]) {
                metodosStats[metodo] = { cantidad: 0, total: 0 };
            }

            metodosStats[metodo].cantidad++;
            metodosStats[metodo].total += (venta.total || 0);

            granTotal += (venta.total || 0);
            totalTransacciones++;
        });

        // Convertir a array y ordenar por total descendente
        const reporteArray = Object.keys(metodosStats).map(metodo => ({
            metodo,
            cantidad: metodosStats[metodo].cantidad,
            total: metodosStats[metodo].total,
            ticketPromedio: metodosStats[metodo].cantidad > 0 ? metodosStats[metodo].total / metodosStats[metodo].cantidad : 0,
            porcentaje: granTotal > 0 ? (metodosStats[metodo].total / granTotal) * 100 : 0
        })).sort((a, b) => b.total - a.total);

        // 3. Renderizado Profesional
        let html = `
            <div style="display:flex; gap:1.5rem; margin-bottom:2rem; align-items:flex-start; flex-wrap:wrap;">
                
                <!-- KPIs -->
                <div style="flex:1; min-width:300px; display:flex; flex-direction:column; gap:1rem;">
                    <div style="display:flex; gap:1rem;">
                        <div class="kpi-card" style="flex:1; background:#f8fafc; padding:1rem; border-radius:12px; border-left:4px solid #ff6b00; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                            <div style="font-size:0.85rem; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Ventas Totales</div>
                            <div style="font-size:1.8rem; color:#1e293b; font-weight:700; margin-top:0.25rem;">$${formatearPrecio(granTotal)}</div>
                        </div>
                        <div class="kpi-card" style="flex:1; background:#f8fafc; padding:1rem; border-radius:12px; border-left:4px solid #10b981; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                            <div style="font-size:0.85rem; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Transacciones</div>
                            <div style="font-size:1.8rem; color:#1e293b; font-weight:700; margin-top:0.25rem;">${totalTransacciones}</div>
                        </div>
                    </div>
                     <div class="kpi-card" style="background:#f8fafc; padding:1rem; border-radius:12px; border-left:4px solid #3b82f6; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size:0.85rem; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Método Favorito</div>
                        <div style="font-size:1.5rem; color:#1e293b; font-weight:700; margin-top:0.25rem;">${reporteArray[0]?.metodo || '-'} <span style="font-size:1rem; color:#64748b; font-weight:400;">(${reporteArray[0]?.porcentaje.toFixed(1)}%)</span></div>
                    </div>
                </div>

                <!-- Gráfica -->
                <div style="flex:0 0 350px; background:white; padding:1rem; border-radius:12px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); border:1px solid #e2e8f0; display:flex; flex-direction:column; align-items:center;">
                    <h4 style="margin:0 0 1rem 0; color:#475569; font-size:0.9rem;">Distribución de Ventas</h4>
                    <div id="chartContainer" style="position:relative; height:220px; width:220px;">
                        <canvas id="chartMetodosPago"></canvas>
                    </div>
                </div>
            </div>

            <div class="table-container" style="box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); border-radius:8px; overflow:hidden; border:1px solid #e2e8f0;">
                <table class="data-table" style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:#1e293b; color:white;">
                            <th style="padding:12px 16px; text-align:left; font-weight:600;">Método de Pago</th>
                            <th style="padding:12px 16px; text-align:center; font-weight:600;">Transacciones</th>
                            <th style="padding:12px 16px; text-align:right; font-weight:600;">Ventas Totales</th>
                            <th style="padding:12px 16px; text-align:right; font-weight:600;">Participación</th>
                            <th style="padding:12px 16px; text-align:right; font-weight:600;">Ticket Prom.</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reporteArray.map((r, index) => `
                            <tr style="border-bottom:1px solid #e2e8f0; background:${index % 2 === 0 ? 'white' : '#f8fafc'}; transition:background 0.2s;">
                                <td style="padding:12px 16px;">
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <div style="width:8px; height:8px; border-radius:50%; background:${getColorMetodo(r.metodo)};"></div>
                                        <span style="font-weight:500; color:#334155;">${r.metodo}</span>
                                    </div>
                                </td>
                                <td style="padding:12px 16px; text-align:center; color:#475569;">${r.cantidad}</td>
                                <td style="padding:12px 16px; text-align:right; font-weight:600; color:#1e293b;">$${formatearPrecio(r.total)}</td>
                                <td style="padding:12px 16px; text-align:right;">
                                    <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px;">
                                        <span style="font-size:0.85rem; color:#64748b;">${r.porcentaje.toFixed(1)}%</span>
                                        <div style="width:50px; height:4px; background:#e2e8f0; border-radius:2px; overflow:hidden;">
                                            <div style="width:${r.porcentaje}%; height:100%; background:${getColorMetodo(r.metodo)};"></div>
                                        </div>
                                    </div>
                                </td>
                                <td style="padding:12px 16px; text-align:right; color:#475569;">$${formatearPrecio(r.ticketPromedio)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot style="background:#f1f5f9; font-weight:700; border-top:2px solid #cbd5e1;">
                         <tr>
                            <td style="padding:12px 16px; color:#1e293b;">TOTALES</td>
                            <td style="padding:12px 16px; text-align:center; color:#1e293b;">${totalTransacciones}</td>
                            <td style="padding:12px 16px; text-align:right; color:#1e293b;">$${formatearPrecio(granTotal)}</td>
                            <td style="padding:12px 16px; text-align:right;">100%</td>
                            <td style="padding:12px 16px; text-align:right;">-</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        // Pequeño helper para colores consistentes
        function getColorMetodo(metodo) {
            const colors = {
                'Efectivo': '#10b981', // Verde
                'Nequi': '#ec4899', // Rosa
                'Daviplata': '#ef4444', // Rojo
                'Tarjeta': '#3b82f6', // Azul
                'Transferencia': '#8b5cf6', // Violeta
                'Credito': '#f59e0b', // Naranja
                'Sistecredito': '#06b6d4' // Cyan
            };
            return colors[metodo.split(' ')[0]] || '#94a3b8'; // Gris por defecto
        }

        body.innerHTML = html;

        // Guardar datos globales para exportación si se requiere
        window.datosReporteActual = reporteArray;
        window.tituloReporteActual = 'Ventas_Por_Metodo';

    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando reporte métodos:', error);
        body.innerHTML = `
            <div style="padding:2rem; text-align:center; background:#fef2f2; border:1px solid #fee2e2; border-radius:8px;">
                <p style="color:#ef4444; font-weight:600; margin-bottom:0.5rem;">Error al cargar el reporte</p>
                <p style="color:#b91c1c; font-size:0.9rem;">${error.message}</p>
            </div>`;
    }
}
async function cargarReporteLocales() { const body = document.getElementById('bodyReporte'); if (!body) return; document.getElementById('contenidoReporte').style.display = 'block'; document.getElementById('tituloReporte').textContent = '📈 Ventas por Local'; body.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>'; try { const { data, error } = await supabaseClient.from('v_ventas_totales_dia').select('*').order('fecha', { ascending: false }).limit(30); if (error) throw error; if (!data || data.length === 0) { body.innerHTML = '<p class="text-center">No hay datos disponibles</p>'; return; } body.innerHTML = `<div class="table-container"><table class="data-table"><thead><tr><th>Fecha</th><th>Local</th><th>Facturas</th><th>Efectivo</th><th>Transfer.</th><th>Total</th></tr></thead><tbody>${data.map(r => `<tr><td>${formatearFecha(r.fecha)}</td><td><strong>${r.local_venta || '-'}</strong></td><td>${r.cantidad_facturas}</td><td>$${formatearPrecio(r.ventas_efectivo)}</td><td>$${formatearPrecio(r.ventas_transferencia)}</td><td><strong>$${formatearPrecio(r.total_ventas)}</strong></td></tr>`).join('')}</tbody></table></div>`; } catch (error) { if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando reporte:', error); body.innerHTML = '<p class="text-danger">Error al cargar el reporte</p>'; } }
function exportarReporte() {
    const contenido = document.getElementById('contenidoReporte');
    if (!contenido || contenido.style.display === 'none') {
        showToast('Primero genera un reporte', 'warning');
        return;
    }

    const tabla = contenido.querySelector('table');
    if (!tabla) {
        showToast('No hay datos para exportar', 'warning');
        return;
    }

    const titulo = document.getElementById('tituloReporte')?.textContent || 'Reporte';

    // Crear Modal de Selección Dinámico
    const modalId = 'modalExportOptions';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '9999';

    modal.innerHTML = `
        <div class="modal-content" style="background:white; padding:2rem; border-radius:12px; max-width:400px; width:90%; position:relative; box-shadow:0 10px 25px rgba(0,0,0,0.2); animation: fadeIn 0.3s ease;">
            <button id="btnCloseExport" style="position:absolute; top:10px; right:15px; border:none; background:none; font-size:1.5rem; cursor:pointer; color:#64748b;">&times;</button>
            <div style="text-align:center; margin-bottom:1.5rem;">
                <div style="font-size:3rem; margin-bottom:1rem;">📤</div>
                <h3 style="color:#1e293b; margin:0; font-size:1.5rem;">Exportar Reporte</h3>
                <p style="color:#64748b; margin-top:0.5rem;">Elige el formato de descarga</p>
            </div>
            <div style="display:grid; gap:1rem;">
                <button id="btnExportExcel" class="btn" style="background:#10b981; color:white; padding:1rem; border-radius:8px; display:flex; align-items:center; justify-content:center; gap:10px; font-weight:600; border:none; cursor:pointer; transition: transform 0.2s;">
                    <i class="fas fa-file-excel"></i> Descargar Excel (.xlsx)
                </button>
                <button id="btnExportPDF" class="btn" style="background:#ef4444; color:white; padding:1rem; border-radius:8px; display:flex; align-items:center; justify-content:center; gap:10px; font-weight:600; border:none; cursor:pointer; transition: transform 0.2s;">
                    <i class="fas fa-file-pdf"></i> Descargar PDF (.pdf)
                </button>
            </div>
        </div>
        <style>
            @keyframes fadeIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
            #btnExportExcel:hover, #btnExportPDF:hover { transform: translateY(-2px); filter: brightness(1.1); }
        </style>
    `;

    document.body.appendChild(modal);

    // Eventos
    const cerrar = () => document.getElementById(modalId).remove();
    document.getElementById('btnCloseExport').onclick = cerrar;
    modal.onclick = (e) => { if (e.target === modal) cerrar(); };

    document.getElementById('btnExportExcel').onclick = () => {
        if (window.ReportExporter) ReportExporter.toExcel(tabla, 'Reporte_' + titulo.replace(/[^a-zA-Z0-9]/g, '_'));
        cerrar();
    };

    document.getElementById('btnExportPDF').onclick = () => {
        if (window.ReportExporter) ReportExporter.toPDF(tabla, 'Reporte_' + titulo.replace(/[^a-zA-Z0-9]/g, '_'), titulo);
        cerrar();
    };
}

function exportarTablaCSV(tabla, nombreArchivo) {
    const filas = tabla.querySelectorAll('tr');
    let csv = '';

    filas.forEach(fila => {
        const celdas = fila.querySelectorAll('th, td');
        const valores = [];
        celdas.forEach(celda => {
            let valor = celda.innerText.replace(/"/g, '""');
            valores.push(`"${valor}"`);
        });
        csv += valores.join(',') + '\n';
    });

    // Agregar BOM para Excel
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${nombreArchivo}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Archivo exportado correctamente', 'success');
}

function exportarProductosExcel() {
    if (productos.length === 0) {
        showToast('No hay productos para exportar', 'warning');
        return;
    }

    try {
        const data = productos.map(p => ({
            'ID': p.id_producto,
            'Nombre': p.nombre,
            'Marca': p.marca,
            'Categoria': p.categoria,
            'Precio Compra': p.precio_compra || 0,
            'Precio Venta': p.precio,
            'Estado': p.estado
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Productos');

        // Ajustar ancho de columnas
        ws['!cols'] = [
            { wch: 15 }, { wch: 40 }, { wch: 20 }, { wch: 20 },
            { wch: 15 }, { wch: 15 }, { wch: 10 }
        ];

        XLSX.writeFile(wb, `productos_moteros_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast(`${productos.length} productos exportados a Excel`, 'success');
    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error exportando:', error);
        showToast('Error al exportar Excel', 'error');
    }
}

function exportarProductosPDF() {
    if (productos.length === 0) {
        showToast('No hay productos para exportar', 'warning');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const logoUrl = 'https://pbblthbrdkevuyjxyuar.supabase.co/storage/v1/object/public/productos-imagenes/moteros%20logo.jpg';

        // Logo y Encabezado
        doc.addImage(logoUrl, 'JPEG', 14, 10, 20, 20);
        doc.setFontSize(18);
        doc.setTextColor(255, 107, 0);
        doc.text('Moteros Sport Line', 38, 20);
        doc.setFontSize(12);
        doc.setTextColor(71, 85, 105);
        doc.text('Listado de Productos', 38, 26);
        doc.setFontSize(9);
        doc.text(`Fecha: ${new Date().toLocaleDateString('es-CO')}`, 38, 31);

        const data = productos.map(p => [
            p.id_producto,
            p.nombre?.substring(0, 30) || '',
            p.marca || '',
            p.categoria || '',
            '$' + formatearPrecio(p.precio),
            p.estado
        ]);

        doc.autoTable({
            head: [['ID', 'Nombre', 'Marca', 'Categoria', 'Precio', 'Estado']],
            body: data,
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [255, 107, 0] }
        });

        doc.save(`productos_moteros_${new Date().toISOString().split('T')[0]}.pdf`);
        showToast(`${productos.length} productos exportados a PDF`, 'success');
    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error exportando PDF:', error);
        showToast('Error al exportar PDF', 'error');
    }
}

// Variables globales para instancias de gráficos de ventas (sección dedicada)
// ... (ya declaradas arriba)

function getVentasData() {
    // Priorizar ventasActuales (filtradas por rango) sobre ventas global
    return (typeof ventasActuales !== 'undefined' && ventasActuales.length > 0) ? ventasActuales : ventas;
}

function exportarVentasExcel() {
    const dataVentas = getVentasData();
    if (dataVentas.length === 0) {
        showToast('No hay ventas para exportar', 'warning');
        return;
    }

    try {
        const data = dataVentas.map(v => ({
            'ID': v.id,
            'Fecha': v.created_at ? new Date(v.created_at).toLocaleDateString('es-CO') : '',
            'Cliente': v.cliente_nombre || '',
            'Local': v.local_venta || '',
            'Subtotal': v.subtotal || 0,
            'Descuento': v.descuento || 0,
            'Total': v.total,
            'Metodo Pago': v.metodo_pago || '',
            'Estado': v.estado || ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
        XLSX.writeFile(wb, `ventas_general_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast(`${data.length} ventas exportadas`, 'success');
    } catch (error) {
        console.error(error);
        showToast('Error al exportar Excel', 'error');
    }
}

function exportarVentasPDF() {
    const dataVentas = getVentasData();
    if (dataVentas.length === 0) {
        showToast('No hay ventas para exportar', 'warning');
        return;
    }
    // ... (Lógica PDF existente pero usando dataVentas)
    // Para simplificar, asumimos que ReportExporter.toPDF ya existe o usamos jsPDF directo como estaba
    // Mantenemos lógica original adaptada:
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');
        // ... (Configuración de documento igual al original)

        doc.text(`Reporte General de Ventas (${dataVentas.length} registros)`, 14, 20);

        const data = dataVentas.map(v => [
            v.id,
            v.created_at ? new Date(v.created_at).toLocaleDateString('es-CO') : '',
            v.cliente_nombre?.substring(0, 25) || '',
            v.local_venta || '',
            '$' + formatearPrecio(v.total),
            v.metodo_pago || '',
            v.estado || ''
        ]);

        doc.autoTable({
            head: [['ID', 'Fecha', 'Cliente', 'Local', 'Total', 'Pago', 'Estado']],
            body: data,
            startY: 30
        });

        doc.save(`ventas_general_${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('PDF generado', 'success');
    } catch (e) {
        console.error(e);
        showToast('Error generando PDF', 'error');
    }
}

// NUEVAS FUNCIONES DE EXPORTACIÓN GRANULAR
function exportarReporteMetodos(formato) {
    const dataVentas = getVentasData();
    if (dataVentas.length === 0) return showToast('Sin datos', 'warning');

    const agregado = {};
    dataVentas.forEach(v => {
        const m = v.metodo_pago || 'Otros';
        agregado[m] = (agregado[m] || 0) + (v.total || 0);
    });

    const dataExport = Object.keys(agregado).map(k => ({
        'Método de Pago': k,
        'Total Vendido': agregado[k]
    }));

    if (formato === 'excel') {
        const ws = XLSX.utils.json_to_sheet(dataExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'MetodosPago');
        XLSX.writeFile(wb, `ventas_por_metodo_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text('Ventas por Método de Pago', 14, 20);
        const body = dataExport.map(d => [d['Método de Pago'], '$' + formatearPrecio(d['Total Vendido'])]);
        doc.autoTable({ head: [['Método', 'Total']], body, startY: 30 });
        doc.save('ventas_por_metodo.pdf');
    }
}

function exportarReporteLocales(formato) {
    const dataVentas = getVentasData();
    if (dataVentas.length === 0) return showToast('Sin datos', 'warning');

    const agregado = {};
    dataVentas.forEach(v => {
        const l = v.local_venta || 'General';
        agregado[l] = (agregado[l] || 0) + (v.total || 0);
    });

    const dataExport = Object.keys(agregado).map(k => ({
        'Local': k,
        'Total Vendido': agregado[k]
    }));

    if (formato === 'excel') {
        const ws = XLSX.utils.json_to_sheet(dataExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Locales');
        XLSX.writeFile(wb, `ventas_por_local_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text('Ventas por Local', 14, 20);
        const body = dataExport.map(d => [d['Local'], '$' + formatearPrecio(d['Total Vendido'])]);
        doc.autoTable({ head: [['Local', 'Total']], body, startY: 30 });
        doc.save('ventas_por_local.pdf');
    }
}

function exportarInventarioExcel() {
    const tabla = document.getElementById('inventarioLocal')?.value;
    if (!tabla) { showToast('Selecciona un local primero', 'warning'); return; }

    const inv = tabla === 'inventario_alcala' ? inventarios.alcala :
        tabla === 'inventario_01' ? inventarios.local01 : inventarios.jordan;
    const nombreLocal = tabla.replace('inventario_', '').toUpperCase();

    if (!inv || inv.length === 0) {
        showToast('No hay inventario para exportar', 'warning');
        return;
    }

    try {
        const data = inv.map(i => {
            const p = productos.find(x => x.id_producto === i.id_producto);
            const estado = i.cantidad === 0 ? 'Agotado' : i.cantidad <= (i.stock_minimo || 5) ? 'Stock Bajo' : 'OK';
            return {
                'ID Producto': i.id_producto,
                'Nombre': p?.nombre || 'N/A',
                'Marca': p?.marca || '',
                'Cantidad': i.cantidad,
                'Stock Minimo': i.stock_minimo || 5,
                'Estado': estado,
                'Valor Unitario': p?.precio || 0,
                'Valor Total': (p?.precio || 0) * i.cantidad
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Inventario ${nombreLocal}`);

        ws['!cols'] = [
            { wch: 15 }, { wch: 35 }, { wch: 20 }, { wch: 10 },
            { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }
        ];

        XLSX.writeFile(wb, `inventario_${nombreLocal}_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast(`Inventario ${nombreLocal} exportado a Excel`, 'success');
    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error exportando:', error);
        showToast('Error al exportar Excel', 'error');
    }
}

function exportarInventarioPDF() {
    const tabla = document.getElementById('inventarioLocal')?.value;
    if (!tabla) { showToast('Selecciona un local primero', 'warning'); return; }

    const inv = tabla === 'inventario_alcala' ? inventarios.alcala :
        tabla === 'inventario_01' ? inventarios.local01 : inventarios.jordan;
    const nombreLocal = tabla.replace('inventario_', '').toUpperCase();

    if (!inv || inv.length === 0) {
        showToast('No hay inventario para exportar', 'warning');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const logoUrl = 'https://pbblthbrdkevuyjxyuar.supabase.co/storage/v1/object/public/productos-imagenes/moteros%20logo.jpg';

        // Logo y Encabezado
        doc.addImage(logoUrl, 'JPEG', 14, 10, 20, 20);
        doc.setFontSize(18);
        doc.setTextColor(255, 107, 0);
        doc.text('Moteros Sport Line', 38, 20);
        doc.setFontSize(12);
        doc.setTextColor(71, 85, 105);
        doc.text(`Inventario Local: ${nombreLocal}`, 38, 26);
        doc.setFontSize(9);
        doc.text(`Fecha: ${new Date().toLocaleDateString('es-CO')}`, 38, 31);

        const totalUnidades = inv.reduce((s, i) => s + (i.cantidad || 0), 0);
        let valorTotal = 0;
        inv.forEach(i => {
            const p = productos.find(x => x.id_producto === i.id_producto);
            valorTotal += (p?.precio || 0) * i.cantidad;
        });

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(`Unidades Totales: ${totalUnidades} | Valor Estimado: $${formatearPrecio(valorTotal)}`, 14, 40);

        const data = inv.map(i => {
            const p = productos.find(x => x.id_producto === i.id_producto);
            const estado = i.cantidad === 0 ? 'Agotado' : i.cantidad <= (i.stock_minimo || 5) ? 'Bajo' : 'OK';
            return [
                i.id_producto,
                p?.nombre?.substring(0, 25) || 'N/A',
                i.cantidad,
                i.stock_minimo || 5,
                estado,
                '$' + formatearPrecio((p?.precio || 0) * i.cantidad)
            ];
        });

        doc.autoTable({
            head: [['ID', 'Nombre', 'Cant', 'Min', 'Estado', 'Valor']],
            body: data,
            startY: 42,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [255, 107, 0] }
        });

        doc.save(`inventario_${nombreLocal}_${new Date().toISOString().split('T')[0]}.pdf`);
        showToast(`Inventario ${nombreLocal} exportado a PDF`, 'success');
    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error exportando PDF:', error);
        showToast('Error al exportar PDF', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// BÚSQUEDA GLOBAL
// ═══════════════════════════════════════════════════════════════
let resultadosBusquedaGlobal = [];

function busquedaGlobalAdmin(termino) {
    const container = document.getElementById('resultadosBusqueda');
    if (!container) return;

    if (!termino || termino.length < 2) {
        container.style.display = 'none';
        return;
    }

    const term = termino.toLowerCase();
    resultadosBusquedaGlobal = [];

    // Buscar en productos
    const prodEncontrados = productos.filter(p =>
        (p.nombre || '').toLowerCase().includes(term) ||
        (p.marca || '').toLowerCase().includes(term) ||
        (p.id_producto || '').toLowerCase().includes(term)
    ).slice(0, 5);

    prodEncontrados.forEach(p => resultadosBusquedaGlobal.push({
        tipo: '📦 Producto',
        titulo: p.nombre,
        subtitulo: `${p.marca} - $${formatearPrecio(p.precio)}`,
        accion: () => { mostrarSeccion('productos'); setTimeout(() => { const input = document.getElementById('busquedaProducto'); if (input) { input.value = p.nombre; filtrarProductosAdmin(); } }, 300); }
    }));

    // Buscar en ventas
    const ventasEncontradas = ventas.filter(v =>
        (v.id || '').toString().includes(term) ||
        (v.cliente_nombre || '').toLowerCase().includes(term)
    ).slice(0, 3);

    ventasEncontradas.forEach(v => resultadosBusquedaGlobal.push({
        tipo: '💰 Venta',
        titulo: `Venta #${v.id}`,
        subtitulo: `${v.cliente_nombre || 'Sin cliente'} - $${formatearPrecio(v.total)}`,
        accion: () => { mostrarSeccion('ventas'); }
    }));

    // Buscar en promociones
    const promosEncontradas = promociones.filter(p =>
        (p.nombre || '').toLowerCase().includes(term) ||
        (p.id_promo || '').toLowerCase().includes(term)
    ).slice(0, 3);

    promosEncontradas.forEach(p => resultadosBusquedaGlobal.push({
        tipo: '🏷️ Promoción',
        titulo: p.nombre,
        subtitulo: `${p.descuento}% descuento - ${p.estado}`,
        accion: () => { mostrarSeccion('promociones'); setTimeout(() => editarPromocion(p.id_promo), 300); }
    }));

    // Renderizar resultados
    if (resultadosBusquedaGlobal.length === 0) {
        container.innerHTML = '<div style="padding:1.5rem;text-align:center;color:#64748b;">No se encontraron resultados</div>';
    } else {
        container.innerHTML = resultadosBusquedaGlobal.map((r, i) => `
            <div onclick="ejecutarResultadoBusqueda(${i})" style="padding:1rem;border-bottom:1px solid #f1f5f9;cursor:pointer;display:flex;align-items:center;gap:1rem;transition:background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                <span style="font-size:1.5rem;">${r.tipo.split(' ')[0]}</span>
                <div style="flex:1;">
                    <p style="margin:0;font-weight:600;color:#1e293b;">${r.titulo}</p>
                    <p style="margin:0;font-size:0.85rem;color:#64748b;">${r.subtitulo}</p>
                </div>
                <span style="font-size:0.75rem;background:#f1f5f9;padding:0.25rem 0.5rem;border-radius:0.25rem;color:#64748b;">${r.tipo.split(' ')[1]}</span>
            </div>
        `).join('');
    }

    container.style.display = 'block';
}

function ejecutarResultadoBusqueda(index) {
    if (resultadosBusquedaGlobal[index]) {
        resultadosBusquedaGlobal[index].accion();
        ocultarResultadosBusqueda();
        document.getElementById('busquedaGlobal').value = '';
    }
}

// Compra - Cancelar form
window.cancelarFormCompra = function () {
    const modal = document.getElementById('modalNuevaCompra');
    if (modal) modal.style.display = 'none';
    if (typeof limpiarFormCompra === 'function') limpiarFormCompra();
    else {
        // Fallback cleanup if function missing
        document.getElementById('compraProveedor').value = '';
        document.getElementById('compraTotal').value = '';
        document.getElementById('tbodyDetallesCompra').innerHTML = '';
        detallesCompra = [];
    }
}

function mostrarResultadosBusqueda() {
    const container = document.getElementById('resultadosBusqueda');
    const input = document.getElementById('busquedaGlobal');
    if (container && input && input.value.length >= 2) {
        container.style.display = 'block';
    }
}

function ocultarResultadosBusqueda() {
    const container = document.getElementById('resultadosBusqueda');
    if (container) container.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {

    setupNavigation();
    setupDropzones();

    // Auto-login si hay sesión activa
    if (checkSession()) {

        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        inicializarAdmin();
        showToast('¡Sesión restaurada!', 'success');
    }

    // Event listeners
    const passInput = document.getElementById('adminPassword');
    if (passInput) {
        passInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loginAdmin();
        });
    }

    const pc = document.getElementById('productoPrecioCompra');
    const pv = document.getElementById('productoPrecio');
    if (pc) pc.addEventListener('input', calcularMargen);
    if (pv) pv.addEventListener('input', calcularMargen);


});

// ═══════════════════════════════════════════════════════════════
// EXPORTAR FUNCIONES GLOBALES
// ═══════════════════════════════════════════════════════════════
// Login
window.loginAdmin = loginAdmin;
window.logout = logout;
window.toggleSidebar = toggleSidebar;
window.mostrarCambiarPassword = mostrarCambiarPassword;
window.cerrarModalPassword = cerrarModalPassword;
window.cambiarPassword = cambiarPassword;
window.toggleMobileMenu = toggleMobileMenu;

// Productos
window.cargarProductos = cargarProductos;
window.mostrarFormProducto = mostrarFormProducto;
window.cancelarFormProducto = cancelarFormProducto;
window.editarProducto = editarProducto;
window.guardarProducto = guardarProducto;
window.eliminarProducto = eliminarProducto;
window.filtrarProductosAdmin = filtrarProductosAdmin;
window.calcularMargen = calcularMargen;
window.cargarStockTiendas = cargarStockTiendas;
window.guardarStockTiendas = guardarStockTiendas;

// Inventarios
window.cargarInventarioLocal = cargarInventarioLocal;
window.ajustarStock = ajustarStock;
window.exportarInventario = exportarInventario;
window.cargarTodosLosInventarios = cargarTodosLosInventarios;

// Alertas
window.cargarAlertasStock = cargarAlertasStock;

// Ventas
window.cargarVentasDia = cargarVentasDia;
window.exportarVentasDia = exportarVentasDia;

// Compras - CORREGIDO
window.cargarCompras = cargarCompras;
window.mostrarFormCompra = mostrarFormCompra;
window.cancelarFormCompra = cerrarFormCompra;
// window.guardarCompra = guardarCompraAvanzada; // ELIMINADO POR CONFLICTO
// window.editarCompra = editarCompra; // Pendiente definir
// window.eliminarCompra = eliminarCompra; // Pendiente definir
// window.buscarCompras = buscarCompras; // Pendiente definir
// window.mostrarModalPago = mostrarModalPago; // Pendiente
// window.abrirModalPagoManualCompra = abrirModalPagoManualCompra; // Pendiente
// window.guardarPagoManualCompra = guardarPagoManualCompra; // Pendiente

window.cerrarModalPago = function () {
    const el = document.getElementById('modalPagoCompra');
    if (el) el.style.display = 'none';
};
// window.guardarPagoCompra = guardarPagoCompra;
// window.registrarPagoCompra = registrarPagoCompra;
window.cargarProveedoresDatalist = cargarProveedoresDatalist;
window.formatearMonedaInput = formatearMonedaInput;
window.limpiarMoneda = limpiarMoneda;

// Deudores
window.cargarDeudores = cargarDeudores;
window.buscarDeudores = buscarDeudores;
window.mostrarFormDeudor = mostrarFormDeudor;
window.cancelarFormDeudor = cancelarFormDeudor;
window.guardarDeudor = guardarDeudor;
window.editarDeudor = editarDeudor;
window.registrarPagoDeudor = registrarPagoDeudor;

// ═══════════════════════════════════════════════════════════════
// SERVICIOS VENDEDORES (REPORTES)
// ═══════════════════════════════════════════════════════════════
let serviciosActuales = [];

async function cargarServiciosAdmin() {
    const inicio = document.getElementById('fechaServiciosInicio')?.value;
    const fin = document.getElementById('fechaServiciosFin')?.value;
    const tbody = document.getElementById('tbodyServiciosAdmin');

    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center">Consultando...</td></tr>';

    try {
        let query = supabaseClient
            .from('pagos_servicios')
            .select(`
                *,
                servicio:servicios_motero (*)
            `)
            .order('created_at', { ascending: false });

        if (inicio) query = query.gte('created_at', new Date(inicio).toISOString());
        if (fin) {
            const dFin = new Date(fin);
            dFin.setHours(23, 59, 59, 999);
            query = query.lte('created_at', dFin.toISOString());
        }

        const { data, error } = await query;
        if (error) throw error;

        serviciosActuales = data || [];
        renderizarTablaServicios(serviciosActuales);

    } catch (e) {
        console.error('Error cargando servicios:', e);
        showToast('Error al cargar reporte de servicios', 'error');
    }
}

function renderizarTablaServicios(datos) {
    const tbody = document.getElementById('tbodyServiciosAdmin');
    const totalCountEl = document.getElementById('totalServiciosCount');
    const totalMontoEl = document.getElementById('totalServiciosMonto');

    const totalMoney = datos.reduce((s, p) => s + (p.monto || 0), 0);
    if (totalCountEl) totalCountEl.textContent = datos.length;
    if (totalMontoEl) totalMontoEl.textContent = '$' + formatearPrecio(totalMoney);

    if (!tbody) return;

    if (datos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay servicios en este periodo</td></tr>';
        return;
    }

    tbody.innerHTML = datos.map(p => `
        <tr>
            <td>
                <div>${new Date(p.created_at).toLocaleDateString('es-CO')}</div>
                <small style="color:#888">${formatearHora(p.created_at)}</small>
            </td>
            <td><strong>${p.local || 'N/A'}</strong></td>
            <td>${p.servicio?.nombre_empleado || 'N/A'}</td>
            <td>${p.servicio?.descripcion || 'Servicio'}</td>
            <td><span class="badge badge-info">${p.servicio?.placa || '-'}</span></td>
            <td><strong>$${formatearPrecio(p.monto)}</strong></td>
            <td><span class="badge ${p.metodo_pago === 'Efectivo' ? 'badge-success' : 'badge-primary'}">${p.metodo_pago || 'N/A'}</span></td>
            <td><small style="font-weight:600; color:var(--primary)">${p.servicio?.voucher_code || p.servicio?.referencia_pago || '-'}</small></td>
        </tr>
    `).join('');
}

function exportarServiciosExcel() {
    if (serviciosActuales.length === 0) return showToast('No hay datos para exportar', 'warning');

    try {
        const data = serviciosActuales.map(p => ({
            'Fecha': new Date(p.created_at).toLocaleDateString('es-CO'),
            'Hora': formatearHora(p.created_at),
            'Local': p.local || '',
            'Empleado': p.servicio?.nombre_empleado || '',
            'Servicio': p.servicio?.descripcion || '',
            'Placa': p.servicio?.placa || '',
            'Monto': p.monto,
            'Metodo Pago': p.metodo_pago || '',
            'Voucher/Ref': p.servicio?.voucher_code || p.servicio?.referencia_pago || ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ServiciosTécnicos');
        XLSX.writeFile(wb, `servicios_vendidos_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('Reporte de servicios exportado', 'success');
    } catch (e) {
        console.error(e);
        showToast('Error al exportar reporte', 'error');
    }
}

window.cargarServiciosAdmin = cargarServiciosAdmin;
window.exportarServiciosExcel = exportarServiciosExcel;

// Deudas
window.cargarDeudasNegocio = cargarDeudasNegocio;
window.mostrarFormDeuda = mostrarFormDeuda;
window.cancelarFormDeuda = cancelarFormDeuda;
window.guardarDeudaNegocio = guardarDeudaNegocio;
window.editarDeudaNegocio = editarDeudaNegocio;
window.registrarPagoDeuda = registrarPagoDeuda;
window.confirmarPagoDeuda = confirmarPagoDeuda;
window.cargarProveedores = cargarProveedores;
// window.buscarProveedores = buscarProveedores; // No definida
window.mostrarFormProveedor = mostrarFormProveedor;
window.cancelarFormProveedor = cancelarFormProveedor;
window.guardarProveedor = guardarProveedor;
window.editarProveedor = editarProveedor;

// Deudas Negocio
window.cargarDeudasNegocio = cargarDeudasNegocio;
window.mostrarFormDeuda = mostrarFormDeuda;
window.cancelarFormDeuda = cancelarFormDeuda;
window.guardarDeudaNegocio = guardarDeudaNegocio;
window.editarDeudaNegocio = editarDeudaNegocio;
window.registrarPagoDeuda = registrarPagoDeuda;

// Créditos
window.cargarCreditos = cargarCreditos;
window.mostrarFormCredito = mostrarFormCredito;
window.verDetalleCredito = verDetalleCredito;
window.registrarPagoCredito = registrarPagoCredito;
window.confirmarPagoCredito = confirmarPagoCredito;

// Bodegas
window.cargarBodegas = cargarBodegas;
window.cargarBodega = cargarBodega;
window.mostrarFormMovimiento = mostrarFormMovimiento;
window.moverDeBodega = moverDeBodega;

// Alianzas
window.cargarAlianzas = cargarAlianzas;
window.mostrarFormAlianza = mostrarFormAlianza;
window.editarAlianza = editarAlianza;
window.guardarEdicionAlianza = guardarEdicionAlianza;
window.guardarNuevaAlianza = guardarNuevaAlianza;

// Promociones
window.cargarPromociones = cargarPromociones;
window.mostrarFormPromocion = mostrarFormPromocion;
window.cancelarFormPromocion = cancelarFormPromocion;
window.editarPromocion = editarPromocion;
window.guardarPromocion = guardarPromocion;
window.eliminarPromocion = eliminarPromocion;
window.duplicarPromocion = duplicarPromocion;
window.filtrarProductosPromo = filtrarProductosPromo;
window.toggleProductoPromo = toggleProductoPromo;
window.quitarProductoPromo = quitarProductoPromo;
window.limpiarSeleccionPromo = limpiarSeleccionPromo;

// Servicios
window.cargarServiciosAdmin = cargarServiciosAdmin;
window.cambiarEstadoServicioAdmin = cambiarEstadoServicioAdmin;
window.enviarWhatsAppServicio = enviarWhatsAppServicio;

// Metas
window.cargarMetas = cargarMetas;
window.abrirModalMeta = abrirModalMeta;
window.cerrarModalMeta = cerrarModalMeta;
window.guardarMeta = guardarMeta;
window.eliminarMeta = eliminarMeta;
window.exportarMetasPDF = exportarMetasPDF;

// ═══════════════════════════════════════════════════════════════

// REPORTES ADICIONALES
// ═══════════════════════════════════════════════════════════════

async function cargarReportePromedioVentas() {
    const contenido = document.getElementById('contenidoReporte');
    const titulo = document.getElementById('tituloReporte');
    if (!contenido) return;

    titulo.textContent = '📉 Reporte Detallado de Promedio de Ventas';
    contenido.style.display = 'block';
    contenido.scrollIntoView({ behavior: 'smooth' });

    contenido.querySelector('.card-body').innerHTML = '<div class="loading"><div class="spinner"></div><p>Calculando estadísticas...</p></div>';

    try {
        // Obtener facturas de los últimos 90 días para un análisis profundo
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() - 90);

        const { data: facturas, error } = await supabaseClient
            .from('ventas')
            .select('created_at, total, local, estado_venta')
            // Incluir ventas físicas (estado null) y digitales completadas
            .or('estado_venta.eq.Completada,estado_venta.eq.Entregado,estado_venta.is.null')
            .gte('created_at', fechaLimite.toISOString())
            .order('created_at', { ascending: true });

        if (error) throw error;


        // Procesar datos por día
        const ventasPorDia = {};
        const locales = new Set();

        facturas.forEach(f => {
            const fecha = f.created_at.split('T')[0];
            const local = f.local || 'Sin Local';
            locales.add(local);

            if (!ventasPorDia[fecha]) {
                ventasPorDia[fecha] = { total: 0, porLocal: {} };
            }
            ventasPorDia[fecha].total += parseFloat(f.total || 0);
            if (!ventasPorDia[fecha].porLocal[local]) ventasPorDia[fecha].porLocal[local] = 0;
            ventasPorDia[fecha].porLocal[local] += parseFloat(f.total || 0);
        });

        const fechas = Object.keys(ventasPorDia);
        const totales = fechas.map(f => ventasPorDia[f].total);
        const promedioGeneral = totales.reduce((a, b) => a + b, 0) / (fechas.length || 1);

        // Renderizar Reporte
        contenido.querySelector('.card-body').innerHTML = `
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-bottom:2rem;">
                <div style="background:#f0f9ff; padding:1.5rem; border-radius:1rem; border:1px solid #bae6fd; text-align:center;">
                    <div style="font-size:0.8rem; color:#0369a1; font-weight:700; text-transform:uppercase; margin-bottom:0.5rem;">Promedio Diario (90d)</div>
                    <div style="font-size:1.5rem; font-weight:800; color:#0c4a6e;">$${formatearPrecio(promedioGeneral)}</div>
                </div>
                <div style="background:#f0fdf4; padding:1.5rem; border-radius:1rem; border:1px solid #bbf7d0; text-align:center;">
                    <div style="font-size:0.8rem; color:#15803d; font-weight:700; text-transform:uppercase; margin-bottom:0.5rem;">Día de Mayor Venta</div>
                    <div style="font-size:1.2rem; font-weight:800; color:#064e3b;">$${formatearPrecio(Math.max(...totales, 0))}</div>
                </div>
            </div>

            <div style="height:350px; margin-bottom:2.5rem;">
                <canvas id="chartPromedioVentas"></canvas>
            </div>

            <h4 style="margin-bottom:1rem; color:#1e293b;">📅 Historial de Ventas Diarias</h4>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Total Venta</th>
                            <th>Locales Activos</th>
                            <th>Estado vs Promedio</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${fechas.reverse().slice(0, 30).map(f => {
            const diaTotal = ventasPorDia[f].total;
            const diff = diaTotal - promedioGeneral;
            const diffPerc = ((diff / promedioGeneral) * 100).toFixed(1);
            const color = diff >= 0 ? '#10b981' : '#ef4444';
            return `
                                <tr>
                                    <td style="font-weight:600;">${f}</td>
                                    <td style="font-weight:700;">$${formatearPrecio(diaTotal)}</td>
                                    <td>${Object.keys(ventasPorDia[f].porLocal).join(', ')}</td>
                                    <td>
                                        <span style="color:${color}; font-weight:700;">
                                            ${diff >= 0 ? '▲' : '▼'} ${Math.abs(diffPerc)}%
                                        </span>
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Gráfico
        const ctx = document.getElementById('chartPromedioVentas').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: fechas.reverse(),
                datasets: [{
                    label: 'Venta Diaria',
                    data: totales.reverse(),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }, {
                    label: 'Promedio General',
                    data: new Array(fechas.length).fill(promedioGeneral),
                    borderColor: '#ef4444',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
                scales: {
                    y: { beginAtZero: true, ticks: { callback: value => '$' + formatearPrecio(value) } }
                }
            }
        });

    } catch (e) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando reporte promedio:', e);
        contenido.querySelector('.card-body').innerHTML = `<p style="color:#ef4444;text-align:center;padding:2rem;">Error: ${e.message}</p>`;
    }
}

window.cargarReportePromedioVentas = cargarReportePromedioVentas;

// Búsqueda Global
window.busquedaGlobalAdmin = busquedaGlobalAdmin;
window.ejecutarResultadoBusqueda = ejecutarResultadoBusqueda;
window.mostrarResultadosBusqueda = mostrarResultadosBusqueda;
window.ocultarResultadosBusqueda = ocultarResultadosBusqueda;

// Exportar Excel y PDF
window.exportarReporte = exportarReporte;
window.exportarTablaCSV = exportarTablaCSV;
window.exportarProductosExcel = exportarProductosExcel;
window.exportarProductosPDF = exportarProductosPDF;
window.exportarVentasExcel = exportarVentasExcel;
window.exportarVentasPDF = exportarVentasPDF;
window.exportarInventarioExcel = exportarInventarioExcel;
window.exportarInventarioPDF = exportarInventarioPDF;

// Blog
window.cargarPosts = cargarPosts;
window.mostrarFormPost = mostrarFormPost;
window.cancelarFormPost = cancelarFormPost;
window.editarPost = editarPost;
window.guardarPost = guardarPost;
window.eliminarPost = eliminarPost;

// Configuración
window.cargarConfiguracion = cargarConfiguracion;
window.guardarConfiguracion = guardarConfiguracion;

// Archivos
window.handleFileSelect = handleFileSelect;
window.removerPreview = removerPreview;

// Cierres
window.cargarCierresCaja = cargarCierresCaja;
window.verDetalleCierre = verDetalleCierre;
window.exportarCierres = exportarCierres;

// Gastos
window.cargarGastos = cargarGastos;
window.mostrarFormGasto = mostrarFormGasto;
window.cancelarFormGasto = cancelarFormGasto;
window.guardarGasto = guardarGasto;
window.eliminarGasto = eliminarGasto;
window.editarGasto = editarGasto;

// Destacados
window.cargarDestacadosAdmin = cargarDestacadosAdmin;
window.filtrarProductosDestacados = filtrarProductosDestacados;
window.agregarDestacado = agregarDestacado;
window.quitarDestacado = quitarDestacado;

// Reportes
window.cargarReporteMargen = cargarReporteMargen;
window.cargarReporteTop = cargarReporteTop;
window.cargarReporteMetodos = cargarReporteMetodos;
window.cargarReporteLocales = cargarReporteLocales;
window.exportarReporte = exportarReporte;

// Dashboard
window.cargarDashboard = cargarDashboard;
window.cargarEstadisticasLocales = cargarEstadisticasLocales;

// ═══════════════════ ENVÍOS ═══════════════════


async function cargarEnvios() {
    const tbody = document.getElementById('tbodyEnvios');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9" class="text-center">Cargando...</td></tr>';

    try {
        const estadoFiltro = document.getElementById('enviosEstadoFiltro')?.value || '';
        const fechaFiltro = document.getElementById('enviosFechaFiltro')?.value || '';

        let query = supabaseClient
            .from('envios')
            .select('*')
            .order('fecha_venta', { ascending: false });

        if (estadoFiltro) query = query.eq('estado', estadoFiltro);

        // Fix: Aplicar filtro de fecha si existe
        if (fechaFiltro) {
            // Filtrar por el día específico
            // Suponiendo fecha_venta es timestamp o date
            const inicio = new Date(fechaFiltro); inicio.setHours(0, 0, 0, 0);
            const fin = new Date(fechaFiltro); fin.setHours(23, 59, 59, 999);
            query = query.gte('fecha_venta', inicio.toISOString()).lte('fecha_venta', fin.toISOString());
        }

        const { data, error } = await query;

        if (error) throw error;

        enviosData = data || []; // Actualizar global para exportación

        // Actualizar stats (Dashboard simple)
        // Nota: Para los contadores totales preferimos una consulta separada si queremos ver TODOS, 
        // pero para UX consistente, los contadores de arriba suelen reflejar "Estado Actual del Sistema" (pendientes, en tránsito)
        // independientemente del filtro de fecha histórico.
        // Haremos un fetch ligero de conteo por estados vivos.
        actualizarContadoresEnviosRapidos();

        if (!enviosData || enviosData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay envíos registrados con estos filtros</td></tr>';
            return;
        }

        tbody.innerHTML = enviosData.map(e => {
            const estadoClase = {
                'pendiente': 'warning',
                'preparando': 'info',
                'despachado': 'primary',
                'en_transito': 'info',
                'enviado': 'info',
                'entregado': 'success',
                'devuelto': 'danger'
            }[e.estado] || 'secondary';

            return `
            <tr>
                <td><strong>${e.numero_pedido || '-'}</strong></td>
                <td>${e.fecha_venta ? formatearFecha(e.fecha_venta) : '-'}</td>
                <td>${e.cliente_nombre || '-'}<br><small class="text-muted">${e.cliente_telefono || ''}</small></td>
                <td>${e.ciudad || '-'}</td>
                <td>${e.transportadora || '<em>Sin asignar</em>'}</td>
                <td>${e.numero_guia ? `<a href="${e.url_tracking || '#'}" target="_blank">${e.numero_guia}</a>` : '<em>Sin guía</em>'}</td>
                <td>$${formatearPrecio(e.total_pedido || 0)}</td>
                <td><span class="badge badge-${estadoClase}">${e.estado}</span></td>
                <td class="text-center">
                    <div class="btn-group">
                        <button onclick="abrirModalEditarEnvio('${e.id}')" class="btn btn-sm btn-secondary" title="Editar">✏️</button>
                        <button onclick="enviarGuia('${e.id}')" class="btn btn-sm btn-primary" title="Asignar guía" ${e.numero_guia ? 'disabled' : ''}>📦</button>
                        <button onclick="notificarClienteWhatsApp('${e.id}')" class="btn btn-sm btn-success" title="WhatsApp">📱</button>
                    </div>
                </td>
            </tr>
        `}).join('');

    } catch (error) {
        console.error('Error cargando envíos:', error);
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">Error: ${error.message}</td></tr>`;
        showToast('Error al cargar envíos', 'error');
    }
}

async function actualizarContadoresEnviosRapidos() {
    try {
        const { data, error } = await supabaseClient.from('envios').select('estado');
        if (data) {
            document.getElementById('enviosPendientes').textContent = data.filter(e => e.estado === 'pendiente').length;
            document.getElementById('enviosEnTransito').textContent = data.filter(e => ['enviado', 'despachado', 'en_transito'].includes(e.estado)).length;
            document.getElementById('enviosEntregados').textContent = data.filter(e => e.estado === 'entregado').length;
            document.getElementById('enviosDevueltos').textContent = data.filter(e => e.estado === 'devuelto').length;
        }
    } catch (e) { console.error('Error stats envios helper', e); }
}

async function enviarGuia(id) {


    // Obtener datos del envío actual
    const envio = enviosData.find(e => e.id === id);

    const transportadora = prompt('Ingrese la transportadora (ej: Servientrega, Coordinadora):');
    if (!transportadora) return;

    const guia = prompt('Ingrese el número de guía:');
    if (!guia) return;

    const urlTracking = prompt('URL de tracking (opcional):', '');

    try {

        const updateData = {
            transportadora: transportadora.trim(),
            numero_guia: guia.trim(),
            url_tracking: urlTracking?.trim() || null,
            estado: 'despachado',
            fecha_despacho: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };


        const { data, error } = await supabaseClient
            .from('envios')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) {
            if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", '❌ Error Supabase:', error);
            throw error;
        }


        showToast('✅ Guía asignada correctamente', 'success');

        // Actualizar el cache local antes de notificar
        await cargarEnvios();

        // Preguntar si desea notificar
        if (confirm('¿Desea notificar al cliente por WhatsApp?')) {
            notificarClienteWhatsApp(id);
        }
    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", '❌ Error asignando guía:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

async function actualizarEstadoEnvio(id, nuevoEstado) {


    try {
        const updateData = {
            estado: nuevoEstado,
            updated_at: new Date().toISOString()
        };

        if (nuevoEstado === 'entregado') {
            updateData.fecha_entrega = new Date().toISOString();
        }



        const { data, error } = await supabaseClient
            .from('envios')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) {
            if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", '❌ Error Supabase:', error);
            throw error;
        }


        showToast('Estado actualizado a: ' + nuevoEstado, 'success');
        await cargarEnvios();
    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", '❌ Error actualizando estado:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

function notificarClienteWhatsApp(id, guia = null, transportadora = null) {
    const envio = enviosData.find(e => e.id === id);
    if (!envio) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", '❌ Envío no encontrado:', id);
        showToast('Envío no encontrado', 'error');
        return;
    }

    const telefono = envio.cliente_telefono?.replace(/\D/g, '');
    if (!telefono) {
        showToast('El cliente no tiene teléfono registrado', 'warning');
        return;
    }

    const nombreCliente = envio.cliente_nombre || 'cliente';
    const numeroPedido = envio.numero_pedido || '-';

    // Plantilla Base Corporativa Premium
    let mensaje = `📌 *MOTEROS SPORT LINE* 🏍️\n\n`;

    if (envio.numero_guia || guia) {
        // MENSAJE DESPACHADO / EN TRÁNSITO
        mensaje += `Estimad@ *${nombreCliente}*, cliente premium, te informamos que tu pedido *${numeroPedido}* ya va por excelente camino 😁 Muy pronto podrás disfrutar de tus productos 🫶\n\n`;
        mensaje += `📦 *Transportadora:* ${envio.transportadora || transportadora || 'Por definir'}\n`;
        mensaje += `🔢 *Número de guía:* ${envio.numero_guia || guia}\n`;
        if (envio.url_tracking || (envio.transportadora === 'Servientrega' && guia)) {
            const url = envio.url_tracking || `https://www.servientrega.com/wps/portal/Colombia/transaccional/rastreo-envios?id=${guia || envio.numero_guia}`;
            mensaje += `🔗 *Tracking:* ${url}\n`;
        }
    } else {
        // MENSAJE EN PREPARACIÓN
        mensaje += `Estimad@ *${nombreCliente}*, cliente premium, te informamos que tu pedido *${numeroPedido}* ya se está preparando con la mejor energía 😁 Muy pronto estará en manos de la transportadora 🫶\n`;
    }

    mensaje += `\n¡Gracias por ser parte de la familia MOTEROS SPORT LINE! 🙌\n`;

    const url = `https://wa.me/57${telefono}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
    showToast('Abriendo WhatsApp...', 'info');
}

async function abrirModalEditarEnvio(id) {


    const envio = enviosData.find(e => e.id === id);
    if (!envio) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", '❌ Envío no encontrado');
        showToast('Envío no encontrado', 'error');
        return;
    }

    // Llenar campos del modal
    document.getElementById('envioId').value = id;
    document.getElementById('envioNumeroPedido').textContent = envio.numero_pedido || '-';
    document.getElementById('envioClienteNombre').textContent = envio.cliente_nombre || '-';
    document.getElementById('envioClienteTelefono').textContent = envio.cliente_telefono || '-';
    document.getElementById('envioDireccion').textContent = envio.direccion_envio || '-';
    document.getElementById('envioCiudad').textContent = `${envio.ciudad || '-'}, ${envio.departamento || '-'}`;
    document.getElementById('envioProductos').textContent = envio.productos_descripcion || '-';

    document.getElementById('envioTransportadora').value = envio.transportadora || '';
    document.getElementById('envioGuia').value = envio.numero_guia || '';
    document.getElementById('envioUrlTracking').value = envio.url_tracking || '';
    document.getElementById('envioEstado').value = envio.estado || 'pendiente';
    document.getElementById('envioCosto').value = envio.costo_envio || 0;
    document.getElementById('envioIncluidoPrecio').checked = envio.envio_incluido || false;
    document.getElementById('envioClientePaga').checked = envio.cliente_paga_envio || false;
    document.getElementById('envioNotas').value = envio.notas || '';

    document.getElementById('modalEditarEnvio').style.display = 'flex';
}

async function guardarEnvioModal(notificar = false) {
    const id = document.getElementById('envioId').value;


    try {
        const updateData = {
            transportadora: document.getElementById('envioTransportadora').value || null,
            numero_guia: document.getElementById('envioGuia').value || null,
            url_tracking: document.getElementById('envioUrlTracking').value || null,
            estado: document.getElementById('envioEstado').value,
            costo_envio: parseFloat(document.getElementById('envioCosto').value) || 0,
            envio_incluido: document.getElementById('envioIncluidoPrecio').checked,
            cliente_paga_envio: document.getElementById('envioClientePaga').checked,
            notas: document.getElementById('envioNotas').value || null,
            updated_at: new Date().toISOString()
        };

        // Agregar fecha según estado
        if (updateData.estado === 'despachado' && updateData.numero_guia) {
            updateData.fecha_despacho = new Date().toISOString();
        }
        if (updateData.estado === 'entregado') {
            updateData.fecha_entrega = new Date().toISOString();
        }



        const { data, error } = await supabaseClient
            .from('envios')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) {
            if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", '❌ Error Supabase:', error);
            throw error;
        }


        showToast('Envío actualizado correctamente', 'success');
        cerrarModalEnvio();

        if (notificar) {
            notificarClienteWhatsApp(id);
        }

        await cargarEnvios();
    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", '❌ Error guardando envío:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

async function cargarEstadisticasEnvios() {
    try {
        // 1. Cargar KPIs Generales desde v_estadisticas_envios
        const { data: statsMes } = await supabaseClient
            .from('v_estadisticas_envios')
            .select('*')
            .order('mes', { ascending: false })
            .limit(1);

        if (statsMes && statsMes.length > 0) {
            const s = statsMes[0];
            const el1 = document.getElementById('statEnviosTotales');
            const el2 = document.getElementById('statCobradoEnvios');
            const el3 = document.getElementById('statAsumidoEnvios');
            const el4 = document.getElementById('statBalanceEnvios');
            if (el1) el1.textContent = s.total_envios || 0;
            if (el2) el2.textContent = '$' + formatearPrecio(s.cobrado_envios || 0);
            if (el3) el3.textContent = '$' + formatearPrecio(s.asumido_envios || 0);
            if (el4) el4.textContent = '$' + formatearPrecio(s.balance_envios || 0);
        }

        // 2. Gráfica Mensual (Histórico)
        const { data: todosEnvios } = await supabaseClient.from('envios').select('fecha_venta');
        if (todosEnvios) {
            const mesesNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            const labelsMeses = [];
            const dataMeses = [];
            const hoy = new Date();
            for (let i = 5; i >= 0; i--) {
                const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
                labelsMeses.push(mesesNames[d.getMonth()]);
                const count = todosEnvios.filter(e => {
                    if (!e.fecha_venta) return false;
                    const f = new Date(e.fecha_venta);
                    return f.getMonth() === d.getMonth() && f.getFullYear() === d.getFullYear();
                }).length;
                dataMeses.push(count);
            }
            const ctxMes = document.getElementById('chartEnviosMes');
            if (ctxMes && window.Chart) {
                if (window.chartEnviosInstance) window.chartEnviosInstance.destroy();
                window.chartEnviosInstance = new Chart(ctxMes, {
                    type: 'bar',
                    data: { labels: labelsMeses, datasets: [{ label: 'Envíos', data: dataMeses, backgroundColor: '#3b82f6' }] },
                    options: { responsive: true, maintainAspectRatio: false }
                });
            }
        }

        // 3. Ranking Transportadoras (Tabla y Gráfica)
        const { data: viewTransp } = await supabaseClient
            .from('v_envios_por_transportadora')
            .select('*')
            .order('total_envios', { ascending: false });

        const tbodyTransp = document.getElementById('tbodyTransportadoras');
        if (tbodyTransp) {
            if (viewTransp && viewTransp.length > 0) {
                tbodyTransp.innerHTML = viewTransp.map(v => `
                    <tr>
                        <td><strong>${v.transportadora.toUpperCase()}</strong></td>
                        <td>${v.total_envios}</td>
                        <td class="text-success">${v.entregados}</td>
                        <td class="text-danger">${v.devueltos}</td>
                        <td>${v.promedio_dias ? parseFloat(v.promedio_dias).toFixed(1) + ' d' : '-'}</td>
                        <td><span class="badge ${v.tasa_exito >= 90 ? 'badge-success' : 'badge-warning'}">${v.tasa_exito}%</span></td>
                    </tr>
                `).join('');

                const ctxTrans = document.getElementById('chartTransportadoras');
                if (ctxTrans && window.Chart) {
                    if (window.chartTransInstance) window.chartTransInstance.destroy();
                    window.chartTransInstance = new Chart(ctxTrans, {
                        type: 'doughnut',
                        data: {
                            labels: viewTransp.map(v => v.transportadora.toUpperCase()),
                            datasets: [{
                                data: viewTransp.map(v => v.total_envios),
                                backgroundColor: ['#f97316', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6']
                            }]
                        },
                        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
                    });
                }
            } else {
                tbodyTransp.innerHTML = '<tr><td colspan="6" class="text-center">No hay datos de transportadoras</td></tr>';
            }
        }

        // 4. Top Ciudades Destino (Tabla)
        const { data: viewCiudades } = await supabaseClient
            .from('v_envios_por_ciudad')
            .select('*')
            .order('total_envios', { ascending: false })
            .limit(10);

        const tbodyCiudades = document.getElementById('tbodyCiudades');
        if (tbodyCiudades) {
            if (viewCiudades && viewCiudades.length > 0) {
                tbodyCiudades.innerHTML = viewCiudades.map(v => `
                    <tr>
                        <td><strong>${v.ciudad}</strong></td>
                        <td>${v.departamento}</td>
                        <td>${v.total_envios}</td>
                        <td>$${formatearPrecio(v.total_ventas)}</td>
                        <td>$${formatearPrecio(v.costo_envio_promedio)}</td>
                    </tr>
                `).join('');
            } else {
                tbodyCiudades.innerHTML = '<tr><td colspan="5" class="text-center">No hay datos de ciudades</td></tr>';
            }
        }

    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando estadísticas de envíos:', error);
        showToast('Error al cargar estadísticas', 'error');
    }
}

function buscarEnvios() {
    const busqueda = document.getElementById('enviosBuscar')?.value.toLowerCase() || '';
    const filas = document.querySelectorAll('#tbodyEnvios tr');
    filas.forEach(fila => {
        const texto = fila.textContent.toLowerCase();
        fila.style.display = texto.includes(busqueda) ? '' : 'none';
    });
}

function exportarEnvios() {
    if (!enviosData || enviosData.length === 0) {
        showToast('No hay envíos para exportar', 'warning');
        return;
    }

    try {
        const data = enviosData.map(e => ({
            'Pedido': e.numero_pedido || '',
            'Fecha': e.fecha_venta ? new Date(e.fecha_venta).toLocaleDateString('es-CO') : '',
            'Cliente': e.cliente_nombre || '',
            'Teléfono': e.cliente_telefono || '',
            'Ciudad': e.ciudad || '',
            'Dirección': e.direccion || '',
            'Transportadora': e.transportadora || '',
            'Guía': e.numero_guia || '',
            'Estado': e.estado || '',
            'Total': e.total_pedido || 0,
            'Costo Envío': e.costo_envio || 0
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Envios');

        // Auto-width cols
        ws['!cols'] = [
            { wch: 10 }, { wch: 12 }, { wch: 25 }, { wch: 15 },
            { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 15 },
            { wch: 12 }, { wch: 12 }, { wch: 12 }
        ];

        XLSX.writeFile(wb, `envios_moteros_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast(`${enviosData.length} envíos exportados`, 'success');
    } catch (error) {
        console.error(error);
        showToast('Error al exportar envíos', 'error');
    }
}

function abrirModalEnvio(id) {
    showToast('Función en desarrollo', 'info');
}

function cerrarModalEnvio() {
    const modal = document.getElementById('modalEditarEnvio');
    if (modal) modal.style.display = 'none';
}

async function guardarEnvio(notificar = false) {
    showToast('Guardando...', 'info');
    cerrarModalEnvio();
    await cargarEnvios();
    if (notificar) showToast('Cliente notificado', 'success');
}

function cerrarModalHistorial() {
    const modal = document.getElementById('modalHistorialEnvio');
    if (modal) modal.style.display = 'none';
}

// Exportar funciones de envíos
window.cargarEnvios = cargarEnvios;
window.cargarEstadisticasEnvios = cargarEstadisticasEnvios;
window.enviarGuia = enviarGuia;
window.actualizarEstadoEnvio = actualizarEstadoEnvio;
window.notificarClienteWhatsApp = notificarClienteWhatsApp;
window.buscarEnvios = buscarEnvios;
window.exportarEnvios = exportarEnvios;
window.abrirModalEditarEnvio = abrirModalEditarEnvio;
window.cerrarModalEnvio = cerrarModalEnvio;
window.guardarEnvio = guardarEnvio;
window.guardarEnvioModal = guardarEnvioModal;
window.cerrarModalHistorial = cerrarModalHistorial;

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE EMPLEADOS
// ═══════════════════════════════════════════════════════════════

let empleados = [];
let empleadosTablaExiste = true; // Flag para evitar reintentos innecesarios

async function cargarEmpleados() {
    const tbody = document.getElementById('tablaEmpleados');
    if (!tbody) return;

    // Si ya sabemos que la tabla no existe, mostrar mensaje sin hacer query
    if (!empleadosTablaExiste) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#f59e0b;">⚠️ Tabla de empleados no configurada. Contacta al administrador para crearla en Supabase.</td></tr>';
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('empleados_tienda')
            .select('*')
            .order('nombre');

        if (error) {
            // Si es error de tabla no existente, marcar flag
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
                empleadosTablaExiste = false;
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#f59e0b;">⚠️ Tabla de empleados no configurada. Contacta al administrador para crearla en Supabase.</td></tr>';
            } else {
                throw error;
            }
            return;
        }
        empleados = data || [];
        renderizarEmpleados();
    } catch (e) {
        // Solo loguear una vez, no flood de errores
        if (empleadosTablaExiste) {
            if (window.registrarLogSistema) window.registrarLogSistema("warn_sistema", 'Empleados: No se pudo cargar la tabla empleados_tienda');
            empleadosTablaExiste = false;
        }
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#f59e0b;">⚠️ Error al cargar empleados. La tabla puede no existir.</td></tr>';
    }
}

function renderizarEmpleados() {
    const tbody = document.getElementById('tablaEmpleados');
    if (!tbody) return;

    if (empleados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#94a3b8;">No hay empleados registrados</td></tr>';
        return;
    }

    tbody.innerHTML = empleados.map(emp => {
        const tiendas = emp.tiendas_permitidas?.join(', ') || 'Ninguna';
        const estado = emp.activo
            ? '<span style="color:#10b981;font-weight:600;">Activo</span>'
            : '<span style="color:#f87171;font-weight:600;">Inactivo</span>';

        return `
            <tr>
                <td><strong>${emp.nombre}</strong></td>
                <td>${emp.usuario || '-'}</td>
                <td>${emp.cedula || '-'}</td>
                <td>${emp.cargo || 'Vendedor'}</td>
                <td style="font-size:0.85rem;">${tiendas}</td>
                <td>${estado}</td>
                <td>
                    <button onclick="editarEmpleado(${emp.id})" class="btn btn-sm btn-primary" title="Editar">✏️</button>
                    <button onclick="eliminarEmpleado(${emp.id})" class="btn btn-sm btn-danger" title="Eliminar">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

function mostrarModalEmpleado() {
    if (!empleadosTablaExiste) {
        alert('⚠️ La tabla de empleados no está configurada en la base de datos.\n\nContacta al administrador para crear la tabla "empleados_tienda" en Supabase.');
        return;
    }
    document.getElementById('tituloModalEmpleado').textContent = '➕ Nuevo Empleado';
    document.getElementById('empleadoEditId').value = '';
    document.getElementById('empleadoNombre').value = '';
    document.getElementById('empleadoUsuario').value = '';
    document.getElementById('empleadoCedula').value = '';
    document.getElementById('empleadoPassword').value = '';
    document.getElementById('empleadoCargo').value = 'Vendedor';
    document.getElementById('empleadoActivo').checked = true;
    document.getElementById('tiendaTodas').checked = false;
    document.querySelectorAll('.tienda-checkbox').forEach(cb => cb.checked = false);

    document.getElementById('modalEmpleado').style.display = 'flex';
}

function cerrarModalEmpleado() {
    document.getElementById('modalEmpleado').style.display = 'none';
}

function toggleTodasTiendas(checkbox) {
    const checkboxes = document.querySelectorAll('.tienda-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = false;
        cb.disabled = checkbox.checked;
    });
}

async function guardarEmpleado() {
    const id = document.getElementById('empleadoEditId').value;
    const nombre = document.getElementById('empleadoNombre').value.trim();
    const usuario = document.getElementById('empleadoUsuario').value.trim();
    const cedula = document.getElementById('empleadoCedula').value.trim();
    const password = document.getElementById('empleadoPassword').value;
    const cargo = document.getElementById('empleadoCargo').value;
    const activo = document.getElementById('empleadoActivo').checked;

    let tiendas = [];
    if (document.getElementById('tiendaTodas').checked) {
        tiendas = ['Todas'];
    } else {
        document.querySelectorAll('.tienda-checkbox:checked').forEach(cb => {
            tiendas.push(cb.value);
        });
    }

    // Nuevos campos de nómina
    const salarioRaw = document.getElementById('empleadoSalario')?.value || '0';
    const salarioBase = parseFloat(salarioRaw.replace(/[^\d]/g, '')) || 0;
    const tipoContrato = document.getElementById('empleadoContrato')?.value || 'Fijo';
    const frecuenciaPago = document.getElementById('empleadoFrecuencia')?.value || 'Quincenal';

    if (!nombre) {
        alert('El nombre es obligatorio');
        return;
    }
    if (!usuario && !cedula) {
        alert('Ingresa al menos usuario o cédula');
        return;
    }
    if (!id && (!password || password.length < 4)) {
        alert('La contraseña debe tener mínimo 4 caracteres');
        return;
    }

    const datos = {
        nombre,
        usuario: usuario || null,
        cedula: cedula || null,
        cargo,
        activo,
        tiendas_permitidas: tiendas,
        salario_base: salarioBase,
        tipo_contrato: tipoContrato,
        frecuencia_pago: frecuenciaPago
    };

    if (password) {
        datos.password = password;
    }

    try {
        if (id) {
            const { error } = await supabaseClient
                .from('empleados_tienda')
                .update(datos)
                .eq('id', id);
            if (error) throw error;
            alert('✅ Empleado actualizado correctamente');
        } else {
            const { error } = await supabaseClient
                .from('empleados_tienda')
                .insert(datos);
            if (error) throw error;
            alert('✅ Empleado creado correctamente');
        }

        cerrarModalEmpleado();
        cargarEmpleados();
    } catch (e) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error guardando empleado:', e);
        alert('Error al guardar: ' + (e.message || 'desconocido'));
    }
}

async function editarEmpleado(id) {
    const emp = empleados.find(e => e.id === id);
    if (!emp) return;

    document.getElementById('tituloModalEmpleado').textContent = '✏️ Editar Empleado';
    document.getElementById('empleadoEditId').value = id;
    document.getElementById('empleadoNombre').value = emp.nombre || '';
    document.getElementById('empleadoUsuario').value = emp.usuario || '';
    document.getElementById('empleadoCedula').value = emp.cedula || '';
    document.getElementById('empleadoPassword').value = '';
    document.getElementById('empleadoCargo').value = emp.cargo || 'Vendedor';
    document.getElementById('empleadoActivo').checked = emp.activo;

    const tiendas = emp.tiendas_permitidas || [];
    if (tiendas.includes('Todas')) {
        document.getElementById('tiendaTodas').checked = true;
        document.querySelectorAll('.tienda-checkbox').forEach(cb => {
            cb.checked = false;
            cb.disabled = true;
        });
    } else {
        document.getElementById('tiendaTodas').checked = false;
        document.querySelectorAll('.tienda-checkbox').forEach(cb => {
            cb.disabled = false;
            cb.checked = tiendas.includes(cb.value);
        });
    }

    // Llenar campos de nómina
    if (document.getElementById('empleadoSalario')) {
        document.getElementById('empleadoSalario').value = formatearPrecio(emp.salario_base || 0);
    }
    if (document.getElementById('empleadoContrato')) {
        document.getElementById('empleadoContrato').value = emp.tipo_contrato || 'Fijo';
    }
    if (document.getElementById('empleadoFrecuencia')) {
        document.getElementById('empleadoFrecuencia').value = emp.frecuencia_pago || 'Quincenal';
    }

    document.getElementById('modalEmpleado').style.display = 'flex';
}

async function eliminarEmpleado(id) {
    const emp = empleados.find(e => e.id === id);
    if (!emp) return;

    if (!confirm(`¿Eliminar al empleado "${emp.nombre}"?\n\nEsta acción no se puede deshacer.`)) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('empleados_tienda')
            .delete()
            .eq('id', id);

        if (error) throw error;
        alert('✅ Empleado eliminado');
        cargarEmpleados();
    } catch (e) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error eliminando empleado:', e);
        alert('Error al eliminar: ' + (e.message || 'desconocido'));
    }
}

// Exports para empleados
window.cargarEmpleados = cargarEmpleados;
window.mostrarModalEmpleado = mostrarModalEmpleado;
window.cerrarModalEmpleado = cerrarModalEmpleado;
window.toggleTodasTiendas = toggleTodasTiendas;
window.guardarEmpleado = guardarEmpleado;
window.editarEmpleado = editarEmpleado;
window.eliminarEmpleado = eliminarEmpleado;

// ═══════════════════════════════════════════════════════════════
// MÉTODOS DE PAGO (CONFIGURACIÓN WEB)
// ═══════════════════════════════════════════════════════════════

function cargarMetodosPagoConfig() {
    try {
        const stored = localStorage.getItem('metodos_pago_config');
        if (stored) {
            const metodos = JSON.parse(stored);
            if (document.getElementById('metodoPagoNequi')) document.getElementById('metodoPagoNequi').checked = metodos.nequi !== false;
            if (document.getElementById('metodoPagoDaviplata')) document.getElementById('metodoPagoDaviplata').checked = metodos.daviplata !== false;
            if (document.getElementById('metodoPagoAddi')) document.getElementById('metodoPagoAddi').checked = metodos.addi !== false;
            if (document.getElementById('metodoPagoSistecredito')) document.getElementById('metodoPagoSistecredito').checked = metodos.sistecredito !== false;
            if (document.getElementById('metodoPagoFodegas')) document.getElementById('metodoPagoFodegas').checked = metodos.fodegas !== false;
        }
    } catch (e) {
        if (window.registrarLogSistema) window.registrarLogSistema("warn_sistema", 'Error cargando métodos de pago:', e);
    }
}

async function guardarMetodosPago() {
    const metodos = {
        nequi: document.getElementById('metodoPagoNequi')?.checked ?? true,
        daviplata: document.getElementById('metodoPagoDaviplata')?.checked ?? true,
        addi: document.getElementById('metodoPagoAddi')?.checked ?? true,
        sistecredito: document.getElementById('metodoPagoSistecredito')?.checked ?? true,
        fodegas: document.getElementById('metodoPagoFodegas')?.checked ?? true
    };

    try {
        // Guardar en localStorage (para uso en la página principal)
        localStorage.setItem('metodos_pago_config', JSON.stringify(metodos));

        // También intentar guardar en Supabase si existe la tabla
        try {
            await supabaseClient
                .from('configuracion')
                .upsert({ clave: 'metodos_pago', valor: JSON.stringify(metodos) }, { onConflict: 'clave' });
        } catch (e) {
            if (window.registrarLogSistema) window.registrarLogSistema("warn_sistema", 'No se pudo guardar en Supabase:', e);
        }

        alert('✅ Métodos de pago guardados correctamente');
    } catch (e) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error guardando métodos de pago:', e);
        alert('Error al guardar: ' + (e.message || 'desconocido'));
    }
}

window.guardarMetodosPago = guardarMetodosPago;

// ═══════════════════════════════════════════════════════════════
// CONTENIDO DEL SITIO - Cargar y Guardar
// ═══════════════════════════════════════════════════════════════

const tiposContenido = [
    'hero_imagen', // Nuevo
    'quienes_somos',
    'mision',
    'vision',
    'terminos',
    'privacidad',
    'habeas_data',
    'politicas_domicilios'
];

async function cargarContenidoSitio() {
    try {
        const { data, error } = await supabaseClient
            .from('contenido_sitio')
            .select('*');

        if (error) throw error;

        if (data && data.length > 0) {
            data.forEach(item => {
                if (item.tipo === 'hero_imagen') {
                    const imgInput = document.getElementById('contenido_hero_imagen');
                    const imgPreview = document.getElementById('preview_hero_imagen');
                    if (imgInput) {
                        imgInput.value = item.contenido || '';
                        if (imgPreview && item.contenido) {
                            imgPreview.src = item.contenido;
                            imgPreview.style.display = 'block';
                        }
                    }
                } else {
                    const tituloInput = document.getElementById(`contenido_${item.tipo}_titulo`);
                    const contenidoInput = document.getElementById(`contenido_${item.tipo}`);

                    if (tituloInput) tituloInput.value = item.titulo || '';
                    if (contenidoInput) contenidoInput.value = item.contenido || '';
                }
            });

        }
    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando contenido:', error);
        showToast('Error al cargar contenido: ' + error.message, 'error');
    }
}

async function guardarContenidoSitio() {
    try {
        const updates = [];

        for (const tipo of tiposContenido) {
            if (tipo === 'hero_imagen') {
                const imgInput = document.getElementById('contenido_hero_imagen');
                if (imgInput) {
                    updates.push({
                        tipo: tipo,
                        titulo: 'Imagen Hero',
                        contenido: imgInput.value.trim(),
                        updated_at: new Date().toISOString()
                    });
                }
            } else {
                const tituloInput = document.getElementById(`contenido_${tipo}_titulo`);
                const contenidoInput = document.getElementById(`contenido_${tipo}`);

                if (tituloInput && contenidoInput) {
                    updates.push({
                        tipo: tipo,
                        titulo: tituloInput.value.trim(),
                        contenido: contenidoInput.value.trim(),
                        updated_at: new Date().toISOString()
                    });
                }
            }
        }

        for (const update of updates) {
            const { error } = await supabaseClient
                .from('contenido_sitio')
                .upsert(update, { onConflict: 'tipo' });

            if (error) throw error;
        }

        showToast('✅ Contenido guardado correctamente', 'success');

    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error guardando contenido:', error);
        showToast('Error al guardar: ' + error.message, 'error');
    }
}

// Cargar contenido cuando se muestra la sección
document.addEventListener('DOMContentLoaded', () => {
    // Observer para cargar contenido cuando se muestre la sección
    const contenidoSection = document.getElementById('contenidoSection');
    if (contenidoSection) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.classList.contains('active')) {
                    cargarContenidoSitio();
                }
            });
        });
        observer.observe(contenidoSection, { attributes: true, attributeFilter: ['class'] });
    }
});

window.cargarContenidoSitio = cargarContenidoSitio;
window.guardarContenidoSitio = guardarContenidoSitio;

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE PROMOCIONES
// ═══════════════════════════════════════════════════════════════



async function cargarPromociones() {
    const lista = document.getElementById('listaPromociones');
    if (lista) lista.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando promociones...</p></div>';

    try {
        const { data, error } = await supabaseClient
            .from('promociones')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        promociones = data || [];
        renderizarPromociones();
    } catch (e) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando promociones:', e);
        if (lista) lista.innerHTML = `<p style="color:#ef4444;text-align:center;padding:2rem;">Error: ${e.message}</p>`;
    }
}

function renderizarPromociones() {
    const lista = document.getElementById('listaPromociones');
    if (!lista) return;

    if (promociones.length === 0) {
        lista.innerHTML = `
            <div style="text-align:center; padding:3rem; background:#f8fafc; border-radius:1rem; border:2px dashed #e2e8f0;">
                <div style="font-size:3rem; margin-bottom:1rem;">🏷️</div>
                <h3 style="color:#1e293b; margin-bottom:0.5rem;">No hay promociones activas</h3>
                <p style="color:#64748b;">Haz clic en "Nueva Promoción" para comenzar</p>
            </div>
        `;
        return;
    }

    lista.innerHTML = `
        <div class="productos-admin-grid">
            ${promociones.map((promo, index) => {
        const promoId = promo.id_promo || `P-${index}`;
        const descuento = promo.descuento || 0;
        const nombre = promo.nombre || 'Sin nombre';
        const badge = promo.estado === 'Activa' ? '<span class="status-badge status-active">Activa</span>' :
            promo.estado === 'Inactiva' ? '<span class="status-badge status-inactive">Inactiva</span>' :
                '<span class="status-badge status-finished">Finalizada</span>';

        // Intentar parsear fechas de forma segura
        const safeFormatDate = (d) => {
            if (!d) return 'Sin fecha';
            let dateStr = d;
            if (typeof dateStr === 'string' && dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
            const dateObj = new Date(dateStr);
            if (isNaN(dateObj.getTime())) return d; // Retornar texto original si no es fecha válida
            return Utils.formatearFecha(dateStr);
        };

        return `
                    <div class="producto-admin-card">
                        <div class="producto-admin-info">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
                                ${badge}
                                <span style="font-weight:800; color:#ff6b00; font-size:1.2rem;">-${descuento}%</span>
                            </div>
                            <h4 style="margin-bottom:0.5rem; color:#1e293b;">${nombre}</h4>
                            <div class="meta" style="font-family:monospace; color:#64748b;">ID: ${promoId}</div>
                            <div class="meta">📍 ${promo.locales_aplicables || promo.locales || 'Todos los locales'}</div>
                            <div class="meta">📅 ${safeFormatDate(promo.fecha_inicio)} - ${safeFormatDate(promo.fecha_fin)}</div>
                            <div style="margin-top:1rem; display:flex; gap:0.5rem;">
                                <button onclick="editarPromocion('${promoId}')" class="btn btn-sm btn-primary" style="flex:1;">✏️ Editar</button>
                                <button onclick="eliminarPromocion('${promoId}')" class="btn btn-sm btn-danger">🗑️</button>
                            </div>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

function mostrarFormPromocion() {
    document.getElementById('formTituloPromocion').textContent = '➕ Nueva Promoción';
    document.getElementById('promocionIdOriginal').value = '';
    document.getElementById('promocionId').value = 'PROMO' + Date.now().toString().slice(-4);
    document.getElementById('promocionNombre').value = '';
    document.getElementById('promocionDescuento').value = '';
    document.getElementById('promocionLocales').value = 'Todos';
    document.getElementById('promocionInicio').value = new Date().toISOString().split('T')[0];
    document.getElementById('promocionFin').value = '';
    document.getElementById('promocionEstado').value = 'Activa';

    productosSeleccionadosPromo = [];
    renderizarProductosPromo();
    actualizarPreviewPromo();

    // Cambiar a vista formulario
    document.getElementById('vistaListaPromociones').style.display = 'none';
    document.getElementById('vistaFormPromocion').style.display = 'block';
}

function cancelarFormPromocion() {
    // Volver a vista lista
    document.getElementById('vistaFormPromocion').style.display = 'none';
    document.getElementById('vistaListaPromociones').style.display = 'block';
}

async function guardarPromocion() {
    const idOriginal = document.getElementById('promocionIdOriginal').value;
    const id = document.getElementById('promocionId').value.trim();
    const nombre = document.getElementById('promocionNombre').value.trim();
    const descuento = parseInt(document.getElementById('promocionDescuento').value);
    const locales = document.getElementById('promocionLocales').value.trim();
    const fecha_inicio = document.getElementById('promocionInicio').value;
    const fecha_fin = document.getElementById('promocionFin').value;
    const estado = document.getElementById('promocionEstado').value;

    if (!id || !nombre || isNaN(descuento) || productosSeleccionadosPromo.length === 0) {
        alert('Por favor completa los campos obligatorios (*) y selecciona al menos un producto');
        return;
    }

    const datos = {
        id_promo: id,
        nombre,
        descuento,
        locales_aplicables: locales,
        fecha_inicio,
        fecha_fin,
        estado,
        productos_incluidos: Array.isArray(productosSeleccionadosPromo) ? productosSeleccionadosPromo.join(',') : productosSeleccionadosPromo
    };

    try {
        if (idOriginal) {
            const { error } = await supabaseClient
                .from('promociones')
                .update(datos)
                .eq('id_promo', idOriginal);
            if (error) throw error;
            showToast('✅ Promoción actualizada', 'success');
        } else {
            const { error } = await supabaseClient
                .from('promociones')
                .insert(datos);
            if (error) throw error;
            showToast('✅ Promoción creada', 'success');
        }

        cancelarFormPromocion();
        cargarPromociones();
    } catch (e) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error guardando promocion:', e);
        alert('Error al guardar: ' + e.message);
    }
}

function editarPromocion(id) {
    const promo = promociones.find(p => String(p.id_promo) === String(id));
    if (!promo) return;

    const promoId = promo.id_promo;
    document.getElementById('formTituloPromocion').textContent = '✏️ Editar Promoción';
    document.getElementById('promocionIdOriginal').value = promoId;
    document.getElementById('promocionId').value = promoId;
    document.getElementById('promocionNombre').value = promo.nombre;
    document.getElementById('promocionDescuento').value = promo.descuento;
    document.getElementById('promocionLocales').value = promo.locales || promo.locales_aplicables || 'Todos';

    // Asegurar formato YYYY-MM-DD para inputs tipo date
    const formatDateForInput = (d) => {
        if (!d) return '';
        if (d.includes('/')) {
            const parts = d.split('/');
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        return d.split('T')[0];
    };

    document.getElementById('promocionInicio').value = formatDateForInput(promo.fecha_inicio);
    document.getElementById('promocionFin').value = formatDateForInput(promo.fecha_fin);
    document.getElementById('promocionEstado').value = promo.estado;

    // Asegurar que los productos sean un array de IDs
    let ids = [];
    if (Array.isArray(promo.productos)) {
        ids = promo.productos;
    } else if (promo.productos_incluidos) {
        ids = promo.productos_incluidos.split(',').map(id => id.trim());
    } else if (promo.productos) {
        ids = String(promo.productos).split(',').map(id => id.trim());
    }

    productosSeleccionadosPromo = ids.filter(id => id && id !== '000').map(id => String(id));
    renderizarProductosPromo();
    actualizarPreviewPromo();

    // Cambiar a vista formulario
    document.getElementById('vistaListaPromociones').style.display = 'none';
    document.getElementById('vistaFormPromocion').style.display = 'block';
}

async function eliminarPromocion(id) {
    if (!confirm('¿Estás seguro de eliminar esta promoción?')) return;

    try {
        const { error } = await supabaseClient
            .from('promociones')
            .delete()
            .eq('id_promo', id);

        if (error) throw error;
        showToast('✅ Promoción eliminada', 'success');
        cargarPromociones();
    } catch (e) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error eliminando promocion:', e);
        showToast('Error al eliminar: ' + e.message, 'error');
    }
}

function renderizarProductosPromo() {
    const container = document.getElementById('listaProductosPromo');
    const contador = document.getElementById('contadorSeleccionados');
    if (!container) return;

    if (contador) contador.textContent = `${productosSeleccionadosPromo.length} seleccionados`;

    if (!productos || productos.length === 0) {
        container.innerHTML = '<p style="padding:2rem;text-align:center;color:#64748b;">No hay productos cargados</p>';
        return;
    }

    container.innerHTML = `
        <div style="padding:1rem; border-bottom:1px solid #e2e8f0; background:#f8fafc; position:sticky; top:0; z-index:10;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h4 style="margin:0; font-size:0.9rem; color:#1e293b;">Lista de Productos</h4>
                <button onclick="limpiarSeleccionPromo()" class="btn btn-secondary btn-sm" style="font-size:0.7rem; padding: 2px 8px;">Vaciar Selección</button>
            </div>
            <div style="position:relative;">
                <input type="text" onkeyup="filtrarProductosPromo(this.value)" placeholder="🔍 Buscar por nombre o marca..." class="form-control" style="padding-left:2.5rem; border-radius:0.75rem;">
                <span style="position:absolute; left:1rem; top:50%; transform:translateY(-50%); opacity:0.5;">🔍</span>
            </div>
        </div>
        <div id="gridProductosPromo" style="padding:1rem; overflow-y:auto; flex:1;">
            ${productos.map(p => {
        const isSelected = productosSeleccionadosPromo.some(sid =>
            String(sid) === String(p.id) ||
            String(sid) === String(p.id_producto)
        );

        return `
                    <div onclick="toggleProductoPromo('${p.id}')" 
                         style="display:flex; align-items:center; gap:1rem; padding:1rem; border-radius:0.75rem; cursor:pointer; margin-bottom:0.75rem; transition:all 0.2s; border:1px solid ${isSelected ? '#ff6b00' : '#e2e8f0'}; background:${isSelected ? '#fff7ed' : 'white'}; box-shadow:${isSelected ? '0 4px 12px rgba(255,107,0,0.1)' : 'none'};">
                        <img src="${p.url_imagen || 'https://pbblthbrdkevuyjxyuar.supabase.co/storage/v1/object/public/productos-imagenes/moteros%20logo.jpg'}" 
                             style="width:50px; height:50px; border-radius:0.5rem; object-fit:cover; background:#eee; border:1px solid #eee;"
                             onerror="this.src='https://pbblthbrdkevuyjxyuar.supabase.co/storage/v1/object/public/productos-imagenes/moteros%20logo.jpg'">
                        <div style="flex:1;">
                            <div style="font-weight:700; font-size:0.95rem; color:#1e293b;">${p.nombre}</div>
                            <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.25rem;">
                                <span style="font-size:0.75rem; color:#64748b; background:#f1f5f9; padding:2px 8px; border-radius:4px;">${p.marca}</span>
                                <span style="font-weight:700; color:#ff6b00;">$${formatearPrecio(p.precio)}</span>
                            </div>
                        </div>
                        <div style="width:24px; height:24px; border-radius:6px; border:2px solid ${isSelected ? '#ff6b00' : '#cbd5e1'}; display:flex; align-items:center; justify-content:center; background:${isSelected ? '#ff6b00' : 'transparent'}; transition:all 0.2s;">
                            ${isSelected ? '<span style="color:white; font-size:0.9rem; font-weight:bold;">✓</span>' : ''}
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

function toggleProductoPromo(id) {
    id = String(id);
    const index = productosSeleccionadosPromo.findIndex(sid => String(sid) === id);
    if (index === -1) {
        productosSeleccionadosPromo.push(id);
    } else {
        productosSeleccionadosPromo.splice(index, 1);
    }
    renderizarProductosPromo();
    actualizarPreviewPromo();
}

function filtrarProductosPromo(query) {
    const grid = document.getElementById('gridProductosPromo');
    if (!grid) return;

    query = query.toLowerCase();
    const items = grid.children;
    for (let item of items) {
        const text = item.innerText.toLowerCase();
        item.style.display = text.includes(query) ? 'flex' : 'none';
    }
}

function limpiarSeleccionPromo() {
    productosSeleccionadosPromo = [];
    renderizarProductosPromo();
    actualizarPreviewPromo();
}

function actualizarPreviewPromo() {
    const card = document.getElementById('previewPromo');
    if (!card) return;

    const nombre = document.getElementById('promocionNombre').value || 'Nombre de la Promo';
    const descuento = parseInt(document.getElementById('promocionDescuento').value) || 0;

    // Calcular totales del combo
    const productosElegidosData = productos.filter(p =>
        productosSeleccionadosPromo.some(sid => String(sid) === String(p.id) || String(sid) === String(p.id_producto))
    );

    const subtotalCombo = productosElegidosData.reduce((sum, p) => sum + (parseFloat(p.precio) || 0), 0);
    const ahorroCombo = Math.round(subtotalCombo * (descuento / 100));
    const totalCombo = subtotalCombo - ahorroCombo;

    card.innerHTML = `
        <div style="border:1px solid #ff6b00; border-radius:1rem; overflow:hidden; background:white; transition:all 0.3s;">
            <div style="background:linear-gradient(135deg, #ff6b00, #ff9500); color:white; padding:0.75rem 1rem; font-weight:800; font-size:1.2rem; display:flex; justify-content:space-between; align-items:center;">
                <span>-${descuento}% OFF</span>
                <span style="font-size:0.8rem; background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:12px;">COMBO</span>
            </div>
            <div style="padding:1.5rem;">
                <h5 style="margin:0 0 1rem; color:#1e293b; font-size:1.1rem; font-weight:700;">${nombre}</h5>
                
                <div style="background:#f8fafc; border-radius:0.75rem; padding:1rem; margin-bottom:1rem;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; color:#64748b; font-size:0.9rem;">
                        <span>Subtotal (${productosElegidosData.length} prod):</span>
                        <span style="text-decoration:line-through;">$${formatearPrecio(subtotalCombo)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; color:#ef4444; font-size:0.9rem; font-weight:600;">
                        <span>Descuento aplicado:</span>
                        <span>-$${formatearPrecio(ahorroCombo)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; padding-top:0.5rem; border-top:1px dashed #ced4da; color:#1e293b; font-size:1.2rem; font-weight:900;">
                        <span>VALOR COMBO:</span>
                        <span style="color:#ff6b00;">$${formatearPrecio(totalCombo)}</span>
                    </div>
                </div>

                <p style="margin:0; font-size:0.75rem; color:#94a3b8; text-align:center;">
                    * El precio final se aplica automáticamente al agregar los productos.
                </p>
            </div>
        </div>
    `;
}

// Inicializar sección de promociones
document.addEventListener('DOMContentLoaded', () => {
    const promoLink = document.querySelector('a[href="#promocionesSection"]');
    if (promoLink) {
        promoLink.onclick = () => {
            mostrarSeccion('promocionesSection');
            cargarPromociones();
        };
    }

    // Si ya estamos en la sección al cargar
    if (window.location.hash === '#promocionesSection') {
        cargarPromociones();
    }
});

// Registrar funciones globales
window.mostrarFormPromocion = mostrarFormPromocion;
window.cancelarFormPromocion = cancelarFormPromocion;
window.guardarPromocion = guardarPromocion;
window.editarPromocion = editarPromocion;
window.eliminarPromocion = eliminarPromocion;
window.cargarPromociones = cargarPromociones;
window.toggleProductoPromo = toggleProductoPromo;
window.filtrarProductosPromo = filtrarProductosPromo;
window.limpiarSeleccionPromo = limpiarSeleccionPromo;
window.actualizarPreviewPromo = actualizarPreviewPromo;

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE CATEGORÍAS
// ═══════════════════════════════════════════════════════════════

async function cargarCategorias() {
    try {
        const { data, error } = await supabaseClient
            .from('categorias')
            .select('*')
            .order('nombre');

        if (error) {
            if (error.code === 'PGRST116' || error.message.includes('relation "categorias" does not exist')) {
                showToast('La tabla "categorias" no existe en la DB. Por favor créala.', 'error');
                return;
            }
            throw error;
        }

        const tbody = document.getElementById('tbodyCategorias');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center" style="padding:2rem;">📂 No hay categorías registradas.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(cat => `
            <tr>
                <td style="font-size: 1.5rem; text-align:center;">${cat.icono || '📁'}</td>
                <td style="font-weight: 600;">${cat.nombre}</td>
                <td style="text-align:right;">
                    <div class="btn-group">
                        <button class="btn btn-sm btn-secondary" onclick="editarCategoria('${cat.id}', '${cat.nombre}', '${cat.icono || ''}')" title="Editar">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="eliminarCategoria('${cat.id}', '${cat.nombre}')" title="Eliminar">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');

        actualizarSelectsCategorias(data);

    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando categorías:', error);
        showToast('Error al cargar categorías', 'error');
    }
}

function mostrarFormCategoria() {
    const form = document.getElementById('formCategoria');
    if (form) form.style.display = 'flex';

    document.getElementById('formTituloCategoria').textContent = '➕ Nueva Categoría';
    document.getElementById('categoriaId').value = '';
    document.getElementById('categoriaNombre').value = '';
    document.getElementById('categoriaIcono').value = '';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarFormCategoria() {
    document.getElementById('formCategoria').style.display = 'none';
}

function editarCategoria(id, nombre, icono) {
    document.getElementById('formCategoria').style.display = 'flex';
    document.getElementById('formTituloCategoria').textContent = '✏️ Editar Categoría';
    document.getElementById('categoriaId').value = id;
    document.getElementById('categoriaNombre').value = nombre;
    document.getElementById('categoriaIcono').value = icono;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function guardarCategoria() {
    const id = document.getElementById('categoriaId').value;
    const nombre = document.getElementById('categoriaNombre').value.trim();
    const icono = document.getElementById('categoriaIcono').value.trim();

    if (!nombre) {
        showToast('El nombre de la categoría es obligatorio', 'warning');
        return;
    }

    try {
        const payload = { nombre, icono };
        let res;

        if (id) {
            res = await supabaseClient.from('categorias').update(payload).eq('id', id);
        } else {
            res = await supabaseClient.from('categorias').insert([payload]);
        }

        if (res.error) throw res.error;

        showToast(`Categoría ${id ? 'actualizada' : 'creada'} con éxito`);

        if (window.moterosIA) {
            window.moterosIA.aprenderEvento(`${id ? 'Editó' : 'Creó'} la categoría: ${nombre}`);
        }

        cancelarFormCategoria();
        cargarCategorias();

    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error guardando categoría:', error);
        showToast('Error al guardar la categoría', 'error');
    }
}

async function eliminarCategoria(id, nombre) {
    if (!confirm(`¿Estás seguro de eliminar la categoría "${nombre}"?`)) return;

    try {
        const { error } = await supabaseClient.from('categorias').delete().eq('id', id);
        if (error) throw error;

        showToast('Categoría eliminada');

        if (window.moterosIA) {
            window.moterosIA.aprenderEvento(`Eliminó la categoría: ${nombre}`);
        }

        cargarCategorias();
    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error eliminando categoría:', error);
        showToast('Error al eliminar la categoría', 'error');
    }
}

function actualizarSelectsCategorias(categorias) {
    const selectProducto = document.getElementById('productoCategoria');
    if (selectProducto) {
        const valorActual = selectProducto.value;
        selectProducto.innerHTML = `
            <option value="">Seleccionar...</option>
            ${categorias.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}
        `;
        selectProducto.value = valorActual;
    }
}

window.mostrarFormCategoria = mostrarFormCategoria;
window.cancelarFormCategoria = cancelarFormCategoria;
window.guardarCategoria = guardarCategoria;
window.editarCategoria = editarCategoria;
window.eliminarCategoria = eliminarCategoria;
window.cargarCategorias = cargarCategorias;
// ═══════════════════════════════════════════════════════════════
// Redundant Leads IA implementation removed. Management consolidated at the end of the file.

// ═══════════════════════════════════════════════════════════════
// TRASLADOS, COMENTARIOS Y RESEÑAS
// ═══════════════════════════════════════════════════════════════

async function cargarTraslados() {
    try {
        const { data, error } = await supabaseClient
            .from('movimientos_transferencia')
            .select('*, productos(nombre)') // Attempt to join if FK exists, else fallback
            .order('created_at', { ascending: false });

        if (error) {
            // Fallback if relation doesn't exist
            const { data: simpleData } = await supabaseClient
                .from('movimientos_transferencia')
                .select('*')
                .order('created_at', { ascending: false });

            if (!simpleData) return;

            // Fetch product names for missing ones
            const missingIds = [...new Set(simpleData.filter(t => !t.nombre_producto).map(t => t.id_producto))];
            let productMap = {};

            if (missingIds.length > 0) {
                const { data: prods } = await supabaseClient.from('productos').select('id, id_producto, nombre').in('id_producto', missingIds);
                (prods || []).forEach(p => productMap[p.id_producto] = p.nombre);
            }

            renderTablaTraslados(simpleData, productMap);
            return;
        }

        renderTablaTraslados(data);

    } catch (e) { console.error(e); }
}

function renderTablaTraslados(data, extraMap = {}) {
    const tbody = document.getElementById('tbodyTraslados');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay traslados registrados</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(t => {
        // Prefer stored name, then joined name, then map, then ID
        const name = t.nombre_producto || t.productos?.nombre || extraMap[t.id_producto] || t.id_producto;

        return `
            <tr>
                <td>${new Date(t.created_at).toLocaleDateString()} ${new Date(t.created_at).toLocaleTimeString()}</td>
                <td><strong>${name}</strong></td>
                <td>${t.cantidad}</td>
                <td><span class="badge badge-info">${t.origen || 'N/A'}</span></td>
                <td><span class="badge badge-primary">${t.destino || 'N/A'}</span></td>
                <td><small>${t.usuario || '-'}</small></td>
            </tr>
        `;
    }).join('');
}

async function cargarFeedback() {
    await Promise.all([cargarComentarios(), cargarResenas()]);
}

async function cargarComentarios() {
    try {
        // Cargar comentarios con información del post
        const { data: comentarios, error } = await supabaseClient
            .from('blog_comentarios')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Cargar posts para mostrar títulos
        const { data: posts } = await supabaseClient
            .from('posts') // Corregido: La tabla se llama 'posts', no 'blog_posts'
            .select('id, titulo');

        const postsMap = {};
        (posts || []).forEach(p => postsMap[p.id] = p.titulo);

        const tbody = document.getElementById('tbodyComentarios');
        if (!tbody) return;

        if (!comentarios || comentarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay comentarios registrados</td></tr>';
            if (document.getElementById('statsComentarios')) document.getElementById('statsComentarios').textContent = '0';
            return;
        }

        tbody.innerHTML = comentarios.map(c => {
            // Manejar aprobado como string o boolean (robusto)
            const raw = c.aprobado;
            const estaAprobado = raw === true || String(raw).toLowerCase() === 'true';
            const tituloPost = postsMap[c.post_id] || 'Post eliminado';

            return `
            <tr>
                <td>${new Date(c.created_at).toLocaleDateString()} ${new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td><strong>${c.nombre_usuario || 'Anónimo'}</strong></td>
                <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis;">${c.comentario || ''}</td>
                <td style="font-size:0.85rem; color:#666;">${tituloPost}</td>
                <td><span class="badge ${estaAprobado ? 'badge-success' : 'badge-warning'}">${estaAprobado ? '✅ Aprobado' : '⏳ Pendiente'}</span></td>
                <td>
                    <div style="display:flex; gap:0.3rem;">
                        ${!estaAprobado ? `<button class="btn btn-sm btn-success" onclick="aprobarComentario('${c.id}')" title="Aprobar">✅</button>` : ''}
                        <button class="btn btn-sm btn-danger" onclick="eliminarComentario('${c.id}')" title="Eliminar">🗑️</button>
                    </div>
                </td>
            </tr>
        `}).join('');

        const pendientes = comentarios.filter(c => {
            const raw = c.aprobado;
            return !(raw === true || String(raw).toLowerCase() === 'true');
        }).length;

        if (document.getElementById('statsComentarios')) {
            document.getElementById('statsComentarios').textContent = pendientes;
        }
    } catch (e) {
        console.error('Error cargando comentarios:', e);
        const tbody = document.getElementById('tbodyComentarios');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error: ${e.message}</td></tr>`;
        }
    }
}

async function cargarResenas() {
    try {
        const { data, error } = await supabaseClient
            .from('producto_resenas')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        const tbody = document.getElementById('tbodyResenas');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay reseñas registradas</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(r => `
            <tr>
                <td>${new Date(r.created_at).toLocaleDateString()}</td>
                <td>${r.nombre_cliente}</td>
                <td>${r.id_producto || 'Sitio'}</td>
                <td>${'⭐'.repeat(r.estrellas)}</td>
                <td>${r.comentario}</td>
            </tr>
        `).join('');

        const avg = data.length > 0 ? (data.reduce((sum, r) => sum + r.estrellas, 0) / data.length).toFixed(1) : '0.0';
        if (document.getElementById('statsCalificacion')) document.getElementById('statsCalificacion').textContent = avg;
    } catch (e) { console.error(e); }
}

async function aprobarComentario(id) {
    if (!confirm('¿Aprobar este comentario?')) return;
    try {
        const { error } = await supabaseClient.from('blog_comentarios').update({ aprobado: true }).eq('id', id);
        if (error) throw error;
        showToast('Comentario aprobado', 'success');
        cargarComentarios();
    } catch (e) { showToast('Error al aprobar', 'error'); }
}

async function eliminarComentario(id) {
    if (!confirm('¿Eliminar este comentario?')) return;
    try {
        const { error } = await supabaseClient.from('blog_comentarios').delete().eq('id', id);
        if (error) throw error;
        showToast('Comentario eliminado', 'success');
        cargarComentarios();
    } catch (e) { showToast('Error al eliminar', 'error'); }
}

window.aprobarComentario = aprobarComentario;
window.eliminarComentario = eliminarComentario;
window.calcularPorcentajesLocales = calcularPorcentajesLocales;

// Redundant Leads IA window exports removed.

window.actualizarSelectsCategorias = actualizarSelectsCategorias;

// Función helper restaurada de admin-helpers.js
// Variables globales para instancias de gráficos de ventas (sección dedicada)
let chartVentasMetodosInstance = null;
let chartVentasLocalesInstance = null;

function actualizarGraficosVentas(datos) {
    // 1. Gráfico Métodos de Pago
    const ctxMetodos = document.getElementById('chartMetodosPago');
    if (ctxMetodos) {
        // Destruir anterior si existe
        if (chartVentasMetodosInstance) {
            chartVentasMetodosInstance.destroy();
            chartVentasMetodosInstance = null;
        }

        const porMetodo = {};
        datos.forEach(v => {
            const metodo = v.metodo_pago || 'Otros';
            porMetodo[metodo] = (porMetodo[metodo] || 0) + (v.total || 0);
        });

        const labels = Object.keys(porMetodo);
        const data = Object.values(porMetodo);

        if (labels.length > 0) {
            chartVentasMetodosInstance = new Chart(ctxMetodos, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right' },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const value = context.raw || 0;
                                    const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                                    const porcentaje = ((value / total) * 100).toFixed(1) + '%';
                                    return `${context.label}: $${value.toLocaleString('es-CO')} (${porcentaje})`;
                                }
                            }
                        }
                    }
                }
            });
        }
    }

    // 2. Gráfico Por Local
    const ctxLocales = document.getElementById('chartVentasLocales');
    if (ctxLocales) {
        if (chartVentasLocalesInstance) {
            chartVentasLocalesInstance.destroy();
            chartVentasLocalesInstance = null;
        }

        const porLocal = {};
        datos.forEach(v => {
            const local = v.local || 'General';
            porLocal[local] = (porLocal[local] || 0) + (v.total || 0);
        });

        const labelsLocales = Object.keys(porLocal);
        const dataLocales = Object.values(porLocal);

        if (labelsLocales.length > 0) {
            chartVentasLocalesInstance = new Chart(ctxLocales, {
                type: 'bar', // Cambiado a barras horizontales para mejor lectura de nombres largos si los hubiera, o vertical
                data: {
                    labels: labelsLocales,
                    datasets: [{
                        label: 'Ventas ($)',
                        data: dataLocales,
                        backgroundColor: ['#f97316', '#22c55e', '#3b82f6', '#8b5cf6'],
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
                                    return `$${context.raw.toLocaleString('es-CO')}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { callback: (val) => '$' + val.toLocaleString('es-CO', { notation: 'compact' }) }
                        }
                    }
                }
            });
        }
    }
}
window.actualizarGraficosVentas = actualizarGraficosVentas;

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE PROVEEDORES
// ═══════════════════════════════════════════════════════════════

async function cargarProveedores() {
    try {
        const { data, error } = await supabaseClient
            .from('proveedores')
            .select('*')
            .order('razon_social', { ascending: true });

        if (error) throw error;
        todosProveedores = data || [];
        renderizarProveedores(todosProveedores);
    } catch (e) {
        console.error(e);
        showToast('Error cargando proveedores', 'error');
    }
}

function renderizarProveedores(lista) {
    const tbody = document.getElementById('tbodyProveedores');
    if (!tbody) return;

    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay proveedores registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(p => `
        <tr>
            <td><strong>${p.razon_social}</strong><br><small class="text-muted">${p.nit || ''}</small></td>
            <td>${p.contacto_nombre || '-'}</td>
            <td>${p.contacto_telefono || '-'}</td>
            <td><span class="badge badge-info">${p.condicion_pago || 'Contado'}</span></td>
            <td><strong>$${formatearPrecio(p.saldo_pendiente || 0)}</strong></td>
            <td><span class="badge ${p.activo ? 'badge-success' : 'badge-secondary'}">${p.activo ? 'Activo' : 'Inactivo'}</span></td>
            <td style="text-align:right;">
                <button class="btn-icon blue" onclick="editarProveedor('${p.id}', \`${p.razon_social.replace(/`/g, '\\`')}\`, '${p.contacto_nombre || ''}', '${p.contacto_telefono || ''}', '${p.condicion_pago || ''}', '${p.contacto_email || ''}', \`${(p.notas || '').replace(/`/g, '\\`')}\`, '${p.banco || ''}', '${p.tipo_cuenta || ''}', '${p.numero_cuenta || ''}', '${p.titular_cuenta || ''}')" title="Editar">✏️</button>
                <button class="btn-icon red" onclick="eliminarProveedor('${p.id}', \`${p.razon_social.replace(/`/g, '\\`')}\`)" title="Eliminar">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function mostrarFormProveedor() {
    limpiarFormProveedor();
    document.getElementById('formProveedor').style.display = 'block';
    document.getElementById('formTituloProveedor').textContent = '➕ Nuevo Proveedor';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarFormProveedor() {
    document.getElementById('formProveedor').style.display = 'none';
    limpiarFormProveedor();
}

function limpiarFormProveedor() {
    const ids = ['proveedorId', 'proveedorNombre', 'proveedorNit', 'proveedorContacto', 'proveedorTelefono', 'proveedorEmail', 'proveedorDireccion', 'proveedorNotas', 'proveedorBanco', 'proveedorNumeroCuenta', 'proveedorTitular'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const cond = document.getElementById('proveedorCondicion');
    if (cond) cond.value = 'contado';
    const tipo = document.getElementById('proveedorTipoCuenta');
    if (tipo) tipo.value = '';
}

function editarProveedor(id, nombre, contacto, telefono, condicion, email, notas, banco, tipoCuenta, numeroCuenta, titular) {
    mostrarFormProveedor();
    document.getElementById('formTituloProveedor').textContent = '✏️ Editar Proveedor';
    document.getElementById('proveedorId').value = id;
    document.getElementById('proveedorNombre').value = nombre;
    document.getElementById('proveedorContacto').value = contacto !== 'null' && contacto !== 'undefined' ? contacto : '';
    document.getElementById('proveedorTelefono').value = telefono !== 'null' && telefono !== 'undefined' ? telefono : '';
    document.getElementById('proveedorEmail').value = email !== 'null' && email !== 'undefined' ? email : '';
    document.getElementById('proveedorCondicion').value = condicion || 'contado';
    document.getElementById('proveedorNotas').value = notas !== 'null' && notas !== 'undefined' ? notas : '';

    if (document.getElementById('proveedorBanco')) document.getElementById('proveedorBanco').value = banco && banco !== 'null' ? banco : '';
    if (document.getElementById('proveedorTipoCuenta')) document.getElementById('proveedorTipoCuenta').value = tipoCuenta && tipoCuenta !== 'null' ? tipoCuenta : '';
    if (document.getElementById('proveedorNumeroCuenta')) document.getElementById('proveedorNumeroCuenta').value = numeroCuenta && numeroCuenta !== 'null' ? numeroCuenta : '';
    if (document.getElementById('proveedorTitular')) document.getElementById('proveedorTitular').value = titular && titular !== 'null' ? titular : '';
}

async function guardarProveedor() {
    const id = document.getElementById('proveedorId').value;
    const nombre = document.getElementById('proveedorNombre').value.trim();
    if (!nombre) { showToast('La Razón Social es obligatoria', 'warning'); return; }

    const payload = {
        razon_social: nombre,
        nit: document.getElementById('proveedorNit').value.trim(),
        contacto_nombre: document.getElementById('proveedorContacto').value.trim(),
        contacto_telefono: document.getElementById('proveedorTelefono').value.trim(),
        contacto_email: document.getElementById('proveedorEmail').value.trim(),
        direccion: document.getElementById('proveedorDireccion') ? document.getElementById('proveedorDireccion').value.trim() : null,
        condicion_pago: document.getElementById('proveedorCondicion').value,
        notas: document.getElementById('proveedorNotas').value.trim(),
        banco: document.getElementById('proveedorBanco') ? document.getElementById('proveedorBanco').value.trim() : null,
        tipo_cuenta: document.getElementById('proveedorTipoCuenta') ? document.getElementById('proveedorTipoCuenta').value.trim() : null,
        numero_cuenta: document.getElementById('proveedorNumeroCuenta') ? document.getElementById('proveedorNumeroCuenta').value.trim() : null,
        titular_cuenta: document.getElementById('proveedorTitular') ? document.getElementById('proveedorTitular').value.trim() : null,
        activo: true
    };

    try {
        if (id) {
            const { error } = await supabaseClient.from('proveedores').update(payload).eq('id', id);
            if (error) throw error;
            showToast('Proveedor actualizado');
        } else {
            const { error } = await supabaseClient.from('proveedores').insert([payload]);
            if (error) throw error;
            showToast('Proveedor creado');
        }
        cancelarFormProveedor();
        cargarProveedores();
    } catch (e) {
        showToast('Error guardando proveedor: ' + e.message, 'error');
    }
}

async function eliminarProveedor(id, nombre) {
    if (!confirm(`¿Eliminar proveedor ${nombre}?`)) return;
    try {
        const { error } = await supabaseClient.from('proveedores').delete().eq('id', id);
        if (error) throw error;
        showToast('Proveedor eliminado');
        cargarProveedores();
    } catch (e) {
        showToast('Error eliminando: ' + e.message, 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE EMPLEADOS (RRHH)
// ═══════════════════════════════════════════════════════════════

async function cargarEmpleados() {
    try {
        const { data, error } = await supabaseClient.from('empleados_tienda').select('*').order('nombre');
        if (error) throw error;

        const tbody = document.getElementById('tablaEmpleados');
        if (!tbody) return;

        if (!data || !data.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay empleados registrados.</td></tr>';
            // Update stats
            if (document.getElementById('statTotalEmpleados')) {
                document.getElementById('statTotalEmpleados').textContent = '0';
                document.getElementById('statEmpleadosActivos').textContent = '0';
                document.getElementById('statNominaTotal').textContent = '$0';
            }
            return;
        }

        tbody.innerHTML = data.map(u => `
            <tr>
                <td>
                    <strong>${u.nombre}</strong><br>
                    <small style="color:#64748b;">${u.cedula || 'Sin cédula'}</small>
                </td>
                <td>${u.usuario}</td>
                <td>${u.cargo || 'Vendedor'}</td>
                <td><small>${Array.isArray(u.tiendas_permitidas) ? u.tiendas_permitidas.join(', ') : (u.tiendas_permitidas || 'Todas')}</small></td>
                <td>
                    ${formatearPrecio(u.salario_base || 0)}
                    ${u.auxilio_transporte > 0 ? `<br><small style="color:green">+${formatearPrecio(u.auxilio_transporte)} aux</small>` : ''}
                </td>
                <td>
                    <span class="badge ${u.activo ? 'badge-success' : 'badge-secondary'}">
                        ${u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>
                     <button class="btn-icon blue" onclick="editarEmpleado('${u.id}')" title="Editar">✏️</button>
                     <button class="btn-icon red" onclick="eliminarEmpleado('${u.id}', '${u.nombre}')" title="Eliminar">🗑️</button>
                </td>
            </tr>
        `).join('');

        // Update statistics
        if (document.getElementById('statTotalEmpleados')) {
            document.getElementById('statTotalEmpleados').textContent = data.length;
            document.getElementById('statEmpleadosActivos').textContent = data.filter(e => e.activo).length;
            const nominaTotal = data.reduce((sum, e) => sum + (e.salario_base || 0), 0);
            document.getElementById('statNominaTotal').textContent = '$' + formatearPrecio(nominaTotal);
        }
    } catch (e) {
        console.error(e);
        const tbody = document.getElementById('tablaEmpleados');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error cargando empleados: ' + e.message + '</td></tr>';
    }
}

function mostrarModalEmpleado() {
    document.getElementById('formEmpleado').style.display = 'block';
    document.getElementById('formTituloEmpleado').textContent = '➕ Nuevo Empleado';
    limpiarFormEmpleado();
}

function cancelarFormEmpleado() {
    document.getElementById('formEmpleado').style.display = 'none';
}

function limpiarFormEmpleado() {
    document.getElementById('empleadoId').value = '';
    document.getElementById('empleadoNombre').value = '';
    document.getElementById('empleadoUsuario').value = '';
    document.getElementById('empleadoCedula').value = '';
    document.getElementById('empleadoSangre').value = '';
    document.getElementById('empleadoCargo').value = 'Vendedor';
    document.getElementById('empleadoEstado').value = 'true';
    document.getElementById('empleadoTiendas').value = '';
    document.getElementById('empleadoEmergenciaNombre').value = '';
    document.getElementById('empleadoEmergenciaTel').value = '';

    // Contratación y Nómina
    document.getElementById('empleadoContrato').value = 'Fijo';
    document.getElementById('empleadoFrecuencia').value = 'Quincenal';
    document.getElementById('empleadoSalario').value = '';
    document.getElementById('empleadoAuxilio').value = '';
    document.getElementById('empleadoDeduccionesLey').value = '';
    document.getElementById('empleadoOtrosDescuentos').value = '';
    document.getElementById('empleadoNetoPagar').textContent = '$0';

    document.getElementById('empleadoPassword').value = '';
}

function calcularNetoEmpleado() {
    const salario = parseFloat(document.getElementById('empleadoSalario').value) || 0;
    const auxilio = parseFloat(document.getElementById('empleadoAuxilio').value) || 0;
    const ley = parseFloat(document.getElementById('empleadoDeduccionesLey').value) || 0;
    const otros = parseFloat(document.getElementById('empleadoOtrosDescuentos').value) || 0;

    const neto = salario + auxilio - ley - otros;
    document.getElementById('empleadoNetoPagar').textContent = formatearPrecio(neto);
}

async function guardarEmpleado() {
    const id = document.getElementById('empleadoId').value;
    const nombre = document.getElementById('empleadoNombre').value.trim();
    const usuario = document.getElementById('empleadoUsuario').value.trim();
    const cedula = document.getElementById('empleadoCedula').value.trim();
    const tipo_sangre = document.getElementById('empleadoSangre').value;
    const cargo = document.getElementById('empleadoCargo').value;
    const tiendaStr = document.getElementById('empleadoTiendas').value.trim();
    const tiendas_permitidas = tiendaStr ? tiendaStr.split(',').map(s => s.trim()) : null; // null = todas
    const activo = document.getElementById('empleadoEstado').value === 'true';
    const password = document.getElementById('empleadoPassword').value;

    const contacto_emergencia_nombre = document.getElementById('empleadoEmergenciaNombre').value.trim();
    const contacto_emergencia_telefono = document.getElementById('empleadoEmergenciaTel').value.trim();

    // Financiero
    const tipo_contrato = document.getElementById('empleadoContrato').value;
    const frecuencia_pago = document.getElementById('empleadoFrecuencia').value;
    const salario_base = parseFloat(document.getElementById('empleadoSalario').value) || 0;
    const auxilio_transporte = parseFloat(document.getElementById('empleadoAuxilio').value) || 0;
    const descuentos_ley = parseFloat(document.getElementById('empleadoDeduccionesLey').value) || 0;
    const otros_descuentos = parseFloat(document.getElementById('empleadoOtrosDescuentos').value) || 0;

    if (!nombre || !usuario) { showToast('Nombre y Usuario son obligatorios', 'warning'); return; }
    if (!id && !password) { showToast('La contraseña es obligatoria para nuevos empleados', 'warning'); return; }

    const payload = {
        nombre, usuario, cedula, cargo, tiendas_permitidas, activo,
        contacto_emergencia_nombre, contacto_emergencia_telefono, tipo_sangre,
        tipo_contrato, frecuencia_pago, salario_base, auxilio_transporte, descuentos_ley, otros_descuentos
    };
    if (password) payload.password = password;

    try {
        if (id) {
            const { error } = await supabaseClient.from('empleados_tienda').update(payload).eq('id', id);
            if (error) throw error;
            showToast('Empleado actualizado');
        } else {
            const { error } = await supabaseClient.from('empleados_tienda').insert([payload]);
            if (error) throw error;
            showToast('Empleado creado');
        }
        cancelarFormEmpleado();
        cargarEmpleados();
    } catch (e) {
        console.error(e);
        showToast('Error: ' + e.message, 'error');
    }
}

async function editarEmpleado(id) {
    try {
        const { data, error } = await supabaseClient.from('empleados_tienda').select('*').eq('id', id).single();
        if (error) throw error;

        mostrarModalEmpleado();
        document.getElementById('formTituloEmpleado').textContent = '✏️ Editar Empleado';
        document.getElementById('empleadoId').value = data.id;
        document.getElementById('empleadoNombre').value = data.nombre;
        document.getElementById('empleadoUsuario').value = data.usuario;
        document.getElementById('empleadoCedula').value = data.cedula || '';
        document.getElementById('empleadoSangre').value = data.tipo_sangre || '';
        document.getElementById('empleadoCargo').value = data.cargo || 'Vendedor';
        document.getElementById('empleadoTiendas').value = Array.isArray(data.tiendas_permitidas) ? data.tiendas_permitidas.join(', ') : '';
        document.getElementById('empleadoEstado').value = data.activo ? 'true' : 'false';

        document.getElementById('empleadoEmergenciaNombre').value = data.contacto_emergencia_nombre || '';
        document.getElementById('empleadoEmergenciaTel').value = data.contacto_emergencia_telefono || '';

        document.getElementById('empleadoContrato').value = data.tipo_contrato || 'Fijo';
        document.getElementById('empleadoFrecuencia').value = data.frecuencia_pago || 'Quincenal';
        document.getElementById('empleadoSalario').value = data.salario_base || '';
        document.getElementById('empleadoAuxilio').value = data.auxilio_transporte || '';
        document.getElementById('empleadoDeduccionesLey').value = data.descuentos_ley || '';
        document.getElementById('empleadoOtrosDescuentos').value = data.otros_descuentos || '';

        document.getElementById('empleadoPassword').value = '';
        calcularNetoEmpleado();

    } catch (e) {
        console.error(e);
        showToast('Error cargando empleado', 'error');
    }
}

async function eliminarEmpleado(id, nombre) {
    if (!confirm(`¿Eliminar al empleado ${nombre}? Esta acción no se puede deshacer.`)) return;
    try {
        const { error } = await supabaseClient.from('empleados_tienda').delete().eq('id', id);
        if (error) throw error;
        showToast('Empleado eliminado permanentemente');
        cargarEmpleados();
    } catch (e) {
        showToast('Error eliminando: ' + e.message, 'error');
    }
}

// Exports
window.cargarProveedores = cargarProveedores;
window.guardarProveedor = guardarProveedor;
window.editarProveedor = editarProveedor;
window.eliminarProveedor = eliminarProveedor;
window.mostrarFormProveedor = mostrarFormProveedor;
window.cancelarFormProveedor = cancelarFormProveedor;

window.cargarEmpleados = cargarEmpleados;
window.guardarEmpleado = guardarEmpleado;
window.editarEmpleado = editarEmpleado;
window.eliminarEmpleado = eliminarEmpleado;
window.mostrarModalEmpleado = mostrarModalEmpleado;
window.cancelarFormEmpleado = cancelarFormEmpleado;

// Redundant Leads IA implementation removed.

// Redundant Leads IA implementation removed from middle of file. Consistently managed at the end.

// ═══════════════════════════════════════════════════════════════
// ALERTAS DE STOCK
// ═══════════════════════════════════════════════════════════════

async function cargarAlertasStock() {
    try {
        const { data: productosData, error: errorProd } = await supabaseClient.from('productos').select('*');
        if (errorProd) throw errorProd;

        // Cargar inventarios si no están cargados
        if (!inventarios.alcala.length) await cargarTodosLosInventarios();

        const configStockMin = document.getElementById('configStockMinimo');
        const stockMinimoGlobal = configStockMin ? parseInt(configStockMin.value) || 5 : 5;

        const alertas = [];
        const tiendas = ['alcala', 'local01', 'jordan', 'digital'];

        productosData.forEach(p => {
            // Calcular stock total sumando inventarios locales
            let stockTotal = 0;
            tiendas.forEach(t => {
                const item = inventarios[t]?.find(i => i.id_producto === p.id);
                if (item) stockTotal += item.cantidad;
            });

            if (stockTotal <= stockMinimoGlobal && p.estado === 'Activo') {
                alertas.push({
                    producto: p,
                    tipo: 'critico',
                    mensaje: `Stock total crítico (${stockTotal} unid.)`
                });
            }

            // Verificar por tienda
            tiendas.forEach(tienda => {
                const stockTienda = inventarios[tienda]?.find(i => i.id_producto === p.id)?.cantidad || 0;
                if (stockTienda <= 2 && p.estado === 'Activo') { // Alerta específica
                    alertas.push({
                        producto: p,
                        tipo: 'tienda',
                        mensaje: `Bajo stock en ${tienda} (${stockTienda} unid.)`
                    });
                }
            });
        });

        const contenedor = document.getElementById('contenidoAlertas');
        if (!contenedor) return;

        if (alertas.length === 0) {
            contenedor.innerHTML = '<div class="alert alert-success">✅ Todo el inventario está saludable.</div>';
            return;
        }

        contenedor.innerHTML = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Referencia</th>
                            <th>Alerta</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${alertas.map(a => `
                            <tr>
                                <td>${a.producto.nombre}</td>
                                <td>${a.producto.referencia || '-'}</td>
                                <td><span class="badge ${a.tipo === 'critico' ? 'badge-danger' : 'badge-warning'}">${a.mensaje}</span></td>
                                <td>
                                    <button class="btn-icon blue" onclick="editarProducto('${a.producto.id}')" title="Ver Producto">✏️</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

    } catch (e) {
        console.error('Error cargando alertas:', e);
        const contenedor = document.getElementById('contenidoAlertas');
        if (contenedor) contenedor.innerHTML = '<p class="text-danger">Error calculando alertas de stock.</p>';
    }
}

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE COMENTARIOS (ADMIN)
// ═══════════════════════════════════════════════════════════════
async function cargarComentariosAdmin() {
    try {
        const tbody = document.getElementById('tbodyComentarios');
        if (!tbody) {
            // Si no existe el ID específico, intentamos buscar el contenedor genérico o salir
            return;
        }

        const { data, error } = await supabaseClient
            .from('blog_comentarios')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || !data.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay comentarios registrados.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(c => `
            <tr>
                <td>${formatearFecha(c.created_at)}</td>
                <td>${c.nombre_usuario}<br><small>${c.email_usuario || '-'}</small></td>
                <td>${c.comentario}</td>
                <td>
                    <span class="badge ${c.aprobado ? 'badge-success' : 'badge-warning'}">
                        ${c.aprobado ? 'Aprobado' : 'Pendiente'}
                    </span>
                </td>
                <td>
                    ${!c.aprobado ?
                `<button class="btn-icon green" onclick="aprobarComentario('${c.id}')" title="Aprobar">✅</button>` :
                `<button class="btn-icon yellow" onclick="desaprobarComentario('${c.id}')" title="Ocultar">🚫</button>`
            }
                    <button class="btn-icon red" onclick="eliminarComentario('${c.id}')" title="Eliminar">🗑️</button>
                </td>
            </tr>
        `).join('');

    } catch (e) {
        console.error('Error cargando comentarios:', e);
        const tbody = document.getElementById('tbodyComentarios');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error cargando comentarios</td></tr>';
    }
}

async function aprobarComentario(id) {
    try {
        const { error } = await supabaseClient.from('blog_comentarios').update({ aprobado: true }).eq('id', id);
        if (error) throw error;
        showToast('Comentario aprobado');
        cargarComentariosAdmin();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

async function desaprobarComentario(id) {
    try {
        const { error } = await supabaseClient.from('blog_comentarios').update({ aprobado: false }).eq('id', id);
        if (error) throw error;
        showToast('Comentario ocultado');
        cargarComentariosAdmin();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

async function eliminarComentario(id) {
    if (!confirm('¿Eliminar este comentario permanentemente?')) return;
    try {
        const { error } = await supabaseClient.from('blog_comentarios').delete().eq('id', id);
        if (error) throw error;
        showToast('Comentario eliminado');
        cargarComentariosAdmin();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

window.cargarComentariosAdmin = cargarComentariosAdmin;
window.aprobarComentario = aprobarComentario;
window.desaprobarComentario = desaprobarComentario;
window.eliminarComentario = eliminarComentario;

window.cargarAlertasStock = cargarAlertasStock;

// ═══════════════════════════════════════════════════════════════
// COMISIONES
// ═══════════════════════════════════════════════════════════════

async function cargarComisiones() {
    try {
        const tbody = document.getElementById('tbodyComisiones');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando comisiones...</td></tr>';

        // TODO: Implementar lógica completa de comisiones
        // Por ahora mostrar mensaje de desarrollo
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center" style="padding:2rem;">
                    <div style="color:#94a3b8;">
                        <div style="font-size:2rem;margin-bottom:0.5rem;">🚧</div>
                        <strong>Sistema de Comisiones en Desarrollo</strong>
                        <p style="margin-top:0.5rem;font-size:0.9rem;">
                            Esta funcionalidad estará disponible próximamente.<br>
                            Se calculará automáticamente basado en las ventas de cada empleado.
                        </p>
                    </div>
                </td>
            </tr>
        `;

        // Update stats
        if (document.getElementById('statComisionesTotales')) {
            document.getElementById('statComisionesTotales').textContent = '$0';
            document.getElementById('statVentasComisionables').textContent = '$0';
            document.getElementById('statEmpleadosComision').textContent = '0';
        }

    } catch (e) {
        console.error('Error cargando comisiones:', e);
        const tbody = document.getElementById('tbodyComisiones');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error cargando comisiones</td></tr>';
    }
}

function filtrarEmpleados() {
    const termino = document.getElementById('buscarEmpleado')?.value.toLowerCase() || '';
    const filas = document.querySelectorAll('#tbodyEmpleados tr');

    filas.forEach(fila => {
        const texto = fila.textContent.toLowerCase();
        fila.style.display = texto.includes(termino) ? '' : 'none';
    });
}

function filtrarComisiones() {
    const termino = document.getElementById('buscarComision')?.value.toLowerCase() || '';
    const filas = document.querySelectorAll('#tbodyComisiones tr');

    filas.forEach(fila => {
        const texto = fila.textContent.toLowerCase();
        fila.style.display = texto.includes(termino) ? '' : 'none';
    });
}

window.cargarComisiones = cargarComisiones;
window.filtrarEmpleados = filtrarEmpleados;
window.filtrarComisiones = filtrarComisiones;

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE LOGS IA Y ERRORES
// ═══════════════════════════════════════════════════════════════

function registrarLogSistema(tipo, mensaje, detalle = '') {
    const log = {
        timestamp: Date.now(),
        fecha: new Date().toLocaleString('es-CO'),
        tipo: tipo || 'info', // error_sistema, error_ia, info, warning
        mensaje: mensaje,
        detalle: typeof detalle === 'object' ? JSON.stringify(detalle) : detalle
    };

    let logs = [];
    try {
        logs = JSON.parse(localStorage.getItem('sys_logs') || '[]');
    } catch (e) { logs = []; }

    logs.unshift(log);
    if (logs.length > 50) logs.pop(); // Mantener solo los últimos 50 logs

    localStorage.setItem('sys_logs', JSON.stringify(logs));

    // Si estamos en la pantalla de configuración, actualizar visualmente
    if (document.getElementById('logsIaContainer')) {
        cargarLogsIA();
    }
}

function cargarLogsIA() {
    const container = document.getElementById('logsIaContainer');
    if (!container) return;

    let logs = [];
    try {
        logs = JSON.parse(localStorage.getItem('sys_logs') || '[]');
    } catch (e) {
        container.innerHTML = '<p class="text-danger">Error leyendo logs locales.</p>';
        return;
    }

    if (!logs.length) {
        container.innerHTML = '<p class="text-muted">No hay errores registrados recientemente.</p>';
        return;
    }

    container.innerHTML = logs.map(l => `
        <div style="border-bottom:1px solid #ddd; padding:0.5rem 0; font-family:monospace;">
            <strong style="color: ${l.tipo.includes('error') ? '#dc3545' : '#0d6efd'}">[${l.fecha}] ${l.tipo.toUpperCase()}:</strong>
            <span>${l.mensaje}</span>
            ${l.detalle ? `<br><small class="text-muted">${l.detalle}</small>` : ''}
        </div>
    `).join('');
}

window.registrarLogSistema = registrarLogSistema;

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE EVENTOS (NUEVA LÓGICA)
// ═══════════════════════════════════════════════════════════════

// --- 1. Multi-empleados ---
let empleadosDisponiblesCache = [];

async function agregarFilaEmpleadoEvento(datos = null) {
    const contenedor = document.getElementById('contenedorEmpleadosEvento');
    if (!contenedor) return;

    if (empleadosDisponiblesCache.length === 0) {
        const { data } = await supabaseClient.from('empleados_tienda').select('id, nombre').eq('activo', true);
        empleadosDisponiblesCache = data || [];
    }

    const div = document.createElement('div');
    div.className = 'fila-empleado-evento';
    div.style.display = 'grid';
    div.style.gridTemplateColumns = '1fr 1fr auto';
    div.style.gap = '10px';
    div.style.alignItems = 'center';

    const selectedId = datos ? datos.empleado_id : '';
    const valor = datos ? datos.valor_pactado : 0;

    div.innerHTML = `
        <select class="form-control emp-select" required>
            <option value="">Empleado...</option>
            ${empleadosDisponiblesCache.map(e => `<option value="${e.id}" ${String(e.id) === String(selectedId) ? 'selected' : ''}>${e.nombre}</option>`).join('')}
        </select>
        <input type="number" class="form-control emp-valor" placeholder="Valor ($)" value="${valor}">
        <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">×</button>
    `;

    contenedor.appendChild(div);
}

// --- 2. Crear / Editar Evento ---
window.nuevoEvento = function () {
    document.getElementById('eventoIdEdicion').value = '';
    document.getElementById('eventoNombre').value = '';
    document.getElementById('eventoFechaInicio').value = '';
    document.getElementById('eventoFechaFin').value = '';
    document.getElementById('eventoUbicacion').value = '';
    document.getElementById('eventoValorStand').value = '0';
    document.getElementById('eventoOtrosGastos').value = '0';
    document.getElementById('eventoGastosViaticos').value = '0';

    // Limpiar empleados
    const cont = document.getElementById('contenedorEmpleadosEvento');
    if (cont) cont.innerHTML = '';

    // Agregar una fila vacía por defecto
    agregarFilaEmpleadoEvento();

    document.getElementById('modalNuevoEvento').style.display = 'flex';
}

window.cerrarModalNuevoEvento = function () {
    document.getElementById('modalNuevoEvento').style.display = 'none';
}

window.editarEvento = async function (id) {
    try {
        const { data: evento, error } = await supabaseClient
            .from('eventos_tienda')
            .select('*, evento_personal(empleado_id, valor_pactado)')
            .eq('id', id)
            .single();

        if (error || !evento) throw new Error('Evento no encontrado');

        document.getElementById('eventoIdEdicion').value = evento.id;
        document.getElementById('eventoNombre').value = evento.nombre_evento;
        document.getElementById('eventoFechaInicio').value = evento.fecha_inicio;
        document.getElementById('eventoFechaFin').value = evento.fecha_fin;
        document.getElementById('eventoUbicacion').value = evento.ubicación || '';
        document.getElementById('eventoValorStand').value = evento.gastos || 0;
        document.getElementById('eventoOtrosGastos').value = evento.gastos_otros || 0;
        document.getElementById('eventoGastosViaticos').value = evento.gastos_alimentacion || 0;

        // Cargar personal
        const cont = document.getElementById('contenedorEmpleadosEvento');
        if (cont) cont.innerHTML = '';

        if (evento.evento_personal && evento.evento_personal.length > 0) {
            for (const p of evento.evento_personal) {
                await agregarFilaEmpleadoEvento(p);
            }
        } else {
            agregarFilaEmpleadoEvento();
        }

        document.getElementById('modalNuevoEvento').style.display = 'flex';

    } catch (e) {
        alert('Error: ' + e.message);
    }
}

window.guardarNuevoEvento = async function () {
    const id = document.getElementById('eventoIdEdicion').value;
    const nombre = document.getElementById('eventoNombre').value;
    const inicio = document.getElementById('eventoFechaInicio').value;
    const fin = document.getElementById('eventoFechaFin').value;
    const ubicacion = document.getElementById('eventoUbicacion').value;
    const gastos = parseFloat(document.getElementById('eventoValorStand').value) || 0;

    const gastosLogistica = parseFloat(document.getElementById('eventoOtrosGastos').value) || 0;
    const gastosAlimentacion = parseFloat(document.getElementById('eventoGastosViaticos').value) || 0;

    if (!nombre || !inicio || !fin) return alert('Completa los campos obligatorios (*)');

    try {
        let eventoId = id;
        const eventoData = {
            nombre_evento: nombre,
            fecha_inicio: inicio,
            fecha_fin: fin,
            ubicación: ubicacion,
            gastos: gastos,
            gastos_otros: gastosLogistica,
            gastos_alimentacion: gastosAlimentacion,
            estado: 'Activo'
        };

        if (id) {
            await supabaseClient.from('eventos_tienda').update(eventoData).eq('id', id);
        } else {
            const { data, error } = await supabaseClient.from('eventos_tienda').insert(eventoData).select().single();
            if (error) throw error;
            eventoId = data.id;
        }

        // Guardar Personal
        // Primero eliminar existentes si es edición (simple strategy)
        if (id) {
            await supabaseClient.from('evento_personal').delete().eq('evento_id', id);
        }

        const filas = document.querySelectorAll('.fila-empleado-evento');
        const personal = [];

        filas.forEach(div => {
            const empId = div.querySelector('.emp-select').value;
            const val = div.querySelector('.emp-valor').value;
            if (empId) {
                personal.push({
                    evento_id: eventoId,
                    empleado_id: empId,
                    valor_pactado: parseFloat(val) || 0,
                    estado_pago: 'Pendiente'
                });
            }
        });

        if (personal.length > 0) {
            const { error: errPersonal } = await supabaseClient.from('evento_personal').insert(personal);
            if (errPersonal) {
                throw errPersonal;
            }
        }

        alert('✅ Evento guardado correctamente');
        cerrarModalNuevoEvento();
        cargarEventos();

    } catch (e) {
        console.error(e);
        alert('❌ Error al guardar evento');
    }
}

// --- 3. Eliminar Evento ---
window.eliminarEvento = async function (id) {
    if (!confirm('¿Seguro que deseas eliminar este evento? Se borrará todo el historial.')) return;
    try {
        const { error } = await supabaseClient.from('eventos_tienda').delete().eq('id', id);
        if (error) throw error;
        alert('Evento eliminado');
        cargarEventos();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

// --- 4. Rentabilidad / Estadísticas ---
let chartRentVentasInstance = null;
window.actualEventoId = null;

window.verRentabilidadEvento = async function (id) {
    window.actualEventoId = id;
    const modal = document.getElementById('modalRentabilidad');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('tbodyRentProductos').innerHTML = '<tr><td colspan="4" class="text-center">Calculando rentabilidad...</td></tr>';

    try {
        const { data: evento, error: errEv } = await supabaseClient.from('eventos_tienda').select('*, evento_personal(*)').eq('id', id).single();
        if (errEv || !evento) throw new Error('No se pudo cargar el evento');

        const empIds = (evento.evento_personal || []).map(p => p.empleado_id);
        let nombresEmp = {};
        if (empIds.length > 0) {
            const { data: empleados } = await supabaseClient.from('empleados_tienda').select('id, nombre').in('id', empIds);
            (empleados || []).forEach(e => nombresEmp[e.id] = e.nombre);
        }

        const { data: ventas } = await supabaseClient.from('ventas').select('*').eq('id_evento', id);
        let ventasFiltradas = ventas || [];
        // No hay fallback de fechas para evitar fuga de ventas de otros eventos

        const productosVendidos = {};
        let totalIngresos = 0;
        ventasFiltradas.forEach(v => {
            const key = v.id_producto || v.nombre_producto;
            if (!productosVendidos[key]) productosVendidos[key] = { nombre: v.nombre_producto, cant: 0, total: 0 };
            productosVendidos[key].cant += (v.cantidad || 0);
            productosVendidos[key].total += (v.total || 0);
            totalIngresos += (v.total || 0);
        });

        const gastosPersonal = (evento.evento_personal || []).reduce((s, p) => s + (p.valor_pactado || 0), 0);
        const totalGastos = (evento.gastos || 0) + (evento.gastos_otros || 0) + (evento.gastos_alimentacion || 0) + gastosPersonal;
        const utilidad = totalIngresos - totalGastos;

        document.getElementById('rentIngresos').textContent = '$' + totalIngresos.toLocaleString();
        document.getElementById('rentGastos').textContent = '$' + totalGastos.toLocaleString();

        const utilEl = document.getElementById('rentUtilidad');
        utilEl.textContent = '$' + utilidad.toLocaleString();
        utilEl.style.color = utilidad >= 0 ? '#16a34a' : '#dc2626';
        document.getElementById('rentPorcentaje').textContent = (totalGastos > 0 ? ((totalIngresos / totalGastos) * 100).toFixed(0) : '0') + '%';

        const tbody = document.getElementById('tbodyRentProductos');
        if (Object.keys(productosVendidos).length > 0) {
            tbody.innerHTML = Object.values(productosVendidos).sort((a, b) => b.total - a.total).map(p => `
                <tr><td>${p.nombre}</td><td class="text-center">${p.cant}</td><td class="text-right">$${Math.round(p.total / p.cant).toLocaleString()}</td><td class="text-right"><strong>$${p.total.toLocaleString()}</strong></td></tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay ventas registradas</td></tr>';
        }

        document.getElementById('listaPersonalRent').innerHTML = (evento.evento_personal || []).map(p => `
            <div class="stat-card" style="padding:1rem; border:1px solid #e2e8f0;">
                <div style="font-weight:700;">${nombresEmp[p.empleado_id] || 'Empleado ' + p.empleado_id}</div>
                <div style="color:#64748b; font-size:0.85rem;">Pago: $${(p.valor_pactado || 0).toLocaleString()}</div>
                <span class="badge ${p.estado_pago === 'Pagado' ? 'badge-success' : 'badge-warning'}">${p.estado_pago || 'Pendiente'}</span>
            </div>
        `).join('') || 'Sin personal';

        renderizarGraficoRentabilidad(Object.values(productosVendidos).slice(0, 10));
        document.getElementById('btnImprimirRent').onclick = () => exportarEventoPDF(id, { evento, totalIngresos, totalGastos, productosVendidos, personal: evento.evento_personal, nombresEmp });
    } catch (e) { console.error(e); }
};

function renderizarGraficoRentabilidad(data) {
    const ctx = document.getElementById('chartRentVentas').getContext('2d');
    if (chartRentVentasInstance) chartRentVentasInstance.destroy();
    chartRentVentasInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(p => p.nombre.substring(0, 15)),
            datasets: [{ label: 'Ventas ($)', data: data.map(p => p.total), backgroundColor: '#ff6b00', borderRadius: 5 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

window.cerrarModalRentabilidad = () => document.getElementById('modalRentabilidad').style.display = 'none';

window.exportarEventoPDF = async function (id, dataPrevia = null) {
    try {
        let evData = dataPrevia;
        if (!evData) {
            const { data: evento } = await supabaseClient.from('eventos_tienda').select('*, evento_personal(*)').eq('id', id).single();
            const { data: ventas } = await supabaseClient.from('ventas').select('*').eq('id_evento', id);

            const empIds = (evento?.evento_personal || []).map(p => p.empleado_id);
            let nombresEmp = {};
            if (empIds.length > 0) {
                // CORRECCIÓN: Filtrar por empIds en lugar del alias incorrecto 'emps'
                const { data: emps } = await supabaseClient.from('empleados_tienda').select('id, nombre').in('id', empIds);
                (emps || []).forEach(e => nombresEmp[e.id] = e.nombre);
            }
            const prodsVend = {};
            let ti = 0;
            (ventas || []).forEach(v => {
                const k = v.id_producto || v.nombre_producto;
                if (!prodsVend[k]) prodsVend[k] = { nombre: v.nombre_producto, cant: 0, total: 0 };
                prodsVend[k].cant += (v.cantidad || 0);
                prodsVend[k].total += (v.total || 0);
                ti += (v.total || 0);
            });
            evData = {
                evento,
                totalIngresos: ti,
                totalGastos: (evento?.gastos || 0) + (evento?.evento_personal || []).reduce((s, p) => s + (p.valor_pactado || 0), 0),
                productosVendidos: prodsVend,
                personal: evento?.evento_personal,
                nombresEmp
            };
        }

        const { evento, totalIngresos, totalGastos, productosVendidos, personal, nombresEmp } = evData;
        const logoUrl = 'https://pbblthbrdkevuyjxyuar.supabase.co/storage/v1/object/public/productos-imagenes/moteros%20logo.jpg';

        let ventana = window.open('', 'PRINT', 'height=800,width=1000');
        ventana.document.write(`
            <html><head><title>Reporte - ${evento.nombre_evento}</title>
            <style>
                @page { size: auto; margin: 10mm; }
                body { font-family: 'Inter', sans-serif; padding: 20px; color: #1e293b; background: white; }
                .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px; }
                .header-logo { display: flex; align-items: center; gap: 1rem; }
                .header-logo img { height: 60px; width: 60px; border-radius: 50%; object-fit: cover; }
                .header-info { text-align: right; }
                .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
                .card { background: #f8fafc; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 12px; }
                .card h4 { margin: 0; color: #64748b; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
                .card p { margin: 0.5rem 0 0; font-size: 1.25rem; font-weight: 800; color: #0f172a; }
                .card.total { background: #0f172a; border: none; }
                .card.total h4 { color: #94a3b8; }
                .card.total p { color: #10b981; }
                table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.9rem; }
                th { background: #f1f5f9; padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
                td { padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
                .text-right { text-align: right; }
                .expense-item { display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.85rem; color: #64748b; }
                .badge { padding: 0.25rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600; background: #e2e8f0; }
                .badge-success { background: #d1fae5; color: #065f46; }
            </style>
            </head><body>
                <div class="header">
                    <div class="header-logo">
                        <img src="${logoUrl}" alt="Logo">
                        <div>
                            <h2 style="margin:0;">Moteros Sports Line</h2>
                            <p style="margin:0; color:#64748b; font-size:0.9rem;">Reporte de Rentabilidad de Evento</p>
                        </div>
                    </div>
                    <div class="header-info">
                        <h3 style="margin:0;">${evento.nombre_evento}</h3>
                        <p style="margin:5px 0 0; color:#64748b;">${new Date(evento.fecha_inicio).toLocaleDateString()} al ${new Date(evento.fecha_fin).toLocaleDateString()}</p>
                    </div>
                </div>

                <div class="grid">
                    <div class="card">
                        <h4>Ingresos por Ventas</h4>
                        <p>$${totalIngresos.toLocaleString()}</p>
                    </div>
                    <div class="card">
                        <h4>Inversión y Gastos</h4>
                        <p>$${totalGastos.toLocaleString()}</p>
                        <div style="margin-top:0.5rem;">
                            <div class="expense-item"><span>Stand:</span> <span>$${(evento.gastos || 0).toLocaleString()}</span></div>
                            <div class="expense-item"><span>Logística:</span> <span>$${(evento.gastos_otros || 0).toLocaleString()}</span></div>
                            <div class="expense-item"><span>Comida/Viat:</span> <span>$${(evento.gastos_alimentacion || 0).toLocaleString()}</span></div>
                        </div>
                    </div>
                    <div class="card total">
                        <h4>Utilidad Neta</h4>
                        <p>$${(totalIngresos - totalGastos).toLocaleString()}</p>
                        <small style="color:#94a3b8;">Margen: ${totalGastos > 0 ? ((totalIngresos / totalGastos) * 100).toFixed(0) : 0}%</small>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:2rem;">
                    <div>
                        <h3>📦 Productos Vendidos</h3>
                        <table><thead><tr><th>Producto</th><th class="text-right">Cant</th><th class="text-right">Unit.</th><th class="text-right">Total</th></tr></thead><tbody>
                            ${Object.values(productosVendidos).sort((a, b) => b.total - a.total).map(p => `
                                <tr>
                                    <td>${p.nombre}</td>
                                    <td class="text-right">${p.cant}</td>
                                    <td class="text-right">$${Math.round(p.total / (p.cant || 1)).toLocaleString()}</td>
                                    <td class="text-right" style="font-weight:700;">$${p.total.toLocaleString()}</td>
                                </tr>`).join('')}
                        </tbody></table>
                    </div>
                    <div>
                        <h3>👥 Personal en sitio</h3>
                        <table><thead><tr><th>Nombre</th><th class="text-right">Pago</th></tr></thead><tbody>
                            ${(personal || []).map(p => `
                                <tr>
                                    <td>${nombresEmp[p.empleado_id] || 'Empleado ' + p.empleado_id}</td>
                                    <td class="text-right">$${(p.valor_pactado || 0).toLocaleString()}</td>
                                </tr>`).join('')}
                        </tbody></table>
                        ${(!personal || personal.length === 0) ? '<p style="text-align:center; color:#94a3b8; margin-top:1rem;">Sin personal asignado</p>' : ''}
                    </div>
                </div>

                <div style="margin-top:2rem; padding-top:2rem; border-top:1px dashed #e2e8f0; text-align:center; color:#94a3b8; font-size:0.8rem;">
                    Generado automáticamente por Moteros Admin Panel el ${new Date().toLocaleString()}
                </div>

                <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); };</script>
            </body></html>
        `);
        ventana.document.close();
    } catch (e) { console.error(e); }
};






// ════════════ MODAL FUNCTIONS - FIX UI/UX ════════════

// La función principal mostrarFormCompra está definida arriba.
// window.mostrarFormCompra = ... se eliminó para evitar duplicidad.
window.cerrarFormCompra = function () {
    const el = document.getElementById('formCompra');
    if (el) {
        el.style.display = 'none';
        el.classList.remove('active');
    }
}

// Deuda (Fix Overlap)
window.mostrarFormDeuda = function () {
    const el = document.getElementById('formDeuda');
    if (el) el.style.display = 'flex';
}
window.cerrarFormDeuda = function () {
    const el = document.getElementById('formDeuda');
    if (el) el.style.display = 'none';
}
window.cancelarFormDeuda = window.cerrarFormDeuda; // Alias legacy

// ═══════════════════════════════════════════════════════════════
// LIQUIDACIÓN DE NÓMINA (Lógica Completa)
// ═══════════════════════════════════════════════════════════════

let empleadosCache = [];

window.mostrarModalLiquidarNomina = async function () {
    const el = document.getElementById('modalLiquidarNomina');
    if (!el) return;

    // Set default month to current if empty
    const mesInput = document.getElementById('nominaMes');
    if (!mesInput.value) {
        mesInput.value = new Date().toISOString().slice(0, 7);
    }

    // Load employees into select
    const select = document.getElementById('nominaEmpleadoSelect');
    select.innerHTML = '<option value="">Cargando...</option>';

    try {
        const { data, error } = await supabaseClient
            .from('empleados_tienda')
            .select('*')
            .eq('activo', true)
            .order('nombre');

        if (error) throw error;
        empleadosCache = data || [];

        select.innerHTML = '<option value="">-- Seleccione un Empleado --</option>' +
            empleadosCache.map(e => `<option value="${e.id}">${e.nombre} (${e.cargo || 'Vendedor'})</option>`).join('');

        el.style.display = 'flex';
        actualizarFechasNomina(); // Set dates
        calcularTotalesNomina();  // Reset zeros

    } catch (e) {
        console.error("Error loading employees for payroll:", e);
        showToast('Error cargando empleados', 'error');
        el.style.display = 'none';
    }
}

window.cerrarModalLiquidarNomina = function () {
    const el = document.getElementById('modalLiquidarNomina');
    if (el) el.style.display = 'none';
}

window.actualizarFechasNomina = function () {
    cargarDatosEmpleadoNomina(); // Recalculate if period changes
}

window.cargarDatosEmpleadoNomina = async function () {
    const empId = document.getElementById('nominaEmpleadoSelect').value;
    const tipoPeriodo = document.getElementById('nominaPeriodoTipo').value;
    const mesStr = document.getElementById('nominaMes').value;

    if (!empId) {
        ['nomSalarioBase', 'nomAuxilio', 'nomDescuentosLey', 'nomAdelantos'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        calcularTotalesNomina();
        return;
    }

    const emp = empleadosCache.find(e => e.id == empId);
    if (!emp) return;

    const factor = tipoPeriodo === 'mes' ? 1 : 0.5;
    const salarioBase = (emp.salario_base || 0) * factor;
    const auxilio = (emp.auxilio_transporte || 0) * factor;
    const deducLey = (emp.descuentos_ley || (emp.salario_base * 0.08)) * factor;

    document.getElementById('nomSalarioBase').value = Math.round(salarioBase);
    document.getElementById('nomAuxilio').value = Math.round(auxilio);
    document.getElementById('nomDescuentosLey').value = Math.round(deducLey);

    // RESET y CARGA de Adelantos Automáticos
    ['nomComisiones', 'nomBonificaciones', 'nomHorasExtra', 'nomIncentivos', 'nomAjustesPos',
        'nomFaltantes', 'nomMultas', 'nomAjustesNeg'].forEach(id => document.getElementById(id).value = '');

    const adelantoInput = document.getElementById('nomAdelantos');
    adelantoInput.value = 'Cargando...';

    // Calcular fechas del periodo para la consulta
    if (mesStr) {
        const [year, month] = mesStr.split('-').map(Number);
        let fIni, fFin;
        const lastD = new Date(year, month, 0).getDate();
        if (tipoPeriodo === 'quincena1') { fIni = `${mesStr}-01`; fFin = `${mesStr} -15`; }
        else if (tipoPeriodo === 'quincena2') { fIni = `${mesStr} -16`; fFin = `${mesStr} -${lastD} `; }
        else { fIni = `${mesStr}-01`; fFin = `${mesStr} -${lastD} `; }

        try {
            const { data: adelantos } = await supabaseClient
                .from('adelantos_nomina')
                .select('monto')
                .eq('empleado_id', empId)
                .gte('fecha', fIni)
                .lte('fecha', fFin);

            const totalAdelantos = (adelantos || []).reduce((sum, a) => sum + parseFloat(a.monto || 0), 0);
            adelantoInput.value = totalAdelantos > 0 ? Math.round(totalAdelantos) : '';
        } catch (e) {
            console.error("Error cargando adelantos:", e);
            adelantoInput.value = '';
        }
    } else {
        adelantoInput.value = '';
    }

    calcularTotalesNomina();
}

window.calcularTotalesNomina = function () {
    // Ingresos
    const salario = parseFloat(document.getElementById('nomSalarioBase').value) || 0;
    const auxilio = parseFloat(document.getElementById('nomAuxilio').value) || 0;
    const comisiones = parseFloat(document.getElementById('nomComisiones').value) || 0;
    const bonos = parseFloat(document.getElementById('nomBonificaciones').value) || 0;
    const extras = parseFloat(document.getElementById('nomHorasExtra').value) || 0;
    const incentivos = parseFloat(document.getElementById('nomIncentivos').value) || 0;
    const ajPos = parseFloat(document.getElementById('nomAjustesPos').value) || 0;

    const totalDev = salario + auxilio + comisiones + bonos + extras + incentivos + ajPos;

    // Deducciones
    const ley = parseFloat(document.getElementById('nomDescuentosLey').value) || 0;
    const adelantos = parseFloat(document.getElementById('nomAdelantos').value) || 0;
    const faltantes = parseFloat(document.getElementById('nomFaltantes').value) || 0;
    const multas = parseFloat(document.getElementById('nomMultas').value) || 0;
    const ajNeg = parseFloat(document.getElementById('nomAjustesNeg').value) || 0;

    const totalDed = ley + adelantos + faltantes + multas + ajNeg;

    // Neto
    const neto = totalDev - totalDed;

    // Update UI
    document.getElementById('totalDevengado').textContent = formatearPrecio(totalDev);
    document.getElementById('totalDeducido').textContent = formatearPrecio(totalDed);
    document.getElementById('nomNetoPagar').textContent = formatearPrecio(neto);

    // Visual cue for negative net
    const netoEl = document.getElementById('nomNetoPagar');
    if (neto < 0) {
        netoEl.style.color = '#ef4444'; // Red
    } else {
        netoEl.style.color = '#4ade80'; // Green
    }
}

window.guardarLiquidacionNomina = async function () {
    const empId = document.getElementById('nominaEmpleadoSelect').value;
    if (!empId) return showToast('Selecciona un empleado', 'warning');

    const mesStr = document.getElementById('nominaMes').value; // YYYY-MM
    if (!mesStr) return showToast('Selecciona el mes', 'warning');

    const tipoPeriodo = document.getElementById('nominaPeriodoTipo').value;

    // Calculate Dates
    const [year, month] = mesStr.split('-').map(Number);
    let fechaInicio, fechaFin;
    const lastDay = new Date(year, month, 0).getDate(); // Last day of month

    if (tipoPeriodo === 'quincena1') {
        fechaInicio = `${mesStr}-01`;
        fechaFin = `${mesStr}-15`;
    } else if (tipoPeriodo === 'quincena2') {
        fechaInicio = `${mesStr}-16`;
        fechaFin = `${mesStr}-${lastDay}`;
    } else {
        fechaInicio = `${mesStr}-01`;
        fechaFin = `${mesStr}-${lastDay}`;
    }

    // Gather Values
    const payload = {
        empleado_id: empId,
        periodo_tipo: tipoPeriodo, // 'mes', 'quincena1', 'quincena2'
        periodo_inicio: fechaInicio,
        periodo_fin: fechaFin,

        salario_base_periodo: parseFloat(document.getElementById('nomSalarioBase').value) || 0,
        auxilio_transporte_periodo: parseFloat(document.getElementById('nomAuxilio').value) || 0,
        comisiones: parseFloat(document.getElementById('nomComisiones').value) || 0,
        bonificaciones: parseFloat(document.getElementById('nomBonificaciones').value) || 0,
        horas_extra: parseFloat(document.getElementById('nomHorasExtra').value) || 0,
        incentivos: parseFloat(document.getElementById('nomIncentivos').value) || 0,
        ajustes_positivos: parseFloat(document.getElementById('nomAjustesPos').value) || 0,

        descuentos_ley: parseFloat(document.getElementById('nomDescuentosLey').value) || 0,
        prestamos_anticipos: parseFloat(document.getElementById('nomAdelantos').value) || 0,
        faltantes_caja: parseFloat(document.getElementById('nomFaltantes').value) || 0,
        multas_descuentos: parseFloat(document.getElementById('nomMultas').value) || 0,
        ajustes_negativos: parseFloat(document.getElementById('nomAjustesNeg').value) || 0,

        neto_pagar: parseFloat(document.getElementById('nomNetoPagar').textContent.replace(/[^\d.-]/g, '')) || 0,

        notas: document.getElementById('nomNotas').value,
        estado: 'Pagado', // O 'Pendiente' si quisieran flujo de aprobación
        fecha_pago: new Date().toISOString()
    };

    try {
        const { error } = await supabaseClient.from('nomina_pagos').insert([payload]);
        if (error) throw error;

        showToast('✅ Pago de nómina registrado correctamente', 'success');
        cerrarModalLiquidarNomina();
        // Here we could reload a history table if it existed
    } catch (e) {
        console.error(e);
        showToast('Error guardando nómina: ' + e.message, 'error');
    }
}

// Nuevo Evento (Added)
window.mostrarModalNuevoEvento = nuevoEvento;
window.cerrarModalNuevoEvento = function () {
    const el = document.getElementById('modalNuevoEvento');
    if (el) el.style.display = 'none';
}
window.guardarNuevoEvento = guardarNuevoEvento;
window.devolverProductosEvento = devolverProductosEvento;
window.verDetallesEvento = verDetallesEvento;
window.exportarEventoPDF = exportarEventoPDF;
window.cargarEventos = cargarEventos;

// ═══════════════════════════════════════════════════════════════
// LOGICA DE VARIANTES EN COMPRAS
// ═══════════════════════════════════════════════════════════════

let variantePendiente = null; // { index, producto, variantes_info }

function mostrarModalVariantesCompra(index, producto) {
    variantePendiente = { index, producto, variantes_info: [] };
    const modal = document.getElementById('modalVariantesCompra');
    document.getElementById('tituloVariantesProducto').textContent = `${producto.nombre} - Detalle de Stock`;

    // Generar Cabeceras según variantes definidas
    // producto.variantes es un array ej: ["Talla", "Color"]
    const columnasVariantes = producto.variantes || ['Variante'];

    const container = document.getElementById('contenedorVariantes');
    container.innerHTML = `
    < div style = "background: #f8fafc; padding: 1rem; border-radius: 8px; border: 1px solid #e2e8f0;" >
            <p style="margin-bottom:0.5rem; font-size:0.9rem; color: #64748b;">Define las combinaciones y cantidades por tienda.</p>
            <table class="data-table" id="tablaVariantesModal">
                <thead>
                    <tr>
                        ${columnasVariantes.map(v => `<th>${v}</th>`).join('')}
                        <th style="width: 80px;" title="Stock Alcalá">Alc</th>
                        <th style="width: 80px;" title="Stock Local 01">L01</th>
                        <th style="width: 80px;" title="Stock Jordán">Jor</th>
                        <th style="width: 80px;" title="Stock Digital">Dig</th>
                        <th style="width: 40px;"></th>
                    </tr>
                </thead>
                <tbody id="tbodyVariantesModal"></tbody>
            </table>
            <button onclick="agregarFilaVariante()" class="btn btn-primary btn-sm" style="margin-top:0.5rem;">+ Agregar Combinación</button>
        </div >
    `;

    // Agregar primera fila
    agregarFilaVariante();

    modal.style.display = 'flex';
}

function cerrarModalVariantesCompra() {
    document.getElementById('modalVariantesCompra').style.display = 'none';
    variantePendiente = null;
}

function agregarFilaVariante() {
    const tbody = document.getElementById('tbodyVariantesModal');
    if (!tbody || !variantePendiente) return;

    const columnasVariantes = variantePendiente.producto.variantes || ['Variante'];
    const tr = document.createElement('tr');

    let html = '';
    // Inputs de Texto para las variantes (Talla, Color)
    columnasVariantes.forEach(col => {
        html += `< td > <input type="text" class="form-control form-control-sm input-variante" placeholder="${col}"></td>`;
    });

    // Inputs de Cantidad por tienda
    html += `
    < td ><input type="number" class="form-control form-control-sm input-alcala" min="0" value="0"></td>
        <td><input type="number" class="form-control form-control-sm input-local01" min="0" value="0"></td>
        <td><input type="number" class="form-control form-control-sm input-jordan" min="0" value="0"></td>
        <td><input type="number" class="form-control form-control-sm input-digital" min="0" value="0"></td>
        <td><button class="btn btn-sm btn-danger" onclick="this.closest('tr').remove()">×</button></td>
`;

    tr.innerHTML = html;
    tbody.appendChild(tr);
}

function guardarVariantesCompra() {
    if (!variantePendiente) return;

    const tbody = document.getElementById('tbodyVariantesModal');
    const filas = tbody.querySelectorAll('tr');
    const variantesInfo = [];

    let totalAlcala = 0;
    let totalLocal01 = 0;
    let totalJordan = 0;
    let totalDigital = 0;

    filas.forEach(tr => {
        const inputsVariante = tr.querySelectorAll('.input-variante');
        const comb = Array.from(inputsVariante).map(inp => inp.value.trim()).filter(v => v).join('-');

        if (!comb) return; // Ignorar filas vacías de variante

        const alc = parseInt(tr.querySelector('.input-alcala').value) || 0;
        const l01 = parseInt(tr.querySelector('.input-local01').value) || 0;
        const jor = parseInt(tr.querySelector('.input-jordan').value) || 0;
        const dig = parseInt(tr.querySelector('.input-digital').value) || 0;

        totalAlcala += alc;
        totalLocal01 += l01;
        totalJordan += jor;
        totalDigital += dig;

        variantesInfo.push({ combinacion: comb, alc, l01, jor, dig });
    });

    if (variantesInfo.length === 0) {
        if (!confirm('No has definido ninguna variante. ¿Continuar como producto simple?')) return;
    }

    // Actualizar itemsCompra y UI Principal
    const index = variantePendiente.index;



    // Actualizar Inputs de la Tabla Principal
    document.getElementById(`cant-alcala-${index}`).value = totalAlcala;
    document.getElementById(`cant-local01-${index}`).value = totalLocal01;
    document.getElementById(`cant-jordan-${index}`).value = totalJordan;
    document.getElementById(`cant-digital-${index}`).value = totalDigital;

    // Deshabilitar inputs principales para evitar inconsistencias? 
    // Mejor dejarlos editables pero advertir. O ponerlos readonly.
    ['alcala', 'local01', 'jordan', 'digital'].forEach(tienda => {
        document.getElementById(`cant-${tienda}-${index}`).readOnly = true;
        document.getElementById(`cant-${tienda}-${index}`).title = "Edita las variantes para cambiar esto";
        document.getElementById(`cant-${tienda}-${index}`).style.backgroundColor = "#e2e8f0";
    });

    // Guardar metadata en el item
    itemsCompra[index].variantes_info = variantesInfo;
    itemsCompra[index].es_variante = true;

    // Recalcular fila
    calcFila(index);

    // UI Update visual en el nombre
    const inputNombre = document.querySelector(`#fila - compra - ${index} input[type = "text"]`);
    if (inputNombre && !inputNombre.value.includes('(Var.)')) {
        inputNombre.value += ' (Var.)';
    }

    cerrarModalVariantesCompra();
    showToast('Variantes asignadas', 'success');
}

async function actualizarStockVariantes(item, tabla, cantidad, tiendaKey) {
    if (!item.variantes_info || item.variantes_info.length === 0) return;

    const { data: stockEntry } = await supabaseClient.from(tabla)
        .select('stock_variantes, cantidad')
        .eq('id_producto', item.producto_id)
        .single();

    let stockVariantes = stockEntry?.stock_variantes || {};
    if (typeof stockVariantes === 'string') {
        try { stockVariantes = JSON.parse(stockVariantes); } catch (e) { stockVariantes = {}; }
    }

    item.variantes_info.forEach(info => {
        let prop = tiendaKey;
        if (info[prop] > 0) {
            const current = stockVariantes[info.combinacion] || 0;
            stockVariantes[info.combinacion] = current + info[prop];
        }
    });

    await supabaseClient.from(tabla).update({
        stock_variantes: stockVariantes,
        updated_at: new Date().toISOString()
    }).eq('id_producto', item.producto_id);
}

// ═══════════════════════════════════════════════════════════════
// DISTRIBUCIÓN AVANZADA (SPRINT 2.2 - NUEVO)
// ═══════════════════════════════════════════════════════════════

// Estado temporal para el modal de dist
var distribucionActualIndex = null;
var distribucionTempData = []; // Array de { variante, alcala, local01, jordan, digital, total }

function abrirDistribucionAvanzada(index) {
    const item = itemsCompra[index];

    if (!item || !item.producto_id) {
        showToast('Seleccione un producto válido primero', 'warning');
        return;
    }

    distribucionActualIndex = index;
    const modal = document.getElementById('modalDistribucionAvanzada');

    // Header Info
    document.getElementById('distTituloProducto').textContent = item.producto_nombre;
    const cantidadTotal = parseInt(item.cantidad_total) || 0;
    document.getElementById('distCantidadTotal').textContent = cantidadTotal;

    // Init Data
    // Si ya existe data guardada en el item, usarla. Si no, iniciar vacía o con default.
    if (item.distribucion && item.distribucion.length > 0) {
        distribucionTempData = JSON.parse(JSON.stringify(item.distribucion));
    } else {
        // Iniciar con una fila base si no hay nada
        distribucionTempData = [{
            variante: '',
            alcala: 0,
            local01: 0,
            jordan: 0,
            digital: 0
        }];
    }

    renderizarTablaDistribucion();

    // Show Modal
    if (modal) {
        modal.style.display = 'flex';
        // Animacion simple
        setTimeout(() => modal.classList.add('active'), 10);
    }
}

function cerrarDistribucionAvanzada() {
    const modal = document.getElementById('modalDistribucionAvanzada');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

function renderizarTablaDistribucion() {
    const tbody = document.getElementById('tbodyDistribucion');
    if (!tbody) return;

    tbody.innerHTML = distribucionTempData.map((row, i) => {
        const rowTotal = (parseInt(row.alcala) || 0) + (parseInt(row.local01) || 0) + (parseInt(row.jordan) || 0) + (parseInt(row.digital) || 0);
        return `
    < tr >
            <td>
                <input type="text" class="form-control form-control-sm" 
                    placeholder="Ej: Talla M / Rojo" 
                    value="${row.variante}" 
                    oninput="updateDistData(${i}, 'variante', this.value)">
            </td>
            <td><input type="number" class="form-control form-control-sm" value="${row.alcala || 0}" oninput="updateDistData(${i}, 'alcala', this.value)"></td>
            <td><input type="number" class="form-control form-control-sm" value="${row.local01 || 0}" oninput="updateDistData(${i}, 'local01', this.value)"></td>
            <td><input type="number" class="form-control form-control-sm" value="${row.jordan || 0}" oninput="updateDistData(${i}, 'jordan', this.value)"></td>
            <td><input type="number" class="form-control form-control-sm" value="${row.digital || 0}" oninput="updateDistData(${i}, 'digital', this.value)"></td>
            <td><strong>${rowTotal}</strong></td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="eliminarFilaDist(${i})">×</button>
            </td>
        </tr >
    `;
    }).join('');

    actualizarTotalesDistribucion();
}

function updateDistData(index, field, value) {
    if (field === 'variante') {
        distribucionTempData[index][field] = value;
    } else {
        distribucionTempData[index][field] = parseInt(value) || 0;
    }
    renderizarTablaDistribucion(); // Re-render para actualizar totales de fila
}

function agregarNuevaVariante() {
    distribucionTempData.push({ variante: '', alcala: 0, local01: 0, jordan: 0, digital: 0 });
    renderizarTablaDistribucion();
}

function eliminarFilaDist(index) {
    if (distribucionTempData.length <= 1) {
        showToast('Debe haber al menos una línea', 'warning');
        return;
    }
    distribucionTempData.splice(index, 1);
    renderizarTablaDistribucion();
}

function replicarDistribucion() {
    if (distribucionTempData.length === 0) return;
    const base = distribucionTempData[0];
    for (let i = 1; i < distribucionTempData.length; i++) {
        distribucionTempData[i].alcala = base.alcala;
        distribucionTempData[i].local01 = base.local01;
        distribucionTempData[i].jordan = base.jordan;
        distribucionTempData[i].digital = base.digital;
    }
    renderizarTablaDistribucion();
    showToast('Distribución copiada a todas las filas');
}

function actualizarTotalesDistribucion() {
    const tAlcala = distribucionTempData.reduce((s, r) => s + (parseInt(r.alcala) || 0), 0);
    const tLocal01 = distribucionTempData.reduce((s, r) => s + (parseInt(r.local01) || 0), 0);
    const tJordan = distribucionTempData.reduce((s, r) => s + (parseInt(r.jordan) || 0), 0);
    const tDigital = distribucionTempData.reduce((s, r) => s + (parseInt(r.digital) || 0), 0);

    const grandTotal = tAlcala + tLocal01 + tJordan + tDigital;

    document.getElementById('totalDistAlcala').textContent = tAlcala;
    document.getElementById('totalDist01').textContent = tLocal01;
    document.getElementById('totalDistJordan').textContent = tJordan;
    document.getElementById('totalDistDigital').textContent = tDigital;
    document.getElementById('grandTotalDist').textContent = grandTotal;

    // Validar contra Total Compra
    const totalCompra = parseInt(document.getElementById('distCantidadTotal').textContent) || 0;
    const asignadoEl = document.getElementById('distCantidadAsignada');
    const errorEl = document.getElementById('distribucionError');

    asignadoEl.textContent = grandTotal;

    if (grandTotal !== totalCompra) {
        asignadoEl.style.color = 'var(--danger)';
        errorEl.style.display = 'block';
        if (grandTotal < totalCompra) errorEl.textContent = `⚠️ Faltan por asignar ${totalCompra - grandTotal} unidades.`;
        else errorEl.textContent = `⚠️ Sobran ${grandTotal - totalCompra} unidades asignadas.`;
    } else {
        asignadoEl.style.color = 'var(--success)';
        errorEl.style.display = 'none';
    }
}

function guardarDistribucionAvanzada() {
    const totalCompra = parseInt(document.getElementById('distCantidadTotal').textContent) || 0;
    const asignado = parseInt(document.getElementById('distCantidadAsignada').textContent) || 0;

    if (totalCompra !== asignado) {
        if (!confirm(`La cantidad distribuida(${asignado}) NO COINCIDE con la cantidad total(${totalCompra}). ¿Guardar de todos modos y actualizar el total de compra ? `)) {
            return;
        }
    }

    // Actualizar itemCompra
    const item = itemsCompra[distribucionActualIndex];
    item.distribucion = distribucionTempData;

    // Recalcular sus totales planos para la tabla
    const tAlcala = distribucionTempData.reduce((s, r) => s + (parseInt(r.alcala) || 0), 0);
    const tLocal01 = distribucionTempData.reduce((s, r) => s + (parseInt(r.local01) || 0), 0);
    const tJordan = distribucionTempData.reduce((s, r) => s + (parseInt(r.jordan) || 0), 0);
    const tDigital = distribucionTempData.reduce((s, r) => s + (parseInt(r.digital) || 0), 0);

    item.cant_alcala = tAlcala;
    item.cant_local01 = tLocal01;
    item.cant_jordan = tJordan;
    item.cant_digital = tDigital;
    item.cantidad_total = asignado; // Update total based on distribution

    // Update inputs in main table
    document.getElementById(`cant-total-${distribucionActualIndex}`).value = item.cantidad_total;

    // Trigger Recalc
    calcFila(distribucionActualIndex);

    cerrarDistribucionAvanzada();
    showToast('Distribución guardada', 'success');
}


// ═══════════════════════════════════════════════════════════════
// MÓDULO DE SERVICIOS - ADMIN
// ═══════════════════════════════════════════════════════════════

async function cargarServiciosAdmin() {
    const estado = document.getElementById('serviciosFiltroEstado').value;
    const local = document.getElementById('serviciosFiltroLocal').value;
    const tbody = document.getElementById('listaServiciosAdmin');

    tbody.innerHTML = '<tr><td colspan="9" class="text-center">Cargando servicios...</td></tr>';

    try {
        let query = supabaseClient.from('servicios_motero').select('*, empleados_tienda(nombre)').order('created_at', { ascending: false });

        if (estado) query = query.eq('estado', estado);
        if (local) query = query.eq('local', local);

        const { data, error } = await query;
        if (error) throw error;

        // Estadísticas rápidas
        document.getElementById('serviciosPendientesCount').textContent = data.filter(s => s.estado === 'pendiente').length;
        document.getElementById('serviciosListosCount').textContent = data.filter(s => s.estado === 'listo').length;

        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay servicios que coincidan con los filtros.</td></tr>';
            return;
        }

        data.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
    < td > #${s.numero_servicio || ''}</td >
                <td style="font-size:0.8rem;">${formatearFecha(s.created_at)}</td>
                <td>
                    <div style="font-weight:600;">${s.cliente_nombre}</div>
                    <div style="font-size:0.8rem; color:#64748b;">${s.cliente_telefono}</div>
                </td>
                <td><span class="badge" style="background:#f1f5f9; color:#1e293b;">${s.tipo_servicio}</span></td>
                <td>${s.empleados_tienda?.nombre || 'N/A'}</td>
                <td style="font-weight:600;">$${formatearPrecio(s.precio_total)}</td>
                <td style="color:${s.saldo_pendiente > 0 ? '#ef4444' : '#10b981'}; font-weight:700;">$${formatearPrecio(s.saldo_pendiente)}</td>
                <td><span class="badge badge-${s.estado}">${s.estado}</span></td>
                <td>
                    <div style="display:flex; gap:0.4rem;">
                        <button onclick="cambiarEstadoServicioAdmin('${s.id}', 'listo', '${s.cliente_telefono}', '${s.cliente_nombre}')" class="btn btn-sm" title="Marcar como Listo" style="background:#dbeafe; color:#1e40af;">✅</button>
                        <button onclick="cambiarEstadoServicioAdmin('${s.id}', 'entregado')" class="btn btn-sm" title="Marcar como Entregado" style="background:#d1fae5; color:#065f46;">📦</button>
                        <button onclick="enviarWhatsAppServicio('${s.cliente_telefono}', '${s.cliente_nombre}', '${s.tipo_servicio}', '${s.estado}')" class="btn btn-sm" title="Enviar WhatsApp" style="background:#25d366; color:white;">📱</button>
                    </div>
                </td>
`;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
        showToast('Error al cargar servicios', 'error');
    }
}

async function cambiarEstadoServicioAdmin(id, nuevoEstado, telefono = null, nombre = null) {
    try {
        const { error } = await supabaseClient.from('servicios_motero').update({ estado: nuevoEstado }).eq('id', id);
        if (error) throw error;

        showToast(`Servicio actualizado a ${nuevoEstado} `);
        cargarServiciosAdmin();

        if (nuevoEstado === 'listo' && telefono) {
            if (confirm(`¿Deseas notificar a ${nombre} por WhatsApp que su servicio está listo ? `)) {
                enviarWhatsAppServicio(telefono, nombre, '', 'listo');
            }
        }
    } catch (e) {
        showToast('Error al actualizar servicio', 'error');
    }
}

function enviarWhatsAppServicio(telefono, nombre, tipo, estado) {
    let mensaje = '';
    if (estado === 'listo') {
        mensaje = `Hola ${nombre}, te saludamos de Moteros Sports Line. 🛵 ¡Tu servicio ya está listo para ser recogido! Te esperamos.`;
    } else {
        mensaje = `Hola ${nombre}, te saludamos de Moteros Sports Line. 🛵 ¿Cómo vas ? Queríamos saludarte y recordarte que estamos trabajando en tu servicio.`;
    }
    const url = `https://wa.me/57${telefono.replace(/\s+/g, '')}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO DE METAS - ADMIN
// ═══════════════════════════════════════════════════════════════

async function cargarMetas() {
    const tbody = document.getElementById('listaMetas');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando metas y calculando progreso...</td></tr>';

    try {
        const { data: metas, error } = await supabaseClient.from('metas_locales').select('*').order('anio', { ascending: false }).order('mes', { ascending: false });
        if (error) throw error;

        tbody.innerHTML = '';
        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        for (const m of metas) {
            // Calcular ventas reales para este local en este mes/año
            const fechaInicio = `${m.anio}-${String(m.mes).padStart(2, '0')}-01T00:00:00`;
            const ultimoDia = new Date(m.anio, m.mes, 0).getDate();
            const fechaFin = `${m.anio}-${String(m.mes).padStart(2, '0')}-${ultimoDia}T23:59:59`;

            const { data: ventasMes } = await supabaseClient.from('ventas')
                .select('total')
                .eq('local', m.local)
                .gte('created_at', fechaInicio)
                .lte('created_at', fechaFin);

            const alcanzado = (ventasMes || []).reduce((s, v) => s + (v.total || 0), 0);
            const porcentaje = m.valor_meta > 0 ? (alcanzado / m.valor_meta) * 100 : 0;
            const colorProgreso = porcentaje >= 100 ? '#10b981' : (porcentaje >= 70 ? '#3b82f6' : '#f59e0b');

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${meses[m.mes - 1]} ${m.anio}</strong></td>
                <td>${m.local}</td>
                <td style="font-weight:600;">$${formatearPrecio(m.valor_meta)}</td>
                <td style="color:#0f172a; font-weight:600;">$${formatearPrecio(alcanzado)}</td>
                <td>
                    <div style="width:100px; background:#e2e8f0; border-radius:10px; height:8px; overflow:hidden;">
                        <div style="width:${Math.min(porcentaje, 100)}%; background:${colorProgreso}; height:100%;"></div>
                    </div>
                    <small style="font-weight:700; color:${colorProgreso}">${porcentaje.toFixed(1)}%</small>
                </td>
                <td><span class="badge" style="background:${porcentaje >= 100 ? '#d1fae5' : '#fef3c7'}; color:${porcentaje >= 100 ? '#065f46' : '#92400e'};">${porcentaje >= 100 ? 'LOGRADA' : 'EN CURSO'}</span></td>
                <td>
                    <button onclick="eliminarMeta('${m.id}')" class="btn btn-sm btn-outline-danger">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        }

    } catch (e) {
        console.error(e);
        showToast('Error al cargar metas', 'error');
    }
}

function abrirModalMeta() {
    document.getElementById('modalMeta').style.display = 'flex';
    document.getElementById('metaId').value = '';
    document.getElementById('metaMonto').value = '';
    const hoy = new Date();
    document.getElementById('metaMes').value = hoy.getMonth() + 1;
    document.getElementById('metaAnio').value = hoy.getFullYear();
}

function cerrarModalMeta() {
    document.getElementById('modalMeta').style.display = 'none';
}

async function guardarMeta() {
    const id = document.getElementById('metaId').value;
    const mes = parseInt(document.getElementById('metaMes').value);
    const anio = parseInt(document.getElementById('metaAnio').value);
    const local = document.getElementById('metaLocal').value;
    const monto = limpiarMoneda(document.getElementById('metaMonto').value);

    if (monto <= 0) return showToast('Ingresa un monto válido para la meta', 'warning');

    try {
        const obj = { mes, anio, local, valor_meta: monto };
        let res;
        if (id) {
            res = await supabaseClient.from('metas_locales').update(obj).eq('id', id);
        } else {
            res = await supabaseClient.from('metas_locales').insert(obj);
        }

        if (res.error) throw res.error;

        showToast('Meta guardada exitosamente');
        cerrarModalMeta();
        cargarMetas();
    } catch (e) {
        console.error(' Error al guardar meta:', e);
        showToast('Error al guardar meta: ' + (e.message || e.toString()), 'error');
    }
}

async function eliminarMeta(id) {
    if (!confirm('¿Estás seguro de eliminar esta meta?')) return;
    try {
        const { error } = await supabaseClient.from('metas_locales').delete().eq('id', id);
        if (error) throw error;
        showToast('Meta eliminada');
        cargarMetas();
    } catch (e) {
        showToast('Error al eliminar meta', 'error');
    }
}

async function exportarMetasPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.text("Reporte de Cumplimiento de Metas", 20, 20);
    doc.setFontSize(12);
    doc.text(`Generado el: ${new Date().toLocaleString()}`, 20, 30);

    const rows = [];
    const table = document.getElementById('listaMetas');
    Array.from(table.rows).forEach(row => {
        const cells = Array.from(row.cells).map(c => c.textContent.trim().split('%')[0] + (c.textContent.includes('%') ? '%' : ''));
        rows.push(cells.slice(0, 6)); // Quitamos la columna de acciones
    });

    doc.autoTable({
        startY: 40,
        head: [['Mes/Año', 'Local', 'Meta', 'Alcanzado', 'Progreso', 'Estado']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] }
    });

    doc.save(`Metas_Ventas_Moteros_${new Date().getMonth() + 1}_${new Date().getFullYear()}.pdf`);
}

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE RESEÑAS
// ═══════════════════════════════════════════════════════════════

async function cargarResenas() {
    const tbody = document.getElementById('tbodyResenas');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando reseñas...</td></tr>';

    try {
        // 1. Cargar reseñas
        const { data: resenas, error: errResenas } = await supabaseClient
            .from('producto_resenas')
            .select('*')
            .order('created_at', { ascending: false });

        if (errResenas) throw errResenas;

        if (!resenas || resenas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay reseñas registradas.</td></tr>';
            return;
        }

        // 2. Obtener IDs únicos de productos para cargar nombres
        const idsProductos = [...new Set(resenas.map(r => r.id_producto))];

        // 3. Cargar nombres de productos
        const { data: productosData, error: errProd } = await supabaseClient
            .from('productos')
            .select('id, nombre')
            .in('id', idsProductos);

        if (errProd) console.error("Error cargando info productos:", errProd);

        // Mapa rápido id -> nombre
        const mapProductos = {};
        if (productosData) {
            productosData.forEach(p => mapProductos[p.id] = p.nombre);
        }

        tbody.innerHTML = resenas.map(r => `
            <tr>
                <td>${new Date(r.created_at).toLocaleDateString('es-CO')}</td>
                <td>${r.nombre_cliente || 'Anónimo'}</td>
                <td>${mapProductos[r.id_producto] || 'Producto no encontrado'}</td>
                <td style="color:#f59e0b;">${'★'.repeat(r.estrellas)}${'☆'.repeat(5 - r.estrellas)}</td>
                <td style="max-width: 300px; font-size:0.9rem;">${r.comentario || ''}</td>
                <td>
                    <button onclick="toggleAprobacionResena('${r.id}', ${!r.aprobado})" class="btn btn-sm ${r.aprobado ? 'btn-success' : 'btn-outline-secondary'}" title="${r.aprobado ? 'Aprobado' : 'Aprobar'}">
                        ${r.aprobado ? '✅' : '☑️'}
                    </button>
                    <button onclick="eliminarResena('${r.id}')" class="btn btn-danger btn-sm" title="Eliminar Reseña">🗑️</button>
                </td>
            </tr>
        `).join('');

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error: ${e.message}</td></tr>`;
    }
}
window.cargarResenas = cargarResenas;

async function toggleAprobacionResena(id, nuevoEstado) {
    try {
        const { error } = await supabaseClient.from('producto_resenas').update({ aprobado: nuevoEstado }).eq('id', id);
        if (error) throw error;
        showToast(nuevoEstado ? 'Reseña aprobada' : 'Reseña desaprobada');
        cargarResenas();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}
window.toggleAprobacionResena = toggleAprobacionResena;

async function eliminarResena(id) {
    if (!confirm('¿Estás seguro de eliminar esta reseña permanentemente?')) return;
    try {
        const { error } = await supabaseClient.from('producto_resenas').delete().eq('id', id);
        if (error) throw error;
        showToast('Reseña eliminada correctamente');
        cargarResenas();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}
window.eliminarResena = eliminarResena;

// Hook de navegación para cargar reseñas al entrar a la sección
document.addEventListener('DOMContentLoaded', () => {
    const feedbackLinks = document.querySelectorAll('a[data-section="feedback"]');
    feedbackLinks.forEach(link => {
        link.addEventListener('click', () => {
            // Un pequeño timeout para asegurar que la sección ya sea visible si hay otra lógica manejando el display
            setTimeout(cargarResenas, 100);
        });
    });
});

// ═══════════════════════════════════════════════════════════════
// METAS PROVEEDORES
// ═══════════════════════════════════════════════════════════════

async function cargarMetasProveedores() {
    const tbody = document.getElementById('listaMetasProveedores');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando acuerdos...</td></tr>';

    try {
        const { data, error } = await supabaseClient.from('metas_proveedores').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay acuerdos registrados</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(m => `
          <tr>
            <td><strong>${m.proveedor}</strong></td>
            <td>${m.descripcion || '-'}</td>
            <td>${m.valor_meta > 0 ? '$' + formatearPrecio(m.valor_meta) : (m.unidades_meta || 0) + ' Und'}</td>
            <td>${m.fecha_inicio || '?'} <br> ${m.fecha_fin || '?'}</td>
            <td>${m.premio || '-'}</td>
             <td><span class="badge ${m.estado === 'COMPLETADA' ? 'badge-success' : m.estado === 'FALLIDA' ? 'badge-danger' : 'badge-warning'}">${m.estado}</span></td>
            <td>
                <button onclick="eliminarMetaProveedor('${m.id}')" class="btn btn-sm btn-outline-danger">🗑️</button>
            </td>
          </tr>
       `).join('');
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error al cargar</td></tr>';
    }
}

async function cargarProveedoresEnSelect() {
    const select = document.getElementById('metaProvNombre');
    const selectProd = document.getElementById('productoProveedor'); // El del formulario de productos

    try {
        const { data, error } = await supabaseClient.from('proveedores').select('razon_social, nombre_comercial').order('razon_social');
        if (error) throw error;

        const options = '<option value="">-- Seleccionar --</option>' +
            data.map(p => `<option value="${p.razon_social}">${p.razon_social} ${p.nombre_comercial ? '(' + p.nombre_comercial + ')' : ''}</option>`).join('');

        if (select) select.innerHTML = options;
        if (selectProd) selectProd.innerHTML = options;

    } catch (e) { console.error('Error cargando proveedores', e); }
}

function abrirModalMetaProveedor() {
    document.getElementById('modalMetaProveedor').style.display = 'flex';
    cargarProveedoresEnSelect();
}

function cerrarModalMetaProveedor() {
    document.getElementById('modalMetaProveedor').style.display = 'none';
}

async function guardarMetaProveedor() {
    const proveedor = document.getElementById('metaProvNombre').value;
    const descripcion = document.getElementById('metaProvDesc').value;
    const monto = limpiarMoneda(document.getElementById('metaProvMonto').value);
    const unidades = parseInt(document.getElementById('metaProvUnidades').value) || 0;
    const inicio = document.getElementById('metaProvInicio').value;
    const fin = document.getElementById('metaProvFin').value;
    const premio = document.getElementById('metaProvPremio').value;

    if (!proveedor) return showToast('Selecciona un proveedor', 'warning');

    try {
        const { error } = await supabaseClient.from('metas_proveedores').insert({
            proveedor, descripcion, valor_meta: monto, unidades_meta: unidades, fecha_inicio: inicio || null, fecha_fin: fin || null, premio
        });
        if (error) throw error;
        showToast('Acuerdo guardado');
        cerrarModalMetaProveedor();
        cargarMetasProveedores();
    } catch (e) { showToast('Error al guardar: ' + e.message, 'error'); }
}

async function eliminarMetaProveedor(id) {
    if (!confirm('¿Eliminar acuerdo?')) return;
    const { error } = await supabaseClient.from('metas_proveedores').delete().eq('id', id);
    if (!error) { showToast('Eliminado'); cargarMetasProveedores(); }
}

// ═══════════════════════════════════════════════════════════════
// REPORTES - FIX CATEGORIAS (Sobreescritura)
// ═══════════════════════════════════════════════════════════════

async function cargarReporteMargen() {
    const contenedor = document.getElementById('bodyReporte');
    document.getElementById('contenidoReporte').style.display = 'block';
    document.getElementById('tituloReporte').textContent = 'Margen por Categoría';
    contenedor.innerHTML = '<div class="loading"><div class="spinner"></div><p>Calculando margenes...</p></div>';

    try {
        const stats = {};

        // Recalcular con productos actuales (globales)
        productos.forEach(p => {
            if (p.estado !== 'Activo') return;
            // FIX: Normalizar a mayúsculas
            const cat = (p.categoria || 'SIN CATEGORÍA').trim().toUpperCase();

            if (!stats[cat]) stats[cat] = { costo: 0, venta: 0, count: 0 };

            const costo = p.precio_compra || 0;
            const venta = p.precio || 0;

            stats[cat].costo += costo;
            stats[cat].venta += venta;
            stats[cat].count++;
        });

        let html = `
        <div class="table-container"> <!-- FIX: Wrapper para scroll horizontal -->
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Categoría</th>
                        <th>Productos</th>
                        <th>Costo Prom.</th>
                        <th>Precio Prom.</th>
                        <th>Margen %</th>
                    </tr>
                </thead>
                <tbody>`;

        const categorias = Object.keys(stats).sort();

        categorias.forEach(cat => {
            const s = stats[cat];
            const costoProm = s.costo / s.count;
            const ventaProm = s.venta / s.count;
            const margen = ventaProm > 0 ? ((ventaProm - costoProm) / ventaProm) * 100 : 0;

            let color = '#ef4444';
            if (margen > 30) color = '#f59e0b';
            if (margen > 50) color = '#10b981';

            html += `
            <tr>
                <td><strong>${cat}</strong></td>
                <td>${s.count}</td>
                <td>$${Math.round(costoProm).toLocaleString('es-CO')}</td>
                <td>$${Math.round(ventaProm).toLocaleString('es-CO')}</td>
                <td><span class="badge" style="background:${color}20; color:${color}; border:1px solid ${color}">${margen.toFixed(2)}%</span></td>
            </tr>`;
        });

        html += '</tbody></table></div>';
        contenedor.innerHTML = html;

    } catch (e) {
        console.error(e);
        contenedor.innerHTML = '<p class="text-danger">Error generando reporte: ' + e.message + '</p>';
    }
}
window.cargarReporteMargen = cargarReporteMargen;

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE DEUDORES
// ═══════════════════════════════════════════════════════════════

let deudoresData = [];
let deudoresPage = 1;
const deudoresPerPage = 10;

async function cargarDeudores(page = 1) {
    deudoresPage = page;
    const tbody = document.getElementById('tbodyDeudores');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Cargando deudores...</td></tr>';

    try {
        const estadoFiltro = document.getElementById('deudoresEstadoFiltro')?.value || 'activo';
        const localFiltro = document.getElementById('deudoresLocalFiltro')?.value || '';
        const busqueda = document.getElementById('deudoresBuscar')?.value.toLowerCase() || '';

        // Construir consulta
        let query = supabaseClient
            .from('deudores')
            .select('*')
            .order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;

        deudoresData = data || [];

        // 1. Filtrado
        let filtrados = deudoresData.filter(d => {
            let pasa = true;
            if (estadoFiltro) {
                if (estadoFiltro === 'activo' && d.estado !== 'activo') pasa = false;
                if (estadoFiltro === 'cerrado' && d.estado !== 'cerrado') pasa = false;
            }
            if (localFiltro && d.sede_venta !== localFiltro) pasa = false;
            if (busqueda) {
                const texto = ((d.nombre_completo || '') + ' ' + (d.telefono || '') + ' ' + (d.descripcion_compra || '')).toLowerCase();
                if (!texto.includes(busqueda)) pasa = false;
            }
            return pasa;
        });

        // 2. KPIs Globales
        const activos = deudoresData.filter(d => d.estado === 'activo');
        const totalDeuda = activos.reduce((acc, d) => acc + parseFloat(d.saldo_actual || 0), 0);
        const enMora = activos.filter(d => {
            if (!d.fecha_compra) return false;
            const diffTime = Math.abs(new Date() - new Date(d.fecha_compra));
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays > 30;
        }).length;
        const cerradosCount = deudoresData.filter(d => d.estado === 'cerrado').length;

        if (document.getElementById('deudoresTotalDeuda')) document.getElementById('deudoresTotalDeuda').textContent = '$' + formatearPrecio(totalDeuda);
        if (document.getElementById('deudoresActivos')) document.getElementById('deudoresActivos').textContent = activos.length;
        if (document.getElementById('deudoresMora')) document.getElementById('deudoresMora').textContent = enMora;
        if (document.getElementById('deudoresCerrados')) document.getElementById('deudoresCerrados').textContent = cerradosCount;

        // 3. Paginación
        const totalItems = filtrados.length;
        const totalPages = Math.ceil(totalItems / deudoresPerPage);

        if (deudoresPage > totalPages) deudoresPage = totalPages || 1;
        if (deudoresPage < 1) deudoresPage = 1;

        const start = (deudoresPage - 1) * deudoresPerPage;
        const end = start + deudoresPerPage;
        const paginados = filtrados.slice(start, end);

        // Render Tabla
        if (paginados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No se encontraron deudores</td></tr>';
            renderPaginacionDeudores(0, 0);
            return;
        }

        tbody.innerHTML = paginados.map(d => {
            return `
            <tr class="${d.estado === 'cerrado' ? 'row-cerrado' : ''}">
                <td>
                    <strong>${d.nombre_completo}</strong><br>
                    <span style="font-size:0.8rem; color:#64748b;">${new Date(d.created_at).toLocaleDateString()}</span>
                </td>
                <td>${d.telefono || '-'}</td>
                <td><span class="badge badge-info">${d.sede_venta || 'General'}</span></td>
                <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${d.descripcion_compra}">
                    ${d.descripcion_compra || '-'}
                </td>
                <td>$${formatearPrecio(d.monto_original)}</td>
                <td style="font-weight:bold; color:${d.saldo_actual > 0 ? '#ef4444' : '#10b981'};">
                    $${formatearPrecio(d.saldo_actual)}
                </td>
                <td>
                    <span class="badge ${d.estado === 'activo' ? 'badge-warning' : 'badge-success'}">
                        ${d.estado ? d.estado.toUpperCase() : 'DESCONOCIDO'}
                    </span>
                </td>
                <td>
                    <div style="display:flex; gap:0.5rem;">
                        <button onclick="verDetalleDeudor('${d.id}')" class="btn btn-sm btn-info" title="Ver Historial">👁️</button>
                        ${d.estado === 'activo' ? `<button onclick="abrirAbonar('${d.id}')" class="btn btn-sm btn-success" title="Registrar Abono">💵</button>` : ''}
                        <button onclick="editarDeudor('${d.id}')" class="btn btn-sm btn-secondary" title="Editar">✏️</button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        renderPaginacionDeudores(totalPages, deudoresPage);

    } catch (error) {
        console.error('Error cargarDeudores:', error);
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error: ${error.message}</td></tr>`;
    }
}
window.cargarDeudores = cargarDeudores;

function renderPaginacionDeudores(totalPages, currentPage) {
    const container = document.getElementById('paginacionDeudores');
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `
    <nav aria-label="Navegación deudores">
        <ul class="pagination justify-content-center">
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <button class="page-link" onclick="cargarDeudores(${currentPage - 1})">Anterior</button>
            </li>
            <li class="page-item disabled">
                <span class="page-link">Página ${currentPage} de ${totalPages}</span>
            </li>
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <button class="page-link" onclick="cargarDeudores(${currentPage + 1})">Siguiente</button>
            </li>
        </ul>
    </nav>
    `;
    container.innerHTML = html;
}

function mostrarFormDeudor() {
    // Usar nuevo modal flotante
    const modal = document.getElementById('modalDeudor');
    if (modal) modal.style.display = 'flex';

    document.getElementById('formTituloDeudor').textContent = '➕ Nuevo Deudor';
    document.getElementById('deudorId').value = '';

    ['deudorNombre', 'deudorTelefono', 'deudorSede', 'deudorFecha', 'deudorDescripcion', 'deudorMontoOriginal', 'deudorSaldo', 'deudorReferencia'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('deudorFecha').value = today;
}
window.mostrarFormDeudor = mostrarFormDeudor;

function cancelarFormDeudor() {
    const modal = document.getElementById('modalDeudor');
    if (modal) modal.style.display = 'none';
}
window.cancelarFormDeudor = cancelarFormDeudor;

async function guardarDeudor() {
    const id = document.getElementById('deudorId').value;
    const nombre = document.getElementById('deudorNombre').value;
    const telefono = document.getElementById('deudorTelefono').value;
    const sede = document.getElementById('deudorSede').value;
    const descripcion = document.getElementById('deudorDescripcion').value;
    const monto = parseFloat(document.getElementById('deudorMontoOriginal').value);
    const saldo = parseFloat(document.getElementById('deudorSaldo').value);
    const fecha = document.getElementById('deudorFecha').value;
    const referencia = document.getElementById('deudorReferencia').value;

    if (!nombre || !sede || !descripcion || isNaN(monto) || isNaN(saldo)) {
        showToast('Por favor completa los campos obligatorios', 'warning');
        return;
    }

    const deudorPayload = {
        nombre_completo: nombre,
        telefono: telefono.substring(0, 20),
        sede_venta: sede,
        descripcion_compra: descripcion,
        monto_original: monto,
        saldo_actual: saldo,
        fecha_compra: fecha || new Date().toISOString(),
        contacto_referencia: referencia,
        estado: saldo > 0 ? 'activo' : 'cerrado'
    };

    try {
        let error;
        if (id) {
            const res = await supabaseClient.from('deudores').update(deudorPayload).eq('id', id);
            error = res.error;
        } else {
            const res = await supabaseClient.from('deudores').insert([deudorPayload]);
            error = res.error;
        }

        if (error) throw error;

        showToast(id ? 'Deudor actualizado' : 'Deudor registrado', 'success');
        cancelarFormDeudor();
        cargarDeudores();

    } catch (e) {
        console.error('Error guardando deudor:', e);
        showToast('Error: ' + e.message, 'error');
    }
}
// ═══════════════════════════════════════════════════════════════
// PROVEEDORES (NUEVO MÓDULO)
// ═══════════════════════════════════════════════════════════════

let proveedoresData = [];

async function cargarProveedores() {
    const tbody = document.getElementById('tbodyProveedores');
    if (!tbody) return;

    try {
        const { data, error } = await supabaseClient
            .from('proveedores')
            .select('*')
            .order('razon_social', { ascending: true });

        if (error) throw error;

        proveedoresData = data || [];
        renderTablaProveedores();
        updateProveedoresStats();

    } catch (e) {
        console.error('💥 Error CRÍTICO cargando proveedores:', e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error: ${e.message}</td></tr>`;
    }
}
window.cargarProveedores = cargarProveedores;

function renderTablaProveedores(data = null) {
    const lista = data || proveedoresData;
    const tbody = document.getElementById('tbodyProveedores');
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay proveedores registrados</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(p => `
        <tr>
            <td>
                <div style="font-weight:bold; color:#1e293b;">${p.razon_social}</div>
                ${p.nombre_comercial ? `<div style="font-size:0.85rem; color:#64748b;">${p.nombre_comercial}</div>` : ''}
                ${p.codigo ? `<div style="font-size:0.75rem; color:#94a3b8; font-family:monospace;">${p.codigo}</div>` : ''}
            </td>
            <td>${p.nit || '-'}</td>
            <td>
                ${p.contacto_nombre ? `<div>👤 ${p.contacto_nombre}</div>` : ''}
                ${p.contacto_telefono ? `<div>📞 ${p.contacto_telefono}</div>` : ''}
            </td>
            <td>
                ${p.banco ? `<div>🏦 ${p.banco}</div>` : '-'}
                ${p.numero_cuenta ? `<div style="font-size:0.8rem;">${p.tipo_cuenta || ''} ${p.numero_cuenta}</div>` : ''}
            </td>
            <td>
                <span class="badge ${p.condicion_pago === 'contado' ? 'badge-success' : 'badge-warning'}">
                    ${p.condicion_pago ? p.condicion_pago.replace('_', ' ').toUpperCase() : 'CONTADO'}
                </span>
                ${p.cupo_credito > 0 ? `<div style="font-size:0.8rem; margin-top:2px;">Cupo: $${formatearPrecio(p.cupo_credito)}</div>` : ''}
            </td>
             <td class="text-right">
                <div style="font-weight:bold; color:${p.saldo_pendiente > 0 ? '#ef4444' : '#10b981'};">
                    $${formatearPrecio(p.saldo_pendiente)}
                </div>
            </td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editarProveedor('${p.id}')">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="eliminarProveedor('${p.id}')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function buscarProveedores() {
    const term = document.getElementById('proveedoresBuscar').value.toLowerCase();
    const filtrados = proveedoresData.filter(p =>
        p.razon_social.toLowerCase().includes(term) ||
        (p.nit && p.nit.includes(term)) ||
        (p.nombre_comercial && p.nombre_comercial.toLowerCase().includes(term))
    );
    renderTablaProveedores(filtrados);
}
window.buscarProveedores = buscarProveedores;

function mostrarFormProveedor() {
    document.getElementById('formProveedor').style.display = 'block';
    document.getElementById('formTituloProveedor').textContent = '➕ Nuevo Proveedor';

    // Reset Fields
    document.getElementById('proveedorId').value = '';

    // General
    document.getElementById('proveedorRazonSocial').value = '';
    document.getElementById('proveedorNombreComercial').value = '';
    document.getElementById('proveedorNit').value = '';
    document.getElementById('proveedorCodigo').value = '';
    document.getElementById('proveedorNotas').value = '';

    // Comercial
    document.getElementById('proveedorCondicion').value = 'contado';
    document.getElementById('proveedorCupo').value = '';

    // Contacto
    document.getElementById('proveedorContactoNombre').value = '';
    document.getElementById('proveedorTelefono').value = '';
    document.getElementById('proveedorEmail').value = '';
    document.getElementById('proveedorCiudad').value = '';
    document.getElementById('proveedorDireccion').value = '';

    // Bancos
    document.getElementById('proveedorBanco').value = '';
    document.getElementById('proveedorTipoCuenta').value = 'ahorros';
    document.getElementById('proveedorNumeroCuenta').value = '';
    document.getElementById('proveedorTitular').value = '';
}
window.mostrarFormProveedor = mostrarFormProveedor;

function cancelarFormProveedor() {
    document.getElementById('formProveedor').style.display = 'none';
}
window.cancelarFormProveedor = cancelarFormProveedor;

async function guardarProveedor() {
    const id = document.getElementById('proveedorId').value;

    const payload = {
        razon_social: document.getElementById('proveedorRazonSocial').value.trim(),
        nombre_comercial: document.getElementById('proveedorNombreComercial').value.trim(),
        nit: document.getElementById('proveedorNit').value.trim(),
        codigo: document.getElementById('proveedorCodigo').value.trim(),
        notas: document.getElementById('proveedorNotas').value,

        condicion_pago: document.getElementById('proveedorCondicion').value,
        cupo_credito: limpiarMoneda(document.getElementById('proveedorCupo').value),

        contacto_nombre: document.getElementById('proveedorContactoNombre').value.trim(),
        contacto_telefono: document.getElementById('proveedorTelefono').value.trim(),
        contacto_email: document.getElementById('proveedorEmail').value.trim(),
        ciudad: document.getElementById('proveedorCiudad').value.trim(),
        direccion: document.getElementById('proveedorDireccion').value.trim(),

        banco: document.getElementById('proveedorBanco').value.trim(),
        tipo_cuenta: document.getElementById('proveedorTipoCuenta').value,
        numero_cuenta: document.getElementById('proveedorNumeroCuenta').value.trim(),
        titular_cuenta: document.getElementById('proveedorTitular').value.trim()
    };

    if (!payload.razon_social) {
        showToast('La Razón Social es obligatoria', 'warning');
        return;
    }

    try {
        let error;
        if (id) {
            payload.updated_at = new Date().toISOString();
            const res = await supabaseClient.from('proveedores').update(payload).eq('id', id);
            error = res.error;
        } else {
            const res = await supabaseClient.from('proveedores').insert([payload]);
            error = res.error;
        }

        if (error) throw error;

        showToast(id ? 'Proveedor actualizado' : 'Proveedor creado', 'success');
        cancelarFormProveedor();
        cargarProveedores();

        // Actualizar caché para compras
        cargarProveedoresDatalist();

    } catch (e) {
        console.error('Error guardando proveedor:', e);
        showToast('Error: ' + e.message, 'error');
    }
}
window.guardarProveedor = guardarProveedor;

function editarProveedor(id) {
    const p = proveedoresData.find(x => x.id === id);
    if (!p) return;

    mostrarFormProveedor();
    document.getElementById('formTituloProveedor').textContent = '✏️ Editar Proveedor';
    document.getElementById('proveedorId').value = p.id;

    // Populate
    document.getElementById('proveedorRazonSocial').value = p.razon_social || '';
    document.getElementById('proveedorNombreComercial').value = p.nombre_comercial || '';
    document.getElementById('proveedorNit').value = p.nit || '';
    document.getElementById('proveedorCodigo').value = p.codigo || '';
    document.getElementById('proveedorNotas').value = p.notas || '';

    document.getElementById('proveedorCondicion').value = p.condicion_pago || 'contado';
    document.getElementById('proveedorCupo').value = p.cupo_credito ? '$' + formatearPrecio(p.cupo_credito) : '';

    document.getElementById('proveedorContactoNombre').value = p.contacto_nombre || '';
    document.getElementById('proveedorTelefono').value = p.contacto_telefono || '';
    document.getElementById('proveedorEmail').value = p.contacto_email || '';
    document.getElementById('proveedorCiudad').value = p.ciudad || '';
    document.getElementById('proveedorDireccion').value = p.direccion || '';

    document.getElementById('proveedorBanco').value = p.banco || '';
    document.getElementById('proveedorTipoCuenta').value = p.tipo_cuenta || 'ahorros';
    document.getElementById('proveedorNumeroCuenta').value = p.numero_cuenta || '';
    document.getElementById('proveedorTitular').value = p.titular_cuenta || '';
}
window.editarProveedor = editarProveedor;

async function eliminarProveedor(id) {
    if (!confirm('¿Estás seguro de eliminar este proveedor?')) return;

    try {
        const { error } = await supabaseClient.from('proveedores').delete().eq('id', id);
        if (error) throw error;
        showToast('Proveedor eliminado', 'success');
        cargarProveedores();
    } catch (e) {
        showToast('Error al eliminar: ' + e.message, 'error');
    }
}
window.eliminarProveedor = eliminarProveedor;

function updateProveedoresStats() {
    // Calculamos stats simples para el header de la sección si existiera
}

window.guardarDeudor = guardarDeudor;

function buscarDeudores() {
    cargarDeudores();
}
window.buscarDeudores = buscarDeudores;

function editarDeudor(id) {
    const d = deudoresData.find(x => x.id === id);
    if (!d) return;

    mostrarFormDeudor();
    document.getElementById('formTituloDeudor').textContent = '✏️ Editar Deudor';
    document.getElementById('deudorId').value = d.id;
    document.getElementById('deudorNombre').value = d.nombre_completo;
    document.getElementById('deudorTelefono').value = d.telefono;
    document.getElementById('deudorSede').value = d.sede_venta;
    document.getElementById('deudorDescripcion').value = d.descripcion_compra;
    document.getElementById('deudorMontoOriginal').value = d.monto_original;
    document.getElementById('deudorSaldo').value = d.saldo_actual;
    document.getElementById('deudorFecha').value = d.fecha_compra;
    document.getElementById('deudorReferencia').value = d.contacto_referencia || '';
}
window.editarDeudor = editarDeudor;

// Variables de estado para historial
let currentDeudorHistorial = null;
let historialAbonosCache = [];
let historialDeudaCache = [];

async function verDetalleDeudor(id) {
    currentDeudorHistorial = deudoresData.find(d => d.id === id);
    if (!currentDeudorHistorial) return;

    const modal = document.getElementById('modalHistorialDeudor');
    if (modal) modal.style.display = 'flex';

    // Header Info Premium
    const header = document.getElementById('historialHeader');
    if (header) {
        const saldo = currentDeudorHistorial.saldo_actual;
        const isMora = saldo > 0; // Simple logic, can be improved
        const estadoClass = currentDeudorHistorial.estado === 'activo' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';

        header.innerHTML = `
            <div style="flex-grow:1;">
                <h2 style="margin:0; font-size:1.5rem; color:#1e293b; display:flex; align-items:center; gap:10px;">
                    ${currentDeudorHistorial.nombre_completo}
                    <span style="font-size:0.8rem; padding:4px 10px; border-radius:20px; background:${currentDeudorHistorial.estado === 'activo' ? '#fef3c7' : '#dcfce7'}; color:${currentDeudorHistorial.estado === 'activo' ? '#d97706' : '#15803d'}; font-weight:bold; letter-spacing:0.5px;">
                        ${currentDeudorHistorial.estado?.toUpperCase()}
                    </span>
                </h2>
                <div style="display:flex; gap:15px; margin-top:5px; color:#64748b; font-size:0.95rem;">
                    <span>📞 ${currentDeudorHistorial.telefono || 'Sin teléfono'}</span>
                    <span>📍 ${currentDeudorHistorial.sede_venta || 'Sin Sede'}</span>
                    <span>📅 ${currentDeudorHistorial.fecha_compra || 'Sin Fecha'}</span>
                </div>
                <p style="margin:10px 0 0; color:#475569; font-style:italic;">"${currentDeudorHistorial.descripcion_compra || 'Sin descripción'}"</p>
            </div>
            
            <div style="text-align:right; border-left:4px solid ${saldo > 0 ? '#ef4444' : '#10b981'}; padding-left:1.5rem;">
                <small style="color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:1px;">Saldo Pendiente</small>
                <div style="font-size:2rem; font-weight:800; color:${saldo > 0 ? '#ef4444' : '#10b981'}; line-height:1;">
                    $${formatearPrecio(saldo)}
                </div>
            </div>
        `;
    }

    // Cargar Datos
    await cargarDatosHistorial(id);
}
window.verDetalleDeudor = verDetalleDeudor;

function cerrarModalHistorialDeudor() {
    const modal = document.getElementById('modalHistorialDeudor');
    if (modal) modal.style.display = 'none';
    currentDeudorHistorial = null;
}
window.cerrarModalHistorialDeudor = cerrarModalHistorialDeudor;

async function cargarDatosHistorial(id) {
    const tbodyPagos = document.getElementById('tbodyHistorialPagos');
    const tbodyDeuda = document.getElementById('tbodyHistorialDeuda');

    if (tbodyPagos) tbodyPagos.innerHTML = '<tr><td colspan="5" class="text-center">Cargando pagos...</td></tr>';

    try {
        // Fetch Pagos
        const { data: pagos, error: errPagos } = await supabaseClient
            .from('pagos_deudor')
            .select('*')
            .eq('deudor_id', id)
            .order('fecha_pago', { ascending: false });

        if (errPagos) throw errPagos;
        historialAbonosCache = pagos || [];

        // Render Pagos
        if (tbodyPagos) {
            if (historialAbonosCache.length === 0) {
                tbodyPagos.innerHTML = '<tr><td colspan="5" class="text-center">No hay pagos registrados</td></tr>';
            } else {
                tbodyPagos.innerHTML = historialAbonosCache.map(p => `
                    <tr>
                        <td>${new Date(p.fecha_pago).toLocaleString()}</td>
                        <td style="color:#10b981; font-weight:bold;">$${formatearPrecio(p.monto)}</td>
                        <td>${p.metodo_pago || '-'}</td>
                        <td>${p.nota || '-'}</td>
                        <td>${p.registrado_por || '-'}</td>
                    </tr>
                `).join('');
            }
        }

        // Fetch Historial (Opcional por ahora si no está poblado, pero preparamos)
        const { data: deuda, error: errDeuda } = await supabaseClient
            .from('historial_deuda')
            .select('*')
            .eq('deudor_id', id)
            .order('fecha_cambio', { ascending: false });

        // Si tabla no existe o error, ignoramos silenciosamente
        historialDeudaCache = deuda || [];

        if (tbodyDeuda) {
            if (historialDeudaCache.length === 0) {
                tbodyDeuda.innerHTML = '<tr><td colspan="5" class="text-center">No hay cambios de deuda registrados</td></tr>';
            } else {
                tbodyDeuda.innerHTML = historialDeudaCache.map(h => `
                    <tr>
                        <td>${new Date(h.fecha_cambio).toLocaleString()}</td>
                        <td>${h.tipo_cambio}</td>
                        <td>$${formatearPrecio(h.monto_cambio)}</td>
                        <td>$${formatearPrecio(h.nuevo_saldo)}</td>
                        <td>${h.descripcion || '-'}</td>
                    </tr>
                `).join('');
            }
        }

    } catch (e) {
        console.error('Error info historial:', e);
        if (tbodyPagos) tbodyPagos.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error cargando datos</td></tr>';
    }
}

// ═══════════════════════════════════════════════════════════════
// ABONOS
// ═══════════════════════════════════════════════════════════════

function abrirAbonar(id) {
    const deudor = deudoresData.find(d => d.id === id);
    if (!deudor) return;

    const modal = document.getElementById('modalAbono');
    if (modal) modal.style.display = 'flex';

    document.getElementById('abonoDeudorId').value = id;
    document.getElementById('abonoMonto').value = '';
    document.getElementById('abonoNota').value = '';

    // Info rápida
    const info = document.getElementById('abonoInfoDeudor');
    if (info) info.innerHTML = `Abonando a: <span style="color:#333;">${deudor.nombre_completo}</span><br>Saldo Actual: <span style="color:#ef4444;">$${formatearPrecio(deudor.saldo_actual)}</span>`;
}
window.abrirAbonar = abrirAbonar;

function cerrarModalAbono() {
    const modal = document.getElementById('modalAbono');
    if (modal) modal.style.display = 'none';
}
window.cerrarModalAbono = cerrarModalAbono;

async function guardarAbono() {
    const id = document.getElementById('abonoDeudorId').value;
    const monto = parseFloat(document.getElementById('abonoMonto').value);
    const metodo = document.getElementById('abonoMetodo').value;
    const nota = document.getElementById('abonoNota').value;

    if (!id || isNaN(monto) || monto <= 0) {
        showToast('Ingrese un monto válido', 'warning');
        return;
    }

    const deudor = deudoresData.find(d => d.id === id);
    if (!deudor) return;

    if (monto > deudor.saldo_actual) {
        if (!confirm('El monto supera el saldo actual ($' + formatearPrecio(deudor.saldo_actual) + '). ¿Desea continuar y dejar saldo a favor?')) return;
    }

    try {
        // 1. Insertar pago
        const { error: errPago } = await supabaseClient.from('pagos_deudor').insert({
            deudor_id: id,
            monto: monto,
            metodo_pago: metodo,
            nota: nota,
            fecha_pago: new Date().toISOString()
        });
        if (errPago) throw errPago;

        // 2. Calcular nuevo saldo
        const nuevoSaldo = deudor.saldo_actual - monto;
        const nuevoEstado = nuevoSaldo <= 0 ? 'cerrado' : 'activo';

        // 3. Actualizar deudor
        const { error: errUpdate } = await supabaseClient.from('deudores').update({
            saldo_actual: nuevoSaldo,
            estado: nuevoEstado,
            ultimo_pago: new Date().toISOString()
        }).eq('id', id);

        if (errUpdate) throw errUpdate;

        showToast('Abono registrado correctamente', 'success');
        cerrarModalAbono();
        cargarDeudores(); // Refrescar lista

    } catch (e) {
        console.error('Error abono:', e);
        showToast('Error registrando abono: ' + e.message, 'error');
    }
}
window.guardarAbono = guardarAbono;

// ═══════════════════════════════════════════════════════════════
// EXTRAS: WHATSAPP & EXPORT
// ═══════════════════════════════════════════════════════════════

function enviarWhatsAppCobro() {
    if (!currentDeudorHistorial) return;
    const tel = limpiarTelefono(currentDeudorHistorial.telefono);
    if (!tel) return showToast('El cliente no tiene teléfono válido', 'warning');

    const saldo = formatearPrecio(currentDeudorHistorial.saldo_actual);
    const msg = `Hola ${currentDeudorHistorial.nombre_completo}, esperamos que estés bien. Te escribimos de Moteros Sports Line para recordarte amablemente tu saldo pendiente de $${saldo}. Agradecemos tu atención.`;
    window.open(`https://wa.me/57${tel}?text=${encodeURIComponent(msg)}`, '_blank');
}
window.enviarWhatsAppCobro = enviarWhatsAppCobro;

function enviarWhatsAppFelicitacion() {
    if (!currentDeudorHistorial) return;
    const tel = limpiarTelefono(currentDeudorHistorial.telefono);
    if (!tel) return showToast('El cliente no tiene teléfono válido', 'warning');

    const msg = `¡Hola ${currentDeudorHistorial.nombre_completo}! Muchas gracias por tu pago. Nos alegra informarte que tu cuenta está al día. ¡Apreciamos tu compromiso!`;
    window.open(`https://wa.me/57${tel}?text=${encodeURIComponent(msg)}`, '_blank');
}
window.enviarWhatsAppFelicitacion = enviarWhatsAppFelicitacion;

function enviarWhatsAppInvitacion() {
    if (!currentDeudorHistorial) return;
    const tel = limpiarTelefono(currentDeudorHistorial.telefono);
    if (!tel) return showToast('El cliente no tiene teléfono válido', 'warning');

    const msg = `Hola ${currentDeudorHistorial.nombre_completo}. Gracias a tu excelente historial, tienes pre-aprobado un nuevo crédito con nosotros. ¡Visítanos para ver lo nuevo!`;
    window.open(`https://wa.me/57${tel}?text=${encodeURIComponent(msg)}`, '_blank');
}
window.enviarWhatsAppInvitacion = enviarWhatsAppInvitacion;

function limpiarTelefono(tel) {
    if (!tel) return '';
    return tel.replace(/\D/g, ''); // Solo números
}

function exportarHistorialExcel() {
    if (!currentDeudorHistorial) return;
    const nombreClean = currentDeudorHistorial.nombre_completo.replace(/[^a-z0-9]/gi, '_');

    // Combinar info básica con pagos
    ReportExporter.toExcel(historialAbonosCache, `Historial_${nombreClean}`, 'Pagos');
}
window.exportarHistorialExcel = exportarHistorialExcel;

function exportarHistorialPDF() {
    if (!currentDeudorHistorial) return;
    const table = document.getElementById('tbodyHistorialPagos').parentElement; // Get table element
    const nombreClean = currentDeudorHistorial.nombre_completo;

    ReportExporter.toPDF(table, `Historial_${nombreClean}`, `Historial de Pagos: ${nombreClean}`);
}
window.exportarHistorialPDF = exportarHistorialPDF;

function switchTabHistorial(tab) {
    // Ocultar todos los tabs
    document.getElementById('tabPagos').style.display = 'none';
    document.getElementById('tabDeuda').style.display = 'none';

    // Resetear estilos de botones
    const btnPagos = document.getElementById('tabBtnPagos');
    const btnDeuda = document.getElementById('tabBtnDeuda');

    if (btnPagos) {
        btnPagos.style.borderBottom = '3px solid transparent';
        btnPagos.style.fontWeight = 'normal';
        btnPagos.style.color = '#64748b';
    }
    if (btnDeuda) {
        btnDeuda.style.borderBottom = '3px solid transparent';
        btnDeuda.style.fontWeight = 'normal';
        btnDeuda.style.color = '#64748b';
    }

    // Activar el seleccionado
    if (tab === 'pagos') {
        document.getElementById('tabPagos').style.display = 'block';
        if (btnPagos) {
            btnPagos.style.borderBottom = '3px solid #3b82f6';
            btnPagos.style.fontWeight = 'bold';
            btnPagos.style.color = '#3b82f6';
        }
    } else {
        document.getElementById('tabDeuda').style.display = 'block';
        if (btnDeuda) {
            btnDeuda.style.borderBottom = '3px solid #3b82f6';
            btnDeuda.style.fontWeight = 'bold';
            btnDeuda.style.color = '#3b82f6';
        }
    }
}
window.switchTabHistorial = switchTabHistorial;

// ═══════════════════════════════════════════════════════════════
// ANALYTICS & GRÁFICAS
// ═══════════════════════════════════════════════════════════════

let chartsDeudores = {}; // Store chart instances

function verGraficasDeudores() {
    const modal = document.getElementById('modalGraficasDeudores');
    if (modal) modal.style.display = 'flex';

    // Defer rendering to ensure modal is visible (Chart.js needs dimensions)
    setTimeout(() => {
        renderGraficasDeudores();
    }, 100);
}
window.verGraficasDeudores = verGraficasDeudores;

function cerrarModalGraficasDeudores() {
    const modal = document.getElementById('modalGraficasDeudores');
    if (modal) modal.style.display = 'none';
}
window.cerrarModalGraficasDeudores = cerrarModalGraficasDeudores;

function renderGraficasDeudores() {
    if (!deudoresData || deudoresData.length === 0) return;

    // 1. Deudores por Sede
    const sedes = {};
    deudoresData.forEach(d => {
        const s = d.sede_venta || 'Otros';
        sedes[s] = (sedes[s] || 0) + 1;
    });

    renderChart('chartDeudoresSede', 'doughnut', {
        labels: Object.keys(sedes),
        datasets: [{
            data: Object.values(sedes),
            backgroundColor: ['#ff6b00', '#3b82f6', '#10b981', '#6366f1', '#f59e0b']
        }]
    }, 'Distribución por Sede');

    // 2. Top 5 Deudores
    const top5 = [...deudoresData]
        .sort((a, b) => b.saldo_actual - a.saldo_actual)
        .slice(0, 5);

    renderChart('chartTopDeudores', 'bar', {
        labels: top5.map(d => d.nombre_completo.split(' ')[0]), // Primer nombre
        datasets: [{
            label: 'Saldo Pendiente',
            data: top5.map(d => d.saldo_actual),
            backgroundColor: '#ef4444'
        }]
    }, 'Mayores Deudas');

    // 3. Evolución por Mes (Fecha Compra)
    const meses = {};
    deudoresData.forEach(d => {
        if (!d.fecha_compra) return;
        const fecha = new Date(d.fecha_compra);
        const key = `${fecha.getFullYear()}-${(fecha.getMonth() + 1).toString().padStart(2, '0')}`;
        meses[key] = (meses[key] || 0) + d.monto_original;
    });

    // Sort keys
    const sortedKeys = Object.keys(meses).sort();

    renderChart('chartDeudaMes', 'line', {
        labels: sortedKeys,
        datasets: [{
            label: 'Total Créditos Otorgados',
            data: sortedKeys.map(k => meses[k]),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.3
        }]
    }, 'Evolución Créditos');
}

function renderChart(canvasId, type, data, title) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    // Destroy existing
    if (chartsDeudores[canvasId]) {
        chartsDeudores[canvasId].destroy();
    }

    chartsDeudores[canvasId] = new Chart(ctx, {
        type: type,
        data: data,
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                title: { display: !!title, text: title }
            }
        }
    });
}

// MÓDULO DE COMPRAS MOVIDO A admin-compras.js


// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE LEADS IA
// ═══════════════════════════════════════════════════════════════

async function cargarLeadsIA() {
    const tbody = document.getElementById('tbodyLeadsIA');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando leads...</td></tr>';

    try {
        const { data, error } = await supabaseClient
            .from('leads_ia')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        leadsIAData = data || [];
        renderTablaLeads(leadsIAData);
    } catch (error) {
        console.error('Error cargando leads:', error);
        showToast('Error cargando leads IA', 'error');
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Error al cargar datos</td></tr>';
    }
}

function renderTablaLeads(leads) {
    const tbody = document.getElementById('tbodyLeadsIA');
    if (!tbody) return;

    if (leads.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No se encontraron leads</td></tr>';
        return;
    }

    tbody.innerHTML = leads.map(lead => {
        const fecha = new Date(lead.created_at).toLocaleString('es-CO');
        const badgeColor = getEstadoLeadColor(lead.estado);
        const waClean = (lead.whatsapp || lead.telefono || '').replace(/\D/g, '');

        return `
            <tr>
                <td>${fecha}</td>
                <td><strong>${lead.nombre || 'Cliente Web'}</strong></td>
                <td>${lead.whatsapp || lead.telefono || '-'}</td>
                <td><span class="badge" style="background:${lead.nivel_interes === 'Alta' ? '#dc2626' : '#2563eb'};color:white;">${lead.nivel_interes || 'Medio'}</span></td>
                <td><div style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${lead.fragmento_interes || lead.necesidad || ''}">${lead.fragmento_interes || lead.necesidad || '-'}</div></td>
                <td><span class="badge ${badgeColor}">${(lead.estado || 'Nuevo').toUpperCase()}</span></td>
                <td>
                    <div style="display:flex; gap:0.5rem;">
                        <button onclick='verDetalleLead("${lead.id}")' class="btn btn-sm btn-info" title="Ver historial completo">👁️</button>
                        ${waClean ? `
                            <button onclick='contactarLeadWA("${lead.id}", "${waClean}", "${lead.nombre || 'Cliente'}")' class="btn btn-sm btn-success" title="Contactar por WhatsApp">📱</button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getEstadoLeadColor(estado) {
    switch ((estado || '').toLowerCase()) {
        case 'nuevo': return 'badge-danger';
        case 'contactado': return 'badge-info';
        case 'en seguimiento': return 'badge-warning';
        case 'cerrado': return 'badge-secondary';
        default: return 'badge-danger';
    }
}

async function contactarLeadWA(id, wa, nombre) {
    // 1. WhatsApp Redir con mensaje - Normalizar prefijo
    let cleanWA = wa.replace(/\D/g, '');
    if (cleanWA.length === 10) cleanWA = '57' + cleanWA;

    const mensaje = encodeURIComponent(`¡Hola ${nombre}! Te contactamos de Moteros Sports Line. Vimos tu interés por nuestros productos en nuestro asistente virtual. ¿En qué podemos ayudarte hoy?`);
    window.open(`https://wa.me/${cleanWA}?text=${mensaje}`, '_blank');

    // 2. Cambiar estado a 'contactado' en Supabase si es nuevo
    try {
        const { error } = await supabaseClient
            .from('leads_ia')
            .update({ estado: 'contactado' })
            .match({ id: id, estado: 'nuevo' }); // Solo actualizar si es nuevo

        if (error) throw error;

        // Refrescar localmente el estado si era nuevo
        const lead = leadsIAData.find(l => l.id === id);
        if (lead && (lead.estado || 'nuevo').toLowerCase() === 'nuevo') {
            lead.estado = 'contactado';
            renderTablaLeads(leadsIAData);
        }

    } catch (e) {
        console.error("Error al actualizar estado del lead:", e);
    }
}

function verDetalleLead(id) {
    const lead = leadsIAData.find(l => l.id === id);
    if (!lead) return;

    let historialHTML = '<p>No hay historial disponible.</p>';
    try {
        const h = typeof lead.historial_asociado === 'string' ? JSON.parse(lead.historial_asociado) : lead.historial_asociado;
        if (Array.isArray(h) && h.length > 0) {
            historialHTML = h.map(m => `
                <div style="margin-bottom:0.8rem; padding:0.8rem; border-radius:0.5rem; background:${m.role === 'user' ? '#f1f5f9' : '#e0f2fe'}; border-left:4px solid ${m.role === 'user' ? '#64748b' : '#0284c7'};">
                    <strong style="display:block; font-size:0.75rem; text-transform:uppercase; color:#64748b; margin-bottom:0.2rem;">${m.role === 'user' ? 'Cliente' : 'Asistente IA'}</strong>
                    <div style="font-size:0.9rem;">${m.content}</div>
                </div>
            `).join('');
        }
    } catch (e) { console.error("Error parseando historial:", e); }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '9999';
    modal.style.display = 'flex'; // Forzar visibilidad
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
        <div class="modal-content" style="max-width:1000px; width:95%; max-height:90vh; overflow:hidden; display:flex; flex-direction:column; padding:0; border-radius:1rem;">
            <div class="modal-header" style="padding:1.5rem; border-bottom:1px solid #e2e8f0;">
                <h2 style="margin:0; font-size:1.3rem;">👤 Lead: ${lead.nombre || 'Cliente'}</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="font-size:1.5rem; background:none; border:none; cursor:pointer;">&times;</button>
            </div>
            <div class="modal-body" style="padding:1.5rem; overflow-y:auto; background:#f8fafc;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
                    <div style="background:white; padding:1rem; border-radius:0.5rem; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                        <small style="color:#64748b; font-weight:bold;">WhatsApp</small>
                        <div style="font-size:1.1rem;">${lead.whatsapp || lead.telefono || 'N/A'}</div>
                    </div>
                    <div style="background:white; padding:1rem; border-radius:0.5rem; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                        <small style="color:#64748b; font-weight:bold;">Interés</small>
                        <div style="font-size:1.1rem;"><span class="badge" style="background:${lead.nivel_interes === 'Alta' ? '#dc2626' : '#2563eb'};color:white;">${lead.nivel_interes || 'Medio'}</span></div>
                    </div>
                </div>
                <div style="background:white; padding:1rem; border-radius:0.5rem; box-shadow:0 1px 3px rgba(0,0,0,0.1); margin-bottom:1.5rem;">
                    <small style="color:#64748b; font-weight:bold;">Necesidad Detectada</small>
                    <div style="font-size:1rem; font-style:italic;">${lead.fragmento_interes || lead.necesidad || 'N/A'}</div>
                </div>

                <h4 style="margin-top:0;">🤖 Historial de Conversación con IA</h4>
                <div style="background:white; padding:1rem; border-radius:1rem; border:1px solid #e2e8f0;">
                    ${historialHTML}
                </div>
            </div>
            <div class="modal-footer" style="padding:1rem 1.5rem; border-top:1px solid #e2e8f0; background:white; display:flex; justify-content:flex-end; gap:1rem;">
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
                <button class="btn btn-success" onclick='contactarLeadWA("${lead.id}", "${(lead.whatsapp || lead.telefono || '').replace(/\D/g, '')}", "${lead.nombre || 'Cliente'}")'>💬 Contactar WhatsApp</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function filtrarLeadsAdmin() {
    const query = document.getElementById('buscarLeadAdmin').value.toLowerCase();
    const filtrados = leadsIAData.filter(l =>
        (l.nombre || '').toLowerCase().includes(query) ||
        (l.whatsapp || '').toLowerCase().includes(query)
    );
    renderTablaLeads(filtrados);
}

async function eliminarLead(id, nombre) {
    if (!confirm(`¿Estás seguro de eliminar el lead de "${nombre}"?`)) return;

    try {
        const { error } = await supabaseClient
            .from('leads_ia')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showToast('Lead eliminado con éxito');
        cargarLeadsIA();
    } catch (error) {
        console.error('Error eliminando lead:', error);
        showToast('Error al eliminar el lead', 'error');
    }
}

// Exportar funciones
window.cargarLeadsIA = cargarLeadsIA;
window.verDetalleLead = verDetalleLead;
window.contactarLeadWA = contactarLeadWA;
window.getEstadoLeadColor = getEstadoLeadColor;
window.filtrarLeadsAdmin = filtrarLeadsAdmin;
window.eliminarLead = eliminarLead;


// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN Y MEMORIA DE IA
// ═══════════════════════════════════════════════════════════════

async function cargarConfiguracionIA() {
    const logDiv = document.getElementById('logMemoriaIA');
    if (!logDiv) return;

    try {
        // 1. Cargar Keys
        const { data: keys, error: errKeys } = await supabaseClient.from('config_ia').select('*');
        if (keys) {
            keys.forEach(k => {
                if (k.modulo === 'INDEX') document.getElementById('aiKeyIndex').value = k.api_key;
                if (k.modulo === 'ADMIN') document.getElementById('aiKeyAdmin').value = k.api_key;
            });
        }

        // 2. Cargar Log de Memoria
        const { data: memoria, error: errMem } = await supabaseClient
            .from('ia_memoria_contexto')
            .select('*')
            .order('fecha', { ascending: false })
            .limit(10);

        if (memoria) {
            logDiv.innerHTML = memoria.map(m => `
                <div style="border-bottom:1px solid #eee; padding:5px 0;">
                    <span style="color:#ff6b00; font-weight:bold;">[${m.modulo}]</span> 
                    <span style="color:#64748b;">[${new Date(m.fecha).toLocaleDateString()}]</span> 
                    ${m.descripcion}
                </div>
            `).join('') || 'Sin eventos de memoria registrados.';
        }
    } catch (e) {
        console.error("Error cargando config IA:", e);
    }
}

async function guardarConfiguracionIA() {
    const keyIndex = document.getElementById('aiKeyIndex').value.trim();
    const keyAdmin = document.getElementById('aiKeyAdmin').value.trim();

    if (!keyIndex || !keyAdmin) {
        showToast('Ambas llaves son obligatorias', 'error');
        return;
    }

    try {
        const payload = [
            { modulo: 'INDEX', api_key: keyIndex, updated_at: new Date().toISOString() },
            { modulo: 'ADMIN', api_key: keyAdmin, updated_at: new Date().toISOString() }
        ];

        const { error } = await supabaseClient.from('config_ia').upsert(payload, { onConflict: 'modulo' });
        if (error) throw error;

        showToast('Configuración de IA guardada', 'success');
        if (window.moterosIA) window.moterosIA.sincronizarKeys();
    } catch (e) {
        showToast('Error al guardar llaves: ' + e.message, 'error');
    }
}

async function agregarMemoriaManual() {
    const input = document.getElementById('nuevaMemoriaTexto');
    const texto = input.value.trim();
    if (!texto) return;

    try {
        const { error } = await supabaseClient.from('ia_memoria_contexto').insert([{
            modulo: 'INDEX', // Por defecto a index para promos, o detectar si es para admin
            tipo_evento: 'MANUAL',
            descripcion: texto
        }]);

        if (error) throw error;
        input.value = '';
        showToast('Memoria guardada', 'success');
        cargarConfiguracionIA();
    } catch (e) {
        showToast('Error al guardar memoria: ' + e.message, 'error');
    }
}

// Integrar en la carga de la sección de leads
const originalCargarLeadsIA = cargarLeadsIA;
cargarLeadsIA = async function () {
    await originalCargarLeadsIA();
    await cargarConfiguracionIA();
};

window.cargarLeadsIA = cargarLeadsIA;
window.guardarConfiguracionIA = guardarConfiguracionIA;

// 📊 TELEMETRÍA IA Y MONITOREO SUPABASE
let chartAiReqInstance = null;
let chartAiTokInstance = null;

async function cargarTelemetriaIA() {
    if (!window.supabaseClient) return;

    try {
        // 1. Obtener logs de uso (Últimas 24h)
        const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: logs, error: errLogs } = await window.supabaseClient
            .from('ia_log_usage')
            .select('*')
            .gte('fecha', hace24h)
            .order('fecha', { ascending: true });

        if (!errLogs && logs) {
            renderizarGraficasIA(logs);
        }

        // 2. Obtener estadísticas de Supabase (Database size approx & Storage)
        const [resContexto, resLeads, resLogs, resProductos, resVentas] = await Promise.all([
            window.supabaseClient.from('ia_memoria_contexto').select('*', { count: 'exact', head: true }),
            window.supabaseClient.from('leads_ia').select('*', { count: 'exact', head: true }),
            window.supabaseClient.from('ia_log_usage').select('*', { count: 'exact', head: true }),
            window.supabaseClient.from('productos').select('*', { count: 'exact', head: true }),
            window.supabaseClient.from('ventas').select('*', { count: 'exact', head: true })
        ]);

        // Estimación básica de tamaño DB (Basada en conteo, Supabase no da Size directo por API de cliente)
        // Aproximadamente 1KB por registro promedio
        const totalRegistros = (resContexto.count || 0) + (resLeads.count || 0) + (resLogs.count || 0) + (resProductos.count || 0) + (resVentas.count || 0.1);
        const dbSizeMB = (totalRegistros * 0.002).toFixed(2); // Estimación 2KB por row

        const elDB = document.getElementById('supabaseStatDBSize');
        if (elDB) elDB.textContent = `${dbSizeMB} MB`;

        const elLogs = document.getElementById('supabaseStatPeticiones');
        if (elLogs) elLogs.textContent = `${resLogs.count || 0} logs`;

        // Calcular Tamaño de Storage (Imágenes de productos)
        calcularEspacioStorage();

    } catch (e) {
        console.error("Error cargando telemetría:", e);
    }
}

async function calcularEspacioStorage() {
    try {
        const buckets = ['productos-imagenes'];
        let totalSize = 0;

        for (const bucket of buckets) {
            const { data, error } = await window.supabaseClient.storage.from(bucket).list('', { limit: 100 });
            if (!error && data) {
                data.forEach(file => {
                    totalSize += file.metadata ? (file.metadata.size || 0) : 0;
                });
            }
        }

        const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
        const elStorage = document.getElementById('supabaseStatStorageSize');
        if (elStorage) elStorage.textContent = `${sizeMB} MB`;
    } catch (e) {
        console.error("Error calculando storage:", e);
    }
}

function renderizarGraficasIA(logs) {
    const ctxReq = document.getElementById('chartAiRequests');
    const ctxTok = document.getElementById('chartAiTokens');
    if (!ctxReq || !ctxTok) return;

    // Agrupar por hora
    const statsPorHora = {};
    logs.forEach(log => {
        const hora = new Date(log.fecha).getHours() + ":00";
        if (!statsPorHora[hora]) statsPorHora[hora] = { reqs: 0, tokens: 0 };
        statsPorHora[hora].reqs++;
        statsPorHora[hora].tokens += log.tokens_total;
    });

    const labels = Object.keys(statsPorHora);
    const dataReqs = labels.map(l => statsPorHora[l].reqs);
    const dataTokens = labels.map(l => statsPorHora[l].tokens);

    // Gráfica de Peticiones
    if (chartAiReqInstance) chartAiReqInstance.destroy();
    chartAiReqInstance = new Chart(ctxReq, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Requests',
                data: dataReqs,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });

    // Gráfica de Tokens
    if (chartAiTokInstance) chartAiTokInstance.destroy();
    chartAiTokInstance = new Chart(ctxTok, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Tokens',
                data: dataTokens,
                backgroundColor: '#f59e0b',
                borderRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

window.cargarTelemetriaIA = cargarTelemetriaIA;
window.agregarMemoriaManual = agregarMemoriaManual;
window.cargarConfiguracionIA = cargarConfiguracionIA;
