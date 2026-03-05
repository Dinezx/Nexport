import { supabase } from "@/lib/supabase";

export type ProviderScore = {
    score: number;
    band: "Excellent" | "Good" | "Watch";
    breakdown: {
        completionRate: number;
        delayRate: number;
        rating: number;
        disputeRate: number;
    };
    sampleSize: number;
};

function clampScore(score: number) {
    return Math.max(1, Math.min(100, Math.round(score)));
}

export async function calculateProviderScore(providerId: string): Promise<ProviderScore> {
    const { data: containers } = await supabase
        .from("containers")
        .select("id")
        .eq("provider_id", providerId);

    const containerIds = (containers || []).map((c) => c.id);

    const { data: bookings } = containerIds.length
        ? await supabase
            .from("bookings")
            .select("id, status, price, delay_reason")
            .in("container_id", containerIds)
        : { data: [] as any[] };

    const { data: reviews } = await supabase
        .from("provider_reviews")
        .select("rating")
        .eq("provider_id", providerId);

    const total = bookings?.length || 0;
    const completed = bookings?.filter((b) => ["completed", "delivered"].includes(b.status)).length || 0;
    const delayed = bookings?.filter((b) => (b.delay_reason || "").length > 0 || b.status === "delayed").length || 0;
    const cancelled = bookings?.filter((b) => b.status === "cancelled").length || 0;

    const completionRate = total > 0 ? completed / total : 0;
    const delayRate = total > 0 ? delayed / total : 0;
    const disputeRate = total > 0 ? cancelled / total : 0;
    const avgRating = reviews && reviews.length > 0
        ? reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length
        : 4; // assume healthy default if no reviews yet

    const ratingScore = Math.min(1, avgRating / 5);

    const composite =
        completionRate * 0.4 +
        (1 - delayRate) * 0.25 +
        ratingScore * 0.3 +
        (1 - disputeRate) * 0.05;

    const score = clampScore(composite * 100);
    const band: ProviderScore["band"] = score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Watch";

    return {
        score,
        band,
        breakdown: {
            completionRate: Math.round(completionRate * 100),
            delayRate: Math.round(delayRate * 100),
            rating: Number(avgRating.toFixed(1)),
            disputeRate: Math.round(disputeRate * 100),
        },
        sampleSize: total,
    };
}
