# 📜 POLÍTICA DE USO ÉTICO, SEGURO Y RESPONSABLE DE INTELIGENCIA ARTIFICIAL
## Sistema de Gestión de Inteligencia Artificial (SGIA) — ISO/IEC 42001:2023 & Lineamientos ICONTEC

**Organización:** Moteros Sport Line (Villavicencio, Meta, Colombia)  
**Desarrollador y Consultor de IA:** J&M Tech Solutions (CEO: Manuel Madrid)  
**Versión del Documento:** 1.0  
**Fecha de Emisión:** Agosto 2026  
**Ámbito de Aplicación:** Agente Inteligente *Moteros IA*, E-Commerce, Puntos de Venta (POS) y Canales de Automatización Comercial.

---

## 1. Declaración de Política y Compromiso Institucional (Cláusula 5 ISO/IEC 42001)

**Moteros Sport Line** y su aliado tecnológico **J&M Tech Solutions** se comprometen formalmente a diseñar, desplegar y operar sistemas de Inteligencia Artificial guiados por los más altos estándares de:

* 🔒 **Seguridad y Robustez Técnica**
* 👁️ **Transparencia y Explicabilidad**
* 👤 **Supervisión Humana Permanente (*Human-in-the-Loop*)**
* ⚖️ **Equidad, No Discriminación e Inclusión**
* 🛡️ **Privacidad, Protección de Datos Personales y Habeas Data**
* 📈 **Mejora Continua y Cumplimiento Normativo (ICONTEC & ISO/IEC 42001)**

---

## 2. Alcance y Contexto del Sistema de IA (Cláusula 4 ISO/IEC 42001)

El presente marco de gobernanza aplica directamente al motor conversacional **Moteros IA**, integrado en:
1. **Tienda Virtual Oficial ([moterossportline.store](https://moterossportline.store)):** Asesoría en cascos certificados (ECE 22.06 / DOT), accesorios, indumentaria, tallas, compatibilidad y financiamiento con Addi y Sistecrédito.
2. **Sistema de Captura y Consolidación de Leads:** Gestión de solicitudes comerciales canalizadas a las sedes físicas (Alcalá, Local 01 y Jordán) y al bot interactivo de Telegram.
3. **Plataforma de Consulta Administrativa:** Soporte interno de consulta de catálogo e inventario para el equipo de ventas.

---

## 3. Principios Rectores y Controles Operativos

### 3.1. Transparencia y Explicabilidad (Cláusula 6 y 8)
* **Identificación No Engañosa:** Todo usuario que interactúe con el asistente es informado de manera visible y clara de que está dialogando con un sistema de IA.
* **Trazabilidad:** La IA no oculta sus propósitos comerciales y ofrece respuestas basadas estrictamente en la base de conocimiento y catálogo real de Moteros Sport Line.

### 3.2. Supervisión Humana (*Human-in-the-Loop*) (Cláusula 8)
* **Cero Decisiones Autónomas Críticas:** La IA no ejecuta cobros automáticos, no aprueba créditos de forma unilateral ni modifica precios de facturación.
* **Traspaso Fluido al Asesor Humano:** Toda cotización en firme, apartado de producto o verificación de crédito es derivada a los asesores comerciales humanos de las sedes de Villavicencio a través de WhatsApp oficial (+57 311 340 8416).

### 3.3. Privacidad y Minimización de Datos (Ley 1581 de 2012 & ISO 42001)
* **Principio de Necesidad:** La IA únicamente solicita el Nombre y Número de WhatsApp estrictamente requeridos para conectar al cliente con un asesor humano.
* **Prohibición de Datos Sensibles:** La IA tiene vetada la solicitud o procesamiento de datos financieros sensibles (números de tarjeta, claves bancarias o datos biométricos).
* **Consentimiento Informado:** Toda recolección cuenta con el aviso y autorización previa de la Política de Habeas Data institucional.

### 3.4. Seguridad, Robustez y Mitigación de Riesgos (Cláusula 9 y 10)
* **Filtros Anti-Jailbreak y Anti-Prompt Injection:** Blindaje activo contra comandos que intenten extraer instrucciones internas, claves API o desviar el propósito comercial de la IA.
* **Rate Limiting Multicapa:** Control de frecuencia con cooldown de 1.5 segundos, límite de 8 mensajes por minuto y cuota diaria de 40 interacciones para prevenir ataques de denegación de servicio (DoS) y abusos de bots.
* **Arquitectura Serverless Segura:** Cero credenciales expuestas en frontend; todas las peticiones a modelos de lenguaje (LLM) operan mediante Edge Functions con cifrado TLS/HTTPS.

---

## 4. Matriz de Evaluación de Riesgos e Impactos de IA (AIMS Risk Assessment)

| Riesgo Identificado | Nivel de Riesgo Inicial | Control Mitigante Implementado (ISO 42001) | Nivel Residual |
| :--- | :---: | :--- | :---: |
| **Alucinación de precios o inventario inexistente** | Alto | Inyección de catálogo en tiempo real con regla estricta de abstención ante productos no listados. | **Bajo** |
| **Ataques de inyección de prompts / Extracción de claves** | Alto | Filtro de palabras prohibidas, suspensión tras 2 intentos y Edge Functions aisladas. | **Muy Bajo** |
| **Spam o saturación de costos de API por bots** | Medio | Rate Limiting por IP/navegador con cuota diaria y cooldown. | **Muy Bajo** |
| **Captura no autorizada de datos personales** | Medio | Protocolo explícito de Habeas Data con consentimiento informado. | **Bajo** |
| **Pérdida de toque humano en la atención** | Medio | Saludo cálido motero y derivación inmediata a WhatsApp con asesores locales. | **Bajo** |

---

## 5. Roles y Responsabilidades de Gobernanza

* **Dirección General (Moteros Sport Line):** Define los objetivos comerciales, aprueba las políticas institucionales y garantiza la atención humana oportuna de los leads generados.
* **Líder Técnico & Consultor de IA (J&M Tech Solutions - Manuel Madrid):**
  * Mantenimiento, calibración y alineación de los prompts del sistema.
  * Monitoreo de latencia, seguridad perimetral y mitigación de vulnerabilidades.
  * Auditoría periódica de calidad de respuestas y cumplimiento normativo ISO/IEC 42001 e ICONTEC.
* **Asesores de Ventas:** Recepción ética y oportuna de los clientes derivados por la IA, garantizando un servicio profesional en las sedes de Villavicencio.

---

## 6. Auditoría, Evaluación del Desempeño y Mejora Continua (Cláusula 9 & 10)

1. **Revisión Trimestral del SGIA:** Inspección de registros de conversación, tasa de conversión y retroalimentación de clientes.
2. **Actualización de Modelos:** Adopción de arquitecturas LLM más eficientes, seguras y de menor consumo energético conforme avancen los estándares de la industria.
3. **Mecanismo de Corrección Rápida:** Canal directo de reporte de inconsistencias o mejoras técnicas con respuesta en menos de 24 horas hábiles.

---

## 7. Marco Legal y Referencias Normativas

* **ISO/IEC 42001:2023:** *Information technology — Artificial intelligence — Management system*.
* **ICONTEC:** Guías técnicas para la adopción y gestión responsable de Inteligencia Artificial en Colombia.
* **CONPES 3975 de 2019:** Política Nacional para la Transformación Digital e Inteligencia Artificial (Colombia).
* **Ley Estatutaria 1581 de 2012:** Régimen General de Protección de Datos Personales (Colombia).
* **Ley 1480 de 2011:** Estatuto del Consumidor (Comercio Electrónico y Protección al Usuario).

---

## 8. Canales de Contacto y Atención de Consultas

Para inquietudes, sugerencias o ejercicio de derechos relacionados con el sistema de Inteligencia Artificial:

* 🏢 **Moteros Sport Line:** Villavicencio, Meta, Colombia.
* 📱 **WhatsApp Oficial:** [+57 311 340 8416](https://wa.me/573113408416)
* ✉️ **Correo Electrónico:** [moterossportline@gmail.com](mailto:moterossportline@gmail.com)
* 💻 **Desarrollo Tecnológico:** [J&M Tech Solutions](https://www.jymtechsolutions.online/es) — [admin@jymtechsolutions.online](mailto:admin@jymtechsolutions.online)

---
*Documento aprobado y publicado como estándar oficial de Gobernanza de Inteligencia Artificial para Moteros Sport Line.*
