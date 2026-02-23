// @ts-ignore - Deno handles remote imports at runtime
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

declare const Deno: any;
declare const Request: any;
declare const Response: any;
declare const fetch: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  const apiKey = Deno?.env?.get?.("OPENAI_API_KEY") || null;
  if (!apiKey) return jsonResponse({ error: "OpenAI API key not configured" }, 500);

  try {
    const body = await req.json().catch(() => ({}));
    const { origin, destination, transport, booking_mode, cbm } = body;

    if (!origin || !destination || !transport) {
      return jsonResponse({ error: "Missing required fields: origin, destination, transport" }, 400);
    }

    const prompt = `You are a logistics ETA prediction system.\n\nRoute: ${origin} to ${destination}\nTransport: ${transport}\nMode: ${booking_mode || "N/A"}\nCBM: ${cbm || "N/A"}\n\nReturn ONLY JSON in this format:\n{\n  \"eta_days\": number,\n  \"confidence\": \"high | medium | low\",\n  \"reason\": \"short explanation\"\n}`;

    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You predict shipment ETA." },
            { role: "user", content: prompt },
          ],
        }),
      });
    } catch (err) {
      return jsonResponse({ error: "Failed to reach OpenAI API", message: (err as Error).message }, 502);
    }

    if (!res.ok) {
      const details = await res.text().catch(() => "");
      return jsonResponse({ error: `OpenAI API error: ${res.statusText}`, details }, res.status);
    }

    const data = await res.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return jsonResponse({ error: "No response from OpenAI" }, 502);

    // Try to parse JSON from assistant; if it's a string containing JSON, return as-is.
    try {
      const parsed = JSON.parse(content);
      return jsonResponse(parsed, 200);
    } catch (e) {
      // If parsing fails, return the raw content as JSON string
      return jsonResponse({ reply: content }, 200);
    }
  } catch (e) {
    return jsonResponse({ error: "ETA prediction failed" }, 500);
  }
});
