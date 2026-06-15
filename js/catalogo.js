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

// Mapa de Colores Global
const colorMap = {
    // 🎨 COLORES BÁSICOS
    'negro': '#000', 'blanco': '#fff', 'rojo': '#ef4444',
    'azul': '#3b82f6', 'verde': '#22c55e', 'amarillo': '#eab308',
    'naranja': '#f97316', 'rosa': '#ec4899', 'morado': '#a855f7',
    'cafe': '#8b4513', 'marron': '#a52a2a', 'beige': '#f5f5dc',
    'gris': '#94a3b8', 'plata': '#c0c0c0', 'grafito': '#374151',
    'dorado': '#ffd700', 'fucsia': '#d946ef', 'humo': '#555',

    // ✨ TORNASOLES Y CAMALEONES
    'gris tornasol': 'linear-gradient(135deg, #bdc3c7 0%, #2c3e50 100%)', // Plata oscuro
    'camaleon': 'linear-gradient(135deg, #5f2c82, #49a09d)',             // Morado-Verde
    'tornasol': 'linear-gradient(45deg, #85FFBD 0%, #FFFB7D 100%)',       // Verde-Amarillo suave
    'galaxy': 'linear-gradient(to right, #667db6, #0082c8, #0082c8, #667db6)',
    'aurora': 'linear-gradient(to right, #00c6ff, #0072ff)',
    'petroleo': 'linear-gradient(to right, #1f4037, #99f2c8)',
    'arcoiris': 'linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)',

    // ⚡ NEÓN / VISIBLE
    'verde neon': '#39ff14',
    'amarillo neon': '#ccff00',
    'naranja neon': '#ff5f1f',
    'rosa neon': '#ff00ff',
    'azul neon': '#4d4dff',

    // 🛡️ MATE
    'negro mate': '#2c2c2c',
    'gris mate': '#555',
    'rojo mate': '#8b0000',
    'azul mate': '#00008b',
    'verde militar': '#4b5320',

    // 🏆 METÁLICOS / PREMIUM
    'titanio': '#878681',
    'cobre': '#b87333',
    'bronce': '#cd7f32',
    'oro rosa': '#b76e79',
    'perla': '#f0ead6',
    'cromado': 'linear-gradient(135deg, #e0e0e0 0%, #ffffff 50%, #e0e0e0 100%)',

    // 🏁 TEXTURAS / PATRONES
    'fibra carbono': 'repeating-linear-gradient(45deg, #111 0, #111 4px, #333 4px, #333 8px)',
    'comic': 'repeating-linear-gradient(45deg, #fff 0, #fff 10px, #000 10px, #000 12px)',
    'camuflado': 'repeating-radial-gradient(circle, #556b2f, #556b2f 10px, #8b4513 10px, #8b4513 20px)',

    // 🧩 MULTICOLOR (Default)
    'multicolor': 'linear-gradient(45deg, red, orange, yellow, green, blue)'
};

function obtenerEstiloColor(nombreColor) {
    if (!nombreColor) return '#cbd5e1';
    // Limpiar y dividir por guion, barra o coma
    const partes = nombreColor.split(/[-/,]/).map(p => p.trim().toLowerCase());

    if (partes.length > 1) {
        // Generar conic-gradient
        const paso = 100 / partes.length;
        let gradiente = 'conic-gradient(';
        partes.forEach((p, i) => {
            const colorHex = colorMap[p] || '#cbd5e1';
            const start = i * paso;
            const end = (i + 1) * paso;
            gradiente += `${colorHex} ${start}% ${end}%, `;
        });
        return gradiente.slice(0, -2) + ')';
    } else {
        return colorMap[nombreColor.toLowerCase()] || '#cbd5e1';
    }
}

// ═══════════════════════════════════════════════════════════════
// NAVEGACIÓN VISUAL DE SUBCATEGORÍAS (TIPO INDUCASCOS)
// ═══════════════════════════════════════════════════════════════

const SUBCATEGORIAS_VISUALES = {
    'Cascos': [
        { nombre: 'INTEGRALES', icono: 'img/icons/integral.png' },
        { nombre: 'ABATIBLES', icono: 'img/icons/abatible.png' },
        { nombre: 'ABIERTOS', icono: 'img/icons/abierto.png' },
        { nombre: 'MULTIPROPOSITO', icono: 'img/icons/multiproposito.png' },
        { nombre: 'CROSS', icono: 'img/icons/multiproposito.png' },
        { nombre: 'MODULARES', icono: 'img/icons/modular.png' }
    ],
    'Accesorios': [
        { nombre: 'MALETEROS', icono: 'img/icons/maletero.png' },
        { nombre: 'INTERCOMUNICADORES', icono: 'img/icons/intercomunicador.png' },
        { nombre: 'CANDADOS', icono: 'img/icons/candado.png' },
        { nombre: 'VISORES', icono: 'img/icons/visor.png' },
        { nombre: 'RODILLERAS', icono: 'img/icons/rodilleras.png' },
        { nombre: 'PIJAMA CON BAUL', icono: 'img/icons/pijama con baul.png' },
        { nombre: 'PIJAMA SIN BAUL', icono: 'img/icons/pijama sin baul.png' },
        { nombre: 'CAMPANAS', icono: 'img/icons/campana motera.png' },
        { nombre: 'GAFAS CROSS', icono: 'img/icons/gafas cross.PNG' },
        { nombre: 'PROTECTOR ZAPATO', icono: 'img/icons/protector-zapato.png' },
        { nombre: 'CACHOS', icono: 'img/icons/cachos.png' }
    ],
    'Chaquetas': [
        { nombre: 'CHAQUETAS', icono: 'img/icons/chaqueta.png' },
        { nombre: 'IMPERMEABLES', icono: 'img/icons/impermeable.png' } // Ojo: Impermeables se repite en accesorios
    ],
    'Guantes': [
        { nombre: 'GUANTES', icono: 'img/icons/guantes.png' }
    ],
    'Botas': [
        { nombre: 'BOTAS', icono: 'img/icons/botas.png' }
    ],
    'Tank Bags': [
        { nombre: 'TANK BAG', icono: 'img/icons/tank-bag.png' }
    ],
    'Cortavientos': [
        { nombre: 'CORTAVIENTO', icono: 'img/icons/cortaviento.png' }
    ],
    'NIÑ@S': [
        { nombre: 'ARNES', icono: 'img/icons/arnes-nino.png' },
        { nombre: 'NIÑ@S', icono: 'img/icons/niños.png' }
    ],
    'Pierneras': [
        { nombre: 'PIERNERA', icono: 'img/icons/piernera.png' }
    ],
    'Multiclavas': [
        { nombre: 'MULTICLAVA', icono: 'img/icons/multiclava.png' }
    ],
    'Porta Celulares': [
        { nombre: 'PORTA CELULAR', icono: 'img/icons/porta-celular.png' }
    ],
    'Trajes de Protección': [
        { nombre: 'CHAQUETAS', icono: 'img/icons/chaqueta.png' },
        { nombre: 'IMPERMEABLES', icono: 'img/icons/impermeable.png' },
        { nombre: 'PANTALONES', icono: 'img/icons/pantalones.png' },
        { nombre: 'TIRAS REFLECTIVAS', icono: 'img/icons/tiras reflectivas.png' }
    ]
};


function renderizarSubcategoriasVisuales(categoria) {

    const container = document.getElementById('categoriasVisuales');
    const grid = document.getElementById('gridCategoriasVisuales');
    const titulo = document.getElementById('tituloCategoriaVisual');
    const filtroSubcat = document.getElementById('filtroSubcategoria');

    // Normalizar búsqueda (Case Insensitive)
    let categoriaKey = null;
    if (categoria) {
        categoriaKey = Object.keys(SUBCATEGORIAS_VISUALES).find(k => k.toLowerCase() === categoria.toLowerCase());
    }



    // Si no hay categoría válida o no tiene subcategorías visuales definidas
    if (!categoriaKey) {
        if (container) container.style.display = 'none';
        return;
    }

    const subcategorias = SUBCATEGORIAS_VISUALES[categoriaKey];

    // Mostrar contenedor
    if (container) container.style.display = 'block';
    if (titulo) titulo.textContent = `${categoriaKey}`;
    if (grid) {
        grid.innerHTML = ''; // Limpiar contenido previo para evitar duplicados

        // Aplicar estilos al contenedor GRID directamente para asegurar horizontalidad
        grid.style.display = 'flex';
        grid.style.flexWrap = 'nowrap';
        grid.style.justifyContent = 'flex-start';
        grid.style.gap = '3rem';
        grid.style.overflowX = 'auto';
        grid.style.padding = '10px';

        subcategorias.forEach(sub => {
            const item = document.createElement('div');
            item.className = 'categoria-visual-item';

            // Marcar activo si ya está filtrado
            if (filtroSubcat && filtroSubcat.value === sub.nombre) {
                item.classList.add('active');
            }

            // Evento Click
            item.onclick = () => {
                if (filtroSubcat) {
                    if (item.classList.contains('active')) {
                        filtroSubcat.value = '';
                        item.classList.remove('active');
                    } else {
                        filtroSubcat.value = sub.nombre;
                        document.querySelectorAll('.categoria-visual-item').forEach(i => i.classList.remove('active'));
                        item.classList.add('active');
                    }
                    aplicarFiltros();
                    document.getElementById('productosGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            };

            const activeStyle = (filtroSubcat && filtroSubcat.value === sub.nombre)
                ? 'border-color:#ea580c; background-color:white; transform:scale(1.05);'
                : 'border-color:transparent; background-color:#f8f9fa;';

            const activeImgStyle = (filtroSubcat && filtroSubcat.value === sub.nombre)
                ? 'filter:none;'
                : 'filter:grayscale(100%); opacity:0.7;';

            item.innerHTML = `
                <div class="categoria-visual-icon">
                    <img src="${sub.icono}" alt="${sub.nombre}" class="categoria-visual-item-img">
                </div>
                <span>${sub.nombre}</span>
            `;
            grid.appendChild(item);
        });
    }
}
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
    const cartCount = document.getElementById('cartCount');
    const floatingCount = document.getElementById('cartFloatingCount');

    if (cartCount) cartCount.textContent = total;
    if (floatingCount) floatingCount.textContent = total;
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

        // Cargar Stock Real (Suma de TODAS las tiendas + tabla unificada)
        const tablasInventario = ['inventario_alcala', 'inventario_01', 'inventario_jordan', 'inventario_digital', 'inventario_evento'];
        const stockMap = {};
        // Tablas por tienda usan campo "id_producto"
        const stockPromises = tablasInventario.map(tabla =>
            supabaseClient.from(tabla).select('id_producto, cantidad').then(r => r.data || [])
        );
        // Tabla unificada usa campo "producto_id"
        const unificadaPromise = supabaseClient.from('inventario').select('producto_id, cantidad').then(r => r.data || []);
        const [todosStocks, stockUnificado] = await Promise.all([Promise.all(stockPromises), unificadaPromise]);
        todosStocks.flat().forEach(s => {
            if (s.id_producto) {
                stockMap[s.id_producto] = (stockMap[s.id_producto] || 0) + (s.cantidad || 0);
            }
        });
        stockUnificado.forEach(s => {
            if (s.producto_id) {
                stockMap[s.producto_id] = (stockMap[s.producto_id] || 0) + (s.cantidad || 0);
            }
        });

        todosLosProductos = (data || []).map(p => {
            const c = cal[p.id] || cal[p.id_producto];
            const stockTotal = stockMap[p.id] || stockMap[p.id_producto] || 0;
            return {
                ...p,
                categoria: (p.categoria || '').trim(),
                subcategoria: (p.subcategoria || '').trim(),
                rating: c ? (c.sum / c.count).toFixed(1) : 0,
                ratingCount: c ? c.count : 0,
                stockTotal: stockTotal
            };
        });

        productosFiltrados = [...todosLosProductos];

        mostrarProductos();
        await cargarCategoriasFiltro();
        cargarTallasFiltro();
        cargarMarcasFiltro();
        actualizarContadorCarrito();
        checkUrlParams();

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

/**
 * Calcula la relevancia de un producto respecto a una búsqueda
 * @param {Object} p Producto
 * @param {string} bus Término de búsqueda (ya en minúsculas)
 * @returns {number} Puntaje de relevancia
 */
function calcularRelevancia(p, bus) {
    if (!bus) return 0;
    let score = 0;
    const n = (p.nombre || '').toLowerCase();
    const m = (p.marca || '').toLowerCase();
    const c = (p.categoria || '').toLowerCase();
    const sc = (p.subcategoria || '').toLowerCase();
    const ref = (p.referencia || '').toLowerCase();

    // 1. Coincidencia exacta o al inicio (Prioridad máxima)
    if (n === bus || ref === bus) score += 100;
    else if (n.startsWith(bus) || ref.startsWith(bus)) score += 80;

    // 2. Contiene el término exactamente
    if (n.includes(bus)) score += 50;
    if (ref.includes(bus)) score += 60; // Referencias suelen ser búsquedas precisas
    if (m.includes(bus)) score += 40;
    if (c.includes(bus)) score += 20;
    if (sc.includes(bus)) score += 25;

    // 3. Bonus por palabras individuales si es búsqueda multi-palabra
    const palabras = bus.split(' ').filter(w => w.length > 2);
    if (palabras.length > 1) {
        palabras.forEach(pal => {
            if (n.includes(pal)) score += 10;
            if (m.includes(pal)) score += 5;
        });
    }

    return score;
}

function aplicarFiltros() {
    const cat = document.getElementById('filtroCategoria').value;
    const subcat = document.getElementById('filtroSubcategoria') ? document.getElementById('filtroSubcategoria').value : '';

    // Actualizar UI Visual (al principio para asegurar ejecución)
    renderizarSubcategoriasVisuales(cat);

    // Sincronizar marcas disponibles para esta categoría/subcategoría
    cargarMarcasFiltro();

    const talEl = document.getElementById('filtroTalla');
    const tal = talEl ? talEl.value : '';
    const rate = document.getElementById('filtroCalificacion') ? document.getElementById('filtroCalificacion').value : '';
    const bus = document.getElementById('buscarProducto').value.toLowerCase();

    // Obtener marcas seleccionadas
    const marcasSeleccionadas = Array.from(document.querySelectorAll('input[name="filtroMarca"]:checked')).map(cb => cb.value.toLowerCase());

    productosFiltrados = todosLosProductos.filter(p => {
        // ... (mismo filtro) ...
        // Filtro Categoría (Case Insensitive)
        if (cat) {
            const catProd = (p.categoria || '').toLowerCase().trim();
            const catFiltro = cat.toLowerCase().trim();
            if (catProd !== catFiltro) return false;
        }

        // Filtro Subcategoría (Case Insensitive + Sinónimos)
        if (subcat) {
            const subcatProd = (p.subcategoria || '').toLowerCase().trim();
            const subcatFiltro = subcat.toLowerCase().trim();

            if (subcatProd === subcatFiltro) {
                // Coincide
            } else {
                const SINONIMOS = {
                    'maleteros': ['baul', 'baúl', 'cajon', 'top case', 'maleta'],
                    'impermeables': ['impermeable', 'traje impermeable', 'gabardina'],
                    'intercomunicadores': ['intercom', 'bluetooth'],
                    'candados': ['candado', 'bloqueo', 'seguridad'],
                    'visores': ['visor', 'pantalla', 'mica']
                };
                const terminosAlternativos = SINONIMOS[subcatFiltro] || [];
                const esSinonimo = terminosAlternativos.some(t => subcatProd.includes(t));
                if (!esSinonimo) return false;
            }
        }

        // Filtro Marca
        if (marcasSeleccionadas.length > 0) {
            const marcaProd = (p.marca || '').toLowerCase().trim();
            if (!marcasSeleccionadas.includes(marcaProd)) return false;
        }

        if (tal) {
            let pTallas = [];
            if (Array.isArray(p.tallas)) pTallas = p.tallas;
            else if (typeof p.tallas === 'string') pTallas = p.tallas.split(',').map(t => t.trim());
            if (pTallas.length === 0) return false;
            if (!pTallas.includes(tal)) return false;
        }
        if (rate) {
            if (parseFloat(p.rating || 0) < parseInt(rate)) return false;
        }
        if (bus) {
            const busqueda = `${p.nombre} ${p.marca} ${p.categoria || ''} ${p.descripcion_corta || ''}`.toLowerCase();
            if (!busqueda.includes(bus)) return false;
        }
        // Filtro Etiquetas
        const ahora = new Date().toISOString();
        const filtOferta = document.getElementById('filtroOferta');
        const filtNuevo = document.getElementById('filtroNuevo');
        if (filtOferta && filtOferta.checked) {
            if (!p.en_oferta || (p.fecha_oferta_hasta && p.fecha_oferta_hasta < ahora)) return false;
        }
        if (filtNuevo && filtNuevo.checked) {
            if (!p.es_nuevo || (p.fecha_nuevo_hasta && p.fecha_nuevo_hasta < ahora)) return false;
        }
        return true;
    });

    // ... sort ...
    // Ordenar por relevancia si hay búsqueda de texto
    if (bus) {
        productosFiltrados.sort((a, b) => {
            const scoreA = calcularRelevancia(a, bus);
            const scoreB = calcularRelevancia(b, bus);
            return scoreB - scoreA;
        });
    }
    else {
        const ordenEl = document.getElementById('ordenarProductos');
        const orden = ordenEl ? ordenEl.value : '';
        if (orden === 'precio_asc') {
            productosFiltrados.sort((a, b) => (a.precio || 0) - (b.precio || 0));
        } else if (orden === 'precio_desc') {
            productosFiltrados.sort((a, b) => (b.precio || 0) - (a.precio || 0));
        } else {
            productosFiltrados.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        }
    }

    if (window.logDebug) window.logDebug('Mostrando productos...');
    mostrarProductos();
}

function limpiarFiltros() {
    document.getElementById('filtroCategoria').value = '';
    const talEl = document.getElementById('filtroTalla');
    if (talEl) talEl.value = '';
    if (document.getElementById('filtroCalificacion')) document.getElementById('filtroCalificacion').value = '';
    document.getElementById('buscarProducto').value = '';

    // Limpiar marcas
    document.querySelectorAll('input[name="filtroMarca"]').forEach(cb => cb.checked = false);

    // Limpiar etiquetas
    const filtOferta = document.getElementById('filtroOferta'); if (filtOferta) filtOferta.checked = false;
    const filtNuevo = document.getElementById('filtroNuevo'); if (filtNuevo) filtNuevo.checked = false;

    // Forzar recarga de marcas y subcategorías
    cargarSubcategoriasFiltro('');
    cargarMarcasFiltro();

    aplicarFiltros();
}

// ... mostrarProductos ...

// Nueva función para cargar marcas dinámicamente
function cargarMarcasFiltro() {
    const container = document.getElementById('filtroMarcaCheckboxes');
    if (!container) return;

    const cat = document.getElementById('filtroCategoria').value.toLowerCase();
    const subcat = document.getElementById('filtroSubcategoria') ? document.getElementById('filtroSubcategoria').value.toLowerCase() : '';

    // Guardar selecciones actuales para intentar preservarlas
    const marcasSeleccionadasPrev = Array.from(container.querySelectorAll('input:checked')).map(cb => cb.value);

    // Obtener marcas únicas filtradas por categoría/subcategoría
    const marcas = new Set();
    todosLosProductos.forEach(p => {
        const matchCat = !cat || (p.categoria || '').toLowerCase().trim() === cat;
        const matchSub = !subcat || (p.subcategoria || '').toLowerCase().trim() === subcat;

        if (matchCat && matchSub && p.marca) {
            marcas.add(p.marca.trim());
        }
    });

    // Ordenar alfabéticamente
    const sortedMarcas = Array.from(marcas).sort((a, b) => a.localeCompare(b));

    if (sortedMarcas.length === 0) {
        container.innerHTML = '<p style="font-size:0.85rem; color:#94a3b8; padding:0.5rem;">No hay marcas para esta selección</p>';
        return;
    }

    container.innerHTML = '';
    sortedMarcas.forEach(marca => {
        const div = document.createElement('div');
        div.className = 'checkbox-item';
        const isChecked = marcasSeleccionadasPrev.includes(marca);
        div.innerHTML = `
            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; padding:3px 0; font-size:0.9rem;">
                <input type="checkbox" name="filtroMarca" value="${marca}" ${isChecked ? 'checked' : ''} onchange="aplicarFiltros()">
                ${marca}
            </label>
        `;
        container.appendChild(div);
    });

    // Chequear URL param solo si es la carga inicial (si no hay nada seleccionado aún)
    if (marcasSeleccionadasPrev.length === 0) {
        const params = new URLSearchParams(window.location.search);
        const marcaParam = params.get('marca');
        if (marcaParam) {
            const cb = Array.from(container.querySelectorAll('input')).find(i => i.value.toLowerCase() === marcaParam.toLowerCase());
            if (cb) {
                cb.checked = true;
                aplicarFiltros();
            }
        }
    }
}

// Actualizar checkUrlParams para soportar marca
// (Nota: checkUrlParams ya tenía el placeholder, pero ahora que cargarMarcasFiltro maneja su propia carga inicial de URL param,
// podemos dejarlo así o centralizarlo.
// Dado que cargarMarcasFiltro se llama al final de cargarProductos, es seguro que checkUrlParams de categoria ya corrió.
// PERO checkUrlParams corre DESPUES de cargarCategoriasFiltro.
// Mejor dejar que cargarMarcasFiltro maneje su preselección ya que es async respecto a categorías.)

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

        // Lógica para mostrar colores (chips)
        let coloresHTML = '';
        if (p.variantes && Array.isArray(p.variantes)) {
            const coloresUnicos = Array.from(new Set(p.variantes.map(v => v.color).filter(Boolean)));
            if (coloresUnicos.length > 0) {
                coloresHTML = `
                 <div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center; margin-bottom:2px;">
                    ${coloresUnicos.slice(0, 5).map(c => `
                        <span title="${c}" style="width:14px; height:14px; border-radius:50%; background:${obtenerEstiloColor(c)}; border:1px solid #cbd5e1; display:inline-block; box-shadow:0 1px 2px rgba(0,0,0,0.1);"></span>
                    `).join('')}
                    ${coloresUnicos.length > 5 ? '<span style="font-size:0.7rem; color:#94a3b8;">+</span>' : ''}
                 </div>`;
            }
        }

        return `
        <div class="producto-card" onclick="verDetalle('${p.id}')">
            <div class="producto-imagen-wrapper">
                <img class="producto-imagen ${p.stockTotal <= 0 ? 'producto-agotado' : ''}"
                     src="${p.url_imagen || PLACEHOLDER_IMG}"
                     alt="${p.nombre}"
                     loading="lazy"
                     onerror="this.src='${PLACEHOLDER_IMG}'">
                <span class="badge-categoria">${p.categoria}</span>
                ${p.stockTotal <= 0 ? '<span class="badge-agotado">No disponible</span>' : ''}
                ${(() => {
                const now = new Date().toISOString();
                let badges = '';
                if (p.en_oferta && (!p.fecha_oferta_hasta || p.fecha_oferta_hasta > now)) {
                    badges += `<span style="position:absolute;top:8px;left:8px;background:#dc2626;color:#fff;font-weight:800;font-size:0.85rem;padding:3px 10px;border-radius:6px;z-index:3;box-shadow:0 2px 6px rgba(220,38,38,0.4);">${p.porcentaje_oferta ? '-' + p.porcentaje_oferta + '%' : 'OFERTA'}</span>`;
                }
                if (p.es_nuevo && (!p.fecha_nuevo_hasta || p.fecha_nuevo_hasta > now)) {
                    /* Si ya hay oferta, bajamos el badge de nuevo */
                    const topStyle = badges ? 'top:42px;' : 'top:8px;';
                    badges += `<span style="position:absolute;${topStyle}left:8px;background:#059669;color:#fff;font-weight:800;font-size:0.85rem;padding:3px 10px;border-radius:6px;z-index:3;box-shadow:0 2px 6px rgba(5,150,105,0.4);">NUEVO</span>`;
                }
                return badges;
            })()}
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
                        <span class="producto-precio" style="display:unset;">$${parseInt(p.precio).toLocaleString('es-CO')}</span>
                        <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start;">
                            ${coloresHTML}
                            ${tallasHTML}
                        </div>
                        <button class="btn-agregar-inline" onclick="event.stopPropagation(); agregarAlCarritoRapido('${p.id}')" ${p.stockTotal <= 0 ? 'disabled' : ''}>
                            <span>${p.stockTotal <= 0 ? '🚫 Agotado' : '🛒 Agregar'}</span>
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

// Helper para ordenar tallas
function compararTallas(a, b) {
    const ordenTallas = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
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
}

async function verDetalle(id) {
    productoActual = todosLosProductos.find(p => p.id === id);
    if (!productoActual) return;

    // Abrir modal y mostrar cargando
    const modal = document.getElementById('modalDetalle');
    if (modal) modal.classList.add('active');
    document.getElementById('contenidoDetalle').innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:300px;"><div class="spinner"></div></div>';

    // 1. Obtener Stock Real (asíncrono)
    let stockReal = [];
    try {
        const idProd = productoActual.id_producto || productoActual.id;
        const { data } = await supabaseClient.from('inventario').select('*').eq('producto_id', idProd);
        stockReal = data || [];
    } catch (e) {
        console.error("Error cargando stock:", e);
    }

    const infoP = window.PromocionesManager ? window.PromocionesManager.calcularPrecio(productoActual.precio, productoActual.id) : { precioFinal: productoActual.precio, tieneDescuento: false };

    // Preparar imágenes para el Slider
    let imagenesSlider = [];
    if (productoActual.url_imagen) imagenesSlider.push({ url: productoActual.url_imagen, color: 'Principal' });

    if (productoActual.variantes && Array.isArray(productoActual.variantes)) {
        productoActual.variantes.forEach(v => {
            if (v.url && !imagenesSlider.some(img => img.url === v.url)) {
                imagenesSlider.push({ url: v.url, color: v.color });
            }
        });
    }

    document.getElementById('contenidoDetalle').innerHTML = `
        <div class="product-details-premium">
            <!-- COL 1: IMAGEN & VISUAL (SLIDER) -->
            <div class="column-media">
                <div class="slider-container" style="position:relative; border-radius:12px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.05); margin-bottom: 1rem; width:100%; background: #f8fafc;">
                    ${infoP.tieneDescuento ? `<span class="discount-pill" style="position:absolute; top:0.5rem; left:0.5rem; background:#ef4444; color:white; padding:0.25rem 0.75rem; border-radius:15px; font-weight:700; font-size:0.8rem; z-index:10;">-${infoP.porcentajeDescuento}% OFF</span>` : ''}

                    <div id="productSlider" style="display: flex; transition: transform 0.4s ease-out; width: 100%;">
                        ${imagenesSlider.map(img => `
                            <div class="slide" style="min-width: 100%; display: flex; justify-content: center; align-items: center;">
                                <img src="${img.url}" alt="${img.color}" style="max-width: 100%; max-height: 400px; object-fit: contain;">
                            </div>
                        `).join('')}
                    </div>

                    ${imagenesSlider.length > 1 ? `
                        <button onclick="moveSlider(-1)" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); background:rgba(255,255,255,0.7); border:none; border-radius:50%; width:36px; height:36px; cursor:pointer; z-index:11;">❮</button>
                        <button onclick="moveSlider(1)" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:rgba(255,255,255,0.7); border:none; border-radius:50%; width:36px; height:36px; cursor:pointer; z-index:11;">❯</button>
                    ` : ''}
                </div>

                <!-- FILA DE SELECTORES -->
                <div style="display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;">
                    <div class="variantes-section" style="flex: 1; min-width: 200px; background:#f8fafc; padding:0.8rem; border-radius:8px; border:1px solid #e2e8f0;">
                         <h5 style="margin-bottom: 0.5rem; font-weight: 700; color: #334155; font-size:0.85rem;">Color disponible:</h5>
                         <div id="contenedorVariantes" style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 0.6rem; justify-content: flex-start; align-items: center;"></div>
                         <input type="hidden" id="colorSeleccionado" value="">
                    </div>

                    <div class="variantes-section" style="flex: 1; min-width: 200px; background:#f8fafc; padding:0.8rem; border-radius:8px; border:1px solid #e2e8f0;">
                        <h5 style="margin-bottom: 0.5rem; font-weight: 700; color: #334155; font-size:0.85rem;">Tallas disponibles:</h5>
                        <div id="contenedorTallas" style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 0.6rem; justify-content: flex-start; align-items: center;"></div>
                        <input type="hidden" id="tallaSeleccionada" value="">
                    </div>
                </div>

                <input type="hidden" id="varianteSeleccionada" value="">

                <div class="product-trust-badges" style="width:100%; display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; background:#f8fafc; padding:0.75rem; border-radius:8px;">
                    <div class="trust-badge" style="display:flex; align-items:center; gap:0.25rem; font-size:0.8rem; color:#64748b;"><span>🛡️</span> Envío Seguro</div>
                    <div class="trust-badge" style="display:flex; align-items:center; gap:0.25rem; font-size:0.8rem; color:#64748b;"><span>📦</span> Stock Real</div>
                </div>
            </div>

            <!-- COL 2: INFO -->
            <div class="column-info">
                <div class="product-header" style="border-bottom:1px solid #e2e8f0; padding-bottom:1rem; margin-bottom:1rem;">
                    <span class="category-tag" style="background:#fff7ed; color:#ea580c; padding:0.25rem 0.75rem; border-radius:15px; font-size:0.75rem; font-weight:700; text-transform:uppercase;">${productoActual.categoria}</span>
                    <h2 style="font-size:1.75rem; margin:0.5rem 0; line-height:1.2; color:#1e293b;">${productoActual.nombre}</h2>
                    <p style="color:#64748b; margin:0; font-size:0.9rem;">Marca: <strong style="color:#334155;">${productoActual.marca}</strong></p>
                </div>

                <div class="product-price-section" style="margin-bottom:1rem;">
                    <span class="current-price" style="font-size:2.2rem; font-weight:800; color:#0f172a;">$${parseInt(productoActual.precio).toLocaleString('es-CO')}</span>
                </div>

                <div style="flex:1;">
                    <h4 style="font-size:1rem; font-weight:700; color:#334155; margin-bottom:0.5rem;">Descripción</h4>
                    <p style="color:#475569; line-height:1.5; margin-bottom:1.5rem; font-size:0.95rem;">${productoActual.descripcion_corta || 'Producto disponible en nuestras tiendas.'}</p>
                </div>

                <div id="disponibilidadTexto" style="margin-top: 1rem; font-weight: 700; font-size: 0.9rem;"></div>

                <div class="purchase-actions" style="margin-top:1.5rem; padding-top:1rem; border-top:1px solid #f1f5f9;">
                    <div style="display:flex; gap:0.75rem; margin-bottom:0.75rem;">
                        <div class="quantity-selector" style="border:1px solid #e2e8f0; border-radius:8px; display:flex; align-items:center; width:100px;">
                             <button style="flex:1; border:none; background:transparent; font-size:1rem; cursor:pointer;" onclick="const i=document.getElementById('cantidadDetalle'); if(i.value>1) i.value--">−</button>
                             <input type="number" id="cantidadDetalle" value="1" min="1" readonly style="width:35px; text-align:center; border:none; font-weight:700; font-size:1rem;">
                             <button style="flex:1; border:none; background:transparent; font-size:1rem; cursor:pointer;" onclick="document.getElementById('cantidadDetalle').value++">+</button>
                        </div>
                        <button id="btnAgregarCarrito" onclick="agregarAlCarrito()" style="flex:1; background:linear-gradient(135deg,#ff6b00,#ea580c); color:white; border:none; border-radius:8px; font-weight:700; font-size:1rem; cursor:pointer; padding:0.75rem;">
                            🛒 Agregar
                        </button>
                    </div>
                    <a href="#" target="_blank" id="btnWhatsappDetalle"
                       style="display:block; text-align:center; padding:0.6rem; background:#25D366; color:white; border-radius:8px; text-decoration:none; font-weight:600; font-size:0.95rem;">
                        📱 Consultar por WhatsApp
                    </a>
                </div>
            </div>

            <!-- COL 3: RESEÑAS -->
            <div class="column-extras">
                <div style="flex:1;">
                    <h4 style="margin:0; font-size:1.1rem; color:#334155; font-weight:700;">Opiniones</h4>
                    <div id="listaResenasContainer"></div>
                </div>
            </div>
        </div>
    `;

    // Lógica del Slider
    let currentSlide = 0;
    window.moveSlider = (step) => {
        currentSlide = (currentSlide + step + imagenesSlider.length) % imagenesSlider.length;
        const slider = document.getElementById('productSlider');
        if (slider) slider.style.transform = `translateX(-${currentSlide * 100}%)`;

        // Sincronizar con color si el slide tiene uno
        const imgColor = imagenesSlider[currentSlide].color;
        if (imgColor && imgColor !== 'Principal') {
            seleccionarColor(imgColor, false); // false para no mover el slider otra vez
        }
    };

    // Renderizar Colores
    const contenedorColores = document.getElementById('contenedorVariantes');

    // Prioridad: Colores definidos en variantes del producto, luego los encontrados en stock
    const coloresVariantes = (productoActual.variantes || []).map(v => v.color).filter(Boolean);
    const coloresStock = stockReal.map(s => s.color).filter(Boolean);
    const coloresUnicos = Array.from(new Set([...coloresVariantes, ...coloresStock]));

    coloresUnicos.forEach(color => {
        const btn = document.createElement('button');
        btn.className = 'variant-chip color';
        btn.title = color;
        // Rotar 45deg para que se vea mas estetico
        btn.style.cssText = `width:30px; height:30px; border-radius:50%; background:${obtenerEstiloColor(color)}; border:2px solid #e2e8f0; cursor:pointer; transform: rotate(45deg); box-shadow: 0 2px 4px rgba(0,0,0,0.1);`;
        btn.onclick = () => seleccionarColor(color, true);
        contenedorColores.appendChild(btn);
    });

    window.seleccionarColor = (color, animateSlider) => {
        document.getElementById('colorSeleccionado').value = color;
        // Actualizar UI de botones color
        document.querySelectorAll('#contenedorVariantes .variant-chip').forEach(b => b.style.borderColor = (b.title === color) ? '#ea580c' : '#e2e8f0');

        // Mover slider si corresponde
        if (animateSlider) {
            const index = imagenesSlider.findIndex(img => img.color === color);
            if (index !== -1) {
                currentSlide = index;
                document.getElementById('productSlider').style.transform = `translateX(-${currentSlide * 100}%)`;
            }
        }

        actualizarTallasPorColor(color, stockReal);
        validarDisponibilidad(stockReal);
    };

    window.actualizarTallasPorColor = (color, stock) => {
        const container = document.getElementById('contenedorTallas');
        container.innerHTML = '';

        // Tallas para el color específico
        let tallas = Array.from(new Set(stock.filter(s => s.color === color).map(s => s.talla))).filter(Boolean);

        // Fallback: si no hay tallas para ese color pero hay tallas globales (color vacio)
        if (tallas.length === 0) {
            tallas = Array.from(new Set(stock.filter(s => !s.color || s.color === '').map(s => s.talla))).filter(Boolean);
        }

        // Ordenar tallas
        tallas.sort(compararTallas);

        if (tallas.length === 0) {
            container.innerHTML = '<span style="color:#64748b; font-size:0.9rem;">Estándar</span>';
            document.getElementById('tallaSeleccionada').value = '';
        } else {
            tallas.forEach(t => {
                const btn = document.createElement('button');
                btn.className = 'variant-chip talla';
                btn.textContent = t;
                btn.style.cssText = `padding: 0.5rem 1rem; border: 2px solid #e2e8f0; border-radius: 8px; background: white; cursor: pointer; font-size: 0.9rem; transition: all 0.2s; min-width: 40px; text-align: center; color: black;`;

                btn.onclick = () => {
                    document.querySelectorAll('#contenedorTallas .variant-chip').forEach(b => {
                        b.style.borderColor = '#e2e8f0'; b.style.background = 'white'; b.style.color = 'black';
                    });
                    btn.style.borderColor = '#ea580c'; btn.style.background = '#fff7ed'; btn.style.color = '#ea580c';
                    document.getElementById('tallaSeleccionada').value = t;
                    validarDisponibilidad(stock);
                };
                container.appendChild(btn);
            });
        }
    };

    // Helper: Validar Disponibilidad
    window.validarDisponibilidad = (stock) => {
        const color = document.getElementById('colorSeleccionado').value;
        const talla = document.getElementById('tallaSeleccionada').value;

        // 1. Buscar coincidencia exacta
        let matches = stock.filter(s => s.color === color && (talla ? s.talla === talla : true));

        // 2. Fallback: buscar en stock global si no hay coincidencia exacta para el color
        if (matches.length === 0 && color !== '') {
            matches = stock.filter(s => (!s.color || s.color === '') && (talla ? s.talla === talla : true));
        }

        const totalStock = matches.reduce((sum, s) => sum + (s.cantidad || 0), 0);
        const textArea = document.getElementById('disponibilidadTexto');
        const btnAdd = document.getElementById('btnAgregarCarrito');
        const cantidadInput = document.getElementById('cantidadDetalle');

        if (totalStock > 0) {
            textArea.textContent = `✅ Disponible`;
            textArea.style.color = '#16a34a';
            btnAdd.disabled = false;
            cantidadInput.max = totalStock;
            if (parseInt(cantidadInput.value) > totalStock) cantidadInput.value = totalStock;
        } else {
            textArea.textContent = '❌ No disponible en esta combinación';
            textArea.style.color = '#ef4444';
            btnAdd.disabled = true;
            cantidadInput.value = 1;
            cantidadInput.max = 1;
        }
        document.getElementById('varianteSeleccionada').value = `${color || 'Único'}${talla ? ' | ' + talla : ''}`;

        const waBtn = document.getElementById('btnWhatsappDetalle');
        if (waBtn && typeof productoActual !== 'undefined') {
            const text = `¡Hola! Me interesa este producto: ${productoActual.nombre} (${productoActual.marca}) - ${document.getElementById('varianteSeleccionada').value} `;
            waBtn.href = `https://wa.me/${CONFIG.WHATSAPP.numero}?text=${encodeURIComponent(text)}`;
        }
    };

    // Configuración Inicial
    if (coloresUnicos.length > 0) {
        seleccionarColor(coloresUnicos[0], true);
    } else {
        actualizarTallasPorColor('', stockReal);
        validarDisponibilidad(stockReal);
    }

    // Cargar reseñas
    cargarResenasProducto(productoActual.id);
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
    if (!select || select.tagName !== 'SELECT') return;

    try {
        // 1. Obtener categorías de la DB
        const { data, error } = await supabaseClient
            .from('categorias')
            .select('nombre')
            .order('nombre');

        // 2. Obtener categorías de productos existentes (para asegurar que no falte ninguna)
        const categoriasEnUso = new Set();
        todosLosProductos.forEach(p => {
            if (p.categoria) categoriasEnUso.add(p.categoria.trim().toUpperCase());
        });

        // 3. Unificar listas
        const categoriasFinales = new Set();
        if (data) data.forEach(c => categoriasFinales.add(c.nombre.trim().toUpperCase()));
        categoriasEnUso.forEach(c => categoriasFinales.add(c));

        // 4. Ordenar alfabéticamente
        const sortedCats = Array.from(categoriasFinales).sort((a, b) => a.localeCompare(b));

        // 5. Llenar Select
        select.innerHTML = '<option value="">Todas las Categorías</option>';
        sortedCats.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            select.appendChild(option);
        });

        // 6. Verificar URL param después de cargar opciones
        checkUrlParams();

    } catch (e) {
        console.error('Error cargando categorías filtro:', e);
    }
}

function cargarSubcategoriasFiltro(categoriaSeleccionada) {
    const subSelect = document.getElementById('filtroSubcategoria');
    const subGroup = document.getElementById('grupoSubcategoria');
    if (!subSelect || !subGroup) return;

    // Limpiar opciones anteriores
    subSelect.innerHTML = '<option value="">Todas las subcategorías</option>';

    if (!categoriaSeleccionada) {
        subGroup.style.display = 'none';
        return;
    }

    // Filtrar productos de la categoría seleccionada para encontrar subcategorías
    const subcategorias = new Set();
    todosLosProductos.forEach(p => {
        if ((p.categoria || '').toLowerCase() === categoriaSeleccionada.toLowerCase()) {
            if (p.subcategoria) subcategorias.add(p.subcategoria.trim());
        }
    });

    // Si no hay subcategorías, ocultar el filtro
    if (subcategorias.size === 0) {
        subGroup.style.display = 'none';
        return;
    }

    // Llenar select
    const sortedSubs = Array.from(subcategorias).sort((a, b) => a.localeCompare(b));
    sortedSubs.forEach(sub => {
        const option = document.createElement('option');
        option.value = sub;
        option.textContent = sub;
        subSelect.appendChild(option);
    });

    // Mostrar filtro
    subGroup.style.display = 'block';

    // Actualizar marcas para esta subcategoría
    cargarMarcasFiltro();
}

function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const catParam = params.get('categoria');
    const subcatParam = params.get('subcategoria');
    const marcaParam = params.get('marca');
    const buscarParam = params.get('buscar') || params.get('busqueda');

    let shouldFilter = false;

    // 0. Aplicar Búsqueda desde URL
    if (buscarParam) {
        const searchInput = document.getElementById('buscarProducto');
        if (searchInput) {
            searchInput.value = decodeURIComponent(buscarParam);
            shouldFilter = true;
        }
    }

    // 1. Aplicar Categoría
    if (catParam) {
        const select = document.getElementById('filtroCategoria');
        if (select) {
            // Intentar match directo o case-insensitive
            let match = Array.from(select.options).find(opt => opt.value === catParam || opt.value.toLowerCase() === catParam.toLowerCase());
            if (match) {
                select.value = match.value;

                // Cargar subcategorías basadas en la elección
                cargarSubcategoriasFiltro(select.value);
                shouldFilter = true;
            }
        }
    }

    // 2. Aplicar Subcategoría (después de cargar las opciones)
    if (subcatParam && shouldFilter) {
        const subSelect = document.getElementById('filtroSubcategoria');
        if (subSelect) {
            let matchSub = Array.from(subSelect.options).find(opt => opt.value === subcatParam || opt.value.toLowerCase() === subcatParam.toLowerCase());
            if (matchSub) {
                subSelect.value = matchSub.value;
            }
        }
    }

    // 3. Aplicar Etiquetas desde URL
    const ofertaParam = params.get('oferta');
    const nuevoParam = params.get('nuevo');
    if (ofertaParam === '1') { const cb = document.getElementById('filtroOferta'); if (cb) cb.checked = true; shouldFilter = true; }
    if (nuevoParam === '1') { const cb = document.getElementById('filtroNuevo'); if (cb) cb.checked = true; shouldFilter = true; }

    // Si hubo algún cambio por URL, aplicar filtros
    if (shouldFilter || catParam || subcatParam || marcaParam) {
        aplicarFiltros();
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
        inputVar.value = `${color} | Talla: ${talla} `;
    } else if (talla) {
        inputVar.value = `Talla: ${talla} `;
    } else if (color) {
        inputVar.value = color;
    } else {
        inputVar.value = '';
    }

    // Actualizar botón WhatsApp
    const waBtn = document.getElementById('btnWhatsappDetalle');
    if (waBtn && typeof productoActual !== 'undefined') {
        const text = `¡Hola! Me interesa este producto: ${productoActual.nombre} (${productoActual.marca}) - ${inputVar.value} `;
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

    // Ordenar tallas
    const tallasArray = Array.from(tallasSet).sort(compararTallas);

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

function toggleSidebarMobile() {
    const sidebar = document.querySelector('.filtros-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
}

// Exportar funciones para uso inline en HTML
window.aplicarFiltros = aplicarFiltros;
window.limpiarFiltros = limpiarFiltros;
window.toggleFiltro = typeof toggleFiltro !== 'undefined' ? toggleFiltro : null;
window.cargarSubcategoriasFiltro = typeof cargarSubcategoriasFiltro !== 'undefined' ? cargarSubcategoriasFiltro : null;
window.toggleSidebarMobile = toggleSidebarMobile;
window.toggleMobileMenu = toggleMobileMenu;
window.verDetalle = verDetalle;
window.cerrarModalDetalle = cerrarModalDetalle;
window.abrirCarrito = abrirCarrito;
window.cerrarModalCarrito = cerrarModalCarrito;
window.agregarAlCarrito = agregarAlCarrito;
window.agregarAlCarritoRapido = agregarAlCarritoRapido;
window.cambiarCantidad = cambiarCantidad;
window.eliminarDelCarrito = eliminarDelCarrito;
window.vaciarCarrito = vaciarCarrito;
window.enviarPedidoWhatsApp = enviarPedidoWhatsApp;

// Evento para cerrar sidebar al hacer click en overlay
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) {
        overlay.addEventListener('click', toggleSidebarMobile);
    }
});

// Fin del archivo

// ═══════════════════════════════════════════════════════════════
// INICIALIZACIÓN Y EVENTOS DOM
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar Productos
    if (typeof cargarProductos === 'function') {
        cargarProductos();
    }

    // 2. Sincronizar Buscador Header <-> Filtro Sidebar
    const headerSearch = document.getElementById('headerSearch');
    const buscarProducto = document.getElementById('buscarProducto');

    if (headerSearch && buscarProducto) {
        // Input Header -> Input Filtro
        headerSearch.addEventListener('input', (e) => {
            buscarProducto.value = e.target.value;
            // Debounce opcional o aplicar directo
            aplicarFiltros();
        });

        // Enter en Header
        headerSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                buscarProducto.value = headerSearch.value;
                aplicarFiltros();
                const grid = document.getElementById('productosGrid');
                if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });

        // Click Botón Lupa Header
        const btnSearch = headerSearch.nextElementSibling;
        if (btnSearch && btnSearch.tagName === 'BUTTON') {
            btnSearch.addEventListener('click', () => {
                buscarProducto.value = headerSearch.value;
                aplicarFiltros();
                const grid = document.getElementById('productosGrid');
                if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }

        // Input Filtro -> Sync Header (Opcional, visual)
        buscarProducto.addEventListener('input', (e) => {
            headerSearch.value = e.target.value;
        });
    }

    // 3. Leer parámetro URL 'busqueda' (desde Index)
    const params = new URLSearchParams(window.location.search);
    const busquedaQuery = params.get('busqueda');
    if (busquedaQuery) {
        if (buscarProducto) buscarProducto.value = busquedaQuery;
        if (headerSearch) headerSearch.value = busquedaQuery;

        // El filtro se aplicará cuando carguen los productos (checkUrlParams o similar)
        // Pero por seguridad:
        setTimeout(() => {
            if (typeof aplicarFiltros === 'function') aplicarFiltros();
        }, 800);
    }
});