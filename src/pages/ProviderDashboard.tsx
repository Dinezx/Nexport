import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Package,
  Truck,
  Clock,
  DollarSign,
  MapPin,
  Calendar,
  ChevronRight,
  Container,
  MessageSquare,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/* ---------- types ---------- */

type ContainerRow = {
  id: string;
  container_number: string | null;
  type: string;
  size: string;
  total_space_cbm: number;
  available_space_cbm: number;
  status: string;
  current_location: string;
};

type BookingRow = {
  id: string;
  origin: string;
  destination: string;
  status: string;
  transport_mode: string;
  booking_mode: string;
  price: number | null;
  created_at: string;
  container_id: string;
  user_id: string;
};

type TrackingEvent = {
  id: string;
  booking_id: string;
  status: string;
  location: string | null;
  created_at: string;
};

/* ---------- helpers ---------- */

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

export default function ProviderDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [containers, setContainers] = useState<ContainerRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [trackingMap, setTrackingMap] = useState<Record<string, TrackingEvent[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---- fetch ---- */
  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch provider's containers
      const { data: ctrs, error: ctrErr } = await supabase
        .from("containers")
        .select("*")
        .eq("provider_id", user.id);

      if (ctrErr) throw ctrErr;
      const ctrRows = (ctrs ?? []) as ContainerRow[];
      setContainers(ctrRows);

      // Fetch bookings for provider's containers
      const ctrIds = ctrRows.map((c) => c.id);
      if (ctrIds.length) {
        const { data: bk, error: bkErr } = await supabase
          .from("bookings")
          .select("*")
          .in("container_id", ctrIds)
          .order("created_at", { ascending: false });

        if (bkErr) throw bkErr;
        const bkRows = (bk ?? []) as BookingRow[];
        setBookings(bkRows);

        // Fetch tracking events
        const bkIds = bkRows.map((b) => b.id);
        if (bkIds.length) {
          const { data: events } = await supabase
            .from("tracking_events")
            .select("*")
            .in("booking_id", bkIds)
            .order("created_at", { ascending: false });

          const map: Record<string, TrackingEvent[]> = {};
          (events ?? []).forEach((e: TrackingEvent) => {
            if (!map[e.booking_id]) map[e.booking_id] = [];
            map[e.booking_id].push(e);
          });
          setTrackingMap(map);
        }
      } else {
        setBookings([]);
        setTrackingMap({});
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  /* ---- real-time ---- */
  useEffect(() => {
    fetchData();

    const containerChannel = supabase
      .channel("provider-containers-rt")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "containers",
          filter: `provider_id=eq.${user?.id}`,
        },
        () => fetchData()
      )
      .subscribe();

    const bookingChannel = supabase
      .channel("provider-bookings-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => fetchData()
      )
      .subscribe();

    const trackingChannel = supabase
      .channel("provider-tracking-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tracking_events" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(containerChannel);
      supabase.removeChannel(bookingChannel);
      supabase.removeChannel(trackingChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /* ---- derived stats ---- */
  const activeBookings = bookings.filter(
    (b) => !["completed", "delivered", "cancelled"].includes(b.status)
  );
  const pendingPickups = bookings.filter((b) =>
    ["paid", "booking_confirmed"].includes(b.status)
  );
  const completedBookings = bookings.filter((b) =>
    ["completed", "delivered"].includes(b.status)
  );
  const onTimeRate =
    bookings.length > 0
      ? Math.round((completedBookings.length / bookings.length) * 100)
      : 0;
  const totalRevenue = bookings
    .filter((b) => b.status !== "cancelled" && b.price)
    .reduce((sum, b) => sum + (b.price ?? 0), 0);

  /* ---- render ---- */
  return (
    <DashboardLayout userType="provider">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Provider Dashboard</h1>
            <p className="text-muted-foreground">Manage your containers and shipments — live data.</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="border-border"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button asChild variant="outline">
              <Link to="/chat">
                <MessageSquare className="mr-2 h-4 w-4" />
                Messages
              </Link>
            </Button>
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link to="/provider-containers">
                <Container className="mr-2 h-4 w-4" />
                Manage Containers
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
            change={`${pendingPickups.length} pending pickup`}
            changeType={pendingPickups.length > 0 ? "neutral" : "positive"}
            icon={Truck}
          />
          <StatCard
            title="My Containers"
            value={containers.length}
            change={`${containers.filter((c) => c.status === "available").length} available`}
            changeType="positive"
            icon={Package}
          />
          <StatCard
            title="Completion Rate"
            value={`${onTimeRate}%`}
            change={`${completedBookings.length} delivered`}
            changeType="positive"
            icon={Clock}
          />
          <StatCard
            title="Revenue"
            value={`₹${totalRevenue.toLocaleString("en-IN")}`}
            change={`${bookings.length} total bookings`}
            changeType="positive"
            icon={DollarSign}
          />
        </div>

        {/* Loading */}
        {loading && bookings.length === 0 && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Shipments List */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h2 className="text-xl font-bold text-card-foreground">Active Shipments</h2>
              <p className="text-sm text-muted-foreground">
                {activeBookings.length === 0
                  ? "No active shipments"
                  : `${activeBookings.length} shipment${activeBookings.length > 1 ? "s" : ""} in progress`}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild className="border-border">
              <Link to="/provider/bookings">View All</Link>
            </Button>
          </div>
          <div className="p-6 space-y-6">
            {activeBookings.length === 0 && !loading && (
              <p className="text-muted-foreground text-center py-8">
                No active shipments yet.
              </p>
            )}

            {activeBookings.slice(0, 6).map((booking) => {
              const events = trackingMap[booking.id] ?? [];
              const latestEvent = events[0];
              const displayStatus = latestEvent?.status || booking.status;

              return (
                <div
                  key={booking.id}
                  className="p-6 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    {/* Shipment Info */}
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-sm font-bold text-foreground">
                          BK-{booking.id.slice(0, 8).toUpperCase()}
                        </span>
                        <StatusBadge status={normalizedStatus(displayStatus)} />
                        <span className="text-xs text-muted-foreground capitalize">
                          {displayStatus.replace(/_/g, " ")}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-6 text-sm">
                        <div className="flex items-center gap-2 text-foreground/80">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{booking.origin} → {booking.destination}</span>
                        </div>
                        <div className="flex items-center gap-2 text-foreground/80">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          <span>{booking.transport_mode?.toUpperCase()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-foreground/80">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{new Date(booking.created_at).toLocaleDateString()}</span>
                        </div>
                        {booking.price && (
                          <div className="flex items-center gap-2 text-foreground/80">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span>₹{booking.price.toLocaleString("en-IN")}</span>
                          </div>
                        )}
                      </div>

                      {/* Tracking timeline */}
                      {events.length > 0 && (
                        <div className="flex items-center gap-2 pt-2 overflow-x-auto">
                          {events
                            .slice()
                            .reverse()
                            .slice(0, 5)
                            .map((ev, i, arr) => (
                              <div key={ev.id} className="flex items-center">
                                <div className="flex flex-col items-center">
                                  <div
                                    className={`h-3 w-3 rounded-full ${
                                      i === arr.length - 1
                                        ? "bg-primary"
                                        : "bg-emerald-500"
                                    }`}
                                  />
                                  <span className="text-xs text-muted-foreground mt-1 whitespace-nowrap capitalize">
                                    {ev.status.replace(/_/g, " ")}
                                  </span>
                                </div>
                                {i < arr.length - 1 && (
                                  <div className="h-0.5 w-8 sm:w-12 mx-1 bg-emerald-500" />
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-row lg:flex-col gap-2">
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={() => navigate(`/provider/tracking/${booking.id}`)}
                      >
                        Update Status
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() => navigate(`/tracking/${booking.id}`)}
                      >
                        Details
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}