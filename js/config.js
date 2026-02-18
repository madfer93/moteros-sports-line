// ═══════════════════════════════════════════════════════════════
// MOTEROS SPORTS LINE - CONFIGURACIÓN GLOBAL
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  // ═══════════════════════════════════════════════════════════════
  // CREDENCIALES SUPABASE
  // ═══════════════════════════════════════════════════════════════
  SUPABASE_URL: (typeof process !== 'undefined' && process.env?.SUPABASE_URL) || 'https://pbblthbrdkevuyjxyuar.supabase.co',
  SUPABASE_KEY: (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiYmx0aGJyZGtldnV5anh5dWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNjUwMzcsImV4cCI6MjA4MTc0MTAzN30.bNAcp186l7l9IRWdcwBxuSgvmRtRy-qPFhZ7HRvaBZE',

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
  AUTO_REFRESH_INTERVAL: 30000,

  // ═══════════════════════════════════════════════════════════════
  // CONFIGURACIÓN INTELIGENCIA ARTIFICIAL (GROQ)
  // ═══════════════════════════════════════════════════════════════
  AI_KEYS: {
    INDEX: (typeof process !== 'undefined' && process.env?.GROQ_API_KEY_INDEX) || '',
    TIENDA: (typeof process !== 'undefined' && process.env?.GROQ_API_KEY_TIENDA) || '',
    ADMIN: (typeof process !== 'undefined' && process.env?.GROQ_API_KEY_ADMIN) || '',
    POS: (typeof process !== 'undefined' && process.env?.GROQ_API_KEY_POS) || '',
    CATALOGO: (typeof process !== 'undefined' && process.env?.GROQ_API_KEY_INDEX) || ''
  },
  AI_MODEL: (typeof process !== 'undefined' && process.env?.AI_MODEL) || 'llama-3.3-70b-versatile',
  VERSION: '2026-02-18-17-15'
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

// Inicialización Global de Supabase
if (typeof supabase !== 'undefined') {
  const { createClient } = supabase;
  window.supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
}

async function registrarLogSistema(tipo, mensaje, contexto = '') {
  if (!window.supabaseClient) return;
  try {
    await window.supabaseClient
      .from('logs_sistema')
      .insert({
        tipo: tipo,
        mensaje: mensaje,
        contexto: contexto,
        created_at: new Date().toISOString()
      });
  } catch (e) { }
}
window.registrarLogSistema = registrarLogSistema;

/**
 * Sincroniza el branding (logo, nombre, horarios) en toda la página
 * Basado en la tabla configuracion_sistema de Supabase
 */
async function sincronizarBrandingGlobal() {
  if (!window.supabaseClient) return;

  try {
    const { data, error } = await window.supabaseClient
      .from('configuracion_sistema')
      .select('*');

    if (error) throw error;

    const config = (data || []).reduce((acc, item) => {
      acc[item.clave] = item.valor;
      return acc;
    }, {});

    // 1. Actualizar Logo
    if (config.logo_url) {
      const logos = document.querySelectorAll('#siteLogo, .main-logo img, .logo-img');
      logos.forEach(img => img.src = config.logo_url);
    }

    // 2. Actualizar Nombre de la Tienda
    if (config.nombre_tienda) {
      const titles = document.querySelectorAll('#siteTitle, .shop-name, .footer-brand h3');
      titles.forEach(el => el.textContent = config.nombre_tienda);

      // Actualizar título de pestaña si es página principal
      if (document.title.includes('Moteros') || document.title.includes('Sports Line')) {
        const currentSuffix = document.title.split('|')[1] || '';
        document.title = config.nombre_tienda + (currentSuffix ? ' | ' + currentSuffix : '');
      }
    }

    // 3. Actualizar WhatsApp Global
    if (config.whatsapp_numero) {
      CONFIG.WHATSAPP.numero = config.whatsapp_numero;
    }

    // 4. Actualizar Horarios (Sincronización extendida para Index y Contacto)
    const selectorHorarios = {
      'horario_alcala': '#horarioAlcala, .horario-alcala, #horarioDetalleAlcala',
      'horario_local01': '#horarioLocal01, .horario-local01, #horarioDetalleLocal01',
      'horario_jordan': '#horarioJordan, .horario-jordan, #horarioDetalleJordan'
    };

    Object.entries(selectorHorarios).forEach(([clave, selector]) => {
      if (config[clave]) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          // Si el elemento contiene un <br> (idDetalle), intentamos mantener el formato si es posible
          // o simplemente inyectamos el texto del admin que ya puede venir formateado
          if (el.id.includes('Detalle')) {
            el.innerHTML = config[clave].replace(/\n/g, '<br>');
          } else {
            el.textContent = config[clave];
          }
        });
      }
    });

    // 5. Actualizar AI Keys si existen en BD
    if (config.ai_key_index) CONFIG.AI_KEYS.INDEX = config.ai_key_index;
    if (config.ai_key_tienda) CONFIG.AI_KEYS.TIENDA = config.ai_key_tienda;
    if (config.ai_key_admin) CONFIG.AI_KEYS.ADMIN = config.ai_key_admin;
    if (config.ai_key_pos) CONFIG.AI_KEYS.POS = config.ai_key_pos;

  } catch (err) {
    if (window.registrarLogSistema) window.registrarLogSistema('error_sistema', 'Error sincronizando branding global', err.message);
  }
}
window.sincronizarBrandingGlobal = sincronizarBrandingGlobal;
