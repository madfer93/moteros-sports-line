// @ts-nocheck
// ═══════════════════════════════════════════════════════════════
// SUPABASE EDGE FUNCTION: telegram-webhook
// Maneja los clics de los botones de Telegram para Leads IA
// ═══════════════════════════════════════════════════════════════

// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

declare const Deno: any;

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "8720299330:AAHV-sAB-ilICJhm1gRvI5VX0TYU3EgfbAk";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://pbblthbrdkevuyjxyuar.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request) => {
  // Manejar CORS si es necesario
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const update = await req.json();

    if (!update || !update.callback_query) {
      return new Response(JSON.stringify({ status: "ignored", message: "No callback_query" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const callback = update.callback_query;
    const callbackId = callback.id;
    const data = callback.data || "";
    const message = callback.message;
    const chatId = message.chat.id;
    const messageId = message.message_id;
    const fromUser = callback.from;

    let usuario = fromUser.first_name || "Un asesor";
    if (fromUser.username) {
      usuario += ` (@${fromUser.username})`;
    }

    let nuevoEstado = "";
    let toastMessage = "";
    let emojiEstado = "";
    let leadId = "";

    if (data.startsWith("contactado_")) {
      leadId = data.replace("contactado_", "");
      nuevoEstado = "contactado";
      emojiEstado = "✅ <b>ESTADO: CONTACTADO</b>";
      toastMessage = `✅ Lead marcado como Contactado por ${usuario}`;
    } else if (data.startsWith("compro_")) {
      leadId = data.replace("compro_", "");
      nuevoEstado = "compro";
      emojiEstado = "💰 <b>ESTADO: ¡VENTA REALIZADA (COMPRÓ)! 🎉</b>";
      toastMessage = "💰 ¡Felicitaciones por la venta!";
    } else if (data.startsWith("seguimiento_")) {
      leadId = data.replace("seguimiento_", "");
      nuevoEstado = "en seguimiento";
      emojiEstado = "⏳ <b>ESTADO: EN SEGUIMIENTO</b>";
      toastMessage = "⏳ Marcado en seguimiento";
    } else if (data.startsWith("descartado_")) {
      leadId = data.replace("descartado_", "");
      nuevoEstado = "descartado";
      emojiEstado = "❌ <b>ESTADO: DESCARTADO / NO INTERESADO</b>";
      toastMessage = "❌ Lead descartado";
    }

    if (nuevoEstado && leadId) {
      // 1. ACTUALIZAR EN SUPABASE
      const updatePayload: Record<string, any> = {
        estado: nuevoEstado,
        asesor: usuario,
      };

      if (nuevoEstado === "contactado") {
        updatePayload.fecha_contacto = new Date().toISOString();
      } else if (nuevoEstado === "compro") {
        updatePayload.fecha_compra = new Date().toISOString();
      }

      await supabase
        .from("leads_ia")
        .update(updatePayload)
        .eq("id", leadId);

      // 2. ENVIAR TOAST A TELEGRAM (answerCallbackQuery)
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackId,
          text: toastMessage,
          show_alert: false,
        }),
      });

      // 3. EDITAR EL MENSAJE EN TELEGRAM
      const textoOriginal = message.text || "";
      const lineas = textoOriginal.split("\n");
      const lineasLimpias = lineas.filter(
        (l: string) => !l.includes("ESTADO:") && !l.includes("Gestionado por:")
      );
      const textoBase = lineasLimpias.join("\n");

      const horaActual = new Date().toLocaleTimeString("es-CO", {
        timeZone: "America/Bogota",
        hour: "2-digit",
        minute: "2-digit",
      });

      const textoFinal = `${textoBase}\n\n${emojiEstado}\n👤 Gestionado por: ${usuario} (${horaActual})`;

      // Botones que quedarán activos
      let replyMarkup: any = {
        inline_keyboard: [
          [
            { text: "💰 Marcar Compró", callback_data: `compro_${leadId}` },
            { text: "⏳ En Seguimiento", callback_data: `seguimiento_${leadId}` },
          ],
        ],
      };

      if (nuevoEstado === "compro" || nuevoEstado === "descartado") {
        replyMarkup = { inline_keyboard: [] };
      }

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: textoFinal,
          parse_mode: "HTML",
          reply_markup: replyMarkup,
        }),
      });
    }

    return new Response(JSON.stringify({ status: "success" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error en telegram-webhook:", error);
    return new Response(JSON.stringify({ status: "error", error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
