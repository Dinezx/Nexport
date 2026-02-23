// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const config = {
  auth: { verify_jwt: false },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message, bookingId, conversationId } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ reply: "Invalid message" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const hfToken = Deno.env.get("HF_API_TOKEN");
    const hfModel = Deno.env.get("HF_MODEL");
    if (!hfToken || !hfModel) {
      console.error("HF_API_TOKEN or HF_MODEL not configured");
      return new Response(
        JSON.stringify({ reply: "AI service not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let bookingDescription = "No specific booking details are available.";
    let trackingDescription = "No tracking events are available.";

    if (bookingId) {
      const { data: booking } = await supabase
        .from("bookings")
        .select("origin, destination, transport_mode, booking_mode, eta_days")
        .eq("id", bookingId)
        .maybeSingle();

      if (booking) {
        bookingDescription = `Booking details: Shipment from ${booking.origin} to ${booking.destination}. Transport: ${booking.transport_mode}. Mode: ${booking.booking_mode}. ETA: ${booking.eta_days ?? "Not available"} days.`;
      }

      const { data: latestTracking } = await supabase
        .from("tracking_events")
        .select("title, description, status, location, created_at")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestTracking) {
        trackingDescription = `Latest tracking update: ${latestTracking.title} - ${latestTracking.description}. Status: ${latestTracking.status}. Location: ${latestTracking.location}.`; 
      }
    }

    // Build chat history so AI behaves like a real chatbot
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      {
        role: "system",
        content:
          "You are NEXPORT AI, a helpful logistics assistant for exporters and providers. Answer clearly, in a friendly tone, and keep replies concise (2-5 short paragraphs or bullet points). If you don't know something, say so honestly and never guess specific shipment data.",
      },
      {
        role: "system",
        content: bookingDescription,
      },
      {
        role: "system",
        content: trackingDescription,
      },
    ];

    if (conversationId) {
      const { data: pastMessages } = await supabase
        .from("messages")
        .select("sender_role, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(20);

      if (pastMessages) {
        for (const msg of pastMessages) {
          const role =
            msg.sender_role === "ai"
              ? "assistant"
              : msg.sender_role === "system"
              ? "system"
              : "user";
          messages.push({ role, content: msg.content });
        }
      }
    }

    // Ensure the latest user question is at the end
    messages.push({ role: "user", content: message });

    // Convert chat messages into a single prompt string for text-generation models
    const prompt =
      messages
        .map((m) => {
          if (m.role === "system") return `System: ${m.content}`;
          if (m.role === "assistant") return `Assistant: ${m.content}`;
          return `User: ${m.content}`;
        })
        .join("\n") + "\nAssistant:";

    const hfRes = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 256,
          temperature: 0.7,
        },
      }),
    });

    if (!hfRes.ok) {
      const errText = await hfRes.text();
      console.error("Hugging Face error:", hfRes.status, errText);
      return new Response(
        JSON.stringify({ reply: "AI service error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await hfRes.json();
    // HF text-generation typically returns an array with generated_text
    let reply = "";
    if (Array.isArray(data) && data.length > 0 && data[0].generated_text) {
      const full = String(data[0].generated_text);
      reply = full.startsWith(prompt) ? full.slice(prompt.length).trim() : full.trim();
    } else if (typeof data === "object" && data !== null && "generated_text" in data) {
      const full = String((data as any).generated_text);
      reply = full.startsWith(prompt) ? full.slice(prompt.length).trim() : full.trim();
    } else {
      reply = "AI service returned an unexpected response";
    }

    if (conversationId) {
      const { data: conversation } = await supabase
        .from("conversations")
        .select("exporter_id")
        .eq("id", conversationId)
        .maybeSingle();

      if (conversation?.exporter_id) {
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: conversation.exporter_id,
          sender_role: "ai",
          content: reply,
        });
      }
    }

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ reply: "AI service error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
