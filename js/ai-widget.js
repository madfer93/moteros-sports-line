/**
 * 🤖 Moteros AI Widget
 * Inyecta el botón flotante y la ventana de chat.
 * Se encarga de la UI y conecta con ia-core.js
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Determinar contexto
    const path = window.location.pathname;
    let context = 'INDEX';

    if (path.includes('admin') || document.title.includes('Admin')) context = 'ADMIN';
    else if (path.includes('tienda-digital')) context = 'TIENDA';
    else if (path.includes('tienda-')) context = 'POS';

    console.log('🤖 Inicializando AI Widget. Contexto:', context);

    // 2. Cargar CSS dinámicamente
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/ai-widget.css';
    document.head.appendChild(link);

    // 3. Crear HTML del Widget
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'ai-fab-container';
    widgetContainer.innerHTML = `
        <div class="ai-fab-label">💡 IA Asistida</div>
        <button id="aiFabBtn" class="ai-fab-btn" title="Asistente IA">
            <svg viewBox="0 0 24 24">
                <path d="M12,2A7,7 0 0,1 19,9C19,11.38 17.81,13.47 16,14.74V17A1,1 0 0,1 15,18H9A1,1 0 0,1 8,17V14.74C6.19,13.47 5,11.38 5,9A7,7 0 0,1 12,2M9,21V20H15V21A1,1 0 0,1 14,22H10A1,1 0 0,1 9,21M12,4A5,5 0 0,0 7,9C7,11.05 8.23,12.81 10,13.58V16H14V13.58C15.77,12.81 17,11.05 17,9A5,5 0 0,0 12,4Z" />
            </svg>
        </button>
    `;

    const chatWindow = document.createElement('div');
    chatWindow.id = 'aiChatWindow';
    chatWindow.className = 'ai-chat-window hidden';
    chatWindow.innerHTML = `
        <div class="ai-header">
            <h4><span class="ai-status-dot"></span> Moteros AI</h4>
            <button id="aiCloseBtn" class="ai-close-btn">×</button>
        </div>
        <div id="aiMessages" class="ai-messages"></div>
        <div id="aiLeadCapture" class="ai-lead-capture hidden">
            <div class="ai-legal-banner">
                <input type="checkbox" id="aiHabeasCheck">
                <label for="aiHabeasCheck">Acepto la <a href="privacidad.html" target="_blank">política de tratamiento de datos</a></label>
            </div>
            <button id="aiSubmitLead" class="ai-submit-lead-btn" disabled>🚀 Enviar mis datos de contacto</button>
        </div>
        <div class="ai-input-area">
            <input type="text" id="aiInput" class="ai-input" placeholder="Escribe tu consulta..." autocomplete="off">
            <button id="aiSendBtn" class="ai-send-btn">➤</button>
        </div>
    `;

    document.body.appendChild(widgetContainer);
    document.body.appendChild(chatWindow);

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

    fabBtn.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);
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
        if (!chatWindow.classList.contains('hidden')) {
            input.focus();
            scrollToBottom();
        }
    }

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
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function formatResponse(text) {
        // Simple Markdown formatter
        let html = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
        return html;
    }
});
