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
    if (sectionId === 'resumen_operativo') cargarDatosResumen();
    if (sectionId === 'carteras_operativas') { cargarCarteraMoteros(); cargarCarteraBodegas(); }
    if (sectionId === 'prestamos_inventario') cargarCarteraBodegas();
    if (sectionId === 'gastos_operativos') cargarGastosOperativos();
    if (sectionId === 'documentos_legales') cargarDocumentosLegales();
    if (sectionId === 'admin_roles') cargarAdministradores();
    if (sectionId === 'predictor_stock') cargarPredictorStock();
    if (sectionId === 'simulador_rentabilidad') calcularSimulacion();
    if (sectionId === 'metas_ia') cargarMetasIA();

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

    // Cargar sección activa por defecto
    cargarDatosResumen();
});

// ==========================================
// RESUMEN OPERATIVO - KPIs en tiempo real
// ==========================================
let _resumenCache = { hoy: [], mes: [] };

async function cargarDatosResumen() {
    try {
        const supabaseClient = window.supabaseClient || supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        const hoy = new Date();
        const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();

        const [resHoy, resMes] = await Promise.all([
            supabaseClient.from('ventas').select('total, tienda, productos_vendidos, estado_venta')
                .gte('created_at', inicioHoy).eq('estado_venta', 'Completada'),
            supabaseClient.from('ventas').select('total, tienda, productos_vendidos, estado_venta')
                .gte('created_at', inicioMes).eq('estado_venta', 'Completada')
        ]);

        const ventasHoy = resHoy.data || [];
        const ventasMes = resMes.data || [];
        _resumenCache = { hoy: ventasHoy, mes: ventasMes };

        const totalHoy = ventasHoy.reduce((s, v) => s + parseFloat(v.total || 0), 0);
        const totalMes = ventasMes.reduce((s, v) => s + parseFloat(v.total || 0), 0);

        // Unidades vendidas hoy
        let unidadesHoy = 0;
        ventasHoy.forEach(v => {
            try {
                const prods = typeof v.productos_vendidos === 'string' ? JSON.parse(v.productos_vendidos) : v.productos_vendidos;
                (prods || []).forEach(p => unidadesHoy += (p.cantidad || 1));
            } catch (e) { unidadesHoy++; }
        });

        // Tiendas activas hoy
        const tiendasActivas = new Set(ventasHoy.map(v => v.tienda).filter(Boolean)).size;

        // Actualizar tarjetas
        const cards = document.getElementById('dashboardOperativoCards');
        if (cards) {
            cards.innerHTML = `
                <div class="stat-card" style="cursor:pointer;" onclick="mostrarDetalleKpi('ventas_dia')">
                    <div class="stat-icon orange">💰</div>
                    <div class="stat-info">
                        <h3>$${fmtPrecio(totalHoy)}</h3>
                        <p>Ventas del día</p>
                    </div>
                </div>
                <div class="stat-card" style="cursor:pointer;" onclick="mostrarDetalleKpi('unidades')">
                    <div class="stat-icon green">📦</div>
                    <div class="stat-info">
                        <h3>${unidadesHoy}</h3>
                        <p>Unidades vendidas</p>
                    </div>
                </div>
                <div class="stat-card" style="cursor:pointer;" onclick="mostrarDetalleKpi('tiendas')">
                    <div class="stat-icon blue">🏪</div>
                    <div class="stat-info">
                        <h3>${tiendasActivas}</h3>
                        <p>Tiendas activas</p>
                    </div>
                </div>
                <div class="stat-card" style="cursor:pointer;" onclick="mostrarDetalleKpi('ventas_mes')">
                    <div class="stat-icon purple">📈</div>
                    <div class="stat-info">
                        <h3>$${fmtPrecio(totalMes)}</h3>
                        <p>Ventas del mes</p>
                    </div>
                </div>
            `;
        }
    } catch (err) {
        console.error('Error cargando resumen:', err);
    }
}

function mostrarDetalleKpi(tipo) {
    const locales = ['Jordán', 'Alcalá', 'Local 01', 'Virtual', 'Evento'];
    const datos = tipo.includes('mes') ? _resumenCache.mes : _resumenCache.hoy;
    const periodo = tipo.includes('mes') ? 'Este Mes' : 'Hoy';

    let titulo, filas;

    if (tipo === 'ventas_dia' || tipo === 'ventas_mes') {
        titulo = tipo === 'ventas_dia' ? '💰 Ventas del Día por Local' : '📈 Ventas del Mes por Local';
        const totalGeneral = datos.reduce((s, v) => s + parseFloat(v.total || 0), 0);
        filas = locales.map(local => {
            const ventasLocal = datos.filter(v => v.tienda === local);
            const totalLocal = ventasLocal.reduce((s, v) => s + parseFloat(v.total || 0), 0);
            const pct = totalGeneral > 0 ? (totalLocal / totalGeneral * 100).toFixed(1) : 0;
            const cantOps = ventasLocal.length;
            return `<tr>
                <td style="padding:1.5rem 1rem; font-size:1.1rem;"><strong>${local}</strong></td>
                <td style="padding:1.5rem 1rem; font-weight:700; font-size:1.2rem; color:#1e293b;">$${fmtPrecio(totalLocal)}</td>
                <td style="padding:1.5rem 1rem; font-size:1.05rem; color:#475569;">${cantOps} ventas</td>
                <td style="padding:1.5rem 1rem;">
                    <div style="display:flex;align-items:center;gap:1rem;">
                        <span style="font-size:1.1rem;font-weight:700;color:#334155;min-width:60px;text-align:right;">${pct}%</span>
                        <div style="flex:1;background:#e2e8f0;border-radius:8px;height:16px;overflow:hidden;min-width:150px;">
                            <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#f97316,#ea580c);border-radius:8px;"></div>
                        </div>
                    </div>
                </td>
            </tr>`;
        }).join('');
    } else if (tipo === 'unidades') {
        titulo = '📦 Unidades Vendidas Hoy por Local';
        filas = locales.map(local => {
            const ventasLocal = datos.filter(v => v.tienda === local);
            let unidades = 0;
            ventasLocal.forEach(v => {
                try {
                    const prods = typeof v.productos_vendidos === 'string' ? JSON.parse(v.productos_vendidos) : v.productos_vendidos;
                    (prods || []).forEach(p => unidades += (p.cantidad || 1));
                } catch (e) { unidades++; }
            });
            return `<tr>
                <td style="padding:1.5rem 1rem; font-size:1.1rem;"><strong>${local}</strong></td>
                <td style="padding:1.5rem 1rem; font-weight:700; font-size:1.2rem; color:#1e293b;">${unidades} uds</td>
                <td style="padding:1.5rem 1rem; font-size:1.05rem; color:#475569;">${ventasLocal.length} ventas</td>
                <td style="padding:1.5rem 1rem; font-weight:600; font-size:1.1rem;">$${fmtPrecio(ventasLocal.reduce((s, v) => s + parseFloat(v.total || 0), 0))}</td>
            </tr>`;
        }).join('');
    } else {
        titulo = '🏪 Detalle de Tiendas Activas Hoy';
        filas = locales.map(local => {
            const ventasLocal = datos.filter(v => v.tienda === local);
            const totalLocal = ventasLocal.reduce((s, v) => s + parseFloat(v.total || 0), 0);
            const activa = ventasLocal.length > 0;
            return `<tr style="${activa ? '' : 'opacity:0.6;'}">
                <td style="padding:1.5rem 1rem; font-size:1.1rem;"><strong>${local}</strong></td>
                <td style="padding:1.5rem 1rem; font-size:1.1rem;">${activa ? '<span style="color:#22c55e;font-weight:700;background:#dcfce7;padding:0.4rem 0.8rem;border-radius:2rem;">🟢 Activa</span>' : '<span style="color:#94a3b8;background:#f1f5f9;padding:0.4rem 0.8rem;border-radius:2rem;">⚪ Sin ventas</span>'}</td>
                <td style="padding:1.5rem 1rem; font-size:1.05rem; color:#475569;">${ventasLocal.length} operaciones</td>
                <td style="padding:1.5rem 1rem; font-weight:700; font-size:1.2rem; color:#1e293b;">$${fmtPrecio(totalLocal)}</td>
            </tr>`;
        }).join('');
    }

    // Crear modal
    const existing = document.getElementById('modalDetalleKpi');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modalDetalleKpi';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.innerHTML = `
        <div style="background:white;border-radius:1.5rem;max-width:950px;width:100%;max-height:85vh;overflow-y:auto;padding:2.5rem;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem;">
                <h3 style="margin:0;font-size:1.8rem;color:#0f172a;font-weight:800;">${titulo}</h3>
                <button onclick="document.getElementById('modalDetalleKpi').remove()" style="background:#f1f5f9;border:none;border-radius:50%;width:40px;height:40px;font-size:1.2rem;cursor:pointer;color:#64748b;display:flex;align-items:center;justify-content:center;transition:0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">✕</button>
            </div>
            <p style="color:#64748b;margin-bottom:1.5rem;font-size:1.1rem;">📅 Periodo: <strong style="color:#334155;">${periodo}</strong></p>
            <div class="table-container" style="border-radius:1rem;overflow:hidden;border:1px solid #e2e8f0;">
                <table class="data-table" style="width:100%;border-collapse:collapse;">
                    <thead style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                        <tr>
                            <th style="padding:1.2rem 1rem;font-size:1.05rem;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">Local</th>
                            <th style="padding:1.2rem 1rem;font-size:1.05rem;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">${tipo.includes('unidades') ? 'Unidades' : 'Total'}</th>
                            <th style="padding:1.2rem 1rem;font-size:1.05rem;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">Operaciones</th>
                            <th style="padding:1.2rem 1rem;font-size:1.05rem;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">${tipo.includes('ventas') ? '% Participación' : tipo === 'unidades' ? 'Ingresos' : 'Estado'}</th>
                        </tr>
                    </thead>
                    <tbody style="border-top:none;">${filas}</tbody>
                </table>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}


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
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando gastos...</td></tr>';

    try {
        const supabaseClient = window.supabaseClient || supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

        const { data, error } = await supabaseClient
            .from('gastos_tienda')
            .select('id, fecha_gasto, monto, descripcion, categoria_id, cuenta_id, local, registrado_por, metodo_pago')
            .order('fecha_gasto', { ascending: false })
            .limit(50);

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">No hay gastos recientes registrados.</td></tr>';
            return;
        }

        // Cargar categorías y cuentas en paralelo para mapear
        const [catRes, cuentaRes] = await Promise.all([
            supabaseClient.from('categorias_gastos').select('id, nombre'),
            supabaseClient.from('cuentas_bancarias').select('id, banco, nombre_titular')
        ]);

        const catMap = {};
        (catRes.data || []).forEach(c => catMap[c.id] = c.nombre);
        const cuentaMap = {};
        (cuentaRes.data || []).forEach(c => cuentaMap[c.id] = `${c.banco} - ${c.nombre_titular || ''}`);

        tbody.innerHTML = data.map(g => {
            let cuentaText = '<span style="color:#94a3b8;">Sin cuenta vinculada</span>';
            if (g.cuenta_id && cuentaMap[g.cuenta_id]) {
                cuentaText = cuentaMap[g.cuenta_id];
            } else if (g.cuenta_id) {
                cuentaText = `Cuenta: ${g.cuenta_id.substring(0, 8)}...`;
            }

            const catText = g.categoria_id && catMap[g.categoria_id] ? catMap[g.categoria_id] : (g.local || 'Sin Categoría');

            return `
            <tr>
                <td>${g.fecha_gasto ? new Date(g.fecha_gasto).toLocaleDateString() : '—'}</td>
                <td><span class="badge" style="background:#f1f5f9;color:#475569;">${catText}</span></td>
                <td style="color:var(--danger); font-weight:bold;">$${parseFloat(g.monto || 0).toLocaleString()}</td>
                <td>${cuentaText}</td>
                <td>${g.descripcion || '-'}</td>
            </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Error cargando gastos:', err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Error cargando datos: ' + err.message + '</td></tr>';
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
            categoria_id: parseInt(categoria_id),
            monto: parseFloat(monto),
            cuenta_id: cuenta_id,
            descripcion: desc,
            fecha_gasto: new Date().toISOString().split('T')[0],
            registrado_por: 'Administradora Operativa',
            local: 'Virtual / Operativa'
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
        if (typeof cargarDatosResumen === 'function') cargarDatosResumen();
    }
    if (seccion === 'carteras_operativas') {
        cargarCarteraMoteros();
        cargarCarteraBodegas();
    }
    if (seccion === 'prestamos_inventario') {
        cargarCarteraBodegas();
    }
    if (seccion === 'gastos_operativos') {
        cargarGastosOperativos();
    }
    if (seccion === 'documentos_legales') {
        cargarDocumentosLegales();
    }
    if (seccion === 'admin_roles') {
        cargarAdministradores();
    }
    if (seccion === 'predictor_stock') {
        cargarPredictorStock();
    }
    if (seccion === 'simulador_rentabilidad') {
        calcularSimulacion();
    }
    if (seccion === 'metas_ia') {
        cargarMetasIA();
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
    cargarDocumentosLegales();
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
            .select('*')
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
            const responsable = p.registrado_por || '<span style="color:#94a3b8">N/A</span>';

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

// ==========================================
// MÓDULO IA: PREDICTOR DE STOCK
// ==========================================
async function cargarPredictorStock() {
    const tbody = document.getElementById('tbodyStockPredictor');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">⏳ Analizando inventario...</td></tr>';

    try {
        const supabaseClient = window.supabaseClient || supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

        // Traer inventario de TODAS las sedes en paralelo
        const [invAlcala, inv01, invJordan, invDigital, invEvento, invCentral] = await Promise.all([
            supabaseClient.from('inventario_alcala').select('id_producto, cantidad'),
            supabaseClient.from('inventario_01').select('id_producto, cantidad'),
            supabaseClient.from('inventario_jordan').select('id_producto, cantidad'),
            supabaseClient.from('inventario_digital').select('id_producto, cantidad'),
            supabaseClient.from('inventario_evento').select('id_producto, cantidad'),
            supabaseClient.from('inventario').select('producto_id, cantidad') // tabla unificada usa producto_id
        ]);

        // Traer productos
        const { data: productos, error: errProd } = await supabaseClient
            .from('productos')
            .select('id, id_producto, nombre, marca')
            .eq('estado', 'Activo');
        if (errProd) throw errProd;

        // Agrupar stock total por producto
        const stockMap = {};
        const sumarStock = (data, pIdClave = 'id_producto') => {
            (data || []).forEach(inv => {
                const pid = inv[pIdClave];
                if (pid) stockMap[pid] = (stockMap[pid] || 0) + (inv.cantidad || 0);
            });
        };

        sumarStock(invAlcala.data);
        sumarStock(inv01.data);
        sumarStock(invJordan.data);
        sumarStock(invDigital.data);
        sumarStock(invEvento.data);
        sumarStock(invCentral.data, 'producto_id'); // tabla central usa otro nombre de columna

        // Ventas de los últimos 30 días para velocidad de venta
        const hace30d = new Date();
        hace30d.setDate(hace30d.getDate() - 30);
        const { data: ventas, error: errVentas } = await supabaseClient
            .from('ventas')
            .select('productos_vendidos')
            .gte('created_at', hace30d.toISOString())
            .eq('estado_venta', 'Completada');

        const ventasMap = {};
        (ventas || []).forEach(v => {
            try {
                const prods = typeof v.productos_vendidos === 'string' ? JSON.parse(v.productos_vendidos) : v.productos_vendidos;
                (prods || []).forEach(p => {
                    const pid = p.id_producto || p.id;
                    if (pid) ventasMap[pid] = (ventasMap[pid] || 0) + (p.cantidad || 1);
                });
            } catch (e) { /* skip */ }
        });

        // Construir análisis
        const analisis = (productos || []).map(p => {
            const stock = stockMap[p.id_producto] || 0;
            const vendidos30d = ventasMap[p.id_producto] || 0;
            const velocidadDia = vendidos30d / 30;
            const diasRestantes = velocidadDia > 0 ? Math.round(stock / velocidadDia) : (stock > 0 ? 999 : 0);

            let nivel, semaforo, estiloBg;
            if (stock === 0) {
                nivel = 'agotado'; semaforo = '⛔'; estiloBg = 'background:rgba(239,68,68,0.12);';
            } else if (stock <= 2) {
                nivel = 'critico'; semaforo = '🚨'; estiloBg = 'background:rgba(239,68,68,0.08);';
            } else if (stock <= 5) {
                nivel = 'bajo'; semaforo = '⚠️'; estiloBg = 'background:rgba(245,158,11,0.08);';
            } else {
                nivel = 'normal'; semaforo = '✅'; estiloBg = '';
            }

            let recomendacion = '';
            if (stock === 0) recomendacion = '<span style="color:#ef4444;font-weight:bold;">⚡ Reabastecer YA</span>';
            else if (diasRestantes <= 7 && velocidadDia > 0) recomendacion = '<span style="color:#ef4444;">Pedir urgente</span>';
            else if (diasRestantes <= 15 && velocidadDia > 0) recomendacion = '<span style="color:#f59e0b;">Planificar compra</span>';
            else if (velocidadDia === 0 && stock > 0) recomendacion = '<span style="color:#94a3b8;">Sin movimiento</span>';
            else recomendacion = '<span style="color:#22c55e;">OK</span>';

            return { ...p, stock, vendidos30d, velocidadDia, diasRestantes, nivel, semaforo, estiloBg, recomendacion };
        });

        // Ordenar: agotados primero, luego críticos, luego bajos
        analisis.sort((a, b) => {
            const orden = { agotado: 0, critico: 1, bajo: 2, normal: 3 };
            return (orden[a.nivel] || 3) - (orden[b.nivel] || 3) || a.diasRestantes - b.diasRestantes;
        });

        // KPIs
        const el = id => document.getElementById(id);
        const agotados = analisis.filter(a => a.nivel === 'agotado').length;
        const criticos = analisis.filter(a => a.nivel === 'critico').length;
        const bajos = analisis.filter(a => a.nivel === 'bajo').length;
        const normales = analisis.filter(a => a.nivel === 'normal').length;
        if (el('kpiStockCritico')) el('kpiStockCritico').textContent = criticos;
        if (el('kpiStockBajo')) el('kpiStockBajo').textContent = bajos;
        if (el('kpiStockNormal')) el('kpiStockNormal').textContent = normales;
        if (el('kpiStockAgotado')) el('kpiStockAgotado').textContent = agotados;

        // Filtrar
        const filtro = document.getElementById('filtroStockAlerta')?.value || 'todos';
        let filtrados = analisis;
        if (filtro === 'critico') filtrados = analisis.filter(a => a.nivel === 'agotado' || a.nivel === 'critico');
        else if (filtro === 'bajo') filtrados = analisis.filter(a => a.nivel !== 'normal');

        if (filtrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#22c55e;">✅ Todos los productos tienen stock adecuado.</td></tr>';
            return;
        }

        tbody.innerHTML = filtrados.map(a => `
            <tr style="${a.estiloBg}">
                <td style="text-align:center;font-size:1.2rem;">${a.semaforo}</td>
                <td><strong>${a.nombre}</strong></td>
                <td>${a.marca || '—'}</td>
                <td style="font-weight:600;${a.stock <= 2 ? 'color:#ef4444;' : ''}">${a.stock}</td>
                <td>${a.vendidos30d}</td>
                <td>${a.velocidadDia.toFixed(1)}/día</td>
                <td>${a.diasRestantes >= 999 ? '∞' : a.diasRestantes + 'd'}</td>
                <td>${a.recomendacion}</td>
            </tr>`).join('');

    } catch (err) {
        console.error('Error predictor stock:', err);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:red;">Error: ' + err.message + '</td></tr>';
    }
}

// ==========================================
// MÓDULO IA: SIMULADOR DE RENTABILIDAD
// ==========================================
function calcularSimulacion() {
    const ingreso = parseFloat(document.getElementById('simIngresoBase')?.value) || 0;
    const costoPct = parseFloat(document.getElementById('simCostoPct')?.value) || 55;
    const descuentoPct = parseFloat(document.getElementById('simDescuentoPct')?.value) || 0;
    const volumenPct = parseFloat(document.getElementById('simVolumenPct')?.value) || 0;
    const gastosFijos = parseFloat(document.getElementById('simGastosFijos')?.value) || 0;

    const ingresoAjustado = ingreso * (1 + volumenPct / 100) * (1 - descuentoPct / 100);
    const costo = ingresoAjustado * (costoPct / 100);
    const margen = ingresoAjustado - costo;
    const utilidad = margen - gastosFijos;
    const margenPct = ingresoAjustado > 0 ? (margen / ingresoAjustado * 100) : 0;
    const utilidadPct = ingresoAjustado > 0 ? (utilidad / ingresoAjustado * 100) : 0;

    const fmt = n => '$' + Math.round(n).toLocaleString('es-CO');
    const el = id => document.getElementById(id);

    if (el('simResultIngreso')) el('simResultIngreso').textContent = fmt(ingresoAjustado);
    if (el('simResultCosto')) el('simResultCosto').textContent = fmt(costo);
    if (el('simResultMargen')) el('simResultMargen').textContent = fmt(margen);
    if (el('simResultMargenPct')) el('simResultMargenPct').textContent = margenPct.toFixed(1) + '%';
    if (el('simResultUtilidad')) el('simResultUtilidad').textContent = fmt(utilidad);
    if (el('simResultUtilidadPct')) el('simResultUtilidadPct').textContent = utilidadPct.toFixed(1) + '%';

    const box = el('simResultUtilidadBox');
    if (box) {
        if (utilidad >= 0) {
            box.style.background = 'linear-gradient(135deg,#f0fdf4,#bbf7d0)';
            el('simResultUtilidad').style.color = '#15803d';
            el('simResultUtilidadLabel').style.color = '#15803d';
            el('simResultUtilidadPct').style.color = '#16a34a';
        } else {
            box.style.background = 'linear-gradient(135deg,#fef2f2,#fecaca)';
            el('simResultUtilidad').style.color = '#dc2626';
            el('simResultUtilidadLabel').style.color = '#dc2626';
            el('simResultUtilidadPct').style.color = '#ef4444';
        }
    }
}

// ==========================================
// MÓDULO IA: METAS INTELIGENTES
// ==========================================
async function cargarMetasIA() {
    try {
        const supabaseClient = window.supabaseClient || supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        const hoy = new Date();
        const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0);

        // Ventas mes anterior
        const { data: ventasAnterior } = await supabaseClient
            .from('ventas')
            .select('total, tienda')
            .gte('created_at', inicioMesAnterior.toISOString())
            .lte('created_at', finMesAnterior.toISOString())
            .eq('estado_venta', 'Completada');

        // Ventas mes actual
        const { data: ventasActual } = await supabaseClient
            .from('ventas')
            .select('total, tienda')
            .gte('created_at', inicioMesActual.toISOString())
            .eq('estado_venta', 'Completada');

        const totalAnterior = (ventasAnterior || []).reduce((s, v) => s + parseFloat(v.total || 0), 0);
        const totalActual = (ventasActual || []).reduce((s, v) => s + parseFloat(v.total || 0), 0);

        // Meta sugerida: +10% sobre mes anterior (mínimo $5M)
        const metaMensual = Math.max(totalAnterior * 1.10, 5000000);
        const diasDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
        const metaDiaria = metaMensual / diasDelMes;
        const cumplimiento = metaMensual > 0 ? (totalActual / metaMensual * 100) : 0;

        const el = id => document.getElementById(id);
        if (el('kpiMetaMensual')) el('kpiMetaMensual').textContent = '$' + fmtPrecio(metaMensual);
        if (el('kpiMetaDiaria')) el('kpiMetaDiaria').textContent = '$' + fmtPrecio(metaDiaria);
        if (el('kpiVentaActualMes')) el('kpiVentaActualMes').textContent = '$' + fmtPrecio(totalActual);
        if (el('kpiCumplimientoMeta')) el('kpiCumplimientoMeta').textContent = Math.min(cumplimiento, 999).toFixed(1) + '%';

        // Barra de progreso
        const barra = el('barraProgresoMeta');
        if (barra) {
            const pct = Math.min(cumplimiento, 100);
            barra.style.width = pct + '%';
            barra.textContent = pct.toFixed(0) + '%';
            if (pct >= 100) barra.style.background = 'linear-gradient(90deg,#16a34a,#15803d)';
            else if (pct >= 70) barra.style.background = 'linear-gradient(90deg,#22c55e,#16a34a)';
            else if (pct >= 40) barra.style.background = 'linear-gradient(90deg,#eab308,#f59e0b)';
            else barra.style.background = 'linear-gradient(90deg,#ef4444,#f97316)';
        }
        if (el('metaBarraLabel')) el('metaBarraLabel').textContent = 'Meta: $' + fmtPrecio(metaMensual);

        // Desglose por local
        const locales = ['Jordán', 'Alcalá', 'Local 01', 'Virtual'];
        const tbody = document.getElementById('tbodyMetasLocal');
        if (tbody) {
            const filas = locales.map(local => {
                const ventaLocAnterior = (ventasAnterior || []).filter(v => v.tienda === local).reduce((s, v) => s + parseFloat(v.total || 0), 0);
                const ventaLocActual = (ventasActual || []).filter(v => v.tienda === local).reduce((s, v) => s + parseFloat(v.total || 0), 0);
                const metaLoc = Math.max(ventaLocAnterior * 1.10, 1000000);
                const cumplLoc = metaLoc > 0 ? (ventaLocActual / metaLoc * 100) : 0;

                let estadoBadge;
                if (cumplLoc >= 100) estadoBadge = '<span style="padding:3px 10px;border-radius:20px;font-size:0.8rem;background:#dcfce7;color:#15803d;">🏆 Cumplida</span>';
                else if (cumplLoc >= 70) estadoBadge = '<span style="padding:3px 10px;border-radius:20px;font-size:0.8rem;background:#fef9c3;color:#a16207;">📈 En camino</span>';
                else estadoBadge = '<span style="padding:3px 10px;border-radius:20px;font-size:0.8rem;background:#fef2f2;color:#dc2626;">⚠️ Atrasada</span>';

                return `<tr>
                    <td><strong>${local}</strong></td>
                    <td>$${fmtPrecio(ventaLocAnterior)}</td>
                    <td style="font-weight:600;">$${fmtPrecio(metaLoc)}</td>
                    <td>$${fmtPrecio(ventaLocActual)}</td>
                    <td style="font-weight:600;color:${cumplLoc >= 70 ? '#22c55e' : '#f59e0b'}">${cumplLoc.toFixed(1)}%</td>
                    <td>${estadoBadge}</td>
                </tr>`;
            }).join('');
            tbody.innerHTML = filas;
        }

    } catch (err) {
        console.error('Error cargando metas IA:', err);
    }
}

// ==========================================
// MÓDULO: DOCUMENTOS LEGALES
// ==========================================
let _documentosCache = [];

async function cargarDocumentosLegales() {
    const tbody = document.getElementById('tbodyDocumentosLegales');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">⏳ Cargando documentos...</td></tr>';

    try {
        const supabaseClient = window.supabaseClient || supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

        let query = supabaseClient
            .from('documentos_legales')
            .select('*')
            .order('fecha_vencimiento', { ascending: true });

        // Filtro por sede
        const filtroSede = document.getElementById('filtroDocSede');
        if (filtroSede && filtroSede.value) {
            query = query.eq('sede', filtroSede.value);
        }

        const { data: docs, error } = await query;
        if (error) throw error;

        _documentosCache = docs || [];
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        // Clasificar documentos
        let vigentes = 0, proximos = 0, vencidos = 0;

        const clasificados = (docs || []).map(d => {
            const venc = new Date(d.fecha_vencimiento + 'T00:00:00');
            const diffMs = venc - hoy;
            const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            const alertaDias = d.alertar_dias_antes || 30;

            let estado, semaforo, estiloBg;
            if (diasRestantes < 0) {
                estado = 'vencido';
                semaforo = '🔴';
                estiloBg = 'background:rgba(239,68,68,0.08);';
                vencidos++;
            } else if (diasRestantes <= alertaDias) {
                estado = 'proximo';
                semaforo = '🟡';
                estiloBg = 'background:rgba(245,158,11,0.08);';
                proximos++;
            } else {
                estado = 'vigente';
                semaforo = '🟢';
                estiloBg = '';
                vigentes++;
            }

            return { ...d, diasRestantes, estado_calc: estado, semaforo, estiloBg };
        });

        // Filtro por estado (después de clasificar)
        const filtroEstado = document.getElementById('filtroDocEstado');
        let filtrados = clasificados;
        if (filtroEstado && filtroEstado.value) {
            filtrados = clasificados.filter(d => d.estado_calc === filtroEstado.value);
        }

        // KPIs
        const el = id => document.getElementById(id);
        if (el('kpiDocsVigentes')) el('kpiDocsVigentes').textContent = vigentes;
        if (el('kpiDocsProximos')) el('kpiDocsProximos').textContent = proximos;
        if (el('kpiDocsVencidos')) el('kpiDocsVencidos').textContent = vencidos;
        if (el('kpiDocsTotal')) el('kpiDocsTotal').textContent = (docs || []).length;

        // Renderizar tabla
        if (filtrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#94a3b8;">No se encontraron documentos.</td></tr>';
            return;
        }

        tbody.innerHTML = filtrados.map(d => {
            const diasTexto = d.diasRestantes < 0
                ? `<span style="color:#ef4444;font-weight:bold;">${Math.abs(d.diasRestantes)} días vencido</span>`
                : d.diasRestantes === 0
                    ? `<span style="color:#f59e0b;font-weight:bold;">Vence HOY</span>`
                    : `<span style="color:${d.diasRestantes <= (d.alertar_dias_antes || 30) ? '#f59e0b' : '#22c55e'};font-weight:${d.diasRestantes <= (d.alertar_dias_antes || 30) ? 'bold' : 'normal'};">${d.diasRestantes} días</span>`;

            const archivoBtn = d.archivo_url
                ? `<a href="${d.archivo_url}" target="_blank" class="btn btn-secondary btn-sm" style="font-size:0.75rem;">📎 Ver</a>`
                : '<span style="color:#94a3b8;font-size:0.8rem;">—</span>';

            return `
            <tr style="${d.estiloBg}">
                <td style="text-align:center;font-size:1.2rem;">${d.semaforo}</td>
                <td><strong>${d.nombre_documento}</strong></td>
                <td>${d.entidad || '—'}</td>
                <td><span class="badge" style="background:#f1f5f9;color:#475569;">${d.sede}</span></td>
                <td>${fmtFecha(d.fecha_expedicion)}</td>
                <td>${fmtFecha(d.fecha_vencimiento)}</td>
                <td>${diasTexto}</td>
                <td>${archivoBtn}</td>
                <td>
                    <div style="display:flex;gap:0.3rem;">
                        <button class="btn btn-secondary btn-sm" onclick="editarDocumento('${d.id}')" title="Editar" style="font-size:0.75rem;">✏️</button>
                        <button class="btn btn-secondary btn-sm" onclick="eliminarDocumento('${d.id}','${d.nombre_documento.replace(/'/g, "\\'")}')" title="Eliminar" style="font-size:0.75rem;color:#ef4444;">🗑️</button>
                    </div>
                </td>
            </tr>`;
        }).join('');

    } catch (err) {
        console.error('Error cargando documentos legales:', err);
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:red;">Error al cargar documentos.</td></tr>';
    }
}

function abrirModalDocumento() {
    document.getElementById('documentoId').value = '';
    document.getElementById('documentoNombre').value = '';
    document.getElementById('documentoEntidad').value = '';
    document.getElementById('documentoSede').value = '';
    document.getElementById('documentoExpedicion').value = '';
    document.getElementById('documentoVencimiento').value = '';
    document.getElementById('documentoAlertaDias').value = '30';
    document.getElementById('documentoArchivo').value = '';
    limpiarArchivoDoc();
    document.getElementById('tituloModalDocumento').textContent = '📄 Nuevo Documento Legal';
    document.getElementById('modalDocumentoLegal').style.display = 'flex';
}

function cerrarModalDocumento() {
    document.getElementById('modalDocumentoLegal').style.display = 'none';
}

// --- File Upload Helpers ---
function previsualizarArchivoDoc(input) {
    const file = input.files[0];
    if (!file) return;

    const preview = document.getElementById('previewArchivoDoc');
    const img = document.getElementById('previewImgDoc');
    const nombre = document.getElementById('previewNombreDoc');
    const tamano = document.getElementById('previewTamanoDoc');

    nombre.textContent = file.name;
    tamano.textContent = (file.size / 1024).toFixed(1) + ' KB';

    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => { img.src = e.target.result; img.style.display = 'block'; };
        reader.readAsDataURL(file);
    } else {
        img.src = '';
        img.style.display = 'none';
        nombre.textContent = '📄 ' + file.name;
    }
    preview.style.display = 'block';
}

function limpiarArchivoDoc() {
    const fileInput = document.getElementById('documentoArchivoFile');
    if (fileInput) fileInput.value = '';
    const preview = document.getElementById('previewArchivoDoc');
    if (preview) preview.style.display = 'none';
}

async function subirArchivoDocumento(file) {
    const supabaseClient = window.supabaseClient || supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    const ext = file.name.split('.').pop();
    const nombreArchivo = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
    const path = `documentos/${nombreArchivo}`;

    const { data, error } = await supabaseClient.storage
        .from('documentos_legales')
        .upload(path, file, { cacheControl: '3600', upsert: false });

    if (error) throw new Error('Error subiendo archivo: ' + error.message);

    const { data: urlData } = supabaseClient.storage
        .from('documentos_legales')
        .getPublicUrl(path);

    return urlData.publicUrl;
}

function editarDocumento(id) {
    const doc = _documentosCache.find(d => d.id === id);
    if (!doc) { showToast('Documento no encontrado', 'error'); return; }

    document.getElementById('documentoId').value = doc.id;
    document.getElementById('documentoNombre').value = doc.nombre_documento;
    document.getElementById('documentoEntidad').value = doc.entidad || '';
    document.getElementById('documentoSede').value = doc.sede;
    document.getElementById('documentoExpedicion').value = doc.fecha_expedicion;
    document.getElementById('documentoVencimiento').value = doc.fecha_vencimiento;
    document.getElementById('documentoAlertaDias').value = doc.alertar_dias_antes || 30;
    document.getElementById('documentoArchivo').value = doc.archivo_url || '';
    limpiarArchivoDoc();
    document.getElementById('tituloModalDocumento').textContent = '✏️ Editar Documento Legal';
    document.getElementById('modalDocumentoLegal').style.display = 'flex';
}

async function guardarDocumentoLegal() {
    const id = document.getElementById('documentoId').value;
    const nombre = document.getElementById('documentoNombre').value.trim();
    const entidad = document.getElementById('documentoEntidad').value.trim();
    const sede = document.getElementById('documentoSede').value;
    const expedicion = document.getElementById('documentoExpedicion').value;
    const vencimiento = document.getElementById('documentoVencimiento').value;
    const alertaDias = parseInt(document.getElementById('documentoAlertaDias').value) || 30;
    let archivo = document.getElementById('documentoArchivo').value.trim();

    // Validaciones
    if (!nombre || !sede || !expedicion || !vencimiento) {
        showToast('Nombre, Sede, Fecha Expedición y Vencimiento son obligatorios.', 'error');
        return;
    }

    if (new Date(vencimiento) <= new Date(expedicion)) {
        showToast('La fecha de vencimiento debe ser posterior a la de expedición.', 'error');
        return;
    }

    // Si hay archivo seleccionado, subirlo primero
    const fileInput = document.getElementById('documentoArchivoFile');
    if (fileInput && fileInput.files && fileInput.files[0]) {
        try {
            showToast('📤 Subiendo archivo...', 'info');
            archivo = await subirArchivoDocumento(fileInput.files[0]);
        } catch (uploadErr) {
            console.error('Upload error:', uploadErr);
            showToast('Error al subir archivo: ' + uploadErr.message, 'error');
            return;
        }
    }

    const registro = {
        nombre_documento: nombre,
        entidad: entidad || null,
        sede: sede,
        fecha_expedicion: expedicion,
        fecha_vencimiento: vencimiento,
        alertar_dias_antes: alertaDias,
        archivo_url: archivo || null,
        actualizado_por: window.adminNombre || 'Administradora Operativa'
    };

    // Calcular estado basado en fecha
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const venc = new Date(vencimiento + 'T00:00:00');
    const diasRestantes = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
    registro.estado = diasRestantes < 0 ? 'Vencido' : diasRestantes <= alertaDias ? 'Por Vencer' : 'Vigente';

    try {
        const supabaseClient = window.supabaseClient || supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

        if (id) {
            // Actualizar
            const { error } = await supabaseClient
                .from('documentos_legales')
                .update(registro)
                .eq('id', id);
            if (error) throw error;
            showToast('✅ Documento actualizado correctamente.', 'success');
        } else {
            // Insertar
            const { error } = await supabaseClient
                .from('documentos_legales')
                .insert([registro]);
            if (error) throw error;
            showToast('✅ Documento registrado correctamente.', 'success');
        }

        cerrarModalDocumento();
        cargarDocumentosLegales();

    } catch (err) {
        console.error('Error guardando documento:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

async function eliminarDocumento(id, nombre) {
    if (!confirm(`¿Estás segura de eliminar el documento "${nombre}"?\n\nEsta acción no se puede deshacer.`)) return;

    try {
        const supabaseClient = window.supabaseClient || supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        const { error } = await supabaseClient
            .from('documentos_legales')
            .delete()
            .eq('id', id);
        if (error) throw error;

        showToast('🗑️ Documento eliminado.', 'info');
        cargarDocumentosLegales();
    } catch (err) {
        console.error('Error eliminando documento:', err);
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
window.abrirModalDocumento = abrirModalDocumento;
window.cerrarModalDocumento = cerrarModalDocumento;
window.editarDocumento = editarDocumento;
window.guardarDocumentoLegal = guardarDocumentoLegal;
window.eliminarDocumento = eliminarDocumento;
window.cargarDocumentosLegales = cargarDocumentosLegales;
window.previsualizarArchivoDoc = previsualizarArchivoDoc;
window.limpiarArchivoDoc = limpiarArchivoDoc;
window.cargarPredictorStock = cargarPredictorStock;
window.calcularSimulacion = calcularSimulacion;
window.cargarMetasIA = cargarMetasIA;
window.mostrarDetalleKpi = mostrarDetalleKpi;
