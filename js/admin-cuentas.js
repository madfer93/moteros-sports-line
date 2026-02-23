// ---------------------------------------------------------------
// MOTEROS SPORTS LINE - GESTIÓN DE CUENTAS BANCARIAS
// ---------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // Escuchar cambios de sección para cargar cuentas si es necesario
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.id === 'configuracionSection' && mutation.target.classList.contains('active')) {
                cargarCuentasBancarias();
            }
        });
    });

    const configSection = document.getElementById('configuracionSection');
    if (configSection) {
        observer.observe(configSection, { attributes: true, attributeFilter: ['class'] });
        // Carga inicial si ya está activa
        if (configSection.classList.contains('active')) cargarCuentasBancarias();
    }
});

async function cargarCuentasBancarias() {
    const tbody = document.getElementById('tbodyCuentasBancarias');
    if (!tbody) return;

    try {
        const { data, error } = await supabaseClient
            .from('cuentas_bancarias')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #94a3b8;">No hay cuentas registradas.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(c => `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.2rem;">${getIconBanco(c.banco)}</span>
                        <strong>${c.banco}</strong>
                    </div>
                </td>
                <td><code>${c.numero_cuenta}</code></td>
                <td>${c.nombre_titular}</td>
                <td>
                    <span class="badge ${c.activa ? 'badge-success' : 'badge-danger'}" 
                          onclick="toggleEstadoCuenta('${c.id}', ${c.activa})" 
                          style="cursor: pointer;">
                        ${c.activa ? 'Activa' : 'Inactiva'}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-sm btn-outline-primary" onclick="editarCuenta('${c.id}')" title="Editar">✏️</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="eliminarCuenta('${c.id}')" title="Eliminar">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');

    } catch (e) {
        console.error('Error cargando cuentas:', e);
        showToast('Error al cargar cuentas bancarias', 'error');
    }
}

function getIconBanco(banco) {
    const b = banco.toLowerCase();
    if (b.includes('nequi')) return '📱';
    if (b.includes('daviplata')) return '📱';
    if (b.includes('bancolombia')) return '🏦';
    if (b.includes('bogota')) return '🏦';
    return '💳';
}

function abrirModalNuevaCuenta() {
    document.getElementById('tituloModalCuenta').textContent = '🏦 Nueva Cuenta Bancaria';
    document.getElementById('cuentaEditId').value = '';
    document.getElementById('cuentaBanco').value = '';
    document.getElementById('cuentaNumero').value = '';
    document.getElementById('cuentaTitular').value = '';
    document.getElementById('cuentaTipo').value = 'Ahorros';

    document.getElementById('modalCuentaBancaria').style.display = 'flex';
}

function cerrarModalCuenta() {
    document.getElementById('modalCuentaBancaria').style.display = 'none';
}

async function guardarCuentaBancaria() {
    const id = document.getElementById('cuentaEditId').value;
    const banco = document.getElementById('cuentaBanco').value.trim();
    const numero = document.getElementById('cuentaNumero').value.trim();
    const titular = document.getElementById('cuentaTitular').value.trim();
    const tipo = document.getElementById('cuentaTipo').value;

    if (!banco || !numero || !titular) {
        showToast('Por favor completa los campos obligatorios', 'warning');
        return;
    }

    const payload = {
        banco,
        numero_cuenta: numero,
        nombre_titular: titular,
        tipo_cuenta: tipo
    };

    try {
        let error;
        if (id) {
            ({ error } = await supabaseClient.from('cuentas_bancarias').update(payload).eq('id', id));
        } else {
            ({ error } = await supabaseClient.from('cuentas_bancarias').insert([payload]));
        }

        if (error) throw error;

        showToast(id ? 'Cuenta actualizada' : 'Cuenta registrada con éxito');
        cerrarModalCuenta();
        cargarCuentasBancarias();
    } catch (e) {
        console.error('Error guardando cuenta:', e);
        showToast('Error al guardar la cuenta', 'error');
    }
}

async function editarCuenta(id) {
    try {
        const { data, error } = await supabaseClient
            .from('cuentas_bancarias')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        document.getElementById('tituloModalCuenta').textContent = '✏️ Editar Cuenta';
        document.getElementById('cuentaEditId').value = data.id;
        document.getElementById('cuentaBanco').value = data.banco;
        document.getElementById('cuentaNumero').value = data.numero_cuenta;
        document.getElementById('cuentaTitular').value = data.nombre_titular;
        document.getElementById('cuentaTipo').value = data.tipo_cuenta || 'Ahorros';

        document.getElementById('modalCuentaBancaria').style.display = 'flex';
    } catch (e) {
        console.error('Error al editar:', e);
    }
}

async function toggleEstadoCuenta(id, estadoActual) {
    try {
        const { error } = await supabaseClient
            .from('cuentas_bancarias')
            .update({ activa: !estadoActual })
            .eq('id', id);

        if (error) throw error;
        cargarCuentasBancarias();
    } catch (e) {
        console.error('Error toggle:', e);
    }
}

async function eliminarCuenta(id) {
    if (!confirm('¿Estás seguro de eliminar esta cuenta? Se perderá la trazabilidad directa si tiene pagos asociados.')) return;

    try {
        const { error } = await supabaseClient
            .from('cuentas_bancarias')
            .delete()
            .eq('id', id);

        if (error) throw error;
        showToast('Cuenta eliminada');
        cargarCuentasBancarias();
    } catch (e) {
        console.error('Error al eliminar:', e);
        showToast('No se puede eliminar la cuenta (posiblemente tiene registros asociados)', 'error');
    }
}
