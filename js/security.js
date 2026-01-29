/**
 * 🔐 Moteros Sports Line - Seguridad y Protección de Código
 * Bloquea el uso de herramientas de desarrollador y clic derecho.
 */
(function () {
    // Bloquear clic derecho
    document.addEventListener('contextmenu', event => event.preventDefault());

    // Bloquear selección de texto
    document.addEventListener('selectstart', event => event.preventDefault());

    // Bloquear atajos de teclado
    document.addEventListener('keydown', function (e) {
        // Bloquear F12
        if (e.keyCode == 123) {
            e.preventDefault();
            return false;
        }
        // Bloquear Ctrl+Shift+I (Inspeccionar)
        if (e.ctrlKey && e.shiftKey && e.keyCode == 73) {
            e.preventDefault();
            return false;
        }
        // Bloquear Ctrl+Shift+C (Inspeccionar elemento)
        if (e.ctrlKey && e.shiftKey && e.keyCode == 67) {
            e.preventDefault();
            return false;
        }
        // Bloquear Ctrl+Shift+J (Consola)
        if (e.ctrlKey && e.shiftKey && e.keyCode == 74) {
            e.preventDefault();
            return false;
        }
        // Bloquear Ctrl+U (Ver código fuente)
        if (e.ctrlKey && e.keyCode == 85) {
            e.preventDefault();
            return false;
        }
    });

    // Anti-depuración
    setInterval(() => {
        const start = Date.now();
        debugger;
        if (Date.now() - start > 100) {
            window.location.reload();
        }
    }, 1000);
})();
