import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Package,
  Truck,
  Clock,
  TrendingUp,
  ArrowRight,
  Sparkles,
  MapPin,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/* ---------- types ---------- */

type Booking = {
  id: string;
  origin: string;
  destination: string;
  status: string;
  transport_mode: string;
  container_type?: string;
  container_size?: string;
  booking_mode: string;
  price: number | null;
  created_at: string;
  allocated_cbm: number | null;
};

type TrackingEvent = {
  id: string;
  booking_id: string;
  status: string;
  created_at: string;
};

/* ---------- helpers ---------- */

function bookingProgress(status: string): number {
  const map: Record<string, number> = {
    pending_payment: 5,
    paid: 15,
    booking_confirmed: 20,
    picked_up: 30,
    at_origin_port: 40,
    in_transit: 60,
    at_destination_port: 75,
    customs_clearance: 85,
    out_for_delivery: 92,
    delivered: 100,
    completed: 100,
  };
  return map[status] ?? 10;
}

function normalizedStatus(
  s: string
): "pending" | "active" | "in-transit" | "delivered" | "completed" | "cancelled" {
  if (s === "pending_payment" || s === "paid") return "pending";
  if (s === "in_transit" || s === "at_origin_port" || s === "at_destination_port")
    return "in-transit";
  if (s === "delivered" || s === "completed") return "completed";
  if (s === "cancelled") return "cancelled";
  return "active";
}

/* ---------- component ---------- */

export default function ExporterDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trackingMap, setTrackingMap] = useState<Record<string, TrackingEvent[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---- fetch ---- */
  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const { data: bk, error: bkErr } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (bkErr) throw bkErr;
      const rows = (bk ?? []) as Booking[];
      setBookings(rows);

      // Fetch latest tracking event per booking
      const ids = rows.map((b) => b.id);
      if (ids.length) {
        const { data: events } = await supabase
          .from("tracking_events")
          .select("*")
          .in("booking_id", ids)
          .order("created_at", { ascending: false });

        const map: Record<string, TrackingEvent[]> = {};
        (events ?? []).forEach((e: TrackingEvent) => {
          if (!map[e.booking_id]) map[e.booking_id] = [];
          map[e.booking_id].push(e);
        });
        setTrackingMap(map);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  /* ---- real-time ---- */
  useEffect(() => {
    fetchData();

    const bookingChannel = supabase
      .channel("exporter-bookings-rt")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `user_id=eq.${user?.id}`,
        },
        () => fetchData()
      )
      .subscribe();

    const trackingChannel = supabase
      .channel("exporter-tracking-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tracking_events" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingChannel);
      supabase.removeChannel(trackingChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /* ---- derived stats ---- */
  const activeBookings = bookings.filter(
    (b) => !["completed", "delivered", "cancelled"].includes(b.status)
  );
  const completedBookings = bookings.filter((b) =>
    ["completed", "delivered"].includes(b.status)
  );
  const totalSpent = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => sum + (b.price ?? 0), 0);
  const inTransit = bookings.filter((b) =>
    ["in_transit", "at_origin_port", "at_destination_port"].includes(b.status)
  );

  /* ---- render ---- */
  return (
    <DashboardLayout userType="exporter">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-zinc-400">
              Welcome back! Here's your logistics overview.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="border-zinc-700"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              asChild
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Link to="/booking">
                New Booking
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Active Shipments"
            value={activeBookings.length}
            change={`${inTransit.length} in transit`}
            changeType={inTransit.length > 0 ? "positive" : "neutral"}
            icon={Truck}
          />
          <StatCard
            title="Total Bookings"
            value={bookings.length}
            change={`${completedBookings.length} completed`}
            changeType="positive"
            icon={Package}
          />
          <StatCard
            title="In Transit"
            value={inTransit.length}
            change="Live tracking"
            changeType="neutral"
            icon={Clock}
          />
          <StatCard
            title="Total Spent"
            value={`₹${totalSpent.toLocaleString("en-IN")}`}
            change={`${bookings.filter((b) => b.status === "paid").length} pending shipment`}
            changeType="neutral"
            icon={TrendingUp}
          />
        </div>

        {/* Loading */}
        {loading && bookings.length === 0 && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Active Bookings */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/80">
              <div className="flex flex-row items-center justify-between p-6 border-b border-zinc-800">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Active Bookings
                  </h2>
                  <p className="text-sm text-zinc-400">
                    {activeBookings.length === 0
                      ? "No active bookings"
                      : `${activeBookings.length} active shipment${activeBookings.length > 1 ? "s" : ""}`}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild className="border-zinc-700">
                  <Link to="/exporter/bookings">View All</Link>
                </Button>
              </div>

              <div className="p-6 space-y-4">
                {activeBookings.length === 0 && !loading && (
                  <p className="text-zinc-500 text-center py-8">
                    No active bookings yet. Create your first booking!
                  </p>
                )}

                {activeBookings.slice(0, 5).map((booking) => {
                  const latestEvent = trackingMap[booking.id]?.[0];
                  const displayStatus = latestEvent?.status || booking.status;
                  const progress = bookingProgress(displayStatus);

                  return (
                    <div
                      key={booking.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border border-zinc-800 bg-zinc-800/50 hover:bg-zinc-800 transition-colors cursor-pointer"
                      onClick={() => navigate(`/tracking/${booking.id}`)}
                    >
                      {/* Left */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm font-medium text-white">
                            BK-{booking.id.slice(0, 8).toUpperCase()}
                          </span>
                          <StatusBadge status={normalizedStatus(displayStatus)} />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                          <MapPin className="h-4 w-4" />
                          {booking.origin} → {booking.destination}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">
                          {booking.transport_mode?.toUpperCase()} · {booking.booking_mode}
                          {booking.allocated_cbm ? ` · ${booking.allocated_cbm} CBM` : ""}
                        </div>
                      </div>

                      {/* Right */}
                      <div className="flex flex-col sm:items-end gap-2 sm:w-44">
                        <div className="text-sm">
                          <span className="text-zinc-500">Price: </span>
                          <span className="font-medium text-white">
                            {booking.price
                              ? `₹${booking.price.toLocaleString("en-IN")}`
                              : "—"}
                          </span>
                        </div>

                        <div className="w-full">
                          <Progress value={progress} className="h-2 bg-zinc-700" />
                        </div>

                        <div className="text-xs text-zinc-500 capitalize">
                          {displayStatus.replace(/_/g, " ")}
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          className="border-zinc-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/tracking/${booking.id}`);
                          }}
                        >
                          Track
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Overview */}
          <div>
            <div className="rounded-xl border border-primary/20 bg-zinc-900/80">
              <div className="p-6 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold text-white">Quick Overview</h2>
                </div>
                <p className="text-sm text-zinc-400 mt-1">
                  Your latest activity
                </p>
              </div>

              <div className="p-6 space-y-4">
                {bookings.slice(0, 4).map((b) => (
                  <div
                    key={b.id}
                    className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 cursor-pointer hover:bg-zinc-800 transition-colors"
                    onClick={() => navigate(`/tracking/${b.id}`)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs text-zinc-400">
                        BK-{b.id.slice(0, 8).toUpperCase()}
                      </span>
                      <StatusBadge status={normalizedStatus(b.status)} />
                    </div>
                    <p className="text-sm text-white">
                      {b.origin} → {b.destination}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {b.price ? `₹${b.price.toLocaleString("en-IN")}` : "Pending"} ·{" "}
                      {new Date(b.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}

                {bookings.length === 0 && !loading && (
                  <p className="text-zinc-500 text-sm text-center py-4">
                    No bookings yet
                  </p>
                )}

                <Button asChild className="w-full" variant="outline">
                  <Link to="/exporter/bookings">View All Bookings</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
