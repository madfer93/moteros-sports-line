<?php
// ═══════════════════════════════════════════════════════════════
// MOTEROS SPORT LINE - WEBHOOK TELEGRAM BOT (LEADS IA)
// Procesa los clics en los botones interactivos del Bot
// ═══════════════════════════════════════════════════════════════

header("Content-Type: application/json; charset=UTF-8");

// CARGA SEGURA DE VARIABLES DE ENTORNO
function obtenerVariableEntorno($clave, $defecto = '') {
    if (getenv($clave)) return getenv($clave);
    if (isset($_ENV[$clave])) return $_ENV[$clave];
    if (isset($_SERVER[$clave])) return $_SERVER[$clave];

    $env_file = __DIR__ . '/.env';
    if (file_exists($env_file)) {
        $lineas = file($env_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lineas as $linea) {
            if (strpos(trim($linea), '#') === 0) continue;
            $partes = explode('=', $linea, 2);
            if (count($partes) === 2 && trim($partes[0]) === $clave) {
                return trim($partes[1]);
            }
        }
    }
    return $defecto;
}

$SUPABASE_URL = obtenerVariableEntorno('SUPABASE_URL');
$SUPABASE_KEY = obtenerVariableEntorno('SUPABASE_ANON_KEY') ?: obtenerVariableEntorno('SUPABASE_SERVICE_ROLE_KEY');
$BOT_TOKEN = obtenerVariableEntorno('TELEGRAM_BOT_TOKEN');

if (empty($BOT_TOKEN) || empty($SUPABASE_URL) || empty($SUPABASE_KEY)) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Variables de entorno no configuradas"]);
    exit;
}

// Leer payload de Telegram
$input = file_get_contents("php://input");
$update = json_decode($input, true);

if (!$update) {
    echo json_encode(["status" => "ok", "message" => "Esperando actualización de Telegram"]);
    exit;
}

// Verificar si es un clic en botón (callback_query)
if (isset($update["callback_query"])) {
    $callback_query = $update["callback_query"];
    $callback_id = $callback_query["id"];
    $data = $callback_query["data"];
    $message = $callback_query["message"];
    $chat_id = $message["chat"]["id"];
    $message_id = $message["message_id"];
    $from = $callback_query["from"];
    $usuario = isset($from["first_name"]) ? $from["first_name"] : "Un asesor";
    if (isset($from["username"]) && !empty($from["username"])) {
        $usuario .= " (@" . $from["username"] . ")";
    }

    $accion_detectada = false;
    $nuevo_estado = "";
    $toast_message = "";
    $emoji_estado = "";
    $lead_id = "";

    if (strpos($data, "contactado_") === 0) {
        $lead_id = str_replace("contactado_", "", $data);
        $nuevo_estado = "contactado";
        $emoji_estado = "✅ <b>ESTADO: CONTACTADO</b>";
        $toast_message = "✅ Lead marcado como Contactado por $usuario";
        $accion_detectada = true;
    } elseif (strpos($data, "compro_") === 0) {
        $lead_id = str_replace("compro_", "", $data);
        $nuevo_estado = "compro";
        $emoji_estado = "💰 <b>ESTADO: ¡VENTA REALIZADA (COMPRÓ)! 🎉</b>";
        $toast_message = "💰 ¡Felicitaciones por la venta!";
        $accion_detectada = true;
    } elseif (strpos($data, "seguimiento_") === 0) {
        $lead_id = str_replace("seguimiento_", "", $data);
        $nuevo_estado = "en seguimiento";
        $emoji_estado = "⏳ <b>ESTADO: EN SEGUIMIENTO</b>";
        $toast_message = "⏳ Marcado en seguimiento";
        $accion_detectada = true;
    } elseif (strpos($data, "descartado_") === 0) {
        $lead_id = str_replace("descartado_", "", $data);
        $nuevo_estado = "descartado";
        $emoji_estado = "❌ <b>ESTADO: DESCARTADO / NO INTERESADO</b>";
        $toast_message = "❌ Lead descartado";
        $accion_detectada = true;
    }

    if ($accion_detectada && !empty($lead_id)) {
        // 1. ACTUALIZAR EN SUPABASE
        $payload_supabase = [
            "estado" => $nuevo_estado
        ];
        if ($nuevo_estado === "contactado") {
            $payload_supabase["fecha_contacto"] = date("c");
        } elseif ($nuevo_estado === "compro") {
            $payload_supabase["fecha_compra"] = date("c");
        }

        $ch = curl_init("$SUPABASE_URL/rest/v1/leads_ia?id=eq.$lead_id");
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PATCH");
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload_supabase));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "apikey: $SUPABASE_KEY",
            "Authorization: Bearer $SUPABASE_KEY",
            "Content-Type: application/json",
            "Prefer: return=minimal"
        ]);
        curl_exec($ch);
        curl_close($ch);

        // 2. ENVIAR TOAST A TELEGRAM (answerCallbackQuery)
        $url_answer = "https://api.telegram.org/bot$BOT_TOKEN/answerCallbackQuery";
        $post_answer = [
            "callback_query_id" => $callback_id,
            "text" => $toast_message,
            "show_alert" => false
        ];
        enviarTelegram($url_answer, $post_answer);

        // 3. EDITAR MENSAJE EN TELEGRAM PARA MOSTRAR EL ESTADO ACTUALIZADO
        $texto_original = isset($message["text"]) ? $message["text"] : "";
        // Limpiar estados previos si ya se había presionado otro botón
        $lineas = explode("\n", $texto_original);
        $lineas_limpias = [];
        foreach ($lineas as $linea) {
            if (strpos($linea, "ESTADO:") === false && strpos($linea, "Gestionado por:") === false) {
                $lineas_limpias[] = $linea;
            }
        }
        $texto_base = implode("\n", $lineas_limpias);

        $hora_actual = date("h:i A");
        $texto_final = $texto_base . "\n\n" . $emoji_estado . "\n👤 Gestionado por: " . $usuario . " (" . $hora_actual . ")";

        // Mantener teclado con opciones relevantes o actualizar
        $reply_markup = [
            "inline_keyboard" => [
                [
                    ["text" => "💰 Marcar Compró", "callback_data" => "compro_" . $lead_id],
                    ["text" => "⏳ En Seguimiento", "callback_data" => "seguimiento_" . $lead_id]
                ]
            ]
        ];

        if ($nuevo_estado === "compro" || $nuevo_estado === "descartado") {
            $reply_markup = [
                "inline_keyboard" => []
            ];
        }

        $url_edit = "https://api.telegram.org/bot$BOT_TOKEN/editMessageText";
        $post_edit = [
            "chat_id" => $chat_id,
            "message_id" => $message_id,
            "text" => $texto_final,
            "parse_mode" => "HTML",
            "reply_markup" => $reply_markup
        ];
        enviarTelegram($url_edit, $post_edit);
    }
}

function enviarTelegram($url, $data) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
    $res = curl_exec($ch);
    curl_close($ch);
    return $res;
}

echo json_encode(["status" => "success"]);
?>
