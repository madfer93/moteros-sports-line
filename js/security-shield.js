/**
 * MOTEROS SPORT LINE - SECURITY SHIELD "SENTINEL" v2.2
 * Protección de Propiedad Intelectual, Anti-Hacking y Rate Limiting.
 * ⚠️ ATENCIÓN: Este script bloquea accesos no autorizados y registra IPs.
 */

(function () {
    const startTime = Date.now();
    const SECURITY_CONFIG = {
        MAX_SUSPICIOUS_CLICKS: 10,
        BLOCK_MESSAGE: "⚠️ ACCESO DENEGADO PERMANENTEMENTE",
        LOCKDOWN_HTML: `
            <div id="security-lockdown" style="position:fixed;top:0;left:0;width:100%;height:100%;background:#000;color:#f00;z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Courier New',Courier,monospace;text-align:center;padding:2rem;">
                <h1 style="font-size:3rem;margin-bottom:1rem;">INCIDENTE DE SEGURIDAD</h1>
                <p style="font-size:1.5rem;color:#fff;">Actividad criminal detectada. Su cuenta o dirección IP ha sido capturada y enviada a J&M Tech Solutions Security Lab.</p>
                <div id="attacker-info" style="margin-top:2rem;text-align:left;background:#111;padding:1.5rem;border-left:5px solid #f00;width:100%;max-width:600px;">
                    <p>📡 IP: <span id="attacker-ip">Detectando...</span></p>
                    <p>📍 UBICACIÓN: <span id="attacker-city">Monitoreando...</span></p>
                    <p>🖥️ SISTEMA: <span id="attacker-os">Identificado</span></p>
                    <p>🛑 ESTADO: BLOQUEO PERMANENTE</p>
                </div>
                <p style="margin-top:3rem;color:#444;">ID del Incidente: ${Date.now()}</p>
            </div>
        `
    };

    let suspiciousClicks = 0;
    let isLocked = false;
    let devToolsConsecutiveTriggers = 0;

    // --- BLOQUEO SINCRÓNICO PREVIO A LA RENDERIZACIÓN ---
    const isLocalBlocked = localStorage.getItem('sentinel_blocked') === 'true' || sessionStorage.getItem('sentinel_blocked') === 'true';
    if (isLocalBlocked) {
        isLocked = true;
        applyImmediateStyleBlock();
    }

    function applyImmediateStyleBlock() {
        if (document.head) {
            const style = document.createElement('style');
            style.id = 'sentinel-early-block';
            style.innerHTML = `
                html, body {
                    background: #000 !important;
                    color: #f00 !important;
                    overflow: hidden !important;
                }
                body > * {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);
        } else {
            const checkHead = setInterval(() => {
                if (document.head) {
                    clearInterval(checkHead);
                    applyImmediateStyleBlock();
                }
            }, 5);
        }
    }

    async function getSessionInfo() {
        let info = {
            isAdmin: false,
            isEmployee: false,
            email: null,
            usuario: null,
            userId: null
        };
        
        try {
            // 1. Verificar si hay sesión de Supabase Auth (Administradores)
            if (window.supabaseClient) {
                const { data: { session } } = await window.supabaseClient.auth.getSession();
                if (session && session.user) {
                    info.isAdmin = true;
                    info.email = session.user.email;
                    info.userId = session.user.id;
                    return info;
                }
            }
        } catch (e) {}

        try {
            // 2. Verificar si hay sesión de empleado en el POS o Gestor
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes('empleado_logueado') || key === 'gestor_session')) {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data && data.id) {
                        info.isEmployee = true;
                        info.usuario = data.usuario || data.nombre;
                        info.userId = data.id;
                        info.email = data.email || null;
                        return info;
                    }
                }
            }
        } catch (e) {}

        return info;
    }

    async function init() {
        const sessionInfo = await getSessionInfo();
        const esDevEnv = 
            window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1' || 
            window.location.hostname.startsWith('192.168.') || 
            window.location.hostname.startsWith('100.') || // Tailscale
            localStorage.getItem('devMode') === 'true';

        // Exención total para Administradores y entorno de desarrollo
        if (sessionInfo.isAdmin || esDevEnv) {
            console.log("[SENTINEL] Modo Administrador o Desarrollo detectado. Protecciones desactivadas.");
            // Si el usuario fue desbloqueado, remover bloqueos locales residuales
            if (isLocalBlocked) {
                localStorage.removeItem('sentinel_blocked');
                sessionStorage.removeItem('sentinel_blocked');
                const earlyBlockStyle = document.getElementById('sentinel-early-block');
                if (earlyBlockStyle) earlyBlockStyle.remove();
            }
            return;
        }

        // Si estaba pre-bloqueado localmente y no es administrador, aplicar la pantalla roja
        if (isLocalBlocked) {
            triggerLockdown('Caché Local', 'Historial de Bloqueos');
        }

        const ipInfo = await captureUserMeta();
        await checkBlacklist(ipInfo.ip, sessionInfo);
        setupProtections();
        
        // Anti-DevTools Trap (Calibrado para evitar falsos positivos por lag de CPU)
        setInterval(() => {
            if (document.hidden) return; // Evitar falsos positivos cuando la pestaña está en segundo plano
            
            const before = new Date().getTime();
            debugger;
            const after = new Date().getTime();
            const elapsed = after - before;
            
            // Un lag del sistema rara vez supera los 500ms, un breakpoint de debugger casi siempre es > 1000ms
            if (elapsed > 1000) {
                devToolsConsecutiveTriggers++;
                if (devToolsConsecutiveTriggers >= 2) { // Requiere al menos 2 detecciones consecutivas
                    handleViolation("Intento de depuración (DevTools Detected)", {
                        tipo_evento: 'devtools_trap',
                        tiempo_pausa_ms: elapsed
                    });
                }
            } else {
                devToolsConsecutiveTriggers = 0; // Resetear si se ejecuta normalmente
            }
        }, 1500);
    }

    async function captureUserMeta() {
        try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            return {
                ip: data.ip || '0.0.0.0',
                city: data.city || 'Desconocida',
                region: data.region || 'Desconocida',
                org: data.org || 'ISP Desconocido'
            };
        } catch (e) {
            return { ip: '0.0.0.0', city: 'Unknown' };
        }
    }

    function obtenerTelemetria(reason, eventDetails = {}) {
        const tiempoSesion = Math.round((Date.now() - startTime) / 1000);

        // Dispositivo y Pantalla Táctil
        const esTactil = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0));
        const esMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const dispositivo = esMobile ? 'Mobile' : 'Desktop';

        // OS
        let os = 'Desconocido';
        const ua = navigator.userAgent;
        if (ua.indexOf('Win') !== -1) os = 'Windows';
        else if (ua.indexOf('Mac') !== -1) os = 'macOS';
        else if (ua.indexOf('X11') !== -1) os = 'UNIX';
        else if (ua.indexOf('Linux') !== -1) os = 'Linux';
        else if (/Android/i.test(ua)) os = 'Android';
        else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';

        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
        return {
            pestana_activa: !document.hidden,
            tiempo_sesion_seg: tiempoSesion,
            fecha_local_dispositivo: new Date().toString(),
            url_completa: window.location.href,
            referrer: document.referrer || 'Ninguno',
            resolucion_pantalla: `${window.screen.width}x${window.screen.height}`,
            resolucion_ventana: `${window.innerWidth}x${window.innerHeight}`,
            dispositivo: dispositivo,
            es_pantalla_tactil: esTactil,
            sistema_operativo: os,
            idioma_navegador: navigator.language || 'Desconocido',
            conexion_red: {
                tipo: conn.effectiveType || 'Desconocido',
                rtt_ms: conn.rtt || null,
                velocidad_downlink_mbps: conn.downlink || null
            },
            motivo_detallado: reason,
            detalles_evento: {
                tipo_evento: eventDetails.tipo_evento || 'desconocido',
                tiempo_pausa_ms: eventDetails.tiempo_pausa_ms || null,
                codigo_tecla: eventDetails.codigo_tecla || null,
                tag_elemento_clicado: eventDetails.tag_elemento_clicado || null,
                id_elemento_clicado: eventDetails.id_elemento_clicado || null,
                clases_elemento_clicado: eventDetails.clase_elemento_clicado || null
            }
        };
    }

    async function checkBlacklist(ip, sessionInfo) {
        if (!window.supabaseClient) return;
        
        try {
            const promises = [];
            
            // 1. Buscar por IP
            if (ip && ip !== '0.0.0.0') {
                promises.push(
                    window.supabaseClient
                        .from('logs_sistema')
                        .select('detalles')
                        .eq('nivel', 'BLOQUEO')
                        .eq('detalles->>ip', ip)
                        .limit(1)
                );
            }
            
            // 2. Buscar por ID de usuario
            if (sessionInfo.userId) {
                promises.push(
                    window.supabaseClient
                        .from('logs_sistema')
                        .select('detalles')
                        .eq('nivel', 'BLOQUEO')
                        .eq('usuario_id', sessionInfo.userId)
                        .limit(1)
                );
            }

            // 3. Buscar por email
            if (sessionInfo.email) {
                promises.push(
                    window.supabaseClient
                        .from('logs_sistema')
                        .select('detalles')
                        .eq('nivel', 'BLOQUEO')
                        .eq('detalles->>email', sessionInfo.email)
                        .limit(1)
                );
            }

            // 4. Buscar por nombre de usuario
            if (sessionInfo.usuario) {
                promises.push(
                    window.supabaseClient
                        .from('logs_sistema')
                        .select('detalles')
                        .eq('nivel', 'BLOQUEO')
                        .eq('detalles->>usuario', sessionInfo.usuario)
                        .limit(1)
                );
            }

            const results = await Promise.all(promises);
            const blockedLog = results.find(r => r.data && r.data.length > 0);

            if (blockedLog) {
                const logData = blockedLog.data[0];
                localStorage.setItem('sentinel_blocked', 'true');
                sessionStorage.setItem('sentinel_blocked', 'true');
                triggerLockdown(ip, logData.detalles?.city || 'Identificada');
            } else {
                // Si ya no existe ningún bloqueo activo en la DB, liberar el bloqueo local
                if (localStorage.getItem('sentinel_blocked') === 'true' || sessionStorage.getItem('sentinel_blocked') === 'true') {
                    localStorage.removeItem('sentinel_blocked');
                    sessionStorage.removeItem('sentinel_blocked');
                    const earlyBlockStyle = document.getElementById('sentinel-early-block');
                    if (earlyBlockStyle) earlyBlockStyle.remove();
                    location.reload();
                }
            }
        } catch (e) {
            console.error('[SENTINEL] Error en verificación de blacklist:', e);
        }
    }

    function setupProtections() {
        // Bloquear clic derecho (Previene el menú, pero NO bloquea el acceso permanentemente para evitar falsos positivos)
        document.addEventListener('contextmenu', e => {
            if (window.moteros_reader_active) {
                return;
            }
            e.preventDefault();
            console.warn("[SENTINEL] Clic derecho bloqueado.");
        });

        // Bloquear COPIA de texto siempre
        document.addEventListener('copy', e => {
            e.preventDefault();
            console.warn("[SENTINEL] Intento de copia bloqueado por seguridad.");
        });

        // Bloquear atajos de teclado (F12, Ctrl+U, Ctrl+Shift+I)
        document.addEventListener('keydown', e => {
            if (
                e.keyCode === 123 || // F12
                (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) || // I, J, C
                (e.ctrlKey && e.keyCode === 85) // U (View Source)
            ) {
                e.preventDefault();
                handleViolation(`Intento de acceso a código (${e.keyCode})`, {
                    tipo_evento: 'atajo_teclado',
                    codigo_tecla: e.keyCode || e.key
                });
            }
        });
    }

    function handleViolation(reason, eventDetails = {}) {
        suspiciousClicks++;
        console.warn(`[SENTINEL] Actividad sospechosa: ${reason} (${suspiciousClicks}/${SECURITY_CONFIG.MAX_SUSPICIOUS_CLICKS})`);
        
        if (suspiciousClicks >= SECURITY_CONFIG.MAX_SUSPICIOUS_CLICKS) {
            logAndLock(reason, eventDetails);
        }
    }

    async function logAndLock(reason, eventDetails = {}) {
        if (isLocked) return;
        isLocked = true;

        const info = await captureUserMeta();
        const sessionInfo = await getSessionInfo();
        const telemetria = obtenerTelemetria(reason, eventDetails);
        
        localStorage.setItem('sentinel_blocked', 'true');
        sessionStorage.setItem('sentinel_blocked', 'true');

        // Notificar a Supabase (logs_sistema existente)
        if (window.supabaseClient) {
            await window.supabaseClient.from('logs_sistema').insert({
                nivel: 'BLOQUEO',
                mensaje: `ATAQUE BLOQUEADO: ${reason}`,
                origen: window.location.pathname,
                usuario_id: sessionInfo.userId || null,
                detalles: {
                    ip: info.ip,
                    city: info.city,
                    region: info.region,
                    org: info.org,
                    email: sessionInfo.email || null,
                    usuario: sessionInfo.usuario || null,
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString(),
                    telemetria: telemetria
                }
            });
        }

        triggerLockdown(info.ip, info.city);
    }

    function triggerLockdown(ip, city) {
        applyImmediateStyleBlock();
        
        if (document.getElementById('security-lockdown')) return;
        
        const showRedScreen = () => {
            document.body.innerHTML = SECURITY_CONFIG.LOCKDOWN_HTML;
            const attackerIp = document.getElementById('attacker-ip');
            const attackerCity = document.getElementById('attacker-city');
            const attackerOs = document.getElementById('attacker-os');
            
            if (attackerIp) attackerIp.textContent = ip;
            if (attackerCity) attackerCity.textContent = city;
            if (attackerOs) attackerOs.textContent = navigator.platform;

            // "Digital Deterrence"
            setInterval(() => {
                document.body.style.backgroundColor = (document.body.style.backgroundColor === 'black') ? '#200' : 'black';
            }, 100);
        };

        if (document.body) {
            showRedScreen();
        } else {
            document.addEventListener('DOMContentLoaded', showRedScreen);
        }

        // Bloqueo total de clics
        window.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

