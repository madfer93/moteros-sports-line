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
      telefono: '3113408416',
      direccion: 'Calle Nueva 1 #12-34',
      email: 'alcala@moterossl.com',
      horario: 'Lun-Sáb 9AM-7PM'
    },
    '01': {
      nombre: '01',
      telefono: '3113408416',
      direccion: 'Avenida Nueva 2 #56-78',
      email: '01@moterossl.com',
      horario: 'Lun-Sáb 8AM-6PM'
    },
    'Jordan': {
      nombre: 'Jordán',
      telefono: '3113408416',
      direccion: 'Carrera Nueva 3 #90-12',
      email: 'jordan@moterossl.com',
      horario: 'Lun-Dom 10AM-8PM'
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // TELEGRAM BOT LEADS NOTIFICACIONES
  // ═══════════════════════════════════════════════════════════════
  TELEGRAM_LEADS: {
    BOT_TOKEN: '8720299330:AAHV-sAB-ilICJhm1gRvI5VX0TYU3EgfbAk',
    CHAT_ID: '-1004339229259',
    BOT_USERNAME: 'MOTEROSS_bot',
    HABILITADO: true
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
  // CONFIGURACIÓN INTELIGENCIA ARTIFICIAL (GROQ / MULTI-MODELO)
  // ═══════════════════════════════════════════════════════════════
  AI_KEYS: {
    // Las llaves ya no se guardan en el frontend por seguridad.
    // Todas las peticiones de IA pasan por Supabase Edge Functions.
  },
  // Nota: llama-3.3-70b-versatile fue dado de baja el 16 de agosto de 2026 por Groq.
  AI_MODEL: (typeof process !== 'undefined' && process.env?.AI_MODEL) || 'groq/compound',
  AI_FALLBACK_MODEL: 'groq/compound-mini',
  AI_TEMPERATURE: 0.4,
  AI_MAX_HISTORY: 8,
  VERSION: '2026-08-25-13-00'
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
        nivel: tipo || 'INFO',
        mensaje: mensaje,
        origen: 'config.js',
        detalles: { contexto: contexto }
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

      // Actualizar título de pestaña respetando el SEO (sufijos)
      if (document.title.includes('Moteros') || document.title.includes('Sports Line')) {
        const parts = document.title.split(/[-|]/);
        if (parts.length > 1) {
            const currentSuffix = parts.slice(1).join('-').trim();
            document.title = config.nombre_tienda + ' - ' + currentSuffix;
        } else {
            document.title = config.nombre_tienda;
        }
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

    // 5. Las AI Keys ya no se cargan al cliente, se manejan en Edge Functions

  } catch (err) {
    if (window.registrarLogSistema) window.registrarLogSistema('error_sistema', 'Error sincronizando branding global', err.message);
  }
}
window.sincronizarBrandingGlobal = sincronizarBrandingGlobal;
