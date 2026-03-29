/**
 * MOTEROS SPORTS LINE - Módulo de Comisiones y Rendimiento
 * Gestión de bonificaciones para vendedores basada en metas y ventas.
 */

// Estado local del módulo
let comisionesData = [];
let ventasRaw = []; // Nueva: Almacena todas las ventas para el detalle
let configBonoActual = { tipo: 'porcentaje', valor: 0 };

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar fechas (mes actual por defecto)
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    
    const inputInicio = document.getElementById('comisionFechaInicio');
    const inputFin = document.getElementById('comisionFechaFin');
    
    if (inputInicio) inputInicio.value = inicioMes.toISOString().split('T')[0];
    if (inputFin) inputFin.value = hoy.toISOString().split('T')[0];

    // Cargar configuración inicial
    cargarConfiguracionBono();
});

/**
 * Carga la configuración de bonos desde Supabase
 */
async function cargarConfiguracionBono() {
    try {
        const { data, error } = await supabaseClient
            .from('config_bonificaciones')
            .select('*')
            .eq('activa', true)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
            configBonoActual = { tipo: data.tipo, valor: data.valor };
            
            // Actualizar UI
            const selectTipo = document.getElementById('configBonoTipo');
            const inputValor = document.getElementById('configBonoValor');
            
            if (selectTipo) selectTipo.value = data.tipo;
            if (inputValor) inputValor.value = data.valor;
            
            toggleConfigBonoSuffix();
        }
    } catch (err) {
        console.error('Error cargando configuración de bonos:', err);
    }
}

/**
 * Guarda la configuración de bonos en Supabase
 */
async function guardarConfiguracionBono() {
    const tipo = document.getElementById('configBonoTipo').value;
    const valor = parseFloat(document.getElementById('configBonoValor').value) || 0;

    try {
        const { error } = await supabaseClient
            .from('config_bonificaciones')
            .insert([{ tipo, valor, activa: true, updated_at: new Date().toISOString() }]);

        if (error) throw error;

        configBonoActual = { tipo, valor };
        showToast('Configuración guardada correctamente', 'success');
        
        // Recalcular si ya hay datos cargados
        if (comisionesData.length > 0) {
            renderizarTablaComisiones();
        }
    } catch (err) {
        console.error('Error guardando configuración:', err);
        showToast('Error al guardar configuración', 'error');
    }
}

/**
 * Helper para actualizar etiquetas de UI según el tipo de bono
 */
function toggleConfigBonoSuffix() {
    const tipo = document.getElementById('configBonoTipo').value;
    const suffix = document.getElementById('bonoSuffix');
    const prefix = document.getElementById('bonoPrefix');
    const label = document.getElementById('labelConfigBonoValor');

    if (tipo === 'porcentaje') {
        if (suffix) suffix.style.display = 'inline';
        if (prefix) prefix.style.display = 'none';
        if (label) label.textContent = 'Valor del Bono (%)';
    } else {
        if (suffix) suffix.style.display = 'none';
        if (prefix) prefix.style.display = 'inline';
        if (label) label.textContent = 'Valor Fijo por Venta ($)';
    }
}

/**
 * Consulta las ventas y las agrupa por vendedor
 */
async function consultarComisiones() {
    const fechaInicio = document.getElementById('comisionFechaInicio').value;
    const fechaFin = document.getElementById('comisionFechaFin').value;
    const tienda = document.getElementById('comisionTienda').value;

    if (!fechaInicio || !fechaFin) {
        showToast('Seleccione un rango de fechas', 'warning');
        return;
    }

    showToast('Consultando datos...', 'info');

    try {
        // Consultar ventas en el rango
        // Usamos una fecha de fin que incluya todo el día
        const finISO = new Date(fechaFin + 'T23:59:59').toISOString();
        const inicioISO = new Date(fechaInicio + 'T00:00:00').toISOString();

        let query = supabaseClient
            .from('ventas')
            .select(`
                total,
                cantidad,
                vendedor_id,
                local,
                estado_venta,
                nombre_producto,
                empleados_tienda (
                    nombre
                )
            `)
            .gte('created_at', inicioISO)
            .lte('created_at', finISO)
            .eq('estado_venta', 'Completada');

        if (tienda !== 'Todas') {
            query = query.eq('local', tienda);
        }

        const { data, error } = await query;

        if (error) throw error;

        ventasRaw = data; // Guardamos para el detalle
        procesarDatosComisiones(data);
    } catch (err) {
        console.error('Error consultando comisiones:', err);
        showToast('Error al consultar datos', 'error');
    }
}

/**
 * Procesa el array de ventas para agrupar por vendedor
 */
function procesarDatosComisiones(ventas) {
    const agrupado = {};
    let totalGeneral = 0;
    let unidadesGeneral = 0;

    ventas.forEach(v => {
        // Si no tiene vendedor_id, lo agrupamos como "Cajero / Sin asignar"
        const id = v.vendedor_id || 'sin_asignar';
        const nombre = (v.empleados_tienda && v.empleados_tienda.nombre) || 'Cajero / Otros';

        if (!agrupado[id]) {
            agrupado[id] = {
                id: id,
                nombre: nombre,
                total: 0,
                operaciones: 0,
                unidades: 0
            };
        }

        agrupado[id].total += parseFloat(v.total || 0);
        agrupado[id].operaciones += 1;
        agrupado[id].unidades += parseInt(v.cantidad || 0);
        
        totalGeneral += parseFloat(v.total || 0);
        unidadesGeneral += parseInt(v.cantidad || 0);
    });

    // Convertir a array y ordenar por total descendente
    comisionesData = Object.values(agrupado).sort((a, b) => b.total - a.total);

    // Actualizar KPIs
    document.getElementById('statTotalVendido').textContent = `$${totalGeneral.toLocaleString('es-CO')}`;
    document.getElementById('statTotalUnidades').textContent = unidadesGeneral.toLocaleString('es-CO');
    
    if (comisionesData.length > 0) {
        document.getElementById('statMejorVendedor').textContent = comisionesData[0].nombre;
    } else {
        document.getElementById('statMejorVendedor').textContent = '-';
    }

    renderizarTablaComisiones();
    actualizarBadgePeriodo();
}

/**
 * Renderiza la tabla de ranking
 */
function renderizarTablaComisiones() {
    const tbody = document.getElementById('tbodyComisiones');
    if (!tbody) return;

    if (comisionesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No se encontraron ventas con los filtros seleccionados.</td></tr>';
        document.getElementById('statTotalBonos').textContent = '$0';
        return;
    }

    let totalBonosGeneral = 0;

    tbody.innerHTML = comisionesData.map((v, index) => {
        let bono = 0;
        if (configBonoActual.tipo === 'porcentaje') {
            bono = v.total * (configBonoActual.valor / 100);
        } else {
            bono = v.operaciones * configBonoActual.valor;
        }

        totalBonosGeneral += bono;

        const puestoClass = index === 0 ? '🏆' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : (index + 1)));

        return `
            <tr>
                <td style="text-align:center; font-weight:bold;">${puestoClass}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <div style="width:30px; height:30px; border-radius:50%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:bold; color:#64748b;">
                            ${v.nombre.substring(0,2).toUpperCase()}
                        </div>
                        <strong>${v.nombre}</strong>
                    </div>
                </td>
                <td style="text-align:right; font-weight:700; color:#1e293b;">$${v.total.toLocaleString('es-CO')}</td>
                <td style="text-align:center;">${v.operaciones}</td>
                <td style="text-align:center;">${v.unidades}</td>
                <td style="text-align:right; font-weight:800; color:#10b981;">$${Math.round(bono).toLocaleString('es-CO')}</td>
                <td style="text-align:center;">
                    <button class="btn btn-outline btn-sm" onclick="verDetalleVendedor('${v.id}')">👁️ Ver</button>
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('statTotalBonos').textContent = `$${Math.round(totalBonosGeneral).toLocaleString('es-CO')}`;
}

/**
 * Actualiza el texto del periodo consultado
 */
function actualizarBadgePeriodo() {
    const inicio = document.getElementById('comisionFechaInicio').value;
    const fin = document.getElementById('comisionFechaFin').value;
    const badge = document.getElementById('badgePeriodo');
    if (badge) {
        badge.textContent = `Periodo: ${inicio} al ${fin}`;
    }
}

/**
 * Exportar a PDF (Requiere jsPDF que ya está incluido en admin.html)
 */
async function exportarComisionesPDF() {
    if (comisionesData.length === 0) {
        showToast('No hay datos para exportar', 'warning');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const fecha = new Date().toLocaleDateString();
    
    // Encabezado
    doc.setFontSize(18);
    doc.text('MOTEROS SPORTS LINE', 105, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text('Reporte de Rendimiento y Bonificaciones', 105, 25, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Fecha Generación: ${fecha}`, 10, 35);
    doc.text(`Periodo: ${document.getElementById('comisionFechaInicio').value} hasta ${document.getElementById('comisionFechaFin').value}`, 10, 40);

    // Tabla
    const body = comisionesData.map((v, i) => [
        i + 1,
        v.nombre,
        `$${v.total.toLocaleString('es-CO')}`,
        v.operaciones,
        v.unidades,
        `$${Math.round(configBonoActual.tipo === 'porcentaje' ? v.total * (configBonoActual.valor / 100) : v.operaciones * configBonoActual.valor).toLocaleString('es-CO')}`
    ]);

    doc.autoTable({
        startY: 50,
        head: [['Puesto', 'Vendedor', 'Total Ventas', 'Operaciones', 'Unidades', 'Bono']],
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`Reporte_Comisiones_${fecha}.pdf`);
}

/**
 * Muestra el detalle de ventas de un vendedor específico
 */
async function verDetalleVendedor(vendedorId) {
    const modal = document.getElementById('modalDetalleVendedor');
    const tbody = document.getElementById('tbodyDetalleProductosVendedor');
    if (!modal || !tbody) return;

    // Filtrar ventas de este vendedor
    // Nota: vendedorId viene como string del HTML, comparamos con vendedor_id (número o null)
    const ventasVendedor = ventasRaw.filter(v => {
        if (vendedorId === 'sin_asignar') return v.vendedor_id === null;
        return v.vendedor_id == vendedorId;
    });

    if (ventasVendedor.length === 0) {
        showToast('No hay detalles para este vendedor', 'warning');
        return;
    }

    const nombreVendedor = (ventasVendedor[0].empleados_tienda?.nombre) || 'Cajero / Otros';
    document.getElementById('subtituloDetalleVendedor').textContent = `Vendedor: ${nombreVendedor}`;

    // Agrupar por producto
    const productosMap = {};
    let totalVendedor = 0;
    let unidadesVendedor = 0;

    ventasVendedor.forEach(v => {
        const prodId = v.nombre_producto; // Podría usarse id_producto si está en el select
        if (!productosMap[prodId]) {
            productosMap[prodId] = {
                nombre: v.nombre_producto,
                cantidad: 0,
                total: 0
            };
        }
        productosMap[prodId].cantidad += parseInt(v.cantidad || 0);
        productosMap[prodId].total += parseFloat(v.total || 0);
        
        totalVendedor += parseFloat(v.total || 0);
        unidadesVendedor += parseInt(v.cantidad || 0);
    });

    // Calcular Bono
    let bono = 0;
    if (configBonoActual.tipo === 'porcentaje') {
        bono = totalVendedor * (configBonoActual.valor / 100);
    } else {
        bono = ventasVendedor.length * configBonoActual.valor;
    }

    // Actualizar KPIs del Modal
    document.getElementById('detalleVendedorTotal').textContent = `$${totalVendedor.toLocaleString('es-CO')}`;
    document.getElementById('detalleVendedorUnidades').textContent = unidadesVendedor.toLocaleString('es-CO');
    document.getElementById('detalleVendedorBono').textContent = `$${Math.round(bono).toLocaleString('es-CO')}`;

    // Renderizar Tabla de Productos
    tbody.innerHTML = Object.values(productosMap).sort((a,b) => b.total - a.total).map(p => `
        <tr>
            <td><strong>${p.nombre}</strong></td>
            <td style="text-align:center;">${p.cantidad}</td>
            <td style="text-align:right;">$${Math.round(p.total / p.cantidad).toLocaleString('es-CO')}</td>
            <td style="text-align:right; font-weight:bold;">$${p.total.toLocaleString('es-CO')}</td>
        </tr>
    `).join('');

    modal.style.display = 'flex';
}

function cerrarModalDetalleVendedor() {
    const modal = document.getElementById('modalDetalleVendedor');
    if (modal) modal.style.display = 'none';
}
