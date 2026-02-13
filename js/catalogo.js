// ═══════════════════════════════════════════════════════════════
// MOTEROS SPORTS LINE - CATÁLOGO JAVASCRIPT
// ═══════════════════════════════════════════════════════════════

// Cliente Supabase
// Cliente Supabase (Reutilizar global si existe para evitar warning GoTrueClient)
const supabaseClient = window.supabaseClient || supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

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
    let variante = null;

    // Validación de Variante (DESACTIVADA POR SOLICITUD)
    /*
    if (productoActual.variantes && productoActual.variantes.length > 0) {
        variante = document.getElementById('varianteSeleccionada').value;
        if (!variante) {
            mostrarToast('⚠️ Selecciona una opción', 'Debes elegir variante (Color/Talla)', 'warning');

            // Animación de error en contenedor
            const container = document.getElementById('contenedorVariantes');
            if (container) {
                container.style.animation = 'shake 0.5s ease';
                setTimeout(() => container.style.animation = '', 500);
            }
            return;
        }
    }
    */
    // Intentamos capturar si seleccionó algo, pero es opcional
    const varianteInput = document.getElementById('varianteSeleccionada');
    if (varianteInput && varianteInput.value) variante = varianteInput.value;

    // ID único compuesto para carrito (ID_producto + Variante)
    const cartId = variante ? `${productoActual.id}-${variante}` : productoActual.id;
    const nombreDisplay = variante ? `${productoActual.nombre} (${variante})` : productoActual.nombre;

    const existente = carrito.find(item => item.cartId === cartId); // Usamos cartId para diferenciar
    if (existente) {
        existente.cantidad += cantidad;
    } else {
        const infoPrecio = window.PromocionesManager
            ? window.PromocionesManager.calcularPrecio(productoActual.precio, productoActual.id)
            : { precioFinal: productoActual.precio, tieneDescuento: false };

        carrito.push({
            id: productoActual.id, // ID original limpio para DB
            cartId: cartId,        // ID compuesto para frontend
            nombre: productoActual.nombre,
            variante: variante,    // Guardar dato variante
            marca: productoActual.marca,
            precio: productoActual.precio,
            url_imagen: productoActual.url_imagen,
            cantidad: cantidad,
            descuento: 0
        });
    }

    localStorage.setItem('carrito_moteros', JSON.stringify(carrito));
    actualizarContadorCarrito();
    mostrarToast('Carrito', `✅ ${cantidad} x ${nombreDisplay} agregado`);
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
            precio: producto.precio,
            url_imagen: producto.url_imagen,
            cantidad: 1,
            descuento: 0
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
                        ${item.marca} <span class="precio-carrito-ocultar">• $${parseInt(item.precio).toLocaleString('es-CO')} c/u</span>
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
    if (window.PromocionesManager && window.PromocionesManager.cargado) {
        window.PromocionesManager.validarCarrito(carrito);
    }
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
        const varianteInfo = item.variante ? ` [${item.variante}]` : '';
        mensaje += `• ${item.cantidad} x ${item.nombre}${varianteInfo}\n  ${item.marca}\n\n`;
    });
    mensaje += `¡Gracias! 🙌`;

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

        // Cargar reseñas APROBADAS para cálculo de estrellas real
        const { data: resenas } = await supabaseClient
            .from('producto_resenas')
            .select('id_producto, estrellas')
            .eq('aprobado', true);
        const cal = {};
        if (resenas) {
            resenas.forEach(r => {
                if (!cal[r.id_producto]) cal[r.id_producto] = { sum: 0, count: 0 };
                cal[r.id_producto].sum += r.estrellas;
                cal[r.id_producto].count++;
            });
        }

        todosLosProductos = (data || []).map(p => {
            const c = cal[p.id] || cal[p.id_producto];
            return {
                ...p,
                rating: c ? (c.sum / c.count).toFixed(1) : 0,
                ratingCount: c ? c.count : 0
            };
        });

        productosFiltrados = [...todosLosProductos];

        mostrarProductos();
        await cargarCategoriasFiltro();
        cargarTallasFiltro(); // Nueva función para llenar el filtro de tallas
        actualizarContadorCarrito();

    } catch (err) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error:', err);
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

// Calcula relevancia de un producto respecto al término de búsqueda
function calcularRelevancia(producto, termino) {
    let score = 0;
    const nombre = (producto.nombre || '').toLowerCase();
    const marca = (producto.marca || '').toLowerCase();
    const categoria = (producto.categoria || '').toLowerCase();
    const desc = (producto.descripcion_corta || '').toLowerCase();

    // Nombre empieza con el término → máxima relevancia
    if (nombre.startsWith(termino)) score += 10;
    // Nombre contiene el término (como palabra)
    else if (nombre.includes(termino)) score += 6;

    // Categoría coincide
    if (categoria.includes(termino)) score += 5;

    // Marca coincide
    if (marca.includes(termino)) score += 3;

    // Solo descripción → baja relevancia
    if (score === 0 && desc.includes(termino)) score += 1;

    return score;
}

function aplicarFiltros() {
    const cat = document.getElementById('filtroCategoria').value;
    const talEl = document.getElementById('filtroTalla'); // Nuevo filtro
    const tal = talEl ? talEl.value : '';
    const rate = document.getElementById('filtroCalificacion') ? document.getElementById('filtroCalificacion').value : '';
    const bus = document.getElementById('buscarProducto').value.toLowerCase();

    productosFiltrados = todosLosProductos.filter(p => {
        // Filtro Categoría (Case Insensitive)
        if (cat) {
            const catProd = (p.categoria || '').toLowerCase().trim();
            const catFiltro = cat.toLowerCase().trim();
            if (catProd !== catFiltro) return false;
        }

        if (tal) {
            let pTallas = [];
            if (Array.isArray(p.tallas)) pTallas = p.tallas;
            else if (typeof p.tallas === 'string') pTallas = p.tallas.split(',').map(t => t.trim());

            // Si el producto no tiene tallas definidas, no pasa el filtro si se seleccionó una talla
            if (pTallas.length === 0) return false;

            // Verificar si incluye la talla seleccionada (exact match)
            if (!pTallas.includes(tal)) return false;
        }
        if (rate) {
            if (parseFloat(p.rating || 0) < parseInt(rate)) return false;
        }
        if (bus) {
            const busqueda = `${p.nombre} ${p.marca} ${p.categoria || ''} ${p.descripcion_corta || ''}`.toLowerCase();
            if (!busqueda.includes(bus)) return false;
        }
        return true;
    });

    // Ordenar por relevancia si hay búsqueda de texto
    if (bus) {
        productosFiltrados.sort((a, b) => {
            const scoreA = calcularRelevancia(a, bus);
            const scoreB = calcularRelevancia(b, bus);
            return scoreB - scoreA; // Mayor score primero
        });
    }

    mostrarProductos();
}

function limpiarFiltros() {
    document.getElementById('filtroCategoria').value = '';
    const talEl = document.getElementById('filtroTalla');
    if (talEl) talEl.value = '';
    if (document.getElementById('filtroCalificacion')) document.getElementById('filtroCalificacion').value = '';
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
        // Lógica para mostrar tallas en la tarjeta
        let tallasHTML = '';
        if (p.tallas) {
            let tallasArr = Array.isArray(p.tallas) ? p.tallas : (typeof p.tallas === 'string' ? p.tallas.split(',').map(t => t.trim()) : []);

            // FILTRO VISUAL: No mostrar "Única", "Unica", "U", "N/A"
            tallasArr = tallasArr.filter(t => {
                const clean = t.toLowerCase().replace(/[^a-z0-9]/g, '');
                return !['unica', 'u', 'na', 'n/a', 'undefined'].includes(clean);
            });

            if (tallasArr.length > 0) {
                // Inline style for proper alignment in footer
                tallasHTML = `
                 <div style="display:flex; gap:3px; flex-wrap:wrap; align-items:center;">
                    ${tallasArr.slice(0, 4).map(t => `<span style="font-size:0.7rem; background:#f1f5f9; padding:2px 6px; border-radius:4px; color:#64748b; border:1px solid #cbd5e1; font-weight:600;">${t}</span>`).join('')}
                    ${tallasArr.length > 4 ? '<span style="font-size:0.7rem; color:#94a3b8;">+</span>' : ''}
                 </div>`;
            }
        }

        return `
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
                <div style="font-size:0.85rem; color:#f59e0b; margin-bottom:0.25rem;">
                    ${p.ratingCount > 0 ? '⭐'.repeat(Math.round(p.rating)) + ` <span style="color:#64748b;">(${p.ratingCount})</span>` : '<span style="color:#94a3b8; font-size:0.8rem;">Sin reseñas</span>'}
                </div>
                <p class="producto-marca">${p.marca}</p>
                <p class="producto-descripcion">${p.descripcion_corta || 'Producto de alta calidad'}</p>
                <div class="producto-footer" style="flex-direction: column; gap: 0.5rem; align-items: stretch;">
                    <div style="display: flex; justify-content: space-between; align-items: center; min-height: 38px;">
                        <span class="producto-precio" style="display:none;">$${parseInt(p.precio).toLocaleString('es-CO')}</span>
                        ${tallasHTML}
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
            
            <!-- COL 1: IMAGEN & VISUAL -->
            <div class="column-media">
                <div class="main-image-container" style="position:relative; border-radius:12px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.05); margin-bottom: 1rem; width:100%; padding-top: 0 !important;">
                    ${infoP.tieneDescuento ? `<span class="discount-pill" style="position:absolute; top:0.5rem; left:0.5rem; background:#ef4444; color:white; padding:0.25rem 0.75rem; border-radius:15px; font-weight:700; font-size:0.8rem; z-index:10;">-${infoP.porcentajeDescuento}% OFF</span>` : ''}
                    <img src="${productoActual.url_imagen || PLACEHOLDER_LG}" 
                         alt="${productoActual.nombre}" 
                         style="width:100%; max-height: 400px; object-fit:contain; display:block; margin:auto;"
                         onerror="this.src='${PLACEHOLDER_LG}'">
                </div>
                
                <!-- FILA DE SELECTORES (COLORES Y TALLAS) - SIDE BY SIDE -->
                <div style="display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;">
                    
                    <!-- 1. COLORES (VARIANTES) -->
                    <div class="variantes-section" style="flex: 1; min-width: 200px; background:#f8fafc; padding:0.8rem; border-radius:8px; border:1px solid #e2e8f0;">
                         <h5 style="margin-bottom: 0.5rem; font-weight: 700; color: #334155; font-size:0.85rem;">Colores:</h5>
                         ${productoActual.variantes && productoActual.variantes.length > 0 ? `
                            <div id="contenedorVariantes" style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-start; align-items: center;"></div>
                         ` : '<div style="color:#94a3b8; font-size:0.8rem;">N/A</div>'}
                         <input type="hidden" id="varianteSeleccionada" value="">
                    </div>

                    <!-- 2. TALLAS -->
                    <div class="variantes-section" style="flex: 1; min-width: 200px; background:#f8fafc; padding:0.8rem; border-radius:8px; border:1px solid #e2e8f0;">
                        <h5 style="margin-bottom: 0.5rem; font-weight: 700; color: #334155; font-size:0.85rem;">Tallas:</h5>
                        ${(productoActual.tallas && productoActual.tallas.length > 0) || (productoActual.tallas && typeof productoActual.tallas === 'string') ? `
                            <div id="contenedorTallas" style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-start; align-items: center;"></div>
                        ` : '<div style="color:#94a3b8; font-size:0.8rem;">Única</div>'}
                        <input type="hidden" id="tallaSeleccionada" value="">
                    </div>

                </div>

                <!-- Trust Badges -->
                <div class="product-trust-badges" style="width:100%; display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; background:#f8fafc; padding:0.75rem; border-radius:8px;">
                    <div class="trust-badge" style="display:flex; align-items:center; gap:0.25rem; font-size:0.8rem; color:#64748b;">
                        <span>🛡️</span> Envío Seguro
                    </div>
                    <div class="trust-badge" style="display:flex; align-items:center; gap:0.25rem; font-size:0.8rem; color:#64748b;">
                        <span>📦</span> Stock Real
                    </div>
                    <div class="trust-badge" style="display:flex; align-items:center; gap:0.25rem; font-size:0.8rem; color:#64748b;">
                        <span>✅</span> Garantía
                    </div>
                </div>
            </div>

            <!-- COL 2: INFO & COMPRA & SPECS (Center) -->
            <div class="column-info">
                <!-- Header Info -->
                <div class="product-header" style="border-bottom:1px solid #e2e8f0; padding-bottom:1rem; margin-bottom:1rem;">
                    <span class="category-tag" style="background:#fff7ed; color:#ea580c; padding:0.25rem 0.75rem; border-radius:15px; font-size:0.75rem; font-weight:700; text-transform:uppercase;">${productoActual.categoria}</span>
                    <h2 style="font-size:1.75rem; margin:0.5rem 0; line-height:1.2; color:#1e293b;">${productoActual.nombre}</h2>
                    <p style="color:#64748b; margin:0; font-size:0.9rem;">Marca: <strong style="color:#334155;">${productoActual.marca}</strong></p>
                </div>

                <div class="product-price-section" style="margin-bottom:1rem;">
                    <span class="current-price" style="font-size:2.2rem; font-weight:800; color:#0f172a;">$${parseInt(productoActual.precio).toLocaleString('es-CO')}</span>
                </div>

                <!-- Descripción & Specs -->
                <div style="flex:1;">
                    <h4 style="font-size:1rem; font-weight:700; color:#334155; margin-bottom:0.5rem;">Descripción</h4>
                    <p style="color:#475569; line-height:1.5; margin-bottom:1.5rem; font-size:0.95rem;">
                        ${productoActual.descripcion_corta || 'Producto disponible en nuestras tiendas.'}
                    </p>

                    <!-- Ficha Técnica -->
                    ${productoActual.descripcion_tecnica ? `
                    <div style="margin-bottom: 2rem; background: #fffcf8; padding: 1.25rem; border-radius: 10px; border: 1px dashed #e2e8f0; display: flex; justify-content: space-between; align-items: flex-start; gap: 1.5rem;">
                         <div style="flex: 1;">
                             <h4 class="section-title" style="margin-bottom:0.75rem; color:#334155; font-size:0.95rem; font-weight:700;">📋 Ficha Técnica</h4>
                             <p style="color:#475569; line-height:1.6; white-space: pre-line; margin:0; font-size:0.9rem;">${productoActual.descripcion_tecnica}</p>
                         </div>
                         <div style="flex-shrink: 0; width: 140px; opacity: 0.8; align-self: center; margin-right: 3rem;">
                             <!-- Logo Sticker -->
                             <img src="https://pbblthbrdkevuyjxyuar.supabase.co/storage/v1/object/public/productos-imagenes/moteros%20logo.jpg" 
                                  onerror="this.style.display='none'"
                                  alt="Moteros" 
                                  style="width: 100%; height: auto; display: block; border-radius:50%; opacity:0.8; filter: none;">
                         </div>
                    </div>
                    ` : ''}
                </div>

                <!-- Botones de Acción (Al final del scroll del centro) -->
                <div class="purchase-actions" style="margin-top:1.5rem; padding-top:1rem; border-top:1px solid #f1f5f9;">
                    <div style="display:flex; gap:0.75rem; margin-bottom:0.75rem;">
                        <div class="quantity-selector" style="border:1px solid #e2e8f0; border-radius:8px; display:flex; align-items:center; width:100px;">
                             <button style="flex:1; border:none; background:transparent; font-size:1rem; cursor:pointer;" onclick="const i=document.getElementById('cantidadDetalle'); if(i.value>1) i.value--">−</button>
                             <input type="number" id="cantidadDetalle" value="1" min="1" readonly style="width:35px; text-align:center; border:none; font-weight:700; font-size:1rem;">
                             <button style="flex:1; border:none; background:transparent; font-size:1rem; cursor:pointer;" onclick="document.getElementById('cantidadDetalle').value++">+</button>
                        </div>
                        <button onclick="agregarAlCarrito()" style="flex:1; background:linear-gradient(135deg,#ff6b00,#ea580c); color:white; border:none; border-radius:8px; font-weight:700; font-size:1rem; cursor:pointer; padding:0.75rem;">
                            🛒 Agregar
                        </button>
                    </div>
                    <a href="https://wa.me/${CONFIG.WHATSAPP.numero}" target="_blank" id="btnWhatsappDetalle"
                       style="display:block; text-align:center; padding:0.6rem; background:#25D366; color:white; border-radius:8px; text-decoration:none; font-weight:600; font-size:0.95rem;">
                        📱 Consultar por WhatsApp
                    </a>
                </div>
            </div>

            <!-- COL 3: SOLO RESEÑAS, CALIFICACION Y COMENTARIOS (Right) -->
            <div class="column-extras">
                
                <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid #e2e8f0; padding-bottom:1rem;">
                        <div>
                            <h4 style="margin:0; font-size:1.1rem; color:#334155; font-weight:700;">Opiniones</h4>
                            <span style="font-size:0.8rem; color:#94a3b8;">${productoActual.ratingCount || 0} valoraciones</span>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-weight:900; color:#334155; font-size:1.8rem; line-height:1;">${productoActual.rating || '0.0'}</div>
                            <div style="color:#f59e0b; font-size:0.9rem;">★ ★ ★ ★ ★</div>
                        </div>
                    </div>
                    
                    <button onclick="document.getElementById('formResena').style.display = document.getElementById('formResena').style.display === 'none' ? 'block' : 'none'" 
                        class="btn-primary" style="width:100%; margin-bottom:1rem; padding:0.6rem; font-size:0.9rem; border-radius:8px; background:white; color:#ff6b00; border:1px solid #ff6b00;">
                        ✍️ Escribir mi opinión
                    </button>

                    <!-- Formulario (Oculto) -->
                    <div id="formResena" style="display:none; background:#fff7ed; padding:1rem; border-radius:8px; margin-bottom:1.5rem; border:1px solid #ffedd5;">
                        <input type="hidden" id="resenaProductoId" value="${productoActual.id}">
                        <div style="display:flex; flex-direction:column; gap:0.5rem;">
                            <label style="font-size:0.85rem; font-weight:700; color:#ea580c;">Tu Calificación:</label>
                            <div class="rating-input" style="font-size:1.5rem; cursor:pointer; color:#fbbf24;">
                                <span onclick="setRating(1)">☆</span><span onclick="setRating(2)">☆</span><span onclick="setRating(3)">☆</span><span onclick="setRating(4)">☆</span><span onclick="setRating(5)">☆</span>
                            </div>
                            <input type="hidden" id="resenaEstrellas" value="0">
                            <input type="text" id="resenaNombre" placeholder="Tu Nombre" class="form-control" style="font-size:0.85rem; padding:0.5rem; border:1px solid #e2e8f0; border-radius:6px;">
                            <textarea id="resenaComentario" placeholder="¿Qué te pareció?" class="form-control" rows="2" style="font-size:0.85rem; padding:0.5rem; border:1px solid #e2e8f0; border-radius:6px;"></textarea>
                            <button onclick="enviarResenaCliente()" class="btn-primary" style="width:100%; padding:0.5rem; font-size:0.9rem; margin-top:0.5rem;">Publicar</button>
                        </div>
                    </div>

                    <!-- Lista de Reseñas -->
                    <div id="listaResenasContainer">
                        <!-- Inyectado dinámicamente -->
                        <div style="display:flex; justify-content:center; align-items:center; height:100px;">
                            <div class="spinner"></div>
                        </div>
                    </div>
                    
                    <!-- Botón Ver Más (Oculto por defecto, se maneja en JS) -->
                    <button id="btnVerMasResenas" style="display:none; width:100%; margin-top:1rem; padding:0.5rem; background:#f1f5f9; border:none; color:#64748b; font-weight:600; cursor:pointer; border-radius:6px;">
                        Ver comentarios antiguos
                    </button>
                </div>
            </div>
        </div>
    `;

    // Cargar reviews asíncronamente
    setTimeout(() => cargarResenasProducto(productoActual.id), 100);

    // Renderizar opciones de variantes (chips confirmados)
    if (productoActual.variantes && productoActual.variantes.length > 0) {
        const container = document.getElementById('contenedorVariantes');
        if (container) {
            let opciones = [];

            // Prioridad: Stock real -> Variantes simples registradas
            if (productoActual.stock_variantes && Object.keys(productoActual.stock_variantes).length > 0) {
                opciones = Object.keys(productoActual.stock_variantes);
            } else {
                // Si no hay stock detallado, usamos la lista de variantes (que puede ser ["Rojo", "Azul"])
                opciones = Array.isArray(productoActual.variantes) ? productoActual.variantes : [];
            }

            if (opciones.length === 0) {
                container.innerHTML = '<span style="color:#64748b; font-size:0.9rem;">No hay opciones específicas registradas.</span>';
            } else {
                // MAPA DE COLORES PARA CIRCULOS
                const colorMap = {
                    'negro': '#000000', 'negra': '#000000',
                    'blanco': '#ffffff', 'blanca': '#ffffff',
                    'rojo': '#ef4444', 'roja': '#ef4444',
                    'azul': '#3b82f6',
                    'verde': '#22c55e',
                    'amarillo': '#eab308', 'amarilla': '#eab308',
                    'gris': '#64748b',
                    'morado': '#a855f7', 'morada': '#a855f7',
                    'rosa': '#ec4899', 'rosado': '#ec4899', 'rosada': '#ec4899',
                    'naranja': '#f97316',
                    'cafe': '#78350f', 'café': '#78350f', 'marron': '#78350f', 'marrón': '#78350f',
                    'cian': '#06b6d4',
                    'mate': '#333333',
                    'fucsia': '#d946ef', 'fuscia': '#d946ef',
                    'dorado': '#fbbf24', 'dorada': '#fbbf24',
                    'plateado': '#94a3b8', 'plateada': '#94a3b8',
                    'beige': '#f5f5dc',
                    'turquesa': '#2dd4bf',
                    'vino': '#881337', 'vinotinto': '#881337',
                    'lila': '#c084fc',
                    'neon': '#ccff00', 'neón': '#ccff00',
                    'multicolor': 'linear-gradient(45deg, red, blue)'
                };

                opciones.forEach(opt => {
                    const btn = document.createElement('button');
                    btn.className = 'variant-chip';

                    // Limpiar label
                    let label = opt;
                    if (typeof opt !== 'string') label = JSON.stringify(opt);
                    label = label.replace(/-/g, ' ').replace(/[{"}]/g, '');

                    // Detectar si es color
                    const labelLower = label.toLowerCase().trim();
                    const esColor = colorMap[labelLower];

                    // --- Mostrar Stock Disponible si existe ---
                    let stockTexto = '';
                    let stockVars = productoActual.stock_variantes;
                    if (typeof stockVars === 'string') {
                        try { stockVars = JSON.parse(stockVars); } catch (e) { stockVars = {}; }
                    }

                    if (stockVars && stockVars[opt] !== undefined) {
                        stockTexto = ` (${stockVars[opt]})`;
                    }

                    if (esColor) {
                        // Renderizar como círculo de color
                        btn.title = label + stockTexto; // Tooltip con nombre
                        btn.style.cssText = `
                            width: 32px;
                            height: 32px;
                            border-radius: 50%;
                            background-color: ${esColor};
                            border: 2px solid #e2e8f0;
                            cursor: pointer;
                            transition: transform 0.2s, border-color 0.2s;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                        `;
                        // Borde extra para blanco
                        if (labelLower === 'blanco') btn.style.border = '2px solid #cbd5e1';
                    } else {
                        // Renderizar como chip normal
                        btn.textContent = label + stockTexto;
                        btn.style.cssText = `
                            padding: 0.5rem 1rem;
                            border: 2px solid #e2e8f0;
                            border-radius: 2rem;
                            background: white;
                            cursor: pointer;
                            font-size: 0.9rem;
                            transition: all 0.2s;
                        `;
                    }

                    btn.onclick = () => {
                        // Reset visual selection
                        document.querySelectorAll('#contenedorVariantes .variant-chip').forEach(b => {
                            if (b.style.borderRadius === '50%') {
                                // Es color
                                b.style.transform = 'scale(1)';
                                b.style.borderColor = '#e2e8f0';
                                if (b.title.toLowerCase().includes('blanco')) b.style.borderColor = '#cbd5e1';
                            } else {
                                // Es chip normal
                                b.style.borderColor = '#e2e8f0';
                                b.style.background = 'white';
                                b.style.color = 'black';
                            }
                        });

                        // Selección activa
                        if (esColor) {
                            btn.style.transform = 'scale(1.2)';
                            btn.style.borderColor = '#ea580c'; // Naranja selección
                        } else {
                            btn.style.borderColor = '#ea580c';
                            btn.style.background = '#fff7ed';
                            btn.style.color = '#ea580c';
                        }

                        // Actualizar input COLOR (Hidden original) para persistencia
                        // Pero OJO: ahora 'varianteSeleccionada' sera la combinacion final?
                        // Mejor: guardamos el color en un attribute o variable, y llamamos update.
                        // Para minima invasion: dejamos que viarignteSeleccionada sea el COMBINADO

                        // Buscamos si hay talla seleccionada
                        const tallaVal = document.getElementById('tallaSeleccionada')?.value || '';
                        const colorVal = label;

                        const final = tallaVal ? `${colorVal} | Talla: ${tallaVal}` : colorVal;
                        document.getElementById('varianteSeleccionada').value = final;

                        // Guardar el color raw en dataset del input para referencia futura
                        document.getElementById('varianteSeleccionada').dataset.color = colorVal;

                        // --- Actualizar botón WhatsApp con la selección ---
                        if (waBtn) {
                            const text = `¡Hola! Me interesa este producto: ${productoActual.nombre} (${productoActual.marca}) - ${document.getElementById('varianteSeleccionada').value}`;
                            waBtn.href = `https://wa.me/${CONFIG.WHATSAPP.numero}?text=${encodeURIComponent(text)}`;
                        }
                    };
                    container.appendChild(btn);
                });
            }
        }
    }
    // Renderizar opciones de TALLAS
    if (productoActual.tallas && (productoActual.tallas.length > 0 || typeof productoActual.tallas === 'string')) {
        const container = document.getElementById('contenedorTallas');
        if (container) {
            container.innerHTML = ''; // Limpiar previo
            let tallas = productoActual.tallas;
            // Parsear si viene como string JSON o string simple
            if (typeof tallas === 'string') {
                try { tallas = JSON.parse(tallas); }
                catch (e) { tallas = tallas.split(',').map(s => s.trim()); }
            }
            if (!Array.isArray(tallas)) tallas = [];

            if (tallas.length === 0) {
                container.innerHTML = '<span style="color:#64748b; font-size:0.9rem;">Agotado.</span>';
            } else {
                tallas.forEach(t => {
                    // Ignorar "Única" si se prefiere no mostrar, o mostrarla como chip
                    if (t === 'Única') return;

                    const btn = document.createElement('button');
                    btn.className = 'variant-chip talla-chip'; // Clase identificadora
                    btn.textContent = t;
                    btn.style.cssText = `
                        padding: 0.5rem 1rem;
                        border: 2px solid #e2e8f0;
                        border-radius: 8px;
                        background: white;
                        cursor: pointer;
                        font-size: 0.9rem;
                        transition: all 0.2s;
                        min-width: 40px;
                        text-align: center;
                     `;

                    btn.onclick = () => {
                        // Reset visual selection tallas
                        document.querySelectorAll('#contenedorTallas .talla-chip').forEach(b => {
                            b.style.borderColor = '#e2e8f0';
                            b.style.background = 'white';
                            b.style.color = 'black';
                        });
                        // Select clicked
                        btn.style.borderColor = '#ea580c';
                        btn.style.background = '#fff7ed';
                        btn.style.color = '#ea580c';

                        document.getElementById('tallaSeleccionada').value = t;
                        actualizarVarianteCombinada();
                    };
                    container.appendChild(btn);
                });

                // Mensaje si solo había Única y se ocultó, o vacio
                if (container.children.length === 0) container.innerHTML = '<span style="color:#64748b; font-size:0.9rem;">Estándar</span>';
            }
        }
    }

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
    if (window.sincronizarBrandingGlobal) window.sincronizarBrandingGlobal();
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

        // Limpiar opciones manteniendo la default
        select.innerHTML = '<option value="">Todas las Categorías</option>';

        if (data) {
            data.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.nombre;
                option.textContent = cat.nombre;
                select.appendChild(option);
            });
        }

        // Verificar URL param después de cargar opciones
        checkUrlParams();

    } catch (e) {
        console.error('Error cargando categorías filtro:', e);
    }
}

function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const catParam = params.get('categoria');

    if (catParam) {
        const select = document.getElementById('filtroCategoria');
        if (select) {
            select.value = catParam;
            // Si el valor no existe en el select (legacy vs db mismatch), lo ignorará o quedará vacío.
            // Forzamos filtro si hay valor
            if (select.value) {
                aplicarFiltros();
            }
        }
    }

}

function actualizarVarianteCombinada() {
    const inputVar = document.getElementById('varianteSeleccionada');
    const inputTalla = document.getElementById('tallaSeleccionada');
    if (!inputVar) return;

    // Intentar obtener el color desde el dataset (guardado al hacer click en color)
    let color = inputVar.dataset.color || 'Variante';

    // Si no hay dataset.color, verificar si el valor actual es un color limpio (sin "| Talla:")
    if ((!inputVar.dataset.color) && inputVar.value && !inputVar.value.includes('| Talla:')) {
        color = inputVar.value;
    }

    // Si color sigue siendo 'Variante', intentar buscar visualmente el chip seleccionado (fallback)
    if (color === 'Variante') {
        const colorChip = document.querySelector('#contenedorVariantes .variant-chip[style*="rgb(234, 88, 12)"]'); // Buscando borde naranja
        // Esto es frágil, pero útil si no hay dataset
        if (colorChip) {
            // El texto del chip puede tener stock entre parentesis "(5)", hay que limpiarlo
            // Pero el chip de color no tiene texto.
            // Si es chip de TEXTO (no color), tiene texto.
            // Asumimos que si no hay color seleccionado explícitamente, está vacío.
            color = '';
        } else {
            color = '';
        }
    }

    const talla = inputTalla ? inputTalla.value : '';

    if (color && talla) {
        inputVar.value = `${color} | Talla: ${talla}`;
    } else if (talla) {
        inputVar.value = `Talla: ${talla}`;
    } else if (color) {
        inputVar.value = color;
    } else {
        inputVar.value = '';
    }

    // Actualizar botón WhatsApp
    const waBtn = document.getElementById('btnWhatsappDetalle');
    if (waBtn && typeof productoActual !== 'undefined') {
        const text = `¡Hola! Me interesa este producto: ${productoActual.nombre} (${productoActual.marca}) - ${inputVar.value}`;
        waBtn.href = `https://wa.me/${CONFIG.WHATSAPP.numero}?text=${encodeURIComponent(text)}`;
    }
}


// Exponer globalmente
window.cargarCategoriasFiltro = cargarCategoriasFiltro;

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

// ═══════════════════════════════════════════════════════════════
// FUNCIONES DE RESEÑAS
// ═══════════════════════════════════════════════════════════════

function setRating(n) {
    const stars = document.querySelectorAll('.rating-input span');
    document.getElementById('resenaEstrellas').value = n;
    stars.forEach((s, i) => {
        s.textContent = i < n ? '★' : '☆';
        s.style.color = i < n ? '#f59e0b' : '#cbd5e1';
    });
}
window.setRating = setRating;

async function enviarResenaCliente() {
    const idProducto = document.getElementById('resenaProductoId').value;
    const estrellas = parseInt(document.getElementById('resenaEstrellas').value);
    const nombre = document.getElementById('resenaNombre').value.trim() || 'Anónimo';
    const comentario = document.getElementById('resenaComentario').value.trim();

    if (estrellas === 0) {
        if (typeof showToast === 'function') showToast('Atención', 'Selecciona las estrellas', 'warning');
        else alert('Por favor selecciona una calificación de estrellas');
        return;
    }

    try {
        const { error } = await supabaseClient.from('producto_resenas').insert({
            id_producto: idProducto,
            estrellas: estrellas,
            comentario: comentario,
            nombre_cliente: nombre,
            created_at: new Date().toISOString()
        });

        if (error) throw error;

        if (typeof showToast === 'function') showToast('¡Recibido!', 'Tu reseña será publicada tras aprobación.', 'success');
        else alert('Tu reseña ha sido enviada y está pendiente de aprobación.');

        document.getElementById('formResena').style.display = 'none';
    } catch (e) {
        console.error(e);
        alert('Error al enviar reseña: ' + e.message);
    }
}
window.enviarResenaCliente = enviarResenaCliente;

async function cargarResenasProducto(idProducto) {
    const container = document.getElementById('listaResenasContainer');
    if (!container) return;

    container.innerHTML = '<p style="text-align:center; color:#94a3b8;">Cargando opiniones...</p>';

    try {
        const { data, error } = await supabaseClient
            .from('producto_resenas')
            .select('*')
            .eq('id_producto', idProducto)
            .eq('aprobado', true) // Solo aprobados
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:2rem; color:#64748b;">
                    <p style="margin-bottom:0.5rem; font-size:1.1rem;">Este producto aún no tiene opiniones.</p>
                    <p style="font-size:0.9rem;">¡Sé el primero en compartir tu experiencia!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = data.map(r => `
            <div style="border-bottom:1px solid #f1f5f9; padding:1.5rem 0;">
                <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                    <div style="font-weight:700; color:#334155;">${r.nombre_cliente || 'Anónimo'}</div>
                    <div style="font-size:0.85rem; color:#94a3b8;">${new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                <div style="color:#f59e0b; font-size:1rem; margin-bottom:0.5rem;">
                    ${'★'.repeat(r.estrellas)}${'☆'.repeat(5 - r.estrellas)}
                </div>
                <p style="color:#475569; line-height:1.6; margin:0;">${r.comentario}</p>
            </div>
        `).join('');

    } catch (err) {
        console.error('Error cargando reseñas:', err);
        container.innerHTML = '<p style="text-align:center; color:red;">No se pudieron cargar las opiniones.</p>';
    }
}
window.cargarResenasProducto = cargarResenasProducto;

// ═══════════════════════════════════════════════════════════════
// OVERRIDE: NUEVA LÓGICA DE RESEÑAS (Paginación + Word-Break)
// ═══════════════════════════════════════════════════════════════
// Variables globales para paginación de reseñas
let lastReviewFecha = null;
let reviewLimit = 2; // Mostrar 2 inicialmente

async function cargarResenasProductoV2(idProducto, reset = true) {
    const container = document.getElementById('listaResenasContainer');
    const btnVerMas = document.getElementById('btnVerMasResenas');

    if (!container) return;

    // Si la función antigua llama sin reset, reset es undefined, forzamos true
    if (reset === undefined) reset = true;

    if (reset) {
        container.innerHTML = '<div style="display:flex; justify-content:center; padding:1rem;"><div class="spinner"></div></div>';
        lastReviewFecha = null; // Reset pointer
        if (btnVerMas) btnVerMas.style.display = 'none';
    }

    try {
        let query = supabaseClient
            .from('producto_resenas')
            .select('*')
            .eq('id_producto', idProducto)
            .eq('aprobado', true)
            .order('created_at', { ascending: false })
            .limit(reviewLimit + 1); // Pedimos 1 extra para saber si hay más

        if (lastReviewFecha) {
            query = query.lt('created_at', lastReviewFecha);
        }

        const { data, error } = await query;

        if (error) throw error;

        if (reset) container.innerHTML = '';

        if (!data || data.length === 0) {
            if (reset) {
                container.innerHTML = `
                    <div style="text-align:center; padding:1.5rem; color:#94a3b8; background:#f8fafc; border-radius:8px;">
                        <p style="margin-bottom:0.25rem; font-size:1.5rem;">🌟</p>
                        <p style="margin-bottom:0.25rem; font-weight:600; color:#64748b;">Aún no hay opiniones</p>
                        <p style="font-size:0.85rem;">¡Sé el primero en calificar este producto!</p>
                    </div>
                `;
            }
            return;
        }

        // Determinar si hay más páginas
        const hayMas = data.length > reviewLimit;
        const reviewsIO = hayMas ? data.slice(0, reviewLimit) : data;

        // Renderizar reviews
        reviewsIO.forEach(r => {
            const div = document.createElement('div');
            div.style.borderBottom = '1px solid #f1f5f9';
            div.style.padding = '1rem 0';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
                    <div style="font-weight:700; color:#334155; font-size:0.9rem; text-transform:uppercase;">${r.nombre_cliente || 'Anónimo'}</div>
                    <div style="font-size:0.75rem; color:#94a3b8;">${new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                <div style="color:#f59e0b; font-size:0.9rem; margin-bottom:0.5rem;">
                    ${'★'.repeat(r.estrellas)}${'☆'.repeat(5 - r.estrellas)}
                </div>
                <!-- FORCE WORD BREAK HERE -->
                <p style="color:#475569; line-height:1.5; margin:0; font-size:0.9rem; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word;">${r.comentario}</p>
            `;
            container.appendChild(div);
            lastReviewFecha = r.created_at; // Guardar fecha para siguiente paginación
        });

        // Manejo del botón "Ver Más"
        if (btnVerMas) {
            btnVerMas.style.display = hayMas ? 'block' : 'none';
            btnVerMas.onclick = () => cargarResenasProductoV2(idProducto, false);
            if (hayMas) btnVerMas.textContent = 'Ver comentarios antiguos (+2)';
        }

    } catch (err) {
        console.error('Error cargando reseñas:', err);
        if (reset) container.innerHTML = '<p style="text-align:center; color:red; font-size:0.85rem;">Error al cargar opiniones.</p>';
    }
}
window.cargarResenasProducto = cargarResenasProductoV2;

function cargarTallasFiltro() {
    const select = document.getElementById('filtroTalla');
    if (!select) return;

    // Obtener todas las tallas únicas de todos los productos
    const tallasSet = new Set();
    todosLosProductos.forEach(p => {
        if (p.tallas) {
            let arr = Array.isArray(p.tallas) ? p.tallas : (typeof p.tallas === 'string' ? p.tallas.split(',').map(t => t.trim()) : []);
            arr.forEach(t => {
                if (t) tallasSet.add(t);
            });
        }
    });

    // Ordenar tallas (lógica simple: intentar numérico, luego alfabético)
    const ordenTallas = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    const tallasArray = Array.from(tallasSet).sort((a, b) => {
        const idxA = ordenTallas.indexOf(a.toUpperCase());
        const idxB = ordenTallas.indexOf(b.toUpperCase());
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        // Si son números
        const numA = parseFloat(a);
        const numB = parseFloat(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
    });

    // Limpiar opciones excepto la primera
    while (select.options.length > 1) {
        select.remove(1);
    }

    tallasArray.forEach(t => {
        const option = document.createElement('option');
        option.value = t;
        option.textContent = t;
        select.appendChild(option);
    });
}
