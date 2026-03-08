import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

export const config = {
    auth: { verify_jwt: false },
};

const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json().catch(() => null);
        if (!body) return jsonResponse({ error: "Invalid JSON payload" }, 400);

        const orderId = body.order_id as string | undefined;
        let exporterEmail = body.exporter_email as string | undefined;
        let companyName = body.company_name as string | undefined;
        const amountInput = body.amount as number | string | undefined;
        let currency = (body.currency as string | undefined) ?? "USD";

        if (!orderId) return jsonResponse({ error: "order_id is required" }, 400);
        if (!exporterEmail) return jsonResponse({ error: "exporter_email is required" }, 400);

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const resendApiKey = Deno.env.get("RESEND_API_KEY");

        if (!supabaseUrl || !serviceRoleKey) {
            return jsonResponse({ error: "Supabase environment is not configured" }, 500);
        }
        if (!resendApiKey) {
            return jsonResponse({ error: "RESEND_API_KEY is missing" }, 500);
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: booking } = await supabase
            .from("bookings")
            .select("id, exporter_id, price, currency")
            .eq("id", orderId)
            .maybeSingle();

        const { data: payment } = await supabase
            .from("payments")
            .select("amount, currency, transaction_ref, created_at")
            .eq("booking_id", orderId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        let amount = parseAmount(amountInput ?? payment?.amount ?? booking?.price ?? 0);
        if (payment?.currency && !body.currency) currency = payment.currency;
        if (booking?.currency && !body.currency && !payment?.currency) currency = booking.currency;

        if (booking?.exporter_id) {
            const { data: profile } = await supabase
                .from("profiles")
                .select("full_name, company_name, email")
                .eq("id", booking.exporter_id)
                .maybeSingle();

            if (!exporterEmail && profile?.email) exporterEmail = profile.email;
            if (!companyName && (profile?.company_name || profile?.full_name)) {
                companyName = profile.company_name ?? profile.full_name ?? undefined;
            }
        }

        if (!exporterEmail) {
            return jsonResponse({ error: "Exporter email missing" }, 400);
        }

        const invoiceDate = new Date();
        const { pdfBytes, invoiceId } = await generateInvoicePdf({
            orderId,
            exporterEmail,
            companyName,
            amount,
            currency,
            invoiceDate,
        });

        const uploadPath = `invoices/${invoiceId}.pdf`;
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const uploadRes = await supabase.storage
            .from("invoices")
            .upload(uploadPath, blob, {
                contentType: "application/pdf",
                upsert: true,
            });

        if (uploadRes.error) {
            throw new Error(`Storage upload failed: ${uploadRes.error.message}`);
        }

        const { data: signed, error: signedErr } = await supabase.storage
            .from("invoices")
            .createSignedUrl(uploadPath, 60 * 60 * 24 * 7); // 7 days

        if (signedErr || !signed?.signedUrl) {
            throw new Error(`Signed URL creation failed: ${signedErr?.message ?? "no url"}`);
        }

        const pdfUrl = signed.signedUrl;

        const { error: insertErr } = await supabase.from("invoices").insert({
            id: invoiceId,
            order_id: orderId,
            exporter_email: exporterEmail,
            company_name: companyName,
            amount,
            currency,
            invoice_date: invoiceDate.toISOString(),
            status: "sent",
            pdf_url: pdfUrl,
        });

        if (insertErr) {
            throw new Error(`Invoice insert failed: ${insertErr.message}`);
        }

        let emailError: string | null = null;
        try {
            await sendInvoiceEmail({
                resendApiKey,
                exporterEmail,
                companyName,
                orderId,
                pdfUrl,
                amount,
                currency,
                invoiceDate,
            });
        } catch (err) {
            console.error("Email send failed", err);
            emailError = err?.message ?? "Email failed";
        }

        return jsonResponse({ success: true, invoice_id: invoiceId, pdf_url: pdfUrl, email_error: emailError }, emailError ? 207 : 200);
    } catch (error) {
        console.error("send-invoice error", error);
        return jsonResponse({ error: error?.message ?? "Unexpected error" }, 500);
    }
});

function parseAmount(value: number | string | null | undefined): number {
    if (value === null || typeof value === "undefined") return 0;
    const num = typeof value === "string" ? Number(value) : value;
    return Number.isFinite(num) ? Number(num.toFixed(2)) : 0;
}

async function generateInvoicePdf(params: {
    orderId: string;
    exporterEmail: string;
    companyName?: string;
    amount: number;
    currency: string;
    invoiceDate: Date;
}) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    page.drawText("Nexport", { x: 40, y: 790, size: 22, font, color: rgb(0.12, 0.34, 0.82) });
    page.drawText("Invoice", { x: 40, y: 760, size: 16, font });

    const invoiceId = crypto.randomUUID();
    const lines = [
        `Invoice ID: ${invoiceId}`,
        `Order ID: ${params.orderId}`,
        params.companyName ? `Company: ${params.companyName}` : null,
        `Exporter Email: ${params.exporterEmail}`,
        `Amount: ${params.amount.toFixed(2)} ${params.currency}`,
        `Invoice Date: ${params.invoiceDate.toISOString()}`,
    ].filter(Boolean) as string[];

    lines.forEach((line, idx) => {
        page.drawText(line, { x: 40, y: 720 - idx * 20, size: 12, font });
    });

    const pdfBytes = await pdfDoc.save();
    return { pdfBytes, invoiceId };
}

async function sendInvoiceEmail(params: {
    resendApiKey: string;
    exporterEmail: string;
    companyName?: string;
    orderId: string;
    pdfUrl: string;
    amount: number;
    currency: string;
    invoiceDate: Date;
}) {
    const html = `
    <div style="font-family: Arial, sans-serif;">
      <h2>Your Nexport Invoice</h2>
      <p>Hi ${params.companyName ?? "Exporter"},</p>
      <p>Your payment was successful. You can download your invoice here:</p>
      <p><a href="${params.pdfUrl}">Download Invoice</a></p>
      <p>Order ID: ${params.orderId}</p>
      <p>Amount Paid: ${params.amount.toFixed(2)} ${params.currency}</p>
      <p>Date: ${params.invoiceDate.toISOString()}</p>
      <p>Thank you for shipping with Nexport.</p>
    </div>
  `;

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${params.resendApiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: "Nexport <onboarding@resend.dev>",
            to: params.exporterEmail,
            subject: "Your Nexport Invoice",
            html,
        }),
    });

    if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Email send failed: ${res.status} ${detail}`);
    }
}

function jsonResponse(data: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}
