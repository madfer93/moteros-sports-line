/**
 * 🤖 Moteros AI Widget
 * Inyecta el botón flotante y la ventana de chat.
 * Se encarga de la UI y conecta con ia-core.js
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Determinar contexto
    const path = window.location.pathname;
    let context = 'INDEX';

    // 🚨 REGLA DE VISIBILIDAD: Index, Admin y Catálogo
    const isIndex = path === '/' || path.endsWith('/index.html') || path.endsWith('/moteros-sports-line/');
    const isAdmin = path.includes('admin');
    const isCatalog = path.includes('catalogo.html');

    if (!isIndex && !isAdmin && !isCatalog) return; // 🚫 No cargar en otras páginas

    if (isAdmin || document.title.includes('Admin')) context = 'ADMIN';
    else if (isCatalog) context = 'CATALOGO';
    else if (path.includes('tienda-digital')) context = 'TIENDA';
    else if (path.includes('tienda-')) context = 'POS';



    // 2. Cargar CSS dinámicamente (Desactivado: ahora inlineado en index.html)
    /* 
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    const prefix = (path.includes('/pos/') || path.includes('/admin/')) ? '../' : '';
    link.href = prefix + 'css/ai-widget.css';
    document.head.appendChild(link);
    */

    // 3. Crear HTML del Widget
    const adminContainer = document.getElementById('aiAdminChatContainer');
    const isInsideAdmin = context === 'ADMIN' && adminContainer;

    if (!isInsideAdmin) {
        const widgetContainer = document.createElement('div');
        widgetContainer.className = 'ai-fab-container';
        widgetContainer.innerHTML = `
            <div class="ai-fab-label">💡 Moteros IA</div>
            <button id="aiFabBtn" class="ai-fab-btn" title="Asistente IA">
                <img id="siteLogo" src="https://pbblthbrdkevuyjxyuar.supabase.co/storage/v1/object/public/productos-imagenes/moteros%20logo.jpg" 
                     alt="IA" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
            </button>
        `;
        document.body.appendChild(widgetContainer);
    }

    const chatWindow = document.createElement('div');
    chatWindow.id = 'aiChatWindow';
    chatWindow.className = isInsideAdmin ? 'ai-chat-window admin-box' : 'ai-chat-window hidden';
    chatWindow.innerHTML = `
        <div class="ai-header">
            <h4>
                <img id="siteLogo" src="https://pbblthbrdkevuyjxyuar.supabase.co/storage/v1/object/public/productos-imagenes/moteros%20logo.jpg" 
                     alt="Logo" class="ai-header-logo">
                <span class="ai-status-dot"></span> Moteros IA ${isInsideAdmin ? '(Modo Prueba)' : ''}
            </h4>
            ${!isInsideAdmin ? '<button id="aiCloseBtn" class="ai-close-btn">❌</button>' : ''}
        </div>
        <div id="aiMessages" class="ai-messages"></div>
        <div id="aiLeadCapture" class="ai-lead-capture hidden">
            <div class="ai-legal-banner">
                <input type="checkbox" id="aiHabeasCheck">
                <label for="aiHabeasCheck">Acepto la <a href="privacidad.html" target="_blank">política de tratamiento de datos</a></label>
            </div>
            <button id="aiSubmitLead" class="ai-submit-lead-btn" disabled>🚀 Enviar mis datos de contacto</button>
        </div>
        <div id="aiQuickReplies" class="ai-quick-replies">
            <button class="ai-chip-btn" data-query="🪖 ¿Qué cascos tienen disponibles en catálogo?">🪖 Cascos</button>
            <button class="ai-chip-btn" data-query="💳 ¿Cómo puedo financiar con Addi o Sistecrédito?">💳 Financiar con Addi</button>
            <button class="ai-chip-btn" data-query="📍 ¿Dónde quedan ubicadas las sedes y qué horarios tienen?">📍 Sedes y Horarios</button>
            <button class="ai-chip-btn" data-query="📐 ¿Cómo sé cuál es mi talla de casco?">📐 Guía de Tallas</button>
            <button class="ai-chip-btn" data-query="🚚 ¿Cómo funcionan los envíos a domicilio y nacionales?">🚚 Envíos</button>
        </div>
        <div class="ai-input-area">
            <input type="text" id="aiInput" class="ai-input" placeholder="Escribe tu consulta..." autocomplete="off">
            <button id="aiSendBtn" class="ai-send-btn">➤</button>
        </div>
    `;

    if (isInsideAdmin) {
        chatWindow.classList.remove('hidden');
        adminContainer.appendChild(chatWindow);
    } else {
        document.body.appendChild(chatWindow);
    }

    // 4. Inicializar Core y UI
    const messagesContainer = document.getElementById('aiMessages');

    if (window.MoterosIA) {
        window.moterosIA = new MoterosIA(context);

        // Renderizar historial si existe
        if (window.moterosIA.historial.length > 0) {
            messagesContainer.innerHTML = '<div class="ai-date-divider">Mensajes anteriores</div>';
            window.moterosIA.historial.forEach(msg => {
                appendMessage(msg.role === 'user' ? 'user' : 'assistant', formatResponse(msg.content));
            });
        } else {
            const saludo = window.moterosIA.userName
                ? `¡Hola de nuevo, ${window.moterosIA.userName}! 👋 ¿En qué más puedo ayudarte hoy?`
                : `¡Hola! Soy tu asistente virtual de Moteros Sport Line. 🏍️ ¿Con quién tengo el gusto de hablar?`;

            appendMessage('assistant', saludo);
        }
    } else {
        messagesContainer.innerHTML = '<div class="ai-msg ai-msg-assistant">⚠️ Error: IA no cargada.</div>';
    }

    // 5. Event Listeners
    const fabBtn = document.getElementById('aiFabBtn');
    const closeBtn = document.getElementById('aiCloseBtn');
    const input = document.getElementById('aiInput');
    const sendBtn = document.getElementById('aiSendBtn');
    const captchaContainer = document.getElementById('aiLeadCapture');
    const habeasCheck = document.getElementById('aiHabeasCheck');
    const submitLeadBtn = document.getElementById('aiSubmitLead');
    // messagesContainer ya está declarado arriba

    if (fabBtn) fabBtn.addEventListener('click', toggleChat);
    if (closeBtn) closeBtn.addEventListener('click', toggleChat);
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    habeasCheck.addEventListener('change', () => {
        submitLeadBtn.disabled = !habeasCheck.checked;
    });

    submitLeadBtn.addEventListener('click', async () => {
        if (!habeasCheck.checked) return;

        const lastUserMsg = window.moterosIA.historial.filter(m => m.role === 'user').pop()?.content || '';
        const whatsapp = lastUserMsg.match(/\d{7,15}/)?.[0] || 'Manual';

        submitLeadBtn.innerText = '⌛ Enviando...';
        submitLeadBtn.disabled = true;

        await window.moterosIA.guardarLead(whatsapp);

        submitLeadBtn.innerText = '✅ Datos Enviados';
        setTimeout(() => {
            captchaContainer.classList.add('hidden');
        }, 2000);
    });

    function toggleChat() {
        chatWindow.classList.toggle('hidden');
        const isOpen = !chatWindow.classList.contains('hidden');
        document.body.classList.toggle('ai-chat-open', isOpen);

        // Ocultar flotante de accesibilidad mientras el chat de IA esté abierto
        const a11yContainer = document.getElementById('a11y-widget-container');
        if (a11yContainer) {
            a11yContainer.style.display = isOpen ? 'none' : '';
        }

        if (isOpen) {
            input.focus();
            scrollToBottom();
        }
    }
    window.toggleChatIA = toggleChat;

    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        // Mostrar mensaje usuario
        appendMessage('user', text);
        input.value = '';

        // Mostrar typing
        showTyping();

        // Llamar a la IA
        try {
            const response = await window.moterosIA.enviarMensaje(text);
            hideTyping();
            appendMessage('assistant', formatResponse(response));

            // Si el mensaje del usuario tiene un número o la respuesta de la IA lo sugiere, mostrar banner
            if (text.match(/\d{7,15}/) || response.toLowerCase().includes('whatsapp') || response.toLowerCase().includes('contacto')) {
                captchaContainer.classList.remove('hidden');
            }
        } catch (error) {
            hideTyping();
            appendMessage('assistant', '❌ Error de comunicación.');
        }
    }

    function appendMessage(role, text) {
        const div = document.createElement('div');
        div.className = `ai-msg ai-msg-${role}`;
        div.innerHTML = text; // Se asume texto ya formateado si es assistant
        messagesContainer.appendChild(div);
        scrollToBottom();
    }

    function showTyping() {
        const div = document.createElement('div');
        div.id = 'aiTyping';
        div.className = 'ai-msg ai-msg-assistant';
        div.style.background = 'transparent';
        div.style.border = 'none';
        div.style.padding = '0';
        div.innerHTML = `
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        messagesContainer.appendChild(div);
        scrollToBottom();
    }

    function hideTyping() {
        const el = document.getElementById('aiTyping');
        if (el) el.remove();
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
    }

    // Respuestas estáticas para botones rápidos (sin llamar a la IA)
    const RESPUESTAS_ESTATICAS = {
        'cascos': `🪖 <strong>Cascos en Moteros Sport Line</strong><br><br>
Tenemos una gran variedad de cascos para todos los estilos y presupuestos. 🏍️<br><br>
🛍️ <a href="catalogo.html" target="_blank">Ver catálogo completo de cascos</a><br><br>
¿Tienes dudas sobre talla o modelo específico? Pregúntame aquí ⬇️`,

        'financiar': `💳 <strong>Opciones de Financiación</strong><br><br>
Manejamos alternativas de pago en cuotas para que te lleves tu equipo hoy. 🙌<br><br>
Una asesora te explicará las condiciones, requisitos y montos disponibles según tu caso.<br><br>
📲 <a href="https://wa.me/573144163601?text=Hola%21+Quiero+informaci%C3%B3n+sobre+las+opciones+de+financiaci%C3%B3n+disponibles" target="_blank">Contáctanos por WhatsApp</a> para que te asesoremos sin compromiso.`,

        'sedes': `📍 <strong>Nuestras Sedes — Villavicencio</strong><br><br>
Estamos en dos puntos de la ciudad, listos para atenderte. 🙌<br><br>
📞 <a href="contacto.html" target="_blank">Ver dirección, horarios y mapa</a>`,

        'tallas': `📐 <strong>¿Cómo saber tu talla de casco?</strong><br><br>
Mide el perímetro de tu cabeza con una cinta métrica a la altura de la frente (1 cm sobre las cejas).<br><br>
✅ Si no tienes cinta, usa una cuerda y mídela con una regla.<br><br>
Cuéntame tu medida y te ayudo a encontrar la talla correcta. O una asesora en tienda te lo mide en segundos 🎯`,

        'envios': `🚚 <strong>Envíos a Domicilio</strong><br><br>
Realizamos envíos dentro de Villavicencio y a nivel nacional. 📦<br><br>
Para conocer el costo exacto y el tiempo de entrega a tu ciudad, una asesora te confirma todos los detalles.<br><br>
📲 <a href="https://wa.me/573144163601?text=Hola%21+Quiero+cotizar+un+env%C3%ADo.+Mi+ciudad+es%3A+" target="_blank">Escríbenos al WhatsApp</a> con tu ciudad y te cotizamos.`
    };

    document.querySelectorAll('.ai-chip-btn').forEach(chip => {
        chip.addEventListener('click', () => {
            const query = chip.getAttribute('data-query') || '';
            const queryLower = query.toLowerCase();

            // Determinar respuesta estática según el botón
            let respuestaEstatica = null;
            if (queryLower.includes('casco')) respuestaEstatica = RESPUESTAS_ESTATICAS['cascos'];
            else if (queryLower.includes('financiar') || queryLower.includes('addi')) respuestaEstatica = RESPUESTAS_ESTATICAS['financiar'];
            else if (queryLower.includes('sede') || queryLower.includes('horario') || queryLower.includes('ubicad')) respuestaEstatica = RESPUESTAS_ESTATICAS['sedes'];
            else if (queryLower.includes('talla')) respuestaEstatica = RESPUESTAS_ESTATICAS['tallas'];
            else if (queryLower.includes('envio') || queryLower.includes('domicilio') || queryLower.includes('envío')) respuestaEstatica = RESPUESTAS_ESTATICAS['envios'];

            if (respuestaEstatica) {
                // Mostrar texto del botón como mensaje del usuario (sin enviarlo a la IA)
                const labelTexto = chip.textContent.trim();
                appendMessage('user', labelTexto);
                appendMessage('assistant', respuestaEstatica);
                scrollToBottom();
            } else {
                // Si no hay respuesta estática, usar la IA
                input.value = query;
                sendMessage();
            }
        });
    });

    function formatResponse(text) {
        if (!text) return '';

        // 1. Detectar productos formateados o menciones de catálogo para generar Tarjetas de Producto
        let cardsHtml = '';
        const lines = text.split('\n');
        const cleanLines = [];

        lines.forEach(line => {
            // Patrón de producto: - Nombre ($Precio) | Cat: ... | Stock ...
            const prodMatch = line.match(/^[-•*]\s*([^($]+)\s*\(\$([\d.,]+)\)\s*\|\s*Cat:\s*([^|]+)\|.*Stock Total:\s*(\d+)/i);
            if (prodMatch) {
                const nombre = prodMatch[1].trim();
                const precio = prodMatch[2].trim();
                const categoria = prodMatch[3].trim();
                const stock = parseInt(prodMatch[4]) || 0;
                const stockTxt = stock > 0 ? `🟢 Disponible (${stock} unds)` : `🔴 Agotado en bodega`;
                const msgWa = encodeURIComponent(`Hola Moteros Sport Line, me interesa consultar/comprar el producto: ${nombre} ($${precio})`);

                cardsHtml += `
                    <div class="ai-product-card">
                        <div class="ai-product-info">
                            <h5 class="ai-product-title">${nombre}</h5>
                            <span class="ai-product-price">$${precio} COP</span>
                            <span class="ai-product-badge">${stockTxt}</span>
                        </div>
                        <a href="https://wa.me/573113408416?text=${msgWa}" target="_blank" class="ai-product-btn">
                            💬 Comprar
                        </a>
                    </div>
                `;
            } else {
                cleanLines.push(line);
            }
        });

        const textToFormat = cleanLines.length > 0 ? cleanLines.join('\n') : text;

        // 2. Formateador Markdown
        let html = textToFormat
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" style="color: #ff6b00; font-weight: 600;">$1</a>')
            .replace(/\n/g, '<br>');

        // 3. Convertir números de WhatsApp aislados en botones interactivos de WhatsApp
        html = html.replace(/\+?57\s*3\d{2}\s*\d{3}\s*\d{4}|\b3\d{2}\s*\d{3}\s*\d{4}\b/g, (num) => {
            const cleanNum = num.replace(/\D/g, '');
            const fullNum = cleanNum.length === 10 ? `57${cleanNum}` : cleanNum;
            return `<a href="https://wa.me/${fullNum}" target="_blank" style="display: inline-flex; align-items: center; gap: 4px; background: #25d366; color: white; padding: 2px 8px; border-radius: 12px; text-decoration: none; font-size: 0.8rem; font-weight: 600;">💬 WhatsApp (${num.trim()})</a>`;
        });

        // 4. Adjuntar tarjetas de productos si se detectaron
        if (cardsHtml) {
            html += `<div style="margin-top: 10px;"><strong>🛍️ Productos sugeridos:</strong>${cardsHtml}</div>`;
        }

        return html;
    }
});
