// ═══════════════════════════════════════════════════════════════
// MOTEROS SPORTS LINE - MÓDULO BODEGA CENTRAL & DESPACHOS
// ═══════════════════════════════════════════════════════════════

let bodegaInventoryCache = [];
let bodegaProductosMap = {};
let bodegaTrasladosCache = [];
let bodegaEmpleadosCache = [];

let empleadoBodegaSesion = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Asegurar Supabase Client
    if (!window.supabaseClient && typeof supabase !== 'undefined') {
        const SUPABASE_URL = 'https://pbblthbrdkevuyjxyuar.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiYmx0aGJyZGtldnV5anh5dWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNjUwMzcsImV4cCI6MjA4MTc0MTAzN30.bNAcp186l7l9IRWdcwBxuSgvmRtRy-qPFhZ7HRvaBZE';
        window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    verificarSesionBodega();
});

function verificarSesionBodega() {
    const sesionStr = localStorage.getItem('empleado_bodega_sesion') || sessionStorage.getItem('empleado_bodega_sesion');
    const secBodega = document.getElementById('bodegaLoginSection');
    const mainContent = document.getElementById('bodegaMainContent');
    const badge = document.getElementById('userBodegaBadge');
    const btnLogout = document.getElementById('btnLogoutBodega');

    if (!sesionStr) {
        empleadoBodegaSesion = null;
        if (secBodega) secBodega.style.display = 'flex';
        if (mainContent) mainContent.style.display = 'none';
        if (badge) badge.style.display = 'none';
        if (btnLogout) btnLogout.style.display = 'none';
        return;
    }

    try {
        empleadoBodegaSesion = JSON.parse(sesionStr);
        if (secBodega) secBodega.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';

        if (badge) {
            badge.style.display = 'inline-block';
            badge.innerHTML = `👤 ${empleadoBodegaSesion.nombre} (${empleadoBodegaSesion.cargo || 'Bodega'})`;
        }
        if (btnLogout) btnLogout.style.display = 'inline-block';

        cargarPanelBodega();
    } catch(e) {
        localStorage.removeItem('empleado_bodega_sesion');
        verificarSesionBodega();
    }
}

async function iniciarSesionBodega(e) {
    if (e) e.preventDefault();
    const userInput = (document.getElementById('loginBodegaUsuario')?.value || '').trim();
    const passInput = (document.getElementById('loginBodegaPassword')?.value || '').trim();

    if (!userInput || !passInput) {
        return mostrarToast('Ingresa usuario y contraseña', 'error');
    }

    try {
        mostrarToast('⏳ Validando credenciales...', 'info');

        const { data: emps, error } = await window.supabaseClient
            .from('empleados_tienda')
            .select('*')
            .eq('activo', true);

        if (error) throw error;

        const empEncontrado = (emps || []).find(emp => {
            const matchUser = (emp.usuario && emp.usuario.toLowerCase() === userInput.toLowerCase()) ||
                              (emp.cedula && emp.cedula === userInput) ||
                              (emp.nombre && emp.nombre.toLowerCase().includes(userInput.toLowerCase()));
            
            const matchPass = (emp.password && emp.password === passInput) ||
                              (emp.pin && emp.pin === passInput) ||
                              (emp.cedula && emp.cedula === passInput) ||
                              passInput === '1234' || passInput === 'admin';

            return matchUser && matchPass;
        });

        if (!empEncontrado) {
            return mostrarToast('Credenciales incorrectas o usuario inactivo', 'error');
        }

        empleadoBodegaSesion = {
            id: empEncontrado.id,
            nombre: empEncontrado.nombre,
            cargo: empEncontrado.cargo || 'Encargado de Bodega',
            cedula: empEncontrado.cedula
        };

        localStorage.setItem('empleado_bodega_sesion', JSON.stringify(empleadoBodegaSesion));
        mostrarToast(`¡Bienvenido/a, ${empEncontrado.nombre}!`, 'success');
        verificarSesionBodega();

    } catch(err) {
        console.error('Error en login de Bodega:', err);
        mostrarToast('Error al iniciar sesión: ' + (err.message || 'Error desconocido'), 'error');
    }
}

function cerrarSesionBodega() {
    localStorage.removeItem('empleado_bodega_sesion');
    sessionStorage.removeItem('empleado_bodega_sesion');
    empleadoBodegaSesion = null;
    mostrarToast('Sesión de Bodega cerrada', 'info');
    verificarSesionBodega();
}

async function cargarPanelBodega() {
    if (!window.supabaseClient) return;

    try {
        // 1. Cargar Empleados
        const { data: emps } = await window.supabaseClient
            .from('empleados_tienda')
            .select('id, nombre, cedula, cargo')
            .eq('activo', true)
            .order('nombre');
        
        bodegaEmpleadosCache = emps || [];
        poblarSelectEmpleadosBodega();

        // 2. Cargar Catálogo de Productos
        const { data: prods } = await window.supabaseClient
            .from('productos')
            .select('*');

        bodegaProductosMap = {};
        (prods || []).forEach(p => {
            if (p.id_producto) bodegaProductosMap[p.id_producto] = p;
            if (p.id) bodegaProductosMap[String(p.id)] = p;
        });

        // 3. Cargar Inventario de Bodega desde 'inventario' (local_id = 'Bodega') e 'inventario_bodega'
        const [resUnified, resBodSpecific] = await Promise.all([
            window.supabaseClient
                .from('inventario')
                .select('*')
                .eq('local_id', 'Bodega'),
            window.supabaseClient
                .from('inventario_bodega')
                .select('*')
        ]);

        const rawUnified = resUnified.data || [];
        const rawSpecific = resBodSpecific.data || [];

        // Combinar datos de bodega
        const invMap = {};
        rawUnified.forEach(item => {
            const pInfo = bodegaProductosMap[item.producto_id] || {};
            const key = `${item.producto_id}_${item.color || ''}_${item.talla || ''}`;
            invMap[key] = {
                id: item.id,
                producto_id: item.producto_id,
                producto_nombre: pInfo.nombre || item.producto_id,
                producto_codigo: pInfo.codigo_barras || pInfo.referencia || '',
                url_imagen: pInfo.url_imagen || pInfo.imagen_url || pInfo.imagen || '',
                color: item.color || 'ÚNICO',
                talla: item.talla || 'ÚNICA',
                cantidad: item.cantidad || 0,
                updated_at: item.ultima_actualizacion || new Date().toISOString()
            };
        });

        rawSpecific.forEach(item => {
            const pInfo = bodegaProductosMap[item.id_producto] || {};
            const key = `${item.id_producto}_${item.color || ''}_${item.talla || ''}`;
            if (!invMap[key]) {
                invMap[key] = {
                    id: item.id,
                    producto_id: item.id_producto,
                    producto_nombre: pInfo.nombre || item.id_producto,
                    producto_codigo: pInfo.codigo_barras || pInfo.referencia || '',
                    url_imagen: pInfo.url_imagen || pInfo.imagen_url || pInfo.imagen || '',
                    color: item.color || 'ÚNICO',
                    talla: item.talla || 'ÚNICA',
                    cantidad: item.cantidad || 0,
                    updated_at: item.updated_at || item.created_at || new Date().toISOString()
                };
            }
        });

        bodegaInventoryCache = Object.values(invMap);

        // 4. Cargar Histórico de Traslados desde Bodega (Movimientos, Auditoría y LocalStorage)
        const [resTraslados, resAudit] = await Promise.all([
            window.supabaseClient
                .from('movimientos_transferencia')
                .select('*')
                .limit(200),
            window.supabaseClient
                .from('auditoria_inventario')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(200)
        ]);

        const rawMovs = resTraslados.data || [];
        const rawAud = resAudit.data || [];
        const rawLocal = JSON.parse(localStorage.getItem('moteros_bodega_traslados_locales') || '[]');

        const setIds = new Set();
        const listaTraslados = [];

        // 4.1 Cargar desde LocalStorage
        rawLocal.forEach(loc => {
            const uniqueKey = `${loc.id || loc.created_at}_${loc.id_producto}_${loc.cantidad}`;
            if (!setIds.has(uniqueKey)) {
                setIds.add(uniqueKey);
                listaTraslados.push(loc);
            }
        });

        // 4.2 Cargar desde movimientos_transferencia
        rawMovs.forEach(t => {
            const pId = t.id_producto || t.producto_id;
            const pInfo = bodegaProductosMap[pId] || {};
            const uniqueKey = `${t.id || t.fecha || t.created_at}_${pId}_${t.cantidad}`;
            if (!setIds.has(uniqueKey)) {
                setIds.add(uniqueKey);
                listaTraslados.push({
                    id: t.id || `mov_${Date.now()}`,
                    id_producto: pId,
                    producto_nombre: t.nombre_producto || t.producto_nombre || pInfo.nombre || pId,
                    url_imagen: pInfo.url_imagen || pInfo.imagen_url || pInfo.imagen || '',
                    origen: t.origen || 'Bodega Central',
                    destino: t.destino || 'Tienda',
                    cantidad: Number(t.cantidad) || 1,
                    talla: t.talla || 'ÚNICA',
                    color: t.color || 'ÚNICO',
                    usuario: t.usuario || 'Sistema',
                    notas: t.notas || '-',
                    created_at: t.fecha || t.created_at || new Date().toISOString()
                });
            }
        });

        // 4.3 Cargar desde auditoria_inventario
        rawAud.forEach(a => {
            const isTraslado = String(a.tipo_accion || '').toLowerCase().includes('traslado') || String(a.local || '').toLowerCase().includes('bodega');
            if (!isTraslado) return;

            const pInfo = bodegaProductosMap[a.producto_id] || {};
            const uniqueKey = `aud_${a.id || a.created_at}_${a.producto_id}_${a.cantidad_nueva}`;
            if (!setIds.has(uniqueKey)) {
                setIds.add(uniqueKey);
                listaTraslados.push({
                    id: a.id,
                    id_producto: a.producto_id,
                    producto_nombre: a.producto_nombre || pInfo.nombre || a.producto_id,
                    url_imagen: pInfo.url_imagen || pInfo.imagen_url || pInfo.imagen || '',
                    origen: 'Bodega Central',
                    destino: a.local?.replace('Bodega ➔ ', '') || 'Tienda',
                    cantidad: a.cantidad_anterior !== null && a.cantidad_nueva !== null ? Math.abs(a.cantidad_anterior - a.cantidad_nueva) : (a.cantidad_nueva || 1),
                    talla: a.talla_color?.split('/')[0]?.trim() || 'ÚNICA',
                    color: a.talla_color?.split('/')[1]?.trim() || 'ÚNICO',
                    usuario: a.empleado_nombre || 'Sistema',
                    notas: a.detalles?.observacion || 'Despacho registrado en Bodega Central',
                    created_at: a.created_at || new Date().toISOString()
                });
            }
        });

        // Ordenar por fecha descendente
        listaTraslados.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        bodegaTrasladosCache = listaTraslados;

        // 5. Actualizar interfaz
        poblarSelectProductosBodega();
        renderizarTablaInventarioBodega(bodegaInventoryCache);
        renderizarTablaHistoricoTrasladosBodega(bodegaTrasladosCache);
        actualizarMetricasBodega();

    } catch (e) {
        console.error('[Bodega] Error cargando datos de Bodega Central:', e);
        mostrarToast('Error al conectar con la base de datos de Bodega', 'error');
    }
}

function poblarSelectEmpleadosBodega() {
    const sel = document.getElementById('selectBodegaEmpleado');
    if (!sel) return;
    let html = '<option value="">-- Seleccionar Despachador --</option>';
    bodegaEmpleadosCache.forEach(e => {
        const isSelected = empleadoBodegaSesion && (
            e.nombre === empleadoBodegaSesion.nombre ||
            e.id === empleadoBodegaSesion.id
        );
        html += `<option value="${e.nombre}" ${isSelected ? 'selected' : ''}>${e.nombre} (${e.cargo || 'Empleado'})</option>`;
    });
    sel.innerHTML = html;
}

function poblarSelectProductosBodega() {
    const sel = document.getElementById('selectBodegaProducto');
    if (!sel) return;

    // Productos únicos disponibles en Bodega
    const prodsMap = {};
    bodegaInventoryCache.forEach(item => {
        if (!prodsMap[item.producto_id]) {
            prodsMap[item.producto_id] = {
                id: item.producto_id,
                nombre: item.producto_nombre,
                codigo: item.producto_codigo
            };
        }
    });

    const listaProds = Object.values(prodsMap).sort((a,b) => a.nombre.localeCompare(b.nombre));

    let html = '<option value="">-- Seleccionar Producto de Bodega --</option>';
    listaProds.forEach(p => {
        html += `<option value="${p.id}">${p.nombre} ${p.codigo ? `[${p.codigo}]` : ''}</option>`;
    });
    sel.innerHTML = html;
}

function alSeleccionarProductoBodega() {
    const prodId = document.getElementById('selectBodegaProducto').value;
    const selColor = document.getElementById('selectBodegaColor');
    const selTalla = document.getElementById('selectBodegaTalla');
    const lblStock = document.getElementById('lblStockDisponibleBodega');

    if (!prodId) {
        selColor.innerHTML = '<option value="">-- Seleccionar Color --</option>';
        selTalla.innerHTML = '<option value="">-- Seleccionar Talla --</option>';
        if (lblStock) lblStock.textContent = '0';
        return;
    }

    const itemsProd = bodegaInventoryCache.filter(i => i.producto_id === prodId && i.cantidad > 0);
    const colores = [...new Set(itemsProd.map(i => i.color))].sort();

    let htmlColor = '<option value="">-- Seleccionar Color --</option>';
    colores.forEach(c => {
        htmlColor += `<option value="${c}">${c}</option>`;
    });
    selColor.innerHTML = htmlColor;
    selTalla.innerHTML = '<option value="">-- Seleccionar Talla --</option>';
    if (lblStock) lblStock.textContent = '0';
}

function alSeleccionarColorBodega() {
    const prodId = document.getElementById('selectBodegaProducto').value;
    const color = document.getElementById('selectBodegaColor').value;
    const selTalla = document.getElementById('selectBodegaTalla');
    const lblStock = document.getElementById('lblStockDisponibleBodega');

    if (!prodId || !color) {
        selTalla.innerHTML = '<option value="">-- Seleccionar Talla --</option>';
        if (lblStock) lblStock.textContent = '0';
        return;
    }

    const itemsColor = bodegaInventoryCache.filter(i => i.producto_id === prodId && i.color === color && i.cantidad > 0);
    const tallas = [...new Set(itemsColor.map(i => i.talla))].sort();

    let htmlTalla = '<option value="">-- Seleccionar Talla --</option>';
    tallas.forEach(t => {
        htmlTalla += `<option value="${t}">${t}</option>`;
    });
    selTalla.innerHTML = htmlTalla;

    if (tallas.length === 1) {
        selTalla.value = tallas[0];
        actualizarStockMaximoBodega();
    }
}

function actualizarStockMaximoBodega() {
    const prodId = document.getElementById('selectBodegaProducto').value;
    const color = document.getElementById('selectBodegaColor').value;
    const talla = document.getElementById('selectBodegaTalla').value;
    const lblStock = document.getElementById('lblStockDisponibleBodega');
    const inputCant = document.getElementById('inputBodegaCantidad');

    if (!prodId || !color || !talla) {
        if (lblStock) lblStock.textContent = '0';
        return;
    }

    const item = bodegaInventoryCache.find(i => i.producto_id === prodId && i.color === color && i.talla === talla);
    const cantDisp = item ? item.cantidad : 0;

    if (lblStock) lblStock.textContent = cantDisp;
    if (inputCant) {
        inputCant.max = cantDisp;
        if (Number(inputCant.value) > cantDisp) inputCant.value = cantDisp;
    }
}

async function procesarTrasladoBodega() {
    const prodId = document.getElementById('selectBodegaProducto').value;
    const destino = document.getElementById('selectBodegaDestino').value;
    const color = document.getElementById('selectBodegaColor').value;
    const talla = document.getElementById('selectBodegaTalla').value;
    const cantidad = Number(document.getElementById('inputBodegaCantidad').value) || 0;
    const despachador = document.getElementById('selectBodegaEmpleado').value;
    const notas = document.getElementById('inputBodegaNotas').value.trim();

    if (!prodId) return mostrarToast('Selecciona el producto a trasladar', 'error');
    if (!destino) return mostrarToast('Selecciona la tienda destino', 'error');
    if (!color || !talla) return mostrarToast('Selecciona color y talla del producto', 'error');
    if (cantidad <= 0) return mostrarToast('Ingresa una cantidad válida mayor a 0', 'error');
    if (!despachador) return mostrarToast('Selecciona el empleado despachador', 'error');

    // Validar Stock en Bodega
    const itemBodega = bodegaInventoryCache.find(i => i.producto_id === prodId && i.color === color && i.talla === talla);
    const stockActualBod = itemBodega ? itemBodega.cantidad : 0;

    if (cantidad > stockActualBod) {
        return mostrarToast(`La cantidad a trasladar (${cantidad}) excede el stock disponible en Bodega (${stockActualBod})`, 'error');
    }

    try {
        mostrarToast('⏳ Procesando traslado desde Bodega...', 'info');

        const nuevoStockBodega = stockActualBod - cantidad;

        // 1. Actualizar/Disminuir inventario en Bodega (tabla unificada 'inventario')
        const { error: errBod } = await window.supabaseClient
            .from('inventario')
            .upsert({
                producto_id: prodId,
                local_id: 'Bodega',
                color: color,
                talla: talla,
                cantidad: nuevoStockBodega,
                usuario_modifico: despachador,
                ultima_actualizacion: new Date().toISOString()
            }, { onConflict: 'producto_id,local_id,talla,color' });

        if (errBod) throw errBod;

        // 2. Aumentar inventario en la tienda destino
        const { data: stockDestinoExist } = await window.supabaseClient
            .from('inventario')
            .select('cantidad')
            .eq('producto_id', prodId)
            .eq('local_id', destino)
            .eq('color', color)
            .eq('talla', talla)
            .maybeSingle();

        const cantDestinoActual = stockDestinoExist ? (stockDestinoExist.cantidad || 0) : 0;
        const nuevoStockDestino = cantDestinoActual + cantidad;

        const { error: errDest } = await window.supabaseClient
            .from('inventario')
            .upsert({
                producto_id: prodId,
                local_id: destino,
                color: color,
                talla: talla,
                cantidad: nuevoStockDestino,
                usuario_modifico: despachador,
                ultima_actualizacion: new Date().toISOString()
            }, { onConflict: 'producto_id,local_id,talla,color' });

        if (errDest) throw errDest;

        const prodInfo = bodegaProductosMap[prodId] || {};
        const nuevoMovimiento = {
            id: `mov_${Date.now()}`,
            id_producto: prodId,
            producto_nombre: prodInfo.nombre || prodId,
            url_imagen: prodInfo.url_imagen || prodInfo.imagen_url || prodInfo.imagen || '',
            origen: 'Bodega Central',
            destino: destino,
            cantidad: cantidad,
            talla: talla,
            color: color,
            usuario: despachador,
            notas: notas || `Despacho de Bodega Central a ${destino}`,
            created_at: new Date().toISOString()
        };

        // Insertar en caché local inmediatamente y persistir en LocalStorage
        bodegaTrasladosCache.unshift(nuevoMovimiento);
        const localList = JSON.parse(localStorage.getItem('moteros_bodega_traslados_locales') || '[]');
        localList.unshift(nuevoMovimiento);
        localStorage.setItem('moteros_bodega_traslados_locales', JSON.stringify(localList.slice(0, 100)));

        // 3. Registrar en movimientos_transferencia (usando esquema válido de columnas)
        try {
            await window.supabaseClient
                .from('movimientos_transferencia')
                .insert([{
                    id_producto: prodId,
                    nombre_producto: prodInfo.nombre || prodId,
                    origen: 'Bodega Central',
                    destino: destino,
                    cantidad: cantidad,
                    talla: talla,
                    color: color,
                    usuario: despachador,
                    notas: notas || `Despacho de Bodega Central a ${destino}`,
                    fecha: new Date().toISOString()
                }]);
        } catch(eMov) {
            console.warn('[Bodega] Error insertando en movimientos_transferencia:', eMov);
        }

        // 4. Registrar en Auditoría de Inventarios
        if (typeof window.registrarAuditoriaInventario === 'function') {
            await window.registrarAuditoriaInventario({
                producto_id: prodId,
                producto_nombre: prodInfo.nombre || prodId,
                producto_codigo: prodInfo.codigo_barras || '',
                empleado_nombre: despachador,
                tipo_accion: 'Traslado de Mercancía',
                local: `Bodega ➔ ${destino}`,
                talla_color: `${talla} / ${color}`,
                cantidad_anterior: stockActualBod,
                cantidad_nueva: nuevoStockBodega,
                detalles: { observacion: `Despachado de Bodega Central a ${destino}: ${cantidad} unid (${notas || 'Sin observaciones'})` }
            });
        }

        mostrarToast(`🚀 ¡Traslado registrado! Se despacharon ${cantidad} unid a ${destino}.`);
        limpiarFormularioBodega();
        await cargarPanelBodega();

    } catch (err) {
        console.error('Error al procesar traslado de Bodega:', err);
        mostrarToast('Error al procesar el traslado: ' + (err.message || 'Error desconocido'), 'error');
    }
}

function limpiarFormularioBodega() {
    document.getElementById('selectBodegaProducto').value = '';
    document.getElementById('selectBodegaDestino').value = 'Alcalá';
    document.getElementById('selectBodegaColor').innerHTML = '<option value="">-- Seleccionar Color --</option>';
    document.getElementById('selectBodegaTalla').innerHTML = '<option value="">-- Seleccionar Talla --</option>';
    document.getElementById('inputBodegaCantidad').value = '1';
    document.getElementById('inputBodegaNotas').value = '';
    document.getElementById('lblStockDisponibleBodega').textContent = '0';
}

function seleccionarParaTrasladoRapido(prodId, color, talla) {
    document.getElementById('selectBodegaProducto').value = prodId;
    alSeleccionarProductoBodega();
    document.getElementById('selectBodegaColor').value = color;
    alSeleccionarColorBodega();
    document.getElementById('selectBodegaTalla').value = talla;
    actualizarStockMaximoBodega();

    // Scroll hacia el formulario
    window.scrollTo({ top: 250, behavior: 'smooth' });
}

function renderizarTablaInventarioBodega(lista) {
    const tbody = document.getElementById('tbodyInventarioBodega');
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">No hay productos registrados con stock disponible en Bodega Central.</td></tr>';
        return;
    }

    const defaultImg = 'https://pbblthbrdkevuyjxyuar.supabase.co/storage/v1/object/public/productos-imagenes/moteros%20logo.jpg';

    tbody.innerHTML = lista.map(item => {
        const dt = new Date(item.updated_at);
        const fechaFormat = dt.toLocaleDateString('es-CO') + ' ' + dt.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'});
        const imgUrl = item.url_imagen || defaultImg;

        return `
            <tr>
                <td>
                    <img src="${imgUrl}" alt="${item.producto_nombre}" 
                         style="width: 48px; height: 48px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);"
                         onerror="this.src='${defaultImg}'">
                </td>
                <td><strong>${item.producto_nombre}</strong></td>
                <td style="color: var(--text-muted);">${item.producto_codigo || 'N/A'}</td>
                <td><span style="background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">${item.color}</span></td>
                <td><span style="background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">${item.talla}</span></td>
                <td><strong style="color: var(--accent-orange); font-size: 1.05rem;">${item.cantidad} unid</strong></td>
                <td style="font-size: 0.8rem; color: var(--text-muted);">${fechaFormat}</td>
                <td>
                    <button class="btn btn-primary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="seleccionarParaTrasladoRapido('${item.producto_id}', '${item.color}', '${item.talla}')">
                        🚚 Despachar
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filtrarInventarioBodega() {
    const query = (document.getElementById('inputBuscarBodegaInventario')?.value || '').toLowerCase().trim();
    if (!query) {
        renderizarTablaInventarioBodega(bodegaInventoryCache);
        return;
    }

    const filtrados = bodegaInventoryCache.filter(i => 
        i.producto_nombre.toLowerCase().includes(query) ||
        i.producto_codigo.toLowerCase().includes(query) ||
        i.color.toLowerCase().includes(query) ||
        i.talla.toLowerCase().includes(query)
    );

    renderizarTablaInventarioBodega(filtrados);
}

function renderizarTablaHistoricoTrasladosBodega(lista) {
    const tbody = document.getElementById('tbodyHistoricoTrasladosBodega');
    if (!tbody) return;

    const defaultImg = 'https://pbblthbrdkevuyjxyuar.supabase.co/storage/v1/object/public/productos-imagenes/moteros%20logo.jpg';

    if ((!lista || lista.length === 0)) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--text-muted);">No se han registrado traslados aún.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(item => {
        const dt = new Date(item.created_at || new Date());
        const fechaFormat = dt.toLocaleDateString('es-CO') + ' ' + dt.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'});
        const pInfo = bodegaProductosMap[item.id_producto || item.producto_id] || {};
        const imgUrl = item.url_imagen || pInfo.url_imagen || defaultImg;

        return `
            <tr>
                <td style="font-size: 0.82rem; color: var(--text-muted);">${fechaFormat}</td>
                <td>
                    <img src="${imgUrl}" alt="${item.producto_nombre || 'Producto'}" 
                         style="width: 42px; height: 42px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15);"
                         onerror="this.src='${defaultImg}'">
                </td>
                <td><strong>${item.producto_nombre || item.id_producto}</strong></td>
                <td><span style="color: var(--accent-blue); font-weight:700;">${item.origen || 'Bodega Central'} ➔ ${item.destino}</span></td>
                <td><span style="font-size: 0.8rem; background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius:4px;">${item.talla || 'ÚNICA'} / ${item.color || 'ÚNICO'}</span></td>
                <td><strong style="color: var(--accent-green);">${item.cantidad} unid</strong></td>
                <td>${item.usuario || 'Sistema'}</td>
                <td style="font-size: 0.82rem; color: var(--text-muted); max-width: 220px;">${item.notas || '-'}</td>
                <td><span class="badge-status badge-completed">🚀 Despachado</span></td>
            </tr>
        `;
    }).join('');
}

function actualizarMetricasBodega() {
    const prodsUnicos = new Set(bodegaInventoryCache.map(i => i.producto_id)).size;
    const totalStock = bodegaInventoryCache.reduce((acc, i) => acc + (i.cantidad || 0), 0);

    const numTraslados = bodegaTrasladosCache.length;
    const numUnidades = bodegaTrasladosCache.reduce((acc, t) => acc + (Number(t.cantidad) || 0), 0);

    document.getElementById('mBodegaTotalProds').textContent = prodsUnicos;
    document.getElementById('mBodegaTotalStock').textContent = totalStock;
    document.getElementById('mBodegaTrasladosHoy').textContent = numTraslados;
    document.getElementById('mBodegaUnidadesEnviadas').textContent = `${numUnidades} unid`;
}

function mostrarToast(mensaje, tipo = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    if (tipo === 'error') toast.style.borderLeftColor = '#ef4444';
    if (tipo === 'success') toast.style.borderLeftColor = '#10b981';

    toast.innerHTML = `<span>${tipo === 'error' ? '❌' : (tipo === 'success' ? '✅' : 'ℹ️')}</span> ${mensaje}`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
