# Moteros Sports Line - Reglas del Proyecto

## REGLA CRÍTICA: CERO MODALES

**NUNCA uses modales (popup dialogs) para funcionalidades importantes del POS o Admin.**

Cuando el usuario pide una funcionalidad nueva o cambio de UI:
- Si actualmente es un modal → convertirlo a **sección/página completa** o **panel expandible** en el mismo flujo
- El contenido debe ocupar el espacio principal de la pantalla
- Usar paneles que se muestran/ocultan con CSS (`display: block/none`) dentro del flujo principal
- Los botones del header del POS deben abrir **vistas/paneles de pantalla completa**, no modales flotantes
- Solo se permiten modales para confirmaciones simples de una línea (confirm()) que no tengan UI compleja

**Ejemplos de lo que NO se debe hacer:**
- Modal de Traslados con un select pequeño → PROHIBIDO
- Modal de Devoluciones → PROHIBIDO  
- Modal de Servicios → PROHIBIDO
- Modal de Deudores → PROHIBIDO

**Lo que SÍ se debe hacer:**
- Panel/sección que ocupa todo el área de contenido (`width: 100%; height: calc(100vh - header)`)
- El usuario puede ver todo sin scroll excesivo
- Diseño espacioso con filtros visibles, listas amplias y formularios cómodos
