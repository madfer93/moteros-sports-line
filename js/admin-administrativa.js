// ==========================================
// NAVEGACIÓN ENTRE SECCIONES
// ==========================================

// Toggle del menú móvil
function toggleMobileMenu() {
    const mobileNav = document.getElementById('mobileNav');
    if (mobileNav) {
        mobileNav.classList.toggle('active');
    }
}

// Mostrar una sección específica y ocultar las demás
function showSection(sectionId) {
    // Ocultar todas las secciones
    document.querySelectorAll('.main-content-horizontal .section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });

    // Mostrar la sección solicitada
    const target = document.getElementById('section-' + sectionId);
    if (target) {
        target.classList.add('active');
        target.style.display = 'block';
    }

    // Gatillos de carga según sección
    if (sectionId === 'admin_roles') {
        cargarAdministradores();
    }

    // Cerrar menú móvil si está abierto
    const mobileNav = document.getElementById('mobileNav');
    if (mobileNav) mobileNav.classList.remove('active');
}

// Toast notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        padding: 1rem 1.5rem;
        margin-bottom: 0.75rem;
        border-radius: 0.75rem;
        color: white;
        font-weight: 500;
        font-size: 0.9rem;
        animation: fadeIn 0.3s ease;
        background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    `;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// Vincular los links de navegación con data-section
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.getAttribute('data-section');
            showSection(sectionId);
        });
    });
});

// -> Abrir Modal Nuevo Prestamo
async function abrirModalNuevoPrestamo() {
    document.getElementById('modalNuevoPrestamo').style.display = 'flex';
    document.getElementById('prestamoBuscarProducto').value = '';
    document.getElementById('prestamoProductoId').value = '';
    document.getElementById('prestamoVariantesContainer').style.display = 'none';
    document.getElementById('prestamoPrestatario').value = '';
    document.getElementById('prestamoResponsable').value = '';
    document.getElementById('prestamoCantidad').value = '';
    document.getElementById('prestamoValorTotal').value = '';
    document.getElementById('prestamoNotas').value = '';

    await cargarResponsablesAdmin('prestamoResponsable');
}

function cerrarModalPrestamo() {
    document.getElementById('modalNuevoPrestamo').style.display = 'none';
}

// -> Buscar Producto para préstamo
let typingTimerPrestamo;
async function buscarProductoPrestamo() {
    clearTimeout(typingTimerPrestamo);
    const busqueda = document.getElementById('prestamoBuscarProducto').value.trim();
    const resultadosBox = document.getElementById('resultadosPrestamo');

    if (busqueda.length < 3) {
        resultadosBox.style.display = 'none';
        return;
    }

    typingTimerPrestamo = setTimeout(async () => {
        try {
            const { data, error } = await supabaseClient
                .from('productos')
                .select('id_producto, nombre, marca, precio_compra, url_imagen_principal')
                .or(`id_producto.ilike.%${busqueda}%,nombre.ilike.%${busqueda}%,marca.ilike.%${busqueda}%`)
                .limit(10);

            if (error) throw error;

            if (data && data.length > 0) {
                resultadosBox.innerHTML = data.map(p => `
                    <div class="search-result-item" onclick="seleccionarProductoPrestamo('${p.id_producto}', '${p.nombre}', ${p.precio_compra})">
                        <img src="${p.url_imagen_principal || '../img/placeholder.png'}" alt="" style="width:30px;height:30px;object-fit:cover;border-radius:4px;">
                        <div>
                            <strong>${p.id_producto}</strong> - ${p.nombre}
                            <div style="font-size:0.75rem;color:var(--gray);">${p.marca}</div>
                        </div>
                    </div>
                `).join('');
                resultadosBox.style.display = 'block';
            } else {
                resultadosBox.innerHTML = '<div style=""padding:10px;color:red;"">No encontrado.</div>';
                resultadosBox.style.display = 'block';
            }
        } catch (err) {
            console.error(err);
        }
    }, 500);
}

async function seleccionarProductoPrestamo(id, nombre, costo) {
    document.getElementById('prestamoBuscarProducto').value = `${id} - ${nombre}`;
    document.getElementById('prestamoProductoId').value = id;
    document.getElementById('prestamoPrecioCosto').value = costo || 0;
    document.getElementById('resultadosPrestamo').style.display = 'none';

    // Cargar variantes (tallas/colores) disponibles en BODEGA PRINCIPAL
    try {
        const { data, error } = await supabaseClient
            .from('inventario_bodega')
            .select('talla, color, cantidad')
            .eq('id_producto', id);

        if (error) throw error;

        const tallaSelect = document.getElementById('prestamoTalla');
        const colorSelect = document.getElementById('prestamoColor');
        tallaSelect.innerHTML = '<option value="""">Seleccione...</option>';
        colorSelect.innerHTML = '<option value="""">Seleccione...</option>';

        if (data && data.length > 0) {
            // Unico Set
            const tallas = [...new Set(data.map(d => d.talla))];
            const colores = [...new Set(data.map(d => d.color))];

            tallas.forEach(t => tallaSelect.innerHTML += `<option value="${t}">${t}</option>`);
            colores.forEach(c => colorSelect.innerHTML += `<option value="${c}">${c}</option>`);

            // Si elijo color/talla actualiza stock info
            const updateStock = () => {
                const t = tallaSelect.value;
                const c = colorSelect.value;
                if (t && c) {
                    const match = data.find(d => d.talla === t && d.color === c);
                    const infoBox = document.getElementById('prestamoStockInfo');
                    if (match) {
                        infoBox.textContent = `Stock en Bodega Disponible: ${match.cantidad}`;
                        document.getElementById('prestamoCantidad').max = match.cantidad;
                    } else {
                        infoBox.textContent = `Sin inventario para esta variante en Bodega.`;
                        document.getElementById('prestamoCantidad').max = 0;
                    }
                }
            };

            tallaSelect.addEventListener('change', updateStock);
            colorSelect.addEventListener('change', updateStock);

            document.getElementById('prestamoVariantesContainer').style.display = 'block';
        } else {
            document.getElementById('prestamoVariantesContainer').style.display = 'none';
            alert('Este producto no tiene inventario en BODEGA PRINCIPAL.');
        }
    } catch (err) {
        console.error(err);
    }
}

function calcularTotalPrestamo() {
    const costo = parseFloat(document.getElementById('prestamoPrecioCosto').value) || 0;
    const cant = parseInt(document.getElementById('prestamoCantidad').value) || 0;
    document.getElementById('prestamoValorTotal').value = costo * cant;
}

// -> Guardar el préstamo DB
async function guardarPrestamo() {
    const id_producto = document.getElementById('prestamoProductoId').value;
    const talla = document.getElementById('prestamoTalla').value;
    const color = document.getElementById('prestamoColor').value;
    const prestatario = document.getElementById('prestamoPrestatario').value.trim();
    const cantidad = parseInt(document.getElementById('prestamoCantidad').value);
    const valor_total = document.getElementById('prestamoValorTotal').value;
    const notas = document.getElementById('prestamoNotas').value.trim();

    // Validaciones basicas
    if (!id_producto || !talla || !color || !prestatario || !cantidad || cantidad <= 0) {
        showToast('Debes completar todos los campos obligatorios.', 'error');
        return;
    }

    // Validar vs Stock maximo del input
    const maxStock = parseInt(document.getElementById('prestamoCantidad').max) || 0;
    if (cantidad > maxStock) {
        showToast('No puedes prestar más unidades de las que hay en la Bodega.', 'error');
        return;
    }

    // 1. Descontar stock de inventario_bodega
    try {
        const { error: errUpdate } = await supabaseClient.rpc('decrementar_inventario_bodega_seguro', {
            p_id_producto: id_producto,
            p_talla: talla,
            p_color: color,
            p_cantidad: cantidad
        });

        // NOTA: Si no tienes el RPC, lo hacemos via JS clásico primero chequemos:
        if (errUpdate) {
            // Fallback JS si no existe el procedimiento RPC
            const { data: invData, error: errGet } = await supabaseClient
                .from('inventario_bodega')
                .select('cantidad')
                .eq('id_producto', id_producto).eq('talla', talla).eq('color', color).single();

            if (errGet || !invData) throw errGet;

            const nueva_cantidad = invData.cantidad - cantidad;
            if (nueva_cantidad < 0) throw new Error('Stock insuficiente');

            const { error: errDb } = await supabaseClient
                .from('inventario_bodega')
                .update({ cantidad: nueva_cantidad })
                .eq('id_producto', id_producto).eq('talla', talla).eq('color', color);

            if (errDb) throw errDb;
        }

        // 2. Insertar Préstamo Operativo
        const { error: errInsert } = await supabaseClient
            .from('prestamos_operativos')
            .insert([{
                id_producto: id_producto,
                talla: talla,
                color: color,
                cantidad: cantidad,
                valor_total: valor_total,
                prestatario: prestatario,
                responsable_id: document.getElementById('prestamoResponsable').value || null,
                nombre_registro: window.adminNombre || 'Administradora Operativa',
                motivo: notas,
                registrado_por: window.adminNombre || 'Administradora Operativa',
                estado: 'Activo',
                fecha_prestamo: new Date().toISOString()
            }]);

        if (errInsert) throw errInsert;

        showToast('Préstamo guardado y stock de bodega descontado.', 'success');
        cerrarModalPrestamo();
        cargarCarteraBodegas(); // Refrescar

    } catch (err) {
        console.error('Error guardando préstamo:', err);
        showToast('Fallo al guardar: ' + err.message, 'error');
    }
}

async function cargarResponsablesAdmin(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    try {
        const { data, error } = await supabaseClient
            .from('compras_responsables')
            .select('id, nombre, cedula')
            .eq('activo', true)
            .order('nombre', { ascending: true });

        if (error) throw error;
        select.innerHTML = '<option value="">Seleccione responsable...</option>' +
            data.map(r => `<option value="${r.id}">${r.nombre} (${r.cedula})</option>`).join('');
    } catch (e) { console.error('Error cargando responsables', e); }
}

// ==========================================
// MÓDULO: GASTOS TIPO TEMU / EXTERNOS
// ==========================================

async function cargarGastosOperativos() {
    const tbody = document.getElementById('tbodyGastosOperativos');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando gastos...</td></tr>';

    try {
        const { data, error } = await supabaseClient
            .from('gastos_tienda')
            .select(`
                id,
                fecha,
                monto,
                descripcion,
                categoria_id,
                categorias_gastos(nombre),
                cuenta_id,
                cuentas_bancarias(nombre_titular, banco)
            `)
            .order('fecha', { ascending: false })
            .limit(50);

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay gastos recientes registrados.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(g => {
            let cuentaText = '<span style="color:var(--gray);">Sin cuenta vinculada</span>';
            if (g.cuentas_bancarias) {
                cuentaText = `${g.cuentas_bancarias.banco} - ${g.cuentas_bancarias.nombre_titular}`;
            } else if (g.cuenta_id) {
                cuentaText = `Cuenta ID: ${g.cuenta_id.substring(0, 8)}...`;
            }

            const catText = g.categorias_gastos ? g.categorias_gastos.nombre : 'Sin Categoría';

            return `
            <tr>
                <td>${new Date(g.fecha).toLocaleDateString()}</td>
                <td><span class="badge" style="background:#f1f5f9;color:#475569;">${catText}</span></td>
                <td style="color:var(--danger); font-weight:bold;">$${parseFloat(g.monto).toLocaleString()}</td>
                <td>${cuentaText}</td>
                <td>${g.descripcion || '-'}</td>
            </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Error cargando gastos', err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Error cargando datos.</td></tr>';
    }
}
// Inyectamos el Modal de Gastos Dinámicamente para no ensuciar el HTML
function inyectarModalGastos() {
    if (document.getElementById('modalNuevoGastoOp')) return;

    const div = document.createElement('div');
    div.innerHTML = `
    <div id="modalNuevoGastoOp" class="modal-overlay" style="display:none;">
        <div class="modal">
            <h3>💸 Registrar Gasto Operativo / Temu</h3>
            <p style="font-size:0.8rem; color:var(--gray); margin-bottom:1rem;">Los gastos aquí registrados afectan el balance general de la empresa.</p>
            
            <div class="form-group">
                <label>Categoría del Gasto</label>
                <select id="gastoOpCategoria" class="form-control">
                    <option value="">Cargando categorías...</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>Monto</label>
                <input type="number" id="gastoOpMonto" class="form-control" placeholder="">
            </div>
            
            <div class="form-group">
                <label style="color:var(--danger); font-weight:bold;">Cuenta de Origen (De dónde salió la plata)</label>
                <select id="gastoOpCuenta" class="form-control" style="border-color:var(--danger);">
                    <option value="">Cargando cuentas...</option>
                </select>
                <small style="color:var(--gray);">*Obligatorio para auditar compras tipo Temu.</small>
            </div>
            
            <div class="form-group">
                <label>Descripción / Razón</label>
                <textarea id="gastoOpDesc" class="form-control" rows="2" placeholder="Ej: Compra de 50 llaveros en Temu para Alcalá..."></textarea>
            </div>
            
            <div class="modal-botones">
                <button class="btn btn-outline" onclick="document.getElementById('modalNuevoGastoOp').style.display='none'">Cancelar</button>
                <button class="btn btn-danger" onclick="guardarGastoOperativo()">Registrar Salida</button>
            </div>
        </div>
    </div>
    `;
    document.body.appendChild(div);
}
async function abrirModalNuevoGastoOperativo() {
    inyectarModalGastos();
    document.getElementById('modalNuevoGastoOp').style.display = 'flex';
    document.getElementById('gastoOpMonto').value = '';
    document.getElementById('gastoOpDesc').value = '';

    // Cargar Cats
    try {
        const { data: cats } = await supabaseClient.from('categorias_gastos').select('*').order('nombre');
        const selectCat = document.getElementById('gastoOpCategoria');
        selectCat.innerHTML = '<option value="">Seleccione Categoría...</option>' +
            (cats ? cats.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('') : '');

        // Cargar Cuentas
        const { data: cuentas } = await supabaseClient.from('cuentas_bancarias').select('*').order('banco');
        const selectCuenta = document.getElementById('gastoOpCuenta');
        selectCuenta.innerHTML = '<option value="">Seleccione la cuenta que pagó...</option>' +
            (cuentas ? cuentas.map(c => `<option value="${c.id}">${c.banco} - ${c.nombre_cuenta}</option>`).join('') : '');

    } catch (err) {
        console.error(err);
    }
}

async function guardarGastoOperativo() {
    const categoria_id = document.getElementById('gastoOpCategoria').value;
    const monto = document.getElementById('gastoOpMonto').value;
    const cuenta_id = document.getElementById('gastoOpCuenta').value;
    const desc = document.getElementById('gastoOpDesc').value.trim();

    if (!categoria_id || !monto || !cuenta_id) {
        showToast('Categoría, Monto y Cuenta Origen son obligatorios.', 'error');
        return;
    }

    try {
        const { error } = await supabaseClient.from('gastos_tienda').insert([{
            categoria_id: categoria_id,
            monto: monto,
            cuenta_id: cuenta_id,
            descripcion: desc,
            fecha: new Date().toISOString(),
            registrado_por: 'Administradora Operativa',
            responsable: 'Administradora Operativa',
            tienda: 'Virtual / Operativa'
        }]);

        if (error) throw error;

        showToast('Gasto registrado exitosamente.', 'success');
        document.getElementById('modalNuevoGastoOp').style.display = 'none';
        cargarGastosOperativos(); // Refrescar tabla

    } catch (err) {
        console.error(err);
        showToast('Error al guardar: ' + err.message, 'error');
    }
}

// ==========================================
// TABS DE CARTERA
// ==========================================
function cambiarPestanaCartera(evt, tabId) {
    // Esconder todas
    document.querySelectorAll('#section-carteras_operativas .tab-content').forEach(tc => tc.classList.remove('active'));
    document.querySelectorAll('#section-carteras_operativas .tab-btn').forEach(tb => {
        tb.classList.remove('active');
        tb.classList.remove('btn-primary');
        tb.classList.add('btn-secondary');
    });

    // Mostrar la clickeada
    document.getElementById(tabId).classList.add('active');
    evt.currentTarget.classList.add('active');
    evt.currentTarget.classList.remove('btn-secondary');
    evt.currentTarget.classList.add('btn-primary');

    // Lazy load de datos
    if (tabId === 'tab-cartera-moteros') cargarCarteraMoteros();
    else if (tabId === 'tab-cartera-bodegas') cargarCarteraBodegas();
    else if (tabId === 'tab-cartera-addi') cargarCarteraPasarela('Addi', 'Addi');
    else if (tabId === 'tab-cartera-siste') cargarCarteraPasarela('Sistecredito', 'Siste');
    else if (tabId === 'tab-cartera-fodegas') cargarCarteraPasarela('Fodegas', 'Fodegas');
    else if (tabId === 'tab-cartera-config') cargarComisiones();
}

// Assuming a `cargarSeccion` function exists elsewhere in the file or is implicitly handled.
// If `cargarSeccion` is not defined, this part of the instruction cannot be fully applied.
// Based on the provided "Code Edit" snippet, the intent is to add this logic to a `cargarSeccion` function.
// Since `cargarSeccion` is not in the provided content, I'm adding a placeholder for it.
async function cargarSeccion(seccion) {
    // Gatillo de carga según sección
    if (seccion === 'resumen_operativo') {
        // Asumiendo que existe una función para cargar resumen
        if (typeof cargarDatosResumen === 'function') cargarDatosResumen();
    }
    if (seccion === 'carteras_operativas') {
        cargarCarteraMoteros();
        cargarCarteraBodegas();
    }
    if (seccion === 'prestamos_inventario') {
        cargarCarteraBodegas(); // Se usa la misma función o similar
    }
    if (seccion === 'admin_roles') {
        cargarAdministradores();
    }
}


// ==========================================
// FORMATO DE MONEDA
// ==========================================
function fmtPrecio(n) {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n || 0);
}
function fmtFecha(f) {
    if (!f) return '—';
    const d = new Date(f);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ==========================================
// COMISIONES (Supabase — configuracion_comisiones)
// ==========================================
let _comisionesCache = { addi: 7.5, sistecredito: 5.5, fodegas: 4.5, bold: 2.5 };

async function cargarComisiones() {
    try {
        const supabaseClient = window.supabaseClient || supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        const { data, error } = await supabaseClient.from('configuracion_comisiones').select('clave, porcentaje');
        if (error) throw error;
        (data || []).forEach(row => {
            _comisionesCache[row.clave] = parseFloat(row.porcentaje);
        });
    } catch (e) {
        console.warn('Comisiones: fallback defaults', e.message);
    }
    // Sincronizar inputs del UI
    const el = id => document.getElementById(id);
    if (el('comisionAddi')) el('comisionAddi').value = _comisionesCache.addi || 7.5;
    if (el('comisionSiste')) el('comisionSiste').value = _comisionesCache.sistecredito || 5.5;
    if (el('comisionFodegas')) el('comisionFodegas').value = _comisionesCache.fodegas || 4.5;
    if (el('comisionBold')) el('comisionBold').value = _comisionesCache.bold || 2.5;
}

async function guardarComisiones() {
    const updates = [
        { clave: 'addi', porcentaje: parseFloat(document.getElementById('comisionAddi').value) || 7.5 },
        { clave: 'sistecredito', porcentaje: parseFloat(document.getElementById('comisionSiste').value) || 5.5 },
        { clave: 'fodegas', porcentaje: parseFloat(document.getElementById('comisionFodegas').value) || 4.5 },
        { clave: 'bold', porcentaje: parseFloat(document.getElementById('comisionBold').value) || 2.5 }
    ];
    try {
        const supabaseClient = window.supabaseClient || supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        for (const u of updates) {
            await supabaseClient.from('configuracion_comisiones')
                .update({ porcentaje: u.porcentaje, updated_at: new Date().toISOString() })
                .eq('clave', u.clave);
            _comisionesCache[u.clave] = u.porcentaje;
        }
        showToast('✅ Comisiones guardadas en Supabase', 'success');
    } catch (err) {
        showToast('Error al guardar: ' + err.message, 'error');
    }
}

function getComision(tipo) {
    const map = { addi: 'addi', siste: 'sistecredito', fodegas: 'fodegas', bold: 'bold' };
    const clave = map[tipo.toLowerCase()] || tipo.toLowerCase();
    return (_comisionesCache[clave] || 5) / 100;
}

async function recalcularTodasCarteras() {
    await guardarComisiones();
    cargarCarteraPasarela('Addi', 'Addi');
    cargarCarteraPasarela('Sistecredito', 'Siste');
    cargarCarteraPasarela('Fodegas', 'Fodegas');
    showToast('Carteras recalculadas con comisiones actualizadas', 'info');
}

// ==========================================
// GRÁFICAS CHART.JS
// ==========================================
let chartSemaforoInstance = null;
let chartPasarelasInstance = null;
let chartRecuperacionInstance = null;

function renderChartSemaforo(creditos) {
    const ctx = document.getElementById('chartSemaforo');
    if (!ctx) return;

    const hoy = new Date();
    let optimo = 0, pendiente = 0, castigado = 0, pagado = 0;

    (creditos || []).forEach(c => {
        if (c.estado === 'pagado' || c.estado === 'CERRADO') { pagado++; return; }
        const venc = new Date(c.fecha_vencimiento);
        const dias = Math.max(0, Math.floor((hoy - venc) / (1000 * 60 * 60 * 24)));
        if (dias <= 60) optimo++;
        else if (dias <= 85) pendiente++;
        else castigado++;
    });

    if (chartSemaforoInstance) chartSemaforoInstance.destroy();

    chartSemaforoInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['🟢 Óptimo (≤60d)', '🟡 Pendiente (61-85d)', '🔴 Castigado (>85d)', '✅ Pagado'],
            datasets: [{
                data: [optimo, pendiente, castigado, pagado],
                backgroundColor: ['#22c55e', '#eab308', '#ef4444', '#94a3b8'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.label}: ${ctx.raw} créditos (${((ctx.raw / (optimo + pendiente + castigado + pagado)) * 100).toFixed(0)}%)`
                    }
                }
            }
        }
    });
}

async function renderChartPasarelas() {
    const ctx = document.getElementById('chartPasarelas');
    if (!ctx) return;

    try {
        const supabaseClient = window.supabaseClient || supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

        // Ventas de los últimos 6 meses
        const hace6m = new Date();
        hace6m.setMonth(hace6m.getMonth() - 6);

        const { data: ventas, error } = await supabaseClient
            .from('ventas')
            .select('metodo_pago, total, created_at')
            .gte('created_at', hace6m.toISOString())
            .eq('estado_venta', 'Completada');
        if (error) throw error;

        // Agrupar por mes y pasarela
        const meses = {};
        const pasarelas = ['Addi', 'Sistecredito', 'Fodegas'];
        const mesesLabels = [];

        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            meses[key] = { Addi: 0, Sistecredito: 0, Fodegas: 0 };
            mesesLabels.push(d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }));
        }

        (ventas || []).forEach(v => {
            const d = new Date(v.created_at);
            const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            if (!meses[key]) return;
            pasarelas.forEach(p => {
                if (v.metodo_pago && v.metodo_pago.toLowerCase().includes(p.toLowerCase())) {
                    meses[key][p] += parseFloat(v.total || 0);
                }
            });
        });

        const keys = Object.keys(meses);

        if (chartPasarelasInstance) chartPasarelasInstance.destroy();

        chartPasarelasInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: mesesLabels,
                datasets: [
                    { label: 'Addi', data: keys.map(k => meses[k].Addi), backgroundColor: '#8b5cf6', borderRadius: 6 },
                    { label: 'Sistecrédito', data: keys.map(k => meses[k].Sistecredito), backgroundColor: '#06b6d4', borderRadius: 6 },
                    { label: 'Fodegas', data: keys.map(k => meses[k].Fodegas), backgroundColor: '#f97316', borderRadius: 6 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, ticks: { callback: v => '$' + fmtPrecio(v) } },
                    x: { grid: { display: false } }
                },
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 11 } } },
                    tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: $${fmtPrecio(ctx.raw)}` } }
                }
            }
        });
    } catch (err) {
        console.error('Chart pasarelas:', err);
    }
}

async function renderChartRecuperacion() {
    const ctx = document.getElementById('chartRecuperacion');
    if (!ctx) return;

    try {
        const supabaseClient = window.supabaseClient || supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

        // Pagos de crédito de los últimos 6 meses
        const hace6m = new Date();
        hace6m.setMonth(hace6m.getMonth() - 6);

        const { data: pagos, error } = await supabaseClient
            .from('pagos_credito')
            .select('monto_pagado, fecha_pago')
            .gte('fecha_pago', hace6m.toISOString())
            .order('fecha_pago', { ascending: true });
        if (error) throw error;

        // Agrupar por mes
        const meses = {};
        const mesesLabels = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            meses[key] = 0;
            mesesLabels.push(d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }));
        }

        (pagos || []).forEach(p => {
            const d = new Date(p.fecha_pago);
            const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            if (meses[key] !== undefined) meses[key] += parseFloat(p.monto_pagado || 0);
        });

        const keys = Object.keys(meses);

        if (chartRecuperacionInstance) chartRecuperacionInstance.destroy();

        chartRecuperacionInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: mesesLabels,
                datasets: [{
                    label: 'Cobros Recibidos',
                    data: keys.map(k => meses[k]),
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34,197,94,0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointBackgroundColor: '#22c55e',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, ticks: { callback: v => '$' + fmtPrecio(v) } },
                    x: { grid: { display: false } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: ctx => `Cobrado: $${fmtPrecio(ctx.raw)}` } }
                }
            }
        });
    } catch (err) {
        console.error('Chart recuperación:', err);
    }
}

// ==========================================
// EXPORTAR REPORTES PDF / EXCEL
// ==========================================
function exportarCarteraPDF(tableId, filename, title) {
    const table = document.getElementById(tableId);
    if (!table) { showToast('Tabla no encontrada', 'error'); return; }
    if (window.ReportExporter) {
        ReportExporter.toPDF(table, filename, title + ' — Moteros Sports Line');
    } else if (window.html2pdf) {
        html2pdf().set({
            margin: 10,
            filename: filename + '.pdf',
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'letter', orientation: 'landscape' }
        }).from(table).save();
        showToast('📄 PDF generado', 'success');
    } else {
        showToast('Librería PDF no disponible', 'error');
    }
}

function exportarCarteraExcel(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) { showToast('Tabla no encontrada', 'error'); return; }
    if (window.ReportExporter) {
        ReportExporter.toExcel(table, filename, filename.replace('Cartera_', ''));
    } else {
        showToast('Librería Excel no disponible', 'error');
    }
}

function exportarPDFPrestamos() {
    const tables = document.querySelectorAll('#section-prestamos_inventario .data-table');
    if (tables.length > 0 && window.ReportExporter) {
        ReportExporter.toPDF(tables[0], 'Prestamos_Bodega', '📦 Préstamos de Bodega — Moteros Sports Line');
    } else {
        showToast('No hay datos para exportar', 'error');
    }
}

function exportarPDFGastos() {
    const tables = document.querySelectorAll('#section-gastos_operativos .data-table');
    if (tables.length > 0 && window.ReportExporter) {
        ReportExporter.toPDF(tables[0], 'Gastos_Temu', '💸 Gastos Operativos (Temu) — Moteros Sports Line');
    } else {
        showToast('No hay datos para exportar', 'error');
    }
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
let _creditosCache = [];

let inicializarOperativo = async function () {
    cargarGastosOperativos();
    await cargarComisiones();
    await cargarCarteraMoteros();
    cargarCarteraBodegas();
    // Renderizar gráficas con los datos ya cargados
    renderChartSemaforo(_creditosCache);
    renderChartPasarelas();
    renderChartRecuperacion();
};

async function cargarCarteraMoteros() {
    const tbody = document.getElementById('tbodyCarteraMoteros');
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">⏳ Cargando créditos...</td></tr>';

    try {
        const supabaseClient = window.supabaseClient || supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

        // Traer todos los créditos
        let query = supabaseClient.from('creditos_motero').select('*').order('fecha_vencimiento', { ascending: true });

        // Filtros
        const filtroLocal = document.getElementById('filtroCarteraLocal').value;
        const filtroEstado = document.getElementById('filtroCarteraEstado').value;
        if (filtroLocal) query = query.eq('local_origen', filtroLocal);
        if (filtroEstado) query = query.eq('estado', filtroEstado);

        const { data: creditos, error } = await query;
        if (error) throw error;

        _creditosCache = creditos || [];

        // KPIs
        let carteraActiva = 0, carteraMora = 0, carteraRecuperada = 0, totalOtorgado = 0;
        const hoy = new Date();

        (creditos || []).forEach(c => {
            totalOtorgado += parseFloat(c.monto_total || 0);
            const saldo = parseFloat(c.saldo_pendiente || 0);
            if (c.estado === 'activo') carteraActiva += saldo;
            else if (c.estado === 'mora') carteraMora += saldo;
            else if (c.estado === 'pagado' || c.estado === 'CERRADO') carteraRecuperada += parseFloat(c.monto_total || 0);
        });

        document.getElementById('kpiCarteraActiva').textContent = '$' + fmtPrecio(carteraActiva);
        document.getElementById('kpiCarteraMoraTotal').textContent = '$' + fmtPrecio(carteraMora);
        document.getElementById('kpiCarteraRecuperada').textContent = '$' + fmtPrecio(carteraRecuperada);
        document.getElementById('kpiTasaRecuperacion').textContent =
            totalOtorgado > 0 ? (carteraRecuperada / totalOtorgado * 100).toFixed(1) + '%' : '0%';

        // Renderizar tabla
        if (!creditos || creditos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#94a3b8;">Sin créditos encontrados</td></tr>';
            return;
        }

        tbody.innerHTML = creditos.map(c => {
            const saldo = parseFloat(c.saldo_pendiente || 0);
            const venc = new Date(c.fecha_vencimiento);
            const diasMora = Math.max(0, Math.floor((hoy - venc) / (1000 * 60 * 60 * 24)));

            // Semaforización
            let semaforo, semaforoStyle;
            if (c.estado === 'pagado' || c.estado === 'CERRADO') {
                semaforo = '✅';
                semaforoStyle = 'background:#dcfce7;color:#15803d;';
            } else if (diasMora <= 60) {
                semaforo = '🟢';
                semaforoStyle = 'background:#dcfce7;color:#15803d;';
            } else if (diasMora <= 85) {
                semaforo = '🟡';
                semaforoStyle = 'background:#fef9c3;color:#a16207;';
            } else {
                semaforo = '🔴';
                semaforoStyle = 'background:#fee2e2;color:#dc2626;';
            }

            // Extraer nombre del cliente de las notas
            const notasMatch = c.notas ? c.notas.match(/Crédito:\s*([^|]+)/i) : null;
            const clienteNombre = notasMatch ? notasMatch[1].trim() : (c.numero_credito.split('-').pop() || 'N/A');

            // Teléfono
            const telMatch = c.notas ? c.notas.match(/Tel:\s*(\d+)/i) : null;
            const telefono = telMatch ? telMatch[1] : '';

            return `<tr>
                <td style="text-align:center;"><span style="padding:4px 10px;border-radius:20px;font-size:0.85rem;${semaforoStyle}">${semaforo} ${c.estado === 'pagado' || c.estado === 'CERRADO' ? 'Pagado' :
                    diasMora <= 60 ? 'Óptimo' : diasMora <= 85 ? 'Pendiente' : 'Castigado'
                }</span></td>
                <td style="font-family:monospace;font-size:0.8rem;">${c.numero_credito}</td>
                <td><strong>${clienteNombre}</strong><br><small style="color:#94a3b8;">${telefono ? '📱 ' + telefono : ''}</small></td>
                <td>${c.local_origen}</td>
                <td>$${fmtPrecio(c.monto_total)}</td>
                <td style="font-weight:700;${saldo > 0 ? 'color:#ef4444;' : 'color:#16a34a;'}">$${fmtPrecio(saldo)}</td>
                <td>${c.cuotas_pagadas || 0}/${c.numero_cuotas}</td>
                <td style="font-weight:600;${diasMora > 85 ? 'color:#dc2626;' : diasMora > 60 ? 'color:#ca8a04;' : ''}">${c.estado === 'pagado' || c.estado === 'CERRADO' ? '—' : diasMora + 'd'
                }</td>
                <td>
                    <div style="display:flex;gap:4px;flex-wrap:wrap;">
                        <button class="btn btn-sm btn-primary" onclick="verPagosCredito('${c.id}','${clienteNombre}')" title="Ver pagos">💰</button>
                        ${telefono ? `<button class="btn btn-sm btn-success" onclick="enviarRecordatorioWA('${telefono}','${clienteNombre}','${fmtPrecio(saldo)}')" title="WhatsApp">📱</button>` : ''}
                    </div>
                </td>
            </tr>`;
        }).join('');

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#ef4444;">Error: ${err.message}</td></tr>`;
    }
}

// ==========================================
// MODAL: Historial de Pagos
// ==========================================
async function verPagosCredito(creditoId, clienteNombre) {
    const modal = document.getElementById('modalPagosCredito');
    modal.style.display = 'flex';
    document.getElementById('modalPagosTitulo').textContent = `Pagos — ${clienteNombre}`;

    const resumenDiv = document.getElementById('modalPagosResumen');
    const tbody = document.getElementById('tbodyModalPagos');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">⏳ Cargando...</td></tr>';

    try {
        const supabaseClient = window.supabaseClient || supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

        // Data del crédito
        const credito = _creditosCache.find(c => c.id === creditoId);

        // Pagos
        const { data: pagos, error } = await supabaseClient
            .from('pagos_credito')
            .select('*')
            .eq('credito_id', creditoId)
            .order('fecha_pago', { ascending: false });
        if (error) throw error;

        const totalPagado = (pagos || []).reduce((s, p) => s + parseFloat(p.monto_pagado || 0), 0);

        resumenDiv.innerHTML = `
            <div style="background:#f0fdf4;padding:1rem;border-radius:0.75rem;">
                <small style="color:#64748b;">Total Pagado</small>
                <h3 style="color:#16a34a;margin:0.25rem 0 0;">$${fmtPrecio(totalPagado)}</h3>
            </div>
            <div style="background:#fef2f2;padding:1rem;border-radius:0.75rem;">
                <small style="color:#64748b;">Saldo Pendiente</small>
                <h3 style="color:#ef4444;margin:0.25rem 0 0;">$${fmtPrecio(credito ? credito.saldo_pendiente : 0)}</h3>
            </div>
        `;

        if (!pagos || pagos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">Sin pagos registrados</td></tr>';
            return;
        }

        tbody.innerHTML = pagos.map(p => `
            <tr>
                <td>${p.numero_cuota}</td>
                <td>${fmtFecha(p.fecha_pago)}</td>
                <td style="font-weight:600;color:#16a34a;">$${fmtPrecio(p.monto_pagado)}</td>
                <td>${p.metodo_pago}</td>
                <td>${p.local || p.local_pago || '—'}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:#ef4444;">Error: ${err.message}</td></tr>`;
    }
}

function cerrarModalPagos() {
    document.getElementById('modalPagosCredito').style.display = 'none';
}

// ==========================================
// WHATSAPP RECORDATORIO
// ==========================================
function enviarRecordatorioWA(telefono, nombre, saldo) {
    const msg = `📌 Recordatorio MOTEROS SPORT LINE 🏍️\n\nEstimad@ ${nombre}, te recordamos que tienes un saldo pendiente de $${saldo} con Nosotros 😁\n\nRealiza tus abonos para seguir disfrutando de todos nuestros beneficios 🫶\n\nSi ya realizaste el pago, por favor ignora este mensaje. 🤗\n📲 Para más información contáctanos al 311 340 8416\n\nGracias por ser parte de la familia MOTEROS SPORT LINE! 🙌\n\nAtt.: Área de cartera.`;
    const url = `https://wa.me/57${telefono}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

// ==========================================
// CARTERA BODEGAS (prestamos_operativos)
// ==========================================
async function cargarCarteraBodegas() {
    const tbody = document.getElementById('tbodyCarteraBodegas');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">⏳ Cargando préstamos...</td></tr>';

    try {
        const supabaseClient = window.supabaseClient || supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        const { data, error } = await supabaseClient
            .from('prestamos_operativos')
            .select('*, compras_responsables(nombre)')
            .order('fecha_prestamo', { ascending: false });
        if (error) throw error;

        // KPI
        const activos = (data || []).filter(p => p.estado === 'Activo');
        const totalPrestado = activos.reduce((s, p) => s + parseFloat(p.valor_total || 0), 0);
        const kpi = document.getElementById('kpiPrestamosActivos');
        if (kpi) kpi.textContent = '$' + fmtPrecio(totalPrestado);

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;">Sin préstamos registrados</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(p => {
            const estadoColor = p.estado === 'Activo' ? 'background:#fef9c3;color:#a16207;' :
                p.estado === 'Devuelto' ? 'background:#dcfce7;color:#15803d;' :
                    'background:#e0e7ff;color:#4338ca;';

            const productoDetalle = p.id_producto + (p.talla ? `<br><small>${p.talla} / ${p.color || ''}</small>` : '');
            const registrado = p.nombre_registro || p.registrado_por || '—';
            const responsable = p.compras_responsables?.nombre || '<span style="color:#94a3b8">N/A</span>';

            return `<tr>
                <td>${fmtFecha(p.fecha_prestamo)}</td>
                <td><strong>${p.prestatario}</strong></td>
                <td>${productoDetalle}</td>
                <td>${p.cantidad}</td>
                <td style="font-weight:600;">$${fmtPrecio(p.valor_total)}</td>
                <td><span style="padding:3px 10px;border-radius:20px;font-size:0.8rem;${estadoColor}">${p.estado}</span></td>
                <td style="font-size:0.85rem;color:#64748b;">${registrado}</td>
                <td style="font-size:0.85rem;color:#475569;">${responsable}</td>
            </tr>`;
        }).join('');

        // Sincronizar también la tabla de la sección de préstamos si existe
        const tbodyPrestamos = document.getElementById('tbodyPrestamos');
        if (tbodyPrestamos) tbodyPrestamos.innerHTML = tbody.innerHTML;

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:#ef4444;">Error: ${err.message}</td></tr>`;
    }
}

// ==========================================
// CARTERA PASARELAS (Addi, Sistecrédito, Fodegas)
// ==========================================
async function cargarCarteraPasarela(metodo, prefix) {
    const tbodyId = 'tbodyCartera' + prefix;
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">⏳ Cargando ventas...</td></tr>';

    try {
        const supabaseClient = window.supabaseClient || supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

        // Buscar ventas con esa pasarela
        const { data: ventas, error } = await supabaseClient
            .from('ventas')
            .select('id_venta, nombre_producto, local, total, metodo_pago, created_at, pago_desglose, usuario')
            .ilike('metodo_pago', `%${metodo}%`)
            .eq('estado_venta', 'Completada')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const comisionPct = getComision(prefix.toLowerCase());
        let totalVendido = 0;

        const filas = (ventas || []).map(v => {
            // Para ventas multimétodo, extraer solo la parte de esta pasarela
            let totalPasarela = parseFloat(v.total || 0);
            if (v.pago_desglose && typeof v.pago_desglose === 'object') {
                const keys = Object.keys(v.pago_desglose);
                const matchKey = keys.find(k => k.toLowerCase().includes(metodo.toLowerCase()));
                if (matchKey) {
                    totalPasarela = parseFloat(v.pago_desglose[matchKey]) || totalPasarela;
                }
            }

            totalVendido += totalPasarela;
            const comision = totalPasarela * comisionPct;
            const neto = totalPasarela - comision;

            return `<tr>
                <td>${fmtFecha(v.created_at)}</td>
                <td>${v.nombre_producto || '—'}</td>
                <td>${v.local || '—'}</td>
                <td>$${fmtPrecio(totalPasarela)}</td>
                <td style="color:#ef4444;">-$${fmtPrecio(comision)}</td>
                <td style="color:#16a34a;font-weight:600;">$${fmtPrecio(neto)}</td>
                <td style="font-size:0.85rem;color:#64748b;">${v.usuario || '—'}</td>
            </tr>`;
        });

        // KPIs
        const comisionTotal = totalVendido * comisionPct;
        const netoTotal = totalVendido - comisionTotal;

        document.getElementById(`kpi${prefix}Total`).textContent = '$' + fmtPrecio(totalVendido);
        document.getElementById(`kpi${prefix}Comision`).textContent = '-$' + fmtPrecio(comisionTotal);
        document.getElementById(`kpi${prefix}Neto`).textContent = '$' + fmtPrecio(netoTotal);
        document.getElementById(`kpi${prefix}Ventas`).textContent = (ventas || []).length;

        if (filas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#94a3b8;">Sin ventas de ${metodo}</td></tr>`;
            return;
        }

        tbody.innerHTML = filas.join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:#ef4444;">Error: ${err.message}</td></tr>`;
    }
}


// ==========================================
// AUTENTICACIÓN PANEL OPERATIVO
// ==========================================

async function loginOperativo() {
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    const loginBtn = document.querySelector('.login-btn');
    const errorMsg = document.getElementById('loginError');

    if (!email || !password) {
        errorMsg.textContent = '📧 Ingresa correo y contraseña';
        errorMsg.style.display = 'block';
        return;
    }

    if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = 'Verificando...'; }
    errorMsg.style.display = 'none';

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;

        // Validar permisos en tabla administradores_sistema
        const { data: adminData, error: adminError } = await supabaseClient
            .from('administradores_sistema')
            .select('panel_acceso, activo')
            .eq('email', email.toLowerCase())
            .single();

        if (adminError || !adminData || !adminData.activo || (adminData.panel_acceso !== 'admin-administrativa' && adminData.panel_acceso !== 'ambos')) {
            await supabaseClient.auth.signOut(); // Desloguear inmediatamente
            throw new Error('No tienes permisos para acceder a la Central Operativa.');
        }

        // Si login exitoso, mostramos el panel:
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';

        // Intentar obtener el nombre si existe en administradores_sistema
        const { data: profile } = await supabaseClient.from('administradores_sistema').select('rol, nombre').eq('email', data.user.email).single();
        const greeting = document.querySelector('.user-greeting');
        if (greeting) {
            greeting.textContent = `👤 ${profile ? profile.nombre : 'Administradora'}`;
        }

        inicializarOperativo();

    } catch (err) {
        console.error('Error en login:', err);
        const msg = err.message === 'Invalid login credentials' ? 'Credenciales inválidas' : err.message;
        errorMsg.textContent = `❌ ${msg}`;
        errorMsg.style.display = 'block';
    } finally {
        if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'Iniciar Sesión'; }
    }
}

async function logoutOperativo() {
    await supabaseClient.auth.signOut();
    window.location.reload();
}

async function validarSesionOperativa() {
    // Evitar que esto interfiera si no estamos en admin-administrativa.html
    const loginScreen = document.getElementById('loginScreen');
    if (!loginScreen) return;

    document.getElementById('loadingOverlay').style.display = 'flex';

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'block';

            const { data: profile } = await supabaseClient.from('administradores_sistema').select('rol, nombre').eq('email', session.user.email).single();
            const greeting = document.querySelector('.user-greeting');
            if (greeting) {
                greeting.textContent = `👤 ${profile ? profile.nombre : 'Administradora'}`;
            }

            inicializarOperativo();
        } else {
            document.getElementById('loginScreen').style.display = 'flex';
        }
    } catch (error) {
        console.error("Error verificando sesión", error);
        document.getElementById('loginScreen').style.display = 'flex';
    } finally {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

// ==========================================
// GESTOR DE ROLES DE ADMINISTRADORES
// ==========================================

async function cargarAdministradores() {
    const tbody = document.getElementById('tbodyAdministradores');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando...</td></tr>';

    try {
        const { data, error } = await supabaseClient
            .from('administradores_sistema')
            .select('*')
            .order('activo', { ascending: false })
            .order('nombre', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay administradores registrados</td></tr>';
            return;
        }

        const html = data.map(admin => {
            const esActivo = admin.activo;
            const rowStyle = !esActivo ? 'opacity:0.6;background:#f8fafc;' : '';
            return `
                <tr style="${rowStyle}">
                    <td style="font-weight:600;">${admin.nombre}</td>
                    <td>${admin.email}</td>
                    <td><span class="badge ${admin.rol === 'Dueña' ? 'badge-primary' : 'badge-secondary'}">${admin.rol}</span></td>
                    <td>${admin.panel_acceso}</td>
                    <td>
                        <span style="color:${esActivo ? '#16a34a' : '#ef4444'};">
                            ${esActivo ? '🟢 Activo' : '🔴 Inactivo'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick='editarAdmin(${JSON.stringify(admin)})'>✏️ Editar</button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = html;
    } catch (err) {
        console.error('Error cargando admins:', err);
        tbody.innerHTML = `<tr><td colspan="6" style="color:red;text-align:center;">Error: ${err.message}</td></tr>`;
    }
}

function abrirModalNuevoAdmin() {
    document.getElementById('adminId').value = '';
    document.getElementById('adminNombre').value = '';
    document.getElementById('adminEmailForm').value = '';
    document.getElementById('adminEmailForm').disabled = false;
    document.getElementById('adminRol').value = 'Operativa';
    document.getElementById('adminPanelAcceso').value = 'admin-administrativa';
    document.getElementById('adminEstado').value = 'true';

    document.getElementById('tituloModalAdmin').textContent = '👥 Nuevo Administrador';
    document.getElementById('modalAdmin').style.display = 'flex';
}

function cerrarModalAdmin() {
    document.getElementById('modalAdmin').style.display = 'none';
}

function editarAdmin(adminParams) {
    document.getElementById('adminId').value = adminParams.id;
    document.getElementById('adminNombre').value = adminParams.nombre;
    document.getElementById('adminEmailForm').value = adminParams.email;
    document.getElementById('adminEmailForm').disabled = true; // No permitir cambiar correo facilmente
    document.getElementById('adminRol').value = adminParams.rol;
    document.getElementById('adminPanelAcceso').value = adminParams.panel_acceso;
    document.getElementById('adminEstado').value = adminParams.activo.toString();

    document.getElementById('tituloModalAdmin').textContent = '✏️ Editar Administrador';
    document.getElementById('modalAdmin').style.display = 'flex';
}

async function guardarAdmin() {
    const id = document.getElementById('adminId').value;
    const nombre = document.getElementById('adminNombre').value.trim();
    const email = document.getElementById('adminEmailForm').value.trim().toLowerCase();
    const rol = document.getElementById('adminRol').value;
    const panel_acceso = document.getElementById('adminPanelAcceso').value;
    const activo = document.getElementById('adminEstado').value === 'true';

    if (!nombre || !email) {
        showToast('Debes ingresar nombre y correo.', 'error');
        return;
    }

    try {
        if (id) {
            // Actualizar
            const { error } = await supabaseClient
                .from('administradores_sistema')
                .update({ nombre, rol, panel_acceso, activo })
                .eq('id', id);
            if (error) throw error;
            showToast('Administrador actualizado correctamente.', 'success');
        } else {
            // Insertar
            const { error } = await supabaseClient
                .from('administradores_sistema')
                .insert([{ email, nombre, rol, panel_acceso, activo }]);
            if (error) throw error;
            showToast('Nuevo administrador agregado.', 'success');
        }

        cerrarModalAdmin();
        cargarAdministradores();
    } catch (err) {
        console.error('Error guardando admin:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// Arrancar la validación de sesión cuando termine de cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    validarSesionOperativa();
});

// Exponer funciones necesarias al objeto global Window
window.loginOperativo = loginOperativo;
window.logoutOperativo = logoutOperativo;
window.abrirModalNuevoAdmin = abrirModalNuevoAdmin;
window.cerrarModalAdmin = cerrarModalAdmin;
window.editarAdmin = editarAdmin;
window.guardarAdmin = guardarAdmin;
window.cargarAdministradores = cargarAdministradores;
