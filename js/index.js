/* ═══════════════════════════════════════════════════════════════
  MOTEROS SPORTS LINE - INDEX.JS v2.0
  Catálogo con Carrito, Promociones y Destacados
  ═══════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN E INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════

// El cliente de Supabase ahora viene globalmente desde config.js
// No asignar a constante de nivel superior para evitar fallos si config.js tarda un poco
function getSupabase() {
    return window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
}

// Estado global
let promocionesActivas = [];
let productosPromo = [];
let carrito = JSON.parse(localStorage.getItem('carrito_moteros') || '[]');
let posicionCarruselPromo = 0;

// Mapa de Iconos Premium (SVGs Lineales)
const ICONOS_MOTO = {
    // ── Tipos de Cascos (iconos PNG profesionales) ──
    'CASCOS': '<img src="img/icons/integral.png" alt="Cascos" style="width:100%;height:100%;object-fit:contain">',
    'INTEGRALES': '<img src="img/icons/integral.png" alt="Integral" style="width:100%;height:100%;object-fit:contain">',
    'ABATIBLES': '<img src="img/icons/abatible.png" alt="Abatible" style="width:100%;height:100%;object-fit:contain">',
    'ABIERTOS': '<img src="img/icons/abierto.png" alt="Abierto" style="width:100%;height:100%;object-fit:contain">',
    'MULTIPROPOSITO': '<img src="img/icons/multiproposito.png" alt="Multipropósito" style="width:100%;height:100%;object-fit:contain">',
    'CROSS': '<img src="img/icons/cross.png" alt="Cross" style="width:100%;height:100%;object-fit:contain">',
    'MODULARES': '<img src="img/icons/modular.png" alt="Modular" style="width:100%;height:100%;object-fit:contain">',

    // ── Otras Categorías (iconos PNG profesionales) ──
    'GUANTES': '<img src="img/icons/guantes.png" alt="Guantes" style="width:100%;height:100%;object-fit:contain">',
    'CHAQUETAS': '<img src="img/icons/chaqueta.png" alt="Chaquetas" style="width:100%;height:100%;object-fit:contain">',
    'BOTAS': '<img src="img/icons/botas.png" alt="Botas" style="width:100%;height:100%;object-fit:contain">',
    'IMPERMEABLES': '<img src="img/icons/impermeable.png" alt="Impermeables" style="width:100%;height:100%;object-fit:contain">',
    'IMPERMEABLES Y BOTAS': '<img src="img/icons/impermeable.png" alt="Impermeables y Botas" style="width:100%;height:100%;object-fit:contain">',
    'MALETEROS': '<img src="img/icons/maletero.png" alt="Maleteros" style="width:100%;height:100%;object-fit:contain">',
    'ACCESORIOS': '<img src="img/icons/accesorios.png" alt="Accesorios" style="width:100%;height:100%;object-fit:contain">',
    'CANDADOS': '<img src="img/icons/candado.png" alt="Candados" style="width:100%;height:100%;object-fit:contain">',
    'VISORES': '<img src="img/icons/visor.png" alt="Visores" style="width:100%;height:100%;object-fit:contain">',
    'INTERCOMUNICADORES': '<img src="img/icons/intercomunicador.png" alt="Intercomunicadores" style="width:100%;height:100%;object-fit:contain">',
    'PANTALONES': '<img src="img/icons/pantalones.png" alt="Pantalones" style="width:100%;height:100%;object-fit:contain">',
    'RODILLERAS': '<img src="img/icons/rodilleras.png" alt="Rodilleras" style="width:100%;height:100%;object-fit:contain">',
    'VER TODO': '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="20" height="20" rx="3"/><rect x="36" y="8" width="20" height="20" rx="3"/><rect x="8" y="36" width="20" height="20" rx="3"/><rect x="36" y="36" width="20" height="20" rx="3"/></svg>'
};

// Alias en singular para que coincida con lo que viene de la BD
ICONOS_MOTO['CASCO'] = ICONOS_MOTO['CASCOS'];
ICONOS_MOTO['INTEGRAL'] = ICONOS_MOTO['INTEGRALES'];
ICONOS_MOTO['ABATIBLE'] = ICONOS_MOTO['ABATIBLES'];
ICONOS_MOTO['ABIERTO'] = ICONOS_MOTO['ABIERTOS'];
ICONOS_MOTO['MODULAR'] = ICONOS_MOTO['MODULARES'];
ICONOS_MOTO['GUANTE'] = ICONOS_MOTO['GUANTES'];
ICONOS_MOTO['CHAQUETA'] = ICONOS_MOTO['CHAQUETAS'];
ICONOS_MOTO['BOTA'] = ICONOS_MOTO['BOTAS'];
ICONOS_MOTO['IMPERMEABLE'] = ICONOS_MOTO['IMPERMEABLES'];
ICONOS_MOTO['MALETERO'] = ICONOS_MOTO['MALETEROS'];
ICONOS_MOTO['ACCESORIO'] = ICONOS_MOTO['ACCESORIOS'];
ICONOS_MOTO['CANDADO'] = ICONOS_MOTO['CANDADOS'];
ICONOS_MOTO['VISOR'] = ICONOS_MOTO['VISORES'];
ICONOS_MOTO['INTERCOMUNICADOR'] = ICONOS_MOTO['INTERCOMUNICADORES'];

// Utilidad para normalizar texto (quitar tildes y dejar en mayúsculas)
function normalizarTexto(txt) {
    if (!txt) return "";
    return txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

// Configuración de Navegación (Mapeo Robusto)
const MAPEO_NAV = {
    'CASCOS': ['CASCO'],
    'ACCESORIOS': ['ACCESORIO', 'CANDADO', 'VISOR', 'INTERCOMUNICADOR'],
    'TRAJES DE PROTECCION': ['TRAJE', 'GUANTE', 'IMPERMEABLE', 'BOTA', 'PROTECCION', 'PROTECCIÓN', 'CHAQUETA', 'PANTALON', 'PANTALÓN'],
    'MALETEROS': ['MALETERO', 'BAUL', 'ALFORJA', 'MALETA']
};
let autoPlayPromo = null;
const INTERVALO_AUTO = 5000;

// ═══════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════

function formatearPrecio(precio) {
    return parseInt(precio).toLocaleString('es-CO');
}

function mostrarToast(titulo, mensaje, tipo = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const iconos = {
        success: '✅',
        promo: '🎉',
        warning: '⚠️',
        error: '❌'
    };

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
    setTimeout(() => toast.remove(), tipo === 'warning' || tipo === 'error' ? 4000 : 3000);
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
    const producto = productosPromo.find(p => String(p.id) === String(productoId));
    if (!producto) return;

    const existente = carrito.find(item => String(item.id) === String(productoId));
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
    mostrarToast('¡Agregado con descuento!', `${producto.nombre} (-${descuento}%) Ahorras $${formatearPrecio(ahorro)}`, 'promo');
}

function agregarComboAlCarrito(idPromo, precioOriginalTotal, precioFinalTotal, descuento, productosJson) {
    try {
        const productos = JSON.parse(productosJson.replace(/&quot;/g, '"'));

        productos.forEach(p => {
            const precioOrig = parseFloat(p.precio) || 0;
            const precioFin = Math.round(precioOrig * (1 - (descuento / 100)));

            const existente = carrito.find(item => String(item.id) === String(p.id));
            if (existente) {
                existente.cantidad += 1;
                // Actualizar con precio de promoción
                existente.precioOriginal = precioOrig;
                existente.precioFinal = precioFin;
                existente.descuento = descuento;
                existente.promocion = `Combo: ${idPromo}`;
            } else {
                carrito.push({
                    id: p.id,
                    id_producto: p.id_producto,
                    nombre: p.nombre,
                    marca: p.marca,
                    url_imagen: p.url_imagen,
                    precioOriginal: precioOrig,
                    precioFinal: precioFin,
                    descuento,
                    promocion: `Combo: ${idPromo}`,
                    cantidad: 1
                });
            }
        });

        guardarCarrito(true); // Skip validation when adding combo
        const ahorro = precioOriginalTotal - precioFinalTotal;
        mostrarToast('¡Combo agregado!', `Ahorras $${formatearPrecio(ahorro)} con esta oferta`, 'promo');

    } catch (e) {
        if (window.registrarLogSistema) window.registrarLogSistema('error_sistema', 'Error al agregar combo', e.message);
    }
}

// Función global para agregar combo desde el carrusel
function agregarComboDesdeCarrusel(button) {
    try {
        const card = button.closest('.promo-card');
        if (!card) return;

        const promoData = JSON.parse(card.dataset.promoData);

        // Agregar cada producto del combo al carrito
        promoData.productos.forEach(prod => {
            const precioOriginal = parseFloat(prod.precio);
            const precioFinal = Math.round(precioOriginal * (1 - (promoData.descuento / 100)));

            const existente = carrito.find(item => item.id === prod.id && item.promocion === `Combo: ${promoData.id_promo}`);
            if (existente) {
                existente.cantidad += 1;
            } else {
                carrito.push({
                    id: prod.id,
                    nombre: prod.nombre,
                    marca: prod.marca,
                    url_imagen: prod.url_imagen,
                    precioOriginal: precioOriginal,
                    precioFinal: precioFinal,
                    descuento: promoData.descuento,
                    promocion: `Combo: ${promoData.id_promo}`,
                    cantidad: 1
                });
            }
        });

        guardarCarrito(true);
        const ahorro = promoData.precioOriginal - promoData.precioConDescuento;
        mostrarToast('¡Combo agregado!', `Ahorras $${formatearPrecio(ahorro)} con esta oferta`, 'promo');

    } catch (e) {
        mostrarToast('Error', 'No se pudo agregar el combo', 'error');
    }
}

function agregarAlCarritoNormal(productoId, nombre, marca, precio, urlImagen, id_producto = null) {
    // Verificar si hay promoción activa mediante el Manager
    let precioFinal = precio;
    let descuento = 0;
    let promocionNombre = null;

    if (window.PromocionesManager && window.PromocionesManager.cargado) {
        // Pasar ambos IDs para máxima compatibilidad
        const ids = [productoId, id_producto].filter(i => i);
        const promoInfo = window.PromocionesManager.calcularPrecio(precio, ids);
        if (promoInfo && promoInfo.tienePromo) {
            precioFinal = promoInfo.precioFinal;
            descuento = promoInfo.descuento;
            promocionNombre = promoInfo.promocion.nombre;
        }
    }

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
            precioFinal: precioFinal,
            descuento: descuento,
            promocion: promocionNombre,
            cantidad: 1
        });
    }
    guardarCarrito();
    if (descuento > 0) {
        mostrarToast('¡Agregado con descuento!', `${nombre} (-${descuento}%)`, 'promo');
    } else {
        mostrarToast('¡Agregado!', nombre);
    }
}

function agregarAlCarritoRapido(productoId, nombre, marca, precio, urlImagen) {
    // Usar la misma lógica unificada
    agregarAlCarritoNormal(productoId, nombre, marca, precio, urlImagen);
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

function guardarCarrito(skipValidation = false) {
    if (!skipValidation && window.PromocionesManager && window.PromocionesManager.cargado) {
        window.PromocionesManager.validarCarrito(carrito);
    }
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
        <div class="habeas-data-check" style="margin: 1rem 0; padding: 1rem; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
            <label style="display: flex; align-items: flex-start; gap: 0.75rem; cursor: pointer; font-size: 0.9rem; color: #475569;">
                <input type="checkbox" id="aceptaHabeasData" style="margin-top: 3px; width: 18px; height: 18px; accent-color: #ff6b00;">
                <span>Acepto el tratamiento de mis datos personales conforme a la <a href="habeas-data.html" target="_blank" style="color: #ff6b00; font-weight: 600;">Politica de Habeas Data</a> y los <a href="terminos.html" target="_blank" style="color: #ff6b00; font-weight: 600;">Terminos y Condiciones</a></span>
            </label>
        </div>
        <div class="cart-actions">
            <button class="btn-whatsapp-cart" onclick="enviarPedidoWhatsApp()">💬 Enviar Pedido</button>
            <button class="btn-vaciar" onclick="vaciarCarrito()">🗑️</button>
        </div>
    `;
}

function enviarPedidoWhatsApp() {
    if (carrito.length === 0) {
        mostrarToast('Carrito vacio', 'Agrega productos antes de continuar', 'warning');
        return;
    }

    // Verificar checkbox de Habeas Data
    const checkHabeas = document.getElementById('aceptaHabeasData');
    if (!checkHabeas || !checkHabeas.checked) {
        mostrarToast('Acepta las politicas', 'Debes aceptar el Habeas Data y Terminos para continuar', 'warning');
        // Resaltar el checkbox
        const checkContainer = checkHabeas?.closest('.habeas-data-check');
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

        const esCombo = item.promocion && item.promocion.includes('Combo');
        const iconEtiqueta = esCombo ? '🎁' : '🏷️';

        mensaje += `*${i + 1}. ${item.nombre}*\n`;
        mensaje += `   Marca: ${item.marca}\n`;
        mensaje += `   Cant: ${item.cantidad}\n\n`;
    });

    mensaje += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    mensaje += `¡Gracias! 🙌`;

    const numero = CONFIG.WHATSAPP?.numero || '573113408416';
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`, '_blank');
}

// ═══════════════════════════════════════════════════════════════
// PROMOCIONES Y CARRUSEL
// ═══════════════════════════════════════════════════════════════

async function cargarPromociones() {
    const client = getSupabase();
    if (!client) {
        setTimeout(cargarPromociones, 1000);
        return;
    }

    try {
        if (window.PromocionesManager) {
            await window.PromocionesManager.cargar();
        }

        const { data: promos, error: errorPromos } = await client
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

        const { data: productos, error: errorProd } = await client
            .from('productos')
            .select('*')
            .eq('estado', 'Activo');

        if (errorProd) throw errorProd;

        productosPromo = productos || [];

        renderizarCarruselPromo();
        iniciarAutoPlayPromo();

        // IA Learning: Enseñar promociones REALMENTE vigentes (considerando fechas)
        if (window.moterosIA && promocionesActivas.length > 0) {
            const listadoPromos = promocionesActivas
                .filter(p => PromocionesManager.estaVigente(p))
                .map(p => p.nombre)
                .join(', ');

            if (listadoPromos) {
                window.moterosIA.aprenderEvento(`Cargó promociones del día (Verificadas): ${listadoPromos}`);
            }
        }

    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema('error_ia', 'Error cargando promociones', error.message);
        const seccion = document.getElementById('seccionPromociones');
        if (seccion) seccion.style.display = 'none';
    }
}

function renderizarCarruselPromo() {
    const track = document.getElementById('promoCarouselTrack');
    const indicators = document.getElementById('promoIndicators');

    if (!track) return;

    let cards = [];

    // Ahora iteramos sobre las promociones, no sobre productos individuales
    promocionesActivas.forEach(promo => {
        // Verificar vigencia antes de procesar
        if (!PromocionesManager.estaVigente(promo)) return;

        const idsIncluidosStr = promo.productos_incluidos || '';
        const idsIncluidos = idsIncluidosStr.split(',').map(id => id.trim()).filter(id => id && id !== '000');

        // Buscar los datos de los productos que pertenecen a la promo
        const productosDeLaPromo = productosPromo.filter(p =>
            idsIncluidos.some(idIncl => {
                const match = String(p.id).toLowerCase() === idIncl.toLowerCase() ||
                    String(p.id_producto).toLowerCase() === idIncl.toLowerCase() ||
                    String(p.id_producto).toLowerCase() === `prod${idIncl.toLowerCase()}`;
                return match;
            })
        );

        if (productosDeLaPromo.length === 0) return;

        // Calcular precios
        let precioOriginalTotal = 0;
        productosDeLaPromo.forEach(p => precioOriginalTotal += parseFloat(p.precio) || 0);

        const porcentajeDescuento = parseFloat(promo.descuento) || 0;
        const precioConDescuentoTotal = Math.round(precioOriginalTotal * (1 - (porcentajeDescuento / 100)));

        // Preparar nombres e imagen
        const esCombo = productosDeLaPromo.length > 1;
        const nombreTarjeta = esCombo ? (promo.nombre || 'Combo Especial') : productosDeLaPromo[0].nombre;
        const subtitulo = esCombo ? productosDeLaPromo.map(p => p.nombre).join(' + ') : (promo.nombre || 'Oferta');
        const imagenUrl = productosDeLaPromo[0].url_imagen;

        cards.push({
            id_promo: promo.id_promo,
            nombre: nombreTarjeta,
            subtitulo,
            precioOriginal: precioOriginalTotal,
            precioConDescuento: precioConDescuentoTotal,
            descuento: porcentajeDescuento,
            productos: productosDeLaPromo,
            imagenUrl,
            fechaFin: promo.fecha_fin
        });
    });

    if (cards.length === 0) {
        const seccion = document.getElementById('seccionPromociones');
        if (seccion) seccion.style.display = 'none';
        return;
    }

    // Asegurar que la sección sea visible si hay tarjetas
    const seccion = document.getElementById('seccionPromociones');
    if (seccion) seccion.style.display = 'block';

    track.innerHTML = cards.map((item, index) => {
        return `
        <div class="promo-card" data-index="${index}" data-promo-id="${item.id_promo}" data-promo-data='${JSON.stringify(item)}'>
            <span class="promo-badge">${item.descuento > 0 ? `-${item.descuento}%` : 'OFERTA'}</span>
            <div class="promo-card-image">
                <img src="${item.imagenUrl || 'https://pbblthbrdkevuyjxyuar.supabase.co/storage/v1/object/public/productos-imagenes/moteros%20logo.jpg'}" 
                     alt="${item.nombre}" 
                     onerror="this.src='https://pbblthbrdkevuyjxyuar.supabase.co/storage/v1/object/public/productos-imagenes/moteros%20logo.jpg'"
                     loading="lazy" decoding="async" width="300" height="180">
            </div>
            <div class="promo-card-info">
                <div class="promo-name">${item.nombre}</div>
                <h3 title="${item.subtitulo}">${item.subtitulo}</h3>
                <div class="promo-prices">
                    <span class="precio-original">$${formatearPrecio(item.precioOriginal)}</span>
                    <span class="precio-promo">$${formatearPrecio(item.precioConDescuento)}</span>
                </div>
                ${item.fechaFin ? `<div class="promo-expiry" style="font-size: 0.75rem; color: #64748b; margin-bottom: 0.75rem;">⏳ Válido hasta: ${new Date(item.fechaFin).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}</div>` : ''}
                <button class="promo-btn-agregar" onclick="agregarComboDesdeCarrusel(this)">
                    🛒 Agregar Combo
                </button>
            </div>
        </div>
    `;
    }).join('');

    // Indicadores
    if (indicators) {
        const numIndicadores = Math.ceil(cards.length / getCardsVisibles());
        indicators.innerHTML = Array(numIndicadores).fill(0).map((_, i) =>
            `<div class="promo-indicator ${i === 0 ? 'active' : ''}" onclick="irASlidePromo(${i})"></div>`
        ).join('');
    }

    // Resetear posición
    posicionCarruselPromo = 0;
    track.style.transform = 'translateX(0)';
}

function getCardsVisibles() {
    const width = window.innerWidth;
    if (width < 600) return 1;
    if (width < 1024) return 2;
    if (width < 1400) return 3;
    return 4;
}

function moverCarruselPromo(direccion) {
    const track = document.getElementById('promoCarouselTrack');
    const cards = track?.querySelectorAll('.promo-card');
    if (!cards || !cards.length) return;

    // Calcular ancho dinámicamente para que sea preciso
    const visibles = getCardsVisibles();
    const gap = 24; // Gap definido en CSS
    const contenedorWidth = track.parentElement.offsetWidth;
    const cardWidth = (contenedorWidth - (gap * (visibles - 1))) / visibles;

    const maxPosicion = Math.max(0, cards.length - visibles);

    posicionCarruselPromo += direccion;
    if (posicionCarruselPromo < 0) posicionCarruselPromo = maxPosicion;
    if (posicionCarruselPromo > maxPosicion) posicionCarruselPromo = 0;

    const offset = posicionCarruselPromo * (cardWidth + gap);
    track.style.transform = `translateX(-${offset}px)`;
    actualizarIndicadoresPromo();
    reiniciarAutoPlayPromo();
}

function irASlidePromo(index) {
    const track = document.getElementById('promoCarouselTrack');
    const cards = track?.querySelectorAll('.promo-card');
    if (!cards || !cards.length) return;

    const visibles = getCardsVisibles();
    const gap = 24;
    const contenedorWidth = track.parentElement.offsetWidth;
    const cardWidth = (contenedorWidth - (gap * (visibles - 1))) / visibles;

    posicionCarruselPromo = index * visibles;
    const maxPosicion = Math.max(0, cards.length - visibles);
    if (posicionCarruselPromo > maxPosicion) posicionCarruselPromo = maxPosicion;

    const offset = posicionCarruselPromo * (cardWidth + gap);
    track.style.transform = `translateX(-${offset}px)`;
    actualizarIndicadoresPromo();
    reiniciarAutoPlayPromo();
}

function actualizarIndicadoresPromo() {
    const indicators = document.querySelectorAll('.promo-indicator');
    if (!indicators.length) return;
    const visibles = getCardsVisibles();
    const activeIndex = Math.min(indicators.length - 1, Math.floor(posicionCarruselPromo / visibles));
    indicators.forEach((ind, i) => ind.classList.toggle('active', i === activeIndex));
}

function iniciarAutoPlayPromo() {
    if (autoPlayPromo) clearInterval(autoPlayPromo);
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
        const client = getSupabase();
        if (!client) return;

        const { data: productos, error } = await client
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
                         onerror="this.src='https://picsum.photos/400/300'"
                         loading="lazy" decoding="async" width="300" height="280">
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
        const { count } = await client
            .from('productos')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'Activo');

        const totalEl = document.getElementById('totalProductos');
        if (totalEl) totalEl.textContent = count || 0;

        await contarCategorias();

    } catch (error) {
        if (window.registrarLogSistema) window.registrarLogSistema('error_sistema', 'Error cargando destacados', error.message);
    }
}

async function contarCategorias() {
    // Esta función ahora es obsoleta por cargarCategoriasDinamicas, 
    // pero la mantenemos mínima por si hay refs perdidas.
}

async function cargarCategoriasDinamicas() {
    const nav = document.getElementById('mainNav'); // Fila de categorías
    if (!nav) return;

    const client = getSupabase();
    if (!client) return;

    try {
        const { data: categorias, error: errCat } = await client.from('categorias').select('*').order('nombre');
        const { data: productos, error: errProd } = await client.from('productos').select('categoria, subcategoria, marca, url_imagen').eq('estado', 'Activo');

        if (errCat || errProd) throw errCat || errProd;

        // Limpiar nav
        nav.innerHTML = '';

        const productosValidos = (productos || []);

        // Generar items según el MAPEO_NAV
        Object.keys(MAPEO_NAV).forEach(nombrePadre => {
            const hijasKeywords = MAPEO_NAV[nombrePadre].map(k => normalizarTexto(k));
            const nombrePadreNorm = normalizarTexto(nombrePadre);

            // Obtener productos que coincidan con alguna keyword de la categoría padre
            const productosGrupo = productosValidos.filter(p => {
                const catNorm = normalizarTexto(p.categoria);
                // Cambiamos a una lógica más permisiva para asegurar que aparezcan las 4 secciones
                return hijasKeywords.some(key => catNorm.includes(key)) || catNorm.includes(nombrePadreNorm);
            });

            // Forzamos que aparezcan aunque el filtro de productos sea estricto inicialmente
            const link = document.createElement('a');
            link.href = `catalogo.html?categoria=${encodeURIComponent(nombrePadre)}`;
            link.textContent = nombrePadre.toUpperCase();
            link.className = 'nav-item-has-mega';

            // Al pasar el mouse, mostramos el Mega Menú con todos los productos del grupo
            link.addEventListener('mouseenter', () => mostrarMegaMenu(nombrePadre, productosGrupo));
            nav.appendChild(link);
        });

        // Evento para cerrar menú al salir del header
        const header = document.querySelector('.header');
        header.addEventListener('mouseleave', ocultarMegaMenu);

    } catch (error) {
        console.error("Error Mega Menu:", error);
    }
}

function mostrarMegaMenu(categoria, productos) {
    console.log("Mostrando Mega Menú para:", categoria, productos.length, "productos");
    const mega = document.getElementById('megaMenu');
    const sections = document.getElementById('megaMenuSections');
    const brandsCont = document.getElementById('megaMenuBrands');
    const promoCont = document.getElementById('megaMenuPromo');

    if (!mega || !sections || !brandsCont) {
        console.error("No se encontraron los elementos del Mega Menú");
        return;
    }

    // 1. Agrupar por Subcategoría
    const subcats = {};
    const categoriaNorm = normalizarTexto(categoria);

    productos.forEach(p => {
        let sub = p.subcategoria;
        const pCatNorm = normalizarTexto(p.categoria);

        if (!sub && pCatNorm !== categoriaNorm) {
            sub = p.categoria;
        }

        const label = sub || 'Ver Todo';
        if (!subcats[label]) subcats[label] = p.url_imagen;
    });

    // 2. Renderizar Subcategorías con Iconos
    sections.innerHTML = Object.keys(subcats).map(subLabel => {
        // Fallback robusto para iconos
        const iconKey = normalizarTexto(subLabel);
        const icon = ICONOS_MOTO[iconKey] || ICONOS_MOTO['ACCESORIOS'];

        const pEjemplo = productos.find(p => (p.subcategoria || p.categoria) === subLabel);
        const catReal = pEjemplo ? pEjemplo.categoria : categoria;

        return `
            <a href="catalogo.html?categoria=${encodeURIComponent(catReal)}${pEjemplo?.subcategoria ? `&subcategoria=${encodeURIComponent(pEjemplo.subcategoria)}` : ''}" class="mega-menu-item">
                <div class="mega-menu-icon">${icon}</div>
                <span>${subLabel}</span>
            </a>
        `;
    }).join('');

    // 3. Renderizar Marcas
    const marcasRaw = [...new Set(productos.map(p => p.marca).filter(m => m))];
    brandsCont.innerHTML = marcasRaw.slice(0, 10).map(m => `
        <a href="catalogo.html?marca=${encodeURIComponent(m)}">${m}</a>
    `).join('');

    // 4. Promo
    if (productos.length > 0 && promoCont) {
        promoCont.innerHTML = `
            <img src="${productos[0].url_imagen}" alt="Oferta ${categoria}">
            <div class="promo-overlay"><span>VER OFERTAS</span></div>
        `;
    }

    // ACTIVACIÓN FINAL
    mega.style.display = 'block'; // Forzamos display antes de opacity
    setTimeout(() => {
        mega.classList.add('active');
    }, 10);
}

function ocultarMegaMenu() {
    const mega = document.getElementById('megaMenu');
    if (mega) mega.classList.remove('active');
}

function irATienda(categoria) {
    window.location.href = `catalogo.html?categoria=${encodeURIComponent(categoria)}`;
}

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN DINÁMICA
// ═══════════════════════════════════════════════════════════════

// La función cargarConfiguracion ha sido reemplazada por sincronizarBrandingGlobal() en config.js

// ═══════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', async () => {
    // 1. Sincronizar UI Básica
    actualizarContadorCarrito();
    if (window.sincronizarBrandingGlobal) {
        await window.sincronizarBrandingGlobal();
    }

    // 2. Cargar Datos Dinámicos con reintentos si Supabase no está listo
    let intentos = 0;
    const maxIntentos = 10;

    const initInterval = setInterval(() => {
        const client = getSupabase();
        if (client || intentos >= maxIntentos) {
            clearInterval(initInterval);
            if (client) {
                cargarCategoriasDinamicas();
                cargarPromociones();
                cargarDestacados();
                cargarImagenHero();
            } else {
                console.error("❌ Supabase no se pudo inicializar tras varios intentos.");
            }
        }
        intentos++;
    }, 200);

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

// La lógica de categorías ahora se maneja exclusivamente mediante cargarCategoriasDinamicas()
// para asegurar consistencia y conteo preciso de productos.

/* ═══════════════════════════════════════════════════════════════
   HERO DINÁMICO
   ═══════════════════════════════════════════════════════════════ */
async function cargarImagenHero() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    try {
        const client = getSupabase();
        if (!client) return;

        const { data, error } = await client
            .from('contenido_sitio')
            .select('contenido')
            .eq('tipo', 'hero_imagen')
            .maybeSingle();

        if (data && data.contenido) {
            // Aplicar imagen manteniendo el gradiente definido en CSS (Sincronizado con styles.css)
            const gradiente = 'linear-gradient(to right, rgba(15, 23, 42, 0.8) 0%, rgba(15, 23, 42, 0.6) 50%, rgba(15, 23, 42, 0.2) 100%)';
            hero.style.backgroundImage = `${gradiente}, url('${data.contenido}')`;
            hero.style.backgroundPosition = 'center top';
        }
    } catch (e) {
        // Silencioso si falla, usa default css
        console.warn('Nota: Usando hero default');
    }
}