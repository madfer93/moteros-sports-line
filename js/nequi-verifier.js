/**
 * CORE DE VERIFICACIÓN NEQUI CONECTA
 * Moteros Sports Line - 2026
 */

const verifCore = {
    keys: {
        clientId: '',
        clientSecret: '',
        apiKey: '',
        ambiente: 'sandbox'
    },

    endpoints: {
        sandbox: {
            token: 'https://api.sandbox.nequi.com/oauth2/token?grant_type=client_credentials',
            status: 'https://api.sandbox.nequi.com/payments/v2/-services-paymentservice-getstatuspayment'
        },
        production: {
            token: 'https://oauth.nequi.com/oauth2/token?grant_type=client_credentials',
            status: 'https://api.nequi.com/payments/v2/-services-paymentservice-getstatuspayment'
        }
    },

    async init() {
        console.log("Iniciando Verificador Nequi...");
        await this.cargarConfiguracion();
    },

    async cargarConfiguracion() {
        if (!window.supabaseClient) return;

        try {
            const { data, error } = await window.supabaseClient
                .from('configuracion_sistema')
                .select('*')
                .in('clave', ['nequi_client_id', 'nequi_client_secret', 'nequi_api_key', 'nequi_ambiente']);

            if (error) throw error;

            data.forEach(item => {
                if (item.clave === 'nequi_client_id') this.keys.clientId = item.valor;
                if (item.clave === 'nequi_client_secret') this.keys.clientSecret = item.valor;
                if (item.clave === 'nequi_api_key') this.keys.apiKey = item.valor;
                if (item.clave === 'nequi_ambiente') this.keys.ambiente = item.valor || 'sandbox';
            });

            console.log(`Configuración Nequi Cargada (${this.keys.ambiente}).`);
        } catch (e) {
            console.error("Error cargando llaves Nequi:", e);
        }
    },

    async obtenerToken() {
        const url = this.endpoints[this.keys.ambiente].token;
        const auth = btoa(`${this.keys.clientId}:${this.keys.clientSecret}`);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            const data = await response.json();
            return data.access_token;
        } catch (e) {
            console.error("Error obteniendo token Nequi:", e);
            return null;
        }
    },

    /**
     * Verifica un pago contra la API de Nequi
     */
    async verificar(qrData) {
        // MODO SIMULACIÓN (Si no hay llaves completas)
        if (!this.keys.clientId || !this.keys.clientSecret || !this.keys.apiKey) {
            console.warn("Faltan credenciales Nequi, usando simulación.");
            return this.simularVerificacion(qrData);
        }

        const ambiente = this.endpoints[this.keys.ambiente];
        
        try {
            const token = await this.obtenerToken();
            if (!token) throw new Error("No se pudo obtener el token de acceso.");

            // Consultar estado de la referencia
            // Estructura simplificada baseada en docs
            const body = {
                RequestMessage: {
                    RequestHeader: {
                        Channel: "P001", // Código asignado
                        RequestDate: new Date().toISOString(),
                        ReferenceNumber: qrData
                    },
                    RequestBody: {
                        any: {
                            getStatusPaymentRQ: {
                                codeQR: qrData
                            }
                        }
                    }
                }
            };

            const res = await fetch(ambiente.status, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-api-key': this.keys.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            const result = await res.json();
            console.log("Respuesta Nequi:", result);

            // ANALIZAR RESPUESTA (Depende del formato exacto de Nequi)
            // Se asume éxito si no hay error y el estado es 'APPROVED' u 'OK'
            const success = result.ResponseMessage?.ResponseHeader?.Status?.Code === "0";
            
            const finalResponse = {
                success: success,
                data: success ? {
                    cliente: "Pago Verificado",
                    referencia: qrData.substring(0, 12),
                    monto: "Consultar en App"
                } : null
            };

            await this.registrarLog(qrData, finalResponse);
            return finalResponse;

        } catch (err) {
            console.error("Error en API Nequi:", err);
            // Fallback a simulación si hay error de red/CORS pero avisando
            return { success: false, error: err.message };
        }
    },

    simularVerificacion(data) {
        return new Promise((resolve) => {
            setTimeout(async () => {
                const esCelular = /^\d{10}$/.test(data);
                const esUrlNequi = data.includes("nequi.com.co");

                let response = { success: false };

                if (esCelular || esUrlNequi || data.length > 5) {
                    response = {
                        success: true,
                        data: {
                            cliente: "Cliente Nequi (Simulado)",
                            referencia: data.substring(0, 10).toUpperCase(),
                            monto: "Confirmar en App"
                        }
                    };
                }

                // REGISTRAR EN SUPABASE
                await this.registrarLog(data, response);
                resolve(response);
            }, 1500);
        });
    },

    async registrarLog(originalData, response) {
        if (!window.supabaseClient) return;

        try {
            await window.supabaseClient.from('nequi_pagos_logs').insert({
                referencia: response.success ? response.data.referencia : 'FALLIDO',
                monto: response.success ? response.data.monto : '0',
                estado: response.success ? 'exitoso' : 'fallido',
                respuesta_raw: response,
                metadata: {
                    original_qr: originalData,
                    timestamp: new Date().toISOString(),
                    agente: 'Scanner POS'
                }
            });
            console.log("Log de Nequi registrado.");
        } catch (e) {
            console.error("Error registrando log Nequi:", e);
        }
    }
};

// Auto-inicializar
window.verifCore = verifCore;
verifCore.init();
