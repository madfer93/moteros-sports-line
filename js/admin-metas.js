// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE METAS (LOCALES Y PROVEEDORES + GRÁFICOS)
// ═══════════════════════════════════════════════════════════════

// Estado Global del Módulo
let fechaSeleccionadaMetas = new Date();

async function cargarMetas(activarVista = true) {
    if (activarVista) activarMenu('metas');

    // Inicializar fecha solo si es la primera carga y no hay valor
    const fechaInput = document.getElementById('metasFechaControl');
    if (fechaInput && !fechaInput.value) {
        // Formato YYYY-MM
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        fechaInput.value = `${yyyy}-${mm}`;

        // Listeners fecha
        fechaInput.onchange = function () {
            const [ano, mes] = this.value.split('-');
            fechaSeleccionadaMetas = new Date(ano, mes - 1, 1);
            cargarMetasLocales();
            // cargarMetasProveedores no depende estrictamente del mes seleccionado para mostrar LISTA,
            // pero si para filtrar "compras del periodo" si se quisiera.
            // Dejaremos proveedores global por ahora, pero actualizamos proyecciones.
            cargarProyeccionesMetas();
        };
    } else if (fechaInput) {
        // Restaurar fecha del input al estado
        const [ano, mes] = fechaInput.value.split('-');
        fechaSeleccionadaMetas = new Date(ano, mes - 1, 1);
    }

    await Promise.all([
        cargarMetasLocales(),
        cargarMetasProveedores(),
        cargarProyeccionesMetas()
    ]);
}

// ═══════════════════════════════════════════════════════════════
// METAS LOCALES
// ═══════════════════════════════════════════════════════════════

async function cargarMetasLocales() {
    const mes = fechaSeleccionadaMetas.getMonth() + 1;
    const anio = fechaSeleccionadaMetas.getFullYear();

    const titulo = document.getElementById('metaTituloMes');
    if (titulo) {
        const nombreMes = fechaSeleccionadaMetas.toLocaleString('es-CO', { month: 'long' });
        titulo.textContent = `METAS ${nombreMes.toUpperCase()} ${anio}`;
    }

    try {
        // Reset inputs
        const inputs = ['alcala', 'local01', 'jordan', 'digital'];
        inputs.forEach(l => {
            const el = document.getElementById(`meta_${l}`);
            if (el) el.value = '';
        });

        const { data, error } = await supabaseClient
            .from('metas_locales')
            .select('*')
            .eq('mes', mes)
            .eq('anio', anio);

        if (error) throw error;

        if (data) {
            data.forEach(m => {
                const el = document.getElementById(`meta_${m.local}`);
                if (el) el.value = parseInt(m.valor_meta).toLocaleString('es-CO');
            });
        }
    } catch (e) {
        console.error('Error cargar metas locales:', e);
        showToast('Error cargando metas del periodo', 'error');
    }
}

async function guardarMetaLocal(local) {
    const el = document.getElementById(`meta_${local}`);
    const valor = parseFloat(el.value.replace(/[^\d]/g, '')) || 0;

    // Usar la fecha seleccionada, no la actual real
    const mes = fechaSeleccionadaMetas.getMonth() + 1;
    const anio = fechaSeleccionadaMetas.getFullYear();

    try {
        const { error } = await supabaseClient
            .from('metas_locales')
            .upsert({
                local: local,
                mes: mes,
                anio: anio,
                valor_meta: valor
            }, { onConflict: 'local,mes,anio' });

        if (error) throw error;
        showToast(`Meta ${local} guardada (${mes}/${anio})`, 'success');
        formatearMonedaInput(el);

        // Actualizar proyecciones para reflejar el cambio
        cargarProyeccionesMetas();

    } catch (e) {
        console.error(e);
        showToast('Error al guardar meta', 'error');
    }
}

// Generar Reporte Individual (Historial del año para un local)
async function imprimirMetaLocal(local) {
    const anio = fechaSeleccionadaMetas.getFullYear();

    try {
        const { data, error } = await supabaseClient
            .from('metas_locales')
            .select('*')
            .eq('local', local)
            .eq('anio', anio)
            .order('mes', { ascending: true });

        if (error) throw error;

        // Usar TicketPrinter
        let htmlTabla = `
            <div style="text-align:center; font-weight:bold; margin-bottom:10px;">
                REPORTE DE METAS<br>${local.toUpperCase()} - ${anio}
            </div>
            <table>
                <tr>
                    <th>MES</th>
                    <th class="text-right">META ($)</th>
                </tr>
        `;

        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        let totalMetas = 0;

        data.forEach(m => {
            totalMetas += m.valor_meta;
            htmlTabla += `
                <tr>
                    <td>${meses[m.mes - 1]}</td>
                    <td class="text-right">$${parseInt(m.valor_meta).toLocaleString('es-CO')}</td>
                </tr>
            `;
        });

        htmlTabla += `
                <tr style="border-top:1px dashed #000; font-weight:bold;">
                    <td>TOTAL ANUAL</td>
                    <td class="text-right">$${parseInt(totalMetas).toLocaleString('es-CO')}</td>
                </tr>
            </table>
        `;

        if (window.TicketPrinter) {
            TicketPrinter.print(`METAS ${local.toUpperCase()}`, htmlTabla);
        } else {
            console.error('TicketPrinter no cargado');
            alert('Error: TicketPrinter no encontrado');
        }

    } catch (e) {
        console.error(e);
        showToast('Error generando reporte', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// METAS PROVEEDORES
// ═══════════════════════════════════════════════════════════════

let metasProvCache = [];

async function cargarMetasProveedores() {
    const tbody = document.getElementById('tbodyMetasProveedores');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Cargando datos y analizando compras...</td></tr>';

    try {
        const { data: metas, error: errMetas } = await supabaseClient
            .from('metas_proveedores')
            .select('*')
            .order('created_at', { ascending: false });

        if (errMetas) throw errMetas;
        metasProvCache = metas || [];

        if (metasProvCache.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay metas definidas</td></tr>';
            actualizarGraficoMetas([]);
            return;
        }

        const currentYear = new Date().getFullYear();
        const { data: compras } = await supabaseClient
            .from('compras_proveedor')
            .select('proveedor_id, valor_compra, anio, mes_compra, proveedor:proveedores(razon_social, nombre_comercial)')
            .eq('anio', currentYear);

        const progresoMetas = metasProvCache.map(m => {
            let totalComprado = 0;
            if (compras) {
                totalComprado = compras
                    .filter(c => {
                        const pName = c.proveedor?.razon_social || c.proveedor?.nombre_comercial || '';
                        return pName.toLowerCase().includes(m.proveedor.toLowerCase()) || m.proveedor.toLowerCase().includes(pName.toLowerCase());
                    })
                    .reduce((sum, c) => sum + (c.valor_compra || 0), 0);
            }

            const porcentaje = m.monto_meta > 0 ? (totalComprado / m.monto_meta) * 100 : 0;

            return {
                ...m,
                progreso: totalComprado,
                porcentaje: porcentaje
            };
        });

        renderizarTablaMetas(progresoMetas);
        actualizarGraficoMetas(progresoMetas); // Actualiza gráfico Top Proveedores

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Error al cargar metas</td></tr>';
    }
}

function renderizarTablaMetas(metas) {
    const tbody = document.getElementById('tbodyMetasProveedores');
    tbody.innerHTML = metas.map(m => {
        const estadoClass = m.porcentaje >= 100 ? 'badge-success' : (m.porcentaje >= 50 ? 'badge-warning' : 'badge-danger');
        const estadoTexto = m.porcentaje >= 100 ? '¡CUMPLIDA! 🎉' : `${m.porcentaje.toFixed(1)}%`;

        return `
            <tr>
                <td><strong>${m.proveedor}</strong></td>
                <td>${m.descripcion || '-'}</td>
                <td>$${parseInt(m.monto_meta || 0).toLocaleString('es-CO')}</td>
                <td><div style="font-size:0.85rem; color:#64748b;">${m.unidades_meta || 0} u</div></td>
                <td><small>${m.fecha_inicio} <br> ${m.fecha_fin}</small></td>
                <td>${m.premio || '-'}</td>
                <td>
                    <span class="badge ${estadoClass}">${estadoTexto}</span>
                    <div style="margin-top:4px; font-size:0.75rem;">Real: $${parseInt(m.progreso).toLocaleString('es-CO')}</div>
                </td>
                <td>
                    <div style="display:flex; gap:0.5rem;">
                        <button class="btn btn-sm btn-secondary" onclick="verHistorialProveedor('${m.proveedor}')" title="Historial/Descargar">📜</button>
                        <button class="btn btn-sm btn-icon" onclick="eliminarMetaProveedor('${m.id}')" title="Eliminar">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ═══════════════════════════════════════════════════════════════
// HISTORIAL PROVEEDOR E INDIVIDUAL
// ═══════════════════════════════════════════════════════════════

async function verHistorialProveedor(nombreProveedor) {
    // Reutilizamos el modal de historial existente (si no existe, lo creamos dinamicamente)
    // O mejor, usamos el modal de historial que ya estaba en el codigo 'modalHistorialMeta' o similar
    // Si no está, lo inyectamos o usamos un alert por ahora, pero la orden es "modal con opcion".

    // Vamos a usar un prompt para simplicidad si no existe modal, pero haremos un reporte imprimible como el de locales,
    // ya que es mas "profesional" para descarga inmediata.

    // Opcion mejor: Generar reporte inmediato
    const confirmacion = confirm(`¿Generar reporte histórico para ${nombreProveedor}? \nSe abrirá para impresión/PDF.`);
    if (!confirmacion) return;

    try {
        const { data, error } = await supabaseClient
            .from('metas_proveedores')
            .select('*')
            .ilike('proveedor', `%${nombreProveedor}%`)
            .order('fecha_inicio', { ascending: false });

        if (error) throw error;

        let html = `
            <div style="text-align:center; margin-bottom:10px;">
                HISTORIAL PROVEEDOR<br>${nombreProveedor.toUpperCase()}
            </div>
            <table>
                <tr>
                    <th>PERIODO</th>
                    <th class="text-right">META</th>
                    <th>ESTADO</th>
                </tr>
        `;

        data.forEach(m => {
            html += `
                <tr>
                    <td>${m.fecha_inicio}<br>${m.fecha_fin}</td>
                    <td class="text-right">$${parseInt(m.monto_meta).toLocaleString('es-CO')}</td>
                    <td>${m.estado}</td>
                </tr>
                <tr><td colspan="3" style="font-size:9px; font-style:italic;">"${m.descripcion}"</td></tr>
                <tr><td colspan="3" class="divider"></td></tr>
            `;
        });

        html += `</table>`;

        if (window.TicketPrinter) {
            TicketPrinter.print(`HISTORIAL ${nombreProveedor.substring(0, 10)}...`, html);
        }

    } catch (e) {
        showToast('Error al obtener historial', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// PROYECCIONES (NUEVO)
// ═══════════════════════════════════════════════════════════════

let chartProyeccion = null;

async function cargarProyeccionesMetas() {
    const tbody = document.getElementById('tbodyProyeccionLocales');
    if (!tbody) return;

    // Calcular próximos 6 meses
    const meses = [];
    const fechaBase = new Date(fechaSeleccionadaMetas);

    for (let i = 0; i < 6; i++) {
        const d = new Date(fechaBase);
        d.setMonth(d.getMonth() + i);
        meses.push({
            mes: d.getMonth() + 1,
            anio: d.getFullYear(),
            nombre: d.toLocaleString('es-CO', { month: 'short' }).toUpperCase() + ' ' + d.getFullYear()
        });
    }

    // Consultar DB para estos meses
    // Simplificación: Traemos todo el año de cada año involucrado
    const anios = [...new Set(meses.map(m => m.anio))];

    let metasFuturas = [];
    try {
        const { data, error } = await supabaseClient
            .from('metas_locales')
            .select('*')
            .in('anio', anios);

        if (data) metasFuturas = data;

    } catch (e) { console.error(e); }

    // Procesar datos para tabla y gráfica
    let htmlTabla = '';
    const datosGrafica = {
        labels: meses.map(m => m.nombre),
        alcala: [],
        local01: [],
        jordan: [],
        digital: []
    };

    meses.forEach(m => {
        const filtro = (local) => {
            const row = metasFuturas.find(r => r.local === local && r.mes === m.mes && r.anio === m.anio);
            return row ? row.valor_meta : 0;
        };

        const vAlcala = filtro('alcala');
        const vLocal01 = filtro('local01');
        const vJordan = filtro('jordan');
        const vDigital = filtro('digital');
        const total = vAlcala + vLocal01 + vJordan + vDigital;

        datosGrafica.alcala.push(vAlcala);
        datosGrafica.local01.push(vLocal01);
        datosGrafica.jordan.push(vJordan);
        datosGrafica.digital.push(vDigital);

        htmlTabla += `
            <tr>
                <td><strong>${m.nombre}</strong></td>
                <td>$${vAlcala.toLocaleString('es-CO')}</td>
                <td>$${vLocal01.toLocaleString('es-CO')}</td>
                <td>$${vJordan.toLocaleString('es-CO')}</td>
                <td>$${vDigital.toLocaleString('es-CO')}</td>
                <td style="font-weight:bold; color:var(--primary);">$${total.toLocaleString('es-CO')}</td>
            </tr>
        `;
    });

    tbody.innerHTML = htmlTabla;
    actualizarGraficoProyeccion(datosGrafica);
}

function actualizarGraficoProyeccion(datos) {
    const ctx = document.getElementById('chartProyeccionLocales');
    if (!ctx) return;

    if (chartProyeccion) chartProyeccion.destroy();

    chartProyeccion = new Chart(ctx, {
        type: 'line',
        data: {
            labels: datos.labels,
            datasets: [
                { label: 'Alcalá', data: datos.alcala, borderColor: '#ff6b00', tension: 0.3, fill: false },
                { label: 'Local 01', data: datos.local01, borderColor: '#3b82f6', tension: 0.3, fill: false },
                { label: 'Jordán', data: datos.jordan, borderColor: '#22c55e', tension: 0.3, fill: false },
                { label: 'Digital', data: datos.digital, borderColor: '#a855f7', tension: 0.3, fill: false }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: (val) => '$' + val.toLocaleString('es-CO', { notation: 'compact' }) }
                }
            }
        }
    });
}


// ═══════════════════════════════════════════════════════════════
// GRÁFICOS Y UTILIDADES
// ═══════════════════════════════════════════════════════════════

let chartInstance = null;
function actualizarGraficoMetas(metas) {
    const ctx = document.getElementById('chartMetas');
    if (!ctx) return;

    if (chartInstance) chartInstance.destroy();

    // Top 5 proveedores
    const topMetas = metas.slice(0, 10);
    const labels = topMetas.map(m => m.proveedor.substring(0, 15));
    const dataMeta = topMetas.map(m => m.monto_meta);
    const dataReal = topMetas.map(m => m.progreso);

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Meta ($)', data: dataMeta, backgroundColor: '#cbd5e1' },
                { label: 'Real ($)', data: dataReal, backgroundColor: '#22c55e' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // Horizontal bar chart
            scales: {
                x: { ticks: { callback: (val) => '$' + val.toLocaleString('es-CO', { notation: 'compact' }) } }
            }
        }
    });
}

function mostrarFormMetaProveedor() {
    console.log('Mostrando modal proveedor...');
    const el = document.getElementById('modalMetaProveedor');
    if (el) {
        el.style.display = 'flex';
        el.classList.add('active'); // Por si acaso CSS lo requiere
    } else {
        console.error('No se encontró el modal modalMetaProveedor');
    }
}
function cancelarFormMetaProveedor() { document.getElementById('modalMetaProveedor').style.display = 'none'; }

async function guardarMetaProveedor() {
    const proveedor = document.getElementById('metaProvNombre').value;
    const desc = document.getElementById('metaProvDesc').value;
    const monto = parseFloat(document.getElementById('metaProvMonto').value.replace(/[^\d]/g, '')) || 0;
    const unidades = parseInt(document.getElementById('metaProvUnidades').value) || 0;
    const inicio = document.getElementById('metaProvInicio').value;
    const fin = document.getElementById('metaProvFin').value;
    const premio = document.getElementById('metaProvPremio').value;

    if (!proveedor || !inicio) { showToast('Faltan datos obligatorios', 'warning'); return; }

    try {
        await supabaseClient.from('metas_proveedores').insert({
            proveedor, descripcion: desc, monto_meta: monto, unidades_meta: unidades,
            fecha_inicio: inicio, fecha_fin: fin, premio, estado: 'EN_CURSO'
        });
        showToast('Meta creada', 'success');
        cancelarFormMetaProveedor();
        cargarMetasProveedores();
    } catch (e) {
        showToast('Error guardar meta', 'error');
    }
}

async function eliminarMetaProveedor(id) {
    if (!confirm('Eliminar meta?')) return;
    await supabaseClient.from('metas_proveedores').delete().eq('id', id);
    cargarMetasProveedores();
}

// Global Exports
window.cargarMetas = cargarMetas;
window.cargarMetasLocales = cargarMetasLocales;
window.cargarMetasProveedores = cargarMetasProveedores;
window.guardarMetaLocal = guardarMetaLocal;
window.imprimirMetaLocal = imprimirMetaLocal;
window.mostrarFormMetaProveedor = mostrarFormMetaProveedor;
window.cancelarFormMetaProveedor = cancelarFormMetaProveedor;
window.guardarMetaProveedor = guardarMetaProveedor;
window.eliminarMetaProveedor = eliminarMetaProveedor;
window.verHistorialProveedor = verHistorialProveedor;
window.cargarProyeccionesMetas = cargarProyeccionesMetas;
