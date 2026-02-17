
// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE NÓMINA - MOTEROS SPORTS LINE
// ═══════════════════════════════════════════════════════════════

// Nota: supabaseClient y funciones utilitarias asumidas del entorno global

// Redefinición por seguridad si admin.js falló al cargar
if (typeof formatearPrecio === 'undefined') {
    window.formatearPrecio = function (precio) { return parseInt(precio || 0).toLocaleString('es-CO'); }
}
if (typeof showToast === 'undefined') {
    window.showToast = function (msg) { alert(msg); }
}

var nominaCache = []; // Cache para guardar luego
var empleadosNominaCache = [];

async function cargarNomina() {
    const tbody = document.getElementById('tablaNomina');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Calculando nómina...</td></tr>';

    try {
        const mesInput = document.getElementById('filtroMesNomina').value;
        // Si no hay mes seleccionado, usar el actual
        const fechaRef = mesInput ? new Date(mesInput + '-01') : new Date();
        const year = fechaRef.getFullYear();
        const month = fechaRef.getMonth(); // 0-11

        const fechaInicio = new Date(year, month, 1).toISOString();
        const fechaFin = new Date(year, month + 1, 0).toISOString(); // Ultimo dia del mes

        // 1. Cargar Empleados Activos
        const { data: empleados, error: errEmp } = await supabaseClient
            .from('empleados_tienda')
            .select('*')
            .eq('activo', true)
            .order('nombre');

        if (errEmp) throw errEmp;
        empleadosNominaCache = empleados || [];

        // 2. Cargar Adelantos del periodo
        const { data: adelantos, error: errAdel } = await supabaseClient
            .from('adelantos_nomina')
            .select('*')
            .gte('created_at', fechaInicio)
            .lte('created_at', fechaFin);

        if (errAdel) throw errAdel;

        // 3. Calcular Nómina
        let totalBasico = 0;
        let totalComisiones = 0;
        let totalDeducciones = 0;
        let granTotal = 0;

        nominaCache = empleados.map(e => {
            const basico = parseFloat(e.salario_base) || 0;
            const auxilio = parseFloat(e.auxilio_transporte) || 0;

            // Deducciones fijas
            const deduccionesLey = parseFloat(e.descuentos_ley) || 0;
            const otrosDescuentos = parseFloat(e.otros_descuentos) || 0;

            // Sumar adelantos (corrección ID flexible)
            const misAdelantos = adelantos.filter(a => a.empleado_id == e.id);
            const totalAdelantos = misAdelantos.reduce((sum, a) => sum + parseFloat(a.monto), 0);

            // Valores editables (inicializar si no existen)
            const bonificaciones = e.bonificaciones || 0;
            const incentivos = e.incentivos || 0;
            const comisiones = e.comisiones || 0; // TODO: Comisiones reales automaticas

            const totalDevengado = basico + auxilio + comisiones + bonificaciones + incentivos;
            const totalDeduccionesEmpleado = deduccionesLey + otrosDescuentos + totalAdelantos;
            const neto = totalDevengado - totalDeduccionesEmpleado;

            totalBasico += basico;
            totalComisiones += comisiones;
            totalDeducciones += totalDeduccionesEmpleado;
            granTotal += neto;

            return {
                ...e,
                basico,
                auxilio,
                comisiones,
                totalDevengado,
                deduccionesLey,
                otrosDescuentos,
                totalAdelantos,
                totalDeducciones: totalDeduccionesEmpleado,
                neto
            };
        });

        // 4. Renderizar Tabla
        if (nominaCache.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay empleados para liquidar.</td></tr>';
            return;
        }

        tbody.innerHTML = nominaCache.map(e => `
            <tr>
                <td>
                    <strong>${e.nombre}</strong><br>
                    <small class="text-muted">${e.cargo}</small>
                </td>
                <td>$${formatearPrecio(e.basico)}</td>
                <td>$${formatearPrecio(e.auxilio)}</td>
                <td><span class="text-muted">$0</span></td>
                <td><strong>$${formatearPrecio(e.totalDevengado)}</strong></td>
                <td class="text-danger">
                    -$${formatearPrecio(e.totalDeducciones)}
                    ${e.totalAdelantos > 0 ? `<br><small>(Adelantos: $${formatearPrecio(e.totalAdelantos)})</small>` : ''}
                </td>
                <td class="text-success" style="font-weight:bold; font-size:1.1rem;">$${formatearPrecio(e.neto)}</td>
                <td>
                    <button class="btn-sm btn-success" onclick="verDetalleNomina('${e.id}')">📄 Detalle</button>
                </td>
            </tr>
        `).join('');

        // 5. Actualizar Totales
        actualizarTotalesNomina(totalBasico, totalComisiones, totalDeducciones, granTotal);

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Error calculando nómina: ' + e.message + '</td></tr>';
    }
}

function actualizarTotalesNomina(basico, comisiones, deducciones, total) {
    if (document.getElementById('nominaTotalBasico')) document.getElementById('nominaTotalBasico').textContent = '$' + formatearPrecio(basico);
    if (document.getElementById('nominaTotalComisiones')) document.getElementById('nominaTotalComisiones').textContent = '$' + formatearPrecio(comisiones);
    if (document.getElementById('nominaTotalDeducciones')) document.getElementById('nominaTotalDeducciones').textContent = '$' + formatearPrecio(deducciones);
    if (document.getElementById('nominaGranTotal')) document.getElementById('nominaGranTotal').textContent = '$' + formatearPrecio(total);
}

// ═══════════════════════════════════════════════════════════════
// ADELANTOS
// ═══════════════════════════════════════════════════════════════

function mostrarModalAdelanto() {
    // Si no hay empleados cargados, intentar cargar primero (solo si no se ha generado nomina aun)
    if (empleadosNominaCache.length === 0) {
        // Podríamos llamar a una función para solo cargar empleados, pero por ahora mostramos alerta
        // showToast('Primero genere el reporte para cargar empleados', 'info');
        // O mejor, intentamos cargarlos silenciosamente
        cargarEmpleadosParaSelect().then(() => {
            llenarSelectAdelantos();
            document.getElementById('modalAdelanto').style.display = 'block';
        });
        return;
    }

    llenarSelectAdelantos();
    document.getElementById('modalAdelanto').style.display = 'block';
}

function llenarSelectAdelantos() {
    const select = document.getElementById('adelantoEmpleado');
    select.innerHTML = '<option value="">Seleccione...</option>' +
        empleadosNominaCache.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
}

async function cargarEmpleadosParaSelect() {
    const { data: empleados } = await supabaseClient
        .from('empleados_tienda')
        .select('*')
        .eq('activo', true)
        .order('nombre');
    if (empleados) empleadosNominaCache = empleados;
}

function cerrarModalAdelanto() {
    document.getElementById('modalAdelanto').style.display = 'none';
    document.getElementById('adelantoMonto').value = '';
    document.getElementById('adelantoMotivo').value = '';
}

async function guardarAdelanto() {
    const empleadoId = document.getElementById('adelantoEmpleado').value;
    const monto = document.getElementById('adelantoMonto').value;
    const motivo = document.getElementById('adelantoMotivo').value;
    const local = document.getElementById('adelantoLocal').value;

    if (!empleadoId || !monto) {
        showToast('Complete los campos obligatorios', 'warning');
        return;
    }

    try {
        const { error } = await supabaseClient.from('adelantos_nomina').insert([{
            empleado_id: empleadoId,
            monto: monto,
            motivo: motivo,
            local: local,
            quien_autoriza: 'Admin', // TODO: Obtener usuario actual
            fecha: new Date().toISOString()
        }]);

        if (error) throw error;

        showToast('Adelanto registrado correctamente');
        cerrarModalAdelanto();
        cargarNomina(); // Recalcular
    } catch (e) {
        console.error(e);
        showToast('Error guardando adelanto', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// CIERRE DE NÓMINA
// ═══════════════════════════════════════════════════════════════

async function guardarCierreNomina() {
    if (!nominaCache || nominaCache.length === 0) {
        showToast('No hay nómina calculada para cerrar', 'warning');
        return;
    }

    if (!confirm('¿Estás seguro de cerrar la nómina de este mes? Esto guardará los registros de pago.')) return;

    try {
        const mesInput = document.getElementById('filtroMesNomina').value || new Date().toISOString().slice(0, 7);
        const fechaRef = new Date(mesInput + '-01');
        const periodoInicio = new Date(fechaRef.getFullYear(), fechaRef.getMonth(), 1).toISOString();
        const periodoFin = new Date(fechaRef.getFullYear(), fechaRef.getMonth() + 1, 0).toISOString();

        const registros = nominaCache.map(e => ({
            empleado_id: e.id,
            periodo_inicio: periodoInicio,
            periodo_fin: periodoFin,
            salario_base_periodo: e.basico,
            comisiones: e.comisiones || 0,
            bonificaciones: e.bonificaciones || 0,
            incentivos: e.incentivos || 0,
            multas_descuentos: (e.deduccionesLey || 0) + (e.otrosDescuentos || 0),
            prestamos_anticipos: e.totalAdelantos,
            neto_pagar: e.neto,
            estado: 'Pagado',
            fecha_pago: new Date().toISOString()
        }));

        const { error } = await supabaseClient.from('nomina_pagos').insert(registros);

        if (error) throw error;
        showToast('✅ Nómina cerrada y guardada exitosamente');

    } catch (e) {
        console.error(e);
        showToast('Error cerrando nómina: ' + e.message, 'error');
    }
}

// Función auxiliar para actualizar cache y vista previa desde inputs del editor
window.sincronizarEditorTicket = function (id, campo, valor) {
    const empIndex = nominaCache.findIndex(e => e.id == id);
    if (empIndex >= 0) {
        let val = parseFloat(valor.replace(/[^0-9-]/g, '')) || 0;

        // 1. Actualizar Cache
        nominaCache[empIndex][campo] = val;

        // Recalcular lógica interna
        const e = nominaCache[empIndex];
        const basico = e.basico || 0;
        const auxilio = e.auxilio || 0;
        const comisiones = e.comisiones || 0;
        const bonos = e.bonificaciones || 0;
        const incentivos = e.incentivos || 0;

        const deduccionesLey = e.deduccionesLey || 0;
        const otrosDescuentos = e.otrosDescuentos || 0;
        const totalAdelantos = e.totalAdelantos || 0;

        e.totalDevengado = basico + auxilio + comisiones + bonos + incentivos;
        e.totalDeducciones = deduccionesLey + otrosDescuentos + totalAdelantos;
        e.neto = e.totalDevengado - e.totalDeducciones;

        // 2. Actualizar Ticket Preview (DOM)
        const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });

        // Mapeo campo -> ID elemento ticket
        const mapIds = {
            'basico': 't_basico',
            'auxilio': 't_auxilio',
            'comisiones': 't_comisiones',
            'bonificaciones': 't_bonos',
            'incentivos': 't_incentivos',
            'deduccionesLey': 't_salud',
            'otrosDescuentos': 't_otros',
            'totalAdelantos': 't_adelantos'
        };

        // Actualizar valor en ticket
        if (mapIds[campo]) {
            const el = document.getElementById(mapIds[campo]);
            if (el) {
                // Si es deducción, poner signo menos
                const esDeduccion = ['deduccionesLey', 'otrosDescuentos', 'totalAdelantos'].includes(campo);
                el.textContent = (esDeduccion ? '-' : '') + formatter.format(val);
            }
        }

        // Actualizar Total Neto
        const totalNetoEl = document.getElementById('ticketTotalNeto');
        if (totalNetoEl) totalNetoEl.textContent = formatter.format(e.neto);

        // 3. Actualizar Input Editor (por si vino de otro lado, opcional)
        // console.log('Sincronizado:', campo, val);
    }
};

function verDetalleNomina(id) {
    const emp = nominaCache.find(e => e.id == id);
    if (!emp) return;

    const now = new Date();
    const fechaImpresion = now.toLocaleDateString('es-CO');
    const horaImpresion = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    const comprobanteId = 'NOM-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });

    // Estilos internos para el layout dividido
    const layoutStyle = `
        display: flex;
        flex-wrap: wrap;
        gap: 2rem;
        padding: 1rem;
        align-items: flex-start;
        justify-content: center;
    `;

    const editorStyle = `
        flex: 1;
        min-width: 300px;
        background: #f8f9fa;
        padding: 1.5rem;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    `;

    const ticketWrapperStyle = `
        flex: 0 0 auto;
        width: 380px; 
        background: #525252; 
        padding: 1rem; 
        border-radius: 12px;
        display: flex;
        justify-content: center;
    `;

    // Campos del formulario editor (Bootstrap-ish)
    const formGroupStyle = "margin-bottom: 1rem;";
    const labelStyle = "display: block; font-weight: 600; color: #475569; margin-bottom: 0.4rem; font-size: 0.9rem;";
    const inputClass = "form-control-sm";
    const inputStyle = "width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600;";

    const html = `
        <div class="nomina-split-view" style="${layoutStyle}">
            
            <!-- PANEL IZQUIERDO: EDITOR AMPLIO -->
            <div class="nomina-editor-panel" style="${editorStyle}">
                <h4 style="margin-top:0; color:#1e293b; border-bottom:2px solid #3b82f6; padding-bottom:0.5rem; margin-bottom:1.5rem;">
                    ✏️ Editar Valores de Nómina
                </h4>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                    <!-- Ingresos -->
                    <div>
                        <h5 style="color:#15803d; margin-bottom:1rem;">💰 Devengados</h5>
                        <div style="${formGroupStyle}">
                            <label style="${labelStyle}">Salario Básico</label>
                            <input type="number" style="${inputStyle}" value="${emp.basico}" 
                                oninput="sincronizarEditorTicket('${emp.id}', 'basico', this.value)">
                        </div>
                        <div style="${formGroupStyle}">
                            <label style="${labelStyle}">Aux. Transporte</label>
                            <input type="number" style="${inputStyle}" value="${emp.auxilio}" 
                                oninput="sincronizarEditorTicket('${emp.id}', 'auxilio', this.value)">
                        </div>
                        <div style="${formGroupStyle}">
                            <label style="${labelStyle}">Comisiones</label>
                            <input type="number" style="${inputStyle}" value="${emp.comisiones}" 
                                oninput="sincronizarEditorTicket('${emp.id}', 'comisiones', this.value)">
                        </div>
                        <div style="${formGroupStyle}">
                            <label style="${labelStyle} color:#0ea5e9;">★ Bonificaciones</label>
                            <input type="number" style="${inputStyle} border-color:#0ea5e9; background:#f0f9ff;" value="${emp.bonificaciones || 0}" 
                                oninput="sincronizarEditorTicket('${emp.id}', 'bonificaciones', this.value)" placeholder="0">
                        </div>
                        <div style="${formGroupStyle}">
                            <label style="${labelStyle} color:#8b5cf6;">★ Eventos / Servicios</label>
                            <input type="number" style="${inputStyle} border-color:#8b5cf6; background:#f5f3ff;" value="${emp.incentivos || 0}" 
                                oninput="sincronizarEditorTicket('${emp.id}', 'incentivos', this.value)" placeholder="0">
                        </div>
                    </div>

                    <!-- Deducciones -->
                    <div>
                        <h5 style="color:#b91c1c; margin-bottom:1rem;">💸 Deducciones</h5>
                        <div style="${formGroupStyle}">
                            <label style="${labelStyle}">Salud y Pensión</label>
                            <input type="number" style="${inputStyle} color:#b91c1c;" value="${emp.deduccionesLey}" 
                                oninput="sincronizarEditorTicket('${emp.id}', 'deduccionesLey', this.value)">
                        </div>
                        <div style="${formGroupStyle}">
                            <label style="${labelStyle}">Otros Descuentos</label>
                            <input type="number" style="${inputStyle} color:#b91c1c;" value="${emp.otrosDescuentos}" 
                                oninput="sincronizarEditorTicket('${emp.id}', 'otrosDescuentos', this.value)">
                        </div>
                        <div style="${formGroupStyle}">
                            <label style="${labelStyle}">Adelantos Total</label>
                            <input type="number" style="${inputStyle} color:#b91c1c;" value="${emp.totalAdelantos}" 
                                oninput="sincronizarEditorTicket('${emp.id}', 'totalAdelantos', this.value)">
                        </div>
                        
                        <div class="alert alert-info" style="margin-top:2rem; font-size:0.8rem; background:#eff6ff; border:1px solid #bfdbfe; color:#1e40af; padding:0.8rem; border-radius:8px;">
                            ℹ️ Los cambios se guardan automáticamente al cerrar este modal y se confirmarán al "Cerrar Nómina".
                        </div>
                    </div>
                </div>
            </div>

            <!-- PANEL DERECHO: VISTA PREVIA TICKET -->
            <div class="nomina-preview-panel" style="${ticketWrapperStyle}">
                <!-- TICKET REAL (ID único para imprimir) -->
                <div id="modalDetalleNominaTicket" class="ticket-container" style="font-family: 'Courier New', Courier, monospace; color: #000; width: 340px; background: white; padding: 15px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                    
                    <div style="text-align: center; margin-bottom: 10px;">
                        <img src="img/logo-moteros.jpeg" 
                             alt="Moteros Logo" style="width: 60px; height: 60px; border-radius: 50%; filter: grayscale(100%);">
                        <h3 style="margin: 5px 0 2px 0; font-size: 0.9rem; text-transform: uppercase;">MOTEROS SPORTS LINE</h3>
                        <p style="margin: 0; font-size: 0.75rem;">Villavicencio - Meta</p>
                        <p style="margin: 0; font-size: 0.75rem;">NIT: 901.234.567-8</p>
                    </div>

                    <p style="text-align: center; margin: 5px 0; border-bottom: 1px dashed #000; padding-bottom: 5px; font-size: 0.8rem;">
                        <strong>COMPROBANTE DE PAGO</strong><br># ${comprobanteId}
                    </p>

                    <div style="font-size: 0.8rem; line-height: 1.3; margin-bottom: 10px;">
                        <div><strong>EMPLEADO:</strong> ${emp.nombre}</div>
                        <div><strong>CARGO:</strong> ${emp.cargo}</div>
                        <div><strong>FECHA:</strong> ${fechaImpresion} ${horaImpresion}</div>
                    </div>

                    <div style="border-bottom: 1px dashed #000; margin-bottom: 5px;"></div>

                    <table style="width: 100%; font-size: 0.8rem; border-collapse: collapse;">
                        <tr>
                            <td style="text-align: left; padding: 2px 0;"><strong>CONCEPTO</strong></td>
                            <td style="text-align: right; padding: 2px 0;"><strong>VALOR</strong></td>
                        </tr>
                        <tr><td colspan="2" style="border-bottom: 1px dashed #000; padding-bottom: 5px;"></td></tr>
                        
                        <!-- DATOS SINCRO -->
                        <tr><td>Salario Básico</td><td style="text-align: right;" id="t_basico">${formatter.format(emp.basico)}</td></tr>
                        <tr><td>Aux. Transporte</td><td style="text-align: right;" id="t_auxilio">${formatter.format(emp.auxilio)}</td></tr>
                        <tr><td>Comisiones</td><td style="text-align: right;" id="t_comisiones">${formatter.format(emp.comisiones)}</td></tr>
                        <tr><td>Bonificaciones</td><td style="text-align: right;" id="t_bonos">${formatter.format(emp.bonificaciones || 0)}</td></tr>
                        <tr><td>Eventos/Servicios</td><td style="text-align: right;" id="t_incentivos">${formatter.format(emp.incentivos || 0)}</td></tr>

                        <tr><td colspan="2" style="padding: 5px 0; font-weight: bold;">DEDUCCIONES:</td></tr>

                        <tr><td>Salud/Pensión</td><td style="text-align: right;" id="t_salud">-${formatter.format(emp.deduccionesLey)}</td></tr>
                        <tr><td>Otros Descuentos</td><td style="text-align: right;" id="t_otros">-${formatter.format(emp.otrosDescuentos)}</td></tr>
                        <tr><td>Adelantos</td><td style="text-align: right;" id="t_adelantos">-${formatter.format(emp.totalAdelantos)}</td></tr>
                    </table>

                    <div style="border-bottom: 1px dashed #000; margin: 10px 0;"></div>

                    <table style="width: 100%; font-size: 1rem; font-weight: bold;">
                        <tr>
                            <td style="text-align: left;">TOTAL NETO:</td>
                            <td style="text-align: right;" id="ticketTotalNeto">$${formatearPrecio(emp.neto)}</td>
                        </tr>
                    </table>

                    <div style="border-bottom: 1px dashed #000; margin: 15px 0;"></div>

                    <div style="text-align: center; margin-top: 30px; margin-bottom: 10px;">
                        <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto 5px auto;"></div>
                        <small>Firma Recibido</small>
                    </div>
                </div>
                <div style="color:white; text-align:center; margin-top:10px; font-size:0.8rem;">Vista Previa de Impresión</div>
            </div>
        </div>
    `;

    const contenido = document.getElementById('contenidoDetalleNomina');
    contenido.innerHTML = html;

    // Configurar modal para que sea MUY ANCHO (Full Screen casi)
    const modalContent = document.querySelector('#modalDetalleNomina .modal-content-wrapper');
    if (modalContent) {
        modalContent.style.maxWidth = '1400px'; // GIGANTE
        modalContent.style.width = '95%';
        modalContent.style.background = '#f1f5f9'; // Fondo más suave
        modalContent.style.padding = '2rem';
    }

    // Ajustar estilos internos para aprovechar el espacio extra
    // Agrandamos fuentes y espaciado en el editor
    const editor = document.querySelector('.nomina-editor-panel');
    if (editor) {
        editor.style.minWidth = '500px'; // Más ancho mínimo
    }

    // Inyectar CSS dinámico para inputs más grandes solo en este modal
    const styleId = 'estilos-modal-nomina-large';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .nomina-editor-panel input { 
                font-size: 1.1rem !important; 
                padding: 0.8rem !important; 
                height: auto !important;
            }
            .nomina-editor-panel label {
                font-size: 1rem !important;
                margin-bottom: 0.5rem !important;
            }
            .nomina-editor-panel h5 {
                font-size: 1.3rem !important;
                border-bottom: 2px solid #e2e8f0;
                padding-bottom: 10px;
                margin-bottom: 20px !important;
            }
            /* Scrollbar bonito para el ticket */
            .nomina-preview-panel::-webkit-scrollbar { width: 8px; }
            .nomina-preview-panel::-webkit-scrollbar-track { background: #333; }
            .nomina-preview-panel::-webkit-scrollbar-thumb { background: #666; border-radius: 4px; }
        `;
        document.head.appendChild(style);
    }

    document.getElementById('modalDetalleNomina').style.display = 'flex';
}

function cerrarDetalleNomina() {
    document.getElementById('modalDetalleNomina').style.display = 'none';
    cargarNomina(); // Refrescar tabla principal con los nuevos totales
}

// Función robusta para imprimir
// Función robusta para imprimir
window.imprimirNomina = function () {
    const ticketElement = document.getElementById('modalDetalleNominaTicket');

    if (ticketElement && window.TicketPrinter) {
        // Clonar para no afectar el DOM original y limpiar estilos inline que no sirvan en impresión pura si hace falta
        // Pero TicketPrinter ya maneja estilos.
        // Lo importante es pasar el HTML interno del ticket, PERO OJO:
        // El ticket actual en el DOM ya tiene logo y encabezado "hardcoded" en el HTML del modal.
        // Opción A: Pasar todo el HTML tal cual (duplicaría encabezado si TicketPrinter lo pone).
        // Opción B: Extraer solo la tabla y datos, y dejar que TicketPrinter ponga el encabezado.

        // Vamos por Opción B para consistencia total.

        // Extraemos datos clave del DOM actual para reconstruir un HTML limpio para TicketPrinter
        // O mejor aún, usamos el HTML del ticket pero ocultamos el encabezado interno que tiene

        let contenido = ticketElement.innerHTML;

        // Hack rápido: Eliminar el encabezado manual del HTML capturado para que no salga doble
        // El encabezado en el DOM tiene la imagen del logo. Vamos a intentar limpiarlo con regex o DOM parser
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = contenido;

        // Eliminar el primer div que contiene la img y el titulo (asumiendo estructura mantener)
        const headerDiv = tempDiv.querySelector('div[style*="text-align: center"]');
        if (headerDiv) headerDiv.remove();

        // Eliminar el titulo "COMPROBANTE DE PAGO" si se duplica
        // TicketPrinter pone el titulo que le pasemos.

        // Simplemente pasamos el contenido limpio
        TicketPrinter.print('COMPROBANTE DE NOMINA', tempDiv.innerHTML, 'Recibido Conforme');

    } else {
        alert('No se puede imprimir: Falta el ticket o el módulo de impresión.');
    }
};

// Exportar globalmente
window.cargarNomina = cargarNomina;
window.guardarAdelanto = guardarAdelanto;
window.guardarCierreNomina = guardarCierreNomina;
window.verDetalleNomina = verDetalleNomina;
window.cerrarDetalleNomina = cerrarDetalleNomina;
window.imprimirNomina = imprimirNomina;

// Inicialización automática del mes actual
document.addEventListener('DOMContentLoaded', () => {
    const inputMes = document.getElementById('filtroMesNomina');
    if (inputMes && !inputMes.value) {
        inputMes.value = new Date().toISOString().slice(0, 7);
    }
});
