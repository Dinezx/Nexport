export type EmailPayload = {
    to: string;
    subject: string;
    text?: string;
    html?: string;
};

// Minimal email dispatcher using an HTTP webhook (e.g., Resend/SendGrid proxy)
export async function sendEmail(payload: EmailPayload) {
    const endpoint = import.meta.env.VITE_EMAIL_WEBHOOK_URL || import.meta.env.VITE_EMAIL_WEBHOOK;
    if (!endpoint) {
        console.warn("Email webhook not configured, skipping email send");
        return null;
    }

    const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Email send failed with status ${res.status}`);
    }

    return res.json().catch(() => ({}));
}

export async function sendInvoiceEmail(exporterEmail: string, invoiceUrl: string, bookingId: string) {
    if (!exporterEmail || !invoiceUrl) return null;

    const subject = "NEXPORT Shipment Invoice";
    const text = [
        "Your shipment booking has been successfully confirmed.",
        "Please find your invoice attached.",
        `Invoice: ${invoiceUrl}`,
    ].join("\n");

    const html = `
        <p>Your shipment booking has been successfully confirmed.</p>
        <p>Please find your invoice attached.</p>
        <p><a href="${invoiceUrl}" target="_blank" rel="noreferrer">Download Invoice (Booking ${bookingId})</a></p>
    `;

    return sendEmail({ to: exporterEmail, subject, text, html });
}
