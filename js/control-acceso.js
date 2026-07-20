// ═══════════════════════════════════════════════════════════════
// MOTEROS SPORTS LINE - CONTROL DE ACCESO, TURNOS Y NOVEDADES
// ═══════════════════════════════════════════════════════════════

let turnoActualEmpleado = null;
let registrosTurnosCache = [];
let empleadosListaCache = [];

/**
 * Obtiene el dispositivo o info del cliente para auditoría anti-fraude
 */
function obtenerInfoDispositivo() {
    const ua = navigator.userAgent;
    const isMobile = /mobile/i.test(ua) ? 'Móvil' : 'Escritorio';
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    return `[${isMobile}] ${screenWidth}x${screenHeight} - ${navigator.platform}`;
}

/**
 * Ejecuta insert o update en registro_turnos con fallback automático si faltan columnas en el schema de Supabase.
 */
async function ejecutarOperacionTurnoResiliente(tipo, payload, id = null) {
    const copia = { ...payload };

    const intentar = async (datos) => {
        if (tipo === 'insert') {
            return await window.supabaseClient.from('registro_turnos').insert([datos]);
        } else {
            return await window.supabaseClient.from('registro_turnos').update(datos).eq('id', id);
        }
    };

    let res = await intentar(copia);

    if (res.error) {
        const msg = res.error.message || '';
        // Si el error indica columna faltante (dispositivo_info, tipo_novedad, etc.)
        if (msg.includes('dispositivo_info') || msg.includes('tipo_novedad') || msg.includes('modificado_por_admin') || res.error.code === 'PGRST204') {
            console.warn('[ControlAcceso] Faltan columnas en schema cache, reintentando sin campos opcionales:', msg);
            delete copia.dispositivo_info;
            delete copia.tipo_novedad;
            delete copia.modificado_por_admin;

            res = await intentar(copia);
            if (res.error) throw res.error;
        } else {
            throw res.error;
        }
    }

    return res;
}
window.ejecutarOperacionTurnoResiliente = ejecutarOperacionTurnoResiliente;

/**
 * Verifica las credenciales de un empleado (PIN / Contraseña) y registra la acción de turno.
 * @param {string} accion - 'entrada' | 'inicio_almuerzo' | 'fin_almuerzo' | 'salida'
 * @param {Object} payload - { empleadoId, pin, local, observaciones }
 */
async function procesarRegistroTurnoEmpleado(accion, payload) {
    if (!window.supabaseClient) {
        throw new Error('Sin conexión con el servidor Supabase.');
    }

    const { empleadoId, pin, local, observaciones } = payload;

    if (!empleadoId) {
        throw new Error('Selecciona un empleado de la lista.');
    }
    if (!pin) {
        throw new Error('Por favor ingresa tu contraseña o PIN de seguridad.');
    }
    if (!local) {
        throw new Error('Selecciona la tienda o local de trabajo.');
    }

    // 1. Validar identidad en empleados_tienda
    const { data: empleado, error: errEmp } = await window.supabaseClient
        .from('empleados_tienda')
        .select('*')
        .eq('id', empleadoId)
        .eq('activo', true)
        .single();

    if (errEmp || !empleado) {
        throw new Error('Empleado no encontrado o cuenta inactiva.');
    }

    // Validar contraseña o cédula o PIN (se compara contra password o cédula)
    const pinStr = String(pin).trim();
    const passValido = (empleado.password && String(empleado.password).trim() === pinStr) ||
                       (empleado.cedula && String(empleado.cedula).trim() === pinStr);

    if (!passValido) {
        throw new Error('🔒 Contraseña / PIN de seguridad incorrecto.');
    }

    // 2. Buscar el registro de turno de HOY para este empleado
    const fechaHoy = new Date().toISOString().split('T')[0];
    const { data: turnoHoy, error: errTurno } = await window.supabaseClient
        .from('registro_turnos')
        .select('*')
        .eq('empleado_id', empleado.id)
        .eq('fecha', fechaHoy)
        .maybeSingle();

    if (errTurno && errTurno.code !== 'PGRST116') {
        console.error('Error buscando turno:', errTurno);
    }

    const ahoraISO = new Date().toISOString();
    const infoDispositivo = obtenerInfoDispositivo();

    // 3. Validar estado y secuencia de botones
    if (accion === 'entrada') {
        if (turnoHoy && turnoHoy.hora_entrada && turnoHoy.estado_actual !== 'fuera') {
            throw new Error(`Ya registraste tu entrada el día de hoy a las ${new Date(turnoHoy.hora_entrada).toLocaleTimeString()}.`);
        }

        // Crear nuevo turno
        const nuevoTurno = {
            empleado_id: empleado.id,
            empleado_nombre: empleado.nombre,
            cedula: empleado.cedula || '',
            local: local,
            fecha: fechaHoy,
            hora_entrada: ahoraISO,
            estado_actual: 'en_turno',
            tipo_novedad: 'normal',
            observaciones: observaciones || 'Ingreso registrado correctamente',
            dispositivo_info: infoDispositivo,
            created_at: ahoraISO,
            updated_at: ahoraISO
        };

        // Guardar o actualizar turno de forma resiliente ante columnas opcionales
        await ejecutarOperacionTurnoResiliente(
            turnoHoy ? 'update' : 'insert',
            nuevoTurno,
            turnoHoy ? turnoHoy.id : null
        );

        return { exito: true, mensaje: `🚀 ¡Bienvenido ${empleado.nombre}! Entrada registrada a las ${new Date(ahoraISO).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}.` };
    }

    // Para el resto de acciones, se requiere que ya haya registrado Entrada hoy
    if (!turnoHoy || !turnoHoy.hora_entrada) {
        throw new Error('Primero debes registrar tu ENTRADA DE TURNO antes de realizar otra marcación.');
    }

    if (accion === 'inicio_almuerzo') {
        if (turnoHoy.estado_actual === 'en_almuerzo') {
            throw new Error('Ya te encuentras registrado en tiempo de almuerzo.');
        }
        if (turnoHoy.estado_actual === 'finalizado') {
            throw new Error('Tu turno del día ya ha sido finalizado.');
        }
        if (turnoHoy.hora_inicio_almuerzo) {
            throw new Error('Ya habías registrado la salida a almuerzo el día de hoy.');
        }

        await ejecutarOperacionTurnoResiliente('update', {
            hora_inicio_almuerzo: ahoraISO,
            estado_actual: 'en_almuerzo',
            observaciones: observaciones ? `${turnoHoy.observaciones || ''} | Almuerzo: ${observaciones}` : turnoHoy.observaciones,
            dispositivo_info: infoDispositivo,
            updated_at: ahoraISO
        }, turnoHoy.id);

        return { exito: true, mensaje: `🍕 ¡Buen provecho, ${empleado.nombre}! Inicio de almuerzo registrado.` };
    }

    if (accion === 'fin_almuerzo') {
        if (turnoHoy.estado_actual === 'en_turno' && turnoHoy.hora_fin_almuerzo) {
            throw new Error('Ya habías registrado el regreso de almuerzo.');
        }
        if (!turnoHoy.hora_inicio_almuerzo) {
            throw new Error('No registraste previamente el INICIO DE ALMUERZO.');
        }

        await ejecutarOperacionTurnoResiliente('update', {
            hora_fin_almuerzo: ahoraISO,
            estado_actual: 'en_turno',
            observaciones: observaciones ? `${turnoHoy.observaciones || ''} | Regreso: ${observaciones}` : turnoHoy.observaciones,
            dispositivo_info: infoDispositivo,
            updated_at: ahoraISO
        }, turnoHoy.id);

        return { exito: true, mensaje: `💪 ¡De regreso al trabajo, ${empleado.nombre}! Regreso de almuerzo registrado.` };
    }

    if (accion === 'salida') {
        if (turnoHoy.estado_actual === 'finalizado') {
            throw new Error('Tu salida de turno ya fue registrada el día de hoy.');
        }
        if (turnoHoy.estado_actual === 'en_almuerzo') {
            throw new Error('Debes registrar tu REGRESO DE ALMUERZO antes de marcar la Salida de Turno.');
        }

        await ejecutarOperacionTurnoResiliente('update', {
            hora_salida: ahoraISO,
            estado_actual: 'finalizado',
            observaciones: observaciones ? `${turnoHoy.observaciones || ''} | Salida: ${observaciones}` : turnoHoy.observaciones,
            dispositivo_info: infoDispositivo,
            updated_at: ahoraISO
        }, turnoHoy.id);

        return { exito: true, mensaje: `🚪 ¡Excelente jornada, ${empleado.nombre}! Salida de turno registrada.` };
    }

    throw new Error('Acción no válida.');
}
window.procesarRegistroTurnoEmpleado = procesarRegistroTurnoEmpleado;

// ═══════════════════════════════════════════════════════════════
// MÓDULO ADMINISTRATIVO DE ACCESO Y NOVEDADES (admin.html)
// ═══════════════════════════════════════════════════════════════

async function inicializarPanelControlAccesoAdmin() {
    const contenedor = document.getElementById('tbodyControlAccesoAdmin');
    if (!contenedor) return;

    contenedor.innerHTML = '<tr><td colspan="9" class="text-center"><i class="fas fa-spinner fa-spin"></i> Cargando control de asistencia y turnos...</td></tr>';

    try {
        const [resTurnos, resEmps] = await Promise.all([
            window.supabaseClient
                .from('registro_turnos')
                .select('*')
                .order('fecha', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(300),
            window.supabaseClient
                .from('empleados_tienda')
                .select('id, nombre, cedula, cargo')
                .eq('activo', true)
                .order('nombre')
        ]);

        if (resTurnos.error) throw resTurnos.error;
        registrosTurnosCache = resTurnos.data || [];
        empleadosListaCache = resEmps.data || [];

        poblarSelectsAccesoAdmin();
        filtrarAccesoAdmin();

    } catch (e) {
        console.error('Error cargando control acceso admin:', e);
        contenedor.innerHTML = '<tr><td colspan="9" class="text-center text-danger"><i class="fas fa-exclamation-triangle"></i> Error al cargar datos de turnos</td></tr>';
    }
}
window.inicializarPanelControlAccesoAdmin = inicializarPanelControlAccesoAdmin;

function poblarSelectsAccesoAdmin() {
    const selectEmpFilter = document.getElementById('filtroAccesoEmpleado');
    const selectEmpNovedad = document.getElementById('novedadEmpleadoId');

    if (selectEmpFilter) {
        let html = '<option value="">👥 Todos los Empleados</option>';
        empleadosListaCache.forEach(e => {
            html += `<option value="${e.id}">${e.nombre}</option>`;
        });
        selectEmpFilter.innerHTML = html;
    }

    if (selectEmpNovedad) {
        let html = '<option value="">-- Seleccionar Empleado --</option>';
        empleadosListaCache.forEach(e => {
            html += `<option value="${e.id}">${e.nombre} (${e.cargo || 'Empleado'})</option>`;
        });
        selectEmpNovedad.innerHTML = html;
    }
}

function filtrarAccesoAdmin() {
    const fechaInput = document.getElementById('filtroAccesoFecha');
    const fecha = fechaInput ? fechaInput.value : '';
    const local = document.getElementById('filtroAccesoLocal')?.value || '';
    const empId = document.getElementById('filtroAccesoEmpleado')?.value || '';
    const novedad = document.getElementById('filtroAccesoNovedad')?.value || '';

    let filtrados = registrosTurnosCache.filter(t => {
        if (fecha && String(t.fecha).split('T')[0] !== fecha) return false;
        if (local && t.local !== local) return false;
        if (empId && String(t.empleado_id) !== String(empId)) return false;
        if (novedad && t.tipo_novedad !== novedad) return false;
        return true;
    });

    renderizarTablaAccesoAdmin(filtrados);
    actualizarTarjetasEstadoAdmin(fecha || new Date().toISOString().split('T')[0]);
}
window.filtrarAccesoAdmin = filtrarAccesoAdmin;

function actualizarTarjetasEstadoAdmin(fechaRef) {
    const registrosFecha = registrosTurnosCache.filter(t => String(t.fecha).split('T')[0] === fechaRef);

    const enTurno = registrosFecha.filter(t => t.estado_actual === 'en_turno').length;
    const enAlmuerzo = registrosFecha.filter(t => t.estado_actual === 'en_almuerzo').length;
    const finalizados = registrosFecha.filter(t => t.estado_actual === 'finalizado').length;
    const conNovedad = registrosFecha.filter(t => t.tipo_novedad && t.tipo_novedad !== 'normal').length;

    const totalActivos = empleadosListaCache.length;
    const registrados = new Set(registrosFecha.map(t => String(t.empleado_id))).size;
    const sinRegistrar = totalActivos - registrados;

    const elEnTurno = document.getElementById('accesoMetricaEnTurno');
    const elEnAlmuerzo = document.getElementById('accesoMetricaEnAlmuerzo');
    const elFinalizados = document.getElementById('accesoMetricaFinalizados');
    const elSinRegistrar = document.getElementById('accesoMetricaSinRegistrar');
    const elNovedades = document.getElementById('accesoMetricaNovedades');

    if (elEnTurno) elEnTurno.textContent = enTurno;
    if (elEnAlmuerzo) elEnAlmuerzo.textContent = enAlmuerzo;
    if (elFinalizados) elFinalizados.textContent = finalizados;
    if (elSinRegistrar) elSinRegistrar.textContent = sinRegistrar > 0 ? sinRegistrar : 0;
    if (elNovedades) elNovedades.textContent = conNovedad;
}

function renderizarTablaAccesoAdmin(lista) {
    const tbody = document.getElementById('tbodyControlAccesoAdmin');
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted" style="padding:2rem;">No hay registros de turno o novedades para los filtros seleccionados.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(item => {
        const fechaNorm = String(item.fecha || '').split('T')[0];
        const hEntrada = item.hora_entrada ? new Date(item.hora_entrada).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-';
        const hIniAlm = item.hora_inicio_almuerzo ? new Date(item.hora_inicio_almuerzo).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-';
        const hFinAlm = item.hora_fin_almuerzo ? new Date(item.hora_fin_almuerzo).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-';
        const hSalida = item.hora_salida ? new Date(item.hora_salida).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-';

        // Calcular duración almuerzo
        let durAlmuerzoStr = '-';
        if (item.hora_inicio_almuerzo && item.hora_fin_almuerzo) {
            const minAlm = Math.round((new Date(item.hora_fin_almuerzo) - new Date(item.hora_inicio_almuerzo)) / 60000);
            durAlmuerzoStr = `${minAlm} min`;
            if (minAlm > 60) {
                durAlmuerzoStr += ` <span style="color:#ef4444; font-weight:bold;" title="Excedió 1 hora">⚠️</span>`;
            }
        }

        // Estado Badge
        let badgeEstado = '<span class="badge bg-secondary">Fuera</span>';
        if (item.estado_actual === 'en_turno') badgeEstado = '<span class="badge bg-success">🟢 En Turno</span>';
        if (item.estado_actual === 'en_almuerzo') badgeEstado = '<span class="badge bg-warning text-dark">🍕 En Almuerzo</span>';
        if (item.estado_actual === 'finalizado') badgeEstado = '<span class="badge bg-info text-dark">🏁 Salida / Finalizado</span>';

        // Novedad Badge
        let badgeNovedad = '<span style="font-size:0.75rem; color:#64748b;">Normal</span>';
        if (item.tipo_novedad === 'llegada_tarde') badgeNovedad = '<span class="badge bg-danger">⏰ Llegada Tarde</span>';
        if (item.tipo_novedad === 'inasistencia') badgeNovedad = '<span class="badge bg-dark">❌ Inasistencia</span>';
        if (item.tipo_novedad === 'incapacidad') badgeNovedad = '<span class="badge bg-primary">🏥 Incapacidad</span>';
        if (item.tipo_novedad === 'permiso') badgeNovedad = '<span class="badge bg-info">📄 Permiso</span>';
        if (item.tipo_novedad === 'ajuste_manual') badgeNovedad = '<span class="badge bg-secondary">🔧 Ajuste Admin</span>';

        return `
            <tr>
                <td><strong>${fechaNorm}</strong></td>
                <td>
                    <strong style="color:#0f172a;">${item.empleado_nombre}</strong>
                    <div style="font-size:0.75rem; color:#64748b;">CC: ${item.cedula || 'N/A'}</div>
                </td>
                <td><span style="font-weight:600; color:#3b82f6;">${item.local}</span></td>
                <td>${badgeEstado}</td>
                <td style="white-space:nowrap;">
                    <div>🚀 Ent: <strong>${hEntrada}</strong></div>
                    <div>🚪 Sal: <strong>${hSalida}</strong></div>
                </td>
                <td style="white-space:nowrap;">
                    <div>🍕 Sal: ${hIniAlm}</div>
                    <div>☕ Reg: ${hFinAlm}</div>
                    <div style="font-size:0.75rem;">Total: ${durAlmuerzoStr}</div>
                </td>
                <td>${badgeNovedad}</td>
                <td style="font-size:0.8rem; color:#475569; max-width:200px;">
                    <div style="font-weight:600; color:#1e293b;">${item.observaciones || '-'}</div>
                    ${item.modificado_por_admin ? `<div style="font-size:0.7rem; color:#3b82f6; margin-top:2px;">Ed. Admin: ${item.modificado_por_admin}</div>` : ''}
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="prepararEdicionNovedadTurno('${item.id}')" title="Editar Novedad u Horario">
                        ✏️ Editar
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Registra o modifica una novedad/asistencia por parte del Administrador.
 */
async function guardarNovedadAdmin() {
    const rawEmpId = document.getElementById('novedadEmpleadoId').value;
    const fecha = document.getElementById('novedadFecha').value;
    const local = document.getElementById('novedadLocal').value;
    const tipoNovedad = document.getElementById('novedadTipo').value;
    const observaciones = document.getElementById('novedadObservacion').value.trim();
    const horaEntradaVal = document.getElementById('novedadHoraEntrada').value;
    const horaSalidaVal = document.getElementById('novedadHoraSalida').value;

    if (!rawEmpId || !fecha || !local) {
        alert('Por favor completa empleado, fecha y local.');
        return;
    }

    const empIdNum = Number(rawEmpId);
    const emp = empleadosListaCache.find(e => String(e.id) === String(rawEmpId));
    const empNombre = emp ? emp.nombre : 'Empleado';
    const cedula = emp ? emp.cedula : '';

    let horaEntradaISO = null;
    let horaSalidaISO = null;
    if (horaEntradaVal) horaEntradaISO = new Date(`${fecha}T${horaEntradaVal}`).toISOString();
    if (horaSalidaVal) horaSalidaISO = new Date(`${fecha}T${horaSalidaVal}`).toISOString();

    let adminNombre = 'Administrador';
    try {
        const sesionStr = localStorage.getItem('gestor_session') || localStorage.getItem('admin_user');
        if (sesionStr) {
            const parsed = JSON.parse(sesionStr);
            if (parsed.nombre) adminNombre = parsed.nombre;
        }
    } catch(e){}

    try {
        // Buscar si existe turno en la fecha (probando con bigint o string)
        const { data: exist } = await window.supabaseClient
            .from('registro_turnos')
            .select('*')
            .eq('empleado_id', empIdNum)
            .eq('fecha', fecha)
            .maybeSingle();

        const payload = {
            empleado_id: empIdNum,
            empleado_nombre: empNombre,
            cedula: cedula,
            local: local,
            fecha: fecha,
            tipo_novedad: tipoNovedad,
            observaciones: observaciones,
            modificado_por_admin: adminNombre,
            updated_at: new Date().toISOString()
        };

        if (horaEntradaISO) payload.hora_entrada = horaEntradaISO;
        if (horaSalidaISO) payload.hora_salida = horaSalidaISO;

        if (tipoNovedad === 'inasistencia') {
            payload.estado_actual = 'finalizado';
        } else if (exist) {
            payload.estado_actual = exist.estado_actual;
        } else {
            payload.estado_actual = horaSalidaISO ? 'finalizado' : 'en_turno';
        }

        await ejecutarOperacionTurnoResiliente(
            exist ? 'update' : 'insert',
            payload,
            exist ? exist.id : null
        );

        alert('✅ Novedad / Ajuste guardado correctamente');
        limpiarFormularioNovedad();

        // Ajustar el filtro de fecha a la fecha de la novedad para que se vea inmediatamente
        const filtroFechaInput = document.getElementById('filtroAccesoFecha');
        if (filtroFechaInput) {
            filtroFechaInput.value = fecha;
        }

        await inicializarPanelControlAccesoAdmin();

    } catch (err) {
        console.error('Error guardando novedad:', err);
        alert('Error al guardar novedad: ' + (err.message || 'Error desconocido'));
    }
}
window.guardarNovedadAdmin = guardarNovedadAdmin;

function limpiarFormularioNovedad() {
    const elEmp = document.getElementById('novedadEmpleadoId');
    const elObs = document.getElementById('novedadObservacion');
    const elEnt = document.getElementById('novedadHoraEntrada');
    const elSal = document.getElementById('novedadHoraSalida');
    const elTipo = document.getElementById('novedadTipo');

    if (elEmp) elEmp.value = '';
    if (elObs) elObs.value = '';
    if (elEnt) elEnt.value = '';
    if (elSal) elSal.value = '';
    if (elTipo) elTipo.value = 'llegada_tarde';
}
window.limpiarFormularioNovedad = limpiarFormularioNovedad;

function prepararEdicionNovedadTurno(idRecord) {
    const reg = registrosTurnosCache.find(r => r.id === idRecord);
    if (!reg) return;

    document.getElementById('novedadEmpleadoId').value = reg.empleado_id;
    document.getElementById('novedadFecha').value = reg.fecha;
    document.getElementById('novedadLocal').value = reg.local;
    document.getElementById('novedadTipo').value = reg.tipo_novedad || 'normal';
    document.getElementById('novedadObservacion').value = reg.observaciones || '';

    if (reg.hora_entrada) {
        const dt = new Date(reg.hora_entrada);
        document.getElementById('novedadHoraEntrada').value = dt.toTimeString().substring(0,5);
    } else {
        document.getElementById('novedadHoraEntrada').value = '';
    }

    if (reg.hora_salida) {
        const dt = new Date(reg.hora_salida);
        document.getElementById('novedadHoraSalida').value = dt.toTimeString().substring(0,5);
    } else {
        document.getElementById('novedadHoraSalida').value = '';
    }

    // Scroll hacia el panel de novedad
    const formEl = document.getElementById('panelFormularioNovedades');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
}
window.prepararEdicionNovedadTurno = prepararEdicionNovedadTurno;

function limpiarFormularioNovedad() {
    document.getElementById('novedadEmpleadoId').value = '';
    document.getElementById('novedadFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('novedadLocal').value = 'Alcalá';
    document.getElementById('novedadTipo').value = 'normal';
    document.getElementById('novedadObservacion').value = '';
    document.getElementById('novedadHoraEntrada').value = '';
    document.getElementById('novedadHoraSalida').value = '';
}
window.limpiarFormularioNovedad = limpiarFormularioNovedad;
