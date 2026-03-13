import { answerShipmentQuestion } from "@/services/aiShipmentContext";

export type DocumentationAnswer = {
    intent: "documents" | "invoice" | "coo" | "general";
    title: string;
    steps: string[];
    tips: string[];
    relatedDocs: string[];
};

const knowledgeBase: Record<string, DocumentationAnswer> = {
    spices: {
        intent: "documents",
        title: "Exporting Spices",
        steps: [
            "Prepare commercial invoice, packing list, and purchase order",
            "Obtain FSSAI/FDA food safety certificate for the batch",
            "Get phytosanitary certificate from the plant quarantine department",
            "Arrange certificate of origin from chamber of commerce",
            "File shipping bill on ICEGATE with HS codes and exporter details",
        ],
        tips: [
            "Include moisture and cleanliness declarations on the invoice",
            "Match net/gross weight on packing list to container seal records",
        ],
        relatedDocs: ["Commercial Invoice", "Packing List", "Phytosanitary Certificate", "Certificate of Origin"],
    },
    invoice: {
        intent: "invoice",
        title: "Generate Commercial Invoice",
        steps: [
            "Use exporter and buyer legal names with full addresses",
            "Add HS codes, quantity, unit price, currency, and Incoterms",
            "Reference purchase order and booking/BL number",
            "Include payment terms and bank details (IBAN/SWIFT)",
            "Sign and stamp the invoice; export as PDF",
        ],
        tips: [
            "Mirror line items with the packing list to avoid customs holds",
            "Use Incoterms 2020 (e.g., FOB, CIF) and show freight/insurance split where relevant",
        ],
        relatedDocs: ["Packing List", "Booking Confirmation", "Insurance Certificate"],
    },
    coo: {
        intent: "coo",
        title: "Apply for Certificate of Origin",
        steps: [
            "Collect commercial invoice, packing list, and manufacturing proof",
            "Register on the designated chamber/FTA portal (e.g., DGFT e-COO)",
            "Submit HS codes and origin criteria (wholly obtained/substantial transformation)",
            "Upload supporting documents and pay applicable fee",
            "Download digitally signed COO or collect stamped hard copy",
        ],
        tips: [
            "Ensure HS codes match invoice and shipping bill",
            "For FTA benefits, attach supplier declarations and production records",
        ],
        relatedDocs: ["Commercial Invoice", "Packing List", "Shipping Bill"],
    },
};

function matchIntent(question: string) {
    const q = question.toLowerCase();
    if (q.includes("spice")) return "spices" as const;
    if (q.includes("invoice")) return "invoice" as const;
    if (q.includes("certificate of origin") || q.includes("coo")) return "coo" as const;
    return null;
}

export async function answerDocumentationQuestion(question: string, context?: { bookingId?: string; userId?: string }) {
    const key = matchIntent(question);
    const base = key ? knowledgeBase[key] : knowledgeBase.invoice;

    let shipmentContext: string | null = null;
    if (context?.bookingId || context?.userId) {
        try {
            const ctx = await answerShipmentQuestion(question, {
                bookingId: context.bookingId,
                userId: context.userId,
            });
            shipmentContext = ctx.contextSummary;
        } catch {
            shipmentContext = null;
        }
    }

    return {
        question,
        ...base,
        shipmentContext,
    };
}
