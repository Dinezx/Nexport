export const config = { auth: { verify_jwt: false } };
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { to, subject, text, html } = await req.json();

        if (!to || !subject || (!text && !html)) {
            return json({ error: "Missing required fields: to, subject, (text or html)" }, 400);
        }

        const resendApiKey = Deno.env.get("RESEND_API_KEY");

        if (!resendApiKey) {
            return json({ error: "RESEND_API_KEY not configured" }, 500);
        }

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: "Nexport <onboarding@resend.dev>",
                to,
                subject,
                text,
                html,
            }),
        });

        if (!res.ok) {
            const detail = await res.text();
            return json({ error: detail || `Email send failed: ${res.status}` }, res.status);
        }

        const data = await res.json().catch(() => ({}));
        return json({ success: true, data });
    } catch (err) {
        console.error("email-webhook error", err);
        return json({ error: err?.message ?? "Unexpected error" }, 500);
    }
});

function json(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}
