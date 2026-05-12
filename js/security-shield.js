/**
 * MOTEROS SPORT LINE - SECURITY SHIELD "SENTINEL" v2.0
 * Protección de Propiedad Intelectual, Anti-Hacking y Rate Limiting.
 * ⚠️ ATENCIÓN: Este script bloquea accesos no autorizados y registra IPs.
 */

(function () {
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

    async function init() {
        const ipInfo = await captureUserMeta();
        await checkBlacklist(ipInfo.ip);
        setupProtections();
        
        // Anti-DevTools Trap
        setInterval(() => {
            const before = new Date().getTime();
            debugger;
            const after = new Date().getTime();
            if (after - before > 100) {
                handleViolation("Intento de depuración (DevTools Detected)");
            }
        }, 1000);
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

    async function checkBlacklist(ip) {
        if (!window.supabaseClient || ip === '0.0.0.0') return;
        
        const { data, error } = await window.supabaseClient
            .from('logs_sistema')
            .select('*')
            .eq('nivel', 'BLOQUEO')
            .eq('detalles->>ip', ip)
            .maybeSingle();

        if (data) {
            triggerLockdown(ip, data.detalles?.city || 'Identificada');
        }
    }

    function setupProtections() {
        // Bloquear clic derecho (Excepto si el modo lectura está activo para accesibilidad)
        document.addEventListener('contextmenu', e => {
            if (window.moteros_reader_active) {
                // Permitimos el clic derecho pero bloqueamos opciones de inspección si es posible
                return;
            }
            e.preventDefault();
            handleViolation("Clic Derecho Bloqueado");
        });

        // Bloquear COPIA de texto siempre, incluso si permitimos selección para lectura
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
                handleViolation(`Intento de acceso a código (${e.keyCode})`);
            }
        });
    }

    function handleViolation(reason) {
        suspiciousClicks++;
        console.warn(`[SENTINEL] Actividad sospechosa: ${reason} (${suspiciousClicks}/${SECURITY_CONFIG.MAX_SUSPICIOUS_CLICKS})`);
        
        if (suspiciousClicks >= SECURITY_CONFIG.MAX_SUSPICIOUS_CLICKS) {
            logAndLock(reason);
        }
    }

    async function logAndLock(reason) {
        if (isLocked) return;
        isLocked = true;

        const info = await captureUserMeta();
        
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
                    timestamp: new Date().toISOString()
                }
            });
        }

        triggerLockdown(info.ip, info.city);
    }

    function triggerLockdown(ip, city) {
        if (document.getElementById('security-lockdown')) return;
        
        document.body.innerHTML = SECURITY_CONFIG.LOCKDOWN_HTML;
        document.getElementById('attacker-ip').textContent = ip;
        document.getElementById('attacker-city').textContent = city;
        document.getElementById('attacker-os').textContent = navigator.platform;

        // "Digital Deterrence": Consumir atención del atacante
        setInterval(() => {
            document.body.style.backgroundColor = (document.body.style.backgroundColor === 'black') ? '#200' : 'black';
        }, 100);

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
