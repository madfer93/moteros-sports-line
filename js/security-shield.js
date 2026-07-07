/**
 * MOTEROS SPORT LINE - SECURITY SHIELD "SENTINEL" v2.1
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
                <p style="font-size:1.5rem;color:#fff;">Actividad criminal detectada. Su dirección IP ha sido capturada y enviada a J&M Tech Solutions Security Lab.</p>
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

    async function init() {
        // Si estaba pre-bloqueado localmente, aplicar la pantalla roja una vez que el DOM esté listo
        if (isLocalBlocked) {
            triggerLockdown('Caché Local', 'Historial de Bloqueos');
        }

        const ipInfo = await captureUserMeta();
        await checkBlacklist(ipInfo.ip);
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

        // Sistema Operativo (Simple parsing)
        let os = 'Desconocido';
        const ua = navigator.userAgent;
        if (ua.indexOf('Win') !== -1) os = 'Windows';
        else if (ua.indexOf('Mac') !== -1) os = 'macOS';
        else if (ua.indexOf('X11') !== -1) os = 'UNIX';
        else if (ua.indexOf('Linux') !== -1) os = 'Linux';
        else if (/Android/i.test(ua)) os = 'Android';
        else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';

        // Conexión de Red (si es soportada)
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
        const conexionRed = {
            tipo: conn.effectiveType || 'Desconocido',
            rtt_ms: conn.rtt || null,
            velocidad_downlink_mbps: conn.downlink || null
        };

        const esDevEnv = 
            window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1' || 
            window.location.hostname.startsWith('192.168.') || 
            window.location.hostname.startsWith('100.') || // Tailscale
            localStorage.getItem('devMode') === 'true';

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
            conexion_red: conexionRed,
            es_entorno_desarrollo: esDevEnv,
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

    async function checkBlacklist(ip) {
        if (!window.supabaseClient || ip === '0.0.0.0') return;
        
        try {
            // Se usa limit(1) en vez de maybeSingle() para evitar el error PGRST116 si existen múltiples bloqueos para la misma IP
            const { data, error } = await window.supabaseClient
                .from('logs_sistema')
                .select('*')
                .eq('nivel', 'BLOQUEO')
                .eq('detalles->>ip', ip)
                .limit(1);

            if (data && data.length > 0) {
                // Sincronizar bloqueo en almacenamiento local para bloqueo instantáneo en refrescos/nuevas pestañas
                localStorage.setItem('sentinel_blocked', 'true');
                sessionStorage.setItem('sentinel_blocked', 'true');
                triggerLockdown(ip, data[0].detalles?.city || 'Identificada');
            } else {
                // Si ya no existe el bloqueo en la base de datos (desbloqueado por administrador), limpiar caché local
                if (localStorage.getItem('sentinel_blocked') === 'true' || sessionStorage.getItem('sentinel_blocked') === 'true') {
                    localStorage.removeItem('sentinel_blocked');
                    sessionStorage.removeItem('sentinel_blocked');
                    // Remover estilo early-block si existe
                    const earlyBlockStyle = document.getElementById('sentinel-early-block');
                    if (earlyBlockStyle) earlyBlockStyle.remove();
                    // Recargar para restaurar la interfaz normal si fue desbloqueado
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
        const telemetria = obtenerTelemetria(reason, eventDetails);
        
        localStorage.setItem('sentinel_blocked', 'true');
        sessionStorage.setItem('sentinel_blocked', 'true');

        // Notificar a Supabase (logs_sistema existente)
        if (window.supabaseClient) {
            await window.supabaseClient.from('logs_sistema').insert({
                nivel: 'BLOQUEO',
                mensaje: `ATAQUE BLOQUEADO: ${reason}`,
                origen: window.location.pathname,
                detalles: {
                    ip: info.ip,
                    city: info.city,
                    region: info.region,
                    org: info.org,
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString(),
                    telemetria: telemetria
                }
            });
        }

        triggerLockdown(info.ip, info.city);
    }

    function triggerLockdown(ip, city) {
        // Asegurar que el estilo early block esté activo para ocultar todo
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

            // "Digital Deterrence": Consumir atención del atacante
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

    // Iniciar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

