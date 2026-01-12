/**
 * 🧠 Moteros AI Core - Cerebro de Inteligencia Artificial
 * Maneja la comunicación con Groq y el "Silent Learning" (Aprendizaje Silencioso)
 */

class MoterosIA {
    constructor(contexto = 'INDEX') {
        this.contexto = contexto; // INDEX, TIENDA, ADMIN, POS
        this.historial = [];
        this.eventos = []; // Silent Learning log
        this.apiKey = this.obtenerKey();
        this.userName = localStorage.getItem('ai_user_name') || '';
        this.systemPromptBase = this.generarSystemPromptBase();
        this.ultimoWhatsAppGuardado = null; // Control de duplicados por sesión

        this.cargarHistorial();
    }

    obtenerKey() {
        if (!window.CONFIG || !window.CONFIG.AI_KEYS) {
            console.warn('⚠️ Configuración de AI no encontrada');
            return '';
        }
        return window.CONFIG.AI_KEYS[this.contexto] || '';
    }

    generarSystemPromptBase() {
        const base = `Eres el Asistente Inteligente de "Moteros Sports Line" (Villavicencio, Colombia).
Tu tono es experto en motos, amable y profesional.
USUARIO ACTUAL: ${this.userName || 'Desconocido'}.

ESTRATEGIA DE VENTAS (Silent Sales):
- Si no conoces el nombre del usuario, gánatelo amablemente.
- Si el usuario muestra interés real en un producto o servicio, debes pedirle disimuladamente su WhatsApp para "enviarle más fotos, el catálogo o agendarle una cita".
- Una vez obtengas el WhatsApp, confirma: "¡Listo! Ya guardé tu contacto, en breve un asesor te ayudará".
- Tu objetivo secreto es convertir visitantes en LEADS.

CONTEXTO ACTUAL: ${this.contexto}
`;

        const personalidades = {
            'INDEX': 'Ayudas a navegar el sitio y capturas leads interesados en la marca.',
            'TIENDA': 'Vendedor experto. Recomiendas productos y capturas leads para cerrar ventas por WhatsApp.',
            'ADMIN': 'Analista de negocios con memoria infinita para tu equipo.',
            'POS': 'Asistente de ventas en mostrador con memoria infinita para tu equipo.'
        };

        return base + (personalidades[this.contexto] || '') + '\n\n';
    }

    cargarHistorial() {
        const key = `ai_history_${this.contexto}`;
        const saved = localStorage.getItem(key);
        if (!saved) return;

        try {
            const { history, lastUpdate } = JSON.parse(saved);

            // Lógica de Persistencia Diferenciada
            if (this.contexto === 'INDEX' || this.contexto === 'TIENDA') {
                const ahora = Date.now();
                const quinceMin = 15 * 60 * 1000;
                if (ahora - lastUpdate > quinceMin) {
                    console.log('🕒 Historial de IA expirado (15 min).');
                    this.limpiarHistorial();
                    return;
                }
            }

            this.historial = history || [];
            console.log(`🧠 Historial recuperado (${this.contexto}):`, this.historial.length);
        } catch (e) {
            console.error('Error cargando historial:', e);
        }
    }

    guardarHistorial() {
        const key = `ai_history_${this.contexto}`;
        const data = {
            history: this.historial,
            lastUpdate: Date.now()
        };
        localStorage.setItem(key, JSON.stringify(data));
    }

    async enriquecerLead() {
        if (!this.apiKey || this.historial.length === 0) return { interes: 'Media', necesidad: 'Interés general' };

        try {
            const promptAnalisis = `Analiza el siguiente historial de chat de un cliente de nuestra tienda de motos "Moteros Sports Line" y devuelve UNICAMENTE un objeto JSON con el siguiente formato:
{
  "interes": "Alta" | "Media" | "Baja",
  "necesidad": "Resumen muy breve de lo que busca el cliente (max 10 palabras)",
  "nombre_cliente": "Extraer el nombre real si el usuario lo mencionó, si no, devolver null"
}

REGLAS DE CATEGORIZACIÓN:
- Alta: El usuario dio su WhatsApp, preguntó por precios específicos o combos, o mostró intención clara de compra inmediata.
- Media: El usuario pregunta por productos o marcas pero no ha pedido precios o mostrado urgencia.
- Baja: Solo saludos o preguntas muy generales sin interés en un producto específico.

HISTORIAL:
${JSON.stringify(this.historial)}`;

            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    messages: [{ role: "system", content: "Eres un analista de ventas experto. Devuelves solo JSON puro." }, { role: "user", content: promptAnalisis }],
                    model: "llama-3.1-8b-instant", // Modelo ultra-rápido y estable para JSON
                    temperature: 0.1,
                    response_format: { type: "json_object" }
                })
            });

            const data = await response.json();

            if (data.error) {
                console.warn('⚠️ Groq API Error:', data.error.message);
                return { interes: 'Media', necesidad: 'Interés detectado (Análisis falló)' };
            }

            const content = data.choices?.[0]?.message?.content || '{"interes": "Media", "necesidad": "Interés general"}';
            const analisis = JSON.parse(content);
            return analisis;

        } catch (e) {
            console.error('Error enriqueciendo lead:', e);
            return { interes: 'Media', necesidad: 'Error en análisis' };
        }
    }

    async guardarLead(whatsapp) {
        if (!window.supabaseClient) {
            console.error('❌ Error: Supabase no está inicializado.');
            return;
        }

        // CONTROL DE DUPLICADOS:
        // 1. Si es el mismo número que ya guardamos, ignorar.
        if (this.ultimoWhatsAppGuardado === whatsapp) {
            console.log('⏭️ Lead ya guardado en esta sesión, ignorando duplicado.');
            return;
        }
        // 2. Si ya guardamos un número real y ahora viene un "Manual", ignorar.
        if (this.ultimoWhatsAppGuardado && this.ultimoWhatsAppGuardado !== 'Manual' && whatsapp === 'Manual') {
            console.log('⏭️ Ya tenemos un número real, ignorando petición manual.');
            return;
        }

        console.log('📦 Iniciando guardado de lead para:', whatsapp);

        try {
            // Enriquecer el lead antes de guardar (Análisis de IA)
            const enrichment = await this.enriquecerLead();
            const { interes, necesidad, nombre_cliente } = enrichment;

            const payload = {
                nombre: nombre_cliente || this.userName || 'Cliente Web',
                whatsapp: whatsapp,
                fragmento_interes: necesidad,
                contexto: this.contexto,
                historial_asociado: this.historial, // Se enviará como objeto/array para JSONB
                estado: 'Nuevo'
            };

            // Inserción en Supabase
            // Intentar con nivel_interes primero
            let res = await window.supabaseClient
                .from('leads_ia')
                .insert([{ ...payload, nivel_interes: interes }]);

            let error = res.error;

            // Si falla por columna inexistente o cualquier otro error, intentar el plan B (mínimo viable)
            if (error) {
                console.warn('⚠️ Intento 1 falló:', error.message);

                // Plan B: Solo columnas base y convertir historial a string por si la columna es TEXT
                const payloadB = {
                    nombre: payload.nombre,
                    whatsapp: payload.whatsapp,
                    fragmento_interes: payload.fragmento_interes, // Revertir a la necesidad detectada
                    contexto: payload.contexto,
                    historial_asociado: JSON.stringify(payload.historial_asociado)
                };

                console.log('🔄 Reintentando con configuración mínima (Plan B)...');
                const resB = await window.supabaseClient.from('leads_ia').insert([payloadB]);
                error = resB.error;
            }

            if (error) {
                console.error('❌ Error final al guardar en Supabase:', error);
                throw error;
            }

            this.ultimoWhatsAppGuardado = whatsapp; // Marcar como guardado con éxito
            console.log(`✅ Lead persistido con éxito en Supabase: ${interes} - ${necesidad}`);
        } catch (e) {
            console.error('💥 Error crítico guardando lead:', e);
        }
    }

    aprenderEvento(descripcion, datos = null) {
        const timestamp = new Date().toLocaleTimeString();
        const eventoStr = `[${timestamp}] ${descripcion} ${datos ? JSON.stringify(datos) : ''}`;
        this.eventos.push(eventoStr);
        if (this.eventos.length > 20) this.eventos.shift();
    }

    async obtenerDatosTiempoReal() {
        let datosContexto = `FECHA/HORA: ${new Date().toLocaleString('es-CO')}\n`;
        if (this.eventos.length > 0) {
            datosContexto += "\nACTIVIDAD RECIENTE:\n" + this.eventos.join('\n') + "\n";
        }
        return datosContexto;
    }

    async enviarMensaje(mensajeUsuario) {
        if (!this.apiKey) return "⚠️ AI Key no configurada.";

        const datosTiempoReal = await this.obtenerDatosTiempoReal();

        // Detectar si el usuario da su nombre
        if (!this.userName && (mensajeUsuario.toLowerCase().includes('soy ') || mensajeUsuario.toLowerCase().includes('mi nombre es'))) {
            const match = mensajeUsuario.match(/(?:soy|nombre es)\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)/i);
            if (match && match[1]) {
                this.userName = match[1];
                localStorage.setItem('ai_user_name', this.userName);
                this.systemPromptBase = this.generarSystemPromptBase();
            }
        }

        const messages = [
            { role: "system", content: this.systemPromptBase + datosContextoExtra + datosTiempoReal },
            ...this.historial,
            { role: "user", content: mensajeUsuario }
        ];

        this.historial.push({ role: "user", content: mensajeUsuario });

        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    messages: messages,
                    model: window.CONFIG.AI_MODEL || "llama3-70b-8192",
                    temperature: 0.7
                })
            });

            const data = await response.json();
            const respuestaIA = data.choices[0]?.message?.content || "Lo siento, no pude procesar eso.";

            this.historial.push({ role: "assistant", content: respuestaIA });
            this.guardarHistorial();

            // Detectar si la IA capturó un WhatsApp (patrón simple 10 dígitos o indicación de wa)
            if (mensajeUsuario.match(/\d{7,15}/) || (respuestaIA.toLowerCase().includes('guardé tu contacto') || respuestaIA.toLowerCase().includes('un asesor te ayudará'))) {
                const whatsapp = mensajeUsuario.match(/\d{7,15}/)?.[0] || 'Ver en historial';
                this.guardarLead(whatsapp);
            }

            return respuestaIA;
        } catch (error) {
            return `❌ Error: ${error.message}`;
        }
    }

    limpiarHistorial() {
        this.historial = [];
        localStorage.removeItem(`ai_history_${this.contexto}`);
    }
}

let datosContextoExtra = "";
function actualizarContextoIA(datos) { datosContextoExtra = datos; }

window.MoterosIA = MoterosIA;
window.actualizarContextoIA = actualizarContextoIA;
