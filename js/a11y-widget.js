/**
 * MOTEROS SPORT LINE - A11Y WIDGET JS
 * Motor de Accesibilidad, Inclusividad y Traducción
 */

(function () {
    const ASSETS = {
        icon: '♿',
        modes: [
            { id: 'high-contrast', label: 'Alto Contraste', icon: '🌓', class: 'a11y-high-contrast' },
            { id: 'text-lg', label: 'Texto Grande', icon: 'A+', class: 'a11y-text-lg' },
            { id: 'dyslexia', label: 'Fuente Dislexia', icon: '📝', class: 'a11y-dyslexia' },
            { id: 'highlight-links', label: 'Resaltar Enlaces', icon: '🔗', class: 'a11y-highlight-links' },
            { id: 'stop-animations', label: 'Detener Animaciones', icon: '⏸️', class: 'a11y-stop-animations' },
            { id: 'text-reader', label: 'Lectura de Voz (Beta)', icon: '🔊', action: 'toggleReader' }
        ]
    };

    let a11yState = JSON.parse(localStorage.getItem('moteros_a11y_prefs') || '{}');
    let readerActive = false;
    window.moteros_reader_active = false; // Bridge for Security Shield

    // Inicialización del Widget
    function init() {
        injectHTML();
        applyStoredPrefs();
        setupEventListeners();
        initTranslation(); // SEO/Internacionalización
    }

    function injectHTML() {
        const container = document.createElement('div');
        container.id = 'a11y-widget-container';
        container.className = 'a11y-exclude'; // Excluir de filtros de accesibilidad
        
        container.innerHTML = `
            <button class="a11y-toggle-btn" aria-label="Abrir opciones de accesibilidad">
                ${ASSETS.icon}
            </button>
            <div class="a11y-menu">
                <h3>♿ HUB DE ACCESIBILIDAD</h3>
                <div class="a11y-options-grid">
                    ${ASSETS.modes.map(mode => `
                        <div class="a11y-option ${a11yState[mode.id] ? 'active' : ''}" data-id="${mode.id}">
                            <span>${mode.icon} ${mode.label}</span>
                            <div class="a11y-status">${a11yState[mode.id] ? 'ON' : 'OFF'}</div>
                        </div>
                    `).join('')}
                    <div id="google_translate_element" style="padding-top: 10px; border-top: 1px solid #eee;"></div>
                </div>
            </div>
        `;
        document.body.appendChild(container);
    }

    function applyStoredPrefs() {
        ASSETS.modes.forEach(mode => {
            if (a11yState[mode.id] && mode.class) {
                document.body.classList.add(mode.class);
            }
        });
    }

    function setupEventListeners() {
        const toggleBtn = document.querySelector('.a11y-toggle-btn');
        const menu = document.querySelector('.a11y-menu');

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('active');
        });

        document.addEventListener('click', () => {
            menu.classList.remove('active');
        });

        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            const option = e.target.closest('.a11y-option');
            if (option) {
                const modeId = option.dataset.id;
                toggleMode(modeId);
            }
        });
    }

    async function toggleMode(id) {
        const mode = ASSETS.modes.find(m => m.id === id);
        if (!mode) return;

        a11yState[id] = !a11yState[id];
        
        // Efecto visual en el botón
        const optionEl = document.querySelector(`.a11y-option[data-id="${id}"]`);
        optionEl.classList.toggle('active');
        optionEl.querySelector('.a11y-status').textContent = a11yState[id] ? 'ON' : 'OFF';

        if (mode.class) {
            document.body.classList.toggle(mode.class);
        }

        if (mode.action === 'toggleReader') {
            readerActive = a11yState[id];
            window.moteros_reader_active = readerActive; // Notify Security Guard
            if (readerActive) {
                document.body.classList.add('a11y-reader-mode');
                if (window.speechSynthesis) {
                    const msg = new SpeechSynthesisUtterance("Modo lectura activado. Haz clic en cualquier texto para escucharlo.");
                    msg.lang = 'es-CO';
                    window.speechSynthesis.speak(msg);
                }
            }
        }

        // Persistencia Segura (LocalStorage + Supabase sync)
        localStorage.setItem('moteros_a11y_prefs', JSON.stringify(a11yState));
        
        // Sincronizar con Supabase si está disponible y hay sesión
        syncWithSupabase();
    }

    async function syncWithSupabase() {
        if (window.supabaseClient) {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (session) {
                await window.supabaseClient.from('user_preferences').upsert({
                    id_usuario: session.user.id,
                    a11y_prefs: a11yState,
                    updated_at: new Date()
                });
            }
        }
    }

    // Traducción Inclusiva (Google Translate API)
    function initTranslation() {
        const script = document.createElement('script');
        script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        document.head.appendChild(script);

        window.googleTranslateElementInit = function () {
            new google.translate.TranslateElement({
                pageLanguage: 'es',
                includedLanguages: 'en,fr,pt,it,de',
                layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
                autoDisplay: false
            }, 'google_translate_element');
        };
    }

    // Lector de Voz al hacer clic
    document.addEventListener('click', (e) => {
        if (!readerActive) return;
        
        const target = e.target;
        if (['P', 'H1', 'H2', 'H3', 'H4', 'SPAN', 'LI', 'A'].includes(target.tagName)) {
            const text = target.innerText;
            if (text && text.trim().length > 0) {
                speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'es-CO';
                window.speechSynthesis.speak(utterance);
                
                // Efecto visual de lectura
                target.style.backgroundColor = 'rgba(255, 107, 0, 0.2)';
                setTimeout(() => target.style.backgroundColor = '', 2000);
            }
        }
    });

    // Iniciar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
