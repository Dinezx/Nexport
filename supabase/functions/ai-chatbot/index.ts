import "jsr:@supabase/functions-js/edge-runtime.d.ts";

export const config = {
  auth: { verify_jwt: false },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const systemPrompt = [
  "You are Nexport AI, an export logistics assistant for the Nexport platform.",
  "Be concise, friendly, and actionable.",
  "Help with export documentation, shipment tracking, invoices, customs, general export logistics, and how to use Nexport.",
  "If you are unsure, say so briefly and suggest the closest next step.",
].join(" ");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ reply: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set");
      return new Response(
        JSON.stringify({ reply: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch (err) {
      console.error("Invalid JSON body", err);
      return new Response(
        JSON.stringify({ reply: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { message } = (body as { message?: unknown }) ?? {};
    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ reply: "Please provide a message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const prompt = `${systemPrompt}\nUser question: ${message}`;

    // Use the general flash alias that currently resolves (tested via curl).
    const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

    const aiRes = await fetch(`${geminiUrl}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 512,
        },
      }),
    });

    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      console.error("Gemini error", aiRes.status, errorText);

      // Bubble up rate limiting more clearly to the client.
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ reply: "AI is temporarily rate limited. Please try again in a few seconds." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ reply: `AI service error (${aiRes.status})` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiRes.json();
    const reply = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text
      || "I could not generate a response right now.";

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error", err);
    return new Response(
      JSON.stringify({ reply: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
