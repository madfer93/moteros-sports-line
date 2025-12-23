/* ═══════════════════════════════════════════════════════════════
   MOTEROS SPORTS LINE - INDEX.JS v2.0
   Catálogo con Carrito, Promociones y Destacados
   ═══════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN E INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════

const { createClient } = supabase;
const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

// Estado global
let promocionesActivas = [];
let productosPromo = [];
let carrito = JSON.parse(localStorage.getItem('carrito_moteros') || '[]');
let posicionCarruselPromo = 0;
let autoPlayPromo = null;
const INTERVALO_AUTO = 5000;

// ═══════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════

function formatearPrecio(precio) {
    return parseInt(precio).toLocaleString('es-CO');
}

function mostrarToast(titulo, mensaje, esPromo = false) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${esPromo ? 'promo' : ''}`;
    toast.innerHTML = `
        <span class="toast-icon">${esPromo ? '🎉' : '✅'}</span>
        <div class="toast-content">
            <div class="toast-title">${titulo}</div>
            <div class="toast-message">${mensaje || ''}</div>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function actualizarContadorCarrito() {
    const total = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    const countEl = document.getElementById('cartFloatingCount');
    if (countEl) {
        countEl.textContent = total;
        countEl.classList.remove('bump');
        setTimeout(() => countEl.classList.add('bump'), 10);
    }
}

// ═══════════════════════════════════════════════════════════════
// CARRITO DE COMPRAS
// ═══════════════════════════════════════════════════════════════

function agregarAlCarritoPromo(productoId, precioOriginal, precioFinal, descuento, nombrePromo) {
    const producto = productosPromo.find(p => p.id === productoId);
    if (!producto) return;
    
    const existente = carrito.find(item => item.id === productoId);
    if (existente) {
        existente.cantidad += 1;
    } else {
        carrito.push({
            id: producto.id,
            id_producto: producto.id_producto,
            nombre: producto.nombre,
            marca: producto.marca,
            url_imagen: producto.url_imagen,
            precioOriginal,
            precioFinal,
            descuento,
            promocion: nombrePromo,
            cantidad: 1
        });
    }
    guardarCarrito();
    const ahorro = precioOriginal - precioFinal;
    mostrarToast('¡Agregado con descuento!', `${producto.nombre} (-${descuento}%) Ahorras $${formatearPrecio(ahorro)}`, true);
}

function agregarAlCarritoNormal(productoId, nombre, marca, precio, urlImagen) {
    const existente = carrito.find(item => item.id === productoId);
    if (existente) {
        existente.cantidad += 1;
    } else {
        carrito.push({
            id: productoId,
            nombre,
            marca,
            url_imagen: urlImagen,
            precioOriginal: precio,
            precioFinal: precio,
            descuento: 0,
            promocion: null,
            cantidad: 1
        });
    }
    guardarCarrito();
    mostrarToast('¡Agregado!', nombre);
}

function agregarAlCarritoRapido(productoId, nombre, marca, precio, urlImagen) {
    const existente = carrito.find(item => item.id === productoId);
    if (existente) {
        existente.cantidad += 1;
    } else {
        carrito.push({
            id: productoId,
            nombre,
            marca,
            url_imagen: urlImagen,
            precioOriginal: precio,
            precioFinal: precio,
            descuento: 0,
            promocion: null,
            cantidad: 1
        });
    }
    guardarCarrito();
    mostrarToast('¡Agregado al carrito!', nombre);
}

function cambiarCantidad(index, delta) {
    const nueva = carrito[index].cantidad + delta;
    if (nueva < 1) return eliminarDelCarrito(index);
    carrito[index].cantidad = nueva;
    guardarCarrito();
    renderizarCarrito();
}

function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    guardarCarrito();
    renderizarCarrito();
}

function vaciarCarrito() {
    if (confirm('¿Vaciar todo el carrito?')) {
        carrito = [];
        guardarCarrito();
        renderizarCarrito();
    }
}

function guardarCarrito() {
    localStorage.setItem('carrito_moteros', JSON.stringify(carrito));
    actualizarContadorCarrito();
}

function abrirCarrito() {
    renderizarCarrito();
    document.getElementById('modalCarrito').style.display = 'flex';
}

function cerrarCarrito() {
    document.getElementById('modalCarrito').style.display = 'none';
}

function renderizarCarrito() {
    const body = document.getElementById('carritoBody');
    const footer = document.getElementById('carritoFooter');
    
    if (!body || !footer) return;
    
    if (carrito.length === 0) {
        body.innerHTML = `
            <div class="cart-empty">
                <div class="cart-empty-icon">🛒</div>
                <p>Tu carrito está vacío</p>
                <p style="font-size:0.85rem; margin-top:0.5rem;">¡Aprovecha las promociones!</p>
            </div>
        `;
        footer.innerHTML = '';
        return;
    }
    
    body.innerHTML = carrito.map((item, index) => `
        <div class="cart-item">
            <img class="cart-item-img" src="${item.url_imagen || 'https://picsum.photos/400/300'}" onerror="this.src='https://picsum.photos/400/300'">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.nombre}</div>
                <div class="cart-item-brand">${item.marca}</div>
                ${item.promocion ? `<span class="cart-item-promo">🏷️ ${item.promocion} (-${item.descuento}%)</span>` : ''}
                <div class="cart-item-qty">
                    <button onclick="cambiarCantidad(${index}, -1)">−</button>
                    <span>${item.cantidad}</span>
                    <button onclick="cambiarCantidad(${index}, 1)">+</button>
                </div>
            </div>
            <div class="cart-item-prices">
                ${item.descuento > 0 ? `<div class="cart-item-original">$${formatearPrecio(item.precioOriginal)}</div>` : ''}
                <div class="cart-item-final">$${formatearPrecio(item.precioFinal)}</div>
            </div>
            <button class="cart-item-remove" onclick="eliminarDelCarrito(${index})">🗑️</button>
        </div>
    `).join('');

    let subtotal = 0, totalDescuentos = 0, totalFinal = 0;
    carrito.forEach(item => {
        const subOrig = item.precioOriginal * item.cantidad;
        const subFinal = item.precioFinal * item.cantidad;
        subtotal += subOrig;
        totalFinal += subFinal;
        totalDescuentos += (subOrig - subFinal);
    });

    footer.innerHTML = `
        <div class="cart-summary">
            <div class="cart-summary-row">
                <span>Subtotal:</span>
                <span>$${formatearPrecio(subtotal)}</span>
            </div>
            ${totalDescuentos > 0 ? `
                <div class="cart-summary-row discount">
                    <span>🎉 Descuentos:</span>
                    <span>-$${formatearPrecio(totalDescuentos)}</span>
                </div>
            ` : ''}
            <div class="cart-summary-row total">
                <span>TOTAL:</span>
                <span>$${formatearPrecio(totalFinal)}</span>
            </div>
        </div>
        <div class="cart-actions">
            <button class="btn-whatsapp-cart" onclick="enviarPedidoWhatsApp()">💬 Enviar Pedido</button>
            <button class="btn-vaciar" onclick="vaciarCarrito()">🗑️</button>
        </div>
    `;
}

function enviarPedidoWhatsApp() {
    if (carrito.length === 0) return alert('El carrito está vacío');
    
    let mensaje = `🏍️ *PEDIDO - MOTEROS SPORTS LINE*\n`;
    mensaje += `📅 ${new Date().toLocaleDateString('es-CO')}\n`;
    mensaje += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    let subtotal = 0, totalDescuentos = 0, totalFinal = 0;
    
    carrito.forEach((item, i) => {
        const subOrig = item.precioOriginal * item.cantidad;
        const subFinal = item.precioFinal * item.cantidad;
        subtotal += subOrig;
        totalFinal += subFinal;
        totalDescuentos += (subOrig - subFinal);
        
        mensaje += `*${i + 1}. ${item.nombre}*\n`;
        mensaje += `   Marca: ${item.marca}\n`;
        mensaje += `   Cant: ${item.cantidad}\n`;
        
        if (item.descuento > 0) {
            mensaje += `   P.Original: ~$${formatearPrecio(item.precioOriginal)}~\n`;
            mensaje += `   🏷️ *${item.promocion}* (-${item.descuento}%)\n`;
            mensaje += `   *P.Final: $${formatearPrecio(item.precioFinal)}*\n`;
        } else {
            mensaje += `   Precio: $${formatearPrecio(item.precioFinal)}\n`;
        }
        mensaje += `   Subtotal: *$${formatearPrecio(subFinal)}*\n\n`;
    });
    
    mensaje += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    mensaje += `📋 *RESUMEN*\n\n`;
    mensaje += `   Subtotal: $${formatearPrecio(subtotal)}\n`;
    
    if (totalDescuentos > 0) {
        mensaje += `   🎉 Descuentos: -$${formatearPrecio(totalDescuentos)}\n`;
    }
    
    mensaje += `\n   💰 *TOTAL: $${formatearPrecio(totalFinal)}*\n`;
    mensaje += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    mensaje += `¡Gracias! 🙌`;
    
    const numero = CONFIG.WHATSAPP?.numero || '573113408416';
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`, '_blank');
}

// ═══════════════════════════════════════════════════════════════
// PROMOCIONES Y CARRUSEL
// ═══════════════════════════════════════════════════════════════

async function cargarPromociones() {
    try {
        const { data: promos, error: errorPromos } = await supabaseClient
            .from('promociones')
            .select('*')
            .eq('estado', 'Activa');
        
        if (errorPromos) throw errorPromos;
        
        if (!promos || promos.length === 0) {
            const seccion = document.getElementById('seccionPromociones');
            if (seccion) seccion.style.display = 'none';
            return;
        }
        
        promocionesActivas = promos;
        
        const { data: productos, error: errorProd } = await supabaseClient
            .from('productos')
            .select('*')
            .eq('estado', 'Activo');
        
        if (errorProd) throw errorProd;
        
        productosPromo = productos || [];
        renderizarCarruselPromo();
        iniciarAutoPlayPromo();
        
    } catch (error) {
        console.error('Error cargando promociones:', error);
        const seccion = document.getElementById('seccionPromociones');
        if (seccion) seccion.style.display = 'none';
    }
}

function renderizarCarruselPromo() {
    const track = document.getElementById('promoCarouselTrack');
    const indicators = document.getElementById('promoIndicators');
    
    if (!track) return;
    
    let cards = [];
    
    promocionesActivas.forEach(promo => {
        const idsProductos = promo.productos_incluidos 
            ? promo.productos_incluidos.split(',').map(id => id.trim()).filter(id => id && id !== '000') 
            : [];
        
        idsProductos.forEach(idProd => {
            const producto = productosPromo.find(p => 
                p.id_producto === idProd || 
                p.id_producto === `PROD${idProd}` || 
                String(p.id).includes(idProd)
            );
            
            if (producto) {
                const descuento = parseFloat(promo.descuento) || 0;
                const precioOriginal = producto.precio;
                const precioConDescuento = Math.round(precioOriginal * (1 - descuento / 100));
                cards.push({ producto, promo, precioOriginal, precioConDescuento, descuento });
            }
        });
    });
    
    // Fallback si no hay productos vinculados
    if (cards.length === 0 && productosPromo.length > 0) {
        promocionesActivas.forEach((promo, i) => {
            const producto = productosPromo[i % productosPromo.length];
            const descuento = parseFloat(promo.descuento) || 0;
            cards.push({
                producto,
                promo,
                precioOriginal: producto.precio,
                precioConDescuento: Math.round(producto.precio * (1 - descuento / 100)),
                descuento
            });
        });
    }
    
    cards = cards.slice(0, 12);
    
    if (cards.length === 0) {
        const seccion = document.getElementById('seccionPromociones');
        if (seccion) seccion.style.display = 'none';
        return;
    }
    
    track.innerHTML = cards.map((item, index) => `
        <div class="promo-card" data-index="${index}">
            <span class="promo-badge">-${item.descuento}%</span>
            <div class="promo-card-image">
                <img src="${item.producto.url_imagen || 'https://picsum.photos/400/300'}" 
                     alt="${item.producto.nombre}" 
                     onerror="this.src='https://picsum.photos/400/300'">
            </div>
            <div class="promo-card-info">
                <div class="promo-name">${item.promo.nombre}</div>
                <h3 title="${item.producto.nombre}">${item.producto.nombre}</h3>
                <div class="promo-prices">
                    <span class="precio-original">$${formatearPrecio(item.precioOriginal)}</span>
                    <span class="precio-promo">$${formatearPrecio(item.precioConDescuento)}</span>
                </div>
                <div class="promo-vigencia">
                    ⏰ ${item.promo.fecha_inicio || 'Hoy'} al ${item.promo.fecha_fin || 'Agotar stock'}
                </div>
                <button class="promo-btn-agregar" onclick="agregarAlCarritoPromo('${item.producto.id}', ${item.precioOriginal}, ${item.precioConDescuento}, ${item.descuento}, '${item.promo.nombre.replace(/'/g, "\\'")}')">
                    🛒 Agregar al Carrito
                </button>
            </div>
        </div>
    `).join('');
    
    // Indicadores
    if (indicators) {
        const numIndicadores = Math.ceil(cards.length / getCardsVisibles());
        indicators.innerHTML = Array(numIndicadores).fill(0).map((_, i) => 
            `<div class="promo-indicator ${i === 0 ? 'active' : ''}" onclick="irASlidePromo(${i})"></div>`
        ).join('');
    }
}

function getCardsVisibles() {
    const width = window.innerWidth;
    if (width < 600) return 1;
    if (width < 900) return 2;
    if (width < 1200) return 3;
    return 4;
}

function moverCarruselPromo(direccion) {
    const track = document.getElementById('promoCarouselTrack');
    const cards = track?.querySelectorAll('.promo-card');
    if (!cards || !cards.length) return;
    
    const cardWidth = cards[0].offsetWidth + 24;
    const visibles = getCardsVisibles();
    const maxPosicion = Math.max(0, cards.length - visibles);
    
    posicionCarruselPromo += direccion;
    if (posicionCarruselPromo < 0) posicionCarruselPromo = maxPosicion;
    if (posicionCarruselPromo > maxPosicion) posicionCarruselPromo = 0;
    
    track.style.transform = `translateX(-${posicionCarruselPromo * cardWidth}px)`;
    actualizarIndicadoresPromo();
    reiniciarAutoPlayPromo();
}

function irASlidePromo(index) {
    posicionCarruselPromo = index * getCardsVisibles();
    const track = document.getElementById('promoCarouselTrack');
    const cards = track?.querySelectorAll('.promo-card');
    if (!cards || !cards.length) return;
    
    const cardWidth = cards[0].offsetWidth + 24;
    track.style.transform = `translateX(-${posicionCarruselPromo * cardWidth}px)`;
    actualizarIndicadoresPromo();
    reiniciarAutoPlayPromo();
}

function actualizarIndicadoresPromo() {
    const indicators = document.querySelectorAll('.promo-indicator');
    const visibles = getCardsVisibles();
    const activeIndex = Math.floor(posicionCarruselPromo / visibles);
    indicators.forEach((ind, i) => ind.classList.toggle('active', i === activeIndex));
}

function iniciarAutoPlayPromo() {
    autoPlayPromo = setInterval(() => moverCarruselPromo(1), INTERVALO_AUTO);
}

function reiniciarAutoPlayPromo() {
    if (autoPlayPromo) clearInterval(autoPlayPromo);
    iniciarAutoPlayPromo();
}

// ═══════════════════════════════════════════════════════════════
// PRODUCTOS DESTACADOS
// ═══════════════════════════════════════════════════════════════

async function cargarDestacados() {
    try {
        const { data: productos, error } = await supabaseClient
            .from('productos')
            .select('*')
            .eq('estado', 'Activo')
            .eq('destacado', true)
            .limit(6);
        
        if (error) throw error;
        
        const grid = document.getElementById('productosDestacados');
        if (!grid) return;
        
        if (!productos || productos.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #666;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⭐</div>
                    <h3>Próximamente productos destacados</h3>
                    <p style="margin-top: 0.5rem;">
                        <a href="catalogo.html" style="color: #ff6b00; text-decoration: none; font-weight: 600;">
                            Ver catálogo completo →
                        </a>
                    </p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = productos.map(p => `
            <div class="producto-card">
                <div class="producto-imagen" style="position:relative;">
                    <img src="${p.url_imagen || 'https://picsum.photos/400/300'}" 
                         alt="${p.nombre}" 
                         onerror="this.src='https://picsum.photos/400/300'">
                    <span class="badge-categoria">${p.categoria}</span>
                    <span class="badge-destacado">⭐ DESTACADO</span>
                </div>
                <div class="producto-info">
                    <h3>${p.nombre}</h3>
                    <p class="marca">${p.marca}</p>
                    <p class="descripcion">${p.descripcion_corta || ''}</p>
                    <div class="producto-footer">
                        <span class="precio">$${formatearPrecio(p.precio)}</span>
                        <button class="btn-agregar-rapido" onclick="agregarAlCarritoRapido('${p.id}', '${p.nombre.replace(/'/g, "\\'")}', '${p.marca}', ${p.precio}, '${p.url_imagen || ''}')">
                            🛒 Agregar
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Actualizar contador total
        const { count } = await supabaseClient
            .from('productos')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'Activo');
        
        const totalEl = document.getElementById('totalProductos');
        if (totalEl) totalEl.textContent = count || 0;
        
        await contarCategorias();
        
    } catch (error) {
        console.error('Error cargando destacados:', error);
    }
}

async function contarCategorias() {
    const cats = {
        'Cascos': 'cascos',
        'Guantes': 'guantes',
        'Chaquetas': 'chaquetas',
        'Botas': 'botas',
        'Intercomunicadores': 'intercomunicadores',
        'Camaras': 'camaras'
    };
    
    for (const [cat, id] of Object.entries(cats)) {
        const { count } = await supabaseClient
            .from('productos')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'Activo')
            .eq('categoria', cat);
        
        const elem = document.getElementById('count-' + id);
        if (elem) elem.textContent = (count || 0) + ' productos';
    }
}

function irATienda(categoria) {
    window.location.href = `catalogo.html?categoria=${encodeURIComponent(categoria)}`;
}

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN DINÁMICA
// ═══════════════════════════════════════════════════════════════

async function cargarConfiguracion() {
    try {
        const { data: config, error } = await supabaseClient
            .from('configuracion_sistema')
            .select('*')
            .single();
        
        if (error || !config) return;
        
        // Logo
        if (config.logo_url) {
            const logoEl = document.getElementById('siteLogo');
            if (logoEl) logoEl.src = config.logo_url;
        }
        
        // Título
        if (config.nombre_tienda) {
            const titleEl = document.getElementById('siteTitle');
            if (titleEl) titleEl.textContent = config.nombre_tienda;
            document.title = config.nombre_tienda + ' | Inicio';
        }
        
    } catch (error) {
        console.error('Error cargando configuración:', error);
    }
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', () => {
    console.log('🏍️ Moteros Sports Line - Iniciando...');
    
    actualizarContadorCarrito();
    cargarConfiguracion();
    cargarPromociones();
    cargarDestacados();
    
    // Event listeners para carrusel
    const track = document.getElementById('promoCarouselTrack');
    if (track) {
        track.addEventListener('mouseenter', () => {
            if (autoPlayPromo) clearInterval(autoPlayPromo);
        });
        track.addEventListener('mouseleave', iniciarAutoPlayPromo);
    }
});

// Cerrar modales al hacer clic fuera
window.onclick = (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
};

// Ajustar carrusel en resize
window.addEventListener('resize', () => {
    const track = document.getElementById('promoCarouselTrack');
    const cards = track?.querySelectorAll('.promo-card');
    if (cards && cards.length) {
        const cardWidth = cards[0].offsetWidth + 24;
        track.style.transform = `translateX(-${posicionCarruselPromo * cardWidth}px)`;
    }
});

// ═══════════════════════════════════════════════════════════════
// EXPORTS GLOBALES (para onclick en HTML)
// ═══════════════════════════════════════════════════════════════

window.agregarAlCarritoPromo = agregarAlCarritoPromo;
window.agregarAlCarritoNormal = agregarAlCarritoNormal;
window.agregarAlCarritoRapido = agregarAlCarritoRapido;
window.cambiarCantidad = cambiarCantidad;
window.eliminarDelCarrito = eliminarDelCarrito;
window.vaciarCarrito = vaciarCarrito;
window.abrirCarrito = abrirCarrito;
window.cerrarCarrito = cerrarCarrito;
window.enviarPedidoWhatsApp = enviarPedidoWhatsApp;
window.moverCarruselPromo = moverCarruselPromo;
window.irASlidePromo = irASlidePromo;
window.irATienda = irATienda;