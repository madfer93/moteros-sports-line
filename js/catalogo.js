// ═══════════════════════════════════════════════════════════════
// MOTEROS SPORTS LINE - CATÁLOGO JAVASCRIPT
// ═══════════════════════════════════════════════════════════════

// Cliente Supabase
const { createClient } = supabase;
const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

// Variables globales
let todosLosProductos = [];
let productosFiltrados = [];
let carrito = JSON.parse(localStorage.getItem('carrito_moteros') || '[]');
let productoActual = null;

// Placeholders SVG (sin dependencias externas)
const PLACEHOLDER_IMG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect fill="#f1f5f9" width="400" height="300"/><text fill="#94a3b8" font-family="system-ui" font-size="16" x="50%" y="50%" text-anchor="middle" dy="0.3em">Sin imagen</text></svg>');
const PLACEHOLDER_LG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect fill="#f1f5f9" width="600" height="600"/><text fill="#94a3b8" font-family="system-ui" font-size="20" x="50%" y="50%" text-anchor="middle" dy="0.3em">Sin imagen</text></svg>');

// ═══════════════════════════════════════════════════════════════
// CARRITO
// ═══════════════════════════════════════════════════════════════

function actualizarContadorCarrito() {
    const total = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    document.getElementById('cartCount').textContent = total;
}

function agregarAlCarrito() {
    if (!productoActual) return;
    const cantidad = parseInt(document.getElementById('cantidadDetalle').value) || 1;

    const existente = carrito.find(item => item.id === productoActual.id);
    if (existente) {
        existente.cantidad += cantidad;
    } else {
        carrito.push({
            id: productoActual.id,
            nombre: productoActual.nombre,
            marca: productoActual.marca,
            precio: productoActual.precio,
            cantidad: cantidad
        });
    }

    localStorage.setItem('carrito_moteros', JSON.stringify(carrito));
    actualizarContadorCarrito();
    alert(`✅ ${cantidad} x ${productoActual.nombre} agregado al carrito`);
    cerrarModalDetalle();
}

function abrirCarrito() {
    const lista = document.getElementById('listaCarrito');
    const totalEl = document.getElementById('totalCarrito');

    if (carrito.length === 0) {
        lista.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🛒</div>
                <div class="empty-state-text">Tu carrito está vacío</div>
            </div>
        `;
        totalEl.textContent = '0';
    } else {
        lista.innerHTML = carrito.map((item, i) => `
            <div class="carrito-item">
                <div class="carrito-item-info">
                    <strong class="carrito-item-nombre">${item.nombre}</strong>
                    <small class="carrito-item-detalles">
                        ${item.marca} • $${parseInt(item.precio).toLocaleString('es-CO')} c/u
                    </small>
                </div>
                <div class="carrito-item-controls">
                    <div class="cantidad-badge">
                        <button onclick="cambiarCantidad(${i}, -1)" class="cantidad-btn">−</button>
                        <span class="cantidad-numero">${item.cantidad}</span>
                        <button onclick="cambiarCantidad(${i}, 1)" class="cantidad-btn">+</button>
                    </div>
                    <button onclick="eliminarDelCarrito(${i})" class="btn-eliminar">✖</button>
                </div>
            </div>
        `).join('');

        const total = carrito.reduce((s, item) => s + item.precio * item.cantidad, 0);
        totalEl.textContent = total.toLocaleString('es-CO');
    }
    document.getElementById('modalCarrito').classList.add('active');
}

function cambiarCantidad(i, delta) {
    const nueva = carrito[i].cantidad + delta;
    if (nueva < 1) return eliminarDelCarrito(i);
    carrito[i].cantidad = nueva;
    guardarCarrito();
}

function eliminarDelCarrito(i) {
    carrito.splice(i, 1);
    guardarCarrito();
}

function vaciarCarrito() {
    if (confirm('¿Estás seguro de vaciar el carrito?')) {
        carrito = [];
        guardarCarrito();
    }
}

function guardarCarrito() {
    localStorage.setItem('carrito_moteros', JSON.stringify(carrito));
    abrirCarrito();
    actualizarContadorCarrito();
}

function enviarPedidoWhatsApp() {
    if (carrito.length === 0) return alert('El carrito está vacío');

    let mensaje = "¡Hola Moteros Sports Line! 👋\n\n*Quiero consultar por:*\n\n";
    carrito.forEach(item => {
        mensaje += `• ${item.cantidad} x ${item.nombre}\n  ${item.marca}\n  $${parseInt(item.precio).toLocaleString('es-CO')} c/u\n\n`;
    });
    const total = carrito.reduce((s, item) => s + item.precio * item.cantidad, 0);
    mensaje += `*Total estimado: $${total.toLocaleString('es-CO')}*\n\n¡Gracias! 🙌`;

    window.open(`https://wa.me/${CONFIG.WHATSAPP.numero}?text=${encodeURIComponent(mensaje)}`, '_blank');
}

// ═══════════════════════════════════════════════════════════════
// PRODUCTOS
// ═══════════════════════════════════════════════════════════════

async function cargarProductos() {
    try {
        const { data, error } = await supabaseClient
            .from('productos')
            .select('*')
            .eq('estado', 'Activo')
            .order('nombre', { ascending: true });

        if (error) throw error;

        todosLosProductos = data || [];
        productosFiltrados = [...todosLosProductos];
        
        console.log(`✅ ${todosLosProductos.length} productos cargados`);
        
        mostrarProductos();
        actualizarContadorCarrito();
        
    } catch (err) {
        console.error('Error:', err);
        document.getElementById('contadorProductos').textContent = 'Error al cargar productos';
        document.getElementById('productosGrid').innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <div class="empty-state-icon">⚠️</div>
                <div class="empty-state-text">Error al cargar los productos</div>
                <p style="margin-top: 1rem; color: #999;">${err.message}</p>
            </div>
        `;
    }
}

function aplicarFiltros() {
    const cat = document.getElementById('filtroCategoria').value;
    const pre = document.getElementById('filtroPrecio').value;
    const bus = document.getElementById('buscarProducto').value.toLowerCase();

    productosFiltrados = todosLosProductos.filter(p => {
        if (cat && p.categoria !== cat) return false;
        if (pre) {
            const [min, max] = pre.split('-').map(Number);
            if (p.precio < min || p.precio > max) return false;
        }
        if (bus) {
            const busqueda = `${p.nombre} ${p.marca} ${p.descripcion_corta || ''}`.toLowerCase();
            if (!busqueda.includes(bus)) return false;
        }
        return true;
    });

    mostrarProductos();
}

function limpiarFiltros() {
    document.getElementById('filtroCategoria').value = '';
    document.getElementById('filtroPrecio').value = '';
    document.getElementById('buscarProducto').value = '';
    aplicarFiltros();
}

function mostrarProductos() {
    const grid = document.getElementById('productosGrid');
    const contador = document.getElementById('contadorProductos');

    contador.textContent = `${productosFiltrados.length} ${productosFiltrados.length === 1 ? 'producto encontrado' : 'productos encontrados'}`;

    if (productosFiltrados.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <div class="empty-state-icon">🔍</div>
                <div class="empty-state-text">No se encontraron productos</div>
                <p style="margin-top: 1rem; color: #999;">Intenta con otros filtros de búsqueda</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = productosFiltrados.map(p => `
        <div class="producto-card" onclick="verDetalle('${p.id}')">
            <div class="producto-imagen-wrapper">
                <img class="producto-imagen"
                     src="${p.url_imagen || PLACEHOLDER_IMG}"
                     alt="${p.nombre}"
                     loading="lazy"
                     onerror="this.src='${PLACEHOLDER_IMG}'">
                <span class="badge-categoria">${p.categoria}</span>
            </div>
            <div class="producto-info">
                <h3 class="producto-nombre">${p.nombre}</h3>
                <p class="producto-marca">${p.marca}</p>
                <p class="producto-descripcion">${p.descripcion_corta || 'Producto de alta calidad'}</p>
                <div class="producto-footer">
                    <span class="producto-precio">$${parseInt(p.precio).toLocaleString('es-CO')}</span>
                    <button class="btn-ver-mas" onclick="event.stopPropagation(); verDetalle('${p.id}')">
                        Ver detalle
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    console.log(`✅ ${productosFiltrados.length} productos mostrados en grid`);
}

// ═══════════════════════════════════════════════════════════════
// MODAL DETALLE
// ═══════════════════════════════════════════════════════════════

function verDetalle(id) {
    productoActual = todosLosProductos.find(p => p.id === id);
    if (!productoActual) return;

    document.getElementById('contenidoDetalle').innerHTML = `
        <div class="detalle-container">
            <div class="detalle-imagen">
                <img src="${productoActual.url_imagen || PLACEHOLDER_LG}"
                     alt="${productoActual.nombre}"
                     onerror="this.src='${PLACEHOLDER_LG}'">
            </div>
            <div class="detalle-info">
                <h2 class="detalle-titulo">${productoActual.nombre}</h2>
                <p class="detalle-marca"><strong>${productoActual.marca}</strong></p>
                <p class="detalle-precio">$${parseInt(productoActual.precio).toLocaleString('es-CO')}</p>

                ${productoActual.descripcion_corta ? `
                    <div class="detalle-seccion">
                        <h4>Descripción</h4>
                        <p>${productoActual.descripcion_corta}</p>
                    </div>
                ` : ''}
                
                ${productoActual.descripcion_tecnica ? `
                    <div class="detalle-seccion">
                        <h4>Características técnicas</h4>
                        <p>${productoActual.descripcion_tecnica.replace(/\n/g, '<br>')}</p>
                    </div>
                ` : ''}

                <div class="cantidad-container">
                    <label>Cantidad:</label>
                    <div class="cantidad-controls">
                        <input type="number" 
                               id="cantidadDetalle" 
                               value="1" 
                               min="1" 
                               class="cantidad-input">
                        <button onclick="agregarAlCarrito()" 
                                class="btn-ver-mas" 
                                style="padding: 1rem 2rem; font-size: 1.1rem;">
                            🛒 Agregar al Carrito
                        </button>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 2rem;">
                    <a href="https://wa.me/${CONFIG.WHATSAPP.numero}?text=${encodeURIComponent('Hola, me interesa: ' + productoActual.nombre + ' (' + productoActual.marca + ')')}"
                       target="_blank"
                       class="btn-whatsapp">
                        💬 Consultar por WhatsApp
                    </a>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalDetalle').classList.add('active');
}

function cerrarModalDetalle() {
    document.getElementById('modalDetalle').classList.remove('active');
}

function cerrarModalCarrito() {
    document.getElementById('modalCarrito').classList.remove('active');
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════

// Cerrar modal al hacer clic fuera
window.onclick = function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
};

// Inicializar al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando Moteros Sports Line - Catálogo...');
    cargarProductos();
});