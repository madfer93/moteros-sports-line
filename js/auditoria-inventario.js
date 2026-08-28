// ═══════════════════════════════════════════════════════════════
// MOTEROS SPORTS LINE - MÓDULO DE AUDITORÍA DE INVENTARIO
// ═══════════════════════════════════════════════════════════════

/**
 * Registra un evento de auditoría cuando un empleado o admin modifica inventario o productos.
 */
async function registrarAuditoriaInventario(datos) {
    if (!window.supabaseClient) return;
    try {
        const payload = {
            producto_id: String(datos.producto_id || 'N/A'),
            producto_nombre: datos.producto_nombre || 'Producto sin nombre',
            producto_codigo: datos.producto_codigo || '',
            empleado_id: String(datos.empleado_id || ''),
            empleado_nombre: datos.empleado_nombre || 'Empleado no especificado',
            tipo_accion: datos.tipo_accion || 'Modificación',
            local: datos.local || 'General',
            talla_color: datos.talla_color || '',
            cantidad_anterior: datos.cantidad_anterior !== undefined ? Number(datos.cantidad_anterior) : null,
            cantidad_nueva: datos.cantidad_nueva !== undefined ? Number(datos.cantidad_nueva) : null,
            precio_anterior: datos.precio_anterior !== undefined ? Number(datos.precio_anterior) : null,
            precio_nuevo: datos.precio_nuevo !== undefined ? Number(datos.precio_nuevo) : null,
            detalles: datos.detalles || {},
            created_at: new Date().toISOString()
        };

        const { error } = await window.supabaseClient
            .from('auditoria_inventario')
            .insert([payload]);

        if (error) {
            console.warn('[Auditoría] Registro de auditoría omitido (RLS/Permisos Supabase):', error.message || error);
        }
    } catch (e) {
        console.warn('[Auditoría] Excepción inesperada en auditoría:', e.message || e);
    }
}
window.registrarAuditoriaInventario = registrarAuditoriaInventario;

/**
 * Estado local para la vista de Auditoría en Admin
 */
let auditoriaCache = [];

/**
 * Carga e inicializa el panel de auditoría de inventario conectando con todas las tablas existentes en Supabase
 * (auditoria_inventario, inventario_alcala, inventario_01, inventario_jordan y movimientos_transferencia).
 */
async function inicializarPanelAuditoriaInventario() {
    const contenedor = document.getElementById('tbodyAuditoriaInventario');
    if (!contenedor) return;

    contenedor.innerHTML = '<tr><td colspan="8" class="text-center"><i class="fas fa-spinner fa-spin"></i> Cargando auditoría e inventarios desde Supabase...</td></tr>';

    try {
        // 1. Cargar Empleados directamente de Supabase para llenar el filtro
        await poblarFiltrosAuditoria();

        // 2. Consulta paralela a todas las fuentes de datos de inventario en Supabase
        const [resAudit, resUnificado, resAlc, res01, resJor, resTraslados] = await Promise.all([
            window.supabaseClient
                .from('auditoria_inventario')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(200),
            window.supabaseClient
                .from('inventario')
                .select('*')
                .order('ultima_actualizacion', { ascending: false })
                .limit(200),
            window.supabaseClient
                .from('inventario_alcala')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100),
            window.supabaseClient
                .from('inventario_01')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100),
            window.supabaseClient
                .from('inventario_jordan')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100),
            window.supabaseClient
                .from('movimientos_transferencia')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100)
        ]);

        const auditRows = resAudit.data || [];
        const unificadoRows = resUnificado.data || [];
        const alcRows = resAlc.data || [];
        const o1Rows = res01.data || [];
        const jorRows = resJor.data || [];
        const trasladosRows = resTraslados.data || [];

        // 3. Cargar catálogo de productos para mapear nombres por id_producto o id
        let prodMap = {};
        try {
            const { data: prods } = await window.supabaseClient
                .from('productos')
                .select('id, id_producto, nombre, referencia');

            (prods || []).forEach(p => {
                if (p.id_producto) prodMap[p.id_producto] = p;
                if (p.id) prodMap[String(p.id)] = p;
            });
        } catch (eProd) {
            console.warn('[Auditoría] No se pudieron mapear nombres de productos:', eProd);
        }

        const registrosMapeados = [];

        // Add auditoria_inventario
        auditRows.forEach(a => {
            registrosMapeados.push({
                ...a,
                id: a.id || `aud_${Math.random()}`,
                producto_nombre: a.producto_nombre || prodMap[a.producto_id]?.nombre || a.producto_id,
                producto_codigo: a.producto_codigo || prodMap[a.producto_id]?.referencia || ''
            });
        });

        // Add inventario unificado (Bodega, Alcalá, Local 01, Jordán)
        unificadoRows.forEach(item => {
            const infoP = prodMap[item.producto_id] || {};
            registrosMapeados.push({
                id: item.id || `inv_${item.ultima_actualizacion}`,
                producto_id: item.producto_id || 'N/A',
                producto_nombre: infoP.nombre || item.producto_id || 'Producto',
                producto_codigo: infoP.referencia || '',
                empleado_id: '',
                empleado_nombre: item.usuario_modifico || 'Sistema',
                tipo_accion: 'Ajuste Stock',
                local: item.local_id || 'General',
                talla_color: `${item.talla || ''} ${item.color || ''}`.trim(),
                cantidad_nueva: item.cantidad,
                detalles: { observacion: `Inventario registrado en ${item.local_id || 'Tienda'} (Stock: ${item.cantidad} unid)` },
                created_at: item.ultima_actualizacion || new Date().toISOString()
            });
        });

        // Add inventario_alcala
        alcRows.forEach(item => {
            const infoP = prodMap[item.id_producto] || {};
            registrosMapeados.push({
                id: item.id || `alc_${item.created_at}`,
                producto_id: item.id_producto || 'N/A',
                producto_nombre: infoP.nombre || item.id_producto || 'Producto',
                producto_codigo: infoP.codigo_barras || '',
                empleado_id: '',
                empleado_nombre: item.usuario_modifico || item.usuario || 'Sistema',
                tipo_accion: 'Ajuste Stock',
                local: 'Alcalá',
                talla_color: `${item.talla || ''} ${item.color || ''}`.trim(),
                cantidad_nueva: item.cantidad,
                detalles: { observacion: `Inventario registrado en Alcalá (Stock: ${item.cantidad} unid)` },
                created_at: item.created_at || item.ultima_actualizacion || new Date().toISOString()
            });
        });

        // Add inventario_01
        o1Rows.forEach(item => {
            const infoP = prodMap[item.id_producto] || {};
            registrosMapeados.push({
                id: item.id || `01_${item.created_at}`,
                producto_id: item.id_producto || 'N/A',
                producto_nombre: infoP.nombre || item.id_producto || 'Producto',
                producto_codigo: infoP.codigo_barras || '',
                empleado_id: '',
                empleado_nombre: item.usuario_modifico || item.usuario || 'Sistema',
                tipo_accion: 'Ajuste Stock',
                local: 'Local 01',
                talla_color: `${item.talla || ''} ${item.color || ''}`.trim(),
                cantidad_nueva: item.cantidad,
                detalles: { observacion: `Inventario registrado en Local 01 (Stock: ${item.cantidad} unid)` },
                created_at: item.created_at || item.ultima_actualizacion || new Date().toISOString()
            });
        });

        // Add inventario_jordan
        jorRows.forEach(item => {
            const infoP = prodMap[item.id_producto] || {};
            registrosMapeados.push({
                id: item.id || `jor_${item.created_at}`,
                producto_id: item.id_producto || 'N/A',
                producto_nombre: infoP.nombre || item.id_producto || 'Producto',
                producto_codigo: infoP.codigo_barras || '',
                empleado_id: '',
                empleado_nombre: item.usuario_modifico || item.usuario || 'Sistema',
                tipo_accion: 'Ajuste Stock',
                local: 'Jordán',
                talla_color: `${item.talla || ''} ${item.color || ''}`.trim(),
                cantidad_nueva: item.cantidad,
                detalles: { observacion: `Inventario registrado en Jordán (Stock: ${item.cantidad} unid)` },
                created_at: item.created_at || item.ultima_actualizacion || new Date().toISOString()
            });
        });

        // Add movimientos_transferencia
        trasladosRows.forEach(t => {
            const infoP = prodMap[t.id_producto] || {};
            registrosMapeados.push({
                id: t.id || `traslado_${Math.random()}`,
                producto_id: t.id_producto || 'N/A',
                producto_nombre: infoP.nombre || t.producto_nombre || t.id_producto || 'Producto en Traslado',
                producto_codigo: infoP.codigo_barras || t.codigo_barras || '',
                empleado_id: t.usuario_id || '',
                empleado_nombre: t.usuario || t.registrado_por || t.empleado || 'Sistema / Empleado',
                tipo_accion: 'Traslado de Mercancía',
                local: t.origen ? `${t.origen} ➔ ${t.destino}` : 'Traslado',
                talla_color: `${t.talla || ''} ${t.color || ''}`.trim(),
                cantidad_nueva: t.cantidad || 0,
                detalles: { observacion: t.notas || `Traslado de ${t.origen || 'Origen'} a ${t.destino || 'Destino'}` },
                created_at: t.created_at || new Date().toISOString()
            });
        });

        // Ordenar por fecha descendente
        registrosMapeados.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        auditoriaCache = registrosMapeados;
        renderizarTablaAuditoria(auditoriaCache);
        actualizarMetricasAuditoria(auditoriaCache);

    } catch (err) {
        console.error('Error al cargar auditoría de inventario:', err);
        contenedor.innerHTML = '<tr><td colspan="8" class="text-center text-danger"><i class="fas fa-exclamation-triangle"></i> Error al conectar con Supabase</td></tr>';
    }
}
window.inicializarPanelAuditoriaInventario = inicializarPanelAuditoriaInventario;

/**
 * Carga empleados directamente de la tabla `empleados_tienda` de Supabase
 */
async function poblarFiltrosAuditoria() {
    const selectEmp = document.getElementById('filtroAuditoriaEmpleado');
    if (!selectEmp) return;

    try {
        const { data: empleados } = await window.supabaseClient
            .from('empleados_tienda')
            .select('nombre')
            .eq('activo', true)
            .order('nombre');

        const valActual = selectEmp.value;
        let html = '<option value="">👥 Todos los Empleados</option>';
        if (empleados && empleados.length > 0) {
            empleados.forEach(emp => {
                html += `<option value="${emp.nombre}">${emp.nombre}</option>`;
            });
        }
        selectEmp.innerHTML = html;
        selectEmp.value = valActual;
    } catch (e) {
        console.error('Error poblando filtro empleados:', e);
    }
}

function filtrarAuditoriaInventario() {
    const busqueda = (document.getElementById('buscarAuditoriaInput')?.value || '').toLowerCase().trim();
    const local = document.getElementById('filtroAuditoriaLocal')?.value || '';
    const empleado = document.getElementById('filtroAuditoriaEmpleado')?.value || '';
    const accion = document.getElementById('filtroAuditoriaAccion')?.value || '';
    const fechaDesde = document.getElementById('filtroAuditoriaDesde')?.value || '';
    const fechaHasta = document.getElementById('filtroAuditoriaHasta')?.value || '';

    let filtrados = auditoriaCache.filter(item => {
        if (busqueda && !item.producto_nombre.toLowerCase().includes(busqueda) && !item.producto_codigo.toLowerCase().includes(busqueda) && !item.empleado_nombre.toLowerCase().includes(busqueda)) {
            return false;
        }
        if (local && !item.local.includes(local)) return false;
        if (empleado && item.empleado_nombre !== empleado) return false;
        if (accion && item.tipo_accion !== accion) return false;

        if (fechaDesde) {
            const fItem = new Date(item.created_at).toISOString().split('T')[0];
            if (fItem < fechaDesde) return false;
        }
        if (fechaHasta) {
            const fItem = new Date(item.created_at).toISOString().split('T')[0];
            if (fItem > fechaHasta) return false;
        }

        return true;
    });

    renderizarTablaAuditoria(filtrados);
    actualizarMetricasAuditoria(filtrados);
}
window.filtrarAuditoriaInventario = filtrarAuditoriaInventario;

function renderizarTablaAuditoria(lista) {
    const tbody = document.getElementById('tbodyAuditoriaInventario');
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:2rem;">No se encontraron registros de modificación de inventario o traslados.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(item => {
        const fechaObj = new Date(item.created_at);
        const fechaFormat = fechaObj.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
        const horaFormat = fechaObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // Badge de Acción
        let badgeStyle = 'background:#e2e8f0; color:#475569;';
        if (item.tipo_accion.includes('Ajuste') || item.tipo_accion.includes('Stock')) {
            badgeStyle = 'background:#dbeafe; color:#1e40af;';
        } else if (item.tipo_accion.includes('Precio')) {
            badgeStyle = 'background:#fef3c7; color:#92400e;';
        } else if (item.tipo_accion.includes('Creació') || item.tipo_accion.includes('Nuevo')) {
            badgeStyle = 'background:#dcfce7; color:#166534;';
        } else if (item.tipo_accion.includes('Elimina')) {
            badgeStyle = 'background:#fee2e2; color:#991b1b;';
        } else if (item.tipo_accion.includes('Traslado')) {
            badgeStyle = 'background:#f3e8ff; color:#6b21a8;';
        }

        // Variación
        let variacionHTML = '-';
        if (item.cantidad_anterior !== null && item.cantidad_nueva !== null && item.cantidad_anterior !== undefined) {
            const diff = item.cantidad_nueva - item.cantidad_anterior;
            const sign = diff > 0 ? `+${diff}` : `${diff}`;
            const colorClass = diff < 0 ? 'color:#ef4444; font-weight:bold;' : (diff > 0 ? 'color:#10b981; font-weight:bold;' : 'color:#64748b;');
            variacionHTML = `
                <div><span style="color:#64748b;">${item.cantidad_anterior}</span> ➔ <strong style="color:#0f172a;">${item.cantidad_nueva}</strong></div>
                <div style="font-size:0.8rem; ${colorClass}">(${sign} unid)</div>
            `;
        } else if (item.precio_anterior !== null && item.precio_nuevo !== null && item.precio_anterior !== undefined) {
            const pAnt = Utils ? Utils.formatearPrecio(item.precio_anterior) : `$${item.precio_anterior}`;
            const pNue = Utils ? Utils.formatearPrecio(item.precio_nuevo) : `$${item.precio_nuevo}`;
            variacionHTML = `
                <div><span style="color:#64748b;">${pAnt}</span> ➔ <strong style="color:#0f172a;">${pNue}</strong></div>
            `;
        } else if (item.cantidad_nueva !== undefined && item.cantidad_nueva !== null) {
            variacionHTML = `<div>Stock: <strong style="color:#0f172a;">${item.cantidad_nueva}</strong></div>`;
        }

        const varianteText = item.talla_color ? `<span style="font-size:0.75rem; background:#f1f5f9; padding:2px 6px; border-radius:4px; display:inline-block; margin-top:2px;">${item.talla_color}</span>` : '';

        return `
            <tr>
                <td style="white-space:nowrap;">
                    <div style="font-weight:600; color:#1e293b;">${fechaFormat}</div>
                    <div style="font-size:0.75rem; color:#64748b;">${horaFormat}</div>
                </td>
                <td>
                    <strong style="color:#0f172a; display:block;">${item.empleado_nombre}</strong>
                </td>
                <td>
                    <span style="font-weight:600; color:#3b82f6;">${item.local}</span>
                </td>
                <td>
                    <div style="font-weight:600; color:#0f172a;">${item.producto_nombre}</div>
                    <div style="font-size:0.75rem; color:#64748b;">Código: ${item.producto_codigo || 'N/A'}</div>
                    ${varianteText}
                </td>
                <td>
                    <span style="padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:700; ${badgeStyle}">
                        ${item.tipo_accion}
                    </span>
                </td>
                <td>
                    ${variacionHTML}
                </td>
                <td style="font-size:0.85rem; color:#475569; max-width:220px;">
                    ${item.detalles && item.detalles.observacion ? item.detalles.observacion : (item.detalles ? JSON.stringify(item.detalles) : '-')}
                </td>
            </tr>
        `;
    }).join('');
}

function actualizarMetricasAuditoria(lista) {
    const hoyStr = new Date().toISOString().split('T')[0];
    const modifsHoy = lista.filter(a => new Date(a.created_at).toISOString().split('T')[0] === hoyStr).length;

    // Conteo de empleados
    const conteoEmp = {};
    lista.forEach(a => {
        if (a.empleado_nombre) {
            conteoEmp[a.empleado_nombre] = (conteoEmp[a.empleado_nombre] || 0) + 1;
        }
    });

    let topEmp = 'Ninguno';
    let max = 0;
    Object.entries(conteoEmp).forEach(([emp, cant]) => {
        if (cant > max) { max = cant; topEmp = emp; }
    });

    let reducciones = 0;
    let aumentos = 0;
    lista.forEach(a => {
        if (a.cantidad_anterior !== null && a.cantidad_nueva !== null && a.cantidad_anterior !== undefined) {
            const diff = a.cantidad_nueva - a.cantidad_anterior;
            if (diff < 0) reducciones += Math.abs(diff);
            if (diff > 0) aumentos += diff;
        }
    });

    const elHoy = document.getElementById('auditoriaMetricaHoy');
    const elTop = document.getElementById('auditoriaMetricaTop');
    const elReduc = document.getElementById('auditoriaMetricaReducciones');
    const elAument = document.getElementById('auditoriaMetricaAumentos');

    if (elHoy) elHoy.textContent = modifsHoy;
    if (elTop) elTop.textContent = topEmp !== 'Ninguno' ? `${topEmp} (${max})` : 'N/A';
    if (elReduc) elReduc.textContent = `-${reducciones} unid`;
    if (elAument) elAument.textContent = `+${aumentos} unid`;
}
