/* ---------------------------------------------------------------
   POS MOTEROS SPORTS LINE - JAVASCRIPT UNIFICADO v2.0
   Compatible con tiendas físicas (Alcalá, 01, Jordán) y Digital
   ---------------------------------------------------------------*/

// ---------------------------------------------------------------
// CONFIGURACIÓN DE SUPABASE (se carga desde config.js)
// ---------------------------------------------------------------
const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

// Alias para compatibilidad con código existente
const supabaseClient = db;

// ---------------------------------------------------------------
// CONFIGURACIÓN POR TIENDA (se define en cada HTML)
// TIENDA = { 
//   nombre: 'Alcalá' | '01' | 'Jordán' | 'Digital', 
//   tablaInventario: 'inventario_alcala' | 'inventario_01' | etc,
//   storageKey: 'pos_caja_alcala' | etc,
//   esDigital: false | true
// }
// ---------------------------------------------------------------

const LOGO_URL = 'https://pbblthbrdkevuyjxyuar.supabase.co/storage/v1/object/public/productos-imagenes/moteros%20logo.jpg';

// Métodos de crédito (requieren datos adicionales)
const METODOS_CREDITO = ['Credito Motero', 'Addi', 'Sistecredito', 'Fodegas', 'Contraentrega'];

// ---------------------------------------------------------------
// ESTADO GLOBAL
// ---------------------------------------------------------------
let productos = [];
let carrito = [];
let cajaAbierta = false;
let metodosSeleccionados = new Set();
let itemEditandoIdx = null;
let datosCaja = null;
let resumenVentas = null;
let gastosDelDia = [];
let empleadoLogueado = null; // Datos del empleado con sesión activa
let productoParaVariante = null; // Variable para manejo de variantes
let clienteSeleccionado = null; // { id, nombre, telefono, cedula, promocion }
let tipoClienteActual = 'consumidor'; // 'consumidor' | 'registrado'

// ---------------------------------------------------------------
// INICIALIZACIÓN
// ---------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    const tipoTienda = TIENDA.esDigital ? 'Digital' : `${TIENDA.nombre}`;


    // Cargar logos
    document.querySelectorAll('.logo-img').forEach(img => img.src = LOGO_URL);
    document.querySelectorAll('.tienda-nombre-display').forEach(el => el.textContent = TIENDA.nombre);

    // Verificar estado de caja
    verificarCaja();

    // Cargar productos
    await cargarProductos();

    // Cargar vendedores
    await cargarVendedores();

    // Sincronización automática de ventas offline
    if (window.OfflineManager) {
        window.OfflineManager.sincronizarPendientes(db);
        setInterval(() => window.OfflineManager.sincronizarPendientes(db), 60000); // Cada minuto
    }

    // AUTO-LOGIN para Admin (Solicitud Usuario)
    if (TIENDA.nombre === 'Admin') {

        empleadoLogueado = {
            id: 999,
            nombre: 'Administrador',
            cargo: 'Gerencia',
            tiendas_permitidas: ['Todas'],
            activo: true
        };
        // Abrir directamente la caja sin pedir login
        setTimeout(() => abrirModalCajaConEmpleado(), 500);
    }


});

// ---------------------------------------------------------------
// SISTEMA DE CAJA
// ---------------------------------------------------------------
function actualizarUICaja() {
    const btnAbrir = document.getElementById('btnAbrirCaja');
    const btnCerrar = document.getElementById('btnCerrarCaja');
    const lockedScreen = document.getElementById('lockedScreen');
    const badge = document.getElementById('cajaBadge');

    if (cajaAbierta) {
        if (btnAbrir) btnAbrir.classList.add('hidden');
        if (btnCerrar) btnCerrar.classList.remove('hidden');
        if (lockedScreen) lockedScreen.classList.add('hidden');
        if (badge) {
            badge.textContent = 'Abierta';
            badge.className = 'badge badge-abierta';
        }
    } else {
        if (btnAbrir) btnAbrir.classList.remove('hidden');
        if (btnCerrar) btnCerrar.classList.add('hidden');
        if (lockedScreen) lockedScreen.classList.remove('hidden');
        if (badge) {
            badge.textContent = 'Cerrada';
            badge.className = 'badge badge-cerrada';
        }
    }
}

function verificarCaja() {
    const datos = localStorage.getItem(TIENDA.storageKey);
    if (datos) {
        datosCaja = JSON.parse(datos);
        const hoy = new Date().toISOString().split('T')[0];
        if (datosCaja.fecha === hoy && datosCaja.estado === 'abierta') {
            cajaAbierta = true;
            // Recuperar id_evento si existe
            if (datosCaja.id_evento) {
                TIENDA.id_evento = datosCaja.id_evento;

            }
        } else {
            localStorage.removeItem(TIENDA.storageKey);
            datosCaja = null;
        }
    }
    actualizarUICaja();
}

// ---------------------------------------------------------------
// SISTEMA DE LOGIN DE EMPLEADOS
// ---------------------------------------------------------------

function mostrarLoginEmpleado() {
    document.getElementById('loginUsuario').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('modalLoginEmpleado').classList.add('visible');
}

async function verificarLogin() {
    const usuario = document.getElementById('loginUsuario').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    if (!usuario || !password) {
        errorDiv.textContent = 'Por favor ingresa usuario y contraseña';
        errorDiv.style.display = 'block';
        return;
    }

    // MODO OFFLINE: Si no hay internet, verificar en la DB local
    if (!navigator.onLine && window.OfflineManager) {
        console.warn('Offline: Intentando login local...');
        const empLocal = await offlineDB.empleados
            .where('usuario').equals(usuario)
            .or('cedula').equals(usuario)
            .first();

        if (empLocal && empLocal.password === password) {
            empleadoLogueado = empLocal;
            document.getElementById('modalLoginEmpleado').classList.remove('visible');
            abrirModalCajaConEmpleado();
            mostrarAlerta('Sesión iniciada (Modo Offline)', 'info');
            return;
        } else if (empLocal) {
            errorDiv.textContent = 'Contraseña incorrecta (Offline)';
            errorDiv.style.display = 'block';
            return;
        } else {
            errorDiv.textContent = 'Usuario no encontrado localmente';
            errorDiv.style.display = 'block';
            return;
        }
    }





    try {
        // Buscar empleado por usuario o cédula
        const { data: empleado, error } = await db
            .from('empleados_tienda')
            .select('*')
            .or(`usuario.eq.${usuario},cedula.eq.${usuario}`)
            .eq('activo', true)
            .single();

        if (error || !empleado) {
            errorDiv.textContent = 'Usuario no encontrado o inactivo';
            errorDiv.style.display = 'block';
            return;
        }

        // Verificar contraseña (simple hash comparison - en producción usar bcrypt)
        if (empleado.password !== password) {
            errorDiv.textContent = 'Contraseña incorrecta';
            errorDiv.style.display = 'block';

            // Registrar intento fallido
            await db.from('sesiones_empleados').insert({
                empleado_id: empleado.id,
                local: TIENDA.nombre,
                tipo: 'login_fallido',
                fecha: new Date().toISOString()
            });
            return;
        }

        // Verificar si tiene permiso para esta tienda
        const tiendasPermitidas = empleado.tiendas_permitidas || [];
        if (tiendasPermitidas.length > 0 && !tiendasPermitidas.includes(TIENDA.nombre) && !tiendasPermitidas.includes('Todas')) {
            errorDiv.textContent = `No tienes permiso para acceder a ${TIENDA.nombre}`;
            errorDiv.style.display = 'block';
            return;
        }

        // Login exitoso
        empleadoLogueado = empleado;

        // Guardar sesión en localStorage
        localStorage.setItem('empleado_logueado_' + TIENDA.storageKey, JSON.stringify({
            id: empleado.id,
            nombre: empleado.nombre,
            cargo: empleado.cargo,
            fecha: new Date().toISOString()
        }));

        // Registrar sesión en Supabase
        await db.from('sesiones_empleados').insert({
            empleado_id: empleado.id,
            local: TIENDA.nombre,
            tipo: 'login',
            fecha: new Date().toISOString()
        });

        // Cerrar modal login y abrir modal caja
        document.getElementById('modalLoginEmpleado').classList.remove('visible');
        abrirModalCajaConEmpleado();

    } catch (e) {
        console.error('Error en login:', e);
        // Si la tabla no existe, permitir login sin verificación (modo legacy)
        if (e.message && e.message.includes('does not exist')) {
            console.warn('Tabla empleados_tienda no existe, usando modo legacy');
            abrirModalCajaLegacy();
        } else {
            errorDiv.textContent = 'Error de conexión. Intenta de nuevo.';
            errorDiv.style.display = 'block';
        }
    }
}

async function abrirModalCajaConEmpleado() {
    if (!empleadoLogueado) {
        mostrarLoginEmpleado();
        return;
    }

    // Mostrar datos del empleado
    document.getElementById('nombreEmpleadoLogueado').textContent = empleadoLogueado.nombre;
    document.getElementById('cargoEmpleadoLogueado').textContent = empleadoLogueado.cargo || 'Vendedor';
    document.getElementById('vendedorNombre').value = empleadoLogueado.nombre;

    // Configurar base de caja
    document.getElementById('montoInicial').value = TIENDA.esDigital ? '0' : '100000';

    // Si estamos en la página de eventos, cargar eventos activos
    const selectEvento = document.getElementById('selectEventoActivo');
    if (selectEvento) {
        try {
            const { data: eventos, error } = await db
                .from('eventos_tienda')
                .select('id, nombre_evento')
                .eq('estado', 'Activo');

            if (eventos) {
                selectEvento.innerHTML = '<option value="">-- Seleccionar Evento --</option>' +
                    eventos.map(ev => `<option value="${ev.id}">${ev.nombre_evento}</option>`).join('');
            }
        } catch (err) {
            console.error('Error cargando eventos:', err);
        }
    }

    document.getElementById('modalAbrirCaja').classList.add('visible');
}

function abrirModalCajaLegacy() {
    // Modo legacy - sin verificación de empleados (para compatibilidad)
    const nombre = prompt('✅​ Ingresa tu nombre completo:');
    if (!nombre || !nombre.trim()) {
        mostrarAlerta('Debes ingresar tu nombre', 'warning');
        return;
    }

    empleadoLogueado = { id: 0, nombre: nombre.trim(), cargo: 'Vendedor' };
    document.getElementById('nombreEmpleadoLogueado').textContent = nombre.trim();
    document.getElementById('cargoEmpleadoLogueado').textContent = 'Vendedor';
    document.getElementById('vendedorNombre').value = nombre.trim();
    document.getElementById('montoInicial').value = TIENDA.esDigital ? '0' : '100000';

    document.getElementById('modalAbrirCaja').classList.add('visible');
}

async function cerrarSesionEmpleado() {
    if (empleadoLogueado && empleadoLogueado.id) {
        try {
            await db.from('sesiones_empleados').insert({
                empleado_id: empleadoLogueado.id,
                local: TIENDA.nombre,
                tipo: 'logout',
                fecha: new Date().toISOString()
            });
        } catch (e) {
            console.warn('No se pudo registrar logout:', e);
        }
    }

    empleadoLogueado = null;
    localStorage.removeItem('empleado_logueado_' + TIENDA.storageKey);
    cerrarModal();
    mostrarAlerta('Sesión cerrada correctamente', 'info');
}

function verificarSesionExistente() {
    const sesionGuardada = localStorage.getItem('empleado_logueado_' + TIENDA.storageKey);
    if (sesionGuardada) {
        try {
            const datos = JSON.parse(sesionGuardada);
            const hoy = new Date().toISOString().split('T')[0];
            const fechaSesion = datos.fecha.split('T')[0];

            // Si la sesión es de hoy, restaurarla
            if (fechaSesion === hoy) {
                empleadoLogueado = datos;
                return true;
            } else {
                localStorage.removeItem('empleado_logueado_' + TIENDA.storageKey);
            }
        } catch (e) {
            localStorage.removeItem('empleado_logueado_' + TIENDA.storageKey);
        }
    }
    return false;
}

function abrirModalCaja() {
    if (cajaAbierta) {
        mostrarAlerta('La caja ya está abierta', 'warning');
        return;
    }

    // Verificar si hay sesión existente
    if (verificarSesionExistente()) {
        abrirModalCajaConEmpleado();
    } else {
        // Mostrar login de empleado
        mostrarLoginEmpleado();
    }
}

async function confirmarAbrirCaja() {
    const monto = parseFloat(document.getElementById('montoInicial').value) || 0;
    const vendedor = document.getElementById('vendedorNombre').value.trim();
    const selectEvento = document.getElementById('selectEventoActivo');
    const idEvento = selectEvento ? selectEvento.value : null;

    if (!vendedor) {
        mostrarAlerta('Ingresa el nombre del vendedor', 'warning');
        return;
    }

    // Si es POS de eventos, obligar a seleccionar evento
    if (selectEvento && !idEvento) {
        mostrarAlerta('Debes seleccionar un evento para abrir la caja', 'warning');
        return;
    }

    const prefijo = TIENDA.esDigital ? 'DIG' : TIENDA.nombre.substring(0, 3).toUpperCase();
    const numeroCierre = `C-${prefijo}-${Date.now()}`;

    try {
        const fechaHoy = new Date().toISOString().split('T')[0];

        // 1. Verificar si ya existe una caja abierta para este local hoy
        const { data: existente } = await db.from('cierres_caja')
            .select('*')
            .eq('local', TIENDA.nombre)
            .eq('fecha', fechaHoy)
            .eq('estado', 'abierto')
            .maybeSingle();

        if (existente) {

            datosCaja = {
                fecha: existente.fecha,
                horaApertura: existente.fecha_apertura,
                montoInicial: existente.base_caja,
                vendedor: existente.vendedor,
                numeroCierre: existente.numero_cierre,
                estado: 'abierta',
                id_evento: existente.id_evento
            };
            if (datosCaja.id_evento) TIENDA.id_evento = datosCaja.id_evento;
        } else {
            // 2. Si no existe, crear nueva
            const cierreData = {
                numero_cierre: numeroCierre,
                local: TIENDA.nombre,
                fecha: fechaHoy,
                fecha_apertura: new Date().toISOString(),
                vendedor: vendedor,
                base_caja: monto,
                estado: 'abierto'
            };

            // Solo agregar id_evento si existe
            if (idEvento) { cierreData.id_evento = idEvento; }

            const { error } = await db.from('cierres_caja').insert(cierreData);

            if (error) {
                // Si es error de duplicado (409), intentar recuperar la existente nuevamente por seguridad
                if (error.code === '23505' || error.message.includes('duplicate key')) {
                    console.warn('Conflicto de caja duplicada, intentando recuperar...');
                    // Lógica de recuperación simple o fallback local
                    // En este caso, si falla insert, dejamos que el catch lo maneje o asumimos local.
                    throw error;
                }
                console.warn('No se pudo guardar cierre en DB, procediendo localmente:', error.message);
                mostrarAlerta('Aviso: Caja abierta en modo local (sin registro en nube)', 'info');
            }

            datosCaja = {
                fecha: fechaHoy,
                horaApertura: new Date().toISOString(),
                montoInicial: monto,
                vendedor: vendedor,
                numeroCierre: numeroCierre,
                estado: 'abierta',
                id_evento: idEvento
            };
        }

        if (idEvento) TIENDA.id_evento = idEvento;

        localStorage.setItem(TIENDA.storageKey, JSON.stringify(datosCaja));
        cajaAbierta = true;

        cerrarModal();
        actualizarUICaja();
        mostrarAlerta(`Caja abierta - Base: $${monto.toLocaleString('es-CO')}`, 'success');

    } catch (e) {
        console.error('Error abriendo caja:', e);
        mostrarAlerta('Error al abrir caja: ' + (e.message || 'desconocido'), 'error');
    }
}



// ---------------------------------------------------------------
// CIERRE DE CAJA - MOSTRAR MODAL
// ---------------------------------------------------------------
async function mostrarModalCerrarCaja() {
    const hoy = new Date().toISOString().split('T')[0];

    try {
        const { data: ventas } = await db.from('ventas')
            .select('*')
            .eq('local', TIENDA.nombre)
            .gte('created_at', hoy + 'T00:00:00');

        // Consultar abonos a proveedores del día por LOCAL
        const { data: abonosProv } = await db.from('pagos_proveedor')
            .select('monto, metodo_pago, proveedores(razon_social)')
            .eq('local', TIENDA.nombre)
            .gte('created_at', hoy + 'T00:00:00');

        // Consultar adelantos de nómina del día por LOCAL
        const { data: adelantosNom } = await db.from('adelantos_nomina')
            .select('monto, registrado_por')
            .eq('local', TIENDA.nombre)
            .gte('created_at', hoy + 'T00:00:00');

        // Consultar abonos a CRÉDITOS del día por LOCAL
        const { data: abonosCred } = await db.from('pagos_credito')
            .select('monto_pagado, local, metodo_pago') // Añadido metodo_pago que faltaba
            .eq('local', TIENDA.nombre)
            .gte('fecha_pago', hoy + 'T00:00:00');

        // Consultar abonos de SERVICIOS del día por LOCAL
        const { data: abonosServ } = await db.from('pagos_servicios')
            .select('monto, metodo_pago')
            .eq('local', TIENDA.nombre)
            .gte('created_at', hoy + 'T00:00:00');

        // Consultar abonos de DEUDORES del día (Si la tabla existe)
        const { data: abonosDeudores } = await db.from('pagos_deudor')
            .select('monto, metodo_pago')
            .gte('fecha_pago', hoy);

        const abonosDelDia = abonosProv || [];
        const adelantosDelDia = adelantosNom || [];
        const abonosCreditosDelDia = abonosCred || [];
        const abonosServiciosDelDia = abonosServ || [];
        const abonosDeudoresDelDia = abonosDeudores || [];

        const totalAbonosProv = abonosDelDia.reduce((sum, a) => sum + (a.monto || 0), 0);
        const totalAdelantos = adelantosDelDia.reduce((sum, a) => sum + (a.monto || 0), 0);
        const totalAbonosCreditos = abonosCreditosDelDia.reduce((sum, a) => sum + (a.monto_pagado || 0), 0);
        const totalAbonosServicios = abonosServiciosDelDia.reduce((sum, a) => sum + (a.monto || 0), 0);
        const totalAbonosDeudores = abonosDeudoresDelDia.reduce((sum, a) => sum + (a.monto || 0), 0);

        // Estructura de totales según tipo de tienda
        const totales = TIENDA.esDigital ? {
            transferencia: 0, nequi: 0, daviplata: 0, tarjeta: 0,
            contraentrega: 0, addi: 0, sistecredito: 0, fodegas: 0
        } : {
            efectivo: 0, transferencia: 0, tarjeta: 0, daviplata: 0,
            nequi: 0, addi: 0, datafono: 0, sistecredito: 0,
            credito_motero: 0, fodegas: 0
        };

        let totalGeneralVentas = 0;
        let totalUnidades = 0;

        (ventas || []).forEach(v => {
            const monto = v.total || 0;
            totalGeneralVentas += monto;
            totalUnidades += v.cantidad || 0;

            const metodos = (v.metodo_pago || '').toLowerCase();
            const numMetodos = (metodos.match(/\+/g) || []).length + 1;
            const montoPorMetodo = monto / numMetodos;

            if (metodos.includes('efectivo') && !TIENDA.esDigital) totales.efectivo += montoPorMetodo;
            if (metodos.includes('transferencia')) totales.transferencia += montoPorMetodo;
            if (metodos.includes('tarjeta')) totales.tarjeta += montoPorMetodo;
            if (metodos.includes('daviplata')) totales.daviplata += montoPorMetodo;
            if (metodos.includes('nequi')) totales.nequi += montoPorMetodo;
            if (metodos.includes('addi')) totales.addi += montoPorMetodo;
            if (metodos.includes('datafono') || metodos.includes('datáfono')) totales.datafono = (totales.datafono || 0) + montoPorMetodo;
            if (metodos.includes('sistecredito') || metodos.includes('sistecrdito')) totales.sistecredito += montoPorMetodo;
            if (metodos.includes('credito motero') || metodos.includes('crdito motero')) totales.credito_motero = (totales.credito_motero || 0) + montoPorMetodo;
            if (metodos.includes('fodegas')) totales.fodegas += montoPorMetodo;
            if (metodos.includes('contraentrega')) totales.contraentrega = (totales.contraentrega || 0) + montoPorMetodo;
        });

        const base = datosCaja?.montoInicial || 0;
        const totalGastos = gastosDelDia.reduce((sum, g) => sum + (g.monto || 0), 0);

        // Abonos y Servicios en Efectivo (suman a caja)
        const abonosEfectivoCaja = abonosCreditosDelDia.filter(a => (a.metodo_pago || 'Efectivo') === 'Efectivo').reduce((sum, a) => sum + (a.monto_pagado || 0), 0) +
            abonosServiciosDelDia.filter(a => (a.metodo_pago || 'Efectivo') === 'Efectivo').reduce((sum, a) => sum + (a.monto || 0), 0) +
            abonosDeudoresDelDia.filter(a => (a.metodo_pago || 'Efectivo') === 'Efectivo').reduce((sum, a) => sum + (a.monto || 0), 0);

        // Egresos en Efectivo (restan a caja)
        const egresosEfectivoCaja = totalGastos +
            totalAdelantos +
            abonosDelDia.filter(a => a.metodo_pago === 'Efectivo').reduce((sum, a) => sum + (a.monto || 0), 0);

        const efectivoEsperado = base + (totales.efectivo || 0) + abonosEfectivoCaja - egresosEfectivoCaja;

        resumenVentas = {
            totales,
            totalGeneralVentas,
            totalUnidades,
            numTransacciones: ventas?.length || 0,
            base,
            totalAdelantos,
            totalAbonosProv,
            totalAbonosCreditos,
            totalAbonosServicios,
            totalAbonosDeudores,
            efectivoEsperado,
            totalGeneralCierre: totalGeneralVentas + totalAbonosCreditos + totalAbonosServicios + totalAbonosDeudores,
            ventasDelDia: ventas || []
        };

        // Renderizar resumen ultra-detallado
        const resumenHTML = `
            <div class="resumen-cierre-premium">
                <div class="resumen-seccion" style="border-left-color: var(--primary);">
                    <h4>💵​ VENTAS DE PRODUCTOS</h4>
                    <div class="resumen-row"><span class="label">Transacciones</span><span class="value">${resumenVentas.numTransacciones}</span></div>
                    <div class="resumen-row"><span class="label">Unidades Vendidas</span><span class="value">${resumenVentas.totalUnidades}</span></div>
                    <div class="resumen-row total-section"><span class="label">Subtotal Ventas</span><span class="value">$${Math.round(totalGeneralVentas).toLocaleString('es-CO')}</span></div>
                </div>

                <div class="resumen-seccion" style="border-left-color: #3b82f6;">
                    <h4>💵​  OTROS INGRESOS</h4>
                    <div class="resumen-row"><span class="label">Abonos Créditos</span><span class="value">+$${Math.round(totalAbonosCreditos).toLocaleString('es-CO')}</span></div>
                    <div class="resumen-row"><span class="label">Abonos Deudores</span><span class="value">+$${Math.round(totalAbonosDeudores).toLocaleString('es-CO')}</span></div>
                    <div class="resumen-row"><span class="label">Ingresos Servicios</span><span class="value">+$${Math.round(totalAbonosServicios).toLocaleString('es-CO')}</span></div>
                    <div class="resumen-row total-section" style="color:#3b82f6;"><span class="label">Subtotal Otros</span><span class="value">$${Math.round(totalAbonosCreditos + totalAbonosDeudores + totalAbonosServicios).toLocaleString('es-CO')}</span></div>
                </div>

                <div class="resumen-seccion" style="border-left-color: #ef4444;">
                    <h4>💵​ EGRESOS DEL DÍA</h4>
                    <div class="resumen-row"><span class="label">Gastos Registrados</span><span class="value">-$${Math.round(totalGastos).toLocaleString('es-CO')}</span></div>
                    <div class="resumen-row"><span class="label">Adelantos Nómina</span><span class="value">-$${Math.round(totalAdelantos).toLocaleString('es-CO')}</span></div>
                    <div class="resumen-row"><span class="label">Pagos a Proveedor</span><span class="value">-$${Math.round(totalAbonosProv).toLocaleString('es-CO')}</span></div>
                    <div class="resumen-row total-section" style="color:#ef4444;"><span class="label">Total Egresos</span><span class="value">-$${Math.round(totalGastos + totalAdelantos + totalAbonosProv).toLocaleString('es-CO')}</span></div>
                </div>

                <div class="resumen-consolidado">
                    <div class="resumen-group">
                        <div class="resumen-row"><span class="label">Base de Caja</span><span class="value">$${base.toLocaleString('es-CO')}</span></div>
                    </div>
                    <div class="resumen-group" style="padding: 0 1rem; border-left: 2px solid rgba(255,255,255,0.1);">
                        <div class="resumen-row" style="font-weight:700;">
                            <span class="label" style="color:#cbd5e1;">💵​ EFECTIVO ESPERADO</span>
                            <span class="value" style="font-size:1.3rem; color:#10b981;">$${Math.round(efectivoEsperado).toLocaleString('es-CO')}</span>
                        </div>
                    </div>
                    <div class="resumen-row total-final">
                        <span class="label">💵​ CONSOLIDADO SISTEMA</span>
                        <span class="value">$${Math.round(resumenVentas.totalGeneralCierre).toLocaleString('es-CO')}</span>
                    </div>
                </div>
            </div>
            
            <!-- Desglose de productos PRE-CIERRE -->
            ${generarDesgloseProductos(true) || ''}
        `;

        document.getElementById('resumenCierreModal').innerHTML = resumenHTML;

        // Auto-completar campos de medios digitales con valores del sistema
        // El efectivo se deja en blanco para obligar al conteo físico
        if (TIENDA.esDigital) {
            if (document.getElementById('transferenciaContado')) document.getElementById('transferenciaContado').value = Math.round(totales.transferencia || 0);
            if (document.getElementById('nequiContado')) document.getElementById('nequiContado').value = Math.round(totales.nequi || 0);
            if (document.getElementById('daviplataContado')) document.getElementById('daviplataContado').value = Math.round(totales.daviplata || 0);
            if (document.getElementById('tarjetaContado')) document.getElementById('tarjetaContado').value = Math.round(totales.tarjeta || 0);
            if (document.getElementById('addiContado')) document.getElementById('addiContado').value = Math.round(totales.addi || 0);
            if (document.getElementById('sistecreditoContado')) document.getElementById('sistecreditoContado').value = Math.round(totales.sistecredito || 0);
            if (document.getElementById('fodegasContado')) document.getElementById('fodegasContado').value = Math.round(totales.fodegas || 0);
        } else {
            // Tienda Física: Auto-completar todo EXCEPTO efectivo
            if (document.getElementById('transferenciaContado')) document.getElementById('transferenciaContado').value = Math.round(totales.transferencia || 0);
            if (document.getElementById('nequiContado')) document.getElementById('nequiContado').value = Math.round(totales.nequi || 0);
            if (document.getElementById('daviplataContado')) document.getElementById('daviplataContado').value = Math.round(totales.daviplata || 0);
            if (document.getElementById('tarjetaContado')) document.getElementById('tarjetaContado').value = Math.round(totales.tarjeta || 0);
            if (document.getElementById('datafonoContado')) document.getElementById('datafonoContado').value = Math.round(totales.datafono || 0);
            if (document.getElementById('addiContado')) document.getElementById('addiContado').value = Math.round(totales.addi || 0);
            if (document.getElementById('sistecreditoContado')) document.getElementById('sistecreditoContado').value = Math.round(totales.sistecredito || 0);
            if (document.getElementById('fodegasContado')) document.getElementById('fodegasContado').value = Math.round(totales.fodegas || 0);

            // Efectivo vacío para obligar al conteo
            if (document.getElementById('efectivoContado')) document.getElementById('efectivoContado').value = '';
        }

        const obsEl = document.getElementById('observacionesCierre');
        if (obsEl) obsEl.value = '';

        // Gastos solo para tiendas físicas
        if (!TIENDA.esDigital) {
            gastosDelDia = [];
            renderizarGastos();
        }

        document.getElementById('modalCerrarCaja').classList.add('visible');

    } catch (e) {
        console.error('Error cargando resumen:', e);
        mostrarAlerta('Error al cargar datos', 'error');
    }
}

// ---------------------------------------------------------------
// CIERRE DE CAJA - CONFIRMAR (TIENDA FISICA)
// ---------------------------------------------------------------
async function confirmarCerrarCaja() {
    const efectivoContado = parseFloat(document.getElementById('efectivoContado')?.value) || 0;
    const transferenciaContado = parseFloat(document.getElementById('transferenciaContado')?.value) || 0;
    const tarjetaContado = parseFloat(document.getElementById('tarjetaContado')?.value) || 0;
    const daviplataContado = parseFloat(document.getElementById('daviplataContado')?.value) || 0;
    const nequiContado = parseFloat(document.getElementById('nequiContado')?.value) || 0;
    const addiContado = parseFloat(document.getElementById('addiContado')?.value) || 0;
    const datafonoContado = parseFloat(document.getElementById('datafonoContado')?.value) || 0;
    const sistecreditoContado = parseFloat(document.getElementById('sistecreditoContado')?.value) || 0;
    const fodegasContado = parseFloat(document.getElementById('fodegasContado')?.value) || 0;
    const observaciones = document.getElementById('observacionesCierre')?.value.trim() || '';

    // Validar efectivo si hubo ventas en efectivo
    if ((resumenVentas?.totales?.efectivo || 0) > 0 && efectivoContado <= 0) {
        mostrarAlerta('Debes contar el efectivo', 'warning');
        return;
    }

    const base = datosCaja?.montoInicial || 0;
    const totalGastos = gastosDelDia.reduce((sum, g) => sum + (g.monto || 0), 0);
    const gastosDetalle = gastosDelDia.filter(g => g.descripcion && g.monto > 0)
        .map(g => `${g.descripcion}: $${g.monto.toLocaleString('es-CO')}`).join(' | ');

    const diferenciaEfectivo = efectivoContado - (resumenVentas?.efectivoEsperado || 0);

    const totalContado = efectivoContado + transferenciaContado + tarjetaContado +
        daviplataContado + nequiContado + addiContado + datafonoContado +
        sistecreditoContado + fodegasContado;

    const totalEsperado = (resumenVentas?.totalGeneralCierre || 0) + base - (resumenVentas?.totalAdelantos || 0) - totalGastos - (resumenVentas?.totalAbonosProv || 0);
    const diferenciaTotal = totalContado - totalEsperado;
    const observacionesFinal = [observaciones, gastosDetalle].filter(Boolean).join(' || Gastos: ');

    try {
        const { error } = await db.from('cierres_caja')
            .update({
                fecha_cierre: new Date().toISOString(),
                ventas_efectivo_sistema: Math.round(resumenVentas?.totales?.efectivo || 0),
                ventas_transferencia_sistema: Math.round(resumenVentas?.totales?.transferencia || 0),
                ventas_tarjeta_sistema: Math.round(resumenVentas?.totales?.tarjeta || 0),
                ventas_daviplata_sistema: Math.round(resumenVentas?.totales?.daviplata || 0),
                ventas_nequi_sistema: Math.round(resumenVentas?.totales?.nequi || 0),
                ventas_addi_sistema: Math.round(resumenVentas?.totales?.addi || 0),
                ventas_datafono_sistema: Math.round(resumenVentas?.totales?.datafono || 0),
                ventas_sistecredito_sistema: Math.round(resumenVentas?.totales?.sistecredito || 0),
                ventas_credito_motero_sistema: Math.round(resumenVentas?.totales?.credito_motero || 0),
                ventas_fodegas_sistema: Math.round(resumenVentas?.totales?.fodegas || 0),
                abonos_credito_sistema: Math.round((resumenVentas?.totalAbonosCreditos || 0) + (resumenVentas?.totalAbonosDeudores || 0)),
                ingresos_servicios_sistema: Math.round(resumenVentas?.totalAbonosServicios || 0),
                total_ventas_sistema: Math.round(resumenVentas?.totalGeneralCierre || 0),
                efectivo_contado: efectivoContado,
                transferencias_contadas: transferenciaContado,
                tarjetas_contadas: tarjetaContado,
                daviplata_contado: daviplataContado,
                nequi_contado: nequiContado,
                addi_contado: addiContado,
                datafono_contado: datafonoContado,
                sistecredito_contado: sistecreditoContado,
                fodegas_contado: fodegasContado,
                diferencia_efectivo: Math.round(diferenciaEfectivo),
                diferencia_total: Math.round(diferenciaTotal),
                total_gastos_dia: totalGastos + resumenVentas.totalAdelantos + resumenVentas.totalAbonosProv,
                observaciones: observacionesFinal + ` || Desglose: Ventas Productos: $${resumenVentas.totalGeneralVentas} | Abonos: $${resumenVentas.totalAbonosCreditos + resumenVentas.totalAbonosDeudores} | Servicios: $${resumenVentas.totalAbonosServicios} | Adelantos: $${resumenVentas.totalAdelantos} | Pagos Prov: $${resumenVentas.totalAbonosProv}`,
                detalles_cierre: resumenVentas.ventasDelDia || [],
                estado: 'cerrado'
            })
            .eq('numero_cierre', datosCaja?.numeroCierre);

        if (error) throw error;

        cerrarModal();
        if (window.moterosIA) {
            window.moterosIA.aprenderEvento('Cierre de caja realizado', {
                tienda: TIENDA.nombre,
                total_venta: resumenVentas?.totalGeneralCierre,
                diferencia: diferenciaTotal
            });
        }
        // Generar desglose de productos vendidos
        window._productosCierreHTML = generarDesgloseProductos();
        mostrarResumenFinal(efectivoContado, diferenciaEfectivo, diferenciaTotal, totalGastos);

        localStorage.removeItem(TIENDA.storageKey);
        cajaAbierta = false;
        datosCaja = null;
        actualizarUICaja();

        mostrarAlerta('✅​ Cierre guardado correctamente', 'success');

    } catch (e) {
        console.error('Error cerrando caja:', e);
        mostrarAlerta('Error al guardar: ' + (e.message || 'desconocido'), 'error');
    }
}

// ---------------------------------------------------------------
// CIERRE DE CAJA - CONFIRMAR (TIENDA DIGITAL)
// ---------------------------------------------------------------
async function confirmarCerrarCajaDigital() {
    const transferenciaContado = parseFloat(document.getElementById('transferenciaContado')?.value) || 0;
    const nequiContado = parseFloat(document.getElementById('nequiContado')?.value) || 0;
    const daviplataContado = parseFloat(document.getElementById('daviplataContado')?.value) || 0;
    const tarjetaContado = parseFloat(document.getElementById('tarjetaContado')?.value) || 0;
    const contraentregaContado = parseFloat(document.getElementById('contraentregaContado')?.value) || 0;
    const addiContado = parseFloat(document.getElementById('addiContado')?.value) || 0;
    const sistecreditoContado = parseFloat(document.getElementById('sistecreditoContado')?.value) || 0;
    const fodegasContado = parseFloat(document.getElementById('fodegasContado')?.value) || 0;
    const observaciones = document.getElementById('observacionesCierre')?.value.trim() || '';

    const totalContado = transferenciaContado + nequiContado + daviplataContado +
        tarjetaContado + contraentregaContado + addiContado + sistecreditoContado + fodegasContado;
    const diferenciaTotal = totalContado - (resumenVentas?.totalGeneralCierre || 0);

    try {
        const { error } = await db.from('cierres_caja')
            .update({
                fecha_cierre: new Date().toISOString(),
                ventas_transferencia_sistema: Math.round(resumenVentas?.totales?.transferencia || 0),
                ventas_nequi_sistema: Math.round(resumenVentas?.totales?.nequi || 0),
                ventas_daviplata_sistema: Math.round(resumenVentas?.totales?.daviplata || 0),
                ventas_tarjeta_sistema: Math.round(resumenVentas?.totales?.tarjeta || 0),
                total_ventas_sistema: Math.round(resumenVentas?.totalGeneralCierre || 0),
                transferencias_contadas: transferenciaContado,
                nequi_contado: nequiContado,
                daviplata_contado: daviplataContado,
                tarjetas_contadas: tarjetaContado,
                addi_contado: addiContado,
                sistecredito_contado: sistecreditoContado,
                fodegas_contado: fodegasContado,
                diferencia_total: Math.round(diferenciaTotal),
                observaciones: observaciones + ` || Desglose Digital: Ventas: $${resumenVentas.totalGeneralVentas} | Abonos: $${resumenVentas.totalAbonosCreditos + resumenVentas.totalAbonosDeudores} | Servicios: $${resumenVentas.totalAbonosServicios}`,
                detalles_cierre: resumenVentas.ventasDelDia || [],
                estado: 'cerrado'
            })
            .eq('numero_cierre', datosCaja?.numeroCierre);

        if (error) throw error;

        cerrarModal();
        if (window.moterosIA) {
            window.moterosIA.aprenderEvento('Cierre digital realizado', {
                total_venta: resumenVentas?.totalGeneral,
                diferencia: diferenciaTotal
            });
        }
        // Generar desglose de productos vendidos
        window._productosCierreHTML = generarDesgloseProductos();
        mostrarResumenFinalDigital(totalContado, diferenciaTotal);

        localStorage.removeItem(TIENDA.storageKey);
        cajaAbierta = false;
        actualizarUICaja();

        mostrarAlerta('✅​ Cierre guardado', 'success');

    } catch (e) {
        console.error('Error:', e);
        mostrarAlerta('Error al cerrar: ' + e.message, 'error');
    }
}

// ---------------------------------------------------------------
// RESUMEN FINAL CIERRE (F SICA)
// ---------------------------------------------------------------
function mostrarResumenFinal(efectivoContado, diferenciaEfectivo, diferenciaTotal, totalGastos) {
    const difEfClass = diferenciaEfectivo >= 0 ? 'diferencia-positiva' : 'diferencia-negativa';
    const difTotClass = diferenciaTotal >= 0 ? 'diferencia-positiva' : 'diferencia-negativa';

    document.getElementById('pantallaAbrirCaja').classList.add('hidden');
    document.getElementById('resumenCierreCompleto').classList.remove('hidden');
    document.getElementById('resumenCierreCompleto').innerHTML = `
        <div class="resumen-final">
            <h2>✅​ Caja Cerrada</h2>
            <p class="numero-cierre">Cierre guardado exitosamente</p>
            <div class="resumen-cierre">
                <div class="resumen-row"><span class="label">📅​ Fecha</span><span class="value">${new Date().toLocaleDateString('es-CO')}</span></div>
                <div class="resumen-row"><span class="label">🏪​ Tienda</span><span class="value">${TIENDA.nombre}</span></div>
                <div class="resumen-row"><span class="label">👤 Vendedor</span><span class="value">${datosCaja?.vendedor || 'N/A'}</span></div>
                <div class="resumen-row"><span class="label">🏦​ Transacciones</span><span class="value">${resumenVentas?.numTransacciones || 0}</span></div>
                <div class="resumen-row"><span class="label">🧮​ Unidades</span><span class="value">${resumenVentas?.totalUnidades || 0}</span></div>
                <div class="resumen-row"><span class="label">💰 Total Ventas</span><span class="value">$${(resumenVentas?.totalGeneral || 0).toLocaleString('es-CO')}</span></div>
                <div class="resumen-row"><span class="label">💸 Total Gastos</span><span class="value">$${totalGastos.toLocaleString('es-CO')}</span></div>
                <div class="resumen-row"><span class="label">💵 Efectivo Contado</span><span class="value">$${efectivoContado.toLocaleString('es-CO')}</span></div>
                <div class="resumen-row"><span class="label">🧮 Dif. Efectivo</span><span class="value ${difEfClass}">$${diferenciaEfectivo.toLocaleString('es-CO')}</span></div>
                <div class="resumen-row total"><span class="label">Dif. Total</span><span class="value ${difTotClass}">$${diferenciaTotal.toLocaleString('es-CO')}</span></div>
            </div>
            ${window._productosCierreHTML || ''}
            <button class="btn btn-success btn-large btn-full mt-1" onclick="reiniciarPantallaCaja()">🔓​ Abrir Nueva Caja</button>
        </div>
    `;
}

// ---------------------------------------------------------------
// RESUMEN FINAL CIERRE (DIGITAL)
// ---------------------------------------------------------------
function mostrarResumenFinalDigital(totalContado, diferenciaTotal) {
    const difTotClass = diferenciaTotal >= 0 ? 'diferencia-positiva' : 'diferencia-negativa';

    document.getElementById('pantallaAbrirCaja').classList.add('hidden');
    document.getElementById('resumenCierreCompleto').classList.remove('hidden');
    document.getElementById('resumenCierreCompleto').innerHTML = `
        <div class="resumen-final">
            <h2>🔒 Caja Cerrada</h2>
            <p class="numero-cierre">Digital - ${new Date().toLocaleDateString('es-CO')}</p>
            <div class="resumen-cierre">
                <div class="resumen-row"><span class="label">🏦​ Pedidos</span><span class="value">${resumenVentas?.numTransacciones || 0}</span></div>
                <div class="resumen-row"><span class="label">💰 Total Ventas</span><span class="value">$${(resumenVentas?.totalGeneral || 0).toLocaleString('es-CO')}</span></div>
                <div class="resumen-row"><span class="label">💵 Total Contado</span><span class="value">$${totalContado.toLocaleString('es-CO')}</span></div>
                <div class="resumen-row total"><span class="label">Diferencia</span><span class="value ${difTotClass}">$${diferenciaTotal.toLocaleString('es-CO')}</span></div>
            </div>
            ${window._productosCierreHTML || ''}
            <button class="btn btn-success btn-large btn-full mt-1" onclick="reiniciarPantallaCaja()">🔓​ Abrir Nueva Caja</button>
        </div>
    `;
}

function reiniciarPantallaCaja() {
    document.getElementById('resumenCierreCompleto').classList.add('hidden');
    document.getElementById('pantallaAbrirCaja').classList.remove('hidden');
    abrirModalCaja();
}

// ---------------------------------------------------------------
// GASTOS DEL DIA (solo tiendas físicas)
// ---------------------------------------------------------------
function agregarGasto() {
    gastosDelDia.push({ descripcion: '', monto: 0 });
    renderizarGastos();
}

function eliminarGasto(idx) {
    gastosDelDia.splice(idx, 1);
    renderizarGastos();
}

function actualizarGasto(idx, campo, valor) {
    gastosDelDia[idx][campo] = campo === 'monto' ? parseFloat(valor) || 0 : valor;
    renderizarGastos();
}

function renderizarGastos() {
    const container = document.getElementById('gastosLista');
    if (!container) return;

    const totalGastos = gastosDelDia.reduce((sum, g) => sum + (g.monto || 0), 0);

    container.innerHTML = gastosDelDia.map((g, idx) => `
        <div class="gasto-item" style="display:flex; gap:5px; align-items:center; margin-bottom:5px;">
            <input type="text" placeholder="Descripción" value="${g.descripcion}" 
                   onchange="actualizarGasto(${idx}, 'descripcion', this.value)" style="flex:2">
            <input type="number" placeholder="$0" value="${g.monto || ''}" 
                   onchange="actualizarGasto(${idx}, 'monto', this.value)" style="flex:1">
            
            <div style="position:relative; width:30px; overflow:hidden;">
               <label for="file-${idx}" style="cursor:pointer; font-size:1.2em;" title="Adjuntar Foto">📷​</label>
               <input type="file" id="file-${idx}" accept="image/*" 
                      onchange="subirEvidenciaGasto(${idx}, this)" 
                      style="position:absolute; left:0; top:0; opacity:0; width:100%;">
            </div>
            
            ${g.evidenciaUrl ? `<a href="${g.evidenciaUrl}" target="_blank" title="Ver evidencia">🧾​</a>` : ''}
            
            <button onclick="eliminarGasto(${idx})" style="padding:0 8px;">❌</button>
        </div>
    `).join('');

    const totalEl = document.getElementById('totalGastos');
    if (totalEl) totalEl.textContent = `$${totalGastos.toLocaleString('es-CO')}`;
}

async function subirEvidenciaGasto(idx, input) {
    const file = input.files[0];
    if (!file) return;

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) return mostrarAlerta('Imagen muy grande (Max 5MB)', 'warning');

    try {
        mostrarAlerta('?Subiendo evidencia...', 'info');
        const ext = file.name.split('.').pop();
        const fileName = `gasto_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${ext}`;

        const { error } = await db.storage
            .from('gastos-evidencia')
            .upload(fileName, file);

        if (error) throw error;

        const { data } = db.storage
            .from('gastos-evidencia')
            .getPublicUrl(fileName);

        gastosDelDia[idx].evidenciaUrl = data.publicUrl;
        renderizarGastos();
        mostrarAlerta(' Evidencia guardada', 'success');

    } catch (e) {
        console.error('Error subiendo:', e);
        mostrarAlerta('Error al subir: ' + e.message, 'error');
    }

    const totalEl = document.getElementById('totalGastos');
    if (totalEl) totalEl.textContent = `$${totalGastos.toLocaleString('es-CO')}`;
}

// ---------------------------------------------------------------
// PRODUCTOS
// ---------------------------------------------------------------
async function cargarVendedores() {
    try {
        const { data: vends, error } = await db.from('empleados_tienda').select('*').eq('activo', true);
        if (error) throw error;

        // Cachear empleados para login offline
        if (vends && window.OfflineManager) {
            window.OfflineManager.cachearEmpleados(vends);
        }

        const select = document.getElementById('vendedorVenta');
        if (select) {
            select.innerHTML = '<option value="">-- Seleccionar Vendedor --</option>' +
                vends.map(v => `<option value="${v.nombre}">${v.nombre}</option>`).join('');
        }
    } catch (e) {
        console.error('Error cargando vendedores:', e);
        // Si estamos offline, intentar cargar de la DB local para el select
        if (!navigator.onLine && window.OfflineManager) {
            const vendsLocal = await offlineDB.empleados.toArray();
            const select = document.getElementById('vendedorVenta');
            if (select && vendsLocal.length > 0) {
                select.innerHTML = '<option value="">-- Seleccionar Vendedor (Offline) --</option>' +
                    vendsLocal.map(v => `<option value="${v.nombre}">${v.nombre}</option>`).join('');
            }
        }
    }
}

async function cargarProductos() {
    try {
        // MODO OFFLINE
        if (!navigator.onLine && window.OfflineManager) {
            console.warn('Offline: Cargando productos desde IndexedDB...');
            const prodsCached = await window.OfflineManager.obtenerProductosOffline();
            const localFilter = TIENDA.esDigital || TIENDA.nombre === 'Admin' ? 'Todas' : (TIENDA.nombre === '01' ? '01' : (TIENDA.nombre === 'Alcalá' ? 'Alcalá' : (TIENDA.nombre === 'Jordán' ? 'Jordán' : TIENDA.nombre)));
            const invCached = await window.OfflineManager.obtenerInventarioOffline(localFilter);

            if (prodsCached.length > 0) {
                procesarProductosOffline(prodsCached, invCached);
                return;
            }
        }

        const { data: prods, error } = await db.from('productos')
            .select('id, id_producto, nombre, marca, precio, variantes, url_imagen, categoria')
            .eq('estado', 'Activo')
            .order('nombre');

        if (error) throw error;

        // 1. Cargar Inventario de la Tienda Actual (o todas si es Admin/Digital)
        // Ahora incluimos la columna 'talla'
        let inventarios = {};

        if (TIENDA.esDigital || TIENDA.nombre === 'Admin') {
            const [alcala, local01, jordan] = await Promise.all([
                db.from('inventario_alcala').select('id_producto, cantidad, talla, color'),
                db.from('inventario_01').select('id_producto, cantidad, talla, color'),
                db.from('inventario_jordan').select('id_producto, cantidad, talla, color')
            ]);
            inventarios = { alcala: alcala.data, local01: local01.data, jordan: jordan.data };
        } else if (TIENDA.nombre === 'Evento') {
            const { data: stock } = await db.from('inventario_evento').select('id_producto, cantidad, talla, color');
            inventarios = { actual: stock };
        } else {
            const { data: stock } = await db.from(TIENDA.tablaInventario).select('id_producto, cantidad, talla, color');
            inventarios = { actual: stock };
        }

        // 2. Procesar Productos
        productos = (prods || []).map(p => {
            // Normalizar ID a string para buscar en inventario
            // IMPORTANTE: El inventario usa 'id_producto' (texto/código) para relacionar, NO el UUID por defecto
            const pId = p.id_producto ? String(p.id_producto) : String(p.id);

            let stockTotal = 0;
            let stockDetallado = {}; // Estructura: { "Color": { "S": 5, "M": 3 } }
            let stocksGlobales = {}; // Estructura: { 'Alcalá': { 'Color': { 'S': 5 } } }

            if (TIENDA.esDigital || TIENDA.nombre === 'Admin') {
                // Lógica Digital: Desglosar por tienda y talla
                const tiendasKeys = [
                    { key: 'alcala', nombre: 'Alcalá' },
                    { key: 'local01', nombre: '01' },
                    { key: 'jordan', nombre: 'Jordán' }
                ];

                tiendasKeys.forEach(t => {
                    const items = inventarios[t.key] || [];
                    const itemsProducto = items.filter(i => String(i.id_producto) === pId);

                    if (itemsProducto.length > 0) {
                        stocksGlobales[t.nombre] = {};
                        itemsProducto.forEach(item => {
                            const cant = item.cantidad || 0;
                            const talla = item.talla || 'Única';
                            const color = item.color || '';

                            stockTotal += cant;
                            if (!stocksGlobales[t.nombre][color]) stocksGlobales[t.nombre][color] = {};
                            stocksGlobales[t.nombre][color][talla] = (stocksGlobales[t.nombre][color][talla] || 0) + cant;
                        });
                    }
                });
            } else {
                // Lógica Tienda Física: Stock de esta tienda desglosado por talla y color
                const items = inventarios.actual || [];
                // Filtrar items de este producto
                const variantesStock = items.filter(i => String(i.id_producto) === pId);

                variantesStock.forEach(v => {
                    const cant = v.cantidad || 0;
                    const talla = v.talla || 'Única';
                    const color = v.color || '';

                    stockTotal += cant;
                    if (!stockDetallado[color]) stockDetallado[color] = {};
                    stockDetallado[color][talla] = (stockDetallado[color][talla] || 0) + cant;
                });
            }

            return {
                ...p,
                id_producto: p.id, // Unificar uso de ID
                stock: stockTotal,
                stock_detallado: stockDetallado,
                stocks_globales: stocksGlobales // Nuevo campo para Digital/Admin
            };
        });

        // Cachear para modo offline
        if (window.OfflineManager) {
            window.OfflineManager.cachearProductos(prods, inventarios);
        }

        renderizarProductos();
    } catch (e) {
        console.error('Error cargando productos:', e);
        mostrarAlerta('Error al cargar productos: ' + e.message, 'error');
    }
}

function renderizarProductos() {
    const container = document.getElementById('listaProductos');
    const busqueda = document.getElementById('inputBuscar')?.value.toLowerCase().trim() || '';

    const filtrados = productos.filter(p =>
        !busqueda ||
        p.nombre?.toLowerCase().includes(busqueda) ||
        p.marca?.toLowerCase().includes(busqueda) ||
        p.id_producto?.toString().toLowerCase().includes(busqueda)
    );



    if (filtrados.length === 0) {
        container.innerHTML = '<div class="carrito-vacio">No se encontraron productos</div>';
        return;
    }

    container.innerHTML = filtrados.map(p => {
        const agotado = p.stock <= 0;

        if (TIENDA.esDigital || TIENDA.nombre === 'Admin') {
            // Renderizado especial para Digital y Admin (Botones por tienda y talla)
            let htmlStock = '';
            if (p.stocks_globales && Object.keys(p.stocks_globales).length > 0) {
                Object.entries(p.stocks_globales).forEach(([tienda, coloresObj]) => {

                    // Determinar clase de color según tienda
                    let claseTienda = 'btn-stock-defecto';
                    if (tienda.includes('Alcalá')) claseTienda = 'btn-stock-alcala';
                    else if (tienda.includes('01')) claseTienda = 'btn-stock-local01';
                    else if (tienda.includes('Jordán')) claseTienda = 'btn-stock-jordan';
                    else if (tienda.includes('Digital')) claseTienda = 'btn-stock-digital';

                    Object.entries(coloresObj).forEach(([color, tallasObj]) => {
                        Object.entries(tallasObj).forEach(([talla, cant]) => {
                            if (cant > 0) {
                                // En digital, al hacer click, agregamos al carrito con Tienda, Color y Talla
                                htmlStock += `
                                <button class="btn-stock-tienda ${claseTienda} activo"
                                    onclick="agregarAlCarrito('${p.id_producto}', '${tienda}', '${talla}', '${color}')"
                                    title="Vender de ${tienda} - ${color ? `Color ${color} - ` : ''}Talla ${talla}">
                                    <span class="tienda-name">${tienda}</span>
                                    <span class="talla-qty">${color ? `${color} ` : ''}${talla === 'Única' ? 'ÚNICA' : talla} (${cant})</span>
                                </button>`;
                            }
                        });
                    });
                });
            } else {
                htmlStock = '<span class="text-muted" style="font-size:0.8rem; padding:5px;">Sin stock global</span>';
            }

            return `
            <div class="producto digital ${agotado ? 'agotado' : ''}" style="border-left: 5px solid ${agotado ? '#cbd5e1' : '#3b82f6'};">
                ${p.url_imagen ? `<div class="producto-img"><img src="${p.url_imagen}" alt="${p.nombre}" onerror="this.style.display='none'"></div>` : ''}
                <div class="producto-info">
                    <h4 style="font-size:1rem; color:#1e293b; margin-bottom:4px;">${p.nombre}</h4>
                    <small style="display:block; margin-bottom:8px; color:#64748b;">${p.marca || 'Sin marca'} • ${p.id_producto}</small>
                    <div class="stock-breakdown" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">
                        ${htmlStock}
                    </div>
                </div>
                <div class="producto-precio" style="align-self: flex-start;">
                    <span class="precio" style="font-size:1.1rem; color:#1e293b;">$${(p.precio || 0).toLocaleString('es-CO')}</span>
                </div>
            </div>`;
        } else {
            // Renderizado normal para Física
            const stockClass = p.stock > 5 ? 'stock-ok' : p.stock > 0 ? 'stock-bajo' : 'stock-no';

            let htmlTallas = '';
            // Si hay stock detallado por color y talla
            if (p.stock_detallado && Object.keys(p.stock_detallado).length > 0) {
                // Iterar sobre colores y luego sobre tallas
                Object.entries(p.stock_detallado).forEach(([color, tallasObj]) => {
                    Object.entries(tallasObj).forEach(([talla, qty]) => {
                        const btnClass = qty > 0 ? 'btn-talla-disponible' : 'btn-talla-agotada';
                        const clickAction = qty > 0 ? `event.stopPropagation(); agregarAlCarrito('${p.id_producto}', '${talla}', '${color}')` : '';
                        htmlTallas += `<button class="${btnClass}" onclick="${clickAction}">${color ? `${color} ` : ''}${talla} (${qty})</button>`;
                    });
                });
            }

            return `
                <div id="card-producto-${p.id_producto}" class="producto ${agotado ? 'agotado' : ''}" 
                     onclick="${agotado ? '' : (p.variantes && p.variantes.length > 0 ? '' : `agregarAlCarrito('${p.id_producto}')`)}">
                    
                    ${p.url_imagen ? `<div class="producto-img"><img src="${p.url_imagen}" alt="${p.nombre}" onerror="this.style.display='none'"></div>` : ''}
                    
                    <div class="producto-info">
                        <h4 style="margin: 0 0 5px 0; font-size: 0.95rem;">${p.nombre}</h4>
                        <small style="color:#64748b;">${p.marca || 'Generico'} • ${p.id_producto}</small>
                        
                        <!-- SECCIÓN COLORES -->
                        ${p.variantes && p.variantes.length > 0 ? `
                            <div class="colores-grid" style="margin-top: 5px; display:flex; flex-wrap:wrap; gap:4px;">
                                ${p.variantes.map(c => {
                const nombreColor = (typeof c === 'object' && c !== null) ? (c.nombre || c.color || c.value || 'Indefinido') : c;
                return `
                                    <button class="btn-color" 
                                            onclick="event.stopPropagation(); seleccionarColor('${p.id_producto}', this, '${nombreColor}')"
                                            style="padding: 2px 6px; font-size: 0.75rem; border:1px solid #cbd5e1; border-radius:4px; background:white; cursor:pointer;"
                                            title="${nombreColor}">${nombreColor}</button>
                                `;
            }).join('')}
                            </div>
                        ` : ''}

                        <!-- SECCIÓN TALLAS -->
                        ${Object.keys(p.stock_detallado).length > 0 ? `
                            <div class="tallas-grid" style="margin-top: 8px; display:flex; flex-wrap:wrap; gap:4px;">
                                ${Object.entries(p.stock_detallado)
                        .flatMap(([color, tallasObj]) =>
                            Object.entries(tallasObj)
                                .filter(([t, q]) => q > 0) // Solo mostrar tallas con stock
                                .map(([talla, qty]) => `
                                                <button class="btn-talla-disponible" 
                                                        onclick="event.stopPropagation(); agregarAlCarrito('${p.id_producto}', '${talla}', '${color}')"
                                                        style="padding: 4px 8px; font-size: 0.8rem; background:#10b981; color:white; border:none; border-radius:4px; cursor:pointer;">
                                                    ${color ? `${color} ` : ''}${talla} (${qty})
                                                </button>
                                            `)
                        ).join('')}
                                ${Object.values(p.stock_detallado).every(tallasObj => Object.values(tallasObj).every(qty => qty === 0)) ? '<span style="color:red; font-size:0.8rem;">Agotado</span>' : ''}
                            </div>
                        ` : `<div style="margin-top:5px;"><span class="stock-badge ${stockClass}">${p.stock} unid.</span></div>`}

                    </div>
                    <div class="producto-precio">
                        <span class="precio">$${(p.precio || 0).toLocaleString('es-CO')}</span>
                    </div>
                </div>
            `;
        }
    }).join('');
}

function filtrarProductos() { renderizarProductos(); }

// ---------------------------------------------------------------
// UI HELPERS
// ---------------------------------------------------------------
function seleccionarColor(idProducto, btn, color) {
    // Remover seleccionado de otros botones de este producto
    const card = document.getElementById(`card-producto-${idProducto}`);
    if (!card) return;

    card.querySelectorAll('.btn-color').forEach(b => {
        b.style.background = 'white';
        b.style.color = 'black';
        b.style.borderColor = '#cbd5e1';
        b.classList.remove('seleccionado');
    });

    // Activar este
    btn.style.background = '#3b82f6';
    btn.style.color = 'white';
    btn.style.borderColor = '#3b82f6';
    btn.classList.add('seleccionado');
    btn.dataset.color = color;
}

// ---------------------------------------------------------------
// CARRITO
// ---------------------------------------------------------------
function agregarAlCarrito(idProducto, arg2 = null, arg3 = null, arg4 = null) { // arg2: talla (fisica) / tiendaOrigen (digital), arg3: color (fisica) / talla (digital), arg4: color (digital)
    const prod = productos.find(p => p.id_producto == idProducto);
    if (!prod) return;

    // Calcular precio
    let precioFinal = prod.precio;
    let motivo = '';
    if (window.PromocionesManager && window.PromocionesManager.cargado) {
        const local = TIENDA.nombre || null;
        const calc = window.PromocionesManager.calcularPrecio(prod.precio, prod.id_producto, local);
        if (calc && calc.tienePromo) {
            precioFinal = calc.precioFinal;
            motivo = `Promo: ${calc.promocion.nombre} (-${calc.descuento}%)`;
        }
    }

    // LÓGICA FÍSICA
    if (!TIENDA.esDigital) {
        const tallaSeleccionada = arg2;
        let colorSeleccionado = arg3; // Ahora el color puede venir directamente del botón de talla si no hay botones de color

        // 1. Validar Color si aplica (si hay botones de color, se debe seleccionar uno)
        if (prod.variantes && prod.variantes.length > 0) {
            const card = document.getElementById(`card-producto-${idProducto}`);
            const btnColor = card ? card.querySelector('.btn-color.seleccionado') : null;
            if (!btnColor && !colorSeleccionado) { // Si hay variantes pero no se seleccionó color ni se pasó por arg
                mostrarAlerta('​⚠️​ Selecciona un color primero', 'warning');
                return;
            }
            if (btnColor) colorSeleccionado = btnColor.dataset.color || btnColor.textContent;
        }

        // 2. Validar Talla
        // Si el producto tiene stock detallado (por color/talla) y no se seleccionó talla
        if (prod.stock_detallado && Object.keys(prod.stock_detallado).length > 0 && !tallaSeleccionada) {
            mostrarAlerta('​⚠️​ Selecciona una talla', 'warning');
            return;
        }

        // 3. Stock
        let stockDisponible = 0;
        if (prod.stock_detallado) {
            const colorKey = colorSeleccionado || '';
            const tallaKey = tallaSeleccionada || 'Única';
            if (prod.stock_detallado[colorKey]) {
                stockDisponible = prod.stock_detallado[colorKey][tallaKey] || 0;
            }
        } else {
            // Si no hay stock detallado, usamos el stock total del producto
            stockDisponible = prod.stock;
        }

        if (stockDisponible <= 0) {
            mostrarAlerta(`⚠️ Sin stock para ${colorSeleccionado || ''} [${tallaSeleccionada || 'Única'}]`, 'error');
            return;
        }

        const existe = carrito.find(i =>
            i.id_producto == idProducto &&
            i.variante === tallaSeleccionada &&
            i.color === colorSeleccionado
        );

        if (existe) {
            if (existe.cantidad >= stockDisponible) {
                mostrarAlerta(`Stock máximo alcanzado`, 'warning');
                return;
            }
            existe.cantidad++;
        } else {
            // Nombre descriptivo
            let descripcion = prod.nombre;
            if (colorSeleccionado) descripcion += ` (${colorSeleccionado})`;
            if (tallaSeleccionada && tallaSeleccionada !== 'Única') descripcion += ` [${tallaSeleccionada}]`;

            carrito.push({
                id_producto: prod.id_producto,
                nombre: descripcion,
                nombreBase: prod.nombre,
                variante: tallaSeleccionada,
                color: colorSeleccionado,
                marca: prod.marca,
                precioOriginal: prod.precio,
                precio: precioFinal,
                cantidad: 1,
                stockMax: stockDisponible,
                tiendaOrigen: 'Tienda',
                motivo: motivo
            });
        }
        renderizarCarrito();
        mostrarAlerta('Producto agregado', 'success');
        return;
    }

    // LÓGICA DIGITAL
    else {
        const tiendaOrigen = arg2;
        const tallaDigital = arg3 || 'Única'; // Recibimos la talla o asumimos Única
        const colorDigital = arg4 || '';
        if (!tiendaOrigen) return mostrarAlerta('Error: tienda origen no definida', 'error');

        // Búsqueda de stock más precisa usando stocks_globales
        let stockDisp = 0;
        if (prod.stocks_globales && prod.stocks_globales[tiendaOrigen]) {
            if (prod.stocks_globales[tiendaOrigen][colorDigital]) {
                stockDisp = prod.stocks_globales[tiendaOrigen][colorDigital][tallaDigital] || 0;
            }
        }

        if (stockDisp <= 0) return mostrarAlerta(`Sin stock de ${colorDigital ? colorDigital + ' ' : ''}${tallaDigital} en ${tiendaOrigen}`, 'error');

        const existe = carrito.find(i =>
            i.id_producto == idProducto &&
            i.tiendaOrigen === tiendaOrigen &&
            i.variante === tallaDigital &&
            i.color === colorDigital
        );

        if (existe) {
            if (existe.cantidad >= stockDisp) {
                mostrarAlerta(`Stock máximo de ${tallaDigital} en ${tiendaOrigen} alcanzado`, 'warning');
                return;
            }
            existe.cantidad++;
        } else {
            carrito.push({
                id_producto: prod.id_producto,
                nombre: `${prod.nombre} (${tiendaOrigen}) ${colorDigital ? '[' + colorDigital + '] ' : ''}[${tallaDigital}]`,
                nombreBase: prod.nombre,
                marca: prod.marca,
                precioOriginal: prod.precio,
                precio: precioFinal,
                cantidad: 1,
                stockMax: stockDisp,
                tiendaOrigen: tiendaOrigen,
                variante: tallaDigital, // Guardamos la talla
                color: colorDigital,
                motivo: motivo
            });
        }
        renderizarCarrito();
        mostrarAlerta('Producto agregado (Digital)', 'success');
    }
}

function renderizarCarrito() {
    const container = document.getElementById('carritoItems');
    const countEl = document.getElementById('carritoCount');
    const totalEl = document.getElementById('totalMonto');

    const totalItems = carrito.reduce((sum, i) => sum + i.cantidad, 0);
    countEl.textContent = totalItems;

    let subtotal = carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
    let descuentoCliente = 0;

    // Aplicar descuento de cliente (si existe)
    if (clienteSeleccionado && clienteSeleccionado.promocion) {
        const pct = clienteSeleccionado.promocion.descuento_porcentaje;
        descuentoCliente = Math.round(subtotal * (pct / 100));
    }

    const totalFinal = subtotal - descuentoCliente;

    if (carrito.length === 0) {
        container.innerHTML = `<div class="carrito-vacio">⚠️ ${TIENDA.esDigital ? 'El pedido está vacío' : 'El carrito está vacío'}</div>`;
        totalEl.innerHTML = '$0';
        actualizarBotonVender();
        return;
    }

    // Mostrar Totales
    if (descuentoCliente > 0) {
        totalEl.innerHTML = `
            <div style="font-size:0.6em; text-decoration:line-through; color:#94a3b8;">$${subtotal.toLocaleString('es-CO')}</div>
            <div style="font-size:0.6em; color:#ef4444;">- $${descuentoCliente.toLocaleString('es-CO')} (${clienteSeleccionado.promocion.descuento_porcentaje}%)</div>
            $${totalFinal.toLocaleString('es-CO')}
        `;
    } else {
        totalEl.textContent = '$' + totalFinal.toLocaleString('es-CO');
    }

    container.innerHTML = carrito.map((item, idx) => {
        const tieneDescuento = item.precio < item.precioOriginal;
        return `
            <div class="carrito-item">
                <div class="carrito-item-info">
                    <strong>${item.nombre}</strong>
                    <small>
                        ${tieneDescuento ? `<span class="precio-descuento">$${item.precioOriginal.toLocaleString('es-CO')}</span>` : ''}
                        $${item.precio.toLocaleString('es-CO')} × ${item.cantidad} = $${(item.precio * item.cantidad).toLocaleString('es-CO')}
                        ${tieneDescuento ? `<span class="motivo-descuento">⏳ ${item.motivo}</span>` : ''}
                    </small>
                </div>
                <div class="carrito-item-acciones">
                    <button class="btn-editar-precio" onclick="abrirEditarPrecio(${idx})">✏️​</button>
                    <button class="btn-cantidad-menos" onclick="cambiarCantidad(${idx}, -1)">➖</button>
                    <span class="cantidad-display">${item.cantidad}</span>
                    <button class="btn-cantidad-mas" onclick="cambiarCantidad(${idx}, 1)">➕</button>
                    <button class="btn-quitar" onclick="quitarDelCarrito(${idx})">❌</button>
                </div>
            </div>
        `;
    }).join('');

    actualizarBotonVender();
}

function cambiarCantidad(idx, delta) {
    const item = carrito[idx];
    const nuevaCant = item.cantidad + delta;

    if (nuevaCant <= 0) quitarDelCarrito(idx);
    else if (nuevaCant > item.stockMax) mostrarAlerta('Stock máximo alcanzado', 'warning');
    else { item.cantidad = nuevaCant; renderizarCarrito(); }
}

function quitarDelCarrito(idx) {
    carrito.splice(idx, 1);
    renderizarCarrito();
}

// ---------------------------------------------------------------
// EDITAR PRECIO
// ---------------------------------------------------------------
function abrirEditarPrecio(idx) {
    itemEditandoIdx = idx;
    const item = carrito[idx];
    document.getElementById('nombreProductoEditar').textContent = item.nombre;
    document.getElementById('precioOriginal').value = '$' + item.precioOriginal.toLocaleString('es-CO');
    document.getElementById('precioNuevo').value = item.precio;
    document.getElementById('motivoDescuento').value = item.motivo || '';
    document.getElementById('modalEditarPrecio').classList.add('visible');
}

function aplicarDescuento() {
    const nuevo = parseFloat(document.getElementById('precioNuevo').value) || 0;
    const motivo = document.getElementById('motivoDescuento').value.trim();

    if (nuevo <= 0) {
        mostrarAlerta('El precio debe ser mayor a 0', 'error');
        return;
    }

    if (nuevo < carrito[itemEditandoIdx].precioOriginal && !motivo) {
        mostrarAlerta('Debes ingresar el motivo del descuento', 'error');
        return;
    }

    carrito[itemEditandoIdx].precio = nuevo;
    carrito[itemEditandoIdx].motivo = motivo;

    cerrarModal();
    renderizarCarrito();
    mostrarAlerta(' Precio actualizado', 'success');
}

// ---------------------------------------------------------------
// METODOS DE PAGO
// 
function toggleMetodo(el) {
    const metodo = el.dataset.metodo;

    if (metodosSeleccionados.has(metodo)) {
        metodosSeleccionados.delete(metodo);
        el.classList.remove('selected');
    } else {
        metodosSeleccionados.add(metodo);
        el.classList.add('selected');
    }

    const infoEl = document.getElementById('metodosSeleccionados');
    if (metodosSeleccionados.size > 0) {
        infoEl.textContent = ' ' + [...metodosSeleccionados].join(' + ');
        infoEl.classList.add('visible');
    } else {
        infoEl.classList.remove('visible');
    }

    // NUEVO: Mostrar/Ocultar sección de voucher
    const seccionVoucher = document.getElementById('seccionVoucher');
    if (seccionVoucher) {
        // Mostrar referencia para todo MENOS Efectivo y Credito Motero
        const mostrarVoucher = [...metodosSeleccionados].some(m => !['Efectivo', 'Credito Motero'].includes(m));

        seccionVoucher.classList.toggle('visible', mostrarVoucher);

        if (!mostrarVoucher) {
            const vInput = document.getElementById('voucherCode');
            if (vInput) vInput.value = '';
        }
    }

    actualizarCredito();
    actualizarBotonVender();

    // Mostrar/Ocultar sección de pago a proveedor
    const seccionProv = document.getElementById('seccionPagoProveedor');
    if (seccionProv) {
        const mostrarProv = metodosSeleccionados.has('Pago Proveedor');
        seccionProv.style.display = mostrarProv ? 'block' : 'none';
        if (mostrarProv) cargarProveedoresInline();
    }
}

// Alias para compatibilidad con tienda digital
function toggleMetodoDigital(el) {
    toggleMetodo(el);
}

function actualizarCredito() {
    const tieneCredito = [...metodosSeleccionados].some(m => METODOS_CREDITO.includes(m));
    const datosCredito = document.getElementById('datosCredito');

    if (datosCredito) {
        // En tienda física, verificar destino
        const destino = document.getElementById('selectDestino')?.value || 'tienda';
        if (TIENDA.esDigital) {
            datosCredito.classList.toggle('visible', tieneCredito);
        } else {
            datosCredito.classList.toggle('visible', tieneCredito && destino === 'tienda');
        }
    }
}

function actualizarBotonVender() {
    const btn = document.getElementById('btnVender');
    if (btn) {
        btn.disabled = !cajaAbierta || carrito.length === 0 || metodosSeleccionados.size === 0;
    }
}

// ---------------------------------------------------------------
// REGISTRAR CLIENTE AUTOMÁTICAMENTE (TIENDA DIGITAL)
// ---------------------------------------------------------------
async function registrarClienteDigital() {
    // Solo para tienda digital
    if (!TIENDA.esDigital) return null;

    const nombre = document.getElementById('clienteNombre')?.value.trim();
    const telefono = document.getElementById('clienteTelefono')?.value.trim();
    const cedula = document.getElementById('clienteCedula')?.value.trim();
    const direccion = document.getElementById('direccionEnvio')?.value.trim();

    // Si no hay datos de cliente, retornar consumidor final
    if (!nombre || !telefono) return null;

    try {
        // Buscar si el cliente ya existe por cdula o telfono
        let { data: clienteExistente } = await db
            .from('clientes')
            .select('*')
            .or(`cedula.eq.${cedula}, telefono.eq.${telefono} `)
            .limit(1)
            .single();

        if (clienteExistente) {
            // Cliente ya existe, retornar su ID
            return clienteExistente;
        }

        // Cliente nuevo, registrar
        const { data: nuevoCliente, error } = await db
            .from('clientes')
            .insert({
                nombre: nombre,
                telefono: telefono,
                cedula: cedula || null,
                direccion: direccion || null,
                email: null,
                fecha_registro: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        // Enviar mensaje de bienvenida por WhatsApp
        if (nuevoCliente && telefono) {
            const mensaje = `¡Hola ${nombre} ! 🎉\n\nGracias por tu compra en * Moteros Sports Line * 🏍️\n\nTu pedido ha sido registrado exitosamente y será procesado para envío.\n\n¿Tienes alguna pregunta? ¡Estamos aquí para ayudarte!\n\n_Moteros Sports Line - Tu tienda de confianza_ 🏍️`;
            // Log removido por seguridad (opcional, se puede comentar si no se desea)
            // window.open(urlWhatsApp, '_blank');


        }

        return nuevoCliente;
    } catch (error) {
        console.error('Error registrando cliente:', error);
        return null;
    }
}

// ---------------------------------------------------------------
// PROCESAR VENTA (TIENDA FÍSICA)
// ---------------------------------------------------------------
async function procesarVenta() {
    if (!cajaAbierta) return mostrarAlerta(' Primero abre la caja', 'error');
    if (carrito.length === 0) return mostrarAlerta('El carrito está vacío', 'error');
    if (metodosSeleccionados.size === 0) return mostrarAlerta('Selecciona al menos un método de pago', 'error');

    const destino = document.getElementById('selectDestino')?.value || 'tienda';
    const tieneCredito = [...metodosSeleccionados].some(m => METODOS_CREDITO.includes(m));

    // Validar datos de crédito
    if (destino === 'tienda' && tieneCredito) {
        const nombre = document.getElementById('creditoNombre')?.value.trim();
        const telefono = document.getElementById('creditoTelefono')?.value.trim();
        const cedula = document.getElementById('creditoCedula')?.value.trim();
        const direccion = document.getElementById('creditoDireccion')?.value.trim();
        const autoriza = document.getElementById('creditoAutoriza')?.value;

        if (!nombre || !telefono || !cedula || !direccion || !autoriza) {
            return mostrarAlerta('Completa todos los datos del crédito', 'error');
        }
    }

    const btnVender = document.getElementById('btnVender');
    btnVender.disabled = true;
    btnVender.innerHTML = 'Procesando...';

    const localRegistro = destino === 'digital' ? `Digital (${TIENDA.nombre})` : TIENDA.nombre;
    const metodoPagoStr = [...metodosSeleccionados].join(' + ');

    try {
        for (const item of carrito) {
            const fechaPersonalizadaInput = document.getElementById('fechaPersonalizada');
            const fechaVenta = (fechaPersonalizadaInput && fechaPersonalizadaInput.value)
                ? new Date(fechaPersonalizadaInput.value).toISOString()
                : new Date().toISOString();

            // Si hay una fecha personalizada, ajustar también el ID para que sea más único/rastreable
            const timestampId = (fechaPersonalizadaInput && fechaPersonalizadaInput.value)
                ? new Date(fechaPersonalizadaInput.value).getTime()
                : Date.now();

            // Determinar local real:
            // 1. Si el item ya trae tiendaOrigen (porque se eligió con botón específico), usar esa.
            // 2. Si no, usar el selector global del Admin POS.
            // 3. Fallback al localRegistro standard.
            const origenReal = item.tiendaOrigen || document.getElementById('origenVentaReal')?.value || localRegistro;

            const id_venta = 'V' + timestampId + Math.random().toString(36).substr(2, 5).toUpperCase();

            const voucherCode = document.getElementById('voucherCode')?.value.trim() || null;

            // Registrar cliente automáticamente si es tienda digital
            let clienteDigital = null;
            if (TIENDA.esDigital) {
                clienteDigital = await registrarClienteDigital();
            }

            // Obtener datos del cliente seleccionado o del cliente digital registrado
            const clienteId = clienteDigital?.id || clienteSeleccionado?.id || 1; // 1 = Consumidor Final
            // Calcular descuento de cliente
            let descuentoValor = 0;
            let descuentoMotivo = null;
            let totalItem = item.precio * item.cantidad; // Precio base (ya puede tener promo de producto)

            if (clienteSeleccionado?.promocion?.descuento_porcentaje) {
                const pct = clienteSeleccionado.promocion.descuento_porcentaje;
                const montoDesc = Math.round(totalItem * (pct / 100));
                descuentoValor = montoDesc;
                descuentoMotivo = `Promo Cliente: ${pct}% - ${clienteSeleccionado.promocion.promocion_id}`; // Usar ID o Nombre si se tuviera
                totalItem = totalItem - descuentoValor;
            }

            const { error: errorVenta } = await db.from('ventas').insert({
                id_venta: id_venta,
                local: origenReal,
                id_producto: item.id_producto,
                nombre_producto: item.nombre,
                cantidad: item.cantidad,
                precio_unitario: item.precio, // Precio unitario base de la línea
                total: totalItem, // Total con descuento aplicado
                descuento_valor: descuentoValor,
                descuento_motivo: descuentoMotivo,
                metodo_pago: metodoPagoStr,
                voucher_code: voucherCode,
                usuario: `POS ${TIENDA.nombre}`,
                id_evento: TIENDA.id_evento || null,
                created_at: fechaVenta,
                cliente_id: clienteId,
                imprime_tirilla: imprimeTirilla
            });

            if (errorVenta) {
                // MODO OFFLINE: Si falla por red, intentar encolar localmente
                if (!navigator.onLine && window.OfflineManager) {
                    console.warn('Offline: Venta fallá en Supabase, encolando localmente...');
                    const ventaOffline = {
                        id_venta: id_venta,
                        local: origenReal,
                        id_producto: item.id_producto,
                        nombre_producto: item.nombre,
                        cantidad: item.cantidad,
                        precio_unitario: item.precio,
                        total: totalItem,
                        descuento_valor: descuentoValor,
                        descuento_motivo: descuentoMotivo,
                        metodo_pago: metodoPagoStr,
                        voucher_code: voucherCode,
                        usuario: `POS ${TIENDA.nombre}`,
                        id_evento: TIENDA.id_evento || null,
                        created_at: fechaVenta,
                        cliente_id: clienteId,
                        imprime_tirilla: imprimeTirilla
                    };
                    await window.OfflineManager.encolarVenta(ventaOffline);

                    // Notificar pero continuar con el siguiente item (o el flujo de limpieza)
                    mostrarAlerta('Venta guardada localmente (Sin internet)', 'info');
                } else {
                    throw new Error(errorVenta.message);
                }
            }

            // Descontar stock SOLO si está marcado o si no existe el checkbox (comportamiento normal)
            const checkInventario = document.getElementById('afectarInventario');
            const debeAfectarInventario = !checkInventario || checkInventario.checked;

            if (debeAfectarInventario) {
                const { data: stockActual } = await db
                    .from(TIENDA.tablaInventario)
                    .select('cantidad')
                    .eq('id_producto', item.id_producto)
                    .single();

                if (stockActual) {
                    await db.from(TIENDA.tablaInventario)
                        .update({ cantidad: Math.max(0, stockActual.cantidad - item.cantidad) })
                        .eq('id_producto', item.id_producto);
                }
            }

            // Si es digital, agregar al inventario digital
            if (destino === 'digital') {
                const { data: stockDig } = await db
                    .from('inventario_digital')
                    .select('cantidad')
                    .eq('id_producto', item.id_producto)
                    .single();

                if (stockDig) {
                    await db.from('inventario_digital')
                        .update({ cantidad: stockDig.cantidad + item.cantidad })
                        .eq('id_producto', item.id_producto);
                } else {
                    await db.from('inventario_digital')
                        .insert({ id_producto: item.id_producto, cantidad: item.cantidad, stock_minimo: 0 });
                }
            }
        }

        // Calcular TOTAL FINAL (con descuento de cliente aplicado)
        let subtotalVenta = carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
        let descuentoTotalCliente = 0;
        if (clienteSeleccionado?.promocion?.descuento_porcentaje) {
            descuentoTotalCliente = Math.round(subtotalVenta * (clienteSeleccionado.promocion.descuento_porcentaje / 100));
        }
        const total = subtotalVenta - descuentoTotalCliente;

        // Si es Crédito Motero, registrar en tabla creditos_motero
        if (destino === 'tienda' && metodosSeleccionados.has('Credito Motero')) {
            const nombre = document.getElementById('creditoNombre')?.value.trim() || 'Sin nombre';
            const telefono = document.getElementById('creditoTelefono')?.value.trim() || '';
            const cedula = document.getElementById('creditoCedula')?.value.trim() || '';
            const direccion = document.getElementById('creditoDireccion')?.value.trim() || '';
            const autoriza = document.getElementById('creditoAutoriza')?.value || 'No especificado';
            const cuotas = parseInt(document.getElementById('creditoCuotas')?.value) || 1;

            // Generar número de crédito único con nombre
            const nombreCorto = nombre.split(' ')[0].toUpperCase().substring(0, 10);
            const numeroCredito = 'CM-' + Date.now().toString(36).toUpperCase() + '-' + nombreCorto;

            // Calcular fecha de vencimiento (cuotas * 30 días)
            const fechaVencimiento = new Date();
            fechaVencimiento.setDate(fechaVencimiento.getDate() + (cuotas * 30));

            const valorCuota = Math.ceil(total / cuotas);

            // Formato de notas parseable: Crédito: NOMBRE | CC: xxx | Tel: xxx | Dir: xxx
            const productosLista = carrito.map(i => `${i.nombre} x${i.cantidad}`).join(', ');
            const notasCredito = `Crédito: ${nombre} | CC: ${cedula} | Tel: ${telefono} | Dir: ${direccion} | Autoriza: ${autoriza} | Productos: ${productosLista}`;

            // Insertar el crédito (sin vincular a clientes_credito ya que no existe la tabla)
            const { error: errorCredito } = await db.from('creditos_motero').insert({
                numero_credito: numeroCredito,
                cliente_id: null,
                local_origen: TIENDA.nombre,
                monto_total: total,
                numero_cuotas: cuotas,
                valor_cuota: valorCuota,
                fecha_vencimiento: fechaVencimiento.toISOString().split('T')[0],
                saldo_pendiente: total,
                estado: 'activo',
                notas: notasCredito
            });

            if (errorCredito) {
                console.error('Error registrando crédito:', errorCredito);
                mostrarAlerta(' Venta ok, pero error al registrar crédito: ' + errorCredito.message, 'warning');
            } else {
            }
        }

        const msg = destino === 'digital'
            ? ` Transferido a Digital: $${total.toLocaleString('es-CO')}`
            : ` Venta exitosa: $${total.toLocaleString('es-CO')}`;

        if (window.moterosIA) {
            window.moterosIA.aprenderEvento('Venta realizada en tienda', {
                tienda: TIENDA.nombre,
                total: total,
                items: carrito.length
            });
        }

        mostrarAlerta(msg, 'success');

        // Actualizar estadísticas del cliente si no es Consumidor Final
        if (clienteId && clienteId !== 1) {
            await actualizarEstadisticasCliente(clienteId, total);
        }

        limpiarDespuesVenta();
        await cargarProductos();

        // Imprimir tirilla si se solicitó (y si no es digital, aunque digital podría imprimir PDF)
        if (imprimeTirilla && destino !== 'digital') {
            const clienteInfo = clienteId && clienteId !== 1 ? (clienteDigital || clienteSeleccionado) : null;
            imprimirTicketVenta(carrito, total, id_venta, clienteInfo, metodoPagoStr);
        }

    } catch (error) {
        console.error('Error procesando venta:', error);
        mostrarAlerta('Error procesando venta: ' + error.message, 'error');
    }

    btnVender.innerHTML = ' Procesar Venta';
    actualizarBotonVender();
}

// ---------------------------------------------------------------
// IMPRIMIR TICKET DE VENTA
// ---------------------------------------------------------------
function imprimirTicketVenta(items, total, idVenta, cliente, metodoPago) {
    if (!window.TicketPrinter) {
        alert('Error: Módulo de impresión no cargado');
        return;
    }

    let htmlCliente = '';
    if (cliente) {
        htmlCliente = `
            <div class="divider"></div>
            <div><strong>CLIENTE:</strong> ${cliente.nombre}</div>
            <div><strong>CC/NIT:</strong> ${cliente.cedula || 'N/A'}</div>
            <div><strong>TEL:</strong> ${cliente.telefono || 'N/A'}</div>
            ${cliente.direccion ? `<div><strong>DIR:</strong> ${cliente.direccion}</div>` : ''}
        `;
    } else {
        htmlCliente = `
            <div class="divider"></div>
            <div><strong>CLIENTE:</strong> CONSUMIDOR FINAL</div>
        `;
    }

    let htmlItems = `
        <table>
            <thead>
                <tr>
                    <th>DESCRIPCION</th>
                    <th class="text-center">CANT</th>
                    <th class="text-right">TOTAL</th>
                </tr>
            </thead>
            <tbody>
    `;

    items.forEach(item => {
        htmlItems += `
            <tr>
                <td>${item.nombre}</td>
                <td class="text-center">${item.cantidad}</td>
                <td class="text-right">$${(item.precio * item.cantidad).toLocaleString('es-CO')}</td>
            </tr>
        `;
    });

    htmlItems += `
            </tbody>
        </table>
        <div class="divider"></div>
        <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:14px;">
            <span>TOTAL A PAGAR:</span>
            <span>$${total.toLocaleString('es-CO')}</span>
        </div>
        <div style="margin-top:5px; font-size:11px;">
            METODO DE PAGO: ${metodoPago}
        </div>
        <div style="font-size:11px;">
            ${idVenta}
        </div>
    `;

    const contenido = htmlCliente + htmlItems;

    // Firma opcional (footer del ticket)
    const firma = '¡Gracias por su compra!<br>Regrese pronto';

    TicketPrinter.print('FACTURA DE VENTA', contenido, firma);
}

// ---------------------------------------------------------------
// PROCESAR VENTA (TIENDA DIGITAL) + CREAR ENVÍO
// ---------------------------------------------------------------
async function procesarVentaDigital() {
    if (!cajaAbierta) return mostrarAlerta('Abre la caja', 'error');
    if (carrito.length === 0) return mostrarAlerta('Pedido vacío', 'error');
    if (metodosSeleccionados.size === 0) return mostrarAlerta('Selecciona método de pago', 'error');

    // Validar datos de envío (obligatorios para digital)
    const clienteNombre = document.getElementById('clienteNombre').value.trim();
    const clienteTelefono = document.getElementById('clienteTelefono').value.trim();
    const clienteCedula = document.getElementById('clienteCedula').value.trim();
    const direccionEnvio = document.getElementById('direccionEnvio').value.trim();
    const ciudadEnvio = document.getElementById('ciudadEnvio').value.trim();
    const departamentoEnvio = document.getElementById('departamentoEnvio').value;
    const notasEnvio = document.getElementById('notasEnvio').value.trim();

    if (!clienteNombre || !clienteTelefono || !clienteCedula || !direccionEnvio || !ciudadEnvio || !departamentoEnvio) {
        return mostrarAlerta('⚠️ Completa todos los datos de envío', 'error');
    }

    // Validar crédito
    const tieneCredito = [...metodosSeleccionados].some(m => METODOS_CREDITO.includes(m));
    let creditoAutoriza = '';
    let creditoCuotas = 1;

    if (tieneCredito) {
        creditoAutoriza = document.getElementById('creditoAutoriza').value;
        creditoCuotas = parseInt(document.getElementById('creditoCuotas').value) || 1;
        if (!creditoAutoriza) return mostrarAlerta('⚠️ Selecciona quién autoriza el crédito', 'error');
    }

    const btnVender = document.getElementById('btnVender');
    btnVender.disabled = true;
    btnVender.innerHTML = '⏳​ Procesando...';

    const metodoPagoStr = [...metodosSeleccionados].join(' + ');
    const pedidoTimestamp = Date.now();
    let primerIdVenta = null;

    try {
        for (const item of carrito) {
            const id_venta = 'VD' + pedidoTimestamp + Math.random().toString(36).substr(2, 5).toUpperCase();
            if (!primerIdVenta) primerIdVenta = id_venta;

            const tieneDescuento = item.precio < item.precioOriginal;

            const voucherCode = document.getElementById('voucherCode')?.value.trim() || null;

            const ventaData = {
                id_venta: id_venta,
                local: 'Digital',
                id_producto: item.id_producto,
                nombre_producto: item.nombre,
                cantidad: item.cantidad,
                precio_unitario: item.precio,
                total: item.precio * item.cantidad,
                metodo_pago: metodoPagoStr,
                voucher_code: voucherCode,
                usuario: 'POS Digital',
                cliente_nombre: clienteNombre,
                cliente_telefono: clienteTelefono,
                cliente_cedula: clienteCedula,
                direccion_envio: direccionEnvio,
                ciudad_envio: ciudadEnvio,
                departamento_envio: departamentoEnvio,
                notas_envio: notasEnvio,
                estado_envio: 'Pendiente',
                tipo_venta: 'Digital',
                estado_venta: 'Completada',
                precio_original: item.precioOriginal,
                descuento_valor: tieneDescuento ? (item.precioOriginal - item.precio) : 0,
                descuento_motivo: item.motivo || null,
                descuento_autorizado_por: tieneDescuento ? item.motivo.split('-')[0]?.trim() : null,
                es_credito: tieneCredito,
                credito_autorizado_por: tieneCredito ? creditoAutoriza : null,
                credito_cuotas: tieneCredito ? creditoCuotas : 0,
                credito_estado: tieneCredito ? 'Pendiente' : null,
                id_evento: TIENDA.id_evento || null
            };

            const { error } = await db.from('ventas').insert(ventaData);
            if (error) throw new Error(error.message);

            // Descontar stock de la tienda de origen
            if (item.tiendaOrigen) {
                const tablaDestino =
                    item.tiendaOrigen === 'Alcalá' ? 'inventario_alcala' :
                        item.tiendaOrigen === 'Local 01' ? 'inventario_01' :
                            'inventario_jordan';

                const { data: stockActual } = await db
                    .from(tablaDestino)
                    .select('cantidad')
                    .eq('id_producto', item.id_producto)
                    .single();

                if (stockActual) {
                    await db.from(tablaDestino)
                        .update({ cantidad: Math.max(0, stockActual.cantidad - item.cantidad) })
                        .eq('id_producto', item.id_producto);
                }
            } else {
                // Fallback por si acaso (no debería ocurrir en nueva logica)
                console.warn('Item digital sin tienda origen:', item);
            }
        }

        // ---------------------------------------------------------------
        // CREAR ENVIO AUTOMATICO EN TABLA envios
        // ---------------------------------------------------------------
        const totalPedido = carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
        const productosDescripcion = carrito.map(i => `${i.cantidad}x ${i.nombre}`).join(', ');

        const envioData = {
            venta_id: primerIdVenta,
            cliente_nombre: clienteNombre,
            cliente_telefono: clienteTelefono,
            cliente_cedula: clienteCedula,
            cliente_email: null,
            direccion_envio: direccionEnvio,
            ciudad: ciudadEnvio,
            departamento: departamentoEnvio,
            estado: 'pendiente',
            fecha_venta: new Date().toISOString(),
            productos_descripcion: productosDescripcion,
            total_pedido: totalPedido,
            notas: notasEnvio || null,
            transportadora: null,
            numero_guia: null,
            url_tracking: null,
            costo_envio: 0,
            envio_incluido: false,
            cliente_paga_envio: true
        };

        const { error: errorEnvio } = await db.from('envios').insert(envioData);
        if (errorEnvio) {
            console.error('Error creando envío:', errorEnvio);
            // No interrumpir - la venta ya se registró
        }
        // ---------------------------------------------------------------

        const total = carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);

        if (window.moterosIA) {
            window.moterosIA.aprenderEvento('Pedido digital registrado', {
                cliente: clienteNombre,
                total: total,
                items: carrito.length
            });
        }

        mostrarAlerta(`Pedido registrado: $${total.toLocaleString('es-CO')}`, 'success');

        limpiarDespuesVentaDigital();
        await cargarProductos();

    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error: ' + error.message, 'error');
    }

    btnVender.innerHTML = ' Registrar Pedido';
    actualizarBotonVender();
}

// ---------------------------------------------------------------
// LIMPIAR DESPUES DE VENTA
// ---------------------------------------------------------------
function limpiarDespuesVenta() {
    carrito = [];
    metodosSeleccionados.clear();
    document.querySelectorAll('.metodo-btn').forEach(m => m.classList.remove('selected'));
    document.getElementById('metodosSeleccionados')?.classList.remove('visible');
    const sV = document.getElementById('seccionVoucher');
    if (sV) sV.classList.remove('visible');
    const vI = document.getElementById('voucherCode');
    if (vI) vI.value = '';
    limpiarFormCredito();

    // Limpiar datos de cliente
    if (tipoClienteActual === 'registrado') {
        limpiarInfoCliente();
        const inputCedula = document.getElementById('inputCedulaCliente');
        if (inputCedula) inputCedula.value = '';
    }
    const checkTirilla = document.getElementById('checkImprimirTirilla');
    if (checkTirilla) checkTirilla.checked = false;

    // Resetear a Consumidor Final
    seleccionarTipoCliente('consumidor');

    renderizarCarrito();
}

function limpiarDespuesVentaDigital() {
    carrito = [];
    metodosSeleccionados.clear();
    document.querySelectorAll('.metodo-btn').forEach(m => m.classList.remove('selected'));
    document.getElementById('metodosSeleccionados')?.classList.remove('visible');
    document.getElementById('datosCredito')?.classList.remove('visible');
    const sV = document.getElementById('seccionVoucher');
    if (sV) sV.classList.remove('visible');
    const vI = document.getElementById('voucherCode');
    if (vI) vI.value = '';

    // Limpiar formulario envío
    ['clienteNombre', 'clienteTelefono', 'clienteCedula', 'direccionEnvio', 'ciudadEnvio', 'notasEnvio'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    const depEl = document.getElementById('departamentoEnvio');
    if (depEl) depEl.selectedIndex = 0;

    const credAutEl = document.getElementById('creditoAutoriza');
    if (credAutEl) credAutEl.selectedIndex = 0;

    const credCuotEl = document.getElementById('creditoCuotas');
    if (credCuotEl) credCuotEl.selectedIndex = 0;

    renderizarCarrito();
}

function limpiarFormCredito() {
    const campos = ['creditoNombre', 'creditoTelefono', 'creditoCedula', 'creditoDireccion'];
    campos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    const autoriza = document.getElementById('creditoAutoriza');
    if (autoriza) autoriza.selectedIndex = 0;

    const datosCredito = document.getElementById('datosCredito');
    if (datosCredito) datosCredito.classList.remove('visible');
}

// ---------------------------------------------------------------
// GESTIÓN DE CLIENTES
// ---------------------------------------------------------------

// Inicializar cliente predeterminado al cargar
document.addEventListener('DOMContentLoaded', () => {
    // Establecer Consumidor Final por defecto
    clienteSeleccionado = { id: 1, nombre: 'Consumidor Final', es_generico: true };
});

function seleccionarTipoCliente(tipo) {
    tipoClienteActual = tipo;

    const btnConsumidor = document.getElementById('btnConsumidorFinal');
    const btnRegistrado = document.getElementById('btnClienteRegistrado');
    const seccionBuscar = document.getElementById('seccionBuscarCliente');
    const seccionTirilla = document.getElementById('seccionImprimirTirilla');

    if (tipo === 'consumidor') {
        btnConsumidor?.classList.add('active');
        btnRegistrado?.classList.remove('active');
        if (seccionBuscar) seccionBuscar.style.display = 'none';
        if (seccionTirilla) seccionTirilla.style.display = 'none';
        clienteSeleccionado = { id: 1, nombre: 'Consumidor Final', es_generico: true };
    } else {
        btnConsumidor?.classList.remove('active');
        btnRegistrado?.classList.add('active');
        if (seccionBuscar) seccionBuscar.style.display = 'block';
        if (seccionTirilla) seccionTirilla.style.display = 'block';
        clienteSeleccionado = null;
        limpiarInfoCliente();
    }
}

async function buscarCliente() {
    const cedula = document.getElementById('inputCedulaCliente')?.value.trim();
    if (!cedula) {
        mostrarAlerta('Ingresa una cédula para buscar', 'warning');
        return;
    }

    try {
        const { data, error } = await db
            .from('clientes')
            .select('*')
            .eq('cedula', cedula)
            .eq('activo', true)
            .single();

        if (error || !data) {
            mostrarAlerta('Cliente no encontrado. Puedes registrarlo como nuevo.', 'info');
            limpiarInfoCliente();
            return;
        }

        // Buscar promoción activa
        const { data: promo } = await db
            .from('promociones_clientes')
            .select('descuento_porcentaje, promocion_id')
            .eq('cliente_id', data.id)
            .eq('activa', true)
            .gte('fecha_fin', new Date().toISOString().split('T')[0])
            .single();

        clienteSeleccionado = {
            id: data.id,
            nombre: data.nombre,
            telefono: data.telefono,
            cedula: data.cedula,
            numero_compras: data.numero_compras || 0,
            total_compras: data.total_compras || 0,
            promocion: promo || null
        };

        mostrarInfoCliente(data, promo);
        mostrarAlerta(`? Cliente encontrado: ${data.nombre}`, 'success');

        // ------------ SUGERIR PROMOCIONES ------------
        if (window.PromocionesManager) {
            const sugerencias = await PromocionesManager.sugerirPromocionesCliente(data);
            if (sugerencias.length > 0) {
                mostrarBotonSugerencia(sugerencias, data.id);
            } else {
                ocultarBotonSugerencia();
            }
        }

    } catch (error) {
        console.error('Error buscando cliente:', error);
        mostrarAlerta('Error al buscar cliente', 'error');
    }
}

function mostrarBotonSugerencia(sugerencias, clienteId) {
    let container = document.getElementById('containerSugerenciaPromo');
    if (!container) {
        const infoDiv = document.querySelector('#infoClienteEncontrado'); // Corrección selector
        container = document.createElement('div');
        container.id = 'containerSugerenciaPromo';
        container.style.marginTop = '10px';
        infoDiv.appendChild(container);
    }

    container.innerHTML = `
        <button onclick='window.abrirModalSugerencia(${JSON.stringify(sugerencias)}, ${clienteId})' 
                class="btn btn-warning" style="width:100%; animation: pulse 2s infinite;">
            🎉 ¡Tienes ${sugerencias.length} Oferta(s) Disponible(s)!
        </button>
    `;
    container.style.display = 'block';
}

function ocultarBotonSugerencia() {
    const container = document.getElementById('containerSugerenciaPromo');
    if (container) container.style.display = 'none';
}

// Global para que funcione en onclick
window.abrirModalSugerencia = function (sugerencias, clienteId) {
    const sug = sugerencias[0]; // Por ahora mostramos la primera
    const confirmacion = confirm(`
? OFERTA SUGERIDA ?

Cliente cumple: ${sug.regla}
Motivo: ${sug.motivo}

🎉 Promoción: ${sug.promocion.nombre}
➖ Descuento: ${sug.promocion.descuento}%

AUTORIZAR y aplicar esta promoción al cliente?
(Requiere autorización de Admin)
    `);

    if (confirmacion) {
        autorizarPromocion(clienteId, sug.promocion.id_promo);
    }
};

async function autorizarPromocion(clienteId, promoId) {
    // Aquí se podría pedir clave de admin
    /* const pass = prompt("🔒 Clave de Administrador:");
       if (pass !== "1234") return alert("Clave incorrecta"); */

    try {
        await PromocionesManager.asignarPromocionCliente(clienteId, promoId, 'Admin POS');
        alert("🎉 Promoción asignada correctamente. El cliente debe volver a ser cargado.");
        limpiarInfoCliente(); // Forzar recarga
        document.getElementById('inputCedulaCliente').value = document.getElementById('clienteCedulaDisplay').textContent.replace('📄​ ', '').trim();
        buscarCliente(); // Recargar
    } catch (e) {
        console.error(e);
        alert("⚠️​ Error asignando promoción");
    }
}

function mostrarInfoCliente(cliente, promocion) {
    const infoDiv = document.getElementById('infoClienteEncontrado');
    if (!infoDiv) return;

    document.getElementById('clienteSeleccionadoId').value = cliente.id;
    document.getElementById('clienteNombreDisplay').textContent = cliente.nombre;
    document.getElementById('clienteTelefonoDisplay').textContent = `📱​ ${cliente.telefono || 'N/A'}`;
    document.getElementById('clienteCedulaDisplay').textContent = `📄​ ${cliente.cedula || 'N/A'}`;

    // Mostrar estadísticas
    const estadisticasEl = document.getElementById('clienteEstadisticasDisplay');
    if (estadisticasEl) {
        estadisticasEl.textContent = `${cliente.numero_compras || 0} compras | $${(cliente.total_compras || 0).toLocaleString('es-CO')} total`;
    }

    // Mostrar promoción si existe
    const promoDiv = document.getElementById('clientePromoDisplay');
    if (promoDiv) {
        if (promocion) {
            document.getElementById('clientePromoDescuento').textContent = `${promocion.descuento_porcentaje}% OFF`;
            promoDiv.style.display = 'block';
        } else {
            promoDiv.style.display = 'none';
        }
    }

    infoDiv.style.display = 'block';
}

function limpiarInfoCliente() {
    const infoDiv = document.getElementById('infoClienteEncontrado');
    if (infoDiv) infoDiv.style.display = 'none';
    const idInput = document.getElementById('clienteSeleccionadoId');
    if (idInput) idInput.value = '';
    clienteSeleccionado = null;
}

function abrirModalRegistroCliente() {
    const modal = document.getElementById('modalRegistroCliente');
    if (modal) {
        modal.classList.add('visible');
        modal.style.display = 'flex';
        // Limpiar campos
        ['nuevoClienteNombre', 'nuevoClienteTelefono', 'nuevoClienteCedula', 'nuevoClienteDireccion', 'nuevoClienteEmail'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        // Focus en nombre
        setTimeout(() => document.getElementById('nuevoClienteNombre')?.focus(), 100);
    }
}

function cerrarModal() {
    const modal = document.getElementById('modalRegistroCliente');
    if (modal) {
        modal.classList.remove('visible');
        modal.style.display = 'none';
    }
}

async function guardarNuevoCliente() {
    const nombre = document.getElementById('nuevoClienteNombre')?.value.trim();
    const telefono = document.getElementById('nuevoClienteTelefono')?.value.trim();
    const cedula = document.getElementById('nuevoClienteCedula')?.value.trim();
    const direccion = document.getElementById('nuevoClienteDireccion')?.value.trim();
    const email = document.getElementById('nuevoClienteEmail')?.value.trim();

    // Validar campos obligatorios
    if (!nombre || !telefono) {
        mostrarAlerta('Nombre y Teléfono son obligatorios', 'error');
        return;
    }

    try {
        const { data, error } = await db
            .from('clientes')
            .insert({
                nombre,
                telefono,
                cedula: cedula || null,
                direccion: direccion || null,
                email: email || null,
                es_generico: false,
                activo: true,
                fecha_registro: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        clienteSeleccionado = {
            id: data.id,
            nombre: data.nombre,
            telefono: data.telefono,
            cedula: data.cedula,
            numero_compras: 0,
            total_compras: 0,
            promocion: null
        };

        mostrarInfoCliente(data, null);
        cerrarModal();
        mostrarAlerta(`? Cliente registrado: ${nombre}`, 'success');

        // Limpiar formulario
        ['nuevoClienteNombre', 'nuevoClienteTelefono', 'nuevoClienteCedula', 'nuevoClienteDireccion', 'nuevoClienteEmail'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        // Enviar mensaje de bienvenida
        enviarWhatsAppBienvenida(data);

    } catch (error) {
        console.error('Error guardando cliente:', error);
        mostrarAlerta('Error al guardar cliente: ' + error.message, 'error');
    }
}

function enviarWhatsAppBienvenida(cliente) {
    const mensaje = `¡Hola ${cliente.nombre}! 👋​

Bienvenido a Moteros Sports Line! 🏍️​

Gracias por tu compra de hoy. Ahora eres parte de nuestra familia motera.

Como cliente registrado disfrutarás de:
🎁 Promociones exclusivas
➖ Descuentos especiales
🏍️​ Crédito Motero
⚠️ Atención prioritaria

¡Nos vemos pronto!

Moteros Sports Line
📍 Villavicencio - Meta
📞 3113408416
🌐 https://moterossportline.store`;

    const telefonoLimpio = cliente.telefono.replace(/\D/g, '');
    const url = `https://wa.me/57${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

async function actualizarEstadisticasCliente(clienteId, montoVenta) {
    if (!clienteId || clienteId === 1) return; // No actualizar para Consumidor Final

    try {
        const { data: cliente } = await db
            .from('clientes')
            .select('total_compras, numero_compras')
            .eq('id', clienteId)
            .single();

        if (cliente) {
            await db
                .from('clientes')
                .update({
                    total_compras: (cliente.total_compras || 0) + montoVenta,
                    numero_compras: (cliente.numero_compras || 0) + 1,
                    ultima_compra: new Date().toISOString()
                })
                .eq('id', clienteId);
        }
    } catch (error) {
        console.error('Error actualizando estadísticas:', error);
    }
}

// ---------------------------------------------------------------
// MODALES Y ALERTAS
// ---------------------------------------------------------------
function cerrarModal() {
    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.classList.remove('visible');
        m.style.display = '';
    });
}

function mostrarAlerta(mensaje, tipo = 'success') {
    const container = document.getElementById('alertas');
    if (!container) return;

    const alerta = document.createElement('div');
    alerta.className = `alerta alerta-${tipo}`;
    alerta.innerHTML = mensaje;
    container.appendChild(alerta);

    setTimeout(() => {
        alerta.style.opacity = '0';
        alerta.style.transform = 'translateX(100%)';
        setTimeout(() => alerta.remove(), 300);
    }, 4000);
}

// Cerrar modales con Escape
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') cerrarModal();
});

// Click fuera del modal para cerrar
document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) {
        cerrarModal();
    }
});
// ---------------------------------------------------------------
// GESTION DE VARIANTES (POS)
// ---------------------------------------------------------------

// Inyectar modal de variantes al cargar
document.addEventListener('DOMContentLoaded', () => {
    const modalHTML = `
    <div id="modalSeleccionVariante" class="modal-overlay">
        <div class="modal" style="max-width: 500px;">
            <h3>" Seleccionar Variante</h3>
            <p id="nombreProductoVariante" style="font-weight:600; margin-bottom:1rem; color:var(--primary);"></p>
            
            <div id="contenedorOpcionesVariante" style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:20px;">
                <!-- Opciones dinámicas -->
            </div>

            <div class="modal-botones">
                <button class="btn btn-danger" onclick="cerrarModalVariante()"❌Cancelar</button>
            </div>
        </div>
    </div>
    <style>
        .chip-variante {
            padding: 10px 15px;
            border: 2px solid #e2e8f0;
            border-radius: 20px;
            background: white;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
        }
        .chip-variante:hover {
            border-color: var(--primary);
            background: #fff7ed;
        }
        .chip-variante.selected {
            background: var(--primary);
            color: white;
            border-color: var(--primary);
        }
    </style>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
});

function cerrarModalVariante() {
    const modal = document.getElementById('modalSeleccionVariante');
    if (modal) {
        modal.classList.remove('visible');
        modal.style.display = ''; // Limpiar estilo inline
    }
    productoParaVariante = null;
}

// Interceptar o manejar clicks para agregar
// NOTA: Esta función se debe llamar desde el renderizado de productos
function iniciarSeleccionVariante(producto) {
    productoParaVariante = producto;
    const modal = document.getElementById('modalSeleccionVariante');
    const titulo = document.getElementById('nombreProductoVariante');
    const contenedor = document.getElementById('contenedorOpcionesVariante');

    titulo.textContent = producto.nombre;
    contenedor.innerHTML = '';

    // Obtener opciones de 'variantes' (array) o 'stock_variantes' (objeto antiguo)
    const opciones = Array.isArray(producto.variantes) ? producto.variantes : Object.keys(producto.stock_variantes || {});
    const stockVar = producto.stock_variantes || {};

    if (opciones.length === 0) {
        // Fallback si no hay stock definido pero hay variantes teóricas
        contenedor.innerHTML = '<p class="text-danger"> No hay stock detallado para inventario. Se agregar como genérico.</p>';
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-full';
        btn.textContent = 'Agregar Genérico';
        btn.onclick = () => { confirmAgregarVariante(null); };
        contenedor.appendChild(btn);
    } else {
        opciones.forEach(opcion => {
            const btn = document.createElement('div');
            btn.className = 'chip-variante';
            const hasStockInfo = stockVar[opcion] !== undefined;
            btn.textContent = hasStockInfo ? `${opcion.replace(/-/g, ' ')} (Stock: ${stockVar[opcion]})` : opcion.replace(/-/g, ' ');
            btn.onclick = () => confirmAgregarVariante(opcion);
            contenedor.appendChild(btn);
        });
    }

    modal.classList.add('visible');
    modal.style.display = 'flex';
}

function confirmAgregarVariante(varianteNombre) {
    if (!productoParaVariante) return;
    agregarAlCarrito(productoParaVariante.id_producto, varianteNombre); // Corregido: pasar id_producto
    cerrarModalVariante();
}

// Modificar agregarAlCarrito existente o crear uno nuevo que soporte variantes
// Buscaremos la función agregarAlCarrito original para reemplazarla o sobrecargarla

// ---------------------------------------------------------------
// 
// TRASLADOS ENTRE TIENDAS
// 

async function abrirModalTraslado() {
    if (!cajaAbierta) return mostrarAlerta('⚠️ Abre la caja primero', 'error');

    try {
        // 1. Cargar inventario con cantidad > 0 (Incluyendo Talla)
        const { data: inventario, error: errorInv } = await db
            .from(TIENDA.tablaInventario)
            .select('id, id_producto, cantidad, talla') // Seleccionamos ID fila y Talla
            .gt('cantidad', 0);

        if (errorInv) throw errorInv;

        if (!inventario || inventario.length === 0) {
            mostrarAlerta('No hay productos con stock para trasladar', 'warning');
            return;
        }

        const ids = inventario.map(i => i.id_producto);
        const { data: detallesProductos } = await db
            .from('productos')
            .select('id_producto, nombre, marca')
            .in('id_producto', ids)
            .eq('estado', 'Activo');

        const productosMap = {};
        (detallesProductos || []).forEach(p => productosMap[p.id_producto] = p);

        const select = document.getElementById('trasladoProducto');
        select.innerHTML = '<option value="">Selecciona un producto...</option>';

        const itemsCombinados = inventario.map(item => {
            const prod = productosMap[item.id_producto];
            return {
                id_inventario: item.id, // Usamos ID de fila para identificar unívocamente (prod + talla)
                id_producto: item.id_producto,
                talla: item.talla || 'única',
                cantidad: item.cantidad,
                nombre: prod ? prod.nombre : 'Producto ' + item.id_producto,
                marca: prod ? prod.marca : ''
            };
        }).sort((a, b) => a.nombre.localeCompare(b.nombre));

        itemsCombinados.forEach(item => {
            const option = document.createElement('option');
            // Usamos un valor compuesto para pasar todos los datos necesarios al procesar
            option.value = JSON.stringify({
                id_inventario: item.id_inventario,
                id_producto: item.id_producto,
                talla: item.talla
            });
            option.textContent = `${item.nombre} (${item.marca}) [${item.talla}] - Stock: ${item.cantidad}`;
            option.dataset.stock = item.cantidad;
            select.appendChild(option);
        });

        // 2. Cargar EVENTOS ACTIVOS como destinos adicionales
        const { data: eventosActivos } = await db.from('eventos_tienda').select('id, nombre_evento').eq('estado', 'Activo');

        const selectDestino = document.getElementById('trasladoDestino');
        // Limpiar para no duplicar si se abre varias veces
        selectDestino.innerHTML = `
            <option value="">Seleccionar...</option>
            <option value="Alcalá">Alcalá</option>
            <option value="01">Local 01</option>
            <option value="Jordán">Jordán</option>
            <option value="Digital">Digital</option>
            <option value="Evento">🎪​ Evento (Actual)</option>
        `;

        if (eventosActivos && eventosActivos.length > 0) {
            eventosActivos.forEach(ev => {
                // Si no es el evento actual (para evitar confusiones)
                const option = document.createElement('option');
                option.value = 'Evento:' + ev.id;
                option.textContent = '🎪​ ' + ev.nombre_evento;
                selectDestino.appendChild(option);
            });
        }

        // Filtrar destino actual (evitar trasladar a sí mismo)
        Array.from(selectDestino.options).forEach(opt => {
            if (opt.value === TIENDA.nombre || opt.value === TIENDA.nombre.replace('Local ', '')) {
                opt.disabled = true;
                opt.style.display = 'none';
            }
        });

        const modal = document.getElementById('modalTraslado');
        modal.classList.add('visible');
        modal.style.display = 'flex';

    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error cargando productos: ' + error.message, 'error');
    }
}

async function procesarTraslado() {
    const productoDataRaw = document.getElementById('trasladoProducto').value;
    const destino = document.getElementById('trasladoDestino').value;
    const cantidad = parseInt(document.getElementById('trasladoCantidad').value);

    if (!productoDataRaw || !destino || !cantidad || cantidad <= 0) {
        return mostrarAlerta('⚠️ Completa todos los campos', 'error');
    }

    // Parsear datos del producto seleccionado
    let productoData;
    try {
        productoData = JSON.parse(productoDataRaw);
    } catch (e) {
        return mostrarAlerta('Error en datos del producto', 'error');
    }

    const { id_inventario, id_producto, talla } = productoData;

    // Validar stock
    const selectProd = document.getElementById('trasladoProducto');
    const stockDisponible = parseInt(selectProd.selectedOptions[0].dataset.stock);

    if (cantidad > stockDisponible) {
        return mostrarAlerta(`Stock insuficiente. Disponible: ${stockDisponible}`, 'error');
    }

    try {
        // Determinar tabla destino
        let tablaDestino = '';
        let eventoActivoId = null;

        if (destino === 'Alcalá') tablaDestino = 'inventario_alcala';
        else if (destino === '01' || destino === 'Local 01') tablaDestino = 'inventario_01';
        else if (destino === 'Jordán') tablaDestino = 'inventario_jordan';
        else if (destino === 'Digital') tablaDestino = 'inventario_digital';
        else if (destino === 'Evento' || destino.startsWith('Evento:')) {
            tablaDestino = 'inventario_evento';
            if (destino.includes(':')) {
                eventoActivoId = destino.split(':')[1];
            }
        }

        if (!tablaDestino) return mostrarAlerta('Destino no válido', 'error');

        // 1. Descontar de inventario origen (Usando ID de fila específico para seguridad)
        // re-verificamos stock DB por seguridad
        const { data: stockOrigen } = await db
            .from(TIENDA.tablaInventario)
            .select('cantidad, productos(nombre)')
            .eq('id', id_inventario)
            .single();

        if (!stockOrigen) throw new Error('Producto no encontrado en inventario origen');
        if (stockOrigen.cantidad < cantidad) throw new Error('Stock insuficiente en BD');

        await db.from(TIENDA.tablaInventario)
            .update({ cantidad: stockOrigen.cantidad - cantidad })
            .eq('id', id_inventario);

        // 2. Sumar a inventario destino (Buscando por producto AND talla)
        const { data: stockDestino } = await db
            .from(tablaDestino)
            .select('id, cantidad')
            .eq('id_producto', id_producto)
            .eq('talla', talla) // Importante: Coincidir talla
            .maybeSingle();

        if (stockDestino) {
            await db.from(tablaDestino).update({ cantidad: stockDestino.cantidad + cantidad }).eq('id', stockDestino.id);
        } else {
            // Si no existe, creamos el registro con la talla correcta
            await db.from(tablaDestino).insert({
                id_producto: id_producto,
                cantidad: cantidad,
                talla: talla,
                stock_minimo: 0
            });
        }

        // 3. Registrar en tabla movimientos_transferencia (TABLA CORRECTA)
        try {
            const { error: errorTraslado } = await db.from('movimientos_transferencia').insert({
                id_producto: id_producto, // PROD...
                nombre_producto: stockOrigen.productos?.nombre || 'Producto',
                cantidad: cantidad,
                origen: TIENDA.nombre,
                destino: destino.includes(':') ? document.getElementById('trasladoDestino').selectedOptions[0].textContent : destino,
                usuario: (empleadoLogueado?.nombre || 'Usuario POS'),
                notas: 'Traslado desde POS ' + TIENDA.nombre,
                fecha: new Date().toISOString()
            });

            if (errorTraslado) throw errorTraslado;

        } catch (eLog) {
            console.error('Error logueando traslado en movimientos_transferencia:', eLog);
            mostrarAlerta('Traslado realizado pero error al guardar historial', 'warning');
        }

        mostrarAlerta('✅​ Traslado realizado con éxito', 'success');
        cerrarModal('modalTraslado');

        // Limpiar
        document.getElementById('trasladoDestino').value = '';
        document.getElementById('trasladoCantidad').value = '1';

        // Recargar inventario local
        cargarProductos();

    } catch (error) {
        console.error('Error en traslado:', error);
        mostrarAlerta(' Error: ' + error.message, 'error');
    }
}

// 
// PAGOS A PROVEEDORES (POS)
// 

let proveedoresCache = [];
let proveedorSeleccionado = null;

async function abrirModalProveedoresPOS() {
    if (!cajaAbierta) return mostrarAlerta('⚠️ Abre la caja primero', 'error');

    document.getElementById('modalProveedoresPOS').classList.add('visible');
    document.getElementById('modalProveedoresPOS').style.display = 'flex';

    await cargarProveedoresConSaldo();
}

async function cargarProveedoresConSaldo() {
    try {
        // Consultar proveedores con saldo pendiente > 0
        const { data, error } = await db
            .from('compras_proveedor')
            .select(`
                proveedor_id,
                saldo_pendiente,
                proveedores (
                    id,
                    razon_social,
                    banco,
                    tipo_cuenta,
                    numero_cuenta,
                    titular_cuenta
                )
            `)
            .gt('saldo_pendiente', 0);

        if (error) throw error;

        // Agrupar por proveedor y sumar saldos
        const proveedoresMap = {};
        data.forEach(compra => {
            const prov = compra.proveedores;
            if (!prov) return;

            if (!proveedoresMap[prov.id]) {
                proveedoresMap[prov.id] = {
                    id: prov.id,
                    nombre: prov.razon_social,
                    saldo: 0,
                    banco: prov.banco,
                    tipo_cuenta: prov.tipo_cuenta,
                    numero_cuenta: prov.numero_cuenta,
                    titular: prov.titular_cuenta
                };
            }
            proveedoresMap[prov.id].saldo += parseFloat(compra.saldo_pendiente || 0);
        });

        proveedoresCache = Object.values(proveedoresMap);
        renderizarProveedoresPOS();

    } catch (e) {
        console.error('Error cargando proveedores:', e);
        mostrarAlerta('Error cargando proveedores', 'error');
    }
}

function renderizarProveedoresPOS() {
    const tbody = document.getElementById('listaProveedoresPOS');

    if (proveedoresCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan=\"3\" style=\"text-align:center; color:#94a3b8;\"> No hay proveedores con saldo pendiente</td></tr>';
        return;
    }

    tbody.innerHTML = proveedoresCache.map(p => `
        <tr>
            <td>
                <strong>${p.nombre}</strong><br>
                <small style="color:#64748b; font-size:0.85rem;">
                    ${p.banco || ''} - ${p.tipo_cuenta || ''} ${p.numero_cuenta || ''}
                </small>
            </td>
            <td style="color:#ef4444; font-weight:600;">$${p.saldo.toLocaleString('es-CO')}</td>
            <td>
                <button class="btn btn-sm btn-success" onclick="abrirModalAbonoProveedor('${p.id}', '${p.nombre}', ${p.saldo}, '${p.banco || ''}', '${p.tipo_cuenta || ''}', '${p.numero_cuenta || ''}', '${p.titular || ''}')">
                     Pagar
                </button>
            </td>
        </tr>
    `).join('');
}

function filtrarProveedoresPOS() {
    const busqueda = document.getElementById('busquedaProveedorPOS').value.toLowerCase();
    const filas = document.querySelectorAll('#listaProveedoresPOS tr');

    filas.forEach(fila => {
        const texto = fila.textContent.toLowerCase();
        fila.style.display = texto.includes(busqueda) ? '' : 'none';
    });
}

function abrirModalAbonoProveedor(id, nombre, saldo, banco, tipoCuenta, numeroCuenta, titular) {
    proveedorSeleccionado = { id, nombre, saldo };

    document.getElementById('abonoProveedorId').value = id;
    document.getElementById('abonoProveedorNombre').value = nombre;
    document.getElementById('abonoNombreDisplay').textContent = nombre;
    document.getElementById('abonoSaldoDisplay').textContent = '$' + saldo.toLocaleString('es-CO');

    // Mostrar datos bancarios
    let datosBancarios = '';
    if (banco && banco !== 'null' && banco !== 'undefined') {
        datosBancarios = `
            <strong>Banco:</strong> ${banco}<br>
            <strong>Tipo:</strong> ${tipoCuenta}<br>
            <strong>Número:</strong> ${numeroCuenta}<br>
            <strong>Titular:</strong> ${titular}
        `;
    } else {
        datosBancarios = '<em style=\"color:#94a3b8;\">No hay datos bancarios registrados</em>';
    }
    document.getElementById('abonoBancoDisplay').innerHTML = datosBancarios;

    // Limpiar formulario
    document.getElementById('abonoMonto').value = '';
    document.getElementById('abonoMetodoPago').selectedIndex = 0;
    document.getElementById('abonoReferencia').value = '';
    document.getElementById('abonoNotas').value = '';

    document.getElementById('modalAbonoProveedor').classList.add('visible');
    document.getElementById('modalAbonoProveedor').style.display = 'flex';
}

async function confirmarAbonoProveedor() {
    const id = document.getElementById('abonoProveedorId').value;
    const monto = parseFloat(document.getElementById('abonoMonto').value);
    const metodo = document.getElementById('abonoMetodoPago').value;
    const referencia = document.getElementById('abonoReferencia').value.trim();
    const notas = document.getElementById('abonoNotas').value.trim();

    // Validaciones
    if (!monto || monto <= 0) {
        return mostrarAlerta(' ⚠️ Ingresa un monto válido', 'error');
    }

    if (!metodo) {
        return mostrarAlerta(' ⚠️ Selecciona el método de pago', 'error');
    }

    if (monto > proveedorSeleccionado.saldo) {
        return mostrarAlerta(`El monto no puede ser mayor al saldo ($${proveedorSeleccionado.saldo.toLocaleString('es-CO')})`, 'error');
    }

    try {
        // 1. Registrar el pago general en pagos_proveedor
        const { error: errorPago } = await db.from('pagos_proveedor').insert({
            proveedor_id: id,
            monto: monto,
            metodo_pago: metodo,
            referencia: referencia || null,
            fecha_pago: new Date().toISOString().split('T')[0],
            registrado_por: (empleadoLogueado?.nombre || 'POS') + ' - ' + TIENDA.nombre,
            local: TIENDA.nombre, // Nuevo campo para trazabilidad de cierre
            notas: notas || null
        });

        if (errorPago) throw errorPago;

        // 2. Descontar del saldo_pendiente de las compras (FIFO)
        let montoRestante = monto;

        // Obtener compras pendientes ordenadas por fecha (más antiguas primero)
        const { data: comprasPendientes } = await db
            .from('compras_proveedor')
            .select('id, saldo_pendiente')
            .eq('proveedor_id', id)
            .gt('saldo_pendiente', 0)
            .order('fecha_compra', { ascending: true });

        if (comprasPendientes) {
            for (const compra of comprasPendientes) {
                if (montoRestante <= 0) break;

                const saldoActual = parseFloat(compra.saldo_pendiente || 0);
                let rebaja = Math.min(montoRestante, saldoActual);
                let nuevoSaldo = saldoActual - rebaja;

                await db.from('compras_proveedor')
                    .update({
                        saldo_pendiente: nuevoSaldo,
                        estado: nuevoSaldo <= 0 ? 'PAGADO' : 'PENDIENTE'
                    })
                    .eq('id', compra.id);

                montoRestante -= rebaja;
            }
        }

        // 3. Actualizar saldo global en tabla proveedores (si existe la columna saldo_pendiente)
        try {
            const { data: prov } = await db.from('proveedores').select('saldo_pendiente').eq('id', id).single();
            if (prov) {
                const nuevoSaldoGlobal = Math.max(0, parseFloat(prov.saldo_pendiente || 0) - monto);
                await db.from('proveedores').update({ saldo_pendiente: nuevoSaldoGlobal }).eq('id', id);
            }
        } catch (e) {
            console.warn('No se pudo actualizar saldo global del proveedor:', e);
        }

        mostrarAlerta(`Pago de $${monto.toLocaleString('es-CO')} registrado y aplicado a facturas`, 'success');
        cerrarModalAbonoProveedor();
        await cargarProveedoresConSaldo(); // Recargar lista

        // Opcional: Agregar como gasto visualmente si se desea
        // gastosDelDia.push({ descripcion: Abono proveedor , monto: -monto }); ESTO NO, porque se resta aparte en el cierre

    } catch (e) {
        console.error('Error registrando pago:', e);
        mostrarAlerta(' Error: ' + e.message, 'error');
    }
}

function cerrarModalProveedoresPOS() {
    document.getElementById('modalProveedoresPOS').classList.remove('visible');
    document.getElementById('modalProveedoresPOS').style.display = '';
}

function cerrarModalAbonoProveedor() {
    document.getElementById('modalAbonoProveedor').classList.remove('visible');
    document.getElementById('modalAbonoProveedor').style.display = '';
    proveedorSeleccionado = null;
}

// ---------------------------------------------------------------
// ADELANTOS DE NÓMINA - LÓGICA
// ---------------------------------------------------------------

async function abrirModalAdelantoNomina() {
    if (!cajaAbierta) return mostrarAlerta('Debes abrir la caja primero', 'warning');

    document.getElementById('modalAdelantoNomina').classList.add('visible');
    document.getElementById('modalAdelantoNomina').style.display = 'flex';

    // Cargar empleados en el select
    const select = document.getElementById('adelantoEmpleadoId');
    select.innerHTML = '<option value="">Cargando...</option>';

    try {
        const { data, error } = await db.from('empleados_tienda').select('*').eq('activo', true).order('nombre');
        if (error) throw error;

        select.innerHTML = '<option value="">Seleccionar empleado...</option>' +
            data.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');

        // Autoseleccionar el empleado logueado si coincide (opcional)
        if (empleadoLogueado) {
            const match = data.find(e => e.nombre === empleadoLogueado.nombre);
            if (match) select.value = match.id;
        }
    } catch (e) {
        console.error('Error cargando empleados:', e);
        mostrarAlerta('Error al cargar empleados', 'error');
    }
}

function cerrarModalAdelantoNomina() {
    document.getElementById('modalAdelantoNomina').classList.remove('visible');
    document.getElementById('modalAdelantoNomina').style.display = '';
    // Limpiar campos
    ['adelantoMonto', 'adelantoAutoriza', 'adelantoMotivo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

async function guardarAdelantoNomina() {
    const empleadoId = document.getElementById('adelantoEmpleadoId').value;
    const monto = parseFloat(document.getElementById('adelantoMonto').value);
    const autoriza = document.getElementById('adelantoAutoriza').value.trim();
    const motivo = document.getElementById('adelantoMotivo').value.trim();

    if (!empleadoId) return mostrarAlerta('Selecciona un empleado', 'warning');
    if (!monto || monto <= 0) return mostrarAlerta('Ingresa un monto válido', 'warning');
    if (!autoriza) return mostrarAlerta('Ingresa quién autoriza el adelanto', 'warning');

    try {
        const { error } = await db.from('adelantos_nomina').insert({
            empleado_id: empleadoId,
            monto: monto,
            quien_autoriza: autoriza,
            motivo: motivo || null,
            local: TIENDA.nombre,
            fecha: new Date().toISOString(),
            registrado_por: empleadoLogueado?.nombre || 'POS'
        });

        if (error) throw error;

        mostrarAlerta(`Adelanto de $${monto.toLocaleString('es-CO')} registrado con éxito`, 'success');
        cerrarModalAdelantoNomina();

        if (window.moterosIA) {
            window.moterosIA.aprenderEvento('Adelanto de nómina registrado', {
                monto,
                autoriza,
                tienda: TIENDA.nombre
            });
        }
    } catch (e) {
        console.error('Error guardando adelanto:', e);
        mostrarAlerta('Error al guardar: ' + e.message, 'error');
    }
}

// ---------------------------------------------------------------
// ABONOS A CRÉDITO MOTERO DESDE EL POS
// ---------------------------------------------------------------

function abrirModalAbonoCredito() {
    if (!cajaAbierta) return mostrarAlerta('Debes abrir caja primero', 'warning');
    document.getElementById('modalAbonoCredito').style.display = 'flex';
    document.getElementById('buscarClienteCredito').focus();
}

function cerrarModalAbonoCredito() {
    document.getElementById('modalAbonoCredito').style.display = 'none';
    document.getElementById('listaCreditosCliente').style.display = 'none';
    document.getElementById('detalleCreditoAbono').style.display = 'none';
    document.getElementById('btnConfirmarAbono').style.display = 'none';
    document.getElementById('buscarClienteCredito').value = '';
    document.getElementById('montoAbonoCredito').value = '';
}

async function buscarCreditoCliente() {
    const q = document.getElementById('buscarClienteCredito').value.toLowerCase().trim();
    if (!q) return;

    const lista = document.getElementById('listaCreditosCliente');
    lista.innerHTML = 'Cargando...';
    lista.style.display = 'block';

    try {
        // Buscar en la tabla correcta: creditos_motero
        const { data: creditos, error } = await db
            .from('creditos_motero')
            .select('*, clientes_credito(*)')
            .gt('saldo_pendiente', 0) // Solo con deuda pendiente
            .neq('estado', 'pagado')
            .neq('estado', 'cerrado')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Filtrado en memoria (más flexible para búsquedas cruzadas)
        const filtrados = (creditos || []).filter(c => {
            const cliente = c.clientes_credito;
            // Buscar en datos del cliente vinculado
            const nombre = (cliente ? (cliente.nombres + ' ' + (cliente.apellidos || '')) : '').toLowerCase();
            const cedula = (cliente ? (cliente.cedula || cliente.identificacion || '') : '').toLowerCase();
            const telefono = (cliente ? (cliente.telefono || '') : '').toLowerCase();

            // Buscar en notas (fallback para créditos sin cliente vinculado o migrados)
            const notas = (c.notas || '').toLowerCase();

            return nombre.includes(q) || cedula.includes(q) || telefono.includes(q) || notas.includes(q);
        });

        if (filtrados.length === 0) {
            lista.innerHTML = 'No se encontraron créditos activos que coincidan.';
            return;
        }

        lista.innerHTML = filtrados.map(c => {
            // Determinar nombre y detalles a mostrar
            let nombreMostrar = 'Sin Nombre';
            let infoExtra = '';

            if (c.clientes_credito) {
                nombreMostrar = `${c.clientes_credito.nombres} ${c.clientes_credito.apellidos || ''}`;
                infoExtra = `CC: ${c.clientes_credito.cedula || c.clientes_credito.identificacion || '?'} | 📱​ ${c.clientes_credito.telefono || ''}`;
            } else if (c.notas) {
                // Intentar extraer de notas si no hay cliente vinculado
                const mN = c.notas.match(/Crédito:\s*([^|]+)/i);
                if (mN) nombreMostrar = mN[1].trim();
                const mC = c.notas.match(/CC:\s*([^|]+)/i);
                if (mC) infoExtra += `CC: ${mC[1].trim()} `;
                const mT = c.notas.match(/Tel:\s*([^|]+)/i);
                if (mT) infoExtra += `| 📄 ${mT[1].trim()}`;
            }

            return `
                <div class="opcion-busqueda" onclick="seleccionarCreditoParaAbono('${c.id}')" style="padding:0.75rem; border-bottom:1px solid #eee; cursor:pointer; background:#fff; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${nombreMostrar}</strong><br>
                        <small style="color:#64748b;">${infoExtra}</small>
                    </div>
                    <div style="text-align:right;">
                         <div style="font-size:0.8rem; color:#64748b;">Saldo:</div>
                         <strong style="color:#ef4444; font-size:1.1rem;">$${(c.saldo_pendiente || 0).toLocaleString('es-CO')}</strong>
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        console.error(e);
        lista.innerHTML = '⚠️ Error al buscar créditos.';
    }
}

let creditoSeleccionado = null;

async function seleccionarCreditoParaAbono(id) {
    try {
        const { data: c, error } = await db
            .from('creditos_motero')
            .select('*, clientes_credito(*)')
            .eq('id', id)
            .single();

        if (error) throw error;

        creditoSeleccionado = c;

        document.getElementById('listaCreditosCliente').style.display = 'none';
        document.getElementById('detalleCreditoAbono').style.display = 'block';
        document.getElementById('creditoAbonoId').value = c.id;

        // Extraer nombre para mostrar
        let nombreMostrar = 'Cliente';
        if (c.clientes_credito) {
            nombreMostrar = `${c.clientes_credito.nombres} ${c.clientes_credito.apellidos || ''}`;
        } else if (c.notas) {
            const mN = c.notas.match(/Crédito:\s*([^|]+)/i);
            if (mN) nombreMostrar = mN[1].trim();
        }

        document.getElementById('abonoClienteNombre').textContent = nombreMostrar;
        document.getElementById('abonoSaldoActual').textContent = '$' + (c.saldo_pendiente || 0).toLocaleString('es-CO');

        // Sugerir cuota o total
        const cuota = c.valor_cuota || c.saldo_pendiente;
        document.getElementById('abonoCuotaSugerida').textContent = `$${(cuota).toLocaleString('es-CO')}`;

        document.getElementById('montoAbonoCredito').value = '';
        document.getElementById('montoAbonoCredito').placeholder = `Sugerido: $${cuota}`;
        document.getElementById('montoAbonoCredito').focus();

        document.getElementById('btnConfirmarAbono').style.display = 'block';

    } catch (e) {
        console.error(e);
        mostrarAlerta('⚠️ Error al seleccionar el crédito', 'error');
    }
}

async function confirmarAbonoCredito() {
    const id = document.getElementById('creditoAbonoId').value;
    const monto = parseFloat(document.getElementById('montoAbonoCredito').value);

    if (!monto || monto <= 0 || !creditoSeleccionado) {
        return mostrarAlerta('Ingresa un monto válido', 'warning');
    }

    if (monto > creditoSeleccionado.saldo_pendiente) {
        if (!confirm('¿El abono es mayor al saldo pendiente? Se ajustará al saldo exacto.')) return;
    }

    const metodoPago = document.getElementById('metodoAbonoCredito')?.value || 'Efectivo';
    const montoFinal = Math.min(monto, creditoSeleccionado.saldo_pendiente);

    try {
        const nuevoSaldo = creditoSeleccionado.saldo_pendiente - montoFinal;
        const nuevoEstado = nuevoSaldo <= 100 ? 'pagado' : 'activo'; // Margen de error pequeño

        // 1. Registrar el pago en pagos_credito (tabla correcta para créditos motero)
        const { error: errorPago } = await db.from('pagos_credito').insert({
            credito_id: id,
            monto_pagado: montoFinal,
            fecha_pago: new Date().toISOString(),
            metodo_pago: metodoPago,
            local: TIENDA.nombre,
            usuario: empleadoLogueado?.nombre || 'POS',
            notas: 'Abono desde POS'
        });

        if (errorPago) throw errorPago;

        // 2. Actualizar el saldo del crédito
        const updates = {
            saldo_pendiente: nuevoSaldo,
            ultimo_pago_fecha: new Date().toISOString().split('T')[0]
        };

        if (nuevoEstado === 'pagado') {
            updates.estado = 'pagado';
        } else if (creditoSeleccionado.estado === 'mora') {
            // Si estaba en mora y abona, podríamos cambiarlo a activo si pone al día, 
            // pero por simplicidad en POS solo actualizamos saldo.
            // Opcional: updates.estado = 'activo';
        }

        const { error: errorCredito } = await db.from('creditos_motero').update(updates).eq('id', id);

        if (errorCredito) throw errorCredito;

        mostrarAlerta(`Abono de $${montoFinal.toLocaleString('es-CO')} registrado con éxito`, 'success');
        cerrarModalAbonoCredito();

        if (window.moterosIA) {
            window.moterosIA.aprenderEvento('Abono crédito registrado', {
                monto: montoFinal,
                tienda: TIENDA.nombre,
                saldo_restante: nuevoSaldo
            });
        }
    } catch (e) {
        console.error('Error al abonar:', e);
        mostrarAlerta('Error al registrar el abono: ' + e.message, 'error');
    }
}

// ---------------------------------------------------------------
// MÓDULO DE SERVICIOS (LAVADOS, ARREGLOS, ETC.)
// ---------------------------------------------------------------

async function abrirModalServicios() {
    document.getElementById('modalServicios').style.display = 'flex';
    cargarEmpleadosServicio();
    // Limpiar campos
    document.getElementById('servClienteNombre').value = '';
    document.getElementById('servClienteTelefono').value = '';
    document.getElementById('servPrecioTotal').value = '';
    document.getElementById('servAbono').value = '';
    document.getElementById('servCascoInfo').value = '';
}

function cerrarModalServicios() {
    document.getElementById('modalServicios').style.display = 'none';
}

async function cargarEmpleadosServicio() {
    const select = document.getElementById('servEmpleado');
    if (!select) return;

    // Si ya tiene opciones (más que la default), no recargar cada vez si no es necesario
    if (select.options.length > 1) return;

    try {
        const { data, error } = await db.from('empleados_tienda')
            .select('id, nombre')
            .eq('activo', true)
            .order('nombre');

        if (error) throw error;

        data.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = emp.nombre;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error('Error cargando empleados para servicios:', e);
    }
}

async function registrarServicio() {
    const tipo = document.getElementById('servTipo').value;
    const empleadoId = document.getElementById('servEmpleado').value;
    const cliente = document.getElementById('servClienteNombre').value.trim();
    const telefono = document.getElementById('servClienteTelefono').value.trim();
    const casco = document.getElementById('servCascoInfo').value.trim();
    const precioTotal = parseFloat(document.getElementById('servPrecioTotal').value) || 0;
    const abono = parseFloat(document.getElementById('servAbono').value) || 0;

    if (!empleadoId) return mostrarAlerta('Selecciona al empleado que realizó el servicio.', 'warning');
    if (!cliente || !telefono) return mostrarAlerta('Nombre y teléfono del cliente son obligatorios.', 'warning');
    if (precioTotal <= 0) return mostrarAlerta('Ingresa el precio total del servicio.', 'warning');

    try {
        const { data: serv, error: errorServ } = await db.from('servicios_motero').insert({
            tipo_servicio: tipo,
            empleado_id: empleadoId,
            cliente_nombre: cliente,
            cliente_telefono: telefono,
            casco_prestado: casco,
            precio_total: precioTotal,
            monto_abonado: abono,
            saldo_pendiente: precioTotal - abono,
            local: TIENDA.nombre,
            estado: 'pendiente'
        }).select().single();

        if (errorServ) throw errorServ;

        // Si hay abono inicial, registrar pago
        if (abono > 0) {
            await db.from('pagos_servicios').insert({
                servicio_id: serv.id,
                monto: abono,
                metodo_pago: 'Efectivo',
                local: TIENDA.nombre,
                registrado_por: (typeof empleadoLogueado !== 'undefined' ? empleadoLogueado?.id : null)
            });
        }

        mostrarAlerta('✅ Servicio registrado exitosamente!', 'success');
        cerrarModalServicios();

    } catch (e) {
        console.error('Error al registrar servicio:', e);
        mostrarAlerta('Error al guardar el servicio: ' + e.message, 'error');
    }
}

function abrirBuscadorServicios() {
    cerrarModalServicios();
    document.getElementById('modalBuscarServicios').style.display = 'flex';
    document.getElementById('resultadosServicios').innerHTML = '<p style="text-align:center; color:var(--gray);">🔎​ Ingresa el nombre o teléfono para buscar.</p>';
}

async function buscarServicios() {
    const query = document.getElementById('queryServicio').value.trim();
    const contenedor = document.getElementById('resultadosServicios');

    if (query.length < 3) return mostrarAlerta('Ingresa al menos 3 caracteres.', 'info');

    contenedor.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const { data, error } = await db.from('servicios_motero')
            .select('*, empleados_tienda(nombre)')
            .or(`cliente_nombre.ilike.%${query}%,cliente_telefono.ilike.%${query}%`)
            .eq('local', TIENDA.nombre)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            contenedor.innerHTML = '<p style="text-align:center; padding:2rem; color:var(--gray);">No se encontraron servicios pendientes.</p>';
            return;
        }

        contenedor.innerHTML = '';
        data.forEach(s => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.marginBottom = '1rem';
            card.style.borderLeft = s.estado === 'pendiente' ? '4px solid #f59e0b' : (s.estado === 'listo' ? '4px solid #3b82f6' : '4px solid #10b981');

            card.innerHTML = `
                <div class="card-body" style="padding:1rem;">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div>
                            <h4 style="margin:0; color:var(--dark);">${s.tipo_servicio} - #${s.numero_servicio}</h4>
                            <p style="margin:0.2rem 0; font-size:0.85rem; color:#64748b;"><strong>Cliente:</strong> ${s.cliente_nombre} (${s.cliente_telefono})</p>
                            <p style="margin:0; font-size:0.85rem; color:#64748b;"><strong>Empleado:</strong> ${s.empleados_tienda?.nombre || 'N/A'}</p>
                            ${s.casco_prestado ? `<p style="margin:0.2rem 0; font-size:0.8rem; background:#f1f5f9; padding:0.3rem; border-radius:4px;">🪖​ Casco: ${s.casco_prestado}</p>` : ''}
                        </div>
                        <div style="text-align:right;">
                            <span class="badge" style="background:${s.estado === 'pendiente' ? '#fef3c7' : '#dbeafe'}; color:${s.estado === 'pendiente' ? '#92400e' : '#1e40af'}; text-transform:uppercase; font-size:0.75rem;">${s.estado}</span>
                            <div style="font-weight:800; color:var(--primary); margin-top:0.5rem;">Saldo: $${(s.saldo_pendiente || 0).toLocaleString('es-CO')}</div>
                        </div>
                    </div>
                    <div style="margin-top:1rem; display:flex; gap:0.5rem;">
                        ${s.estado !== 'entregado' ? `
                            <button onclick="registrarAbonoServicio('${s.id}', ${s.saldo_pendiente})" class="btn btn-sm btn-success">💵 Abonar/Pagar</button>
                            ${s.estado === 'pendiente' ? `<button onclick="cambiarEstadoServicio('${s.id}', 'listo')" class="btn btn-sm btn-primary">? Listo</button>` : ''}
                            ${s.estado === 'listo' && s.saldo_pendiente <= 0 ? `<button onclick="cambiarEstadoServicio('${s.id}', 'entregado')" class="btn btn-sm btn-info">✅ Entregar</button>` : ''}
                        ` : '<span style="color:#10b981; font-weight:700;">? Servicio Completado</span>'}
                    </div>
                </div>
            `;
            contenedor.appendChild(card);
        });

    } catch (e) {
        console.error('Error buscando servicios:', e);
        mostrarAlerta('Error en la búsqueda.', 'error');
    }
}

async function cambiarEstadoServicio(id, nuevoEstado) {
    try {
        const { error } = await db.from('servicios_motero')
            .update({ estado: nuevoEstado })
            .eq('id', id);

        if (error) throw error;
        mostrarAlerta('Estado actualizado.', 'success');
        buscarServicios();
    } catch (e) {
        mostrarAlerta('Error al actualizar estado.', 'error');
    }
}

async function registrarAbonoServicio(id, saldo) {
    const monto = parseFloat(prompt(`Saldo pendiente: $${saldo.toLocaleString('es-CO')}\n¿Cuánto desea abonar?`, saldo));
    if (isNaN(monto) || monto <= 0) return;
    if (monto > saldo) return mostrarAlerta('El abono no puede superar el saldo.', 'warning');

    try {
        const { data: serv } = await db.from('servicios_motero').select('*').eq('id', id).single();

        const { error } = await db.from('servicios_motero')
            .update({
                monto_abonado: (serv.monto_abonado || 0) + monto,
                saldo_pendiente: (serv.saldo_pendiente || 0) - monto,
                estado: (serv.saldo_pendiente - monto) <= 0 && serv.estado === 'pendiente' ? 'listo' : serv.estado
            })
            .eq('id', id);

        if (error) throw error;

        // Registrar en pagos_servicios
        await db.from('pagos_servicios').insert({
            servicio_id: id,
            monto: monto,
            metodo_pago: 'Efectivo',
            local: TIENDA.nombre,
            registrado_por: (typeof empleadoLogueado !== 'undefined' ? empleadoLogueado?.id : null)
        });

        mostrarAlerta('Abono registrado.', 'success');
        buscarServicios();
    } catch (e) {
        console.error(e);
        mostrarAlerta('Error al registrar abono.', 'error');
    }
}

// ---------------------------------------------------------------
// PAGO PROVEEDOR INLINE (desde grilla de métodos de pago)
let _proveedoresInlineCache = [];

async function cargarProveedoresInline() {
    try {
        // Consultar a través de compras_proveedor para obtener el saldo real pendiente
        // (Igual que en cargarProveedoresConSaldo)
        const { data, error } = await db
            .from('compras_proveedor')
            .select(`
                proveedor_id,
                saldo_pendiente,
                proveedores (
                    id,
                    razon_social,
                    banco,
                    tipo_cuenta,
                    numero_cuenta,
                    titular_cuenta
                )
            `)
            .gt('saldo_pendiente', 0);

        if (error) throw error;

        // Agrupar por proveedor
        const proveedoresMap = {};
        (data || []).forEach(compra => {
            const p = compra.proveedores;
            if (!p) return;

            if (!proveedoresMap[p.id]) {
                proveedoresMap[p.id] = {
                    id: p.id,
                    razon_social: p.razon_social,
                    banco: p.banco,
                    tipo_cuenta: p.tipo_cuenta,
                    numero_cuenta: p.numero_cuenta,
                    titular_cuenta: p.titular_cuenta,
                    saldo_pendiente: 0
                };
            }
            proveedoresMap[p.id].saldo_pendiente += parseFloat(compra.saldo_pendiente || 0);
        });

        _proveedoresInlineCache = Object.values(proveedoresMap).sort((a, b) => a.razon_social.localeCompare(b.razon_social));

        const select = document.getElementById('selectProveedorPago');
        if (!select) return;

        select.innerHTML = '<option value="">Seleccionar proveedor...</option>';
        _proveedoresInlineCache.forEach(p => {
            select.innerHTML += `<option value="${p.id}">${p.razon_social} — $${(p.saldo_pendiente || 0).toLocaleString('es-CO')}</option>`;
        });
    } catch (e) {
        console.error('Error cargando proveedores inline:', e);
        mostrarAlerta('Error cargando proveedores', 'error');
    }
}

function mostrarInfoProveedorInline() {
    const select = document.getElementById('selectProveedorPago');
    const info = document.getElementById('infoProveedorInline');
    if (!select || !info) return;

    const id = parseInt(select.value);
    const prov = _proveedoresInlineCache.find(p => p.id === id);

    if (!prov) {
        info.style.display = 'none';
        return;
    }

    info.style.display = 'block';
    document.getElementById('provInlineNombre').textContent = prov.razon_social;
    document.getElementById('provInlineBanco').textContent = prov.banco || 'Sin banco';
    document.getElementById('provInlineTipoCuenta').textContent = prov.tipo_cuenta || '-';
    document.getElementById('provInlineCuenta').textContent = prov.numero_cuenta || '-';
    document.getElementById('provInlineTitular').textContent = prov.titular_cuenta || prov.razon_social;
    document.getElementById('provInlineSaldo').textContent = `$${(prov.saldo_pendiente || 0).toLocaleString('es-CO')}`;
}

async function confirmarPagoProveedorInline() {
    const select = document.getElementById('selectProveedorPago');
    const montoInput = document.getElementById('montoPagoProveedor');
    const refInput = document.getElementById('refPagoProveedor');
    const fotoInput = document.getElementById('fotoPagoProveedor');

    if (!select?.value) return mostrarAlerta('Selecciona un proveedor', 'warning');
    const monto = parseFloat(montoInput?.value) || 0;
    if (monto <= 0) return mostrarAlerta('Ingresa un monto válido', 'warning');

    const id = parseInt(select.value);
    const prov = _proveedoresInlineCache.find(p => p.id === id);
    if (!prov) return mostrarAlerta('Proveedor no encontrado', 'error');

    const referencia = refInput?.value.trim() || '';

    try {
        // 1. Subir foto del comprobante (USANDO BUCKET EXISTENTE: productos-imagenes)
        let comprobanteUrl = null;
        if (fotoInput?.files?.length > 0) {
            const file = fotoInput.files[0];
            const timestamp = Date.now();
            const ext = file.name.split('.').pop();
            const nombreArchivo = `comprobante_prov_${id}_${timestamp}.${ext}`;
            const rutaArchivo = `comprobantes/${nombreArchivo}`;

            try {
                // Subir al bucket 'productos-imagenes' en la carpeta 'comprobantes'
                const { data: uploadData, error: uploadError } = await db.storage
                    .from('productos-imagenes')
                    .upload(rutaArchivo, file, { cacheControl: '3600', upsert: false });

                if (uploadError) throw uploadError;

                const { data: urlData } = db.storage.from('productos-imagenes').getPublicUrl(rutaArchivo);
                comprobanteUrl = urlData?.publicUrl || null;

            } catch (uploadErr) {
                console.warn('Error subiendo comprobante (continuando sin foto):', uploadErr);
                mostrarAlerta('No se pudo subir la foto, se guardará el pago sin ella.', 'warning');
            }
        }

        // 2. Determinar método de pago basado en la info bancaria del proveedor
        let metodoPago = 'Transferencia';
        if (prov.banco?.toLowerCase().includes('nequi')) metodoPago = 'Nequi';
        else if (prov.banco?.toLowerCase().includes('daviplata')) metodoPago = 'Daviplata';

        // 3. Registrar el pago en pagos_proveedor
        const pagoData = {
            proveedor_id: id,
            monto: monto,
            metodo_pago: metodoPago,
            referencia: referencia || null,
            local: TIENDA.nombre,
            notas: comprobanteUrl ? `Comprobante: ${comprobanteUrl}` : null
        };

        const { error: errorPago } = await db.from('pagos_proveedor').insert(pagoData);
        if (errorPago) throw errorPago;

        // 4. Descontar del saldo_pendiente de las compras (FIFO)
        let montoRestante = monto;
        const { data: comprasPendientes } = await db
            .from('compras_proveedor')
            .select('id, saldo_pendiente')
            .eq('proveedor_id', id)
            .gt('saldo_pendiente', 0)
            .order('fecha_compra', { ascending: true });

        if (comprasPendientes) {
            for (const compra of comprasPendientes) {
                if (montoRestante <= 0) break;
                const saldoActual = parseFloat(compra.saldo_pendiente || 0);
                let rebaja = Math.min(montoRestante, saldoActual);
                let nuevoSaldo = saldoActual - rebaja;

                await db.from('compras_proveedor')
                    .update({
                        saldo_pendiente: nuevoSaldo,
                        estado: nuevoSaldo <= 0 ? 'PAGADO' : 'PENDIENTE'
                    })
                    .eq('id', compra.id);

                montoRestante -= rebaja;
            }
        }

        // 5. Actualizar saldo global del proveedor (intentar, pero no bloquear si falla)
        try {
            const { data: provData } = await db.from('proveedores').select('saldo_pendiente').eq('id', id).single();
            if (provData) {
                const nuevoSaldoGlobal = Math.max(0, parseFloat(provData.saldo_pendiente || 0) - monto);
                await db.from('proveedores').update({ saldo_pendiente: nuevoSaldoGlobal }).eq('id', id);
            }
        } catch (e) {
            console.error("Error actualizando saldo global proveedor (no crítico):", e);
        }

        // 6. Limpiar formulario
        montoInput.value = '';
        refInput.value = '';
        fotoInput.value = '';
        const preview = document.getElementById('previewFotoPago');
        if (preview) { preview.style.display = 'none'; preview.src = ''; }
        select.value = '';
        document.getElementById('infoProveedorInline').style.display = 'none';

        // Deseleccionar el método "Pago Proveedor"
        const btnProv = document.querySelector('[data-metodo="Pago Proveedor"]');
        if (btnProv) {
            metodosSeleccionados.delete('Pago Proveedor');
            btnProv.classList.remove('selected');
            document.getElementById('seccionPagoProveedor').style.display = 'none';
            const infoEl = document.getElementById('metodosSeleccionados');
            if (metodosSeleccionados.size > 0) {
                infoEl.textContent = ' ' + [...metodosSeleccionados].join(' + ');
            } else {
                infoEl.classList.remove('visible');
            }
        }

        mostrarAlerta(`? Pago de $${monto.toLocaleString('es-CO')} a ${prov.razon_social} registrado`, 'success');
        cargarProveedoresInline(); // Recargar lista para actualizar saldos

    } catch (e) {
        console.error('Error en pago proveedor inline:', e);
        mostrarAlerta('Error al registrar el pago: ' + (e.message || 'desconocido'), 'error');
    }
}

// ---------------------------------------------------------------
// DESGLOSE DE PRODUCTOS VENDIDOS (para cierre de caja)
// ---------------------------------------------------------------
function generarDesgloseProductos() {
    if (!resumenVentas?.ventasDelDia || resumenVentas.ventasDelDia.length === 0) {
        return '';
    }

    // Agrupar por nombre de producto
    const productosMap = {};
    resumenVentas.ventasDelDia.forEach(v => {
        const nombre = v.nombre_producto || 'Producto sin nombre';
        if (!productosMap[nombre]) {
            productosMap[nombre] = { cantidad: 0, total: 0 };
        }
        productosMap[nombre].cantidad += (v.cantidad || 1);
        productosMap[nombre].total += (v.total || 0);
    });

    const filas = Object.entries(productosMap)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([nombre, data]) => `
            <tr>
                <td style="font-size:0.82rem; padding:0.4rem 0.6rem;">${nombre}</td>
                <td style="text-align:center; padding:0.4rem;">${data.cantidad}</td>
                <td style="text-align:right; padding:0.4rem 0.6rem;">$${data.total.toLocaleString('es-CO')}</td>
            </tr>
        `).join('');

    const totalCant = Object.values(productosMap).reduce((s, p) => s + p.cantidad, 0);
    const totalMonto = Object.values(productosMap).reduce((s, p) => s + p.total, 0);

    return `
        <div style="margin-top:1rem; border-top:1px solid #e2e8f0; padding-top:1rem;">
            <h4 style="margin:0 0 0.6rem; font-size:0.9rem; color:#475569; cursor:pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                🧾 Desglose de Productos ?
            </h4>
            <div style="max-height:250px; overflow-y:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                    <thead>
                        <tr style="background:#f1f5f9; border-bottom:2px solid #e2e8f0;">
                            <th style="text-align:left; padding:0.5rem 0.6rem; color:#475569; font-weight:600;">Producto</th>
                            <th style="text-align:center; padding:0.5rem; color:#475569; font-weight:600;">Cant.</th>
                            <th style="text-align:right; padding:0.5rem 0.6rem; color:#475569; font-weight:600;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>${filas}</tbody>
                    <tfoot>
                        <tr style="border-top:2px solid #0369a1; font-weight:700;">
                            <td style="padding:0.5rem 0.6rem;">TOTAL</td>
                            <td style="text-align:center; padding:0.5rem;">${totalCant}</td>
                            <td style="text-align:right; padding:0.5rem 0.6rem; color:#0369a1;">$${totalMonto.toLocaleString('es-CO')}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    `;
}

// Preview de foto del comprobante
document.addEventListener('DOMContentLoaded', () => {
    const fotoInput = document.getElementById('fotoPagoProveedor');
    if (fotoInput) {
        fotoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const preview = document.getElementById('previewFotoPago');
            if (file && preview) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    preview.src = ev.target.result;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

/**
 * Helper para procesar productos cargados desde IndexedDB
 */
function procesarProductosOffline(prodsCached, invCached) {
    productos = prodsCached.map(p => {
        let stockTotal = 0;
        let stockDetallado = {};

        // Filtrar inventario para este producto
        const variantesStock = invCached.filter(i => String(i.id_producto) === String(p.id));

        variantesStock.forEach(v => {
            const cant = v.cantidad || 0;
            const talla = v.talla || 'única';
            const color = v.color || '';
            stockTotal += cant;
            if (!stockDetallado[color]) stockDetallado[color] = {};
            stockDetallado[color][talla] = (stockDetallado[color][talla] || 0) + cant;
        });

        return {
            ...p,
            id_producto: p.id,
            stock: stockTotal,
            stock_detallado: stockDetallado
        };
    });
    renderizarProductos();
}
