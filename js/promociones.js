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
            const { data, error } = await supabaseClient
                .from('promociones')
                .select('*')
                .eq('estado', 'Activa');
            
            if (error) throw error;
            
            this.promociones = data || [];
            this.cargado = true;
            
            console.log('✅ Promociones cargadas:', this.promociones.length);
            return this.promociones;
            
        } catch (error) {
            console.error('Error cargando promociones:', error);
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
            console.warn('⚠️ Promociones no cargadas. Llama primero a PromocionesManager.cargar()');
            return null;
        }

        for (const promo of this.promociones) {
            // Verificar si el producto está incluido
            const idsIncluidos = (promo.productos_incluidos || '')
                .split(',')
                .map(id => id.trim())
                .filter(id => id && id !== '000');
            
            const productoEnPromo = idsIncluidos.some(id => 
                productoId === id || 
                productoId === `PROD${id}` ||
                productoId.includes(id)
            );
            
            if (!productoEnPromo) continue;
            
            // Verificar si aplica al local
            if (local && promo.locales_aplicables !== 'Todos') {
                const localesPromo = promo.locales_aplicables.split(',').map(l => l.trim().toLowerCase());
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
                locales: promo.locales_aplicables
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
        
        // Parsear fechas (formato DD/MM/AAAA)
        const parseDate = (dateStr) => {
            if (!dateStr) return null;
            const parts = dateStr.split('/');
            if (parts.length !== 3) return null;
            return new Date(parts[2], parts[1] - 1, parts[0]);
        };
        
        const fechaInicio = parseDate(promo.fecha_inicio);
        const fechaFin = parseDate(promo.fecha_fin);
        
        if (fechaInicio && hoy < fechaInicio) return false;
        if (fechaFin && hoy > fechaFin) return false;
        
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
        const promo = this.verificarPromocion(productoId, local);
        
        if (!promo) {
            return {
                precioOriginal,
                precioFinal: precioOriginal,
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
            tienePromo: true,
            descuento: promo.descuento,
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

console.log('✅ Módulo de Promociones cargado');