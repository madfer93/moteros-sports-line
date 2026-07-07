// ═══════════════════════════════════════════════════════════════
// GESTOR DE PRODUCTOS - MOTEROS SPORTS LINE
// ═══════════════════════════════════════════════════════════════

// ESTADO GLOBAL
let productosCache = [];
let proveedoresCache = {};
let categoriasCache = [];
let usuarioLogueado = null;

// ═══════════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════════

async function intentarLogin() {
    const userVal = document.getElementById('userLogin').value.trim();
    const passVal = document.getElementById('passLogin').value;
    const errorEl = document.getElementById('loginError');

    if (!userVal || !passVal) {
        errorEl.textContent = 'Por favor ingresa usuario y contraseña';
        errorEl.style.display = 'block';
        return;
    }

    try {
        // Buscar en empleados_tienda
        const { data: empleado, error } = await supabaseClient
            .from('empleados_tienda')
            .select('*')
            .or(`usuario.eq."${userVal}",cedula.eq."${userVal}"`)
            .eq('password', passVal)
            .eq('activo', true)
            .single();

        if (error || !empleado) {
            errorEl.textContent = 'Credenciales inválidas o cuenta inactiva';
            errorEl.style.display = 'block';
            return;
        }

        // Verificar Permisos
        const cargosPermitidos = ['Gestor de Productos', 'Administrador', 'Gestora', 'Gestor'];
        if (!cargosPermitidos.includes(empleado.cargo)) {
            errorEl.textContent = 'No tienes permisos para acceder a esta sección (' + empleado.cargo + ')';
            errorEl.style.display = 'block';
            return;
        }

        // Login Exitoso
        usuarioLogueado = empleado;
        localStorage.setItem('gestor_session', JSON.stringify(empleado));
        mostrarPanel();
    } catch (e) {
        console.error('Error Login:', e);
        errorEl.textContent = 'Error de conexión con el servidor';
        errorEl.style.display = 'block';
    }
}

function mostrarPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('gestorPanel').style.display = 'block';
    
    document.getElementById('userName').textContent = usuarioLogueado.nombre;
    document.getElementById('userAvatar').textContent = usuarioLogueado.nombre.charAt(0).toUpperCase();
    
    inicializarGestor();
}

function logoutGestor() {
    if (confirm('¿Cerrar sesión?')) {
        localStorage.removeItem('gestor_session');
        location.reload();
    }
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════

async function inicializarGestor() {
    showToast('Cargando catálogo...', 'info');
    await Promise.all([
        cargarProveedores(),
        cargarCategorias(),
        cargarProductos()
    ]);
    showToast('Sistema listo');
}

// Check session on load
document.addEventListener('DOMContentLoaded', async () => {
    const session = localStorage.getItem('gestor_session');
    if (session) {
        try {
            usuarioLogueado = JSON.parse(session);
            
            // Si estamos en línea, validar en tiempo real contra Supabase
            if (navigator.onLine && window.supabaseClient) {
                const { data: emp, error } = await window.supabaseClient
                    .from('empleados_tienda')
                    .select('activo, cargo')
                    .eq('id', usuarioLogueado.id)
                    .maybeSingle();

                if (error || !emp || !emp.activo || !['Gestor de Productos', 'Administrador'].includes(emp.cargo)) {
                    console.warn('[GESTOR] Sesión inválida o empleado inactivo. Cerrando sesión...');
                    localStorage.removeItem('gestor_session');
                    usuarioLogueado = null;
                    location.reload();
                    return;
                }
            }
            mostrarPanel();
        } catch (e) {
            console.error('[GESTOR] Error al verificar sesión:', e);
            localStorage.removeItem('gestor_session');
            location.reload();
        }
    }
});

// ═══════════════════════════════════════════════════════════════
// PRODUCTOS LOGIC (Adapted from admin-productos.js)
// ═══════════════════════════════════════════════════════════════

async function cargarProveedores() {
    try {
        const { data, error } = await supabaseClient.from('proveedores').select('razon_social, nombre_comercial').order('razon_social');
        if (error) throw error;
        if (data) {
            proveedoresCache = data.map(p => p.razon_social || p.nombre_comercial || 'Proveedor sin nombre');
        }
    } catch (e) {
        console.error('Error al cargar proveedores:', e);
    }
}

async function cargarCategorias() {
    const { data } = await supabaseClient.from('categorias').select('nombre').order('nombre');
    if (data) {
        categoriasCache = data.map(c => c.nombre);
    }
}

async function cargarProductos() {
    const grid = document.getElementById('listaProductos');
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:3rem;"><i class="fas fa-spinner fa-spin fa-3x" style="color:var(--primary);"></i><p>Cargando productos...</p></div>';

    try {
        const { data: productosBase, error } = await supabaseClient
            .from('productos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Cargar stocks (Simplificado para el gestor)
        const [invAlcala, inv01, invJordan] = await Promise.all([
            supabaseClient.from('inventario_alcala').select('id_producto, cantidad'),
            supabaseClient.from('inventario_01').select('id_producto, cantidad'),
            supabaseClient.from('inventario_jordan').select('id_producto, cantidad')
        ]);

        const mapStocks = (items) => {
            const map = new Map();
            (items.data || []).forEach(i => map.set(String(i.id_producto), (map.get(String(i.id_producto)) || 0) + (i.cantidad || 0)));
            return map;
        };

        const stockAlc = mapStocks(invAlcala);
        const stock01 = mapStocks(inv01);
        const stockJor = mapStocks(invJordan);

        productosCache = productosBase.map(p => ({
            ...p,
            stock_alcala: stockAlc.get(String(p.id)) || 0,
            stock_local01: stock01.get(String(p.id)) || 0,
            stock_jordan: stockJor.get(String(p.id)) || 0
        }));

        renderizarProductos(productosCache);
    } catch (e) {
        console.error('Error cargar:', e);
        grid.innerHTML = '<div class="empty-state">Error al cargar productos</div>';
    }
}

function renderizarProductos(lista) {
    const grid = document.getElementById('listaProductos');
    if (lista.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:3rem;">No se encontraron productos</div>';
        return;
    }

    grid.innerHTML = lista.map(p => {
        const stockTotal = (p.stock_alcala || 0) + (p.stock_local01 || 0) + (p.stock_jordan || 0) + (p.stock_digital || 0);
        return `
        <div class="producto-admin-card">
            <div class="producto-admin-img">
                <img src="${p.url_imagen || 'https://via.placeholder.com/150'}" alt="${p.nombre}">
                <span class="badge badge-${p.estado === 'Activo' ? 'success' : 'danger'}">${p.estado}</span>
            </div>
            <div class="producto-admin-info">
                <h4>${p.nombre}</h4>
                <div class="producto-meta"><span>${p.categoria}</span> • <span>${p.marca}</span></div>
                <div class="producto-precios">
                    <div class="precio-item"><label>Venta</label><strong>$${parseInt(p.precio).toLocaleString('es-CO')}</strong></div>
                    <div class="precio-item"><label>Stock</label><strong>${stockTotal}</strong></div>
                </div>
                <div class="producto-admin-actions">
                    <button onclick="editarProducto('${p.id}')" class="btn btn-sm btn-secondary" title="Editar">✏️</button>
                    <button onclick="eliminarProducto('${p.id}')" class="btn btn-sm btn-danger" title="Eliminar">🗑️</button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function filtrarProductosAdmin() {
    const q = document.getElementById('buscarProductoAdmin').value.toLowerCase();
    const filtrados = productosCache.filter(p => 
        p.nombre.toLowerCase().includes(q) || 
        p.referencia?.toLowerCase().includes(q) || 
        p.marca.toLowerCase().includes(q)
    );
    renderizarProductos(filtrados);
}

// ═══════════════════════════════════════════════════════════════
// MODAL LOGIC
// ═══════════════════════════════════════════════════════════════

async function mostrarFormProducto() {
    document.getElementById('formProducto').style.display = 'flex';
    document.getElementById('formTituloProducto').textContent = '➕ Nuevo Producto';
    document.getElementById('productoId').value = '';
    
    // Limpiar campos básicos
    document.getElementById('productoNombre').value = '';
    document.getElementById('productoReferencia').value = '';
    document.getElementById('productoMarca').value = '';
    document.getElementById('productoSubcategoria').value = '';
    document.getElementById('productoPrecioCompra').value = '';
    document.getElementById('productoPrecio').value = '';
    document.getElementById('stockDigital').value = 0;
    document.getElementById('productoEstado').value = 'Activo';
    
    // Descripciones
    document.getElementById('productoDescCorta').value = '';
    document.getElementById('productoDescTecnica').value = '';

    // Imagen
    document.getElementById('productoImagen').value = '';
    document.getElementById('previewProducto').src = '';
    document.getElementById('previewContainerProducto').style.display = 'none';

    // Etiquetas
    document.getElementById('productoEnOferta').checked = false;
    document.getElementById('productoEsNuevo').checked = false;
    toggleFechaOferta();
    toggleFechaNuevo();
    document.getElementById('productoPorcentajeOferta').value = '';
    document.getElementById('productoOfertaHasta').value = '';
    document.getElementById('productoNuevoHasta').value = '';
    
    // Cargar Selects
    const catSel = document.getElementById('productoCategoria');
    catSel.innerHTML = '<option value="">Seleccionar...</option>' + categoriasCache.map(c => `<option value="${c}">${c}</option>`).join('');
    
    const provSel = document.getElementById('productoProveedor');
    provSel.innerHTML = '<option value="">Seleccionar...</option>' + proveedoresCache.map(name => `<option value="${name}">${name}</option>`).join('');

    document.getElementById('containerColoresFotos').innerHTML = '';
    document.getElementById('tbodyTallasStock').innerHTML = '';
    sumarStocks();
}

function cancelarFormProducto() {
    document.getElementById('formProducto').style.display = 'none';
}

async function editarProducto(id) {
    const p = productosCache.find(x => x.id === id);
    if (!p) return;

    await mostrarFormProducto();
    document.getElementById('formTituloProducto').textContent = '✏️ Editar Producto';
    document.getElementById('productoId').value = p.id;
    document.getElementById('productoNombre').value = p.nombre;
    document.getElementById('productoReferencia').value = p.referencia || '';
    document.getElementById('productoMarca').value = p.marca || '';
    document.getElementById('productoSubcategoria').value = p.subcategoria || '';
    document.getElementById('productoCategoria').value = p.categoria;
    document.getElementById('productoProveedor').value = p.proveedor || '';
    document.getElementById('productoPrecioCompra').value = p.precio_compra;
    document.getElementById('productoPrecio').value = p.precio;
    document.getElementById('stockDigital').value = p.stock_digital || 0;
    document.getElementById('productoEstado').value = p.estado;

    document.getElementById('productoDescCorta').value = p.descripcion_corta || '';
    document.getElementById('productoDescTecnica').value = p.descripcion_tecnica || '';
    
    // Etiquetas
    document.getElementById('productoEnOferta').checked = !!p.en_oferta;
    document.getElementById('productoEsNuevo').checked = !!p.es_nuevo;
    document.getElementById('productoPorcentajeOferta').value = p.porcentaje_oferta || '';
    document.getElementById('productoOfertaHasta').value = p.fecha_oferta_hasta ? p.fecha_oferta_hasta.substring(0,10) : '';
    document.getElementById('productoNuevoHasta').value = p.fecha_nuevo_hasta ? p.fecha_nuevo_hasta.substring(0,10) : '';
    toggleFechaOferta();
    toggleFechaNuevo();
    
    if (p.url_imagen) {
        document.getElementById('productoImagen').value = p.url_imagen;
        document.getElementById('previewProducto').src = p.url_imagen;
        document.getElementById('previewContainerProducto').style.display = 'block';
    }

    // Cargar Variantes (Colores y Fotos)
    if (p.variantes && Array.isArray(p.variantes)) {
        p.variantes.forEach(cf => agregarFilaColor(cf.color, cf.url));
    }

    // Cargar Stock Detallado (Tallas)
    cargarTallasProducto(p.id_producto || p.id);
    actualizarFormularioPorCategoria();
}

async function cargarTallasProducto(id_producto) {
    const [invA, inv01, invJ] = await Promise.all([
        supabaseClient.from('inventario_alcala').select('*').eq('id_producto', id_producto),
        supabaseClient.from('inventario_01').select('*').eq('id_producto', id_producto),
        supabaseClient.from('inventario_jordan').select('*').eq('id_producto', id_producto)
    ]);

    const tallasSet = new Set();
    const map = {}; // key: color-talla

    const process = (data, tienda) => {
        (data || []).forEach(i => {
            const key = `${i.color || ''}-${i.talla || ''}`;
            if (!map[key]) map[key] = { color: i.color || '', talla: i.talla || '', a: 0, l: 0, j: 0 };
            map[key][tienda] = i.cantidad;
        });
    };

    process(invA.data, 'a');
    process(inv01.data, 'l');
    process(invJ.data, 'j');

    Object.values(map).forEach(m => agregarFilaTalla(m.talla, m.color, m.a, m.l, m.j));
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : 'ℹ️'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function toggleFechaOferta() {
    const checked = document.getElementById('productoEnOferta').checked;
    document.getElementById('grupoFechaOferta').style.display = checked ? 'block' : 'none';
}

function toggleFechaNuevo() {
    const checked = document.getElementById('productoEsNuevo').checked;
    document.getElementById('grupoFechaNuevo').style.display = checked ? 'block' : 'none';
}

function removerPreview() {
    document.getElementById('productoImagen').value = '';
    document.getElementById('previewProducto').src = '';
    document.getElementById('previewContainerProducto').style.display = 'none';
    document.getElementById('fileInputProducto').value = '';
}

function agregarFilaColor(color = '', url = '') {
    const container = document.getElementById('containerColoresFotos');
    if (!container) return;
    const index = container.children.length;

    const div = document.createElement('div');
    div.className = 'fila-color';
    div.style.display = 'flex';
    div.style.gap = '1rem';
    div.style.alignItems = 'center';
    div.style.background = 'white';
    div.style.padding = '1rem';
    div.style.borderRadius = '0.75rem';
    div.style.border = '1px solid #e2e8f0';
    div.style.marginBottom = '0.5rem';
    div.id = `fila-color-${index}`;

    div.innerHTML = `
        <div style="flex: 1;">
            <input type="text" class="form-control color-name" value="${color}" placeholder="Color (ej: Rojo)" oninput="actualizarSelectsColor()">
        </div>
        <div style="flex: 1; display: flex; align-items: center; gap: 0.5rem;">
            <input type="text" class="form-control color-url" value="${url}" placeholder="URL o sube una">
            <button type="button" class="btn btn-sm btn-secondary" onclick="subirImagenColor(${index})">📷</button>
        </div>
        <div class="color-preview-img" style="width: 50px; height: 50px; background: #f1f5f9; border-radius: 4px; overflow: hidden; border: 1px solid #e2e8f0;">
            <img src="${url || 'img/android-chrome-192x192.png'}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
        <button type="button" class="btn btn-sm btn-danger" onclick="removerFilaColor(${index})">🗑️</button>
    `;
    container.appendChild(div);
    actualizarSelectsColor();
}

function removerFilaColor(index) {
    const div = document.getElementById(`fila-color-${index}`);
    if (div) div.remove();
    actualizarSelectsColor();
}

function actualizarSelectsColor() {
    const nombres = Array.from(document.querySelectorAll('.color-name')).map(i => i.value.trim()).filter(v => v !== '');
    const selects = document.querySelectorAll('.talla-color');

    selects.forEach(select => {
        const valActual = select.value;
        select.innerHTML = '<option value="">Color...</option>' + nombres.map(n => `<option value="${n}" ${n === valActual ? 'selected' : ''}>${n}</option>`).join('');
    });
}

async function subirImagenColor(index) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            showToast('Subiendo imagen de color...', 'info');
            const url = await subirImagen(file);
            const fila = document.getElementById(`fila-color-${index}`);
            if (fila) {
                fila.querySelector('.color-url').value = url;
                fila.querySelector('.color-preview-img img').src = url;
            }
            showToast('Imagen subida');
        } catch (e) {
            showToast('Error al subir imagen', 'error');
        }
    };
    input.click();
}

function agregarFilaTalla(talla = '', color = '', a = 0, l = 0, j = 0) {
    const tbody = document.getElementById('tbodyTallasStock');
    const tr = document.createElement('tr');
    
    // Obtener colores actuales para el select
    const colores = Array.from(document.querySelectorAll('.color-name')).map(i => i.value.trim()).filter(v => v !== '');
    const optionsColor = colores.map(c => `<option value="${c}" ${c === color ? 'selected' : ''}>${c}</option>`).join('');

    tr.innerHTML = `
        <td>
            <select class="form-control form-control-sm talla-color">
                <option value="">Color...</option>
                ${optionsColor}
                ${color && !colores.includes(color) ? `<option value="${color}" selected>${color}</option>` : ''}
            </select>
        </td>
        <td><input type="text" class="form-control form-control-sm talla-name" value="${talla}" placeholder="Talla"></td>
        <td><input type="number" class="form-control form-control-sm stock-a" value="${a}" oninput="sumarStocks()"></td>
        <td><input type="number" class="form-control form-control-sm stock-l" value="${l}" oninput="sumarStocks()"></td>
        <td><input type="number" class="form-control form-control-sm stock-j" value="${j}" oninput="sumarStocks()"></td>
        <td><button type="button" class="btn btn-sm" onclick="this.closest('tr').remove(); sumarStocks()">🗑️</button></td>
    `;
    tbody.appendChild(tr);
    sumarStocks();
}

function sumarStocks() {
    let totalA = 0, totalL = 0, totalJ = 0;
    document.querySelectorAll('#tbodyTallasStock tr').forEach(tr => {
        totalA += parseInt(tr.querySelector('.stock-a').value) || 0;
        totalL += parseInt(tr.querySelector('.stock-l').value) || 0;
        totalJ += parseInt(tr.querySelector('.stock-j').value) || 0;
    });
    document.getElementById('stockAlcala').value = totalA;
    document.getElementById('stockLocal01').value = totalL;
    document.getElementById('stockJordan').value = totalJ;
}

function actualizarFormularioPorCategoria() {
    const cat = document.getElementById('productoCategoria').value.toUpperCase();
    const catsConTalla = ['CASCOS', 'GUANTES', 'IMPERMEABLES', 'BOTAS', 'PROTECCIONES'];
    document.getElementById('containerTallasStock').style.display = catsConTalla.includes(cat) ? 'block' : 'block'; // Forzado para el gestor
}

async function manejarImagenPrincipal(input) {
    if (!input.files || !input.files[0]) return;
    try {
        showToast('Subiendo imagen...', 'info');
        const url = await subirImagen(input.files[0]);
        document.getElementById('productoImagen').value = url;
        document.getElementById('previewProducto').src = url;
        document.getElementById('previewContainerProducto').style.display = 'block';
        showToast('Imagen subida');
    } catch (e) {
        showToast('Error al subir imagen', 'error');
    }
}

async function subirImagen(file, carpeta = 'productos-imagenes') {
    const ext = file.name.split('.').pop().toLowerCase();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;

    const { data, error } = await supabaseClient.storage
        .from(carpeta)
        .upload(fileName, file);

    if (error) throw error;

    const { data: urlData } = supabaseClient.storage
        .from(carpeta)
        .getPublicUrl(fileName);

    return urlData.publicUrl;
}

// ═══════════════════════════════════════════════════════════════
// SAVE / DELETE
// ═══════════════════════════════════════════════════════════════

async function guardarProducto() {
    const btnGuardar = document.querySelector('button[onclick="guardarProducto()"]');
    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '⏳ Guardando...';
    }

    const id = document.getElementById('productoId').value;
    const datos = {
        nombre: document.getElementById('productoNombre').value.trim(),
        referencia: document.getElementById('productoReferencia').value.trim(),
        marca: document.getElementById('productoMarca').value.trim(),
        subcategoria: document.getElementById('productoSubcategoria').value.trim(),
        categoria: document.getElementById('productoCategoria').value,
        proveedor: document.getElementById('productoProveedor').value,
        precio_compra: parseFloat(document.getElementById('productoPrecioCompra').value) || 0,
        precio: parseFloat(document.getElementById('productoPrecio').value) || 0,
        stock_digital: parseInt(document.getElementById('stockDigital').value) || 0,
        estado: document.getElementById('productoEstado').value,
        url_imagen: document.getElementById('productoImagen').value,
        descripcion_corta: document.getElementById('productoDescCorta').value.trim(),
        descripcion_tecnica: document.getElementById('productoDescTecnica').value.trim(),
        en_oferta: document.getElementById('productoEnOferta').checked,
        es_nuevo: document.getElementById('productoEsNuevo').checked,
        porcentaje_oferta: parseInt(document.getElementById('productoPorcentajeOferta').value) || null,
        fecha_oferta_hasta: document.getElementById('productoOfertaHasta').value || null,
        fecha_nuevo_hasta: document.getElementById('productoNuevoHasta').value || null,
        variantes: Array.from(document.querySelectorAll('.fila-color')).map(div => ({
            color: div.querySelector('.color-name').value,
            url: div.querySelector('.color-url').value
        })),
        tallas: Array.from(new Set(Array.from(document.querySelectorAll('.talla-name')).map(input => input.value.trim()).filter(t => t)))
    };

    // Generar ID Robusto (Slug) si es nuevo producto
    if (!id) {
        const slugBase = datos.nombre.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .trim();
        datos.id_producto = `${slugBase}-${Math.floor(Math.random() * 100000)}`;
    }

    if (!datos.nombre || !datos.categoria) return showToast('Nombre y Categoría son obligatorios', 'error');

    try {
        let res;
        if (id) {
            res = await supabaseClient.from('productos').update(datos).eq('id', id).select().single();
        } else {
            res = await supabaseClient.from('productos').insert(datos).select().single();
        }

        if (res.error) throw res.error;

        // El ID para inventarios debe ser id_producto (slug) si existe, sino el UUID/ID
        const finalId = res.data.id_producto || res.data.id;
        
        // Guardar Tallas / Stock (Esto es más complejo porque implica múltiples tablas)
        await guardarInventarios(finalId);

        showToast('Producto guardado correctamente');
        cancelarFormProducto();
        cargarProductos();
    } catch (e) {
        console.error('Error guardar:', e);
        let msg = e.message || 'Error desconocido';
        if (e.code === '42501' || e.message?.includes('RLS') || String(e.status) === '401') {
            msg = 'Error de Permisos (RLS/401): El producto se creó pero no se pudieron actualizar los stocks por falta de permisos en las tablas de inventario en Supabase.';
        }
        showToast('Error: ' + msg, 'error');
        // A pesar del error de stock, recargamos para ver el producto creado
        cargarProductos();
    } finally {
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '💾 Guardar Producto';
        }
    }
}

async function guardarInventarios(id_producto) {
    const rows = document.querySelectorAll('#tbodyTallasStock tr');
    
    // El sistema actual requiere limpiar y volver a insertar o hacer upsert
    // Por simplicidad en esta versión, haremos lo que hace el admin real si es posible
    
    const promesas = [];
    
    // Agrupar por tienda para optimizar
    const dataA = [], data01 = [], dataJ = [];
    
    rows.forEach(tr => {
        const color = tr.querySelector('.talla-color').value;
        const talla = tr.querySelector('.talla-name').value;
        const sa = parseInt(tr.querySelector('.stock-a').value) || 0;
        const sl = parseInt(tr.querySelector('.stock-l').value) || 0;
        const sj = parseInt(tr.querySelector('.stock-j').value) || 0;
        
        dataA.push({ id_producto, color, talla, cantidad: sa });
        data01.push({ id_producto, color, talla, cantidad: sl });
        dataJ.push({ id_producto, color, talla, cantidad: sj });
    });

    // Limpiar anteriores (OJO: Esto puede ser peligroso si hay ventas asociadas a esas filas específicas, 
    // pero el sistema de Moteros parece manejarlo por id_producto)
    await Promise.all([
        supabaseClient.from('inventario_alcala').delete().eq('id_producto', id_producto),
        supabaseClient.from('inventario_01').delete().eq('id_producto', id_producto),
        supabaseClient.from('inventario_jordan').delete().eq('id_producto', id_producto)
    ]);

    if (dataA.length > 0) promesas.push(supabaseClient.from('inventario_alcala').insert(dataA));
    if (data01.length > 0) promesas.push(supabaseClient.from('inventario_01').insert(data01));
    if (dataJ.length > 0) promesas.push(supabaseClient.from('inventario_jordan').insert(dataJ));

    await Promise.all(promesas);

    // 3. Sincronizar Tabla Unificada 'inventario'
    await supabaseClient.from('inventario').delete().eq('producto_id', id_producto);
    const opsUnified = [];
    dataA.forEach(i => opsUnified.push({ producto_id: id_producto, local_id: 'Alcalá', talla: i.talla, color: i.color, cantidad: i.cantidad, ultima_actualizacion: new Date().toISOString() }));
    data01.forEach(i => opsUnified.push({ producto_id: id_producto, local_id: 'Local 01', talla: i.talla, color: i.color, cantidad: i.cantidad, ultima_actualizacion: new Date().toISOString() }));
    dataJ.forEach(i => opsUnified.push({ producto_id: id_producto, local_id: 'Jordán', talla: i.talla, color: i.color, cantidad: i.cantidad, ultima_actualizacion: new Date().toISOString() }));

    if (opsUnified.length > 0) {
        await supabaseClient.from('inventario').insert(opsUnified);
    }
}
async function eliminarProducto(id) {
    if (!confirm('¿Seguro que deseas eliminar este producto?')) return;
    try {
        // 1. Obtener el slug (id_producto) para limpiar inventarios
        const { data: prod } = await supabaseClient.from('productos').select('id_producto').eq('id', id).single();
        
        if (prod && prod.id_producto) {
            // 2. Limpiar inventarios asociados
            await Promise.all([
                supabaseClient.from('inventario_alcala').delete().eq('id_producto', prod.id_producto),
                supabaseClient.from('inventario_01').delete().eq('id_producto', prod.id_producto),
                supabaseClient.from('inventario_jordan').delete().eq('id_producto', prod.id_producto),
                supabaseClient.from('inventario').delete().eq('producto_id', prod.id_producto)
            ]);
        }

        // 3. Eliminar el producto principal
        const { error } = await supabaseClient.from('productos').delete().eq('id', id);
        if (error) throw error;
        
        showToast('Producto eliminado exitosamente');
        cargarProductos();
    } catch (e) {
        console.error('Error al eliminar:', e);
        let msg = e.message || 'Error desconocido';
        if (e.code === '42501') {
            msg = 'Error de Permisos (RLS): No tienes permiso para eliminar productos o sus inventarios.';
        }
        showToast('Error al eliminar: ' + msg, 'error');
    }
}
