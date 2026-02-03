// ═══════════════════════════════════════════════════════════════
// MOTEROS SPORTS LINE - MÓDULO DE PROMOCIONES
// Agregar este archivo como js/promociones.js
// ═══════════════════════════════════════════════════════════════

const PromocionesManager = {
    promociones: [],
    cargado: false,

    /**
     * Cargar todas las promociones activas
     */
    async cargar() {
        try {
            const client = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
            if (!client) {
                if (window.registrarLogSistema) window.registrarLogSistema("warn_sistema", '⚠️ Supabase client no listo. Reintentando cargar promociones en 1s...');
                setTimeout(() => this.cargar(), 1000);
                return [];
            }

            const { data, error } = await client
                .from('promociones')
                .select('*')
                .eq('estado', 'Activa');

            if (error) throw error;

            this.promociones = data || [];
            this.cargado = true;


            return this.promociones;

        } catch (error) {
            if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando promociones:', error);
            return [];
        }
    },

    /**
     * Verificar si un producto tiene promoción activa
     * @param {string} productoId - ID del producto
     * @param {string} local - Local donde se vende (opcional)
     * @returns {object} - Info de la promoción o null
     */
    verificarPromocion(productoId, local = null) {
        if (!this.cargado) {
            if (window.registrarLogSistema) window.registrarLogSistema("warn_sistema", '⚠️ Promociones no cargadas. Llama primero a PromocionesManager.cargar();');
            return null;
        }

        for (const promo of this.promociones) {
            // Verificar si el producto está incluido (puede ser array de IDs o string separado por comas)
            let idsIncluidos = [];
            if (Array.isArray(promo.productos)) {
                idsIncluidos = promo.productos;
            } else if (promo.productos_incluidos) {
                idsIncluidos = promo.productos_incluidos.split(',').map(id => id.trim());
            } else if (promo.productos) { // A veces Supabase lo devuelve como string si es texto plano
                idsIncluidos = String(promo.productos).split(',').map(id => id.trim());
            }

            idsIncluidos = idsIncluidos.filter(id => id && id !== '000');

            // IDs de producto a comprobar (pueden ser uno o varios)
            const idsProducto = Array.isArray(productoId) ? productoId : [productoId];

            const productoEnPromo = idsIncluidos.some(idIncluido =>
                idsProducto.some(idProd => {
                    const sProd = String(idProd).trim().toLowerCase();
                    const sIncl = String(idIncluido).trim().toLowerCase();
                    return sProd === sIncl ||
                        sProd === `prod${sIncl}` ||
                        `prod${sProd}` === sIncl ||
                        sProd.includes(sIncl) ||
                        sIncl.includes(sProd);
                })
            );

            if (!productoEnPromo) continue;

            // Verificar si es un COMBO/PAQUETE (estos requieren validación especial de carrito completo)
            const esCombo = promo.tipo === 'Combo' || promo.tipo === 'Paquete' || promo.nombre.toLowerCase().includes('combo') || promo.nombre.toLowerCase().includes('paquete');
            if (esCombo && !local) { // Si no se pasa local, solemos estar verificando precio individual
                // No aplicar descuento de combo automáticamente si se consulta precio individual sin contexto de carrito
                // a menos que sea explícito
                continue;
            }

            // Verificar si aplica al local
            const localesAplicables = promo.locales_aplicables || promo.locales || 'Todos';
            if (local && localesAplicables !== 'Todos') {
                const localesPromo = localesAplicables.split(',').map(l => l.trim().toLowerCase());
                if (!localesPromo.includes(local.toLowerCase())) continue;
            }

            // Verificar fechas de vigencia
            if (!this.estaVigente(promo)) continue;

            // ¡Promoción válida!
            return {
                id: promo.id_promo,
                nombre: promo.nombre,
                descuento: parseFloat(promo.descuento) || 0,
                fechaFin: promo.fecha_fin,
                locales: localesAplicables
            };
        }

        return null;
    },

    /**
     * Verificar si una promoción está vigente por fecha
     */
    estaVigente(promo) {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const fechaInicioStr = promo.fecha_inicio || promo.inicio;
        const fechaFinStr = promo.fecha_fin || promo.fin;

        // Parsear fechas (soporta ISO YYYY-MM-DD y DD/MM/AAAA)
        const parseDate = (dateStr) => {
            if (!dateStr) return null;
            if (dateStr instanceof Date) return dateStr;

            // Intentar parseo directo (ISO YYYY-MM-DD, Timestamps, etc.)
            let d = new Date(dateStr);
            if (!isNaN(d.getTime())) return d;

            // Caso especial DD/MM/AAAA si el directo falló
            if (typeof dateStr === 'string' && dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    return new Date(parts[2], parts[1] - 1, parts[0]);
                }
            }
            return null;
        };

        const fechaInicio = parseDate(fechaInicioStr);
        const fechaFin = parseDate(fechaFinStr);

        if (fechaInicio && hoy < fechaInicio) return false;

        // Si hay fecha fin, verificar expiración
        if (fechaFin) {
            // Añadir el día completo a la fecha fin para que expire a las 23:59:59
            const fechaFinLimite = new Date(fechaFin);
            fechaFinLimite.setHours(23, 59, 59, 999);
            if (hoy > fechaFinLimite) return false;
        }

        return true;
    },

    /**
     * Calcular precio con descuento
     * @param {number} precioOriginal - Precio original del producto
     * @param {string} productoId - ID del producto
     * @param {string} local - Local (opcional)
     * @returns {object} - Precio original, con descuento, y info de promo
     */
    calcularPrecio(precioOriginal, productoId, local = null) {
        // La promoción solo aplica en index.js (Carrusel), no en catalogo.html
        if (window.location.pathname.includes('catalogo')) {
            return {
                precioOriginal,
                precioFinal: precioOriginal,
                tieneDescuento: false,
                tienePromo: false,
                descuento: 0,
                ahorro: 0,
                promocion: null
            };
        }

        const promo = this.verificarPromocion(productoId, local);

        if (!promo) {
            return {
                precioOriginal,
                precioFinal: precioOriginal,
                tieneDescuento: false, // Cambiado a coincidir con el uso en index.js
                tienePromo: false,
                descuento: 0,
                ahorro: 0,
                promocion: null
            };
        }

        const descuento = promo.descuento / 100;
        const precioFinal = Math.round(precioOriginal * (1 - descuento));
        const ahorro = precioOriginal - precioFinal;

        return {
            precioOriginal,
            precioFinal,
            tieneDescuento: true, // Cambiado a coincidir con el uso en index.js
            tienePromo: true,
            descuento: promo.descuento,
            nombrePromo: promo.nombre, // Añadido para index.js
            ahorro,
            promocion: promo
        };
    },

    /**
     * Calcular total del carrito con promociones aplicadas
     * @param {Array} carrito - Array de items del carrito
     * @param {string} local - Local de la venta
     * @returns {object} - Resumen con totales y descuentos
     */
    calcularTotalCarrito(carrito, local = null) {
        let subtotal = 0;
        let totalDescuentos = 0;
        let totalFinal = 0;
        const detalleItems = [];

        carrito.forEach(item => {
            const resultado = this.calcularPrecio(item.precio, item.id, local);
            const subtotalItem = item.precio * item.cantidad;
            const totalItem = resultado.precioFinal * item.cantidad;

            subtotal += subtotalItem;
            totalFinal += totalItem;
            totalDescuentos += (subtotalItem - totalItem);

            detalleItems.push({
                ...item,
                precioOriginal: item.precio,
                precioConPromo: resultado.precioFinal,
                tienePromo: resultado.tienePromo,
                descuento: resultado.descuento,
                promocion: resultado.promocion?.nombre || null,
                subtotal: subtotalItem,
                total: totalItem,
                ahorro: subtotalItem - totalItem
            });
        });

        return {
            subtotal,
            totalDescuentos,
            totalFinal,
            items: detalleItems,
            hayPromociones: totalDescuentos > 0
        };
    },

    /**
     * Generar resumen de promociones aplicadas para factura
     */
    generarResumenFactura(carrito, local = null) {
        const calculo = this.calcularTotalCarrito(carrito, local);

        let resumen = '';
        resumen += '═══════════════════════════════════\n';
        resumen += '        DETALLE DE COMPRA\n';
        resumen += '═══════════════════════════════════\n\n';

        calculo.items.forEach(item => {
            resumen += `${item.nombre}\n`;
            resumen += `  ${item.cantidad} x $${item.precioOriginal.toLocaleString('es-CO')}`;

            if (item.tienePromo) {
                resumen += ` → $${item.precioConPromo.toLocaleString('es-CO')} (-${item.descuento}%)\n`;
                resumen += `  🏷️ ${item.promocion}\n`;
            } else {
                resumen += '\n';
            }

            resumen += `  Subtotal: $${item.total.toLocaleString('es-CO')}\n\n`;
        });

        resumen += '───────────────────────────────────\n';
        resumen += `Subtotal:    $${calculo.subtotal.toLocaleString('es-CO')}\n`;

        if (calculo.hayPromociones) {
            resumen += `Descuentos:  -$${calculo.totalDescuentos.toLocaleString('es-CO')} 🎉\n`;
        }

        resumen += `───────────────────────────────────\n`;
        resumen += `TOTAL:       $${calculo.totalFinal.toLocaleString('es-CO')}\n`;
        resumen += '═══════════════════════════════════\n';

        return resumen;
    },

    /**
     * Obtener todas las promociones activas con sus productos
     */
    async obtenerPromocionesConProductos() {
        if (!this.cargado) await this.cargar();

        const { data: productos } = await supabaseClient
            .from('productos')
            .select('*')
            .eq('estado', 'Activo');

        return this.promociones.map(promo => {
            const idsIncluidos = (promo.productos_incluidos || '')
                .split(',')
                .map(id => id.trim())
                .filter(id => id && id !== '000');

            const productosPromo = productos.filter(p =>
                idsIncluidos.some(id =>
                    p.id_producto === id ||
                    p.id_producto === `PROD${id}`
                )
            );

            return {
                ...promo,
                productos: productosPromo,
                cantidadProductos: productosPromo.length
            };
        });
    },

    /**
     * Valida el carrito completo para asegurar que los combos tengan todos sus componentes
     */
    validarCarrito(carrito, local = null) {
        // Agrupar items que vienen de un combo
        const combos = {};
        carrito.forEach(item => {
            if (item.promocion && item.promocion.startsWith('Combo:')) {
                const idPromo = item.promocion.replace('Combo: ', '');
                if (!combos[idPromo]) combos[idPromo] = [];
                combos[idPromo].push(item);
            }
        });

        // Validar cada combo encontrado
        for (const idPromo in combos) {
            const itemsEnCarrito = combos[idPromo];
            const promo = this.promociones.find(p => String(p.id_promo) === String(idPromo));

            if (!promo) {
                this.revertirPrecios(itemsEnCarrito, local);
                continue;
            }

            // Obtener IDs requeridos
            let idsRequeridos = [];
            if (Array.isArray(promo.productos)) idsRequeridos = promo.productos;
            else if (promo.productos_incluidos) idsRequeridos = promo.productos_incluidos.split(',');
            else idsRequeridos = String(promo.productos || '').split(',');

            idsRequeridos = idsRequeridos.map(id => id.trim().toLowerCase()).filter(id => id && id !== '000');

            // Verificar integridad
            const idsEnCarritoActual = itemsEnCarrito.map(i => String(i.id_producto || i.id).toLowerCase());
            const incompleto = idsRequeridos.some(idReq =>
                !idsEnCarritoActual.some(idCar => idCar === idReq || idCar === `prod${idReq}` || idCar.includes(idReq))
            );

            if (incompleto) {
                this.revertirPrecios(itemsEnCarrito, local);
            }
        }
    },

    revertirPrecios(items, local) {
        items.forEach(item => {
            // Quitar marca de combo
            item.promocion = null;
            // Buscar si tiene otra promo individual
            const info = this.calcularPrecio(item.precioOriginal, [item.id, item.id_producto], local);
            item.precioFinal = info.precioFinal;
            item.descuento = info.descuento;
            item.promocion = info.tienePromo ? info.nombrePromo : null;
        });
    },

    // ════════════ PROMOCIONES DE CLIENTES (AUTOMÁTICAS) ════════════
    reglasCliente: [],

    async cargarReglasClientes() {
        try {
            const client = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
            if (!client) return;

            const { data } = await client
                .from('configuracion_sistema')
                .select('valor')
                .eq('clave', 'reglas_promociones_clientes')
                .single();

            if (data && data.valor) {
                this.reglasCliente = JSON.parse(data.valor);
            }
        } catch (e) { console.error('Error cargando reglas clientes:', e); }
    },

    /**
     * Evalúa si el cliente es elegible para nuevas promociones
     * @param {object} cliente - Objeto cliente completo
     * @returns {array} - Lista de promociones sugeridas
     */
    async sugerirPromocionesCliente(cliente) {
        if (!this.reglasCliente.length) await this.cargarReglasClientes();

        const sugerencias = [];
        const client = window.supabaseClient || supabaseClient;

        // Obtener promos ya asignadas al cliente para no repetir
        const { data: asignadas } = await client
            .from('promociones_clientes')
            .select('promocion_id')
            .eq('cliente_id', cliente.id)
            .eq('activa', true);

        const idsAsignados = asignadas ? asignadas.map(a => a.promocion_id) : [];

        for (const regla of this.reglasCliente) {
            // Saltarse si ya la tiene
            if (idsAsignados.includes(regla.promocionId)) continue;

            const cumpleMonto = (cliente.total_compras || 0) >= (regla.metaMonto || 0);
            const cumpleCompras = (cliente.numero_compras || 0) >= (regla.metaCompras || 0);

            if (cumpleMonto && cumpleCompras) {
                // Obtener nombre de la promo
                const promo = this.promociones.find(p => p.id_promo == regla.promocionId);
                if (promo) {
                    sugerencias.push({
                        regla: regla.nombre,
                        promocion: promo,
                        motivo: `Compras: $${(cliente.total_compras || 0).toLocaleString()} | Visitas: ${cliente.numero_compras}`
                    });
                }
            }
        }
        return sugerencias;
    },

    /**
     * Asignar promoción a un cliente (Autorización Admin)
     */
    async asignarPromocionCliente(clienteId, promocionId, autorizadoPor = 'Admin') {
        const client = window.supabaseClient || supabaseClient;

        // Calcular fechas (mes actual por defecto)
        const inicio = new Date();
        const fin = new Date();
        fin.setMonth(fin.getMonth() + 1); // 1 mes de vigencia por defecto

        const { error } = await client.from('promociones_clientes').insert({
            cliente_id: clienteId,
            promocion_id: promocionId,
            fecha_inicio: inicio.toISOString(),
            fecha_fin: fin.toISOString(),
            activa: true,
            autorizado_por: autorizadoPor
        });

        if (error) throw error;
        return true;
    }
};

// Exportar globalmente
window.PromocionesManager = PromocionesManager;

// Auto-cargar al iniciar
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof supabaseClient !== 'undefined') {
        await PromocionesManager.cargar();
    }
});


