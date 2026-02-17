
/**
 * TICKET PRINTE MODULE
 * Sistema centralizado para impresión de tickets y reportes con formato estándar.
 */

const TicketPrinter = {

    /**
     * Imprime un ticket o reporte con el encabezado estándar de Moteros Sport Line.
     * @param {string} titulo - Título del reporte (ej: "BOLETA DE CRÉDITO")
     * @param {string} contenidoHTML - Contenido del cuerpo del ticket (tablas, info, etc)
     * @param {string} firma - Texto opcional para el pie de firma (default: null)
     */
    print: function (titulo, contenidoHTML, firma = null) {

        // Configuración
        const LOGO_URL = "img/logo-moteros.jpeg";
        const EMPRESA = "MOTEROS SPORT LINE";
        const UBICACION = "Villavicencio - Meta";
        const NIT = "NIT: 901.234.567-8"; // Validar si este es el real o usar config

        // Crear ventana de impresión
        const win = window.open('', '_blank', 'width=400,height=600');
        if (!win) {
            alert('Por favor permite las ventanas emergentes para imprimir.');
            return;
        }

        const now = new Date();
        const fechaImpresion = now.toLocaleDateString('es-CO');
        const horaImpresion = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

        // Estilos CSS para impresión
        const estilos = `
            <style>
                body {
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 12px;
                    margin: 0;
                    padding: 10px;
                    color: #000;
                }
                .header {
                    text-align: center;
                    margin-bottom: 0px;
                }
                .logo {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    filter: grayscale(100%); /* Opcional para ahorrar tinta/estilo ticket */
                    margin-bottom: 5px;
                }
                .empresa {
                    font-weight: bold;
                    font-size: 14px;
                    margin-bottom: 2px;
                }
                .info {
                    font-size: 10px;
                    margin-bottom: 2px;
                }
                .titulo-reporte {
                    margin-top: 5px;
                    border-top: 1px dashed #000;
                    padding-top: 5px;
                    font-weight: bold;
                    text-transform: uppercase;
                    margin-bottom: 2px;
                }
                .meta-info {
                    margin-bottom: 10px;
                    font-size: 10px;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                th {
                    text-align: left;
                    border-bottom: 1px dashed #000;
                    padding: 3px 0;
                }
                td {
                    padding: 3px 0;
                }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .bold { font-weight: bold; }
                
                .divider {
                    border-bottom: 1px dashed #000;
                    margin: 10px 0;
                }
                
                .footer {
                    margin-top: 20px;
                    text-align: center;
                    font-size: 10px;
                }
                
                /* Ocultar elementos de UI si se pasaron por error */
                button, .no-print { display: none !important; }
                
                @media print {
                    @page { margin: 0; }
                    body { margin: 1cm; }
                }
            </style>
        `;

        // Construir HTML completo
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Imprimir Ticket</title>
                ${estilos}
            </head>
            <body>
                <div class="header">
                    <img src="${LOGO_URL}" class="logo" alt="Logo">
                    <div class="empresa">${EMPRESA}</div>
                    <div class="info">${UBICACION}</div>
                    <div class="info">${NIT}</div>
                    <div class="titulo-reporte">${titulo}</div>
                    <div class="meta-info">Fecha: ${fechaImpresion} ${horaImpresion}</div>
                </div>

                <div class="content">
                    ${contenidoHTML}
                </div>

                ${firma ? `
                <div style="margin-top: 40px; text-align: center;">
                    <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto 5px auto;"></div>
                    <div>${firma}</div>
                </div>
                ` : ''}

                <div class="footer">
                    <div class="divider"></div>
                    <div>¡Gracias por su trabajo!</div>
                    <div>Sistema Moteros Sport Line</div>
                </div>

                <script>
                    window.onload = function() {
                        window.focus();
                        setTimeout(() => { window.print(); window.close(); }, 500);
                    };
                </script>
            </body>
            </html>
        `;

        win.document.write(html);
        win.document.close();
    }
};

// Exportar globalmente
window.TicketPrinter = TicketPrinter;
