/**
 * LÓGICA DE REPORTES DE RENTABILIDAD DIARIA Y ANUAL
 * Moteros Sports Line
 */

let chartRentabilidadAnualInstance = null;
let chartDistribucionIngresosInstance = null;
let chartTendenciaMargenInstance = null;
let chartUtilidadPorDiaInstance = null;
let chartRentabilidadDiariaInstance = null;

let datosRentabilidadActual = {
    ventas: [],
    gastos: [],
    resumenDiario: [],
    anio: '',
    mes: ''
};

function switchRentabilidadTab(tab) {
    const btnDiaria = document.getElementById('btnTabDiaria');
    const btnAnual = document.getElementById('btnTabAnual');
    const ctrlDiarios = document.getElementById('controlesDiarios');
    const ctrlAnuales = document.getElementById('controlesAnuales');
    const vistaDiaria = document.getElementById('vistaRentabilidadDiaria');
    const vistaAnual = document.getElementById('vistaRentabilidadAnual');

    if (tab === 'diaria') {
        btnDiaria.classList.add('active', 'btn-primary');
        btnAnual.classList.remove('active', 'btn-primary');
        ctrlDiarios.style.display = 'flex';
        ctrlAnuales.style.display = 'none';
        vistaDiaria.style.display = 'block';
        vistaAnual.style.display = 'none';
    } else {
        btnAnual.classList.add('active', 'btn-primary');
        btnDiaria.classList.remove('active', 'btn-primary');
        ctrlDiarios.style.display = 'none';
        ctrlAnuales.style.display = 'flex';
        vistaDiaria.style.display = 'none';
        vistaAnual.style.display = 'block';

        // Si no hay datos anuales cargados, cargar por defecto
        if (!chartRentabilidadAnualInstance) {
            cargarComparativaAnual();
        }
    }
}

async function cargarRentabilidadDiaria() {
    const mesInput = document.getElementById('rentabilidadMes').value;
    if (!mesInput) {
        return showToast('Por favor selecciona un mes', 'warning');
    }

    const [anio, mes] = mesInput.split('-');
    datosRentabilidadActual.anio = anio;
    datosRentabilidadActual.mes = mes;
    datosRentabilidadActual.resumenDiario = []; // LIMPIAR DATOS PREVIOS

    const fechaInicio = `${anio}-${mes}-01T00:00:00`;
    const ultimoDia = new Date(anio, mes, 0).getDate();
    const fechaFin = `${anio}-${mes}-${ultimoDia}T23:59:59`;

    // 1. Obtener Ventas (con costo_unitario)
    const { data: ventas, error: errVentas } = await supabaseClient
        .from('ventas')
        .select('created_at, total, costo_unitario, cantidad')
        .gte('created_at', fechaInicio)
        .lte('created_at', fechaFin);

    if (errVentas) return console.error('Error ventas:', errVentas);
    datosRentabilidadActual.ventas = ventas;

    // 2. Obtener Gastos (gastos_tienda)
    const { data: gastos, error: errGastos } = await supabaseClient
        .from('gastos_tienda')
        .select('fecha_gasto, monto')
        .gte('fecha_gasto', fechaInicio)
        .lte('fecha_gasto', fechaFin);

    if (errGastos) return console.error('Error gastos:', errGastos);
    datosRentabilidadActual.gastos = gastos;

    procesarYRenderizarRentabilidad(ventas, gastos, anio, mes, ultimoDia);
}

function procesarYRenderizarRentabilidad(ventas, gastos, anio, mes, ultimoDia) {
    const diario = {};

    // Inicializar días del mes
    for (let i = 1; i <= ultimoDia; i++) {
        const fechaKey = `${anio}-${mes}-${String(i).padStart(2, '0')}`;
        diario[fechaKey] = {
            ventas: 0,
            costos: 0,
            gastos: 0,
            utilidadBruta: 0,
            utilidadNeta: 0
        };
    }

    // Agrupar Ventas
    ventas.forEach(v => {
        const fecha = v.created_at.split('T')[0];
        if (diario[fecha]) {
            diario[fecha].ventas += parseFloat(v.total || 0);
            diario[fecha].costos += parseFloat(v.costo_unitario || 0) * (v.cantidad || 1);
        }
    });

    // Agrupar Gastos
    gastos.forEach(g => {
        const fecha = g.fecha_gasto.split('T')[0];
        if (diario[fecha]) {
            diario[fecha].gastos += parseFloat(g.monto || 0);
        }
    });

    // Calcular Totales y Renderizar Tabla
    let totalVentas = 0;
    let totalCostos = 0;
    let totalGastos = 0;

    const tbody = document.getElementById('tbodyRentabilidad');
    tbody.innerHTML = '';

    Object.keys(diario).sort().forEach(fecha => {
        const d = diario[fecha];
        d.utilidadBruta = d.ventas - d.costos;
        d.utilidadNeta = d.utilidadBruta - d.gastos;
        const margenPct = d.ventas > 0 ? Math.round((d.utilidadNeta / d.ventas) * 100) : 0;

        totalVentas += d.ventas;
        totalCostos += d.costos;
        totalGastos += d.gastos;

        if (d.ventas > 0 || d.gastos > 0) {
            datosRentabilidadActual.resumenDiario.push({
                fecha, ...d, margenPct
            });
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${fecha}</td>
                <td style="font-weight:600;">$${formatearPrecio(d.ventas)}</td>
                <td style="color:#ef4444;">$${formatearPrecio(d.costos)}</td>
                <td style="color:#22c55e; font-weight:600;">$${formatearPrecio(d.utilidadBruta)}</td>
                <td style="color:#f59e0b;">$${formatearPrecio(d.gastos)}</td>
                <td style="color:${d.utilidadNeta >= 0 ? '#3b82f6' : '#ef4444'}; font-weight:700;">$${formatearPrecio(d.utilidadNeta)}</td>
                <td>
                    <span style="background:${margenPct >= 0 ? '#dcfce7' : '#fee2e2'}; color:${margenPct >= 0 ? '#166534' : '#991b1b'}; padding:2px 8px; border-radius:12px; font-weight:700;">
                        ${margenPct}%
                    </span>
                </td>
            `;
            tbody.appendChild(tr);
        }
    });

    // Actualizar KPIs Globales
    const totalUtilidadBruta = totalVentas - totalCostos;
    const totalUtilidadNeta = totalUtilidadBruta - totalGastos;
    const totalMargenPct = totalVentas > 0 ? Math.round((totalUtilidadNeta / totalVentas) * 100) : 0;

    document.getElementById('rentVentas').textContent = '$' + formatearPrecio(totalVentas);
    document.getElementById('rentCostos').textContent = '$' + formatearPrecio(totalCostos);
    document.getElementById('rentUtilidadBruta').textContent = '$' + formatearPrecio(totalUtilidadBruta);
    document.getElementById('rentGastos').textContent = '$' + formatearPrecio(totalGastos);
    document.getElementById('rentUtilidadNeta').textContent = '$' + formatearPrecio(totalUtilidadNeta);
    document.getElementById('rentMargen').textContent = totalMargenPct + '%';

    if (tbody.innerHTML === '') {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay datos para este mes</td></tr>';
    }

    // Renderizar gráfico mensual inicial
    renderizarGraficoDiario();
}

function renderizarGraficoDiario() {
    const ctx = document.getElementById('chartRentabilidadDiaria').getContext('2d');
    const metric = document.getElementById('selectMetricDiaria').value;

    if (chartRentabilidadDiariaInstance) chartRentabilidadDiariaInstance.destroy();

    const labels = datosRentabilidadActual.resumenDiario.map(d => d.fecha.split('-')[2]); // Solo el día
    let datasetLabel = '';
    let data = [];
    let color = '#3b82f6';

    if (metric === 'utilidadNeta') {
        datasetLabel = 'Utilidad Neta ($)';
        data = datosRentabilidadActual.resumenDiario.map(d => d.utilidadNeta);
        color = '#10b981';
    } else if (metric === 'ventas') {
        datasetLabel = 'Ventas Totales ($)';
        data = datosRentabilidadActual.resumenDiario.map(d => d.ventas);
        color = '#3b82f6';
    } else {
        datasetLabel = 'Margen Real (%)';
        data = datosRentabilidadActual.resumenDiario.map(d => d.margenPct);
        color = '#f59e0b';
    }

    chartRentabilidadDiariaInstance = new Chart(ctx, {
        type: 'bar', // Barra para ver claramente cada día
        data: {
            labels,
            datasets: [{
                label: datasetLabel,
                data: data,
                backgroundColor: color + '90',
                borderColor: color,
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => `${datasetLabel}: ${metric === 'margen' ? ctx.raw + '%' : '$' + formatearPrecio(ctx.raw)}` } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { font: { size: 9 }, callback: (val) => metric === 'margen' ? val + '%' : '$' + formatearPrecio(val) } },
                x: { ticks: { font: { size: 9 } } }
            }
        }
    });
}

async function cargarComparativaAnual() {
    const anioInicio = document.getElementById('rentabilidadAnioInicio').value;
    const anioActual = new Date().getFullYear();
    const rangeAnios = [];
    for (let a = parseInt(anioInicio); a <= anioActual; a++) rangeAnios.push(a);

    showToast('Cargando analítica avanzada...', 'info');

    const datasetsUtilidad = [];
    const datasetsMargen = [];
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
    const mesesLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    // Aggregators for Doughnut and Bar
    let globalVentas = 0;
    let globalCostos = 0;
    let globalGastos = 0;
    const utilidadPorDiaSemana = Array(7).fill(0); // 0=Dom, 1=Lun...

    for (let i = 0; i < rangeAnios.length; i++) {
        const anio = rangeAnios[i];
        const { data: ventasAnio } = await supabaseClient
            .from('ventas')
            .select('created_at, total, costo_unitario, cantidad')
            .gte('created_at', `${anio}-01-01T00:00:00`)
            .lte('created_at', `${anio}-12-31T23:59:59`);

        const { data: gastosAnio } = await supabaseClient
            .from('gastos_tienda')
            .select('fecha_gasto, monto')
            .gte('fecha_gasto', `${anio}-01-01T00:00:00`)
            .lte('fecha_gasto', `${anio}-12-31T23:59:59`);

        const mensualUtilidad = Array(12).fill(0);
        const mensualMargen = Array(12).fill(0);
        const mensualVentas = Array(12).fill(0);

        ventasAnio.forEach(v => {
            const fecha = new Date(v.created_at);
            const m = fecha.getMonth();
            const d = fecha.getDay();

            const venta = parseFloat(v.total || 0);
            const costo = parseFloat(v.costo_unitario || 0) * (v.cantidad || 1);
            const utilidad = venta - costo;

            mensualUtilidad[m] += utilidad;
            mensualVentas[m] += venta;

            globalVentas += venta;
            globalCostos += costo;
            utilidadPorDiaSemana[d] += utilidad;
        });

        gastosAnio.forEach(g => {
            const fecha = new Date(g.fecha_gasto);
            const m = fecha.getMonth();
            const d = fecha.getDay();
            const monto = parseFloat(g.monto || 0);

            mensualUtilidad[m] -= monto;
            globalGastos += monto;
            utilidadPorDiaSemana[d] -= monto;
        });

        // Calcular % Margen Mensual
        for (let m = 0; m < 12; m++) {
            mensualMargen[m] = mensualVentas[m] > 0 ? Math.round((mensualUtilidad[m] / mensualVentas[m]) * 100) : 0;
        }

        datasetsUtilidad.push({
            label: `Utilidad Neta ${anio}`,
            data: mensualUtilidad,
            borderColor: colors[i % colors.length],
            backgroundColor: colors[i % colors.length] + '20',
            fill: true,
            tension: 0.4
        });

        datasetsMargen.push({
            label: `% Margen ${anio}`,
            data: mensualMargen,
            borderColor: colors[i % colors.length],
            borderDash: [5, 5],
            fill: false,
            tension: 0.4
        });
    }

    renderizarRentabilidadAnual(mesesLabels, datasetsUtilidad);
    renderizarDistribucionIngresos(globalVentas, globalCostos, globalGastos);
    renderizarTendenciaMargen(mesesLabels, datasetsMargen);
    renderizarUtilidadPorDia(utilidadPorDiaSemana);
}

function renderizarRentabilidadAnual(labels, datasets) {
    const ctx = document.getElementById('chartRentabilidadAnual').getContext('2d');
    if (chartRentabilidadAnualInstance) chartRentabilidadAnualInstance.destroy();
    chartRentabilidadAnualInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: $${formatearPrecio(ctx.raw)}` } }
            },
            scales: {
                y: { ticks: { callback: (val) => '$' + formatearPrecio(val), font: { size: 9 } } },
                x: { ticks: { font: { size: 10 } } }
            }
        }
    });
}

function renderizarDistribucionIngresos(ventas, costos, gastos) {
    const ctx = document.getElementById('chartDistribucionIngresos').getContext('2d');
    if (chartDistribucionIngresosInstance) chartDistribucionIngresosInstance.destroy();

    const utilidad = ventas - costos - gastos;

    chartDistribucionIngresosInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Costos (COGS)', 'Gastos Operat.', 'Utilidad Neta'],
            datasets: [{
                data: [costos, gastos, Math.max(0, utilidad)],
                backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
                tooltip: { callbacks: { label: (ctx) => `${ctx.label}: $${formatearPrecio(ctx.raw)}` } }
            },
            cutout: '60%'
        }
    });
}

function renderizarTendenciaMargen(labels, datasets) {
    const ctx = document.getElementById('chartTendenciaMargen').getContext('2d');
    if (chartTendenciaMargenInstance) chartTendenciaMargenInstance.destroy();
    chartTendenciaMargenInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}%` } }
            },
            scales: {
                y: { ticks: { callback: (val) => val + '%', font: { size: 9 } } },
                x: { ticks: { font: { size: 10 } } }
            }
        }
    });
}

function renderizarUtilidadPorDia(utilidades) {
    const ctx = document.getElementById('chartUtilidadPorDia').getContext('2d');
    if (chartUtilidadPorDiaInstance) chartUtilidadPorDiaInstance.destroy();

    const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    chartUtilidadPorDiaInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Utilidad Promedio',
                data: utilidades,
                backgroundColor: utilidades.map(u => u >= 0 ? '#3b82f6' : '#ef4444'),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => `Utilidad: $${formatearPrecio(ctx.raw)}` } }
            },
            scales: {
                y: { ticks: { callback: (val) => '$' + formatearPrecio(val), font: { size: 9 } } },
                x: { ticks: { font: { size: 10 } } }
            }
        }
    });
}

function exportarPDFAdministrativo() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    const anio = datosRentabilidadActual.anio;
    const mes = datosRentabilidadActual.mes;

    doc.setFontSize(18);
    doc.text(`Reporte de Rentabilidad Administrativo: ${mes}/${anio}`, 14, 20);

    const headers = [['Fecha', 'Ventas', 'Costo (COGS)', 'Utilidad Bruta', 'Gastos', 'Utilidad Neta', '% Margen']];
    const data = datosRentabilidadActual.resumenDiario.map(d => [
        d.fecha,
        `$${formatearPrecio(d.ventas)}`,
        `$${formatearPrecio(d.costos)}`,
        `$${formatearPrecio(d.utilidadBruta)}`,
        `$${formatearPrecio(d.gastos)}`,
        `$${formatearPrecio(d.utilidadNeta)}`,
        `${d.margenPct}%`
    ]);

    doc.autoTable({
        head: headers,
        body: data,
        startY: 30,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 41, 59] }
    });

    doc.save(`Rentabilidad_Admin_${mes}_${anio}.pdf`);
}

function exportarPDFColaboradores() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const anio = datosRentabilidadActual.anio;
    const mes = datosRentabilidadActual.mes;

    doc.setFontSize(18);
    doc.text(`Reporte de Desempeño Moteros: ${mes}/${anio}`, 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text('Este reporte muestra el volumen de ventas y cumplimiento de metas del periodo.', 14, 28);

    const headers = [['Fecha', 'Ventas Totales', 'Estado']];
    const data = datosRentabilidadActual.resumenDiario.map(d => [
        d.fecha,
        `$${formatearPrecio(d.ventas)}`,
        d.ventas > 1000000 ? 'Excelente' : (d.ventas > 500000 ? 'Bueno' : 'Normal')
    ]);

    doc.autoTable({
        head: headers,
        body: data,
        startY: 40,
        headStyles: { fillColor: [22, 163, 74] }
    });

    doc.save(`Reporte_Colaboradores_${mes}_${anio}.pdf`);
}

// Inicializar fecha al cargar la sección
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('rentabilidadMes');
    if (input) {
        const hoy = new Date();
        input.value = hoy.toISOString().slice(0, 7); // YYYY-MM
    }
});
