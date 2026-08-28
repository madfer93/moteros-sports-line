// ═══════════════════════════════════════════════════════════════
// MOTEROS SPORTS LINE - CONSOLA DE AUDITORÍA Y CONCILIACIÓN
// ═══════════════════════════════════════════════════════════════

/**
 * Estado global de la conciliación administrativa
 */
window.estadoConciliacion = {
    sedeSeleccionada: 'Bodega',
    fechaConteo: new Date().toISOString().slice(0, 10),
    itemsConciliacion: [],
    filtroBusqueda: '',
    filtroEstado: 'todos',
    filtroCategoria: ''
};

// ═══════════════════════════════════════════════════════════════
// CONSOLA DE AUDITORÍA Y CONCILIACIÓN TOTAL (VISTA ADMINISTRADOR)
// ═══════════════════════════════════════════════════════════════

/**
 * Carga los datos reales de stock en sistema y realiza la conciliación contra el conteo físico
 */
async function cargarConciliacionAuditoria() {
    const sede = document.getElementById('conciliacionSelectSede')?.value || window.estadoConteo.sedeSeleccionada || 'Bodega';
    const tbody = document.getElementById('tbodyConciliacion');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="9" class="text-center" style="padding: 2rem;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 0.5rem; color: #64748b;">Consultando inventario en Supabase y comparando con conteo físico...</p></td></tr>';

    try {
        const client = window.supabaseClient;
        if (!client) throw new Error('Cliente Supabase no disponible');

        // 1. Cargar productos y variantes
        const { data: productos, error: errP } = await client
            .from('productos')
            .select('id, id_producto, nombre, referencia, marca, categoria, precio, precio_compra, variantes, tallas');
        if (errP) throw errP;

        // 2. Cargar stock en la sede seleccionada
        let stockSistemaMap = new Map(); // Clave: `${id_producto}_${color}_${talla}` -> cantidad

        if (sede === 'Alcalá') {
            const { data: invAlc } = await client.from('inventario_alcala').select('*');
            (invAlc || []).forEach(r => {
                const k = `${r.id_producto || r.producto_id}_${r.color || 'Único'}_${r.talla || 'Única'}`;
                stockSistemaMap.set(k, (stockSistemaMap.get(k) || 0) + (parseInt(r.cantidad) || 0));
            });
        } else if (sede === 'Local 01') {
            const { data: inv01 } = await client.from('inventario_01').select('*');
            (inv01 || []).forEach(r => {
                const k = `${r.id_producto || r.producto_id}_${r.color || 'Único'}_${r.talla || 'Única'}`;
                stockSistemaMap.set(k, (stockSistemaMap.get(k) || 0) + (parseInt(r.cantidad) || 0));
            });
        } else if (sede === 'Jordán') {
            const { data: invJor } = await client.from('inventario_jordan').select('*');
            (invJor || []).forEach(r => {
                const k = `${r.id_producto || r.producto_id}_${r.color || 'Único'}_${r.talla || 'Única'}`;
                stockSistemaMap.set(k, (stockSistemaMap.get(k) || 0) + (parseInt(r.cantidad) || 0));
            });
        } else {
            // Bodega
            const { data: invBod } = await client.from('inventario').select('*').eq('local_id', 'Bodega');
            (invBod || []).forEach(r => {
                const k = `${r.id_producto || r.producto_id}_${r.color || 'Único'}_${r.talla || 'Única'}`;
                stockSistemaMap.set(k, (stockSistemaMap.get(k) || 0) + (parseInt(r.cantidad) || 0));
            });
        }

        // Cargar conteos guardados localmente para esta sede
        const keyStorage = `conteo_ciego_${sede}_${new Date().toISOString().slice(0, 10)}`;
        const conteosSede = JSON.parse(localStorage.getItem(keyStorage) || '{}');

        // Armar tabla de conciliación
        const filasConciliacion = [];
        let totalExactos = 0;
        let totalFaltantes = 0;
        let totalSobrantes = 0;
        let impactoFinanciero = 0;

        (productos || []).forEach(p => {
            const variantes = Array.isArray(p.variantes) && p.variantes.length > 0 ? p.variantes : [{ color: 'Único' }];
            const tallas = Array.isArray(p.tallas) && p.tallas.length > 0 ? p.tallas : ['Única'];

            variantes.forEach(v => {
                const color = v.color || 'Único';
                tallas.forEach(t => {
                    const talla = t || 'Única';
                    const key = `${p.id}_${color}_${talla}`;

                    // Buscar stock en sistema (por ID o ID_PRODUCTO)
                    const keySlug = `${p.id_producto}_${color}_${talla}`;
                    const sistemaCant = stockSistemaMap.get(key) || stockSistemaMap.get(keySlug) || 0;

                    const registroConteo = conteosSede[key];
                    const fueContado = !!registroConteo;
                    const fisicoCant = fueContado ? registroConteo.contada : null;

                    let diferencia = null;
                    let estadoCuadre = 'Pendiente';

                    if (fueContado) {
                        diferencia = fisicoCant - sistemaCant;
                        if (diferencia === 0) {
                            estadoCuadre = 'Exacto';
                            totalExactos++;
                        } else if (diferencia < 0) {
                            estadoCuadre = 'Faltante';
                            totalFaltantes += Math.abs(diferencia);
                            impactoFinanciero += (diferencia * (p.precio_compra || p.precio || 0));
                        } else {
                            estadoCuadre = 'Sobrante';
                            totalSobrantes += diferencia;
                            impactoFinanciero += (diferencia * (p.precio_compra || p.precio || 0));
                        }
                    }

                    filasConciliacion.push({
                        producto_id: p.id,
                        id_producto: p.id_producto || p.id,
                        nombre: p.nombre,
                        referencia: p.referencia || '',
                        color,
                        talla,
                        costo: p.precio_compra || 0,
                        precio: p.precio || 0,
                        sistema: sistemaCant,
                        fisico: fisicoCant,
                        diferencia,
                        estadoCuadre,
                        operario: registroConteo ? registroConteo.operario : '',
                        timestamp: registroConteo ? registroConteo.timestamp : ''
                    });
                });
            });
        });

        window.filasConciliacionActual = filasConciliacion;

        // Actualizar tarjetas de KPI
        document.getElementById('kpiExactos').textContent = totalExactos;
        document.getElementById('kpiFaltantes').textContent = totalFaltantes;
        document.getElementById('kpiSobrantes').textContent = totalSobrantes;
        document.getElementById('kpiImpacto').textContent = `$${Math.abs(Math.round(impactoFinanciero)).toLocaleString('es-CO')}`;
        document.getElementById('kpiImpacto').style.color = impactoFinanciero < 0 ? '#ef4444' : (impactoFinanciero > 0 ? '#10b981' : '#475569');

        renderizarTablaConciliacion(filasConciliacion);

    } catch (e) {
        console.error('Error en conciliación de auditoría:', e);
        tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="color: #ef4444; padding: 2rem;">❌ Error: ${e.message}</td></tr>`;
    }
}

/**
 * Renderiza las filas de la tabla de conciliación
 */
function renderizarTablaConciliacion(filas) {
    const tbody = document.getElementById('tbodyConciliacion');
    if (!tbody) return;

    const filtro = document.getElementById('conciliacionFiltroDiscrepancia')?.value || 'todos';

    const filtradas = filas.filter(f => {
        if (filtro === 'descuadres') return f.estadoCuadre === 'Faltante' || f.estadoCuadre === 'Sobrante';
        if (filtro === 'faltantes') return f.estadoCuadre === 'Faltante';
        if (filtro === 'sobrantes') return f.estadoCuadre === 'Sobrante';
        if (filtro === 'exactos') return f.estadoCuadre === 'Exacto';
        if (filtro === 'pendientes') return f.estadoCuadre === 'Pendiente';
        return true;
    });

    if (filtradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center" style="padding: 2rem; color: #94a3b8;">No hay registros que coincidan con este filtro.</td></tr>';
        return;
    }

    tbody.innerHTML = filtradas.map(f => {
        let badgeEstado = '';
        let rowClass = '';

        if (f.estadoCuadre === 'Exacto') {
            badgeEstado = '<span class="badge" style="background: #dcfce7; color: #166534; font-weight: 700; padding: 0.35rem 0.65rem; border-radius: 0.5rem;">✅ Exacto (0)</span>';
        } else if (f.estadoCuadre === 'Faltante') {
            badgeEstado = `<span class="badge" style="background: #fee2e2; color: #991b1b; font-weight: 700; padding: 0.35rem 0.65rem; border-radius: 0.5rem;">🔻 Faltante (${f.diferencia})</span>`;
            rowClass = 'style="background: #fff5f5;"';
        } else if (f.estadoCuadre === 'Sobrante') {
            badgeEstado = `<span class="badge" style="background: #fef9c3; color: #854d0e; font-weight: 700; padding: 0.35rem 0.65rem; border-radius: 0.5rem;">🔺 Sobrante (+${f.diferencia})</span>`;
            rowClass = 'style="background: #fefce8;"';
        } else {
            badgeEstado = '<span class="badge" style="background: #f1f5f9; color: #64748b; font-weight: 600; padding: 0.35rem 0.65rem; border-radius: 0.5rem;">⏳ No Contado</span>';
        }

        const difValor = f.diferencia !== null ? (f.diferencia * (f.costo || f.precio || 0)) : 0;
        const difValorFormateado = f.diferencia !== null ? `$${Math.abs(Math.round(difValor)).toLocaleString('es-CO')}` : '-';

        return `
            <tr ${rowClass}>
                <td style="font-weight: 700; color: #0f172a;">${f.nombre}</td>
                <td style="color: #64748b; font-size: 0.85rem;">${f.referencia || '-'}</td>
                <td><span style="background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: 0.3rem; font-weight: 600;">${f.color}</span></td>
                <td><span style="background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: 0.3rem; font-weight: 600;">${f.talla}</span></td>
                <td style="text-align: center; font-weight: 800; font-size: 1.05rem; color: #1e293b;">${f.sistema}</td>
                <td style="text-align: center; font-weight: 800; font-size: 1.05rem; color: #2563eb;">${f.fisico !== null ? f.fisico : '<span style="color: #94a3b8;">-</span>'}</td>
                <td style="text-align: center;">${badgeEstado}</td>
                <td style="text-align: right; font-weight: 700; color: ${difValor < 0 ? '#dc2626' : (difValor > 0 ? '#16a34a' : '#64748b')};">${difValorFormateado}</td>
                <td style="font-size: 0.8rem; color: #64748b;">${f.operario || '-'}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Aplica el ajuste automático auditado en las tablas de inventario de Supabase
 */
async function aplicarAjusteInventarioAuditado() {
    const sede = document.getElementById('conciliacionSelectSede')?.value || 'Bodega';
    const filas = (window.filasConciliacionActual || []).filter(f => f.estadoCuadre === 'Faltante' || f.estadoCuadre === 'Sobrante');

    if (filas.length === 0) {
        alert('No hay descuadres pendientes por ajustar para esta sede.');
        return;
    }

    const confirmar = confirm(`¿Estás seguro de APLICAR EL AJUSTE AUTOMÁTICO a ${filas.length} ítems con descuadre en ${sede}?\n\nEsta acción modificará el inventario del sistema para igualarlo al conteo físico y creará el registro formal en la Auditoría.`);
    if (!confirmar) return;

    const btn = document.getElementById('btnAplicarAjusteAuditado');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aplicando Ajustes en Supabase...';
    }

    try {
        const client = window.supabaseClient;
        let ajustados = 0;

        for (const item of filas) {
            const nuevaCantidad = item.fisico;
            const cantAnterior = item.sistema;

            // 1. Actualizar tabla correspondiente
            if (sede === 'Alcalá') {
                await client.from('inventario_alcala')
                    .upsert({ id_producto: item.id_producto, talla: item.talla, color: item.color, cantidad: nuevaCantidad }, { onConflict: 'id_producto,talla,color' });
            } else if (sede === 'Local 01') {
                await client.from('inventario_01')
                    .upsert({ id_producto: item.id_producto, talla: item.talla, color: item.color, cantidad: nuevaCantidad }, { onConflict: 'id_producto,talla,color' });
            } else if (sede === 'Jordán') {
                await client.from('inventario_jordan')
                    .upsert({ id_producto: item.id_producto, talla: item.talla, color: item.color, cantidad: nuevaCantidad }, { onConflict: 'id_producto,talla,color' });
            } else {
                await client.from('inventario')
                    .upsert({ id_producto: item.id_producto, local_id: 'Bodega', talla: item.talla, color: item.color, cantidad: nuevaCantidad, ultima_actualizacion: new Date().toISOString() }, { onConflict: 'id_producto,local_id,talla,color' });
            }

            // 2. Registrar en Auditoría Formal
            if (typeof registrarAuditoriaInventario === 'function') {
                await registrarAuditoriaInventario({
                    producto_id: item.producto_id,
                    producto_nombre: item.nombre,
                    producto_codigo: item.referencia,
                    empleado_nombre: item.operario || 'Auditoría Inventario Ciego',
                    tipo_accion: 'Ajuste Toma Física Ciega',
                    local: sede,
                    talla_color: `${item.color} / ${item.talla}`,
                    cantidad_anterior: cantAnterior,
                    cantidad_nueva: nuevaCantidad,
                    detalles: {
                        motivo: 'Cuadre de inventario físico vs sistema',
                        diferencia: item.diferencia,
                        impacto_financiero: item.diferencia * item.costo
                    }
                });
            }

            ajustados++;
        }

        alert(`✅ Éxito: Se ajustaron ${ajustados} ítems en ${sede} y se registraron en la Auditoría.`);
        cargarConciliacionAuditoria();

    } catch (e) {
        console.error('Error aplicando ajustes:', e);
        alert(`❌ Error aplicando ajuste: ${e.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '⚡ Aplicar Ajuste de Inventario con Auditoría';
        }
    }
}

/**
 * Exporta el reporte de conciliación a CSV
 */
function exportarConciliacionCSV() {
    const filas = window.filasConciliacionActual || [];
    if (filas.length === 0) {
        alert('No hay datos para exportar.');
        return;
    }

    const sede = document.getElementById('conciliacionSelectSede')?.value || 'Bodega';
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Producto,Referencia,Color,Talla,Stock_Sistema,Conteo_Fisico,Diferencia,Estado,Valor_Descuadre_COP,Operario\n";

    filas.forEach(f => {
        const val = f.diferencia !== null ? (f.diferencia * (f.costo || f.precio || 0)) : 0;
        csvContent += `"${f.nombre.replace(/"/g, '""')}","${f.referencia}","${f.color}","${f.talla}",${f.sistema},${f.fisico !== null ? f.fisico : ''},${f.diferencia !== null ? f.diferencia : ''},"${f.estadoCuadre}",${val},"${f.operario}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Auditoria_Inventario_${sede}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Exponer funciones globales de conciliación
window.cargarConciliacionAuditoria = cargarConciliacionAuditoria;
window.renderizarTablaConciliacion = renderizarTablaConciliacion;
window.aplicarAjusteInventarioAuditado = aplicarAjusteInventarioAuditado;
window.exportarConciliacionCSV = exportarConciliacionCSV;
