// js/db.js - VERSIÓN CORREGIDA

const DB = {
  
  // Obtener cliente (usa el global o crea uno)
  getClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (window.supabase?.createClient) {
      window.supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
      return window.supabaseClient;
    }
    throw new Error('Supabase no disponible');
  },

  // ========== PRODUCTOS ==========
  async getProductos(filtros = {}) {
    try {
      const client = this.getClient();
      let query = client
        .from('productos')
        .select('*')
        .eq('estado', 'Activo');
      
      if (filtros.categoria) query = query.eq('categoria', filtros.categoria);
      if (filtros.busqueda) query = query.ilike('nombre', `%${filtros.busqueda}%`);
      query = query.order('nombre', { ascending: true });
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al cargar productos:', error);
      return [];
    }
  },
  
  async getProducto(idProducto) {
    try {
      const client = this.getClient();
      const { data, error } = await client
        .from('productos')
        .select('*')
        .eq('id_producto', idProducto)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al cargar producto:', error);
      return null;
    }
  },
  
  // ========== STOCK (cuando lo crees) ==========
  
  async getStockTienda(tienda) {
    try {
      const { data, error } = await supabase
        .from('stock')
        .select(`
          *,
          productos:producto_id (*)
        `)
        .eq('tienda', tienda);
      
      if (error) throw error;
      return data || [];
      
    } catch (error) {
      console.error('Error al cargar stock:', error);
      return [];
    }
  },
  
  async actualizarStock(stockId, nuevaCantidad) {
    try {
      const { data, error } = await supabase
        .from('stock')
        .update({ 
          cantidad: nuevaCantidad,
          ultima_actualizacion: new Date().toISOString()
        })
        .eq('id', stockId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
      
    } catch (error) {
      console.error('Error al actualizar stock:', error);
      throw error;
    }
  },
  
  // ========== VENTAS (cuando la crees) ==========
  
  async registrarVenta(ventaData) {
    try {
      const { data, error } = await supabase
        .from('ventas')
        .insert({
          id_venta: 'V' + Date.now(),
          tienda: ventaData.tienda,
          producto_id: ventaData.producto_id,
          nombre_producto: ventaData.nombre_producto,
          cantidad: ventaData.cantidad,
          precio_unitario: ventaData.precio_unitario,
          total: ventaData.total,
          metodo_pago: ventaData.metodo_pago,
          vendedor: ventaData.vendedor
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Actualizar stock automáticamente
      if (data) {
        await this.reducirStock(
          ventaData.tienda,
          ventaData.producto_id,
          ventaData.cantidad
        );
      }
      
      return data;
      
    } catch (error) {
      console.error('Error al registrar venta:', error);
      throw error;
    }
  },
  
  async reducirStock(tienda, productoId, cantidad) {
    try {
      // Buscar el registro de stock
      const { data: stockActual } = await supabase
        .from('stock')
        .select('*')
        .eq('producto_id', productoId)
        .eq('tienda', tienda)
        .single();
      
      if (stockActual) {
        const nuevoStock = Math.max(0, stockActual.cantidad - cantidad);
        
        await supabase
          .from('stock')
          .update({ cantidad: nuevoStock })
          .eq('id', stockActual.id);
      }
      
    } catch (error) {
      console.error('Error al reducir stock:', error);
    }
  },
  
  async getVentasTienda(tienda, limite = 50) {
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select('*')
        .eq('tienda', tienda)
        .order('created_at', { ascending: false })
        .limit(limite);
      
      if (error) throw error;
      return data || [];
      
    } catch (error) {
      console.error('Error al cargar ventas:', error);
      return [];
    }
  }
};

// Exportar
window.DB = DB;