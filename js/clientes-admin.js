// ═══════════════════ GESTIÓN DE CLIENTES - ADMIN ═══════════════════
let clientesCache = [];
let clientesFiltrados = [];
const CLIENTES_POR_PAGINA = 20;
let paginaActualClientes = 1;

// Cargar Google Charts
let chartsLoaded = false;
try {
    google.charts.load('current', { 'packages': ['corechart', 'bar'] });
    google.charts.setOnLoadCallback(() => {
        chartsLoaded = true;
        if (clientesCache.length > 0) dibujarGraficosClientes();
    });
} catch (e) { console.error('Error loading Google Charts:', e); }

// Cargar clientes desde Supabase
async function cargarClientesAdmin() {
    try {
        const { data, error } = await supabaseClient
            .from('clientes')
            .select('*')
            .order('id', { ascending: false });

        if (error) throw error;

        clientesCache = data || [];
        clientesFiltrados = [...clientesCache];

        actualizarEstadisticasClientes();
        mostrarClientesTabla();
        if (chartsLoaded) dibujarGraficosClientes();
        else setTimeout(dibujarGraficosClientes, 1000); // Reintentar si no ha cargado

    } catch (error) {
        console.error('Error cargando clientes:', error);
        if (typeof mostrarToast === 'function') {
            mostrarToast('Error al cargar clientes', 'error');
        }
    }
}

// ═══════════════════ GRÁFICOS ═══════════════════
function dibujarGraficosClientes() {
    if (!google.visualization || clientesCache.length === 0) return;

    // 1. Top 10 Clientes (Compras)
    const topClientes = [...clientesCache]
        .sort((a, b) => (b.total_compras || 0) - (a.total_compras || 0))
        .slice(0, 10)
        .map(c => [c.nombre?.split(' ')[0] || c.telefono || 'Anon', c.total_compras || 0]);

    const dataTop = new google.visualization.DataTable();
    dataTop.addColumn('string', 'Cliente');
    dataTop.addColumn('number', 'Total Compras ($)');
    dataTop.addRows(topClientes);

    const optionsTop = {
        title: 'Top 10 Clientes por Valor de Compra',
        legend: { position: 'none' },
        colors: ['#2563eb'],
        hAxis: { title: 'Cliente' },
        vAxis: { title: 'Total Gastado' }
    };

    const chartTop = new google.visualization.ColumnChart(document.getElementById('chartTopClientes'));
    chartTop.draw(dataTop, optionsTop);

    // 2. Crecimiento (Últimos 6 meses)
    const meses = {};
    const hoy = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const label = d.toLocaleDateString('es-CO', { month: 'short' });
        meses[key] = { label, cantidad: 0 };
    }

    clientesCache.forEach(c => {
        const fecha = c.fecha_registro || c.created_at;
        if (fecha) {
            const d = new Date(fecha);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (meses[key]) meses[key].cantidad++;
        }
    });

    const dataCrecimiento = new google.visualization.DataTable();
    dataCrecimiento.addColumn('string', 'Mes');
    dataCrecimiento.addColumn('number', 'Nuevos Clientes');
    dataCrecimiento.addRows(Object.values(meses).map(m => [m.label, m.cantidad]));

    const optionsCrecimiento = {
        title: 'Nuevos Clientes (Ultimos 6 Meses)',
        curveType: 'function',
        legend: { position: 'bottom' },
        colors: ['#10b981'],
        pointSize: 5
    };

    const chartCrecimiento = new google.visualization.LineChart(document.getElementById('chartCrecimientoClientes'));
    chartCrecimiento.draw(dataCrecimiento, optionsCrecimiento);

    // 3. Distribución por Tipo
    const frecuentes = clientesCache.filter(c => (c.numero_compras || 0) >= 3 && (c.numero_compras || 0) < 10).length;
    const vip = clientesCache.filter(c => (c.numero_compras || 0) >= 10).length;
    const regular = clientesCache.length - frecuentes - vip;

    const dataDistribucion = google.visualization.arrayToDataTable([
        ['Tipo', 'Cantidad'],
        ['Regulares (<3 compras)', regular],
        ['Frecuentes (3-9 compras)', frecuentes],
        ['VIP (10+ compras)', vip]
    ]);

    const optionsDistribucion = {
        title: 'Distribución de Clientes',
        pieHole: 0.4,
        colors: ['#94a3b8', '#f59e0b', '#9333ea']
    };

    const chartDistribucion = new google.visualization.PieChart(document.getElementById('chartDistribucionClientes'));
    chartDistribucion.draw(dataDistribucion, optionsDistribucion);
}

// Actualizar estadísticas del dashboard
function actualizarEstadisticasClientes() {
    const total = clientesCache.length;
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    // Usar fecha_registro si existe, sino contar como 0
    const nuevos = clientesCache.filter(c => {
        const fecha = c.fecha_registro || c.created_at;
        return fecha && new Date(fecha) >= inicioMes;
    }).length;
    const frecuentes = clientesCache.filter(c => (c.numero_compras || 0) >= 3).length;
    const vip = clientesCache.filter(c => (c.numero_compras || 0) >= 10).length;

    document.getElementById('statTotalClientes').textContent = total;
    document.getElementById('statClientesNuevos').textContent = nuevos;
    document.getElementById('statClientesFrecuentes').textContent = frecuentes;
    document.getElementById('statClientesVIP').textContent = vip;
}

// Filtrar clientes por búsqueda y tipo
function filtrarClientesTabla() {
    const busqueda = document.getElementById('buscarCliente').value.toLowerCase();
    const filtroTipo = document.getElementById('filtroTipoCliente').value;

    clientesFiltrados = clientesCache.filter(cliente => {
        // Filtro de búsqueda
        const coincideBusqueda = !busqueda ||
            (cliente.nombre || '').toLowerCase().includes(busqueda) ||
            (cliente.cedula || '').toLowerCase().includes(busqueda) ||
            (cliente.telefono || '').toLowerCase().includes(busqueda);

        if (!coincideBusqueda) return false;

        // Filtro por tipo
        const numCompras = cliente.numero_compras || 0;
        const ahora = new Date();
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        const fecha = cliente.fecha_registro || cliente.created_at;
        const esNuevo = fecha && new Date(fecha) >= inicioMes;

        switch (filtroTipo) {
            case 'frecuentes': return numCompras >= 3;
            case 'vip': return numCompras >= 10;
            case 'nuevos': return esNuevo;
            default: return true;
        }
    });

    paginaActualClientes = 1;
    mostrarClientesTabla();
}

// Mostrar clientes en la tabla con paginación
function mostrarClientesTabla() {
    const tbody = document.getElementById('tbodyClientes');
    const inicio = (paginaActualClientes - 1) * CLIENTES_POR_PAGINA;
    const fin = inicio + CLIENTES_POR_PAGINA;
    const clientesPagina = clientesFiltrados.slice(inicio, fin);

    if (clientesPagina.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No se encontraron clientes</td></tr>';
        document.getElementById('paginacionClientes').innerHTML = '';
        return;
    }

    tbody.innerHTML = clientesPagina.map(cliente => {
        const totalGastado = (cliente.total_compras || 0).toLocaleString('es-CO');
        const ultimaCompra = cliente.ultima_compra ?
            new Date(cliente.ultima_compra).toLocaleDateString('es-CO') : '-';
        const numCompras = cliente.numero_compras || 0;

        let badge = '';
        if (numCompras >= 10) badge = '<span style="background:#9333ea;color:white;padding:0.25rem 0.5rem;border-radius:4px;font-size:0.75rem;">👑 VIP</span>';
        else if (numCompras >= 3) badge = '<span style="background:#f59e0b;color:white;padding:0.25rem 0.5rem;border-radius:4px;font-size:0.75rem;">⭐ Frecuente</span>';

        return `
            <tr>
                <td>${cliente.nombre || '-'} ${badge}</td>
                <td>${cliente.cedula || '-'}</td>
                <td>${cliente.telefono || '-'}</td>
                <td style="text-align:center;">${numCompras}</td>
                <td style="text-align:right;">$${totalGastado}</td>
                <td>${ultimaCompra}</td>
                <td style="text-align:center;">
                    <button onclick="verDetalleCliente('${cliente.id}')" class="btn btn-sm btn-primary" title="Ver detalle">👁️</button>
                    <a href="https://wa.me/57${cliente.telefono}" target="_blank" class="btn btn-sm btn-success" title="WhatsApp">📱</a>
                </td>
            </tr>
        `;
    }).join('');

    // Paginación
    mostrarPaginacionClientes();
}

// Mostrar controles de paginación
function mostrarPaginacionClientes() {
    const totalPaginas = Math.ceil(clientesFiltrados.length / CLIENTES_POR_PAGINA);
    const paginacion = document.getElementById('paginacionClientes');

    if (totalPaginas <= 1) {
        paginacion.innerHTML = '';
        return;
    }

    let html = '';

    // Botón anterior
    if (paginaActualClientes > 1) {
        html += `<button onclick="cambiarPaginaClientes(${paginaActualClientes - 1})" class="btn btn-sm btn-secondary">← Anterior</button>`;
    }

    // Números de página
    for (let i = 1; i <= totalPaginas; i++) {
        if (i === 1 || i === totalPaginas || (i >= paginaActualClientes - 2 && i <= paginaActualClientes + 2)) {
            const activo = i === paginaActualClientes ? 'btn-primary' : 'btn-secondary';
            html += `<button onclick="cambiarPaginaClientes(${i})" class="btn btn-sm ${activo}">${i}</button>`;
        } else if (i === paginaActualClientes - 3 || i === paginaActualClientes + 3) {
            html += '<span style="padding:0.5rem;">...</span>';
        }
    }

    // Botón siguiente
    if (paginaActualClientes < totalPaginas) {
        html += `<button onclick="cambiarPaginaClientes(${paginaActualClientes + 1})" class="btn btn-sm btn-secondary">Siguiente →</button>`;
    }

    paginacion.innerHTML = html;
}

// Cambiar página
function cambiarPaginaClientes(pagina) {
    paginaActualClientes = pagina;
    mostrarClientesTabla();
}

// Ver detalle de cliente
async function verDetalleCliente(clienteId) {
    try {
        const { data: cliente, error } = await supabaseClient
            .from('clientes')
            .select('*')
            .eq('id', clienteId)
            .single();

        if (error) throw error;

        // Llenar formulario
        document.getElementById('clienteDetalleId').value = cliente.id;
        document.getElementById('clienteNombre').value = cliente.nombre || '';
        document.getElementById('clienteCedula').value = cliente.cedula || '';
        document.getElementById('clienteTelefono').value = cliente.telefono || '';
        document.getElementById('clienteEmail').value = cliente.email || '';
        document.getElementById('clienteDireccion').value = cliente.direccion || '';

        // Estadísticas
        const numCompras = cliente.numero_compras || 0;
        const totalGastado = cliente.total_compras || 0;
        const promedio = numCompras > 0 ? totalGastado / numCompras : 0;
        const ultimaCompra = cliente.ultima_compra ?
            new Date(cliente.ultima_compra).toLocaleDateString('es-CO') : '-';

        document.getElementById('clienteNumCompras').textContent = numCompras;
        document.getElementById('clienteTotalGastado').textContent = '$' + totalGastado.toLocaleString('es-CO');
        document.getElementById('clienteUltimaCompra').textContent = ultimaCompra;
        document.getElementById('clientePromedio').textContent = '$' + Math.round(promedio).toLocaleString('es-CO');

        // Cargar historial de compras
        await cargarHistorialCompras(clienteId);

        // Mostrar modal
        document.getElementById('modalDetalleCliente').style.display = 'flex';
    } catch (error) {
        console.error('Error cargando detalle:', error);
        if (typeof mostrarToast === 'function') {
            mostrarToast('Error al cargar detalle del cliente', 'error');
        }
    }
}

// Cargar historial de compras del cliente
async function cargarHistorialCompras(clienteId) {
    try {
        const { data, error } = await supabaseClient
            .from('ventas')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('fecha', { ascending: false })
            .limit(10);

        if (error) throw error;

        const tbody = document.getElementById('tbodyHistorialCompras');

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay compras registradas</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(venta => `
            <tr>
                <td>${new Date(venta.fecha).toLocaleDateString('es-CO')}</td>
                <td>${venta.tienda || '-'}</td>
                <td style="text-align:right;">$${(venta.total || 0).toLocaleString('es-CO')}</td>
                <td>${venta.metodo_pago || '-'}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error cargando historial:', error);
    }
}

// Cerrar modal de cliente
function cerrarModalCliente() {
    document.getElementById('modalDetalleCliente').style.display = 'none';
}

// Guardar cambios del cliente
async function guardarCambiosCliente() {
    try {
        const clienteId = document.getElementById('clienteDetalleId').value;
        const datosActualizados = {
            nombre: document.getElementById('clienteNombre').value,
            cedula: document.getElementById('clienteCedula').value,
            telefono: document.getElementById('clienteTelefono').value,
            email: document.getElementById('clienteEmail').value,
            direccion: document.getElementById('clienteDireccion').value
        };

        const { error } = await supabaseClient
            .from('clientes')
            .update(datosActualizados)
            .eq('id', clienteId);

        if (error) throw error;

        if (typeof mostrarToast === 'function') {
            mostrarToast('Cliente actualizado correctamente', 'success');
        }
        cerrarModalCliente();
        await cargarClientesAdmin();
    } catch (error) {
        console.error('Error guardando cambios:', error);
        if (typeof mostrarToast === 'function') {
            mostrarToast('Error al guardar cambios', 'error');
        }
    }
}

// Enviar WhatsApp al cliente
function enviarWhatsAppCliente() {
    const telefono = document.getElementById('clienteTelefono').value;
    const nombre = document.getElementById('clienteNombre').value;

    if (!telefono) {
        if (typeof mostrarToast === 'function') {
            mostrarToast('El cliente no tiene teléfono registrado', 'warning');
        } else {
            alert('El cliente no tiene teléfono registrado');
        }
        return;
    }

    const mensaje = `Hola ${nombre}! 👋 Te escribimos desde Moteros Sports Line`;
    const url = `https://wa.me/57${telefono}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

// ═══════════════════ REGLAS DE PROMOCIÓN ═══════════════════

let reglasPromocion = [];
let promocionesDisponibles = [];

// Abrir modal y cargar datos
async function abrirModalReglasPromocion() {
    document.getElementById('modalReglasPromocion').style.display = 'flex';
    await cargarPromocionesSelect();
    await cargarReglasGuardadas();
    mostrarReglasPromocion();
}

// Cerrar modal
function cerrarModalReglas() {
    document.getElementById('modalReglasPromocion').style.display = 'none';
}

// Cargar promociones para el select
async function cargarPromocionesSelect() {
    try {
        const { data, error } = await supabaseClient
            .from('promociones')
            .select('id_promo, nombre')
            .eq('estado', 'Activa');

        if (error) throw error;
        promocionesDisponibles = data || [];

        const select = document.getElementById('reglaPromocionId');
        select.innerHTML = '<option value="">Selecciona promoción...</option>' +
            promocionesDisponibles.map(p => `<option value="${p.id_promo}">${p.nombre}</option>`).join('');

    } catch (error) {
        console.error('Error cargando promociones:', error);
    }
}

// Cargar reglas desde configuracion_sistema
async function cargarReglasGuardadas() {
    try {
        const { data, error } = await supabaseClient
            .from('configuracion_sistema')
            .select('valor')
            .eq('clave', 'reglas_promociones_clientes')
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error; // Ignorar si no existe

        if (data && data.valor) {
            reglasPromocion = JSON.parse(data.valor);
        } else {
            reglasPromocion = [];
        }
    } catch (error) {
        console.error('Error cargando reglas:', error);
        reglasPromocion = [];
    }
}

// Mostrar reglas en la tabla del modal
function mostrarReglasPromocion() {
    const tbody = document.getElementById('tbodyReglasPromocion');
    if (reglasPromocion.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay reglas definidas</td></tr>';
        return;
    }

    tbody.innerHTML = reglasPromocion.map((regla, index) => {
        const promo = promocionesDisponibles.find(p => p.id_promo == regla.promocionId);
        const nombrePromo = promo ? promo.nombre : `ID: ${regla.promocionId}`;
        const monto = parseInt(regla.metaMonto).toLocaleString('es-CO');

        return `
            <tr>
                <td>${regla.nombre}</td>
                <td>$${monto}</td>
                <td>${regla.metaCompras} / mes</td>
                <td>${nombrePromo}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-danger" onclick="eliminarReglaPromocion(${index})">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Agregar nueva regla (memoria)
function agregarReglaPromocion() {
    const nombre = document.getElementById('reglaNombre').value.trim();
    const promocionId = document.getElementById('reglaPromocionId')?.value;
    const metaMonto = document.getElementById('reglaMetaMonto')?.value || 0;
    const metaCompras = document.getElementById('reglaMetaCompras')?.value || 0;

    if (!nombre || !promocionId) {
        alert('Nombre y Promoción son obligatorios');
        return;
    }

    reglasPromocion.push({
        nombre,
        promocionId,
        metaMonto: parseInt(metaMonto),
        metaCompras: parseInt(metaCompras),
        periodo: 'mensual' // Por defecto mensual según requerimiento
    });

    // Limpiar inputs
    document.getElementById('reglaNombre').value = '';
    document.getElementById('reglaPromocionId').value = '';
    document.getElementById('reglaMetaMonto').value = '';
    document.getElementById('reglaMetaCompras').value = '';

    mostrarReglasPromocion();
}

// Eliminar regla (memoria)
function eliminarReglaPromocion(index) {
    reglasPromocion.splice(index, 1);
    mostrarReglasPromocion();
}

// Guardar reglas en BD
async function guardarReglasPromocion() {
    try {
        const { error } = await supabaseClient
            .from('configuracion_sistema')
            .upsert({
                clave: 'reglas_promociones_clientes',
                valor: JSON.stringify(reglasPromocion)
            }, { onConflict: 'clave' });

        if (error) throw error;

        if (typeof mostrarToast === 'function') {
            mostrarToast('Reglas guardadas correctamente', 'success');
        } else {
            alert('Reglas guardadas correctamente');
        }
        cerrarModalReglas();
    } catch (error) {
        console.error('Error guardando reglas:', error);
        alert('Error al guardar reglas');
    }
}

// ═══════════════════ INICIALIZACIÓN ═══════════════════
// Cargar clientes cuando se abre la sección
document.addEventListener('DOMContentLoaded', () => {
    // Listener para detectar cambios de sección
    document.addEventListener('click', (e) => {
        const link = e.target.closest('[data-section="clientes"]');
        if (link) {
            setTimeout(() => {
                if (clientesCache.length === 0) {
                    cargarClientesAdmin();
                }
            }, 100);
        }
    });

    // Si la sección de clientes está activa al cargar, cargar datos
    const clientesSection = document.getElementById('clientesSection');
    if (clientesSection && clientesSection.classList.contains('active')) {
        cargarClientesAdmin();
    }

    // Configurar scope global funciones
    window.abrirModalReglasPromocion = abrirModalReglasPromocion;
    window.cerrarModalReglas = cerrarModalReglas;
    window.agregarReglaPromocion = agregarReglaPromocion;
    window.eliminarReglaPromocion = eliminarReglaPromocion;
    window.guardarReglasPromocion = guardarReglasPromocion;
});
