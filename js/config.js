// ═══════════════════════════════════════════════════════════════
// MOTEROS SPORTS LINE - CONFIGURACIÓN GLOBAL
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  // ═══════════════════════════════════════════════════════════════
  // CREDENCIALES SUPABASE
  // ═══════════════════════════════════════════════════════════════
  SUPABASE_URL: 'https://pbblthbrdkevuyjxyuar.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiYmx0aGJyZGtldnV5anh5dWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNjUwMzcsImV4cCI6MjA4MTc0MTAzN30.bNAcp186l7l9IRWdcwBxuSgvmRtRy-qPFhZ7HRvaBZE',
  
  // ═══════════════════════════════════════════════════════════════
  // TIENDAS
  // ═══════════════════════════════════════════════════════════════
  TIENDAS: {
    'Alcala': { 
      nombre: 'Alcalá',
      telefono: '3101112222',
      direccion: 'Calle Nueva 1 #12-34',
      email: 'alcala@moterossl.com',
      horario: 'Lun-Sáb 9AM-7PM'
    },
    '01': { 
      nombre: '01',
      telefono: '3112223333',
      direccion: 'Avenida Nueva 2 #56-78',
      email: '01@moterossl.com',
      horario: 'Lun-Sáb 8AM-6PM'
    },
    'Jordan': { 
      nombre: 'Jordán',
      telefono: '3123334444',
      direccion: 'Carrera Nueva 3 #90-12',
      email: 'jordan@moterossl.com',
      horario: 'Lun-Dom 10AM-8PM'
    }
  },
  
  // ═══════════════════════════════════════════════════════════════
  // CONTACTO
  // ═══════════════════════════════════════════════════════════════
  WHATSAPP: {
    numero: '573113408416',
    mensajeBase: '¡Hola Moteros Sports Line! Quiero consultar sobre:'
  },
  
  REDES_SOCIALES: {
    facebook: 'https://facebook.com/MoterosSportsLine',
    instagram: 'https://instagram.com/MoterosSportsLine',
    tiktok: 'https://tiktok.com/@MoterosSportsLine',
    email: 'contacto@moterossl.com'
  },
  
  // ═══════════════════════════════════════════════════════════════
  // CATEGORÍAS Y OPCIONES
  // ═══════════════════════════════════════════════════════════════
  CATEGORIAS: [
    'Cascos', 'Guantes', 'Chaquetas', 'Botas', 'Accesorios',
    'Intercomunicadores', 'Camaras', 'Protecciones', 'Maletas'
  ],
  
  METODOS_PAGO: ['efectivo', 'transferencia', 'tarjeta'],
  ESTADOS_PRODUCTO: ['Activo', 'Inactivo', 'Descontinuado'],
  ROLES: ['admin', 'vendedor'],
  
  // ═══════════════════════════════════════════════════════════════
  // CONFIGURACIÓN DEL SISTEMA
  // ═══════════════════════════════════════════════════════════════
  STOCK_MINIMO_ALERTA: 5,
  MAX_PRODUCTOS_VISTA: 50,
  MAX_DESTACADOS: 8,
  AUTO_REFRESH_INTERVAL: 30000
};

// ═══════════════════════════════════════════════════════════════
// UTILIDADES GENERALES
// ═══════════════════════════════════════════════════════════════
const Utils = {
  formatearPrecio(precio) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', minimumFractionDigits: 0
    }).format(precio);
  },
  
  formatearFecha(fecha, incluirHora = false) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    if (incluirHora) { options.hour = '2-digit'; options.minute = '2-digit'; }
    return new Date(fecha).toLocaleDateString('es-CO', options);
  },
  
  generarId(prefijo = 'ID') {
    return `${prefijo}${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
  }
};

window.CONFIG = CONFIG;
window.Utils = Utils;

console.log('✅ Moteros Sports Line - Config cargado');