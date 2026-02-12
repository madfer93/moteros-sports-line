/**
 * 🔐 Moteros Sports Line - Seguridad y Protección de Código v2.0
 * Bloquea herramientas de desarrollador, clic derecho y ofusca la consola.
 */
(function () {
    'use strict';

    // 1. Deshabilitar consola (Anti-Logs)
    // Sobrescribe los métodos de consola para que no muestren nada
    const noop = function () { };
    const methods = [
        'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
        'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
        'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
        'timeline', 'timelineEnd', 'timeStamp', 'trace', 'warn'
    ];
    const console = (window.console = window.console || {});

    methods.forEach(function (method) {
        try {
            console[method] = noop;
        } catch (e) { }
    });

    // 2. Bloquear clic derecho (Context Menu)
    document.addEventListener('contextmenu', event => event.preventDefault());

    // 3. Bloquear selección de texto e imágenes
    document.addEventListener('selectstart', event => event.preventDefault());
    document.addEventListener('dragstart', event => event.preventDefault());

    // 4. Bloquear atajos de teclado para DevTools
    document.addEventListener('keydown', function (e) {
        // F12
        if (e.keyCode == 123) {
            e.preventDefault();
            return false;
        }
        // Ctrl+Shift+I (Inspeccionar)
        if (e.ctrlKey && e.shiftKey && e.keyCode == 73) {
            e.preventDefault();
            return false;
        }
        // Ctrl+Shift+C (Inspeccionar elemento)
        if (e.ctrlKey && e.shiftKey && e.keyCode == 67) {
            e.preventDefault();
            return false;
        }
        // Ctrl+Shift+J (Consola)
        if (e.ctrlKey && e.shiftKey && e.keyCode == 74) {
            e.preventDefault();
            return false;
        }
        // Ctrl+U (Ver código fuente)
        if (e.ctrlKey && e.keyCode == 85) {
            e.preventDefault();
            return false;
        }
        // Ctrl+S (Guardar)
        if (e.ctrlKey && e.keyCode == 83) {
            e.preventDefault();
            return false;
        }
    });

    // 5. Detección de DevTools (Avanzado)
    // Detecta cambios en el tamaño de la ventana (cuando se abre la consola lateral/abajo)
    // y usa el truco del 'debugger' que pausa la ejecución si las devtools están abiertas.

    // Método 1: Debugger loop (más agresivo)
    setInterval(() => {
        const start = Date.now();
        // eslint-disable-next-line no-debugger
        debugger;
        if (Date.now() - start > 100) {
            // Si el debugger pausó la ejecución por más de 100ms, es probable que esté abierto.
            document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;background:black;color:red;font-size:2rem;font-weight:bold;text-align:center;">⚠️ SEGURIDAD ACTIVADA ⚠️<br>El acceso a la consola está restringido.</div>';
            setTimeout(() => window.location.reload(), 2000);
        }
    }, 2000);

    // Método 2: Detectar tamaño de ventana externa vs interna
    // (Solo funciona si la consola está "docked" y roba espacio)
    /*
    const umbral = 160;
    setInterval(() => {
        if (window.outerWidth - window.innerWidth > umbral || window.outerHeight - window.innerHeight > umbral) {
             // Posible consola abierta
             // document.body.style.display = 'none'; // Ocultar contenido
        }
    }, 1000);
    */

    // 6. Supresión de Errores Globales
    // Evita que los errores muestren trazas en la consola (si lograran abrirla)
    window.onerror = function () {
        return true;
    };
    window.onunhandledrejection = function () {
        return true;
    };

})();
