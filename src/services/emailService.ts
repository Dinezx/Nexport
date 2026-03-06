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
