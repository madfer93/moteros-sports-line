
/**
 * Módulo de Exportación de Reportes
 * Centraliza la lógica para generar archivos Excel y PDF desde tablas HTML o JSON.
 * Requiere: SheetJS (xlsx.full.min.js) y jsPDF (opcional para futuro).
 */
const ReportExporter = {
    /**
     * Exporta una tabla HTML o un array de objetos a un archivo Excel (.xlsx)
     * @param {HTMLElement|Array} source - Elemento <table> o Array de objetos JSON
     * @param {string} filename - Nombre base del archivo (sin extensión)
     * @param {string} sheetName - Nombre de la hoja en el Excel (opcional)
     */
    toExcel(source, filename = 'Reporte', sheetName = 'Datos') {
        if (!window.XLSX) {
            console.error('Librería SheetJS (XLSX) no encontrada.');
            alert('Error: Librería de exportación no cargada. Contacte al soporte.');
            return;
        }

        try {
            let workbook = XLSX.utils.book_new();
            let worksheet;

            if (Array.isArray(source)) {
                // Caso 1: Exportar desde JSON (Array de objetos)
                if (source.length === 0) {
                    alert('No hay datos para exportar.');
                    return;
                }
                worksheet = XLSX.utils.json_to_sheet(source);
            } else if (source instanceof HTMLElement && source.tagName === 'TABLE') {
                // Caso 2: Exportar desde tabla HTML
                worksheet = XLSX.utils.table_to_sheet(source);
            } else {
                console.error('Fuente de datos no válida para exportación:', source);
                alert('Error: Fuente de datos no válida.');
                return;
            }

            // Añadir hoja al libro
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

            // Generar archivo
            const dateStr = new Date().toISOString().split('T')[0];
            const fullName = `${filename}_${dateStr}.xlsx`;

            XLSX.writeFile(workbook, fullName);

            // Feedback simple si es posible (depende de un sistema de notificaciones global aka showToast)
            if (window.showToast) window.showToast('Exportación iniciada correctamente 📥', 'success');

        } catch (error) {
            console.error('Error al exportar a Excel:', error);
            if (window.showToast) window.showToast('Error al exportar: ' + error.message, 'error');
            else alert('Error al exportar: ' + error.message);
        }
    },

    /**
     * Exporta una tabla HTML o un array de objetos a un archivo PDF
     * @param {HTMLElement|Array} source - Elemento <table> o Array de objetos JSON
     * @param {string} filename - Nombre base del archivo (sin extensión)
     * @param {string} title - Título del reporte en el PDF
     */
    toPDF(source, filename = 'Reporte', title = 'Reporte') {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            console.error('Librería jsPDF no encontrada.');
            alert('Error: Librería PDF no cargada. Contacte al soporte.');
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // Configuración básica
            const pageWidth = doc.internal.pageSize.getWidth();

            // Encabezado
            doc.setFontSize(18);
            doc.setTextColor(30, 41, 59); // Slate 800
            doc.text(title, 14, 22);

            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139); // Slate 500
            doc.text(`Fecha de impresión: ${new Date().toLocaleString('es-CO')}`, 14, 28);

            // Branding simple
            doc.setFontSize(8);
            doc.setTextColor(255, 107, 0); // Primary Brand Color
            doc.text('Moteros Sports Line', pageWidth - 14, 22, { align: 'right' });

            // Generar tabla
            if (source instanceof HTMLElement && source.tagName === 'TABLE') {
                doc.autoTable({
                    html: source,
                    startY: 35,
                    theme: 'grid',
                    styles: { fontSize: 8, cellPadding: 3, valign: 'middle' },
                    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [248, 250, 252] }
                });
            } else if (Array.isArray(source)) {
                if (source.length === 0) { alert('No hay datos.'); return; }
                const headers = Object.keys(source[0]);
                const data = source.map(obj => Object.values(obj));

                doc.autoTable({
                    head: [headers],
                    body: data,
                    startY: 35,
                    theme: 'grid',
                    headStyles: { fillColor: [30, 41, 59] }
                });
            } else {
                alert('Formato de datos no soportado para PDF.');
                return;
            }

            // Guardar
            doc.save(`${filename}.pdf`);

            if (window.showToast) window.showToast('PDF generado correctamente 📄', 'success');

        } catch (error) {
            console.error('Error al exportar a PDF:', error);
            if (window.showToast) window.showToast('Error al generar PDF: ' + error.message, 'error');
            else alert('Error: ' + error.message);
        }
    }
};

window.ReportExporter = ReportExporter;
