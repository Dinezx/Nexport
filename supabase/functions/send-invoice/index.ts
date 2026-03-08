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
        let exporterName = body.exporter_name as string | undefined;
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
            .select("id, exporter_id, price, currency, origin, destination, transport_mode, cargo_type, cargo_weight, container_number, allocated_cbm, booking_date, status")
            .eq("id", orderId)
            .maybeSingle();

        const { data: payment } = await supabase
            .from("payments")
            .select("amount, currency, transaction_ref, payment_method, created_at")
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
                .select("name, company")
                .eq("id", booking.exporter_id)
                .maybeSingle();

            if (!companyName && (profile?.company || profile?.name)) {
                companyName = profile.company || profile.name || undefined;
            }
            if (!exporterName && profile?.name) {
                exporterName = profile.name;
            }
        }

        if (!exporterEmail) {
            return jsonResponse({ error: "Exporter email missing" }, 400);
        }

        const invoiceDate = new Date();
        const bookingDetails = {
            origin: booking?.origin ?? "N/A",
            destination: booking?.destination ?? "N/A",
            transportMode: booking?.transport_mode ?? "N/A",
            cargoType: booking?.cargo_type ?? "N/A",
            cargoWeight: booking?.cargo_weight ?? null,
            containerNumber: booking?.container_number ?? "N/A",
            allocatedCbm: booking?.allocated_cbm ?? null,
            bookingDate: booking?.booking_date ?? null,
            transactionRef: payment?.transaction_ref ?? "N/A",
            paymentMethod: payment?.payment_method ?? "Online",
            paymentDate: payment?.created_at ?? null,
        };

        const { pdfBytes, invoiceId } = await generateInvoicePdf({
            orderId,
            exporterEmail,
            exporterName,
            companyName,
            amount,
            currency,
            invoiceDate,
            ...bookingDetails,
        });

        // Convert PDF to base64 for email attachment
        const pdfBase64 = uint8ArrayToBase64(pdfBytes);

        // Try to upload to storage (non-fatal if bucket missing)
        let pdfUrl: string | null = null;
        try {
            // Ensure bucket exists
            const { error: bucketErr } = await supabase.storage.createBucket("invoices", { public: false });
            if (bucketErr && !bucketErr.message?.includes("already exists")) {
                console.warn("Bucket creation warning:", bucketErr.message);
            }

            const uploadPath = `invoices/${invoiceId}.pdf`;
            const blob = new Blob([pdfBytes], { type: "application/pdf" });
            const uploadRes = await supabase.storage
                .from("invoices")
                .upload(uploadPath, blob, { contentType: "application/pdf", upsert: true });

            if (!uploadRes.error) {
                const { data: signed } = await supabase.storage
                    .from("invoices")
                    .createSignedUrl(uploadPath, 60 * 60 * 24 * 7);
                pdfUrl = signed?.signedUrl ?? null;
            } else {
                console.warn("Storage upload failed (non-fatal):", uploadRes.error.message);
            }
        } catch (storageErr) {
            console.warn("Storage error (non-fatal):", storageErr);
        }

        // Try to save invoice record (non-fatal)
        try {
            await supabase.from("invoices").insert({
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
        } catch (dbErr) {
            console.warn("Invoice DB insert failed (non-fatal):", dbErr);
        }

        // Send email with PDF attached directly
        let emailError: string | null = null;
        try {
            await sendInvoiceEmail({
                resendApiKey,
                exporterEmail,
                exporterName,
                companyName,
                orderId,
                pdfUrl,
                pdfBase64,
                invoiceId,
                amount,
                currency,
                invoiceDate,
                ...bookingDetails,
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
    exporterName?: string;
    companyName?: string;
    amount: number;
    currency: string;
    invoiceDate: Date;
    origin: string;
    destination: string;
    transportMode: string;
    cargoType: string;
    cargoWeight: number | null;
    containerNumber: string;
    allocatedCbm: number | null;
    bookingDate: string | null;
    transactionRef: string;
    paymentMethod: string;
    paymentDate: string | null;
}) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const invoiceId = crypto.randomUUID();

    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const fmtDate = (d: Date) => `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;

    const blue = rgb(0.12, 0.34, 0.82);
    const black = rgb(0, 0, 0);
    const gray = rgb(0.4, 0.4, 0.4);

    let y = 790;
    const drawLine = (label: string, value: string, indent = 40) => {
        page.drawText(label, { x: indent, y, size: 10, font, color: gray });
        page.drawText(value, { x: 250, y, size: 10, font, color: black });
        y -= 18;
    };

    // Header
    page.drawText("NEXPORT", { x: 40, y, size: 24, font: fontBold, color: blue });
    page.drawText("INVOICE", { x: 430, y, size: 20, font: fontBold, color: blue });
    y -= 15;

    // Divider line
    page.drawRectangle({ x: 40, y, width: 515, height: 1, color: blue });
    y -= 25;

    // Invoice meta
    drawLine("Invoice ID:", invoiceId);
    drawLine("Invoice Date:", fmtDate(params.invoiceDate));
    drawLine("Booking ID:", `BK-${params.orderId.slice(0, 8).toUpperCase()}`);
    y -= 10;

    // Bill To section
    page.drawText("BILL TO", { x: 40, y, size: 12, font: fontBold, color: blue });
    y -= 20;
    if (params.companyName) drawLine("Company:", params.companyName);
    if (params.exporterName) drawLine("Name:", params.exporterName);
    drawLine("Email:", params.exporterEmail);
    y -= 10;

    // Shipment Details section
    page.drawText("SHIPMENT DETAILS", { x: 40, y, size: 12, font: fontBold, color: blue });
    y -= 20;
    if (params.bookingDate) drawLine("Booking Date:", params.bookingDate);
    drawLine("Origin:", params.origin);
    drawLine("Destination:", params.destination);
    drawLine("Transport Mode:", params.transportMode.toUpperCase());
    drawLine("Cargo Type:", params.cargoType);
    if (params.cargoWeight) drawLine("Cargo Weight:", `${params.cargoWeight} KG`);
    if (params.containerNumber !== "N/A") drawLine("Container:", params.containerNumber);
    if (params.allocatedCbm) drawLine("Allocated Space:", `${params.allocatedCbm} CBM`);
    y -= 10;

    // Payment Details section
    page.drawText("PAYMENT DETAILS", { x: 40, y, size: 12, font: fontBold, color: blue });
    y -= 20;
    drawLine("Transaction Ref:", params.transactionRef);
    drawLine("Payment Method:", params.paymentMethod);
    if (params.paymentDate) {
        drawLine("Payment Date:", fmtDate(new Date(params.paymentDate)));
    }
    y -= 10;

    // Total Amount box
    page.drawRectangle({ x: 40, y: y - 5, width: 515, height: 35, color: rgb(0.95, 0.95, 1) });
    page.drawText("TOTAL AMOUNT:", { x: 50, y: y + 5, size: 13, font: fontBold, color: blue });
    const amtStr = params.currency === "INR"
        ? `Rs. ${params.amount.toFixed(2)}`
        : `${params.amount.toFixed(2)} ${params.currency}`;
    page.drawText(amtStr, { x: 350, y: y + 5, size: 14, font: fontBold, color: black });
    y -= 50;

    // Footer
    page.drawRectangle({ x: 40, y, width: 515, height: 1, color: gray });
    y -= 18;
    page.drawText("Thank you for shipping with Nexport!", { x: 40, y, size: 10, font, color: gray });
    y -= 15;
    page.drawText("This is a computer-generated invoice. No signature required.", { x: 40, y, size: 8, font, color: gray });

    const pdfBytes = await pdfDoc.save();
    return { pdfBytes, invoiceId };
}

async function sendInvoiceEmail(params: {
    resendApiKey: string;
    exporterEmail: string;
    exporterName?: string;
    companyName?: string;
    orderId: string;
    pdfUrl: string | null;
    pdfBase64: string;
    invoiceId: string;
    amount: number;
    currency: string;
    invoiceDate: Date;
    origin: string;
    destination: string;
    transportMode: string;
    cargoType: string;
    cargoWeight: number | null;
    containerNumber: string;
    allocatedCbm: number | null;
    bookingDate: string | null;
    transactionRef: string;
    paymentMethod: string;
    paymentDate: string | null;
}) {
    const amtStr = params.currency === "INR"
        ? `₹ ${params.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
        : `${params.amount.toFixed(2)} ${params.currency}`;

    const greeting = params.exporterName || params.companyName || "Exporter";

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1e56d0; padding: 20px 30px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">NEXPORT</h1>
        <p style="color: #ccc; margin: 5px 0 0; font-size: 13px;">Invoice Confirmation</p>
      </div>

      <div style="padding: 25px 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 15px;">Hi <b>${greeting}</b>,</p>
        <p>Your payment has been successfully processed. Here are your details:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr style="background: #f7f7f7;">
            <td style="padding: 10px; font-weight: bold; border: 1px solid #e0e0e0;" colspan="2">Booking Details</td>
          </tr>
          <tr><td style="padding: 8px; border: 1px solid #e0e0e0; color: #666;">Booking ID</td>
              <td style="padding: 8px; border: 1px solid #e0e0e0;"><b>BK-${params.orderId.slice(0, 8).toUpperCase()}</b></td></tr>
          ${params.bookingDate ? `<tr><td style="padding: 8px; border: 1px solid #e0e0e0; color: #666;">Booking Date</td>
              <td style="padding: 8px; border: 1px solid #e0e0e0;">${params.bookingDate}</td></tr>` : ""}
          <tr><td style="padding: 8px; border: 1px solid #e0e0e0; color: #666;">Route</td>
              <td style="padding: 8px; border: 1px solid #e0e0e0;">${params.origin} → ${params.destination}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e0e0e0; color: #666;">Transport</td>
              <td style="padding: 8px; border: 1px solid #e0e0e0;">${params.transportMode.toUpperCase()}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e0e0e0; color: #666;">Cargo Type</td>
              <td style="padding: 8px; border: 1px solid #e0e0e0;">${params.cargoType}</td></tr>
          ${params.cargoWeight ? `<tr><td style="padding: 8px; border: 1px solid #e0e0e0; color: #666;">Weight</td>
              <td style="padding: 8px; border: 1px solid #e0e0e0;">${params.cargoWeight} KG</td></tr>` : ""}
          ${params.containerNumber !== "N/A" ? `<tr><td style="padding: 8px; border: 1px solid #e0e0e0; color: #666;">Container</td>
              <td style="padding: 8px; border: 1px solid #e0e0e0;">${params.containerNumber}</td></tr>` : ""}
          ${params.allocatedCbm ? `<tr><td style="padding: 8px; border: 1px solid #e0e0e0; color: #666;">Allocated Space</td>
              <td style="padding: 8px; border: 1px solid #e0e0e0;">${params.allocatedCbm} CBM</td></tr>` : ""}
        </table>

        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr style="background: #f7f7f7;">
            <td style="padding: 10px; font-weight: bold; border: 1px solid #e0e0e0;" colspan="2">Payment Details</td>
          </tr>
          <tr><td style="padding: 8px; border: 1px solid #e0e0e0; color: #666;">Transaction Ref</td>
              <td style="padding: 8px; border: 1px solid #e0e0e0;">${params.transactionRef}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e0e0e0; color: #666;">Payment Method</td>
              <td style="padding: 8px; border: 1px solid #e0e0e0;">${params.paymentMethod}</td></tr>
          ${params.paymentDate ? `<tr><td style="padding: 8px; border: 1px solid #e0e0e0; color: #666;">Payment Date</td>
              <td style="padding: 8px; border: 1px solid #e0e0e0;">${new Date(params.paymentDate).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</td></tr>` : ""}
          <tr style="background: #eef0ff;">
            <td style="padding: 12px; border: 1px solid #e0e0e0; font-weight: bold; font-size: 15px;">Total Amount</td>
            <td style="padding: 12px; border: 1px solid #e0e0e0; font-weight: bold; font-size: 16px; color: #1e56d0;">${amtStr}</td>
          </tr>
        </table>

        ${params.pdfUrl ? `<div style="text-align: center; margin: 20px 0;">
          <a href="${params.pdfUrl}" style="display: inline-block; background: #1e56d0; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Download Invoice PDF</a>
        </div>` : `<p style="text-align: center; color: #1e56d0; font-weight: bold;">Invoice PDF is attached to this email.</p>`}

        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
        <p style="color: #888; font-size: 12px; text-align: center;">Thank you for shipping with Nexport!</p>
        <p style="color: #aaa; font-size: 11px; text-align: center;">This is an automated email. Please do not reply.</p>
      </div>
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
            subject: `Nexport Invoice - BK-${params.orderId.slice(0, 8).toUpperCase()}`,
            html,
            attachments: [
                {
                    filename: `nexport-invoice-${params.invoiceId.slice(0, 8)}.pdf`,
                    content: params.pdfBase64,
                },
            ],
        }),
    });

    if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Email send failed: ${res.status} ${detail}`);
    }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function jsonResponse(data: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}
