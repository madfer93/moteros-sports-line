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
    if (!valor) return 0;
    return parseFloat(valor.replace(/[^\d]/g, '')) || 0;
}

// ═══════════════════════════════════════════════════════════════
// LOGIN / LOGOUT CON PERSISTENCIA
// ═══════════════════════════════════════════════════════════════
const SESSION_KEY = 'moteros_admin_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 horas

function checkSession() {
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
        try {
            const { timestamp } = JSON.parse(session);
            if (Date.now() - timestamp < SESSION_DURATION) {
                return true;
            }
            localStorage.removeItem(SESSION_KEY);
        } catch (e) {
            localStorage.removeItem(SESSION_KEY);
        }
    }
    return false;
}

function saveSession() {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ timestamp: Date.now() }));
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

async function loginAdmin() {
    const password = document.getElementById('adminPassword').value;
    const loginBtn = document.querySelector('.login-btn');

    if (!password) {
        document.getElementById('loginError').textContent = '❌ Ingresa la contraseña';
        return;
    }

    if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = 'Verificando...'; }

    try {
        const { data, error } = await supabaseClient
            .from('configuracion_sistema')
            .select('valor')
            .eq('clave', 'admin_password')
            .single();

        if (error) throw error;
        const passwordCorrecta = data?.valor || 'moteros2025';

        if (password === passwordCorrecta) {
            saveSession();
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'block';
            inicializarAdmin();
            showToast('¡Bienvenido al panel de administración!');
        } else {
            document.getElementById('loginError').textContent = '❌ Contraseña incorrecta';
            document.getElementById('adminPassword').value = '';
        }
    } catch (err) {
        console.error('Error verificando contraseña:', err);
        if (password === 'moteros2025') {
            saveSession();
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'block';
            inicializarAdmin();
            showToast('¡Bienvenido! (modo offline)');
        } else {
            document.getElementById('loginError').textContent = '❌ Error de conexión';
        }
    } finally {
        if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'Iniciar Sesión'; }
    }
}

function logout() {
    if (confirm('¿Cerrar sesión?')) {
        clearSession();
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('adminPassword').value = '';
        document.getElementById('loginError').textContent = '';
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
        const { data: configActual } = await supabaseClient.from('configuracion_sistema').select('valor').eq('clave', 'admin_password').single();
        if (configActual?.valor !== actual) { showToast('La contraseña actual es incorrecta', 'error'); return; }
        const { error } = await supabaseClient.from('configuracion_sistema').upsert({ clave: 'admin_password', valor: nueva });
        if (error) throw error;
        showToast('¡Contraseña actualizada correctamente!', 'success');
        cerrarModalPassword();
    } catch (err) { console.error('Error cambiando contraseña:', err); showToast('Error al cambiar la contraseña', 'error'); }
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
        case 'bodegas': await cargarBodegas(); break;
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
// COMPRAS A PROVEEDORES - CORREGIDO CON FORMULARIO MODAL
// ═══════════════════════════════════════════════════════════════

function mostrarFormCompra() {
    document.getElementById('formCompra').style.display = 'block';
    document.getElementById('formTituloCompra').textContent = '➕ Nueva Compra a Proveedor';
    document.getElementById('compraId').value = '';

    document.getElementById('compraAnio').value = new Date().getFullYear();
    document.getElementById('compraMes').value = '';
    document.getElementById('compraDia').value = '';
    document.getElementById('compraCuenta').value = '';
    document.getElementById('compraProveedor').value = '';
    document.getElementById('compraFactura').value = '';
    document.getElementById('compraVencimiento').value = '';
    document.getElementById('compraConsecutivo').value = '';
    document.getElementById('compraValor').value = '';
    document.getElementById('compraFElectronica').value = '';
    document.getElementById('compraEstado').value = 'ABIERTO';
    document.getElementById('compraNotas').value = '';

    cargarProveedoresDatalist();

    const mesActual = new Date().getMonth() + 1;
    const mesesMap = { 1: '01.ENE', 2: '02.FEB', 3: '03.MAR', 4: '04.ABR', 5: '05.MAY', 6: '06.JUN', 7: '07.JUL', 8: '08.AGO', 9: '09.SEP', 10: '10.OCT', 11: '11.NOV', 12: '12.DIC' };
    document.getElementById('compraMes').value = mesesMap[mesActual] || '';
    document.getElementById('compraDia').value = new Date().getDate();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarFormCompra() { document.getElementById('formCompra').style.display = 'none'; }

async function cargarProveedoresDatalist() {
    try {
        const { data, error } = await supabaseClient.from('proveedores').select('razon_social').eq('activo', true).order('razon_social');
        if (error) throw error;
        const datalist = document.getElementById('listaProveedoresDatalist');
        if (datalist) datalist.innerHTML = (data || []).map(p => `<option value="${p.razon_social}">`).join('');
    } catch (error) { console.error('Error cargando proveedores:', error); }
}

// IMPORTANTE: NO incluir saldo_pendiente - es columna generada en BD
async function guardarCompra() {
    const anio = document.getElementById('compraAnio').value;
    const mes = document.getElementById('compraMes').value;
    const dia = document.getElementById('compraDia').value;
    const cuenta = document.getElementById('compraCuenta').value;
    const proveedor = document.getElementById('compraProveedor').value;
    const factura = document.getElementById('compraFactura').value;
    const vencimiento = document.getElementById('compraVencimiento').value;
    const consecutivo = document.getElementById('compraConsecutivo').value;
    const valor = limpiarMoneda(document.getElementById('compraValor').value);
    const fElectronica = document.getElementById('compraFElectronica').value;
    const estado = document.getElementById('compraEstado').value;
    const notas = document.getElementById('compraNotas').value;
    const compraId = document.getElementById('compraId').value;

    if (!anio || !mes || !proveedor || !valor) {
        showToast('Por favor completa los campos obligatorios', 'warning');
        return;
    }

    try {
        let proveedorId = null;
        const { data: provExistente } = await supabaseClient.from('proveedores').select('id').ilike('razon_social', proveedor).limit(1);

        if (provExistente && provExistente.length > 0) {
            proveedorId = provExistente[0].id;
        } else {
            const { data: nuevoProveedor, error: errProv } = await supabaseClient.from('proveedores').insert({ razon_social: proveedor, activo: true }).select('id').single();
            if (!errProv && nuevoProveedor) proveedorId = nuevoProveedor.id;
        }

        // IMPORTANTE: NO incluir saldo_pendiente - es columna generada
        const datosCompra = {
            proveedor_id: proveedorId,
            anio: parseInt(anio),
            mes_compra: mes,
            dia: dia || null,
            cuenta: cuenta || null,
            numero_factura: factura || null,
            fecha_vencimiento: vencimiento || null,
            consecutivo_moteros: consecutivo || null,
            valor_compra: valor,
            f_electronica: fElectronica || null,
            estado: estado,
            notas: notas || null
        };

        let error;
        if (compraId) {
            datosCompra.updated_at = new Date().toISOString();
            const result = await supabaseClient.from('compras_proveedor').update(datosCompra).eq('id', compraId);
            error = result.error;
        } else {
            const result = await supabaseClient.from('compras_proveedor').insert(datosCompra);
            error = result.error;
        }

        if (error) throw error;
        showToast(compraId ? 'Compra actualizada' : 'Compra registrada correctamente', 'success');
        cancelarFormCompra();
        cargarCompras();
    } catch (error) { console.error('Error guardando compra:', error); showToast('Error: ' + error.message, 'error'); }
}

async function cargarCompras() {
    const tbody = document.getElementById('tbodyCompras');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="10" class="text-center">Cargando...</td></tr>';

    try {
        const estadoFiltro = document.getElementById('comprasEstadoFiltro')?.value || '';
        let query = supabaseClient.from('compras_proveedor').select('*, proveedor:proveedores(razon_social)').order('created_at', { ascending: false }).limit(200);
        if (estadoFiltro) query = query.eq('estado', estadoFiltro);
        const { data, error } = await query;
        if (error) throw error;

        comprasData = data || [];

        const abiertas = comprasData.filter(c => c.estado === 'ABIERTO' || c.estado === 'pendiente' || c.estado === 'parcial');
        const totalPendiente = abiertas.reduce((sum, c) => sum + parseFloat(c.saldo_pendiente || 0), 0);

        const el1 = document.getElementById('comprasPendientes');
        const el2 = document.getElementById('comprasAbiertas');
        const el3 = document.getElementById('comprasPagadasMes');
        if (el1) el1.textContent = '$' + formatearPrecio(totalPendiente);
        if (el2) el2.textContent = abiertas.length;
        if (el3) el3.textContent = comprasData.filter(c => c.estado === 'CERRADO' || c.estado === 'pagado').length;

        renderizarTablaCompras(comprasData);
    } catch (error) { console.error('Error cargando compras:', error); tbody.innerHTML = '<tr><td colspan="10" class="text-center text-danger">Error al cargar</td></tr>'; }
}

function renderizarTablaCompras(data) {
    const tbody = document.getElementById('tbodyCompras');
    if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="10" class="text-center">No hay compras registradas</td></tr>'; return; }

    tbody.innerHTML = data.map(c => {
        const estadoBadge = (c.estado === 'CERRADO' || c.estado === 'pagado') ? 'success' : c.estado === 'parcial' ? 'warning' : 'danger';
        const estadoTexto = (c.estado === 'CERRADO' || c.estado === 'pagado') ? 'CERRADO' : c.estado === 'parcial' ? 'PARCIAL' : 'ABIERTO';
        const fechaTexto = c.mes_compra && c.dia ? `${c.dia}/${c.mes_compra.replace(/^\d+\./, '')}/${c.anio || ''}` : (c.mes_compra || '-');
        const fechaVenc = c.fecha_vencimiento ? formatearFecha(c.fecha_vencimiento) : '-';
        const provNombre = c.proveedor?.razon_social || '-';
        const fElec = c.f_electronica === 'SI' ? '✅' : '-';

        return `<tr>
            <td>${fechaTexto}</td>
            <td>${c.cuenta || '-'}</td>
            <td><strong>${provNombre}</strong></td>
            <td>${c.numero_factura || '-'}</td>
            <td>$${formatearPrecio(c.valor_compra)}</td>
            <td class="${parseFloat(c.saldo_pendiente) > 0 ? 'text-danger' : ''}"><strong>$${formatearPrecio(c.saldo_pendiente)}</strong></td>
            <td>${fechaVenc}</td>
            <td>${fElec}</td>
            <td><span class="badge badge-${estadoBadge}">${estadoTexto}</span></td>
            <td>
                <div class="btn-group-vertical">
                    <button onclick="mostrarModalPago('${c.id}')" class="btn btn-sm btn-success" ${estadoTexto === 'CERRADO' ? 'disabled' : ''} title="Registrar pago">💵</button>
                    <button onclick="editarCompra('${c.id}')" class="btn btn-sm btn-secondary" title="Editar">✏️</button>
                    <button onclick="eliminarCompra('${c.id}')" class="btn btn-sm btn-danger" title="Eliminar">🗑️</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function buscarCompras() {
    const termino = document.getElementById('comprasBuscar')?.value.toLowerCase() || '';
    if (!termino) { renderizarTablaCompras(comprasData); return; }
    const filtradas = comprasData.filter(c => {
        const prov = c.proveedor?.razon_social?.toLowerCase() || '';
        const factura = c.numero_factura?.toLowerCase() || '';
        return prov.includes(termino) || factura.includes(termino);
    });
    renderizarTablaCompras(filtradas);
}

async function editarCompra(id) {
    try {
        const { data, error } = await supabaseClient.from('compras_proveedor').select('*, proveedor:proveedores(razon_social)').eq('id', id).single();
        if (error || !data) { showToast('Error al cargar compra', 'error'); return; }

        document.getElementById('formCompra').style.display = 'block';
        document.getElementById('formTituloCompra').textContent = '✏️ Editar Compra';
        document.getElementById('compraId').value = data.id;
        document.getElementById('compraAnio').value = data.anio || 2025;
        document.getElementById('compraMes').value = data.mes_compra || '';
        document.getElementById('compraDia').value = data.dia || '';
        document.getElementById('compraCuenta').value = data.cuenta || '';
        document.getElementById('compraProveedor').value = data.proveedor?.razon_social || '';
        document.getElementById('compraFactura').value = data.numero_factura || '';
        document.getElementById('compraVencimiento').value = data.fecha_vencimiento || '';
        document.getElementById('compraConsecutivo').value = data.consecutivo_moteros || '';
        document.getElementById('compraValor').value = data.valor_compra ? '$' + formatearPrecio(data.valor_compra) : '';
        document.getElementById('compraFElectronica').value = data.f_electronica || '';
        document.getElementById('compraEstado').value = data.estado || 'ABIERTO';
        document.getElementById('compraNotas').value = data.notas || '';
        cargarProveedoresDatalist();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) { console.error('Error:', error); showToast('Error al cargar compra', 'error'); }
}

async function eliminarCompra(id) {
    if (!confirm('¿Estás seguro de eliminar esta compra?')) return;
    try {
        const { error } = await supabaseClient.from('compras_proveedor').delete().eq('id', id);
        if (error) throw error;
        showToast('Compra eliminada', 'success');
        cargarCompras();
    } catch (error) { console.error('Error eliminando:', error); showToast('Error: ' + error.message, 'error'); }
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
    } catch (error) { console.error('Error guardando pago:', error); showToast('Error: ' + error.message, 'error'); }
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
    } catch (error) { console.error('Error subiendo imagen:', error); showToast('Error al subir imagen: ' + error.message, 'error'); return null; }
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
    const productosActivos = productos.filter(p => p.estado === 'Activo').length;
    const statProd = document.getElementById('statProductos'); if (statProd) statProd.textContent = productosActivos;
    const todosInv = [...inventarios.alcala, ...inventarios.local01, ...inventarios.jordan];
    const stockTotal = todosInv.reduce((sum, i) => sum + (i.cantidad || 0), 0);
    const statStock = document.getElementById('statStockTotal'); if (statStock) statStock.textContent = stockTotal.toLocaleString('es-CO');
    const stockBajo = todosInv.filter(i => i.cantidad > 0 && i.cantidad <= (i.stock_minimo || 5)).length;
    const statBajo = document.getElementById('statStockBajo'); if (statBajo) statBajo.textContent = stockBajo;
    const agotados = todosInv.filter(i => i.cantidad === 0).length;
    const statAgot = document.getElementById('statAgotados'); if (statAgot) statAgot.textContent = agotados;

    try {
        const { data: deudores } = await supabaseClient.from('deudores').select('saldo_actual, estado').eq('estado', 'ABIERTO');
        const deudoresActivos = deudores?.length || 0;
        const deudaTotal = deudores?.reduce((sum, d) => sum + parseFloat(d.saldo_actual || 0), 0) || 0;
        const statDeudores = document.getElementById('statDeudores');
        const statDeudaTotal = document.getElementById('statDeudaTotal');
        if (statDeudores) statDeudores.textContent = deudoresActivos;
        if (statDeudaTotal) statDeudaTotal.textContent = '$' + formatearPrecio(deudaTotal);
    } catch (e) { console.error('Error cargando deudores:', e); }

    try {
        const { data: compras } = await supabaseClient.from('compras_proveedor').select('saldo_pendiente').neq('estado', 'pagado');
        const totalProveedores = compras?.reduce((sum, c) => sum + parseFloat(c.saldo_pendiente || 0), 0) || 0;
        const statProv = document.getElementById('statProveedores');
        if (statProv) statProv.textContent = '$' + formatearPrecio(totalProveedores);
    } catch (e) { console.error('Error cargando proveedores:', e); }

    try {
        const hoy = new Date().toISOString().split('T')[0];
        const { data: ventasHoy } = await supabaseClient.from('facturas').select('total').eq('estado', 'completada').gte('created_at', hoy + 'T00:00:00').lte('created_at', hoy + 'T23:59:59');
        const totalVentasHoy = ventasHoy?.reduce((sum, v) => sum + parseFloat(v.total || 0), 0) || 0;

        // Promedio 30 dias
        const hace30dias = new Date();
        hace30dias.setDate(hace30dias.getDate() - 30);
        const { data: ventasMes } = await supabaseClient.from('facturas')
            .select('total')
            .eq('estado', 'completada')
            .gte('created_at', hace30dias.toISOString());
        const totalMes = ventasMes?.reduce((sum, v) => sum + parseFloat(v.total || 0), 0) || 0;
        const promedioDiario = totalMes / 30;

        const containerAdicional = document.getElementById('statsAdicionalesVentas');
        const statVentas = document.getElementById('statVentasHoy');

        if (statVentas) statVentas.textContent = `$${formatearPrecio(totalVentasHoy)}`;

        if (containerAdicional) {
            containerAdicional.innerHTML = `
                <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 10px 15px; border-radius: 8px; margin-top: 10px; display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; color: #1e40af; font-weight: 700;">📈 Promedio Diario (30d)</span>
                    <span style="font-size: 1.1rem; font-weight: 800; color: #1e3a8a;">$${formatearPrecio(promedioDiario)}</span>
                </div>
            `;
        }
    } catch (e) { console.error('Error cargando ventas:', e); }

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
    let valorTotal = 0; todosInv.forEach(inv => { const producto = productos.find(p => p.id_producto === inv.id_producto); if (producto) valorTotal += (producto.precio || 0) * (inv.cantidad || 0); });
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
        const categorias = [...new Set(productos.filter(p => p.estado === 'Activo').map(p => p.categoria))].filter(Boolean);
        const getCantidadCategoria = (inv, cat) => {
            return inv.reduce((sum, item) => {
                const prod = productos.find(p => p.id_producto === item.id_producto);
                return sum + (prod && prod.categoria === cat ? (item.cantidad || 0) : 0);
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
    cargarStockTiendas(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function limpiarFormProducto() {
    ['productoId', 'productoIdProducto', 'productoNombre', 'productoReferencia', 'productoMarca', 'productoPrecioCompra', 'productoPrecio', 'productoMargen', 'productoDescCorta', 'productoDescTecnica', 'productoImagen', 'stockAlcala', 'stockLocal01', 'stockJordan', 'stockDigital'].forEach(id => {
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
        document.getElementById('productoId').value = data.id;
        document.getElementById('productoIdProducto').value = data.id_producto || '';
        document.getElementById('productoNombre').value = data.nombre || '';
        document.getElementById('productoReferencia').value = data.referencia || '';
        document.getElementById('productoCategoria').value = data.categoria || '';
        document.getElementById('productoMarca').value = data.marca || '';
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
    } catch (e) { console.log('Error cargando stock:', e); }
}

function calcularMargen() {
    const precioCompra = parseFloat(document.getElementById('productoPrecioCompra')?.value) || 0;
    const precioVenta = parseFloat(document.getElementById('productoPrecio')?.value) || 0;
    const margenEl = document.getElementById('productoMargen');
    if (margenEl) {
        if (precioCompra > 0 && precioVenta > 0) {
            const margen = ((precioVenta - precioCompra) / precioCompra * 100).toFixed(1);
            margenEl.value = margen + '%';
        } else { margenEl.value = '0%'; }
    }
}

async function guardarProducto() {
    const id = document.getElementById('productoId').value;
    const nombre = document.getElementById('productoNombre').value.trim();
    const categoria = document.getElementById('productoCategoria').value;
    const marca = document.getElementById('productoMarca').value.trim();
    const precio = document.getElementById('productoPrecio').value;
    const precioCompra = document.getElementById('productoPrecioCompra').value;
    if (!nombre || !categoria || !marca || !precio) { showToast('Completa los campos obligatorios', 'warning'); return; }
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
    const producto = { nombre, referencia: document.getElementById('productoReferencia').value.trim() || `REF-${Date.now()}`, categoria, marca, precio: parseFloat(precio) || 0, precio_compra: parseFloat(precioCompra) || 0, descripcion_corta: document.getElementById('productoDescCorta').value.trim(), descripcion_tecnica: document.getElementById('productoDescTecnica').value.trim(), url_imagen: urlImagen, estado: document.getElementById('productoEstado').value, id_producto: idProductoFinal };
    const stockAlcala = parseInt(document.getElementById('stockAlcala')?.value) || 0;
    const stockLocal01 = parseInt(document.getElementById('stockLocal01')?.value) || 0;
    const stockJordan = parseInt(document.getElementById('stockJordan')?.value) || 0;
    const stockDigital = parseInt(document.getElementById('stockDigital')?.value) || 0;
    try {
        if (id) { delete producto.id_producto; const { error } = await supabaseClient.from('productos').update(producto).eq('id', id); if (error) throw error; showToast('Producto actualizado correctamente'); }
        else { producto.id_producto = idProductoFinal; const { error } = await supabaseClient.from('productos').insert([producto]); if (error) throw error; showToast('Producto creado correctamente'); }
        await guardarStockTiendas(idProductoFinal, stockAlcala, stockLocal01, stockJordan, stockDigital);
        cancelarFormProducto(); await cargarProductos(); await cargarTodosLosInventarios();
    } catch (error) { console.error('Error guardando:', error); showToast('Error: ' + error.message, 'error'); }
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
        } catch (e) { console.error(`Error en upsertStock ${tabla}:`, e); }
    };
    try {
        await upsertStock('inventario_alcala', alcala);
        await upsertStock('inventario_01', local01);
        await upsertStock('inventario_jordan', jordan);
        try { await upsertStock('inventario_digital', digital); } catch (e) { console.log('Tabla inventario_digital no disponible'); }
        showToast('Stock guardado en todas las tiendas', 'success');
    } catch (e) { console.error('Error guardando stock:', e); showToast('Error guardando stock: ' + e.message, 'error'); }
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
    } catch (error) { console.error('Error cargando ventas:', error); if (statsContainer) { statsContainer.innerHTML = '<div class="alert alert-warning">No hay datos de ventas</div>'; } }
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
    } catch (error) { console.error('Error cargando deudores:', error); showToast('Error al cargar deudores', 'error'); }
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

function mostrarFormDeudor() {
    document.getElementById('formDeudor').style.display = 'block';
    document.getElementById('formTituloDeudor').textContent = '➕ Nuevo Deudor';
    ['deudorId', 'deudorNombre', 'deudorTelefono', 'deudorSede', 'deudorDescripcion', 'deudorMontoOriginal', 'deudorSaldo', 'deudorReferencia'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('deudorFecha').value = new Date().toISOString().split('T')[0];
}

function cancelarFormDeudor() { document.getElementById('formDeudor').style.display = 'none'; }

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
    } catch (error) { console.error('Error guardando deudor:', error); showToast('Error al guardar', 'error'); }
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
    } catch (error) { console.error('Error cargando deudor:', error); showToast('Error al cargar datos', 'error'); }
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
    } catch (error) { console.error('Error registrando pago:', error); showToast('Error al registrar pago', 'error'); }
}

// ═══════════════════════════════════════════════════════════════
// PROVEEDORES
// ═══════════════════════════════════════════════════════════════
async function cargarProveedores() {
    try {
        const { data, error } = await supabaseClient.from('proveedores').select('*').order('razon_social');
        if (error) throw error;
        todosProveedores = data || [];
        renderizarProveedores(todosProveedores);
        const activos = data?.filter(p => p.activo) || [];
        document.getElementById('proveedoresTotal').textContent = data?.length || 0;
        document.getElementById('proveedoresActivos').textContent = activos.length;
    } catch (error) { console.error('Error cargando proveedores:', error); showToast('Error al cargar proveedores', 'error'); }
}

function renderizarProveedores(lista) {
    const tbody = document.getElementById('tbodyProveedores');
    if (!lista || lista.length === 0) { tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay proveedores</td></tr>'; return; }
    tbody.innerHTML = lista.map(p => `<tr><td><strong>${p.razon_social}</strong></td><td>${p.contacto_nombre || '-'}</td><td>${p.contacto_telefono || '-'}</td><td><span class="badge badge-info">${p.condicion_pago || 'contado'}</span></td><td><strong>$${formatearPrecio(p.saldo_pendiente || 0)}</strong></td><td><span class="badge ${p.activo ? 'badge-success' : 'badge-secondary'}">${p.activo ? 'Activo' : 'Inactivo'}</span></td><td><button onclick="editarProveedor('${p.id}')" class="btn btn-sm btn-secondary">✏️</button></td></tr>`).join('');
}

function buscarProveedores() {
    const query = document.getElementById('proveedoresBuscar').value.toLowerCase();
    if (!query) { renderizarProveedores(todosProveedores); return; }
    renderizarProveedores(todosProveedores.filter(p => p.razon_social?.toLowerCase().includes(query) || p.contacto_nombre?.toLowerCase().includes(query)));
}

function mostrarFormProveedor() {
    document.getElementById('formProveedor').style.display = 'block';
    document.getElementById('formTituloProveedor').textContent = '➕ Nuevo Proveedor';
    ['proveedorId', 'proveedorNombre', 'proveedorNit', 'proveedorContacto', 'proveedorTelefono', 'proveedorEmail', 'proveedorDireccion', 'proveedorNotas'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('proveedorCondicion').value = 'contado';
}

function cancelarFormProveedor() { document.getElementById('formProveedor').style.display = 'none'; }

async function guardarProveedor() {
    const nombre = document.getElementById('proveedorNombre').value;
    if (!nombre) { showToast('El nombre es obligatorio', 'warning'); return; }
    try {
        const proveedor = { razon_social: nombre, nit: document.getElementById('proveedorNit').value, contacto_nombre: document.getElementById('proveedorContacto').value, contacto_telefono: document.getElementById('proveedorTelefono').value, condicion_pago: document.getElementById('proveedorCondicion').value, contacto_email: document.getElementById('proveedorEmail').value, direccion: document.getElementById('proveedorDireccion').value, notas: document.getElementById('proveedorNotas').value, activo: true };
        const id = document.getElementById('proveedorId').value;
        if (id) { const { error } = await supabaseClient.from('proveedores').update(proveedor).eq('id', id); if (error) throw error; showToast('Proveedor actualizado', 'success'); }
        else { const { error } = await supabaseClient.from('proveedores').insert(proveedor); if (error) throw error; showToast('Proveedor registrado', 'success'); }
        cancelarFormProveedor(); cargarProveedores();
    } catch (error) { console.error('Error guardando proveedor:', error); showToast('Error al guardar', 'error'); }
}

async function editarProveedor(id) {
    try {
        const { data, error } = await supabaseClient.from('proveedores').select('*').eq('id', id).single();
        if (error) throw error;
        document.getElementById('formProveedor').style.display = 'block';
        document.getElementById('formTituloProveedor').textContent = '✏️ Editar Proveedor';
        document.getElementById('proveedorId').value = data.id;
        document.getElementById('proveedorNombre').value = data.razon_social || '';
        document.getElementById('proveedorNit').value = data.nit || '';
        document.getElementById('proveedorContacto').value = data.contacto_nombre || '';
        document.getElementById('proveedorTelefono').value = data.contacto_telefono || '';
        document.getElementById('proveedorCondicion').value = data.condicion_pago || 'contado';
        document.getElementById('proveedorEmail').value = data.contacto_email || '';
        document.getElementById('proveedorDireccion').value = data.direccion || '';
        document.getElementById('proveedorNotas').value = data.notas || '';
    } catch (error) { console.error('Error cargando proveedor:', error); showToast('Error al cargar datos', 'error'); }
}

// ═══════════════════════════════════════════════════════════════
// DEUDAS DEL NEGOCIO, CRÉDITOS, BODEGAS, ALIANZAS
// ═══════════════════════════════════════════════════════════════
async function cargarDeudasNegocio() {
    console.log('📋 Cargando deudas del negocio...');
    const tbody = document.getElementById('tbodyDeudas');
    if (!tbody) { console.error('❌ No se encontró tbodyDeudas'); return; }
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando...</td></tr>';

    try {
        const { data, error } = await supabaseClient.from('deudas_negocio').select('*').order('saldo_actual', { ascending: false });
        if (error) { console.error('❌ Error Supabase:', error); throw error; }

        console.log('✅ Deudas cargadas:', data?.length || 0);

        // Calcular estadísticas
        const abiertas = (data || []).filter(d => d.estado === 'ABIERTO');
        const totalSaldo = abiertas.reduce((s, d) => s + parseFloat(d.saldo_actual || 0), 0);

        const elSaldo = document.getElementById('deudasTotalSaldo');
        const elActivas = document.getElementById('deudasActivas');
        if (elSaldo) elSaldo.textContent = '$' + formatearPrecio(totalSaldo);
        if (elActivas) elActivas.textContent = abiertas.length;

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
                <button onclick="editarDeudaNegocio('${d.id}')" class="btn btn-sm btn-secondary">✏️</button>
                <button onclick="registrarPagoDeuda('${d.id}')" class="btn btn-sm btn-success" ${d.saldo_actual <= 0 ? 'disabled' : ''}>💰</button>
            </td>
        </tr>`).join('');

        console.log('✅ Tabla de deudas renderizada');
    } catch (error) {
        console.error('❌ Error cargando deudas:', error);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error: ${error.message}</td></tr>`;
        showToast('Error al cargar deudas: ' + error.message, 'error');
    }
}

function mostrarFormDeuda() { document.getElementById('formDeuda').style.display = 'block';['deudaId', 'deudaConcepto', 'deudaFactura', 'deudaAcreedor', 'deudaMontoOriginal', 'deudaSaldo', 'deudaNotas'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); }
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
    } catch (error) { console.error('Error guardando deuda:', error); showToast('Error al guardar', 'error'); }
}

async function editarDeudaNegocio(id) {
    try {
        const { data, error } = await supabaseClient.from('deudas_negocio').select('*').eq('id', id).single();
        if (error || !data) { showToast('Error al cargar deuda', 'error'); return; }
        document.getElementById('formDeuda').style.display = 'block';
        document.getElementById('deudaId').value = data.id;
        document.getElementById('deudaConcepto').value = data.concepto || '';
        document.getElementById('deudaFactura').value = data.numero_factura || '';
        document.getElementById('deudaAcreedor').value = data.acreedor || '';
        document.getElementById('deudaMontoOriginal').value = data.monto_original || '';
        document.getElementById('deudaSaldo').value = data.saldo_actual || '';
        document.getElementById('deudaNotas').value = data.notas || '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) { console.error('Error editando deuda:', error); showToast('Error: ' + error.message, 'error'); }
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
                               min="0" max="${saldoPendiente}" step="1000">
                        <div style="display:flex;gap:0.5rem;margin-top:0.75rem;">
                            <button onclick="document.getElementById('montoPagoDeuda').value=${Math.round(saldoPendiente / 2)}"
                                    style="flex:1;padding:0.5rem;border:1px solid #e5e7eb;background:#f9fafb;border-radius:6px;cursor:pointer;font-size:0.8rem;">
                                50% ($${formatearPrecio(Math.round(saldoPendiente / 2))})
                            </button>
                            <button onclick="document.getElementById('montoPagoDeuda').value=${saldoPendiente}"
                                    style="flex:1;padding:0.5rem;border:1px solid #e5e7eb;background:#f9fafb;border-radius:6px;cursor:pointer;font-size:0.8rem;">
                                Total ($${formatearPrecio(saldoPendiente)})
                            </button>
                        </div>
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

    } catch (error) {
        console.error('Error cargando deuda:', error);
        showToast('Error al cargar deuda', 'error');
    }
}

async function confirmarPagoDeuda(id) {
    const monto = parseFloat(document.getElementById('montoPagoDeuda')?.value);

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

        await supabaseClient.from('pagos_deuda_negocio').insert({
            deuda_id: id,
            monto: monto,
            fecha_pago: new Date().toISOString().split('T')[0]
        });

        await supabaseClient.from('deudas_negocio').update({
            saldo_actual: nuevoSaldo,
            estado: nuevoSaldo === 0 ? 'CERRADO' : 'ABIERTO'
        }).eq('id', id);

        document.getElementById('modalPagoDeuda')?.remove();
        showToast('✅ Pago registrado correctamente', 'success');
        cargarDeudasNegocio();

    } catch (error) {
        console.error('Error registrando pago:', error);
        showToast('Error al registrar pago: ' + error.message, 'error');
    }
}

window.confirmarPagoDeuda = confirmarPagoDeuda;

// CRÉDITOS MOTERO - NO TOCAR - SOLO SE CREAN DESDE TIENDA
async function cargarCreditos() {
    const tbody = document.getElementById('tbodyCreditos');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando...</td></tr>';

    try {
        // Cargar todos para estadísticas
        const { data: todosCreditos, error: errTodos } = await supabaseClient
            .from('creditos_motero')
            .select('*, clientes_credito(*)')
            .order('created_at', { ascending: false });

        if (errTodos) throw errTodos;

        // Actualizar stats - soporta ambos formatos: activo/abierto, pagado/cerrado (case insensitive)
        const creditos = todosCreditos || [];
        const normalizar = (estado) => (estado || '').toLowerCase().trim();
        const esActivo = (estado) => ['activo', 'abierto'].includes(normalizar(estado));
        const esMora = (estado) => normalizar(estado) === 'mora';
        const esPagado = (estado) => ['pagado', 'cerrado'].includes(normalizar(estado));

        const activos = creditos.filter(c => esActivo(c.estado)).length;
        const enMora = creditos.filter(c => esMora(c.estado)).length;
        const pagados = creditos.filter(c => esPagado(c.estado)).length;
        const saldoTotal = creditos.filter(c => !esPagado(c.estado)).reduce((sum, c) => sum + parseFloat(c.saldo_pendiente || 0), 0);

        const elActivos = document.getElementById('creditosActivos');
        const elSaldo = document.getElementById('creditosSaldoTotal');
        const elMora = document.getElementById('creditosMora');
        const elPagados = document.getElementById('creditosPagados');

        if (elActivos) elActivos.textContent = activos;
        if (elSaldo) elSaldo.textContent = '$' + formatearPrecio(saldoTotal);
        if (elMora) elMora.textContent = enMora;
        if (elPagados) elPagados.textContent = pagados;

        // Filtrar para tabla - soporta ambos formatos
        let estadoFiltro = document.getElementById('creditosEstadoFiltro')?.value || '';
        let datosFiltrados;
        if (!estadoFiltro) {
            datosFiltrados = creditos;
        } else if (estadoFiltro === 'activo') {
            datosFiltrados = creditos.filter(c => esActivo(c.estado));
        } else if (estadoFiltro === 'mora') {
            datosFiltrados = creditos.filter(c => esMora(c.estado));
        } else if (estadoFiltro === 'pagado') {
            datosFiltrados = creditos.filter(c => esPagado(c.estado));
        } else {
            datosFiltrados = creditos.filter(c => c.estado === estadoFiltro);
        }

        if (!datosFiltrados || datosFiltrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay créditos registrados</td></tr>';
            return;
        }

        tbody.innerHTML = datosFiltrados.map(c => {
            const cliente = c.clientes_credito;
            // Extraer nombre: primero de cliente vinculado, luego de notas, luego de numero_credito
            let nombre = 'Sin cliente';
            let telefono = '';

            if (cliente) {
                nombre = cliente.nombres ? `${cliente.nombres} ${cliente.apellidos || ''}` : (cliente.nombre || 'Sin nombre');
                telefono = cliente.telefono || '';
            } else if (c.notas) {
                // Extraer info de notas (formato nuevo: "Crédito: NOMBRE | CC: xxx | Tel: xxx")
                const matchNuevoFormato = c.notas.match(/Crédito:\s*([^|]+)/i);
                const matchTel = c.notas.match(/Tel:\s*(\d+)/i);

                if (matchNuevoFormato) {
                    // Nuevo formato: usar nombre del campo Crédito:
                    nombre = matchNuevoFormato[1].trim().substring(0, 30);
                } else if (c.numero_credito) {
                    // Formato viejo: extraer nombre del numero_credito (ej: CRED-20241220-MANITAS -> MANITAS)
                    const partes = c.numero_credito.split('-');
                    if (partes.length > 2) {
                        nombre = partes[partes.length - 1];
                    } else {
                        // Fallback: usar primera parte de notas antes del pipe
                        const matchFallback = c.notas.match(/^([^|]+)/);
                        if (matchFallback) nombre = matchFallback[1].trim().substring(0, 25);
                    }
                }

                if (matchTel) telefono = matchTel[1];
            }

            // Si aún no hay nombre, usar parte del numero_credito
            if (nombre === 'Sin cliente' && c.numero_credito) {
                const partes = c.numero_credito.split('-');
                if (partes.length > 2) nombre = partes[partes.length - 1];
            }

            telefono = telefono.replace(/\D/g, '');

            // Colores mejorados por estado (soporta ambos formatos)
            let estadoBadge, estadoTexto, rowBg;
            if (esPagado(c.estado)) {
                estadoBadge = 'background:#10b981;color:white;';
                estadoTexto = '✅ PAGADO';
                rowBg = 'background:#f0fdf4;';
            } else if (esMora(c.estado)) {
                estadoBadge = 'background:#ef4444;color:white;';
                estadoTexto = '🔴 EN MORA';
                rowBg = 'background:#fef2f2;';
            } else {
                estadoBadge = 'background:#f59e0b;color:white;';
                estadoTexto = '🟡 ACTIVO';
                rowBg = 'background:#fffbeb;';
            }

            // Mensaje de WhatsApp según estado
            let whatsappMsg, whatsappTip;
            if (esMora(c.estado)) {
                whatsappMsg = `Hola ${nombre.split(' ')[0]}! 👋 Te recordamos que tu crédito en Moteros Sport Line tiene un saldo pendiente de $${formatearPrecio(c.saldo_pendiente)}. Por favor acércate a realizar tu pago. ¡Gracias!`;
                whatsappTip = 'Enviar recordatorio de mora';
            } else if (esPagado(c.estado)) {
                whatsappMsg = `Hola ${nombre.split(' ')[0]}! 🎉 En Moteros Sport Line te agradecemos por ser un excelente cliente. Por tu buen historial de pagos, tienes disponible un nuevo crédito. ¡Visítanos!`;
                whatsappTip = 'Ofrecer nuevo crédito';
            } else {
                whatsappMsg = `Hola ${nombre.split(' ')[0]}! 👋 Te recordamos que tu próxima cuota del crédito en Moteros Sport Line es de $${formatearPrecio(Math.round((c.saldo_pendiente || 0) / Math.max(1, (c.numero_cuotas || 1) - (c.cuotas_pagadas || 0))))}. ¡Te esperamos!`;
                whatsappTip = 'Enviar recordatorio de pago';
            }

            return `<tr style="${rowBg}">
                <td><strong>${nombre}</strong></td>
                <td>${cliente?.telefono || '-'}</td>
                <td>$${formatearPrecio(c.monto_total || 0)}</td>
                <td><strong style="color:${c.saldo_pendiente > 0 ? '#ef4444' : '#10b981'}; font-size:1.1em;">$${formatearPrecio(c.saldo_pendiente || 0)}</strong></td>
                <td><span style="background:#e2e8f0;padding:0.25rem 0.5rem;border-radius:0.5rem;">${c.cuotas_pagadas || 0}/${c.numero_cuotas || 1}</span></td>
                <td><span style="${estadoBadge}padding:0.35rem 0.75rem;border-radius:1rem;font-size:0.8rem;font-weight:600;">${estadoTexto}</span></td>
                <td style="white-space:nowrap;">
                    <button onclick="verDetalleCredito('${c.id}')" class="btn btn-sm btn-secondary" title="Ver detalle">👁️</button>
                    ${!esPagado(c.estado) ? `<button onclick="registrarPagoCredito('${c.id}')" class="btn btn-sm btn-success" title="Registrar pago">💰</button>` : ''}
                    ${telefono ? `<a href="https://wa.me/57${telefono}?text=${encodeURIComponent(whatsappMsg)}" target="_blank" class="btn btn-sm" style="background:#25D366;color:white;" title="${whatsappTip}">📱</a>` : ''}
                </td>
            </tr>`;
        }).join('');
    } catch (error) {
        console.error('Error cargando créditos:', error);
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error al cargar</td></tr>';
        showToast('Error al cargar créditos: ' + error.message, 'error');
    }
}

function mostrarFormCredito() { showToast('Los créditos se crean desde las tiendas físicas', 'info'); }

async function verDetalleCredito(id) {
    try {
        const { data, error } = await supabaseClient.from('creditos_motero').select('*, clientes_credito(*)').eq('id', id).single();
        if (error) throw error;

        const cliente = data.clientes_credito;
        const nombreCliente = cliente ? `${cliente.nombres} ${cliente.apellidos || ''}` : 'Sin cliente';
        const fechaCreacion = data.created_at ? new Date(data.created_at).toLocaleDateString('es-CO') : '-';
        const ultimoPago = data.ultimo_pago_fecha ? new Date(data.ultimo_pago_fecha).toLocaleDateString('es-CO') : 'Sin pagos';
        const estadoColor = data.estado === 'activo' ? '#f59e0b' : (data.estado === 'mora' ? '#ef4444' : '#10b981');

        const modalContent = `
            <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;" onclick="if(event.target===this)this.remove()">
                <div style="background:white;border-radius:1rem;max-width:650px;width:90%;max-height:90vh;overflow-y:auto;padding:2rem;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;border-bottom:2px solid #f1f5f9;padding-bottom:1rem;">
                        <h3 style="margin:0;color:#1e293b;">💳 Detalle del Crédito</h3>
                        <button onclick="this.closest('div[style*=\"position:fixed\"]').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#64748b;">&times;</button>
                    </div>

                    <div style="background:#f8fafc;padding:1.5rem;border-radius:0.75rem;margin-bottom:1.5rem;">
                        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;">
                            <div style="width:50px;height:50px;background:#ff6b00;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:1.5rem;font-weight:700;">${nombreCliente.charAt(0)}</div>
                            <div>
                                <h4 style="margin:0;color:#1e293b;">${nombreCliente}</h4>
                                <p style="margin:0;color:#64748b;font-size:0.9rem;">${cliente?.telefono || 'Sin teléfono'}</p>
                            </div>
                            <span style="margin-left:auto;background:${estadoColor};color:white;padding:0.25rem 0.75rem;border-radius:1rem;font-size:0.85rem;font-weight:600;text-transform:uppercase;">${data.estado}</span>
                        </div>
                        ${cliente?.direccion ? `<p style="margin:0;color:#64748b;font-size:0.85rem;">📍 ${cliente.direccion}</p>` : ''}
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;">
                        <div style="background:#fff7ed;padding:1rem;border-radius:0.5rem;text-align:center;border:1px solid #fed7aa;">
                            <small style="color:#9a3412;">Monto Total</small>
                            <p style="margin:0;font-weight:700;font-size:1.4rem;color:#ea580c;">$${formatearPrecio(data.monto_total || 0)}</p>
                        </div>
                        <div style="background:${data.saldo_pendiente > 0 ? '#fef2f2' : '#dcfce7'};padding:1rem;border-radius:0.5rem;text-align:center;border:1px solid ${data.saldo_pendiente > 0 ? '#fecaca' : '#bbf7d0'};">
                            <small style="color:${data.saldo_pendiente > 0 ? '#991b1b' : '#166534'};">Saldo Pendiente</small>
                            <p style="margin:0;font-weight:700;font-size:1.4rem;color:${data.saldo_pendiente > 0 ? '#dc2626' : '#16a34a'};">$${formatearPrecio(data.saldo_pendiente || 0)}</p>
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem;margin-bottom:1.5rem;">
                        <div style="background:#f1f5f9;padding:0.75rem;border-radius:0.5rem;text-align:center;">
                            <small style="color:#64748b;">Cuotas</small>
                            <p style="margin:0;font-weight:600;color:#1e293b;">${data.cuotas_pagadas || 0} / ${data.numero_cuotas || 1}</p>
                        </div>
                        <div style="background:#f1f5f9;padding:0.75rem;border-radius:0.5rem;text-align:center;">
                            <small style="color:#64748b;">Fecha Inicio</small>
                            <p style="margin:0;font-weight:600;color:#1e293b;">${fechaCreacion}</p>
                        </div>
                        <div style="background:#f1f5f9;padding:0.75rem;border-radius:0.5rem;text-align:center;">
                            <small style="color:#64748b;">Último Pago</small>
                            <p style="margin:0;font-weight:600;color:#1e293b;">${ultimoPago}</p>
                        </div>
                    </div>

                    ${data.saldo_pendiente > 0 ? `
                    <button onclick="this.closest('div[style*=\"position:fixed\"]').remove(); registrarPagoCredito('${id}')" style="width:100%;padding:1rem;background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;border-radius:0.5rem;font-weight:600;font-size:1rem;cursor:pointer;">
                        💰 Registrar Pago
                    </button>
                    ` : `<div style="background:#dcfce7;padding:1rem;border-radius:0.5rem;text-align:center;color:#166534;font-weight:600;">✅ Crédito Completamente Pagado</div>`}
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalContent);
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al cargar detalle del crédito', 'error');
    }
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
        console.error('Error:', error);
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
            fecha_pago: new Date().toISOString()
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
        console.error('Error registrando pago:', error);
        showToast('Error al registrar pago', 'error');
    }
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
    } catch (error) { console.error('Error cargando bodegas:', error); tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error al cargar</td></tr>'; }
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
    } catch (error) { console.error('Error moviendo de bodega:', error); showToast('Error al mover: ' + error.message, 'error'); }
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
    } catch (error) { console.error('Error cargando alianzas:', error); tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error al cargar</td></tr>'; }
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
    } catch (error) { console.error('Error guardando alianza:', error); showToast('Error: ' + error.message, 'error'); }
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
    } catch (error) { console.error('Error editando alianza:', error); showToast('Error: ' + error.message, 'error'); }
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
        console.error('Error guardando alianza:', error);
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
            <div class="card-header"><h3>🏷️ Promociones (${promociones.length})</h3></div>
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
        console.error('Error cargando productos:', error);
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

// CONFIGURACIÓN
async function cargarConfiguracion() { try { const { data, error } = await supabaseClient.from('configuracion_sistema').select('*'); if (error) throw error; const config = (data || []).reduce((acc, item) => { acc[item.clave] = item.valor; return acc; }, {}); const campos = { 'configWhatsapp': 'whatsapp', 'configFacebook': 'facebook', 'configInstagram': 'instagram', 'configTiktok': 'tiktok', 'configEmail': 'email', 'configTelefono': 'telefono', 'configDireccion': 'direccion', 'configLogo': 'logo_url', 'configNombre': 'nombre_tienda', 'configSlogan': 'slogan', 'configStockMinimo': 'stock_minimo', 'configMoneda': 'moneda', 'configHorarioAlcala': 'horario_alcala', 'configHorarioLocal01': 'horario_local01', 'configHorarioJordan': 'horario_jordan' }; Object.entries(campos).forEach(([elId, clave]) => { const el = document.getElementById(elId); if (el) el.value = config[clave] || ''; }); const colorEl = document.getElementById('configColor'); if (colorEl) colorEl.value = config.color_primary || '#ff6b00'; if (config.logo_url) { const preview = document.getElementById('previewLogo'); const container = document.getElementById('previewContainerLogo'); if (preview && container) { preview.src = config.logo_url; container.style.display = 'inline-block'; } } cargarEmpleados(); cargarMetodosPagoConfig(); } catch (error) { console.error('Error cargando configuración:', error); } }
async function guardarConfiguracion() { let logoUrl = document.getElementById('configLogo').value.trim(); if (archivosTemporal.logo) { showToast('Subiendo logo...', 'info'); const urlSubida = await subirImagen(archivosTemporal.logo, 'configuracion'); if (urlSubida) { logoUrl = urlSubida; archivosTemporal.logo = null; } } const configs = [{ clave: 'whatsapp', valor: document.getElementById('configWhatsapp').value.trim() }, { clave: 'facebook', valor: document.getElementById('configFacebook').value.trim() }, { clave: 'instagram', valor: document.getElementById('configInstagram').value.trim() }, { clave: 'tiktok', valor: document.getElementById('configTiktok').value.trim() }, { clave: 'email', valor: document.getElementById('configEmail').value.trim() }, { clave: 'telefono', valor: document.getElementById('configTelefono').value.trim() }, { clave: 'direccion', valor: document.getElementById('configDireccion').value.trim() }, { clave: 'logo_url', valor: logoUrl }, { clave: 'nombre_tienda', valor: document.getElementById('configNombre').value.trim() }, { clave: 'slogan', valor: document.getElementById('configSlogan').value.trim() }, { clave: 'color_primary', valor: document.getElementById('configColor').value }, { clave: 'stock_minimo', valor: document.getElementById('configStockMinimo').value.trim() }, { clave: 'moneda', valor: document.getElementById('configMoneda').value }, { clave: 'horario_alcala', valor: document.getElementById('configHorarioAlcala').value.trim() }, { clave: 'horario_local01', valor: document.getElementById('configHorarioLocal01').value.trim() }, { clave: 'horario_jordan', valor: document.getElementById('configHorarioJordan').value.trim() }]; try { for (const config of configs) { const { error } = await supabaseClient.from('configuracion_sistema').upsert(config, { onConflict: 'clave' }); if (error) throw error; } showToast('Configuración guardada'); } catch (error) { showToast('Error: ' + error.message, 'error'); } }

// CIERRES
async function cargarCierresCaja() {
    console.log('💵 Cargando cierres de caja...');
    const tbody = document.getElementById('tbodyCierres');
    if (!tbody) { console.error('❌ No se encontró tbodyCierres'); return; }
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Cargando...</td></tr>';

    try {
        const local = document.getElementById('cierresLocalFiltro')?.value || '';
        const fecha = document.getElementById('cierresFechaFiltro')?.value || '';
        console.log('📋 Filtros - Local:', local || 'todos', '| Fecha:', fecha || 'todas');

        let query = supabaseClient.from('cierres_caja').select('*').order('fecha_apertura', { ascending: false }).limit(50);
        if (local) query = query.eq('local', local);
        if (fecha) query = query.gte('fecha_apertura', fecha + 'T00:00:00').lte('fecha_apertura', fecha + 'T23:59:59');

        const { data, error } = await query;
        if (error) { console.error('❌ Error Supabase:', error); throw error; }

        console.log('✅ Cierres cargados:', data?.length || 0);

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay cierres registrados</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(c => {
            const fechaStr = c.fecha_apertura ? new Date(c.fecha_apertura).toLocaleDateString('es-CO') : '-';
            const diferencia = c.diferencia_efectivo || 0;
            const badgeColor = diferencia === 0 ? 'badge-success' : (diferencia < 0 ? 'badge-danger' : 'badge-warning');
            const estadoBadge = c.estado === 'cerrado' ? 'badge-success' : 'badge-warning';
            return `<tr>
                <td>${fechaStr}</td>
                <td><strong>${c.local}</strong></td>
                <td>${c.vendedor || '-'}</td>
                <td>$${formatearPrecio(c.total_ventas_sistema || 0)}</td>
                <td>$${formatearPrecio(c.efectivo_contado || 0)}</td>
                <td><span class="badge ${badgeColor}">$${formatearPrecio(diferencia)}</span></td>
                <td><span class="badge ${estadoBadge}">${c.estado}</span></td>
                <td>
                    <button onclick="verDetalleCierre('${c.id}')" class="btn btn-sm btn-secondary" title="Ver Detalle">👁️</button>
                    <button onclick="editarCierre('${c.id}')" class="btn btn-sm btn-primary" title="Editar / Corregir">✏️</button>
                </td>
            </tr>`;
        }).join('');
        console.log('✅ Tabla de cierres renderizada');
    } catch (error) {
        console.error('❌ Error cargando cierres:', error);
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error: ${error.message}</td></tr>`;
        showToast('Error al cargar cierres: ' + error.message, 'error');
    }
}

async function verDetalleCierre(id) {
    console.log('👁️ Ver detalle cierre:', id);
    try {
        const { data, error } = await supabaseClient.from('cierres_caja').select('*').eq('id', id).single();
        if (error) throw error;

        const fecha = data.fecha ? new Date(data.fecha).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-';

        // Crear modal
        const modal = document.createElement('div');
        modal.id = 'modalDetalleCierre';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
        modal.onclick = function (e) { if (e.target === this) this.remove(); };

        modal.innerHTML = `
            <div style="background:white;border-radius:1rem;max-width:600px;width:90%;max-height:90vh;overflow-y:auto;padding:2rem;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;border-bottom:2px solid #f1f5f9;padding-bottom:1rem;">
                    <h3 style="margin:0;color:#1e293b;">📊 Detalle de Cierre</h3>
                    <button onclick="document.getElementById('modalDetalleCierre').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#64748b;">&times;</button>
                </div>
                <div style="display:grid;gap:1rem;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                        <div style="background:#f8fafc;padding:1rem;border-radius:0.5rem;">
                            <small style="color:#64748b;">Local</small>
                            <p style="margin:0;font-weight:600;font-size:1.2rem;color:#1e293b;">${data.local || '-'}</p>
                        </div>
                        <div style="background:#f8fafc;padding:1rem;border-radius:0.5rem;">
                            <small style="color:#64748b;">Fecha</small>
                            <p style="margin:0;font-weight:600;color:#1e293b;">${fecha}</p>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;">
                        <div style="background:#dcfce7;padding:1rem;border-radius:0.5rem;text-align:center;">
                            <small style="color:#166534;">Efectivo</small>
                            <p style="margin:0;font-weight:700;font-size:1.3rem;color:#166534;">$${formatearPrecio(data.efectivo || 0)}</p>
                        </div>
                        <div style="background:#dbeafe;padding:1rem;border-radius:0.5rem;text-align:center;">
                            <small style="color:#1e40af;">Transferencias</small>
                            <p style="margin:0;font-weight:700;font-size:1.3rem;color:#1e40af;">$${formatearPrecio(data.transferencias || 0)}</p>
                        </div>
                        <div style="background:#fef3c7;padding:1rem;border-radius:0.5rem;text-align:center;">
                            <small style="color:#92400e;">Tarjeta</small>
                            <p style="margin:0;font-weight:700;font-size:1.3rem;color:#92400e;">$${formatearPrecio(data.tarjeta || 0)}</p>
                        </div>
                    </div>
                    <div style="background:linear-gradient(135deg,#ff6b00,#ff8533);padding:1.5rem;border-radius:0.75rem;text-align:center;">
                        <small style="color:rgba(255,255,255,0.9);">Total del Día</small>
                        <p style="margin:0;font-weight:800;font-size:2rem;color:white;">$${formatearPrecio(data.total || 0)}</p>
                    </div>
                    ${data.notas ? `<div style="background:#f1f5f9;padding:1rem;border-radius:0.5rem;"><small style="color:#64748b;">Notas</small><p style="margin:0.5rem 0 0;color:#334155;">${data.notas}</p></div>` : ''}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al cargar detalle', 'error');
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
        console.error(e);
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
        console.error(e);
        showToast('Error al guardar corrección: ' + e.message, 'error');
    }
}

function exportarCierres() {
    console.log('📥 Exportando cierres...');
    showToast('Exportando cierres...', 'info');
}

// GASTOS
let gastosData = [];

async function cargarGastos() {
    console.log('💸 Cargando gastos...');
    const tbody = document.getElementById('tbodyGastos');
    if (!tbody) { console.error('❌ No se encontró tbodyGastos'); return; }
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando...</td></tr>';

    try {
        const local = document.getElementById('gastosLocalFiltro')?.value || '';
        console.log('📋 Filtro local:', local || 'todos');

        let query = supabaseClient.from('gastos_tienda').select('*').order('fecha_gasto', { ascending: false }).limit(100);
        if (local) query = query.eq('local', local);

        const { data, error } = await query;
        if (error) { console.error('❌ Error Supabase:', error); throw error; }

        console.log('✅ Gastos cargados:', data?.length || 0);
        gastosData = data || [];

        // Calcular totales
        const totalGastos = gastosData.reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);
        const elTotal = document.getElementById('gastosTotalMes');
        if (elTotal) elTotal.textContent = '$' + formatearPrecio(totalGastos);

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay gastos registrados</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(g => {
            const fecha = g.fecha_gasto ? new Date(g.fecha_gasto).toLocaleDateString('es-CO') : '-';
            return `<tr>
                <td>${fecha}</td>
                <td><strong>${g.local || '-'}</strong></td>
                <td>${g.categoria || 'Sin categoría'}</td>
                <td>${g.descripcion || '-'}</td>
                <td><strong>$${formatearPrecio(g.monto)}</strong></td>
                <td><span class="badge badge-info">${g.metodo_pago || 'efectivo'}</span></td>
                <td>
                    <button onclick="editarGasto('${g.id}')" class="btn btn-sm btn-secondary">✏️</button>
                    <button onclick="eliminarGasto('${g.id}')" class="btn btn-sm btn-danger">🗑️</button>
                </td>
            </tr>`;
        }).join('');
        console.log('✅ Tabla de gastos renderizada');
    } catch (error) {
        console.error('❌ Error cargando gastos:', error);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error: ${error.message}</td></tr>`;
        showToast('Error al cargar gastos: ' + error.message, 'error');
    }
}

function mostrarFormGasto() {
    console.log('📝 Mostrando formulario de gasto');
    document.getElementById('formGasto').style.display = 'block';
    document.getElementById('formTituloGasto').textContent = '➕ Nuevo Gasto';
    ['gastoId', 'gastoDescripcion', 'gastoMonto', 'gastoRegistradoPor', 'gastoNotas'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('gastoLocal').value = 'alcala';
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
    const local = document.getElementById('gastoLocal').value;
    const descripcion = document.getElementById('gastoDescripcion').value;
    const monto = parseFloat(document.getElementById('gastoMonto').value);

    if (!local || !descripcion || !monto) {
        showToast('Completa los campos obligatorios', 'warning');
        return;
    }

    console.log('💾 Guardando gasto...');

    try {
        const gasto = {
            local,
            categoria: document.getElementById('gastoCategoria').value || null,
            descripcion,
            monto,
            metodo_pago: document.getElementById('gastoMetodo').value,
            fecha_gasto: document.getElementById('gastoFecha').value || new Date().toISOString().split('T')[0],
            registrado_por: document.getElementById('gastoRegistradoPor').value || null,
            notas: document.getElementById('gastoNotas').value || null
        };

        console.log('📋 Datos del gasto:', gasto);

        let error;
        if (id) {
            gasto.updated_at = new Date().toISOString();
            const result = await supabaseClient.from('gastos_tienda').update(gasto).eq('id', id);
            error = result.error;
        } else {
            const result = await supabaseClient.from('gastos_tienda').insert(gasto);
            error = result.error;
        }

        if (error) { console.error('❌ Error Supabase:', error); throw error; }

        console.log('✅ Gasto guardado');
        showToast(id ? 'Gasto actualizado' : 'Gasto registrado correctamente', 'success');
        cancelarFormGasto();
        await cargarGastos();
    } catch (error) {
        console.error('❌ Error guardando gasto:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

async function eliminarGasto(id) {
    if (!confirm('¿Eliminar este gasto?')) return;
    console.log('🗑️ Eliminando gasto:', id);

    try {
        const { error } = await supabaseClient.from('gastos_tienda').delete().eq('id', id);
        if (error) throw error;
        console.log('✅ Gasto eliminado');
        showToast('Gasto eliminado', 'success');
        await cargarGastos();
    } catch (error) {
        console.error('❌ Error eliminando gasto:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

async function editarGasto(id) {
    console.log('✏️ Editando gasto:', id);

    const gasto = gastosData.find(g => g.id === id);
    if (!gasto) {
        showToast('Gasto no encontrado', 'error');
        return;
    }

    document.getElementById('formGasto').style.display = 'block';
    document.getElementById('formTituloGasto').textContent = '✏️ Editar Gasto';
    document.getElementById('gastoId').value = gasto.id;
    document.getElementById('gastoLocal').value = gasto.local || 'alcala';
    document.getElementById('gastoCategoria').value = gasto.categoria || '';
    document.getElementById('gastoDescripcion').value = gasto.descripcion || '';
    document.getElementById('gastoMonto').value = gasto.monto || '';
    document.getElementById('gastoMetodo').value = gasto.metodo_pago || 'efectivo';
    document.getElementById('gastoFecha').value = gasto.fecha_gasto || '';
    document.getElementById('gastoRegistradoPor').value = gasto.registrado_por || '';
    document.getElementById('gastoNotas').value = gasto.notas || '';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

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
async function agregarDestacado(id) { const destacadosActuales = productos.filter(p => p.estado === 'Activo' && p.destacado === true).length; if (destacadosActuales >= MAX_DESTACADOS) { showToast(`Máximo ${MAX_DESTACADOS} productos destacados`, 'warning'); return; } try { showToast('Agregando a destacados...', 'info'); const { error } = await supabaseClient.from('productos').update({ destacado: true }).eq('id', id); if (error) throw error; const producto = productos.find(p => p.id === id); if (producto) { producto.destacado = true; showToast(`"${producto.nombre}" agregado a destacados ⭐`); } renderizarPanelesDestacados(); } catch (error) { console.error('Error agregando destacado:', error); showToast('Error al agregar: ' + error.message, 'error'); } }
async function quitarDestacado(id) { try { showToast('Quitando de destacados...', 'info'); const { error } = await supabaseClient.from('productos').update({ destacado: false }).eq('id', id); if (error) throw error; const producto = productos.find(p => p.id === id); if (producto) { producto.destacado = false; showToast(`"${producto.nombre}" quitado de destacados`); } renderizarPanelesDestacados(); } catch (error) { console.error('Error quitando destacado:', error); showToast('Error al quitar: ' + error.message, 'error'); } }

// REPORTES
async function cargarReporteMargen() { const body = document.getElementById('bodyReporte'); if (!body) return; document.getElementById('contenidoReporte').style.display = 'block'; document.getElementById('tituloReporte').textContent = '📊 Margen por Categoría'; body.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>'; try { const { data, error } = await supabaseClient.from('v_margen_categoria').select('*'); if (error) throw error; if (!data || data.length === 0) { body.innerHTML = '<p class="text-center">No hay datos disponibles</p>'; return; } body.innerHTML = `<div class="table-container"><table class="data-table"><thead><tr><th>Categoría</th><th>Productos</th><th>Costo Prom.</th><th>Precio Prom.</th><th>Margen %</th></tr></thead><tbody>${data.map(r => `<tr><td><strong>${r.categoria}</strong></td><td>${r.total_productos}</td><td>$${formatearPrecio(r.costo_promedio)}</td><td>$${formatearPrecio(r.precio_venta_promedio)}</td><td><span class="badge badge-${r.margen_promedio >= 30 ? 'success' : 'warning'}">${r.margen_promedio || 0}%</span></td></tr>`).join('')}</tbody></table></div>`; } catch (error) { console.error('Error cargando reporte:', error); body.innerHTML = '<p class="text-danger">Error al cargar el reporte</p>'; } }
async function cargarReporteTop() { const body = document.getElementById('bodyReporte'); if (!body) return; document.getElementById('contenidoReporte').style.display = 'block'; document.getElementById('tituloReporte').textContent = '🏆 Top Productos por Categoría'; body.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>'; try { const { data, error } = await supabaseClient.from('v_top_productos_categoria').select('*').gt('unidades_vendidas', 0).order('unidades_vendidas', { ascending: false }).limit(20); if (error) throw error; if (!data || data.length === 0) { body.innerHTML = '<p class="text-center">No hay datos de ventas disponibles</p>'; return; } body.innerHTML = `<div class="table-container"><table class="data-table"><thead><tr><th>#</th><th>Producto</th><th>Categoría</th><th>Unidades</th><th>Total</th></tr></thead><tbody>${data.map((r, i) => `<tr><td>${i + 1}</td><td><strong>${r.nombre}</strong></td><td>${r.categoria}</td><td>${r.unidades_vendidas}</td><td>$${formatearPrecio(r.total_vendido)}</td></tr>`).join('')}</tbody></table></div>`; } catch (error) { console.error('Error cargando reporte:', error); body.innerHTML = '<p class="text-danger">Error al cargar el reporte</p>'; } }
async function cargarReporteMetodos() { const body = document.getElementById('bodyReporte'); if (!body) return; document.getElementById('contenidoReporte').style.display = 'block'; document.getElementById('tituloReporte').textContent = '💳 Ventas por Método de Pago'; body.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>'; try { const { data, error } = await supabaseClient.from('v_ventas_metodo_pago').select('*').order('fecha', { ascending: false }).limit(50); if (error) throw error; if (!data || data.length === 0) { body.innerHTML = '<p class="text-center">No hay datos disponibles</p>'; return; } body.innerHTML = `<div class="table-container"><table class="data-table"><thead><tr><th>Fecha</th><th>Método</th><th>Cantidad</th><th>Total</th></tr></thead><tbody>${data.map(r => `<tr><td>${formatearFecha(r.fecha)}</td><td><strong>${r.metodo_pago || 'Sin especificar'}</strong></td><td>${r.cantidad_ventas}</td><td>$${formatearPrecio(r.total_vendido)}</td></tr>`).join('')}</tbody></table></div>`; } catch (error) { console.error('Error cargando reporte:', error); body.innerHTML = '<p class="text-danger">Error al cargar el reporte</p>'; } }
async function cargarReporteLocales() { const body = document.getElementById('bodyReporte'); if (!body) return; document.getElementById('contenidoReporte').style.display = 'block'; document.getElementById('tituloReporte').textContent = '📈 Ventas por Local'; body.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>'; try { const { data, error } = await supabaseClient.from('v_ventas_totales_dia').select('*').order('fecha', { ascending: false }).limit(30); if (error) throw error; if (!data || data.length === 0) { body.innerHTML = '<p class="text-center">No hay datos disponibles</p>'; return; } body.innerHTML = `<div class="table-container"><table class="data-table"><thead><tr><th>Fecha</th><th>Local</th><th>Facturas</th><th>Efectivo</th><th>Transfer.</th><th>Total</th></tr></thead><tbody>${data.map(r => `<tr><td>${formatearFecha(r.fecha)}</td><td><strong>${r.local_venta || '-'}</strong></td><td>${r.cantidad_facturas}</td><td>$${formatearPrecio(r.ventas_efectivo)}</td><td>$${formatearPrecio(r.ventas_transferencia)}</td><td><strong>$${formatearPrecio(r.total_ventas)}</strong></td></tr>`).join('')}</tbody></table></div>`; } catch (error) { console.error('Error cargando reporte:', error); body.innerHTML = '<p class="text-danger">Error al cargar el reporte</p>'; } }
function exportarReporte() {
    // Exportar el reporte actual a CSV/Excel
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

    exportarTablaCSV(tabla, 'reporte_moteros');
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
        console.error('Error exportando:', error);
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

        doc.setFontSize(18);
        doc.text('Listado de Productos - Moteros Sports Line', 14, 22);
        doc.setFontSize(10);
        doc.text(`Fecha: ${new Date().toLocaleDateString('es-CO')}`, 14, 30);

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
        console.error('Error exportando PDF:', error);
        showToast('Error al exportar PDF', 'error');
    }
}

function exportarVentasExcel() {
    if (ventas.length === 0) {
        showToast('No hay ventas para exportar', 'warning');
        return;
    }

    try {
        const data = ventas.map(v => ({
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

        ws['!cols'] = [
            { wch: 10 }, { wch: 12 }, { wch: 25 }, { wch: 15 },
            { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 12 }
        ];

        XLSX.writeFile(wb, `ventas_moteros_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast(`${ventas.length} ventas exportadas a Excel`, 'success');
    } catch (error) {
        console.error('Error exportando:', error);
        showToast('Error al exportar Excel', 'error');
    }
}

function exportarVentasPDF() {
    if (ventas.length === 0) {
        showToast('No hay ventas para exportar', 'warning');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');

        doc.setFontSize(18);
        doc.text('Reporte de Ventas - Moteros Sports Line', 14, 22);
        doc.setFontSize(10);
        doc.text(`Fecha: ${new Date().toLocaleDateString('es-CO')} | Total ventas: ${ventas.length}`, 14, 30);

        const totalVentas = ventas.reduce((sum, v) => sum + (v.total || 0), 0);
        doc.text(`Total facturado: $${formatearPrecio(totalVentas)}`, 14, 36);

        const data = ventas.map(v => [
            v.id,
            v.created_at ? new Date(v.created_at).toLocaleDateString('es-CO') : '',
            v.cliente_nombre?.substring(0, 20) || '',
            v.local_venta || '',
            '$' + formatearPrecio(v.total),
            v.metodo_pago || '',
            v.estado || ''
        ]);

        doc.autoTable({
            head: [['ID', 'Fecha', 'Cliente', 'Local', 'Total', 'Pago', 'Estado']],
            body: data,
            startY: 42,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [255, 107, 0] }
        });

        doc.save(`ventas_moteros_${new Date().toISOString().split('T')[0]}.pdf`);
        showToast(`${ventas.length} ventas exportadas a PDF`, 'success');
    } catch (error) {
        console.error('Error exportando PDF:', error);
        showToast('Error al exportar PDF', 'error');
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
        console.error('Error exportando:', error);
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

        doc.setFontSize(18);
        doc.text(`Inventario ${nombreLocal} - Moteros Sports Line`, 14, 22);
        doc.setFontSize(10);
        doc.text(`Fecha: ${new Date().toLocaleDateString('es-CO')}`, 14, 30);

        const totalUnidades = inv.reduce((s, i) => s + (i.cantidad || 0), 0);
        let valorTotal = 0;
        inv.forEach(i => {
            const p = productos.find(x => x.id_producto === i.id_producto);
            valorTotal += (p?.precio || 0) * i.cantidad;
        });

        doc.text(`Total unidades: ${totalUnidades} | Valor inventario: $${formatearPrecio(valorTotal)}`, 14, 36);

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
        console.error('Error exportando PDF:', error);
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
    console.log('🏍️ Iniciando Moteros Admin Panel v4.1...');
    setupNavigation();
    setupDropzones();

    // Auto-login si hay sesión activa
    if (checkSession()) {
        console.log('🔐 Sesión activa detectada - iniciando automáticamente...');
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

    console.log('✅ Moteros Admin Panel v4.1 - Listo');
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
window.cancelarFormCompra = cancelarFormCompra;
window.guardarCompra = guardarCompra;
window.editarCompra = editarCompra;
window.eliminarCompra = eliminarCompra;
window.buscarCompras = buscarCompras;
window.mostrarModalPago = mostrarModalPago;
window.cerrarModalPago = cerrarModalPago;
window.guardarPagoCompra = guardarPagoCompra;
window.registrarPagoCompra = registrarPagoCompra;
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

// Proveedores
window.cargarProveedores = cargarProveedores;
window.buscarProveedores = buscarProveedores;
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
            .from('facturas')
            .select('created_at, total, local')
            .eq('estado', 'completada')
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
        console.error('Error cargando reporte promedio:', e);
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
let enviosData = []; // Cache de envíos para acceso rápido

async function cargarEnvios() {
    console.log('🚚 Cargando envíos...');
    const tbody = document.getElementById('tbodyEnvios');
    if (!tbody) {
        console.error('❌ No se encontró tbodyEnvios');
        return;
    }
    tbody.innerHTML = '<tr><td colspan="9" class="text-center">Cargando...</td></tr>';

    try {
        const estadoFiltro = document.getElementById('enviosEstadoFiltro')?.value || '';
        console.log('📋 Filtro estado:', estadoFiltro || 'todos');

        let query = supabaseClient
            .from('envios')
            .select('*')
            .order('fecha_venta', { ascending: false });

        if (estadoFiltro) query = query.eq('estado', estadoFiltro);

        const { data, error } = await query;

        if (error) {
            console.error('❌ Error Supabase:', error);
            throw error;
        }

        console.log('✅ Envíos cargados:', data?.length || 0);
        enviosData = data || [];

        // Actualizar stats - cargar todos para estadísticas
        const { data: todosEnvios } = await supabaseClient.from('envios').select('estado');
        const pendientes = todosEnvios?.filter(e => e.estado === 'pendiente')?.length || 0;
        const enTransito = todosEnvios?.filter(e => ['enviado', 'despachado', 'en_transito'].includes(e.estado))?.length || 0;
        const entregados = todosEnvios?.filter(e => e.estado === 'entregado')?.length || 0;
        const devueltos = todosEnvios?.filter(e => e.estado === 'devuelto')?.length || 0;

        const el1 = document.getElementById('enviosPendientes');
        const el2 = document.getElementById('enviosEnTransito');
        const el3 = document.getElementById('enviosEntregados');
        const el4 = document.getElementById('enviosDevueltos');
        if (el1) el1.textContent = pendientes;
        if (el2) el2.textContent = enTransito;
        if (el3) el3.textContent = entregados;
        if (el4) el4.textContent = devueltos;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay envíos registrados</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(e => {
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
                    <div class="btn-group-vertical">
                        <button onclick="abrirModalEditarEnvio('${e.id}')" class="btn btn-sm btn-secondary" title="Editar">✏️</button>
                        <button onclick="enviarGuia('${e.id}')" class="btn btn-sm btn-primary" title="Asignar guía" ${e.numero_guia ? 'disabled' : ''}>📦</button>
                        <button onclick="notificarClienteWhatsApp('${e.id}')" class="btn btn-sm btn-success" title="WhatsApp">📱</button>
                    </div>
                </td>
            </tr>
        `}).join('');

        console.log('✅ Tabla renderizada correctamente');
    } catch (error) {
        console.error('❌ Error cargando envíos:', error);
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">Error: ${error.message}</td></tr>`;
        showToast('Error al cargar envíos: ' + error.message, 'error');
    }
}

async function enviarGuia(id) {
    console.log('📦 Asignando guía para envío:', id);

    // Obtener datos del envío actual
    const envio = enviosData.find(e => e.id === id);

    const transportadora = prompt('Ingrese la transportadora (ej: Servientrega, Coordinadora):');
    if (!transportadora) return;

    const guia = prompt('Ingrese el número de guía:');
    if (!guia) return;

    const urlTracking = prompt('URL de tracking (opcional):', '');

    try {
        console.log('📤 Enviando actualización a Supabase...');
        const updateData = {
            transportadora: transportadora.trim(),
            numero_guia: guia.trim(),
            url_tracking: urlTracking?.trim() || null,
            estado: 'despachado',
            fecha_despacho: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        console.log('📋 Datos a actualizar:', updateData);

        const { data, error } = await supabaseClient
            .from('envios')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) {
            console.error('❌ Error Supabase:', error);
            throw error;
        }

        console.log('✅ Respuesta Supabase:', data);
        showToast('✅ Guía asignada correctamente', 'success');

        // Actualizar el cache local antes de notificar
        await cargarEnvios();

        // Preguntar si desea notificar
        if (confirm('¿Desea notificar al cliente por WhatsApp?')) {
            notificarClienteWhatsApp(id);
        }
    } catch (error) {
        console.error('❌ Error asignando guía:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

async function actualizarEstadoEnvio(id, nuevoEstado) {
    console.log('🔄 Actualizando estado:', id, '->', nuevoEstado);

    try {
        const updateData = {
            estado: nuevoEstado,
            updated_at: new Date().toISOString()
        };

        if (nuevoEstado === 'entregado') {
            updateData.fecha_entrega = new Date().toISOString();
        }

        console.log('📋 Datos a actualizar:', updateData);

        const { data, error } = await supabaseClient
            .from('envios')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) {
            console.error('❌ Error Supabase:', error);
            throw error;
        }

        console.log('✅ Estado actualizado:', data);
        showToast('Estado actualizado a: ' + nuevoEstado, 'success');
        await cargarEnvios();
    } catch (error) {
        console.error('❌ Error actualizando estado:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

function notificarClienteWhatsApp(id, guia = null, transportadora = null) {
    console.log('📱 Preparando notificación WhatsApp para:', id);

    const envio = enviosData.find(e => e.id === id);
    if (!envio) {
        console.error('❌ Envío no encontrado:', id);
        showToast('Envío no encontrado', 'error');
        return;
    }

    console.log('📋 Datos del envío:', envio);

    const telefono = envio.cliente_telefono?.replace(/\D/g, '');
    if (!telefono) {
        showToast('El cliente no tiene teléfono registrado', 'warning');
        return;
    }

    // Construir mensaje
    let mensaje = `¡Hola ${envio.cliente_nombre}! 🏍️\n\n`;
    mensaje += `Tu pedido *${envio.numero_pedido}* de Moteros Sports Line `;

    if (envio.numero_guia || guia) {
        mensaje += `ha sido despachado.\n\n`;
        mensaje += `📦 *Transportadora:* ${envio.transportadora || transportadora}\n`;
        mensaje += `🔢 *Número de guía:* ${envio.numero_guia || guia}\n`;
        if (envio.url_tracking) {
            mensaje += `🔗 *Tracking:* ${envio.url_tracking}\n`;
        }
    } else {
        mensaje += `está siendo preparado.\n`;
    }

    mensaje += `\n📍 *Dirección de envío:*\n${envio.direccion_envio}\n${envio.ciudad}, ${envio.departamento}\n`;
    mensaje += `\n¡Gracias por tu compra! 🧡`;

    const url = `https://wa.me/57${telefono}?text=${encodeURIComponent(mensaje)}`;
    console.log('🔗 URL WhatsApp:', url);

    window.open(url, '_blank');
    showToast('Abriendo WhatsApp...', 'info');
}

async function abrirModalEditarEnvio(id) {
    console.log('✏️ Abriendo modal para editar envío:', id);

    const envio = enviosData.find(e => e.id === id);
    if (!envio) {
        console.error('❌ Envío no encontrado');
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
    console.log('💾 Guardando envío:', id);

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

        console.log('📋 Datos a guardar:', updateData);

        const { data, error } = await supabaseClient
            .from('envios')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) {
            console.error('❌ Error Supabase:', error);
            throw error;
        }

        console.log('✅ Envío guardado:', data);
        showToast('Envío actualizado correctamente', 'success');
        cerrarModalEnvio();

        if (notificar) {
            notificarClienteWhatsApp(id);
        }

        await cargarEnvios();
    } catch (error) {
        console.error('❌ Error guardando envío:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

async function cargarEstadisticasEnvios() {
    try {
        const { data, error } = await supabaseClient.from('envios').select('*');
        if (error) throw error;

        const envios = data || [];
        const mesActual = new Date().getMonth();
        const enviosMes = envios.filter(e => new Date(e.fecha_venta).getMonth() === mesActual);

        const totalEnvios = enviosMes.length;
        const entregados = enviosMes.filter(e => e.estado === 'entregado').length;
        const cobradoEnvios = enviosMes.filter(e => e.cliente_paga_envio).reduce((sum, e) => sum + parseFloat(e.costo_envio || 0), 0);
        const asumidoEnvios = enviosMes.filter(e => !e.cliente_paga_envio && !e.envio_incluido).reduce((sum, e) => sum + parseFloat(e.costo_envio || 0), 0);

        const el1 = document.getElementById('statEnviosTotales');
        const el2 = document.getElementById('statCobradoEnvios');
        const el3 = document.getElementById('statAsumidoEnvios');
        const el4 = document.getElementById('statBalanceEnvios');

        if (el1) el1.textContent = totalEnvios;
        if (el2) el2.textContent = '$' + formatearPrecio(cobradoEnvios);
        if (el3) el3.textContent = '$' + formatearPrecio(asumidoEnvios);
        if (el4) el4.textContent = '$' + formatearPrecio(cobradoEnvios - asumidoEnvios);

        // ════════════════════════════════════════════
        // GRÁFICOS
        // ════════════════════════════════════════════

        // 1. Envíos por Mes (Últimos 6 meses)
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const ultimos6Meses = [];
        const datosMeses = [];
        const hoy = new Date();

        for (let i = 5; i >= 0; i--) {
            const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
            ultimos6Meses.push(meses[d.getMonth()]);
            const count = envios.filter(e => {
                const fecha = new Date(e.fecha_venta);
                return fecha.getMonth() === d.getMonth() && fecha.getFullYear() === d.getFullYear();
            }).length;
            datosMeses.push(count);
        }

        const ctxMes = document.getElementById('chartEnviosMes');
        if (ctxMes) {
            // Destruir gráfico anterior si existe
            const chartStatus = Chart.getChart("chartEnviosMes");
            if (chartStatus != undefined) { chartStatus.destroy(); }

            new Chart(ctxMes, {
                type: 'bar',
                data: {
                    labels: ultimos6Meses,
                    datasets: [{
                        label: 'Envíos',
                        data: datosMeses,
                        backgroundColor: '#3b82f6',
                        borderRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });
        }

        // 2. Por Transportadora
        const transportadorasMap = {};
        envios.forEach(e => {
            const t = e.transportadora || 'Sin asignar';
            transportadorasMap[t] = (transportadorasMap[t] || 0) + 1;
        });

        const labelsTrans = Object.keys(transportadorasMap);
        const dataTrans = Object.values(transportadorasMap);

        const ctxTrans = document.getElementById('chartTransportadoras');
        if (ctxTrans) {
            const chartStatus = Chart.getChart("chartTransportadoras");
            if (chartStatus != undefined) { chartStatus.destroy(); }

            new Chart(ctxTrans, {
                type: 'doughnut',
                data: {
                    labels: labelsTrans,
                    datasets: [{
                        data: dataTrans,
                        backgroundColor: ['#f97316', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#cbd5e1']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'right' } }
                }
            });
        }

    } catch (error) {
        console.error('Error cargando estadísticas de envíos:', error);
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
    showToast('Exportando envíos...', 'info');
    // Implementar exportación CSV
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
            console.warn('Empleados: No se pudo cargar la tabla empleados_tienda');
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
        tiendas_permitidas: tiendas
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
        console.error('Error guardando empleado:', e);
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
        console.error('Error eliminando empleado:', e);
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
        console.warn('Error cargando métodos de pago:', e);
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
            console.warn('No se pudo guardar en Supabase:', e);
        }

        alert('✅ Métodos de pago guardados correctamente');
    } catch (e) {
        console.error('Error guardando métodos de pago:', e);
        alert('Error al guardar: ' + (e.message || 'desconocido'));
    }
}

window.guardarMetodosPago = guardarMetodosPago;

// ═══════════════════════════════════════════════════════════════
// CONTENIDO DEL SITIO - Cargar y Guardar
// ═══════════════════════════════════════════════════════════════

const tiposContenido = [
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
                const tituloInput = document.getElementById(`contenido_${item.tipo}_titulo`);
                const contenidoInput = document.getElementById(`contenido_${item.tipo}`);

                if (tituloInput) tituloInput.value = item.titulo || '';
                if (contenidoInput) contenidoInput.value = item.contenido || '';
            });
            console.log('✅ Contenido del sitio cargado');
        }
    } catch (error) {
        console.error('Error cargando contenido:', error);
        showToast('Error al cargar contenido: ' + error.message, 'error');
    }
}

async function guardarContenidoSitio() {
    try {
        const updates = [];

        for (const tipo of tiposContenido) {
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

        for (const update of updates) {
            const { error } = await supabaseClient
                .from('contenido_sitio')
                .upsert(update, { onConflict: 'tipo' });

            if (error) throw error;
        }

        showToast('✅ Contenido guardado correctamente', 'success');
        console.log('✅ Contenido del sitio guardado');
    } catch (error) {
        console.error('Error guardando contenido:', error);
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
        console.error('Error cargando promociones:', e);
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
        console.error('Error guardando promocion:', e);
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
        console.error('Error eliminando promocion:', e);
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
                    <button class="btn-icon blue" onclick="editarCategoria(${cat.id}, '${cat.nombre}', '${cat.icono || ''}')" title="Editar">✏️</button>
                    <button class="btn-icon red" onclick="eliminarCategoria(${cat.id}, '${cat.nombre}')" title="Eliminar">🗑️</button>
                </td>
            </tr>
        `).join('');

        actualizarSelectsCategorias(data);

    } catch (error) {
        console.error('Error cargando categorías:', error);
        showToast('Error al cargar categorías', 'error');
    }
}

function mostrarFormCategoria() {
    document.getElementById('formCategoria').style.display = 'block';
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
    document.getElementById('formCategoria').style.display = 'block';
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
        console.error('Error guardando categoría:', error);
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
        console.error('Error eliminando categoría:', error);
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
// LEADS IA
// ═══════════════════════════════════════════════════════════════

let todosLeadsIA = [];

async function cargarLeadsIA() {
    const tbody = document.getElementById('tbodyLeadsIA');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center">🔍 Consultando base de datos...</td></tr>';

    try {
        if (typeof supabaseClient === 'undefined') {
            throw new Error('Supabase no está inicializado');
        }

        const { data, error } = await supabaseClient
            .from('leads_ia')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        todosLeadsIA = data || [];
        renderizarTablaLeads(todosLeadsIA);

    } catch (error) {
        console.error('Error cargando leads:', error);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--danger);">⚠️ Error: ${error.message || 'No se pudo conectar con la base de datos'}</td></tr>`;
        showToast('Error al cargar leads', 'error');
    }
}

function renderizarTablaLeads(data) {
    const tbody = document.getElementById('tbodyLeadsIA');
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay leads capturados aún.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(lead => {
        const interesClass = `badge-interes-${(lead.nivel_interes || 'Media').toLowerCase()}`;
        return `
            <tr>
                <td>${new Date(lead.created_at).toLocaleString('es-CO')}</td>
                <td style="font-weight:600;">${lead.nombre}</td>
                <td style="font-family: monospace;">${lead.whatsapp}</td>
                <td><span class="badge-interes ${interesClass}">${lead.nivel_interes || 'Media'}</span></td>
                <td style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${lead.fragmento_interes || ''}">
                    ${lead.fragmento_interes || 'Interés general'}
                </td>
                <td>
                    <span class="badge-estado ${lead.estado === 'Contactado' ? 'contactado' : 'nuevo'}">
                        ${lead.estado || 'Nuevo'}
                    </span>
                </td>
                <td style="text-align:right;">
                    <button class="btn-icon green" onclick="contactarLeadWA('${lead.whatsapp}')" title="Contactar WhatsApp">💬</button>
                    <button class="btn-icon blue" onclick="verDetalleLead('${lead.id}')" title="Ver Detalles">👁️</button>
                    <button class="btn-icon red" onclick="eliminarLead('${lead.id}', '${lead.nombre}')" title="Eliminar">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

function filtrarLeadsAdmin() {
    const busqueda = document.getElementById('buscarLeadAdmin').value.toLowerCase();
    const filtrados = todosLeadsIA.filter(l =>
        l.nombre.toLowerCase().includes(busqueda) ||
        l.whatsapp.includes(busqueda) ||
        (l.fragmento_interes && l.fragmento_interes.toLowerCase().includes(busqueda))
    );
    renderizarTablaLeads(filtrados);
}

async function eliminarLead(id, nombre) {
    if (!confirm(`¿Estás seguro de eliminar el lead de "${nombre}"?`)) return;

    try {
        const { error } = await supabaseClient.from('leads_ia').delete().eq('id', id);
        if (error) throw error;

        showToast('Lead eliminado con éxito');
        cargarLeadsIA();
    } catch (error) {
        console.error('Error eliminando lead:', error);
        showToast('Error al eliminar el lead', 'error');
    }
}

async function contactarLeadWA(whatsapp) {
    const lead = todosLeadsIA.find(l => l.whatsapp === whatsapp);
    const nombre = lead ? lead.nombre : 'Cliente';
    const interes = lead ? lead.fragmento_interes : 'nuestros productos';

    // Generar mensaje personalizado
    let saludo = `¡Hola ${nombre}! 👋`;
    if (nombre === 'Cliente Web' || !nombre) saludo = "¡Hola! 👋";

    const texto = `${saludo} Soy un asesor de Moteros Sports Line. Vi que estuviste consultando con nuestro asistente virtual sobre *${interes}*. Me gustaría ayudarte personalmente con más información, fotos o lo que necesites. ¿En qué puedo servirte hoy?`;

    const cleanNumber = whatsapp.replace(/\D/g, '');
    const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(texto)}`;

    // Abrir WhatsApp
    window.open(url, '_blank');

    // Actualizar estado a 'Contactado' en Supabase si era 'Nuevo'
    if (lead && lead.estado !== 'Contactado') {
        try {
            const { error } = await supabaseClient
                .from('leads_ia')
                .update({ estado: 'Contactado' })
                .eq('id', lead.id);

            if (!error) {
                console.log(`✅ Lead ${lead.id} marcado como contactado.`);
                lead.estado = 'Contactado';
                renderizarTablaLeads(todosLeadsIA);
            }
        } catch (e) {
            console.error('Error actualizando estado del lead:', e);
        }
    }
}

function verDetalleLead(id) {
    const lead = todosLeadsIA.find(l => l.id === id);
    if (!lead) return;

    // Crear y mostrar modal de detalle premium
    const modalHtml = `
        <div id="modalLeadDetalle" class="modal-overlay">
            <div class="modal-content" style="max-width:800px;">
                <div class="modal-header">
                    <h3>👤 Detalle del Lead: ${lead.nombre}</h3>
                    <button onclick="cerrarModalLead()" class="btn-cerrar">×</button>
                </div>
                <div class="modal-body">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-bottom:1.5rem;">
                        <div class="info-group">
                            <label style="font-weight:700; color:var(--gray-500); font-size:0.75rem; text-transform:uppercase;">WhatsApp</label>
                            <p style="font-size:1.1rem; font-weight:600;">${lead.whatsapp}</p>
                        </div>
                        <div class="info-group">
                            <label style="font-weight:700; color:var(--gray-500); font-size:0.75rem; text-transform:uppercase;">Nivel de Interés</label>
                            <p><span class="badge-interes badge-interes-${(lead.nivel_interes || 'Media').toLowerCase()}">${lead.nivel_interes || 'Media'}</span></p>
                        </div>
                        <div class="info-group" style="grid-column: span 2;">
                            <label style="font-weight:700; color:var(--gray-500); font-size:0.75rem; text-transform:uppercase;">Necesidad Detectada</label>
                            <p style="background:var(--gray-50); padding:1rem; border-radius:0.5rem; border-left:4px solid var(--primary); font-style:italic;">
                                "${lead.fragmento_interes || 'N/A'}"
                            </p>
                        </div>
                    </div>

                    <label style="font-weight:700; color:var(--gray-500); font-size:0.75rem; text-transform:uppercase; display:block; margin-bottom:1rem;">Historial de Chat (IA)</label>
                    <div id="chatVisor" style="background:#f1f5f9; padding:1.5rem; border-radius:1rem; max-height:400px; overflow-y:auto; display:flex; flex-direction:column; gap:1rem;">
                        ${renderizarHistorialChat(lead.historial_asociado)}
                    </div>
                </div>
                <div class="modal-footer" style="padding-top:1.5rem; border-top:1px solid var(--gray-100); display:flex; gap:1rem; justify-content:flex-end;">
                    <button class="btn btn-success" onclick="contactarLeadWA('${lead.whatsapp}')">💬 Hablar por WhatsApp</button>
                    <button class="btn btn-secondary" onclick="cerrarModalLead()">Cerrar</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function renderizarHistorialChat(historial) {
    if (!historial || !Array.isArray(historial)) return '<p class="text-center" style="color:var(--gray-400);">No hay historial de chat disponible.</p>';

    return historial.map(msg => {
        const isUser = msg.role === 'user';
        return `
            <div style="align-self: ${isUser ? 'flex-end' : 'flex-start'}; max-width: 80%; background: ${isUser ? 'var(--primary)' : 'white'}; color: ${isUser ? 'white' : 'var(--gray-800)'}; padding: 0.75rem 1rem; border-radius: 1rem; ${isUser ? 'border-bottom-right-radius: 0.25rem;' : 'border-bottom-left-radius: 0.25rem;'}; box-shadow: 0 2px 5px rgba(0,0,0,0.05); font-size: 0.9rem;">
                ${msg.content.replace(/\n/g, '<br>')}
            </div>
        `;
    }).join('');
}

function cerrarModalLead() {
    const modal = document.getElementById('modalLeadDetalle');
    if (modal) modal.remove();
}

window.cargarLeadsIA = cargarLeadsIA;
window.renderizarTablaLeads = renderizarTablaLeads;
window.filtrarLeadsAdmin = filtrarLeadsAdmin;
window.eliminarLead = eliminarLead;
window.contactarLeadWA = contactarLeadWA;
window.verDetalleLead = verDetalleLead;
window.cerrarModalLead = cerrarModalLead;

window.actualizarSelectsCategorias = actualizarSelectsCategorias;
