/* ═══════════════════════════════════════════════════════════════
   POS MOTEROS SPORTS LINE - JAVASCRIPT UNIFICADO v2.0
   Compatible con tiendas físicas (Alcalá, 01, Jordán) y Digital
   ═══════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE SUPABASE (se carga desde config.js)
// ═══════════════════════════════════════════════════════════════
const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

// Alias para compatibilidad con código existente
const supabaseClient = db;

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN POR TIENDA (se define en cada HTML)
// TIENDA = { 
//   nombre: 'Alcalá' | '01' | 'Jordán' | 'Digital', 
//   tablaInventario: 'inventario_alcala' | 'inventario_01' | etc,
//   storageKey: 'pos_caja_alcala' | etc,
//   esDigital: false | true
// }
// ═══════════════════════════════════════════════════════════════

const LOGO_URL = 'https://pbblthbrdkevuyjxyuar.supabase.co/storage/v1/object/public/productos-imagenes/moteros%20logo.jpg';

// Métodos de crédito (requieren datos adicionales)
const METODOS_CREDITO = ['Credito Motero', 'Addi', 'Sistecredito', 'Fodegas', 'Contraentrega'];

// ═══════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════════════════
let productos = [];
let carrito = [];
let cajaAbierta = false;
let metodosSeleccionados = new Set();
let itemEditandoIdx = null;
let datosCaja = null;
let resumenVentas = null;
let gastosDelDia = [];
let empleadoLogueado = null; // Datos del empleado con sesión activa

// ═══════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
    const tipoTienda = TIENDA.esDigital ? '📦 Digital' : `🏪 ${TIENDA.nombre}`;
    console.log(`${tipoTienda} POS iniciando...`);

    // Cargar logos
    document.querySelectorAll('.logo-img').forEach(img => img.src = LOGO_URL);
    document.querySelectorAll('.tienda-nombre-display').forEach(el => el.textContent = TIENDA.nombre);

    // Verificar estado de caja
    verificarCaja();

    // Cargar productos
    await cargarProductos();

    console.log('✅ POS listo');
});

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE CAJA
// ═══════════════════════════════════════════════════════════════
function verificarCaja() {
    const datos = localStorage.getItem(TIENDA.storageKey);
    if (datos) {
        datosCaja = JSON.parse(datos);
        const hoy = new Date().toISOString().split('T')[0];
        if (datosCaja.fecha === hoy && datosCaja.estado === 'abierta') {
            cajaAbierta = true;
        } else {
            localStorage.removeItem(TIENDA.storageKey);
            datosCaja = null;
        }
    }
    actualizarUICaja();
}

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE LOGIN DE EMPLEADOS
// ═══════════════════════════════════════════════════════════════

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

function abrirModalCajaConEmpleado() {
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

    document.getElementById('modalAbrirCaja').classList.add('visible');
}

function abrirModalCajaLegacy() {
    // Modo legacy - sin verificación de empleados (para compatibilidad)
    const nombre = prompt('👤 Ingresa tu nombre completo:');
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

    if (!vendedor) {
        mostrarAlerta('Ingresa el nombre del vendedor', 'warning');
        return;
    }

    const prefijo = TIENDA.esDigital ? 'DIG' : TIENDA.nombre.substring(0, 3).toUpperCase();
    const numeroCierre = `C-${prefijo}-${Date.now()}`;

    try {
        const { error } = await db.from('cierres_caja').insert({
            numero_cierre: numeroCierre,
            local: TIENDA.nombre,
            fecha_apertura: new Date().toISOString(),
            vendedor: vendedor,
            base_caja: monto,
            estado: 'abierto'
        });

        if (error) throw error;

        datosCaja = {
            fecha: new Date().toISOString().split('T')[0],
            horaApertura: new Date().toISOString(),
            montoInicial: monto,
            vendedor: vendedor,
            numeroCierre: numeroCierre,
            estado: 'abierta'
        };

        localStorage.setItem(TIENDA.storageKey, JSON.stringify(datosCaja));
        cajaAbierta = true;

        cerrarModal();
        actualizarUICaja();
        mostrarAlerta(`✅ Caja abierta - Base: $${monto.toLocaleString('es-CO')}`, 'success');

    } catch (e) {
        console.error('Error abriendo caja:', e);
        mostrarAlerta('Error al abrir caja: ' + (e.message || 'desconocido'), 'error');
    }
}

function actualizarUICaja() {
    const badge = document.getElementById('cajaBadge');
    const btnAbrir = document.getElementById('btnAbrirCaja');
    const btnCerrar = document.getElementById('btnCerrarCaja');
    const locked = document.getElementById('lockedScreen');
    const vendedorBadge = document.getElementById('vendedorBadge');

    if (cajaAbierta) {
        badge.innerHTML = '✅ Abierta';
        badge.className = 'badge badge-abierta';
        btnAbrir.classList.add('hidden');
        btnCerrar.classList.remove('hidden');
        locked.classList.add('hidden');

        if (vendedorBadge && datosCaja?.vendedor) {
            vendedorBadge.textContent = datosCaja.vendedor;
            vendedorBadge.classList.remove('hidden');
        }
    } else {
        badge.innerHTML = '🔒 Cerrada';
        badge.className = 'badge badge-cerrada';
        btnAbrir.classList.remove('hidden');
        btnCerrar.classList.add('hidden');
        locked.classList.remove('hidden');

        if (vendedorBadge) {
            vendedorBadge.classList.add('hidden');
        }
    }
    actualizarBotonVender();
}

// ═══════════════════════════════════════════════════════════════
// CIERRE DE CAJA - MOSTRAR MODAL
// ═══════════════════════════════════════════════════════════════
async function mostrarModalCerrarCaja() {
    const hoy = new Date().toISOString().split('T')[0];

    try {
        const { data: ventas } = await db.from('ventas')
            .select('*')
            .eq('local', TIENDA.nombre)
            .gte('created_at', hoy + 'T00:00:00');

        // Estructura de totales según tipo de tienda
        const totales = TIENDA.esDigital ? {
            transferencia: 0, nequi: 0, daviplata: 0, tarjeta: 0,
            contraentrega: 0, addi: 0, sistecredito: 0, fodegas: 0
        } : {
            efectivo: 0, transferencia: 0, tarjeta: 0, daviplata: 0,
            nequi: 0, addi: 0, datafono: 0, sistecredito: 0,
            credito_motero: 0, fodegas: 0
        };

        let totalGeneral = 0;
        let totalUnidades = 0;

        (ventas || []).forEach(v => {
            const monto = v.total || 0;
            totalGeneral += monto;
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
            if (metodos.includes('sistecredito') || metodos.includes('sistecrédito')) totales.sistecredito += montoPorMetodo;
            if (metodos.includes('credito motero') || metodos.includes('crédito motero')) totales.credito_motero = (totales.credito_motero || 0) + montoPorMetodo;
            if (metodos.includes('fodegas')) totales.fodegas += montoPorMetodo;
            if (metodos.includes('contraentrega')) totales.contraentrega = (totales.contraentrega || 0) + montoPorMetodo;
        });

        const base = datosCaja?.montoInicial || 0;
        const totalGastos = gastosDelDia.reduce((sum, g) => sum + (g.monto || 0), 0);
        const efectivoEsperado = base + (totales.efectivo || 0) - totalGastos;

        resumenVentas = {
            totales,
            totalGeneral,
            totalUnidades,
            numTransacciones: ventas?.length || 0,
            base,
            efectivoEsperado
        };

        // Renderizar resumen según tipo de tienda
        const resumenHTML = TIENDA.esDigital ? `
            <div class="resumen-cierre">
                <h4>📊 Pedidos del Día</h4>
                <div class="resumen-row"><span class="label">📦 Pedidos</span><span class="value">${resumenVentas.numTransacciones}</span></div>
                <div class="resumen-row"><span class="label">📦 Unidades</span><span class="value">${resumenVentas.totalUnidades}</span></div>
                <div class="resumen-row total"><span class="label">💰 TOTAL</span><span class="value">$${totalGeneral.toLocaleString('es-CO')}</span></div>
            </div>
        ` : `
            <div class="resumen-cierre">
                <h4>📊 Ventas Registradas en Sistema</h4>
                <div class="resumen-row"><span class="label">🛒 Transacciones</span><span class="value">${resumenVentas.numTransacciones}</span></div>
                <div class="resumen-row"><span class="label">📦 Unidades vendidas</span><span class="value">${resumenVentas.totalUnidades}</span></div>
                <div class="resumen-row"><span class="label">📂 Base caja</span><span class="value">$${base.toLocaleString('es-CO')}</span></div>
                <div class="resumen-row"><span class="label">💵 Efectivo sistema</span><span class="value">$${Math.round(totales.efectivo).toLocaleString('es-CO')}</span></div>
                <div class="resumen-row"><span class="label">💰 Efectivo esperado</span><span class="value">$${Math.round(efectivoEsperado).toLocaleString('es-CO')}</span></div>
                <div class="resumen-row total"><span class="label">💰 TOTAL VENTAS</span><span class="value">$${totalGeneral.toLocaleString('es-CO')}</span></div>
            </div>
        `;

        document.getElementById('resumenCierreModal').innerHTML = resumenHTML;

        // Limpiar campos de conteo
        const camposConteo = TIENDA.esDigital
            ? ['transferenciaContado', 'nequiContado', 'daviplataContado', 'tarjetaContado',
                'contraentregaContado', 'addiContado', 'sistecreditoContado', 'fodegasContado']
            : ['efectivoContado', 'transferenciaContado', 'tarjetaContado', 'daviplataContado',
                'nequiContado', 'addiContado', 'datafonoContado', 'sistecreditoContado', 'fodegasContado'];

        camposConteo.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

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

// ═══════════════════════════════════════════════════════════════
// CIERRE DE CAJA - CONFIRMAR (TIENDA FÍSICA)
// ═══════════════════════════════════════════════════════════════
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

    const diferenciaEfectivo = efectivoContado - (base + (resumenVentas?.totales?.efectivo || 0));

    const totalContado = efectivoContado + transferenciaContado + tarjetaContado +
        daviplataContado + nequiContado + addiContado + datafonoContado +
        sistecreditoContado + fodegasContado;

    const diferenciaTotal = totalContado - (base + (resumenVentas?.totalGeneral || 0));
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
                total_ventas_sistema: Math.round(resumenVentas?.totalGeneral || 0),
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
                total_gastos_dia: totalGastos,
                observaciones: observacionesFinal,
                estado: 'cerrado'
            })
            .eq('numero_cierre', datosCaja?.numeroCierre);

        if (error) throw error;

        cerrarModal();
        if (window.moterosIA) {
            window.moterosIA.aprenderEvento('Cierre de caja realizado', {
                tienda: TIENDA.nombre,
                total_venta: resumenVentas?.totalGeneral,
                diferencia: diferenciaTotal
            });
        }
        mostrarResumenFinal(efectivoContado, diferenciaEfectivo, diferenciaTotal, totalGastos);

        localStorage.removeItem(TIENDA.storageKey);
        cajaAbierta = false;
        datosCaja = null;
        actualizarUICaja();

        mostrarAlerta('📊 Cierre guardado correctamente', 'success');

    } catch (e) {
        console.error('Error cerrando caja:', e);
        mostrarAlerta('Error al guardar: ' + (e.message || 'desconocido'), 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// CIERRE DE CAJA - CONFIRMAR (TIENDA DIGITAL)
// ═══════════════════════════════════════════════════════════════
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
    const diferenciaTotal = totalContado - (resumenVentas?.totalGeneral || 0);

    try {
        const { error } = await db.from('cierres_caja')
            .update({
                fecha_cierre: new Date().toISOString(),
                ventas_transferencia_sistema: Math.round(resumenVentas?.totales?.transferencia || 0),
                ventas_nequi_sistema: Math.round(resumenVentas?.totales?.nequi || 0),
                ventas_daviplata_sistema: Math.round(resumenVentas?.totales?.daviplata || 0),
                ventas_tarjeta_sistema: Math.round(resumenVentas?.totales?.tarjeta || 0),
                total_ventas_sistema: Math.round(resumenVentas?.totalGeneral || 0),
                transferencias_contadas: transferenciaContado,
                nequi_contado: nequiContado,
                daviplata_contado: daviplataContado,
                tarjetas_contadas: tarjetaContado,
                addi_contado: addiContado,
                sistecredito_contado: sistecreditoContado,
                fodegas_contado: fodegasContado,
                diferencia_total: Math.round(diferenciaTotal),
                observaciones: observaciones,
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
        mostrarResumenFinalDigital(totalContado, diferenciaTotal);

        localStorage.removeItem(TIENDA.storageKey);
        cajaAbierta = false;
        actualizarUICaja();

        mostrarAlerta('📊 Cierre guardado', 'success');

    } catch (e) {
        console.error('Error:', e);
        mostrarAlerta('Error al cerrar: ' + e.message, 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// RESUMEN FINAL CIERRE (FÍSICA)
// ═══════════════════════════════════════════════════════════════
function mostrarResumenFinal(efectivoContado, diferenciaEfectivo, diferenciaTotal, totalGastos) {
    const difEfClass = diferenciaEfectivo >= 0 ? 'diferencia-positiva' : 'diferencia-negativa';
    const difTotClass = diferenciaTotal >= 0 ? 'diferencia-positiva' : 'diferencia-negativa';

    document.getElementById('pantallaAbrirCaja').classList.add('hidden');
    document.getElementById('resumenCierreCompleto').classList.remove('hidden');
    document.getElementById('resumenCierreCompleto').innerHTML = `
        <div class="resumen-final">
            <h2>📊 Caja Cerrada</h2>
            <p class="numero-cierre">Cierre guardado exitosamente</p>
            <div class="resumen-cierre">
                <div class="resumen-row"><span class="label">📅 Fecha</span><span class="value">${new Date().toLocaleDateString('es-CO')}</span></div>
                <div class="resumen-row"><span class="label">🏪 Tienda</span><span class="value">${TIENDA.nombre}</span></div>
                <div class="resumen-row"><span class="label">👤 Vendedor</span><span class="value">${datosCaja?.vendedor || 'N/A'}</span></div>
                <div class="resumen-row"><span class="label">🛒 Transacciones</span><span class="value">${resumenVentas?.numTransacciones || 0}</span></div>
                <div class="resumen-row"><span class="label">📦 Unidades</span><span class="value">${resumenVentas?.totalUnidades || 0}</span></div>
                <div class="resumen-row"><span class="label">💰 Total Ventas</span><span class="value">$${(resumenVentas?.totalGeneral || 0).toLocaleString('es-CO')}</span></div>
                <div class="resumen-row"><span class="label">💸 Total Gastos</span><span class="value">$${totalGastos.toLocaleString('es-CO')}</span></div>
                <div class="resumen-row"><span class="label">💵 Efectivo Contado</span><span class="value">$${efectivoContado.toLocaleString('es-CO')}</span></div>
                <div class="resumen-row"><span class="label">📊 Dif. Efectivo</span><span class="value ${difEfClass}">$${diferenciaEfectivo.toLocaleString('es-CO')}</span></div>
                <div class="resumen-row total"><span class="label">Dif. Total</span><span class="value ${difTotClass}">$${diferenciaTotal.toLocaleString('es-CO')}</span></div>
            </div>
            <button class="btn btn-success btn-large btn-full mt-1" onclick="reiniciarPantallaCaja()">📂 Abrir Nueva Caja</button>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// RESUMEN FINAL CIERRE (DIGITAL)
// ═══════════════════════════════════════════════════════════════
function mostrarResumenFinalDigital(totalContado, diferenciaTotal) {
    const difTotClass = diferenciaTotal >= 0 ? 'diferencia-positiva' : 'diferencia-negativa';

    document.getElementById('pantallaAbrirCaja').classList.add('hidden');
    document.getElementById('resumenCierreCompleto').classList.remove('hidden');
    document.getElementById('resumenCierreCompleto').innerHTML = `
        <div class="resumen-final">
            <h2>📊 Caja Cerrada</h2>
            <p class="numero-cierre">Digital - ${new Date().toLocaleDateString('es-CO')}</p>
            <div class="resumen-cierre">
                <div class="resumen-row"><span class="label">📦 Pedidos</span><span class="value">${resumenVentas?.numTransacciones || 0}</span></div>
                <div class="resumen-row"><span class="label">💰 Total Ventas</span><span class="value">$${(resumenVentas?.totalGeneral || 0).toLocaleString('es-CO')}</span></div>
                <div class="resumen-row"><span class="label">💰 Total Contado</span><span class="value">$${totalContado.toLocaleString('es-CO')}</span></div>
                <div class="resumen-row total"><span class="label">Diferencia</span><span class="value ${difTotClass}">$${diferenciaTotal.toLocaleString('es-CO')}</span></div>
            </div>
            <button class="btn btn-success btn-large btn-full mt-1" onclick="reiniciarPantallaCaja()">📂 Abrir Nueva Caja</button>
        </div>
    `;
}

function reiniciarPantallaCaja() {
    document.getElementById('resumenCierreCompleto').classList.add('hidden');
    document.getElementById('pantallaAbrirCaja').classList.remove('hidden');
    abrirModalCaja();
}

// ═══════════════════════════════════════════════════════════════
// GASTOS DEL DÍA (solo tiendas físicas)
// ═══════════════════════════════════════════════════════════════
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
               <label for="file-${idx}" style="cursor:pointer; font-size:1.2em;" title="Adjuntar Foto">📎</label>
               <input type="file" id="file-${idx}" accept="image/*" 
                      onchange="subirEvidenciaGasto(${idx}, this)" 
                      style="position:absolute; left:0; top:0; opacity:0; width:100%;">
            </div>
            
            ${g.evidenciaUrl ? `<a href="${g.evidenciaUrl}" target="_blank" title="Ver evidencia">📄</a>` : ''}
            
            <button onclick="eliminarGasto(${idx})" style="padding:0 8px;">✕</button>
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
        mostrarAlerta('⏳ Subiendo evidencia...', 'info');
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
        mostrarAlerta('✅ Evidencia guardada', 'success');

    } catch (e) {
        console.error('Error subiendo:', e);
        mostrarAlerta('Error al subir: ' + e.message, 'error');
    }

    const totalEl = document.getElementById('totalGastos');
    if (totalEl) totalEl.textContent = `$${totalGastos.toLocaleString('es-CO')}`;
}

// ═══════════════════════════════════════════════════════════════
// PRODUCTOS
// ═══════════════════════════════════════════════════════════════
async function cargarProductos() {
    try {
        const { data: prods } = await db.from('productos')
            .select('id_producto, nombre, marca, precio')
            .eq('estado', 'Activo');

        if (TIENDA.esDigital) {
            // Cargar inventarios de todas las tiendas físicas
            const [alcala, local01, jordan] = await Promise.all([
                db.from('inventario_alcala').select('id_producto, cantidad'),
                db.from('inventario_01').select('id_producto, cantidad'),
                db.from('inventario_jordan').select('id_producto, cantidad')
            ]);

            // Mapear productos con stocks detallados
            productos = (prods || []).map(p => {
                const stockAlcala = alcala.data?.find(i => i.id_producto === p.id_producto)?.cantidad || 0;
                const stock01 = local01.data?.find(i => i.id_producto === p.id_producto)?.cantidad || 0;
                const stockJordan = jordan.data?.find(i => i.id_producto === p.id_producto)?.cantidad || 0;
                const total = stockAlcala + stock01 + stockJordan;

                return {
                    ...p,
                    stock: total,
                    stocks: {
                        'Alcalá': stockAlcala,
                        'Local 01': stock01,
                        'Jordán': stockJordan
                    }
                };
            });
        } else {
            // Lógica normal para tiendas físicas
            const { data: stock } = await db.from(TIENDA.tablaInventario)
                .select('id_producto, cantidad');

            const stockMap = {};
            (stock || []).forEach(s => stockMap[s.id_producto] = s.cantidad || 0);

            productos = (prods || []).map(p => ({
                ...p,
                stock: stockMap[p.id_producto] || 0
            }));
        }

        console.log(`📦 ${productos.length} productos cargados`);
        renderizarProductos();
    } catch (e) {
        console.error('Error cargando productos:', e);
        mostrarAlerta('Error al cargar productos', 'error');
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

        if (TIENDA.esDigital) {
            // Renderizado especial para Digital con botones por tienda
            return `
            <div class="producto digital ${agotado ? 'agotado' : ''}">
                <div class="producto-info">
                    <h4>${p.nombre}</h4>
                    <small>${p.marca || 'Sin marca'} • ${p.id_producto}</small>
                    <div class="stock-breakdown">
                        ${Object.entries(p.stocks).map(([tienda, cant]) => `
                            <button class="btn-stock-tienda ${cant > 0 ? 'activo' : 'disabled'}"
                                onclick="${cant > 0 ? `agregarAlCarrito('${p.id_producto}', '${tienda}')` : ''}"
                                title="${cant > 0 ? 'Vender de ' + tienda : 'Sin stock'}">
                                ${tienda.substring(0, 3)}: ${cant}
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div class="producto-precio">
                    <span class="precio">$${(p.precio || 0).toLocaleString('es-CO')}</span>
                </div>
            </div>`;
        } else {
            // Renderizado normal para Física
            const stockClass = p.stock > 5 ? 'stock-ok' : p.stock > 0 ? 'stock-bajo' : 'stock-no';
            return `
                <div class="producto ${agotado ? 'agotado' : ''}" 
                     onclick="${agotado ? '' : `agregarAlCarrito('${p.id_producto}')`}">
                    <div class="producto-info">
                        <h4>${p.nombre}</h4>
                        <small>${p.marca || 'Sin marca'} • ${p.id_producto}</small><br>
                        <span class="stock-badge ${stockClass}">${p.stock} disp</span>
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

// ═══════════════════════════════════════════════════════════════
// CARRITO
// ═══════════════════════════════════════════════════════════════
function agregarAlCarrito(idProducto, tiendaOrigen = null) {
    const prod = productos.find(p => p.id_producto == idProducto);
    // Validación general de stock
    if (!prod) return;

    // Calcular precio y promociones
    let precioFinal = prod.precio;
    let motivo = '';

    // Usar PromocionesManager si está disponible
    if (window.PromocionesManager && window.PromocionesManager.cargado) {
        // En POS físico, intentamos usar la tienda actual como "local" para validar si aplica
        // En POS digital (TIENDA.esDigital), enviamos null o 'Digital'
        const local = TIENDA.nombre || null;
        const calc = window.PromocionesManager.calcularPrecio(prod.precio, prod.id_producto, local);

        if (calc && calc.tienePromo) {
            precioFinal = calc.precioFinal;
            motivo = `Promo: ${calc.promocion.nombre} (-${calc.descuento}%)`;
        }
    }

    // Validar tienda origen si es digital
    if (TIENDA.esDigital) {
        if (!tiendaOrigen) return mostrarAlerta('Error: tienda origen no definida', 'error');
        const stockDisp = prod.stocks[tiendaOrigen];
        if (stockDisp <= 0) return mostrarAlerta(`Sin stock en ${tiendaOrigen}`, 'error');

        // Buscar si ya existe este producto DE ESTA TIENDA en el carrito
        const existe = carrito.find(i => i.id_producto == idProducto && i.tiendaOrigen === tiendaOrigen);
        if (existe) {
            if (existe.cantidad >= stockDisp) {
                mostrarAlerta(`Stock máximo de ${tiendaOrigen} alcanzado`, 'warning');
                return;
            }
            existe.cantidad++;
        } else {
            carrito.push({
                id_producto: prod.id_producto,
                nombre: `${prod.nombre} (${tiendaOrigen})`, // Diferenciar visualmente
                nombreBase: prod.nombre,
                marca: prod.marca,
                precioOriginal: prod.precio,
                precio: precioFinal,
                cantidad: 1,
                stockMax: stockDisp,
                tiendaOrigen: tiendaOrigen,
                motivo: motivo
            });
        }
    } else {
        // Lógica física normal
        if (prod.stock <= 0) return;
        const existe = carrito.find(i => i.id_producto == idProducto);
        if (existe) {
            if (existe.cantidad >= prod.stock) {
                mostrarAlerta('Stock máximo alcanzado', 'warning');
                return;
            }
            existe.cantidad++;
        } else {
            carrito.push({
                id_producto: prod.id_producto,
                nombre: prod.nombre,
                marca: prod.marca,
                precioOriginal: prod.precio,
                precio: precioFinal,
                cantidad: 1,
                stockMax: prod.stock,
                motivo: motivo
            });
        }
    }

    renderizarCarrito();

    if (precioFinal < prod.precio) {
        mostrarAlerta(`➕ ${prod.nombre} (con descuento)`, 'success');
    } else {
        mostrarAlerta(`➕ ${prod.nombre}`, 'success');
    }
}

function renderizarCarrito() {
    const container = document.getElementById('carritoItems');
    const countEl = document.getElementById('carritoCount');
    const totalEl = document.getElementById('totalMonto');

    const totalItems = carrito.reduce((sum, i) => sum + i.cantidad, 0);
    countEl.textContent = totalItems;

    if (carrito.length === 0) {
        container.innerHTML = `<div class="carrito-vacio">🛒 ${TIENDA.esDigital ? 'El pedido está vacío' : 'El carrito está vacío'}</div>`;
        totalEl.textContent = '$0';
        actualizarBotonVender();
        return;
    }

    const total = carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
    totalEl.textContent = '$' + total.toLocaleString('es-CO');

    container.innerHTML = carrito.map((item, idx) => {
        const tieneDescuento = item.precio < item.precioOriginal;
        return `
            <div class="carrito-item">
                <div class="carrito-item-info">
                    <strong>${item.nombre}</strong>
                    <small>
                        ${tieneDescuento ? `<span class="precio-descuento">$${item.precioOriginal.toLocaleString('es-CO')}</span>` : ''}
                        $${item.precio.toLocaleString('es-CO')} × ${item.cantidad} = $${(item.precio * item.cantidad).toLocaleString('es-CO')}
                        ${tieneDescuento ? `<span class="motivo-descuento">🏷️ ${item.motivo}</span>` : ''}
                    </small>
                </div>
                <div class="carrito-item-acciones">
                    <button class="btn-editar-precio" onclick="abrirEditarPrecio(${idx})">✏️</button>
                    <button class="btn-cantidad-menos" onclick="cambiarCantidad(${idx}, -1)">−</button>
                    <span class="cantidad-display">${item.cantidad}</span>
                    <button class="btn-cantidad-mas" onclick="cambiarCantidad(${idx}, 1)">+</button>
                    <button class="btn-quitar" onclick="quitarDelCarrito(${idx})">×</button>
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

// ═══════════════════════════════════════════════════════════════
// EDITAR PRECIO
// ═══════════════════════════════════════════════════════════════
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
    mostrarAlerta('✅ Precio actualizado', 'success');
}

// ═══════════════════════════════════════════════════════════════
// MÉTODOS DE PAGO
// ═══════════════════════════════════════════════════════════════
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
        infoEl.textContent = '✅ ' + [...metodosSeleccionados].join(' + ');
        infoEl.classList.add('visible');
    } else {
        infoEl.classList.remove('visible');
    }

    actualizarCredito();
    actualizarBotonVender();
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

// ═══════════════════════════════════════════════════════════════
// PROCESAR VENTA (TIENDA FÍSICA)
// ═══════════════════════════════════════════════════════════════
async function procesarVenta() {
    if (!cajaAbierta) return mostrarAlerta('❌ Primero abre la caja', 'error');
    if (carrito.length === 0) return mostrarAlerta('❌ El carrito está vacío', 'error');
    if (metodosSeleccionados.size === 0) return mostrarAlerta('❌ Selecciona al menos un método de pago', 'error');

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
            return mostrarAlerta('❌ Completa todos los datos del crédito', 'error');
        }
    }

    const btnVender = document.getElementById('btnVender');
    btnVender.disabled = true;
    btnVender.innerHTML = '⏳ Procesando...';

    const localRegistro = destino === 'digital' ? `Digital (${TIENDA.nombre})` : TIENDA.nombre;
    const metodoPagoStr = [...metodosSeleccionados].join(' + ');

    try {
        for (const item of carrito) {
            const id_venta = 'V' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();

            const { error: errorVenta } = await db.from('ventas').insert({
                id_venta: id_venta,
                local: localRegistro,
                id_producto: item.id_producto,
                nombre_producto: item.nombre,
                cantidad: item.cantidad,
                precio_unitario: item.precio,
                total: item.precio * item.cantidad,
                metodo_pago: metodoPagoStr,
                usuario: `POS ${TIENDA.nombre}`
            });

            if (errorVenta) throw new Error(errorVenta.message);

            // Descontar stock
            const { data: stockActual } = await db
                .from(TIENDA.tablaInventario)
                .select('cantidad')
                .eq('id_producto', item.id_producto)
                .single();

            if (stockActual) {
                const nuevoStock = Math.max(0, stockActual.cantidad - item.cantidad);
                await db.from(TIENDA.tablaInventario)
                    .update({ cantidad: nuevoStock })
                    .eq('id_producto', item.id_producto);
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

        const total = carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);

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
                mostrarAlerta('⚠️ Venta ok, pero error al registrar crédito: ' + errorCredito.message, 'warning');
            } else {
                console.log('✅ Crédito Motero registrado:', numeroCredito);
            }
        }

        const msg = destino === 'digital'
            ? `📦 Transferido a Digital: $${total.toLocaleString('es-CO')}`
            : `✅ Venta exitosa: $${total.toLocaleString('es-CO')}`;

        if (window.moterosIA) {
            window.moterosIA.aprenderEvento('Venta realizada en tienda', {
                tienda: TIENDA.nombre,
                total: total,
                items: carrito.length
            });
        }

        mostrarAlerta(msg, 'success');
        limpiarDespuesVenta();
        await cargarProductos();

    } catch (error) {
        console.error('Error procesando venta:', error);
        mostrarAlerta('❌ ' + error.message, 'error');
    }

    btnVender.innerHTML = '✅ Procesar Venta';
    actualizarBotonVender();
}

// ═══════════════════════════════════════════════════════════════
// PROCESAR VENTA (TIENDA DIGITAL) + CREAR ENVÍO
// ═══════════════════════════════════════════════════════════════
async function procesarVentaDigital() {
    if (!cajaAbierta) return mostrarAlerta('❌ Abre la caja', 'error');
    if (carrito.length === 0) return mostrarAlerta('❌ Pedido vacío', 'error');
    if (metodosSeleccionados.size === 0) return mostrarAlerta('❌ Selecciona método de pago', 'error');

    // Validar datos de envío (obligatorios para digital)
    const clienteNombre = document.getElementById('clienteNombre').value.trim();
    const clienteTelefono = document.getElementById('clienteTelefono').value.trim();
    const clienteCedula = document.getElementById('clienteCedula').value.trim();
    const direccionEnvio = document.getElementById('direccionEnvio').value.trim();
    const ciudadEnvio = document.getElementById('ciudadEnvio').value.trim();
    const departamentoEnvio = document.getElementById('departamentoEnvio').value;
    const notasEnvio = document.getElementById('notasEnvio').value.trim();

    if (!clienteNombre || !clienteTelefono || !clienteCedula || !direccionEnvio || !ciudadEnvio || !departamentoEnvio) {
        return mostrarAlerta('❌ Completa todos los datos de envío', 'error');
    }

    // Validar crédito
    const tieneCredito = [...metodosSeleccionados].some(m => METODOS_CREDITO.includes(m));
    let creditoAutoriza = '';
    let creditoCuotas = 1;

    if (tieneCredito) {
        creditoAutoriza = document.getElementById('creditoAutoriza').value;
        creditoCuotas = parseInt(document.getElementById('creditoCuotas').value) || 1;
        if (!creditoAutoriza) return mostrarAlerta('❌ Selecciona quién autoriza el crédito', 'error');
    }

    const btnVender = document.getElementById('btnVender');
    btnVender.disabled = true;
    btnVender.innerHTML = '⏳ Procesando...';

    const metodoPagoStr = [...metodosSeleccionados].join(' + ');
    const pedidoTimestamp = Date.now();
    let primerIdVenta = null;

    try {
        for (const item of carrito) {
            const id_venta = 'VD' + pedidoTimestamp + Math.random().toString(36).substr(2, 5).toUpperCase();
            if (!primerIdVenta) primerIdVenta = id_venta;

            const tieneDescuento = item.precio < item.precioOriginal;

            const ventaData = {
                id_venta: id_venta,
                local: 'Digital',
                id_producto: item.id_producto,
                nombre_producto: item.nombre,
                cantidad: item.cantidad,
                precio_unitario: item.precio,
                total: item.precio * item.cantidad,
                metodo_pago: metodoPagoStr,
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
                credito_estado: tieneCredito ? 'Pendiente' : null
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

        // ═══════════════════════════════════════════════════════════════
        // CREAR ENVÍO AUTOMÁTICO EN TABLA envios
        // ═══════════════════════════════════════════════════════════════
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
        // ═══════════════════════════════════════════════════════════════

        const total = carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);

        if (window.moterosIA) {
            window.moterosIA.aprenderEvento('Pedido digital registrado', {
                cliente: clienteNombre,
                total: total,
                items: carrito.length
            });
        }

        mostrarAlerta(`✅ Pedido registrado: $${total.toLocaleString('es-CO')}`, 'success');

        limpiarDespuesVentaDigital();
        await cargarProductos();

    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('❌ ' + error.message, 'error');
    }

    btnVender.innerHTML = '📦 Registrar Pedido';
    actualizarBotonVender();
}

// ═══════════════════════════════════════════════════════════════
// LIMPIAR DESPUÉS DE VENTA
// ═══════════════════════════════════════════════════════════════
function limpiarDespuesVenta() {
    carrito = [];
    metodosSeleccionados.clear();
    document.querySelectorAll('.metodo-btn').forEach(m => m.classList.remove('selected'));
    document.getElementById('metodosSeleccionados')?.classList.remove('visible');
    limpiarFormCredito();
    renderizarCarrito();
}

function limpiarDespuesVentaDigital() {
    carrito = [];
    metodosSeleccionados.clear();
    document.querySelectorAll('.metodo-btn').forEach(m => m.classList.remove('selected'));
    document.getElementById('metodosSeleccionados')?.classList.remove('visible');
    document.getElementById('datosCredito')?.classList.remove('visible');

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

// ═══════════════════════════════════════════════════════════════
// MODALES Y ALERTAS
// ═══════════════════════════════════════════════════════════════
function cerrarModal() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('visible'));
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