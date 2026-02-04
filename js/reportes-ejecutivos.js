// ═══════════════════════════════════════════════════════════════
// REPORTES EJECUTIVOS - CONSOLIDACIÓN FINANCIERA
// ═══════════════════════════════════════════════════════════════

// Variables globales para gráficos
var chartIngresosEgresosInstance = null;
var chartDistribucionGastosInstance = null;
var chartMetasVentasInstance = null;
var chartTendenciaVentasInstance = null;

// Datos consolidados
var datosReporteEjecutivo = {
    ingresos: 0,
    egresos: 0,
    utilidad: 0,
    progresoMetas: 0,
    ingresosDetallados: [],
    egresosDetallados: [],
    analisisTiendas: []
};

// ═══════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL: CARGAR REPORTE EJECUTIVO
// ═══════════════════════════════════════════════════════════════

async function cargarReporteEjecutivo() {
    const fechaInicio = document.getElementById('reporteFechaInicio').value;
    const fechaFin = document.getElementById('reporteFechaFin').value;

    if (!fechaInicio || !fechaFin) {
        showToast('Selecciona un rango de fechas', 'warning');
        return;
    }

    try {
        showToast('Generando reporte...', 'info');

        // Consolidar datos
        const ingresos = await consolidarIngresos(fechaInicio, fechaFin);
        const egresos = await consolidarEgresos(fechaInicio, fechaFin);
        const metas = await consolidarMetas(fechaInicio, fechaFin);
        const metasProveedores = await consolidarMetasProveedores(fechaInicio, fechaFin);
        const creditos = await consolidarCreditosMoteros(fechaInicio, fechaFin);
        const deudas = await consolidarDeudasNegocio();
        const caja = await consolidarCierresCaja(fechaInicio, fechaFin);
        const deudores = await consolidarDeudores();

        // Calcular KPIs
        datosReporteEjecutivo.ingresos = ingresos.total;
        datosReporteEjecutivo.egresos = egresos.total;
        datosReporteEjecutivo.utilidad = ingresos.total - egresos.total;
        datosReporteEjecutivo.progresoMetas = metas.progresoPromedio;

        datosReporteEjecutivo.ingresosDetallados = ingresos.detalle;
        datosReporteEjecutivo.egresosDetallados = egresos.detalle;
        datosReporteEjecutivo.analisisTiendas = metas.analisisTiendas;
        datosReporteEjecutivo.metasProveedores = metasProveedores;
        datosReporteEjecutivo.creditos = creditos;
        datosReporteEjecutivo.deudas = deudas;
        datosReporteEjecutivo.caja = caja;
        datosReporteEjecutivo.deudores = deudores;

        // Actualizar UI
        actualizarKPIs();
        renderizarGraficosEjecutivos(ingresos, egresos, metas);
        renderizarGraficosAdicionales(); // NUEVO: Gráficos de créditos, deudas y deudores
        renderizarTablasDetalladas();

        showToast('Reporte generado exitosamente', 'success');

    } catch (error) {
        console.error('Error generando reporte:', error);
        showToast('Error al generar reporte: ' + error.message, 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// CONSOLIDACIÓN DE INGRESOS
// ═══════════════════════════════════════════════════════════════

async function consolidarIngresos(fechaInicio, fechaFin) {
    let total = 0;
    const detalle = [];

    // 1. Ventas por tienda
    const tiendas = ['Alcalá', 'Local 01', 'Jordán', 'Digital', 'Administrativo'];

    for (const tienda of tiendas) {
        const { data: ventas, error: errorVentas } = await supabaseClient
            .from('ventas')
            .select('total')
            .eq('local', tienda)
            .gte('created_at', fechaInicio + 'T00:00:00')
            .lte('created_at', fechaFin + 'T23:59:59');

        if (errorVentas) {
            console.error(`Error cargando ventas de ${tienda}:`, errorVentas);
        }

        const totalVentas = ventas?.reduce((sum, v) => sum + parseFloat(v.total || 0), 0) || 0;

        // 2. Ventas de eventos (por tienda si aplica)
        // 2. Ventas de eventos (si la tienda participó en eventos)
        const { data: eventos } = await supabaseClient
            .from('eventos_tienda')
            .select('ganancias')
            .gte('fecha_inicio', fechaInicio)
            .lte('fecha_fin', fechaFin);

        const totalEventos = eventos?.reduce((sum, e) => sum + parseFloat(e.ganancias || 0), 0) || 0;

        detalle.push({
            tienda: tienda,
            ventas: totalVentas,
            eventos: totalEventos / tiendas.length, // Distribuir eventos proporcionalmente
            otros: 0,
            total: totalVentas + (totalEventos / tiendas.length)
        });

        total += totalVentas + (totalEventos / tiendas.length);
    }

    return { total, detalle };
}

// ═══════════════════════════════════════════════════════════════
// CONSOLIDACIÓN DE EGRESOS
// ═══════════════════════════════════════════════════════════════

async function consolidarEgresos(fechaInicio, fechaFin) {
    let total = 0;
    const detalle = [];

    // 1. Compras a Proveedores
    const { data: compras } = await supabaseClient
        .from('compras_proveedor')
        .select('valor_compra')
        .gte('created_at', fechaInicio + 'T00:00:00')
        .lte('created_at', fechaFin + 'T23:59:59');

    const totalCompras = compras?.reduce((sum, c) => sum + parseFloat(c.valor_compra || 0), 0) || 0;

    // 2. Nómina (empleados activos)
    const { data: empleados } = await supabaseClient
        .from('empleados_tienda')
        .select('salario_base')
        .eq('estado', 'Activo');

    const totalNomina = empleados?.reduce((sum, e) => sum + parseFloat(e.salario_base || 0), 0) || 0;

    // 3. Gastos de Eventos
    const { data: eventos } = await supabaseClient
        .from('eventos_tienda')
        .select('gastos_totales, gastos, gastos_otros, gastos_alimentacion')
        .gte('fecha_inicio', fechaInicio)
        .lte('fecha_fin', fechaFin);

    const totalGastosEventos = eventos?.reduce((sum, e) => {
        return sum + parseFloat(e.gastos_totales || 0) + parseFloat(e.gastos || 0) +
            parseFloat(e.gastos_otros || 0) + parseFloat(e.gastos_alimentacion || 0);
    }, 0) || 0;

    // 4. Servicios (Recordatorios de pago): Omitir si no existe
    const totalServicios = 0;

    // Consolidar detalle
    detalle.push(
        { categoria: 'Compras a Proveedores', monto: totalCompras, porcentaje: 0 },
        { categoria: 'Nómina', monto: totalNomina, porcentaje: 0 },
        { categoria: 'Eventos', monto: totalGastosEventos, porcentaje: 0 },
        { categoria: 'Servicios', monto: totalServicios, porcentaje: 0 }
    );

    total = totalCompras + totalNomina + totalGastosEventos + totalServicios;

    // Calcular porcentajes
    detalle.forEach(d => {
        d.porcentaje = total > 0 ? ((d.monto / total) * 100).toFixed(1) : 0;
    });

    return { total, detalle };
}

// ═══════════════════════════════════════════════════════════════
// CONSOLIDACIÓN DE METAS
// ═══════════════════════════════════════════════════════════════

async function consolidarMetas(fechaInicio, fechaFin) {
    const analisisTiendas = [];
    let progresoTotal = 0;
    let countTiendas = 0;

    const tiendas = ['Alcalá', 'Local 01', 'Jordán', 'Digital', 'Administrativo'];

    // Obtener metas configuradas
    const mesActual = new Date(fechaInicio).getMonth() + 1;
    const anioActual = new Date(fechaInicio).getFullYear();

    const { data: metasConfig } = await supabaseClient
        .from('metas_locales')
        .select('*')
        .eq('mes', mesActual)
        .eq('anio', anioActual);
    for (const tienda of tiendas) {
        const { data: ventas } = await supabaseClient
            .from('ventas')
            .select('total')
            .eq('local', tienda)
            .gte('created_at', fechaInicio)
            .lte('created_at', fechaFin + 'T23:59:59');

        const ventasReales = ventas?.reduce((sum, v) => sum + parseFloat(v.total || 0), 0) || 0;

        // Buscar meta configurada para esta tienda
        const metaConfig = metasConfig?.find(m => m.local === tienda);
        const metaMensual = parseFloat(metaConfig?.valor_meta || 10000000); // Default 10M si no hay meta

        const progreso = metaMensual > 0 ? ((ventasReales / metaMensual) * 100).toFixed(1) : 0;
        const falta = metaMensual - ventasReales;

        analisisTiendas.push({
            tienda: tienda,
            meta: metaMensual,
            ventas: ventasReales,
            progreso: progreso,
            falta: falta > 0 ? falta : 0
        });

        progresoTotal += parseFloat(progreso);
        countTiendas++;
    }

    const progresoPromedio = countTiendas > 0 ? (progresoTotal / countTiendas).toFixed(1) : 0;

    return { analisisTiendas, progresoPromedio };
}

// ═══════════════════════════════════════════════════════════════
// CONSOLIDACIÓN DE METAS DE PROVEEDORES
// ═══════════════════════════════════════════════════════════════

async function consolidarMetasProveedores(fechaInicio, fechaFin) {
    const analisisProveedores = [];

    // Obtener todos los proveedores
    const { data: proveedores } = await supabaseClient
        .from('proveedores')
        .select('*');

    if (!proveedores || proveedores.length === 0) {
        return [];
    }

    for (const proveedor of proveedores) {
        // Obtener meta configurada para este proveedor
        const { data: metaProveedor } = await supabaseClient
            .from('metas_proveedores')
            .select('*')
            .eq('proveedor', proveedor.razon_social)
            .maybeSingle();

        if (!metaProveedor) continue; // Solo incluir proveedores con meta configurada

        const metaMensual = parseFloat(metaProveedor.monto_meta || 0);

        // Obtener compras reales al proveedor en el período
        const { data: compras } = await supabaseClient
            .from('compras_proveedor')
            .select('valor_compra')
            .eq('proveedor_id', proveedor.id)
            .gte('created_at', fechaInicio + 'T00:00:00')
            .lte('created_at', fechaFin + 'T23:59:59');

        const comprasReales = compras?.reduce((sum, c) => sum + parseFloat(c.valor_compra || 0), 0) || 0;

        const progreso = metaMensual > 0 ? ((comprasReales / metaMensual) * 100).toFixed(1) : 0;
        const falta = metaMensual - comprasReales;

        analisisProveedores.push({
            proveedor: proveedor.razon_social || proveedor.nombre_comercial || 'Sin nombre',
            meta: metaMensual,
            compras: comprasReales,
            progreso: progreso,
            falta: falta > 0 ? falta : 0
        });
    }

    return analisisProveedores;
}

// ═══════════════════════════════════════════════════════════════
// CONSOLIDACIÓN DE CRÉDITOS MOTEROS
// ═══════════════════════════════════════════════════════════════

async function consolidarCreditosMoteros(fechaInicio, fechaFin) {
    const { data: creditos } = await supabaseClient
        .from('creditos_motero')
        .select('*')
        .gte('fecha_inicio', fechaInicio)
        .lte('fecha_inicio', fechaFin);

    if (!creditos || creditos.length === 0) {
        return { totalOtorgado: 0, carteraActiva: 0, carteraPagada: 0, carteraMora: 0, tasaRecuperacion: 0, detallePorEstado: [] };
    }

    let totalOtorgado = 0, carteraActiva = 0, carteraPagada = 0, carteraMora = 0;
    const estadosCount = {};

    creditos.forEach(credito => {
        const monto = parseFloat(credito.monto_total || 0);
        const saldo = parseFloat(credito.saldo_pendiente || 0);
        const estado = credito.estado || 'activo';
        totalOtorgado += monto;
        if (estado === 'activo') carteraActiva += saldo;
        else if (estado === 'mora') carteraMora += saldo;
        else if (estado === 'pagado' || estado === 'CERRADO') carteraPagada += monto;
        estadosCount[estado] = (estadosCount[estado] || 0) + 1;
    });

    const detallePorEstado = Object.keys(estadosCount).map(estado => ({
        estado, cantidad: estadosCount[estado], porcentaje: ((estadosCount[estado] / creditos.length) * 100).toFixed(1)
    }));

    return {
        totalOtorgado, carteraActiva, carteraPagada, carteraMora,
        tasaRecuperacion: totalOtorgado > 0 ? (((totalOtorgado - carteraActiva - carteraMora) / totalOtorgado) * 100).toFixed(1) : 0,
        detallePorEstado
    };
}

// ═══════════════════════════════════════════════════════════════
// CONSOLIDACIÓN DE DEUDAS DEL NEGOCIO
// ═══════════════════════════════════════════════════════════════

async function consolidarDeudasNegocio() {
    const { data: deudas } = await supabaseClient
        .from('deudas_negocio')
        .select('*')
        .in('estado', ['activo', 'ABIERTO']);

    if (!deudas || deudas.length === 0) {
        return { totalPasivos: 0, detalleDeudas: [] };
    }

    let totalPasivos = 0;
    const detalleDeudas = deudas.map(deuda => {
        const saldo = parseFloat(deuda.saldo_actual || 0);
        totalPasivos += saldo;
        return {
            concepto: deuda.concepto || 'Sin concepto',
            acreedor: deuda.acreedor || 'No especificado',
            montoOriginal: parseFloat(deuda.monto_original || 0),
            saldoActual: saldo,
            porcentajePagado: deuda.monto_original > 0 ? (((deuda.monto_original - saldo) / deuda.monto_original) * 100).toFixed(1) : 0
        };
    });

    return { totalPasivos, detalleDeudas };
}

// ═══════════════════════════════════════════════════════════════
// CONSOLIDACIÓN DE CIERRES DE CAJA
// ═══════════════════════════════════════════════════════════════

async function consolidarCierresCaja(fechaInicio, fechaFin) {
    const tiendas = ['Alcalá', 'Local 01', 'Jordán', 'Digital', 'Admin'];
    const detalleCaja = [];
    let totalEfectivo = 0;

    for (const tienda of tiendas) {
        const { data: cierres } = await supabaseClient
            .from('cierres_caja')
            .select('*')
            .eq('local', tienda)
            .gte('fecha', fechaInicio)
            .lte('fecha', fechaFin)
            .order('fecha', { ascending: false })
            .limit(1);

        if (cierres && cierres.length > 0) {
            const cierre = cierres[0];
            const efectivoReal = parseFloat(cierre.efectivo_real || cierre.efectivo_contado || 0);
            totalEfectivo += efectivoReal;
            detalleCaja.push({
                tienda,
                efectivo: efectivoReal,
                base: parseFloat(cierre.base_inicial || cierre.base_caja || 0),
                diferencia: parseFloat(cierre.diferencia || cierre.diferencia_total || 0),
                estado: cierre.estado || 'abierto'
            });
        }
    }

    return { totalEfectivo, detalleCaja };
}

// ═══════════════════════════════════════════════════════════════
// CONSOLIDACIÓN DE DEUDORES
// ═══════════════════════════════════════════════════════════════

async function consolidarDeudores() {
    const { data: deudores } = await supabaseClient
        .from('deudores')
        .select('*')
        .eq('estado', 'activo');

    if (!deudores || deudores.length === 0) {
        return { carteraTotal: 0, carteraVencida: 0, detalleDeudores: [] };
    }

    let carteraTotal = 0, carteraVencida = 0;
    const detalleDeudores = deudores.map(deudor => {
        const saldo = parseFloat(deudor.saldo_actual || 0);
        const diasMora = parseInt(deudor.dias_mora || 0);
        carteraTotal += saldo;
        if (diasMora > 30) carteraVencida += saldo;
        return {
            nombre: deudor.nombre_completo || 'Sin nombre',
            saldo, diasMora,
            tienda: deudor.sede_venta || 'No especificado',
            telefono: deudor.telefono || 'N/A'
        };
    });

    detalleDeudores.sort((a, b) => b.saldo - a.saldo);
    return { carteraTotal, carteraVencida, detalleDeudores: detalleDeudores.slice(0, 20) };
}

// ═══════════════════════════════════════════════════════════════
// ACTUALIZAR KPIs EN UI
// ═══════════════════════════════════════════════════════════════

function actualizarKPIs() {
    // KPIs Base
    document.getElementById('kpiIngresos').textContent = '$' + formatearPrecio(datosReporteEjecutivo.ingresos);
    document.getElementById('kpiEgresos').textContent = '$' + formatearPrecio(datosReporteEjecutivo.egresos);
    document.getElementById('kpiUtilidad').textContent = '$' + formatearPrecio(datosReporteEjecutivo.utilidad);
    document.getElementById('kpiProgresoMetas').textContent = datosReporteEjecutivo.progresoMetas + '%';

    // KPIs Créditos Moteros
    if (datosReporteEjecutivo.creditos) {
        document.getElementById('kpiCreditosOtorgados').textContent = '$' + formatearPrecio(datosReporteEjecutivo.creditos.totalOtorgado);
        document.getElementById('kpiCarteraActiva').textContent = '$' + formatearPrecio(datosReporteEjecutivo.creditos.carteraActiva);
        document.getElementById('kpiCarteraMora').textContent = '$' + formatearPrecio(datosReporteEjecutivo.creditos.carteraMora);
        document.getElementById('kpiTasaRecuperacion').textContent = datosReporteEjecutivo.creditos.tasaRecuperacion + '%';
    }

    // KPI Deudas
    if (datosReporteEjecutivo.deudas) {
        document.getElementById('kpiTotalPasivos').textContent = '$' + formatearPrecio(datosReporteEjecutivo.deudas.totalPasivos);
    }

    // KPI Caja
    if (datosReporteEjecutivo.caja) {
        document.getElementById('kpiTotalEfectivo').textContent = '$' + formatearPrecio(datosReporteEjecutivo.caja.totalEfectivo);
    }

    // KPIs Deudores
    if (datosReporteEjecutivo.deudores) {
        document.getElementById('kpiCarteraTotal').textContent = '$' + formatearPrecio(datosReporteEjecutivo.deudores.carteraTotal);
        document.getElementById('kpiCarteraVencida').textContent = '$' + formatearPrecio(datosReporteEjecutivo.deudores.carteraVencida);
    }
}

// ═══════════════════════════════════════════════════════════════
// RENDERIZAR GRÁFICOS
// ═══════════════════════════════════════════════════════════════

function renderizarGraficosEjecutivos(ingresos, egresos, metas) {
    // 1. Gráfico: Ingresos vs Egresos
    const ctxIngresosEgresos = document.getElementById('chartIngresosEgresos');
    if (!ctxIngresosEgresos) {
        console.error('Canvas chartIngresosEgresos no encontrado');
        return;
    }
    if (chartIngresosEgresosInstance) chartIngresosEgresosInstance.destroy();

    chartIngresosEgresosInstance = new Chart(ctxIngresosEgresos, {
        type: 'bar',
        data: {
            labels: ['Ingresos', 'Egresos', 'Utilidad'],
            datasets: [{
                label: 'Monto ($)',
                data: [ingresos.total, egresos.total, datosReporteEjecutivo.utilidad],
                backgroundColor: ['#22c55e', '#ef4444', '#3b82f6'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    // 2. Gráfico: Distribución de Gastos
    const ctxDistribucion = document.getElementById('chartDistribucionGastos');
    if (chartDistribucionGastosInstance) chartDistribucionGastosInstance.destroy();

    chartDistribucionGastosInstance = new Chart(ctxDistribucion, {
        type: 'doughnut',
        data: {
            labels: egresos.detalle.map(e => e.categoria),
            datasets: [{
                data: egresos.detalle.map(e => e.monto),
                backgroundColor: ['#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });

    // 3. Gráfico: Metas vs Ventas
    const ctxMetas = document.getElementById('chartMetasVentas');
    if (chartMetasVentasInstance) chartMetasVentasInstance.destroy();

    chartMetasVentasInstance = new Chart(ctxMetas, {
        type: 'bar',
        data: {
            labels: metas.analisisTiendas.map(t => t.tienda),
            datasets: [
                {
                    label: 'Meta',
                    data: metas.analisisTiendas.map(t => t.meta),
                    backgroundColor: '#94a3b8'
                },
                {
                    label: 'Ventas Reales',
                    data: metas.analisisTiendas.map(t => t.ventas),
                    backgroundColor: '#22c55e'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    // 4. Gráfico: Tendencia (simplificado por ahora)
    const ctxTendencia = document.getElementById('chartTendenciaVentas');
    if (chartTendenciaVentasInstance) chartTendenciaVentasInstance.destroy();

    chartTendenciaVentasInstance = new Chart(ctxTendencia, {
        type: 'line',
        data: {
            labels: metas.analisisTiendas.map(t => t.tienda),
            datasets: [{
                label: 'Ventas',
                data: metas.analisisTiendas.map(t => t.ventas),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// Variables globales para los nuevos gráficos
let chartCarteraCreditosInstance = null;
let chartDistribucionPasivosInstance = null;
let chartAntiguedadCarteraInstance = null;

// ═══════════════════════════════════════════════════════════════
// RENDERIZAR GRÁFICOS ADICIONALES (NUEVOS)
// ═══════════════════════════════════════════════════════════════

function renderizarGraficosAdicionales() {
    // 1. Gráfico: Distribución de Cartera de Créditos
    const ctxCarteraCreditos = document.getElementById('chartCarteraCreditos');
    if (ctxCarteraCreditos && datosReporteEjecutivo.creditos && datosReporteEjecutivo.creditos.detallePorEstado.length > 0) {
        if (chartCarteraCreditosInstance) chartCarteraCreditosInstance.destroy();

        chartCarteraCreditosInstance = new Chart(ctxCarteraCreditos, {
            type: 'doughnut',
            data: {
                labels: datosReporteEjecutivo.creditos.detallePorEstado.map(c => c.estado.toUpperCase()),
                datasets: [{
                    data: datosReporteEjecutivo.creditos.detallePorEstado.map(c => c.cantidad),
                    backgroundColor: ['#8b5cf6', '#06b6d4', '#10b981', '#f43f5e'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return context.label + ': ' + context.parsed + ' créditos (' +
                                    datosReporteEjecutivo.creditos.detallePorEstado[context.dataIndex].porcentaje + '%)';
                            }
                        }
                    }
                }
            }
        });
    }

    // 2. Gráfico: Distribución de Pasivos
    const ctxPasivos = document.getElementById('chartDistribucionPasivos');
    if (ctxPasivos && datosReporteEjecutivo.deudas && datosReporteEjecutivo.deudas.detalleDeudas.length > 0) {
        if (chartDistribucionPasivosInstance) chartDistribucionPasivosInstance.destroy();

        // Tomar top 5 deudas más grandes
        const top5Deudas = [...datosReporteEjecutivo.deudas.detalleDeudas]
            .sort((a, b) => b.saldoActual - a.saldoActual)
            .slice(0, 5);

        chartDistribucionPasivosInstance = new Chart(ctxPasivos, {
            type: 'bar',
            data: {
                labels: top5Deudas.map(d => d.concepto),
                datasets: [{
                    label: 'Saldo Actual',
                    data: top5Deudas.map(d => d.saldoActual),
                    backgroundColor: '#f97316',
                    borderColor: '#ea580c',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return '$' + formatearPrecio(context.parsed.x);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                return '$' + formatearPrecio(value);
                            }
                        }
                    }
                }
            }
        });
    }

    // 3. Gráfico: Antigüedad de Cartera de Deudores
    const ctxAntiguedad = document.getElementById('chartAntiguedadCartera');
    if (ctxAntiguedad && datosReporteEjecutivo.deudores && datosReporteEjecutivo.deudores.detalleDeudores.length > 0) {
        if (chartAntiguedadCarteraInstance) chartAntiguedadCarteraInstance.destroy();

        // Agrupar por rangos de días de mora
        const rangos = {
            '0-30 días': 0,
            '31-60 días': 0,
            '61-90 días': 0,
            '+90 días': 0
        };

        datosReporteEjecutivo.deudores.detalleDeudores.forEach(d => {
            const dias = d.diasMora;
            if (dias <= 30) rangos['0-30 días'] += d.saldo;
            else if (dias <= 60) rangos['31-60 días'] += d.saldo;
            else if (dias <= 90) rangos['61-90 días'] += d.saldo;
            else rangos['+90 días'] += d.saldo;
        });

        chartAntiguedadCarteraInstance = new Chart(ctxAntiguedad, {
            type: 'bar',
            data: {
                labels: Object.keys(rangos),
                datasets: [{
                    label: 'Saldo por Antigüedad',
                    data: Object.values(rangos),
                    backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#dc2626'],
                    borderWidth: 1,
                    borderColor: '#fff'
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
                                return '$' + formatearPrecio(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                return '$' + formatearPrecio(value);
                            }
                        }
                    }
                }
            }
        });
    }
}


// ═══════════════════════════════════════════════════════════════
// RENDERIZAR TABLAS DETALLADAS
// ═══════════════════════════════════════════════════════════════

function renderizarTablasDetalladas() {
    // 1. Tabla: Ingresos Detallados
    const tbodyIngresos = document.getElementById('tbodyIngresosDetallados');
    tbodyIngresos.innerHTML = datosReporteEjecutivo.ingresosDetallados.map(i => `
        <tr>
            <td><strong>${i.tienda}</strong></td>
            <td>$${formatearPrecio(i.ventas)}</td>
            <td>$${formatearPrecio(i.eventos)}</td>
            <td>$${formatearPrecio(i.otros)}</td>
            <td><strong>$${formatearPrecio(i.total)}</strong></td>
        </tr>
    `).join('');

    // 2. Tabla: Egresos Detallados
    const tbodyEgresos = document.getElementById('tbodyEgresosDetallados');
    tbodyEgresos.innerHTML = datosReporteEjecutivo.egresosDetallados.map(e => `
        <tr>
            <td><strong>${e.categoria}</strong></td>
            <td>$${formatearPrecio(e.monto)}</td>
            <td><span class="badge badge-info">${e.porcentaje}%</span></td>
        </tr>
    `).join('');

    // 3. Tabla: Análisis Tiendas
    const tbodyAnalisis = document.getElementById('tbodyAnalisisTiendas');
    tbodyAnalisis.innerHTML = datosReporteEjecutivo.analisisTiendas.map(t => `
        <tr>
            <td><strong>${t.tienda}</strong></td>
            <td>$${formatearPrecio(t.meta)}</td>
            <td>$${formatearPrecio(t.ventas)}</td>
            <td>
                <span class="badge ${t.progreso >= 100 ? 'badge-success' : t.progreso >= 70 ? 'badge-warning' : 'badge-danger'}">
                    ${t.progreso}%
                </span>
            </td>
            <td>$${formatearPrecio(t.falta)}</td>
        </tr>
    `).join('');

    // 4. Tabla: Metas de Proveedores
    const tbodyProveedores = document.getElementById('tbodyMetasProveedores');
    if (datosReporteEjecutivo.metasProveedores && datosReporteEjecutivo.metasProveedores.length > 0) {
        tbodyProveedores.innerHTML = datosReporteEjecutivo.metasProveedores.map(p => `
            <tr>
                <td><strong>${p.proveedor}</strong></td>
                <td>$${formatearPrecio(p.meta)}</td>
                <td>$${formatearPrecio(p.compras)}</td>
                <td>
                    <span class="badge ${p.progreso >= 100 ? 'badge-success' : p.progreso >= 70 ? 'badge-warning' : 'badge-danger'}">
                        ${p.progreso}%
                    </span>
                </td>
                <td>$${formatearPrecio(p.falta)}</td>
            </tr>
        `).join('');
    } else {
        tbodyProveedores.innerHTML = '<tr><td colspan="5" class="text-center">No hay metas de proveedores configuradas</td></tr>';
    }

    // 5. Tabla: Créditos por Estado
    const tbodyCreditosEstado = document.getElementById('tbodyCreditosEstado');
    if (datosReporteEjecutivo.creditos && datosReporteEjecutivo.creditos.detallePorEstado.length > 0) {
        tbodyCreditosEstado.innerHTML = datosReporteEjecutivo.creditos.detallePorEstado.map(c => `
            <tr>
                <td><strong>${c.estado.toUpperCase()}</strong></td>
                <td>${c.cantidad}</td>
                <td>
                    <span class="badge badge-info">${c.porcentaje}%</span>
                </td>
            </tr>
        `).join('');
    } else {
        tbodyCreditosEstado.innerHTML = '<tr><td colspan="3" class="text-center">No hay datos de créditos</td></tr>';
    }

    // 6. Tabla: Deudas del Negocio
    const tbodyDeudas = document.getElementById('tbodyDeudas');
    if (datosReporteEjecutivo.deudas && datosReporteEjecutivo.deudas.detalleDeudas.length > 0) {
        tbodyDeudas.innerHTML = datosReporteEjecutivo.deudas.detalleDeudas.map(d => `
            <tr>
                <td><strong>${d.concepto}</strong></td>
                <td>${d.acreedor}</td>
                <td>$${formatearPrecio(d.montoOriginal)}</td>
                <td>$${formatearPrecio(d.saldoActual)}</td>
                <td>
                    <span class="badge ${d.porcentajePagado >= 50 ? 'badge-success' : 'badge-warning'}">${d.porcentajePagado}%</span>
                </td>
            </tr>
        `).join('');
    } else {
        tbodyDeudas.innerHTML = '<tr><td colspan="5" class="text-center">No hay deudas activas</td></tr>';
    }

    // 7. Tabla: Cierres de Caja
    const tbodyCierresCaja = document.getElementById('tbodyCierresCaja');
    if (datosReporteEjecutivo.caja && datosReporteEjecutivo.caja.detalleCaja.length > 0) {
        tbodyCierresCaja.innerHTML = datosReporteEjecutivo.caja.detalleCaja.map(c => `
            <tr>
                <td><strong>${c.tienda}</strong></td>
                <td>$${formatearPrecio(c.efectivo)}</td>
                <td>$${formatearPrecio(c.base)}</td>
                <td class="${c.diferencia >= 0 ? 'text-success' : 'text-danger'}">
                    $${formatearPrecio(c.diferencia)}
                </td>
                <td>
                    <span class="badge ${c.estado === 'cerrado' ? 'badge-success' : 'badge-warning'}">${c.estado}</span>
                </td>
            </tr>
        `).join('');
    } else {
        tbodyCierresCaja.innerHTML = '<tr><td colspan="5" class="text-center">No hay datos de cierres de caja</td></tr>';
    }

    // 8. Tabla: Deudores
    const tbodyDeudores = document.getElementById('tbodyDeudores');
    if (datosReporteEjecutivo.deudores && datosReporteEjecutivo.deudores.detalleDeudores.length > 0) {
        tbodyDeudores.innerHTML = datosReporteEjecutivo.deudores.detalleDeudores.map(d => `
            <tr>
                <td><strong>${d.nombre}</strong></td>
                <td>$${formatearPrecio(d.saldo)}</td>
                <td>
                    <span class="badge ${d.diasMora > 60 ? 'badge-danger' : d.diasMora > 30 ? 'badge-warning' : 'badge-info'}">${d.diasMora} días</span>
                </td>
                <td>${d.tienda}</td>
                <td>${d.telefono}</td>
            </tr>
        `).join('');
    } else {
        tbodyDeudores.innerHTML = '<tr><td colspan="5" class="text-center">No hay deudores activos</td></tr>';
    }
}

// ═══════════════════════════════════════════════════════════════
// EXPORTACIÓN (usando ReportExporter con branding de Moteros)
// ═══════════════════════════════════════════════════════════════

function exportarReporteEjecutivoExcel() {
    if (!datosReporteEjecutivo.ingresosDetallados.length) {
        showToast('Genera un reporte primero', 'warning');
        return;
    }

    // Preparar datos consolidados para Excel
    const fechaInicio = document.getElementById('reporteFechaInicio').value;
    const fechaFin = document.getElementById('reporteFechaFin').value;

    // Crear workbook con múltiples hojas
    const wb = XLSX.utils.book_new();

    // Hoja 1: KPIs
    const kpisData = [
        ['REPORTE EJECUTIVO - MOTEROS SPORTS LINE'],
        [`Período: ${fechaInicio} - ${fechaFin}`],
        [''],
        ['KPI', 'Valor'],
        ['Ingresos Totales', `$${formatearPrecio(datosReporteEjecutivo.ingresos)}`],
        ['Egresos Totales', `$${formatearPrecio(datosReporteEjecutivo.egresos)}`],
        ['Utilidad Neta', `$${formatearPrecio(datosReporteEjecutivo.utilidad)}`],
        ['Progreso vs Metas', `${datosReporteEjecutivo.progresoMetas}%`]
    ];
    const wsKPIs = XLSX.utils.aoa_to_sheet(kpisData);
    XLSX.utils.book_append_sheet(wb, wsKPIs, 'Resumen');

    // Hoja 2: Ingresos Detallados
    const ingresosData = datosReporteEjecutivo.ingresosDetallados.map(i => ({
        'Tienda': i.tienda,
        'Ventas': i.ventas,
        'Eventos': i.eventos,
        'Otros': i.otros,
        'Total': i.total
    }));
    const wsIngresos = XLSX.utils.json_to_sheet(ingresosData);
    XLSX.utils.book_append_sheet(wb, wsIngresos, 'Ingresos');

    // Hoja 3: Egresos Detallados
    const egresosData = datosReporteEjecutivo.egresosDetallados.map(e => ({
        'Categoría': e.categoria,
        'Monto': e.monto,
        '% del Total': e.porcentaje + '%'
    }));
    const wsEgresos = XLSX.utils.json_to_sheet(egresosData);
    XLSX.utils.book_append_sheet(wb, wsEgresos, 'Egresos');

    // Hoja 4: Análisis de Metas
    const metasData = datosReporteEjecutivo.analisisTiendas.map(t => ({
        'Tienda': t.tienda,
        'Meta Mensual': t.meta,
        'Ventas Reales': t.ventas,
        'Progreso (%)': t.progreso + '%',
        'Falta': t.falta
    }));
    const wsAnalisis = XLSX.utils.json_to_sheet(metasData);
    XLSX.utils.book_append_sheet(wb, wsAnalisis, 'Análisis Metas');

    // Hoja 5: Créditos Moteros
    if (datosReporteEjecutivo.creditos && datosReporteEjecutivo.creditos.detallePorEstado.length > 0) {
        const creditosData = datosReporteEjecutivo.creditos.detallePorEstado.map(c => ({
            'Estado': c.estado.toUpperCase(),
            'Cantidad': c.cantidad,
            '% del Total': c.porcentaje + '%'
        }));
        const wsCreditos = XLSX.utils.json_to_sheet(creditosData);
        XLSX.utils.book_append_sheet(wb, wsCreditos, 'Créditos Moteros');
    }

    // Hoja 6: Deudas del Negocio
    if (datosReporteEjecutivo.deudas && datosReporteEjecutivo.deudas.detalleDeudas.length > 0) {
        const deudasData = datosReporteEjecutivo.deudas.detalleDeudas.map(d => ({
            'Concepto': d.concepto,
            'Acreedor': d.acreedor,
            'Monto Original': d.montoOriginal,
            'Saldo Actual': d.saldoActual,
            '% Pagado': d.porcentajePagado + '%'
        }));
        const wsDeudas = XLSX.utils.json_to_sheet(deudasData);
        XLSX.utils.book_append_sheet(wb, wsDeudas, 'Deudas Negocio');
    }

    // Hoja 7: Cierres de Caja
    if (datosReporteEjecutivo.caja && datosReporteEjecutivo.caja.detalleCaja.length > 0) {
        const cajaData = datosReporteEjecutivo.caja.detalleCaja.map(c => ({
            'Tienda': c.tienda,
            'Efectivo Real': c.efectivo,
            'Base Inicial': c.base,
            'Diferencia': c.diferencia,
            'Estado': c.estado
        }));
        const wsCaja = XLSX.utils.json_to_sheet(cajaData);
        XLSX.utils.book_append_sheet(wb, wsCaja, 'Cierres Caja');
    }

    // Hoja 8: Deudores
    if (datosReporteEjecutivo.deudores && datosReporteEjecutivo.deudores.detalleDeudores.length > 0) {
        const deudoresData = datosReporteEjecutivo.deudores.detalleDeudores.map(d => ({
            'Cliente': d.nombre,
            'Saldo': d.saldo,
            'Días Mora': d.diasMora,
            'Tienda': d.tienda,
            'Teléfono': d.telefono
        }));
        const wsDeudores = XLSX.utils.json_to_sheet(deudoresData);
        XLSX.utils.book_append_sheet(wb, wsDeudores, 'Deudores');
    }

    // Descargar usando nombre descriptivo
    XLSX.writeFile(wb, `Reporte_Ejecutivo_${fechaInicio}_${fechaFin}.xlsx`);
    showToast('Reporte exportado a Excel', 'success');
}

function exportarReporteEjecutivoPDF() {
    if (!datosReporteEjecutivo.ingresosDetallados.length) {
        showToast('Genera un reporte primero', 'warning');
        return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
        showToast('Librería PDF no disponible', 'warning');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        const fechaInicio = document.getElementById('reporteFechaInicio').value;
        const fechaFin = document.getElementById('reporteFechaFin').value;

        // === LOGO DE MOTEROS ===
        const logoURL = "https://pbblthbrdkevuyjxyuar.supabase.co/storage/v1/object/public/productos-imagenes/moteros%20logo.jpg";

        // Agregar logo (circular, esquina superior izquierda)
        try {
            doc.addImage(logoURL, 'JPEG', 14, 10, 20, 20); // x, y, width, height
        } catch (e) {
            console.warn('No se pudo cargar el logo:', e);
        }

        // === ENCABEZADO CON BRANDING MOTEROS ===
        doc.setFontSize(20);
        doc.setTextColor(30, 41, 59);
        doc.text('Reporte Ejecutivo', 40, 22); // Desplazado para dejar espacio al logo

        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`Período: ${fechaInicio} - ${fechaFin}`, 40, 30);
        doc.text(`Generado: ${new Date().toLocaleDateString('es-CO')}`, 40, 36);

        // Branding Moteros (esquina superior derecha)
        doc.setFontSize(12);
        doc.setTextColor(255, 107, 0); // Color naranja de Moteros
        doc.text('Moteros Sports Line', pageWidth - 14, 22, { align: 'right' });
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('Villavicencio, Meta', pageWidth - 14, 28, { align: 'right' });

        // === KPIs ===
        let y = 48;
        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text('Resumen Financiero', 14, y);

        y += 8;
        doc.setFontSize(10);

        doc.setTextColor(34, 197, 94); // Verde
        doc.text(`Ingresos: $${formatearPrecio(datosReporteEjecutivo.ingresos)}`, 14, y);

        doc.setTextColor(239, 68, 68); // Rojo
        doc.text(`Egresos: $${formatearPrecio(datosReporteEjecutivo.egresos)}`, 14, y + 7);

        doc.setTextColor(59, 130, 246); // Azul
        doc.text(`Utilidad: $${formatearPrecio(datosReporteEjecutivo.utilidad)}`, 14, y + 14);

        doc.setTextColor(245, 158, 11); // Naranja
        doc.text(`Progreso vs Metas: ${datosReporteEjecutivo.progresoMetas}%`, 14, y + 21);

        y += 35;

        // === GRÁFICOS COMO IMÁGENES ===
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.text('Visualizaciones', 14, y);
        y += 5;

        // Convertir gráficos a imágenes
        try {
            // Gráfico 1: Ingresos vs Egresos
            const canvas1 = document.getElementById('chartIngresosEgresos');
            if (canvas1) {
                const imgData1 = canvas1.toDataURL('image/png');
                doc.addImage(imgData1, 'PNG', 14, y, 85, 50);
            }

            // Gráfico 2: Distribución de Gastos
            const canvas2 = document.getElementById('chartDistribucionGastos');
            if (canvas2) {
                const imgData2 = canvas2.toDataURL('image/png');
                doc.addImage(imgData2, 'PNG', 105, y, 85, 50);
            }

            y += 55;

            // Gráfico 3: Metas vs Ventas
            const canvas3 = document.getElementById('chartMetasVentas');
            if (canvas3) {
                const imgData3 = canvas3.toDataURL('image/png');
                doc.addImage(imgData3, 'PNG', 14, y, 85, 50);
            }

            // Gráfico 4: Tendencia
            const canvas4 = document.getElementById('chartTendenciaVentas');
            if (canvas4) {
                const imgData4 = canvas4.toDataURL('image/png');
                doc.addImage(imgData4, 'PNG', 105, y, 85, 50);
            }

            y += 60;
        } catch (e) {
            console.warn('Error agregando gráficos:', e);
            y += 10;
        }

        // === NUEVA PÁGINA PARA TABLAS ===
        doc.addPage();
        y = 20;

        // === TABLA 1: Ingresos por Tienda ===
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.text('Ingresos por Tienda', 14, y);

        doc.autoTable({
            startY: y + 5,
            head: [['Tienda', 'Ventas', 'Eventos', 'Total']],
            body: datosReporteEjecutivo.ingresosDetallados.map(i => [
                i.tienda,
                `$${formatearPrecio(i.ventas)}`,
                `$${formatearPrecio(i.eventos)}`,
                `$${formatearPrecio(i.total)}`
            ]),
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] }
        });

        y = doc.lastAutoTable.finalY + 12;

        // === TABLA 2: Egresos por Categoría ===
        if (y > 240) {
            doc.addPage();
            y = 20;
        }

        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.text('Egresos por Categoría', 14, y);

        doc.autoTable({
            startY: y + 5,
            head: [['Categoría', 'Monto', '% del Total']],
            body: datosReporteEjecutivo.egresosDetallados.map(e => [
                e.categoria,
                `$${formatearPrecio(e.monto)}`,
                `${e.porcentaje}%`
            ]),
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] }
        });

        y = doc.lastAutoTable.finalY + 12;

        // === TABLA 3: Análisis de Metas ===
        if (y > 240) {
            doc.addPage();
            y = 20;
        }

        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.text('Análisis de Metas por Tienda', 14, y);

        doc.autoTable({
            startY: y + 5,
            head: [['Tienda', 'Meta', 'Ventas', 'Progreso', 'Falta']],
            body: datosReporteEjecutivo.analisisTiendas.map(t => [
                t.tienda,
                `$${formatearPrecio(t.meta)}`,
                `$${formatearPrecio(t.ventas)}`,
                `${t.progreso}%`,
                `$${formatearPrecio(t.falta)}`
            ]),
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] }
        });

        y = doc.lastAutoTable.finalY + 12;

        // === TABLA 4: Metas de Proveedores (NUEVO) ===
        if (datosReporteEjecutivo.metasProveedores && datosReporteEjecutivo.metasProveedores.length > 0) {
            if (y > 240) {
                doc.addPage();
                y = 20;
            }

            doc.setFontSize(12);
            doc.setTextColor(30, 41, 59);
            doc.text('Análisis de Metas por Proveedor', 14, y);

            doc.autoTable({
                startY: y + 5,
                head: [['Proveedor', 'Meta', 'Compras', 'Progreso', 'Falta']],
                body: datosReporteEjecutivo.metasProveedores.map(p => [
                    p.proveedor,
                    `$${formatearPrecio(p.meta)}`,
                    `$${formatearPrecio(p.compras)}`,
                    `${p.progreso}%`,
                    `$${formatearPrecio(p.falta)}`
                ]),
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 3 },
                headStyles: { fillColor: [139, 92, 246], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] }
            });
        }

        y = doc.lastAutoTable.finalY + 12;

        // === TABLA 5: Créditos Moteros (NUEVO) ===
        if (datosReporteEjecutivo.creditos && datosReporteEjecutivo.creditos.detallePorEstado.length > 0) {
            if (y > 240) {
                doc.addPage();
                y = 20;
            }

            doc.setFontSize(12);
            doc.setTextColor(30, 41, 59);
            doc.text('Creditos Moteros', 14, y);

            // KPIs de Créditos
            doc.setFontSize(9);
            doc.text(`Total Otorgado: $${formatearPrecio(datosReporteEjecutivo.creditos.totalOtorgado)}`, 14, y + 6);
            doc.text(`Cartera Activa: $${formatearPrecio(datosReporteEjecutivo.creditos.carteraActiva)}`, 80, y + 6);
            doc.text(`En Mora: $${formatearPrecio(datosReporteEjecutivo.creditos.carteraMora)}`, 140, y + 6);

            doc.autoTable({
                startY: y + 12,
                head: [['Estado', 'Cantidad', '% del Total']],
                body: datosReporteEjecutivo.creditos.detallePorEstado.map(c => [
                    c.estado.toUpperCase(),
                    c.cantidad,
                    `${c.porcentaje}%`
                ]),
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 3 },
                headStyles: { fillColor: [139, 92, 246], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] }
            });

            y = doc.lastAutoTable.finalY + 12;
        }

        // === TABLA 6: Deudas del Negocio (NUEVO) ===
        if (datosReporteEjecutivo.deudas && datosReporteEjecutivo.deudas.detalleDeudas.length > 0) {
            if (y > 240) {
                doc.addPage();
                y = 20;
            }

            doc.setFontSize(12);
            doc.setTextColor(30, 41, 59);
            doc.text('Deudas y Obligaciones del Negocio', 14, y);

            // KPI de Deudas
            doc.setFontSize(9);
            doc.text(`Total Pasivos: $${formatearPrecio(datosReporteEjecutivo.deudas.totalPasivos)}`, 14, y + 6);

            doc.autoTable({
                startY: y + 12,
                head: [['Concepto', 'Acreedor', 'Monto Original', 'Saldo Actual', '% Pagado']],
                body: datosReporteEjecutivo.deudas.detalleDeudas.map(d => [
                    d.concepto,
                    d.acreedor,
                    `$${formatearPrecio(d.montoOriginal)}`,
                    `$${formatearPrecio(d.saldoActual)}`,
                    `${d.porcentajePagado}%`
                ]),
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] }
            });

            y = doc.lastAutoTable.finalY + 12;
        }

        // === TABLA 7: Cierres de Caja (NUEVO) ===
        if (datosReporteEjecutivo.caja && datosReporteEjecutivo.caja.detalleCaja.length > 0) {
            if (y > 240) {
                doc.addPage();
                y = 20;
            }

            doc.setFontSize(12);
            doc.setTextColor(30, 41, 59);
            doc.text('Efectivo en Cajas', 14, y);

            // KPI de Efectivo
            doc.setFontSize(9);
            doc.text(`Total Efectivo Disponible: $${formatearPrecio(datosReporteEjecutivo.caja.totalEfectivo)}`, 14, y + 6);

            doc.autoTable({
                startY: y + 12,
                head: [['Tienda', 'Efectivo Real', 'Base Inicial', 'Diferencia', 'Estado']],
                body: datosReporteEjecutivo.caja.detalleCaja.map(c => [
                    c.tienda,
                    `$${formatearPrecio(c.efectivo)}`,
                    `$${formatearPrecio(c.base)}`,
                    `$${formatearPrecio(c.diferencia)}`,
                    c.estado
                ]),
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 3 },
                headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] }
            });

            y = doc.lastAutoTable.finalY + 12;
        }

        // === TABLA 8: Deudores (NUEVO) ===
        if (datosReporteEjecutivo.deudores && datosReporteEjecutivo.deudores.detalleDeudores.length > 0) {
            if (y > 240) {
                doc.addPage();
                y = 20;
            }

            doc.setFontSize(12);
            doc.setTextColor(30, 41, 59);
            doc.text('Cartera de Deudores (Top 20)', 14, y);

            // KPIs de Deudores
            doc.setFontSize(9);
            doc.text(`Cartera Total: $${formatearPrecio(datosReporteEjecutivo.deudores.carteraTotal)}`, 14, y + 6);
            doc.text(`Cartera Vencida: $${formatearPrecio(datosReporteEjecutivo.deudores.carteraVencida)}`, 100, y + 6);

            doc.autoTable({
                startY: y + 12,
                head: [['Cliente', 'Saldo', 'Dias Mora', 'Tienda', 'Telefono']],
                body: datosReporteEjecutivo.deudores.detalleDeudores.map(d => [
                    d.nombre,
                    `$${formatearPrecio(d.saldo)}`,
                    `${d.diasMora} dias`,
                    d.tienda,
                    d.telefono
                ]),
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] }
            });
        }

        // Pie de página en todas las páginas
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(
                `Página ${i} de ${pageCount} | Moteros Sports Line © ${new Date().getFullYear()}`,
                pageWidth / 2,
                doc.internal.pageSize.getHeight() - 10,
                { align: 'center' }
            );
        }

        // Descargar
        doc.save(`Reporte_Ejecutivo_${fechaInicio}_${fechaFin}.pdf`);
        showToast('PDF generado correctamente 📄', 'success');

    } catch (error) {
        console.error('Error generando PDF:', error);
        showToast('Error al generar PDF: ' + error.message, 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════

// Establecer fechas por defecto (mes actual)
window.addEventListener('DOMContentLoaded', () => {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    const inputInicio = document.getElementById('reporteFechaInicio');
    const inputFin = document.getElementById('reporteFechaFin');

    if (inputInicio) inputInicio.value = primerDia.toISOString().split('T')[0];
    if (inputFin) inputFin.value = hoy.toISOString().split('T')[0];
});

// Exportar funciones globalmente
window.cargarReporteEjecutivo = cargarReporteEjecutivo;
window.exportarReporteEjecutivoExcel = exportarReporteEjecutivoExcel;
window.exportarReporteEjecutivoPDF = exportarReporteEjecutivoPDF;
