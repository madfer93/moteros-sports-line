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
// UI & MENÚ
// ═══════════════════════════════════════════════════════════════

function toggleMobileMenu() {
    const nav = document.getElementById('mobileNav');
    const btn = document.getElementById('menuToggle');
    if (!nav || !btn) return;
    nav.classList.toggle('active');
    btn.classList.toggle('active');
}

function mostrarToast(titulo, mensaje, tipo = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const iconos = { success: '✅', warning: '⚠️', error: '❌' };
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `
        <span class="toast-icon">${iconos[tipo] || '✅'}</span>
        <div class="toast-content">
            <div class="toast-title">${titulo}</div>
            <div class="toast-message">${mensaje || ''}</div>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    }, tipo === 'warning' ? 4000 : 3000);
}

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
        const infoPrecio = window.PromocionesManager
            ? window.PromocionesManager.calcularPrecio(productoActual.precio, productoActual.id)
            : { precioFinal: productoActual.precio, tieneDescuento: false };

        carrito.push({
            id: productoActual.id,
            nombre: productoActual.nombre,
            marca: productoActual.marca,
            precio: infoPrecio.precioFinal,
            url_imagen: productoActual.url_imagen,
            cantidad: cantidad,
            descuento: infoPrecio.tieneDescuento ? infoPrecio.porcentajeDescuento : 0
        });
    }

    localStorage.setItem('carrito_moteros', JSON.stringify(carrito));
    actualizarContadorCarrito();
    mostrarToast('Carrito', `✅ ${cantidad} x ${productoActual.nombre} agregado`);
    cerrarModalDetalle();
}

function agregarAlCarritoRapido(id) {
    const producto = todosLosProductos.find(p => p.id === id);
    if (!producto) return;

    const existente = carrito.find(item => item.id === id);
    if (existente) {
        existente.cantidad += 1;
    } else {
        const infoPrecio = window.PromocionesManager
            ? window.PromocionesManager.calcularPrecio(producto.precio, producto.id)
            : { precioFinal: producto.precio, tieneDescuento: false };

        carrito.push({
            id: producto.id,
            nombre: producto.nombre,
            marca: producto.marca,
            precio: infoPrecio.precioFinal,
            url_imagen: producto.url_imagen,
            cantidad: 1,
            descuento: infoPrecio.tieneDescuento ? infoPrecio.porcentajeDescuento : 0
        });
    }

    localStorage.setItem('carrito_moteros', JSON.stringify(carrito));
    actualizarContadorCarrito();
    mostrarToast('Carrito', `✅ ${producto.nombre} agregado al carrito`);
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
                <img src="${item.url_imagen || PLACEHOLDER_IMG}" alt="${item.nombre}" class="carrito-item-img">
                <div class="carrito-item-info">
                    <div class="carrito-item-nombre"><strong>${item.nombre}</strong></div>
                    <div class="carrito-item-detalles">
                        ${item.marca} • $${parseInt(item.precio).toLocaleString('es-CO')} c/u
                    </div>
                </div>
                <div class="carrito-item-controls">
                    <div class="cantidad-badge">
                        <button onclick="cambiarCantidad(${i}, -1)" class="cantidad-btn">−</button>
                        <span class="cantidad-numero">${item.cantidad}</span>
                        <button onclick="cambiarCantidad(${i}, 1)" class="cantidad-btn">+</button>
                    </div>
                    <button onclick="eliminarDelCarrito(${i})" class="btn-eliminar" title="Eliminar">🗑️</button>
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
    if (carrito.length === 0) {
        mostrarToast('Carrito vacío', 'Agrega productos antes de continuar', 'warning');
        return;
    }

    // Verificar checkbox de Habeas Data
    const checkHabeas = document.getElementById('aceptaHabeasData');
    if (!checkHabeas || !checkHabeas.checked) {
        mostrarToast('Acepta las políticas', 'Debes aceptar el Habeas Data y Términos para continuar', 'warning');

        // Resaltar el checkbox
        const checkContainer = checkHabeas?.closest('div') || checkHabeas?.parentElement;
        if (checkContainer) {
            checkContainer.style.animation = 'shake 0.5s ease';
            checkContainer.style.boxShadow = '0 0 10px rgba(245, 158, 11, 0.5)';
            setTimeout(() => {
                checkContainer.style.animation = '';
                checkContainer.style.boxShadow = '';
            }, 2000);
        }
        return;
    }

    let mensaje = "¡Hola Moteros Sports Line! 👋\n\n*Quiero consultar por:*\n\n";
    carrito.forEach(item => {
        const descInfo = item.descuento ? ` (Dto. ${item.descuento}%)` : '';
        mensaje += `• ${item.cantidad} x ${item.nombre}${descInfo}\n  ${item.marca}\n  $${parseInt(item.precio).toLocaleString('es-CO')} c/u\n\n`;
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
        await cargarCategoriasFiltro();
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

    grid.innerHTML = productosFiltrados.map(p => {
        const infoPrecio = window.PromocionesManager
            ? window.PromocionesManager.calcularPrecio(p.precio, p.id)
            : { precioFinal: p.precio, tieneDescuento: false };

        return `
        <div class="producto-card" onclick="verDetalle('${p.id}')">
            ${infoPrecio.tieneDescuento ? `<span class="badge-promo" style="position:absolute;top:10px;right:10px;background:#ef4444;color:white;padding:2px 8px;border-radius:12px;font-size:0.8rem;font-weight:bold;">-${infoPrecio.porcentajeDescuento}%</span>` : ''}
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
                <div class="producto-footer" style="flex-direction: column; gap: 1rem; align-items: stretch;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        ${infoPrecio.tieneDescuento ?
                `<div style="display:flex;flex-direction:column;align-items:flex-start;">
                                <span style="text-decoration:line-through;color:#94a3b8;font-size:0.85rem;">$${parseInt(p.precio).toLocaleString('es-CO')}</span>
                                <span class="producto-precio" style="color:#ef4444;">$${parseInt(infoPrecio.precioFinal).toLocaleString('es-CO')}</span>
                             </div>`
                : `<span class="producto-precio">$${parseInt(p.precio).toLocaleString('es-CO')}</span>`
            }
                        <button class="btn-agregar-inline" onclick="event.stopPropagation(); agregarAlCarritoRapido('${p.id}')">
                            <span>🛒 Agregar</span>
                        </button>
                    </div>
                    <button class="btn-ver-mas" onclick="event.stopPropagation(); verDetalle('${p.id}')" style="width: 100%;">
                        Ver detalle completo
                    </button>
                </div>
            </div>
        </div>
    `}).join('');

    console.log(`✅ ${productosFiltrados.length} productos mostrados en grid`);
}

// ═══════════════════════════════════════════════════════════════
// MODAL DETALLE
// ═══════════════════════════════════════════════════════════════

function verDetalle(id) {
    productoActual = todosLosProductos.find(p => p.id === id);
    if (!productoActual) return;

    const infoP = window.PromocionesManager ? window.PromocionesManager.calcularPrecio(productoActual.precio, productoActual.id) : { precioFinal: productoActual.precio, tieneDescuento: false };

    document.getElementById('contenidoDetalle').innerHTML = `
        <div class="product-details-premium">
            <div class="product-media-column">
                <div class="main-image-container">
                    ${infoP.tieneDescuento ? `<span class="discount-pill">-${infoP.porcentajeDescuento}% OFF</span>` : ''}
                    <img src="${productoActual.url_imagen || PLACEHOLDER_LG}" 
                         alt="${productoActual.nombre}" 
                         class="main-product-image"
                         onerror="this.src='${PLACEHOLDER_LG}'">
                </div>
                <div class="product-trust-badges">
                    <div class="trust-badge">🛡️ Envío Seguro</div>
                    <div class="trust-badge">📦 En Stock</div>
                    <div class="trust-badge">✅ Original</div>
                </div>
            </div>

            <div class="product-info-column">
                <div class="product-header">
                    <span class="category-tag">${productoActual.categoria}</span>
                    <h2 class="product-title-premium">${productoActual.nombre}</h2>
                    <p class="product-brand-premium">${productoActual.marca}</p>
                </div>

                <div class="product-price-section">
                    ${infoP.tieneDescuento ? `
                        <div class="price-wrapper">
                            <span class="old-price">$${parseInt(productoActual.precio).toLocaleString('es-CO')}</span>
                            <span class="current-price discount">$${parseInt(infoP.precioFinal).toLocaleString('es-CO')}</span>
                        </div>
                    ` : `
                        <div class="price-wrapper">
                            <span class="current-price">$${parseInt(productoActual.precio).toLocaleString('es-CO')}</span>
                        </div>
                    `}
                </div>

                <div class="product-description-premium">
                    <h4 class="section-title">Sobre este producto</h4>
                    <p class="short-desc">${productoActual.descripcion_corta || 'Este producto cuenta con los más altos estándares de calidad de Moteros Sports Line.'}</p>
                    ${productoActual.descripcion_tecnica ? `
                        <div class="specs-box">
                            <h5 class="specs-title">Características técnicas:</h5>
                            <p class="specs-content">${productoActual.descripcion_tecnica.replace(/\n/g, '<br>')}</p>
                        </div>
                    ` : ''}
                </div>

                <div class="purchase-actions-premium">
                    <div class="quantity-selector-premium">
                        <label for="cantidadDetalle">Cantidad:</label>
                        <div class="quantity-controls-inner">
                            <button class="qty-btn" onclick="const input = document.getElementById('cantidadDetalle'); if(input.value > 1) input.value--">−</button>
                            <input type="number" id="cantidadDetalle" value="1" min="1" readonly>
                            <button class="qty-btn" onclick="document.getElementById('cantidadDetalle').value++">+</button>
                        </div>
                    </div>
                    
                    <button class="btn-add-main" onclick="agregarAlCarrito()">
                        <span>🛒 Agregar al Carrito</span>
                    </button>
                    
                    <a href="https://wa.me/${CONFIG.WHATSAPP.numero}?text=${encodeURIComponent('¡Hola! Me interesa este producto: ' + productoActual.nombre + ' (' + productoActual.marca + ')')}" 
                       target="_blank" 
                       class="btn-wa-main">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.181-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.171.824-.299.045-.698.059-1.146-.086-.285-.092-.596-.213-.99-.382-1.684-.718-2.772-2.42-2.856-2.531-.084-.11-.692-.919-.692-1.756 0-.838.431-1.248.585-1.416.155-.168.337-.21.45-.21h.322c.113 0 .262.001.383.284l.443 1.074c.045.106.074.212.003.353-.071.141-.106.21-.212.333-.106.124-.216.208-.309.319l-.234.256c.123.214.281.411.464.584.183.174.379.324.593.447l.282.25c.114.108.358.337.358.337s.216-.251.309-.319c.093-.068.183-.16.284-.131s.574.271.743.354c.169.083.282.124.339.212.056.095.056.551-.088.956z"/></svg>
                        Consultar por WhatsApp
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
window.onclick = function (e) {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
};

// Inicializar al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando Moteros Sports Line - Catálogo...');
    cargarProductos();
    // cargarCategoriasFiltro() se llama dentro de cargarProductos() para asegurar que la DB esté lista
});

async function cargarCategoriasFiltro() {
    const select = document.getElementById('filtroCategoria');
    if (!select) return;

    try {
        const { data, error } = await supabaseClient
            .from('categorias')
            .select('nombre')
            .order('nombre');

        if (error) throw error;

        const valActual = select.value;
        select.innerHTML = '<option value="">Todas las categorías</option>' +
            data.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
        select.value = valActual;

    } catch (err) {
        console.error('Error cargando categorías para filtro:', err);
    }
}

// Eventos de ventana
window.onclick = function (e) {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
};

window.addEventListener('load', function () {
    const preloader = document.getElementById('preloader');
    if (preloader) {
        preloader.style.opacity = '0';
        setTimeout(() => preloader.style.display = 'none', 300);
    }
});

document.addEventListener('selectstart', function (e) {
    // Solo bloquear si no es un input o textarea
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        // e.preventDefault(); // Descomentar para activar bloqueo total
    }
});