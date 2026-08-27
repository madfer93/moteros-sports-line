// ═══════════════════════════════════════════════════════════════
// MOTEROS SPORTS LINE - MOTOR CRIPTOGRÁFICO GLOBAL 2FA (TOTP / RFC 6238)
// Compatible al 100% con Google Authenticator, Microsoft Authenticator y Authy
// ═══════════════════════════════════════════════════════════════

const TOTP_AUTH = (function () {
    const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    /**
     * Genera una clave secreta aleatoria en Base32 (16 caracteres = 80 bits de entropía)
     */
    function generarSecretBase32(longitud = 16) {
        let secret = '';
        const randomValues = new Uint8Array(longitud);
        window.crypto.getRandomValues(randomValues);
        for (let i = 0; i < longitud; i++) {
            secret += BASE32_CHARS[randomValues[i] % BASE32_CHARS.length];
        }
        return secret;
    }

    /**
     * Decodifica una cadena Base32 a Uint8Array
     */
    function base32ToBytes(base32Str) {
        const cleanStr = base32Str.toUpperCase().replace(/=+$/, '').replace(/[\s-]/g, '');
        let bits = '';
        for (let i = 0; i < cleanStr.length; i++) {
            const val = BASE32_CHARS.indexOf(cleanStr[i]);
            if (val === -1) continue;
            bits += val.toString(2).padStart(5, '0');
        }
        const bytes = new Uint8Array(Math.floor(bits.length / 8));
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(bits.substr(i * 8, 8), 2);
        }
        return bytes;
    }

    /**
     * Convierte un número entero (timestamp counter) a Uint8Array de 8 bytes
     */
    function intToBytes(num) {
        const bytes = new Uint8Array(8);
        for (let i = 7; i >= 0; i--) {
            bytes[i] = num & 0xff;
            num = num >> 8;
        }
        return bytes;
    }

    /**
     * Calcula el código TOTP de 6 dígitos para un secret y un timestamp dado
     */
    async function calcularTOTP(secretBase32, tiempoMs = Date.now(), periodoSegundos = 30) {
        const pasoTiempo = Math.floor(tiempoMs / 1000 / periodoSegundos);
        const secretBytes = base32ToBytes(secretBase32);
        const counterBytes = intToBytes(pasoTiempo);

        // Importar clave para HMAC-SHA1 usando Web Crypto API nativo
        const cryptoKey = await window.crypto.subtle.importKey(
            'raw',
            secretBytes,
            { name: 'HMAC', hash: 'SHA-1' },
            false,
            ['sign']
        );

        // Firmar counter con HMAC-SHA1
        const firmaBuffer = await window.crypto.subtle.sign('HMAC', cryptoKey, counterBytes);
        const firmaBytes = new Uint8Array(firmaBuffer);

        // Truncamiento dinámico (RFC 4226 / RFC 6238)
        const offset = firmaBytes[firmaBytes.length - 1] & 0x0f;
        const binCode =
            ((firmaBytes[offset] & 0x7f) << 24) |
            ((firmaBytes[offset + 1] & 0xff) << 16) |
            ((firmaBytes[offset + 2] & 0xff) << 8) |
            (firmaBytes[offset + 3] & 0xff);

        const codigo = (binCode % 1000000).toString().padStart(6, '0');
        return codigo;
    }

    /**
     * Valida un código de 6 dígitos introducido por el usuario contra el secret
     * Tolerancia de ±1 ventana (±30 seg) para compensar desfaces de reloj en móviles
     */
    async function validarCodigoTOTP(codigoIngresado, secretBase32) {
        if (!codigoIngresado || !secretBase32) return false;
        const cleanCode = codigoIngresado.toString().trim().replace(/\s/g, '');
        if (cleanCode.length !== 6) return false;

        const ahora = Date.now();
        const ventanas = [-1, 0, 1]; // Ventana actual, anterior y siguiente

        for (const offset of ventanas) {
            const tiempoPrueba = ahora + (offset * 30 * 1000);
            const codigoGenerado = await calcularTOTP(secretBase32, tiempoPrueba);
            if (codigoGenerado === cleanCode) {
                return true;
            }
        }
        return false;
    }

    /**
     * Genera la URL para el código QR de Google Authenticator
     */
    function generarOtpAuthUrl(usuario, secretBase32, issuer = 'MoterosSportsLine') {
        const cleanUser = encodeURIComponent(usuario || 'usuario');
        const cleanIssuer = encodeURIComponent(issuer);
        return `otpauth://totp/${cleanIssuer}:${cleanUser}?secret=${secretBase32}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;
    }

    /**
     * Genera la URL de la imagen del código QR usando el servicio estándar de QR
     */
    function generarQrImageUrl(otpAuthUrl, size = 220) {
        return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(otpAuthUrl)}&margin=10`;
    }

    return {
        generarSecret: generarSecretBase32,
        calcularCodigo: calcularTOTP,
        validarCodigo: validarCodigoTOTP,
        generarOtpAuthUrl: generarOtpAuthUrl,
        generarQrImageUrl: generarQrImageUrl
    };
})();

window.TOTP_AUTH = TOTP_AUTH;
