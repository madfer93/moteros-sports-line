# 🏍️ Moteros Sports Line - Platform v2.5

Plataforma integral de gestión de e-commerce y atención al cliente impulsada por IA, específicamente diseñada para el sector de motociclismo.

[![Seguridad](https://img.shields.io/badge/Seguridad-RLS%20Habilitado-success)](https://github.com/madfer93/moteros-sports-line)
[![Build](https://img.shields.io/badge/Build-Webpack-blue)](https://webpack.js.org/)
[![License](https://img.shields.io/badge/License-Privado-red)](https://github.com/madfer93/moteros-sports-line)

---

## 🚀 Funcionalidades Principales

### 🧠 Cerebro IA (Groq + Supabase)
- **Asistente Virtual Inteligente**: Powered by Groq LLaMA 3.3 70B
- **Captura Inteligente de Leads**: Extracción automática de nombres e intereses
- **Contexto Persistente**: Memoria de conversaciones en Supabase
- **Multi-Contexto**: 4 API keys diferentes (Index, Admin, Tienda, POS)

### 🛒 E-Commerce Completo
- **Catálogo Dinámico**: Productos con variantes, imágenes y stock en tiempo real
- **Carrito de Compras**: Integración con WhatsApp para pedidos
- **Sistema de Reseñas**: Calificaciones y comentarios de productos
- **Promociones Automáticas**: Descuentos y ofertas especiales

### 📊 Panel de Administración
- **Dashboard Analítico**: Métricas de ventas, inventario y rendimiento
- **Gestión de Inventario**: Control multi-local (Alcalá, 01, Jordán, Digital)
- **POS Multi-Tienda**: Sistema de punto de venta para cada local
- **Reportes Avanzados**: Exportación a Excel y PDF
- **Gestión de Empleados**: Nómina, ausencias y sesiones
- **Control de Créditos**: Seguimiento de deudores y pagos

### 🛡️ Seguridad Avanzada
- **Variables de Entorno**: API keys protegidas con `.env`
- **Row Level Security**: 67 tablas de Supabase con RLS habilitado
- **Protección Anti-Inspección**: DevTools, clic derecho y atajos bloqueados
- **Blindaje de Código**: Sistema de prevención de depuración en tiempo real
- **Build Seguro**: Webpack con minificación y ofuscación

---

## 🔐 Configuración de Seguridad

### 1. Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto (usa `.env.example` como plantilla):

```env
# SUPABASE
SUPABASE_URL=tu_url_de_supabase
SUPABASE_ANON_KEY=tu_anon_key

# GROQ API KEYS
GROQ_API_KEY_INDEX=gsk_tu_key_index
GROQ_API_KEY_ADMIN=gsk_tu_key_admin
GROQ_API_KEY_TIENDA=gsk_tu_key_tienda
GROQ_API_KEY_POS=gsk_tu_key_pos

# AI MODEL
AI_MODEL=llama-3.1-8b-instant
```

⚠️ **IMPORTANTE:** El archivo `.env` NUNCA debe subirse a Git. Ya está en `.gitignore`.

### 2. Supabase RLS

Aplica las políticas de seguridad ejecutando el script SQL:

```sql
-- En Supabase Dashboard → SQL Editor
-- Ejecuta: security/supabase_rls_policies.sql
```

Esto protegerá las 67 tablas con Row Level Security.

### 3. Instalación de Dependencias

```bash
npm install
```

---

## 🛠️ Comandos de Desarrollo

### Desarrollo Local
```bash
npm run dev
```
Inicia servidor de desarrollo en `http://localhost:8080` con hot reload.

### Build de Producción
```bash
npm run build
```
Genera archivos optimizados en `dist/` con:
- Minificación y ofuscación de código
- Inyección de variables de entorno
- Eliminación de console.log

---

## 📁 Estructura del Proyecto

```
moteros-sports-line/
├── index.html                  # Landing page y Asistente IA
├── admin.html                  # Panel de administración central
├── catalogo.html               # Catálogo de productos premium
├── blog.html                   # Blog de noticias y artículos
├── nosotros.html               # Información institucional
├── contacto.html               # Formulario de contacto
├── recovery.html               # Recuperación de contraseña
├── tienda-*.html               # Landing pages por local
│
├── css/                        # Estilos
│   ├── styles.css              # Estilos globales
│   ├── admin.css               # Estilos del panel admin
│   ├── pos.css                 # Estilos del POS
│   └── ...
│
├── js/                         # JavaScript
│   ├── config.js               # Configuración (usa process.env)
│   ├── admin.js                # Lógica del panel admin
│   ├── pos.js                  # Lógica del POS
│   ├── ia-core.js              # Motor de IA (Groq)
│   ├── security.js             # Protección de código
│   └── ...
│
├── security/                   # Scripts de seguridad
│   ├── supabase_rls_audit.sql  # Auditoría de RLS
│   └── supabase_rls_policies.sql # Políticas RLS
│
├── .env                        # Variables de entorno (NO en Git)
├── .env.example                # Plantilla de variables
├── .gitignore                  # Archivos ignorados por Git
├── package.json                # Dependencias npm
├── webpack.config.js           # Configuración de Webpack
├── SECURITY_SETUP.md           # Guía de configuración de seguridad
└── README.md                   # Este archivo
```

---

## 🗄️ Base de Datos (Supabase)

### Tablas Principales

**Productos y Catálogo:**
- `productos` - Catálogo de productos
- `categorias` - Categorías de productos
- `producto_resenas` - Reseñas y calificaciones

**Inventario (Multi-Local):**
- `inventario_alcala`, `inventario_01`, `inventario_jordan`
- `inventario_digital`, `inventario_evento`, `inventario_bodega`

**Ventas y Finanzas:**
- `ventas`, `facturas`, `factura_items`, `factura_pagos`
- `cierres_caja`, `metodos_pago`

**Compras:**
- `compras`, `compra_items`, `proveedores`
- `pagos_proveedor`, `alertas_compras`

**Créditos y Deudas:**
- `creditos_motero`, `clientes_credito`, `pagos_credito`
- `deudores`, `pagos_deudor`, `deudas_negocio`

**Empleados:**
- `empleados_tienda`, `sesiones_empleados`
- `nomina_pagos`, `adelantos_nomina`, `empleado_ausencias`

**Marketing:**
- `leads_ia` - Leads capturados por la IA
- `posts` - Blog posts
- `blog_comentarios` - Comentarios del blog
- `promociones` - Promociones activas

**Configuración:**
- `configuracion_sistema` - Configuración global
- `locales` - Información de locales
- `metas_locales`, `metas_proveedores` - Metas de ventas

🔒 **Todas las tablas están protegidas con Row Level Security (RLS)**

---

## 🔧 Tecnologías Utilizadas

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **IA:** Groq API (LLaMA 3.3 70B Versatile)
- **Build:** Webpack 5
- **Seguridad:** RLS, Environment Variables, Code Obfuscation
- **PWA:** Manifest.json, Service Worker ready

---

## 📱 PWA (Progressive Web App)

La aplicación está lista para instalarse como PWA:
- Manifest configurado
- Íconos optimizados
- Offline-ready (próximamente)

---

## 🚀 Deployment

### GitHub Pages
```bash
npm run build
# Subir contenido de dist/ a GitHub Pages
```

### Servidor Propio
1. Configurar variables de entorno en el servidor
2. Ejecutar `npm run build`
3. Servir archivos desde la raíz del proyecto

---

## 🔒 Seguridad - Checklist

- [x] API keys en variables de entorno
- [x] `.env` en `.gitignore`
- [x] RLS habilitado en 67 tablas de Supabase
- [x] Políticas RLS aplicadas
- [x] `security.js` en todas las páginas
- [x] Webpack con minificación y ofuscación
- [x] Console.log eliminados en producción

---

## 📞 Contacto & Desarrollo

**Agencia:** [J&M Tech Solutions](https://www.jymtechsolutions.online/es)  
**Líder Técnico:** Manuel Fernando Madrid (CEO & Consultor de IA B2B)  
**Web:** [jymtechsolutions.online](https://www.jymtechsolutions.online/es)  
**Email:** admin@jymtechsolutions.online  
**WhatsApp:** [+57 304 578 8873](https://wa.me/573045788873)  

---

## 📄 Licencia & Autoría

© 2026 Moteros Sports Line - Todos los derechos reservados | Desarrollado por [J&M Tech Solutions](https://www.jymtechsolutions.online/es)

Proyecto privado desarrollado para uso exclusivo de Moteros Sports Line.

---

## 🆕 Changelog

### v2.6 (Agosto 2026) - SEO Enterprise, IA Edge & Estandarización de Marca
- ✅ **Schema SEO Multi-Entidad (`@graph`)**: Grafo estructurado empresarial con `Store`, `AutoPartsStore`, `LocalBusiness` multi-sede (Alcalá, 01, Jordán), `Organization` (J&M Tech Solutions), `WebSite` con `SearchAction`, `SoftwareApplication` (Moteros IA) y `FAQPage` para Rich Snippets en Google.
- ✅ **Estandarización de Backlinks & Autoría**: Footer y Schemas JSON-LD unificados en las 9 páginas del sitio enlazando a `https://www.jymtechsolutions.online/es`.
- ✅ **Indexación para Modelos de Lenguaje (`llms.txt`)**: Creación de archivo de indexación según estándar `llmstxt.org` para crawlers de IA (ChatGPT, Perplexity, Gemini, Claude).
- ✅ **Optimización de IA Conversacional (Moteros IA)**:
  - Enrutamiento 100% serverless mediante Edge Function `groq-chat` de Supabase para blindaje de API keys.
  - Depuración de payload de catálogo a 40 ítems para evitar errores de token (`request_too_large`).
  - Forzado estricto de idioma español y filtro de *chain-of-thought* para eliminar razonamiento interno en inglés.
  - Respuestas estáticas instantáneas para botones rápidos (Cascos → Catálogo, Sedes → Contacto, Financiación/Envíos → WhatsApp con mensaje contextual).
- ✅ **UI Móvil Responsiva**: Pastillas visuales para selección y guía de tallas de cascos en pantallas pequeñas y reseteo automático del formulario de leads.

### v2.5 (Enero 2025)
- ✅ Sistema de seguridad completo con variables de entorno
- ✅ RLS habilitado en todas las tablas de Supabase
- ✅ Webpack configurado para build de producción
- ✅ Protección de código en todas las páginas
- ✅ Documentación de seguridad completa

### v2.1 (Anterior)
- Asistente IA con Groq
- Panel de administración completo
- Sistema POS multi-tienda
- Gestión de inventario multi-local
