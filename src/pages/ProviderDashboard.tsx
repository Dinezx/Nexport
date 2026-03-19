import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  Gauge,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { calculateProviderScore } from "@/services/providerScore";
import { predictContainerDemand } from "@/ml/demandPredictor";
import { isSupabaseReachable } from "@/lib/offlineAuth";

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
  if (["pending_payment", "paid", "payment_completed", "booked"].includes(s)) return "pending";
  if (["in_transit", "at_origin_port", "at_destination_port", "loaded_on_vessel", "container_allocated", "cargo_received"].includes(s))
    return "in-transit";
  if (["arrived_destination", "delivered", "completed"].includes(s)) return "completed";
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
  const [providerScore, setProviderScore] = useState<{ score: number; band: string } | null>(null);
  const [demandPrediction, setDemandPrediction] = useState<{ level: string; route: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [profileName, setProfileName] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;

      const online = await isSupabaseReachable(import.meta.env.VITE_SUPABASE_URL!);
      if (online) {
        const { data } = await supabase
          .from("profiles")
          .select("name, company")
          .eq("id", user.id)
          .maybeSingle();

        if (data?.name || data?.company) {
          setProfileName(data?.name ?? "");
          setCompanyName(data?.company ?? "");
          return;
        }
      }

      const storageKey = user?.id ? `nexport.settings.${user.id}` : "";
      if (storageKey) {
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw) as { profile?: { contactName?: string; companyName?: string } };
            setProfileName(parsed.profile?.contactName ?? "");
            setCompanyName(parsed.profile?.companyName ?? "");
          }
        } catch {
          setProfileName("");
          setCompanyName("");
        }
      }
    };

    loadProfile();
  }, [user?.id]);

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
      let bkRows: BookingRow[] = [];
      if (ctrIds.length) {
        const { data: bk, error: bkErr } = await supabase
          .from("bookings")
          .select("*")
          .in("container_id", ctrIds)
          .order("created_at", { ascending: false });

        if (bkErr) throw bkErr;
        bkRows = (bk ?? []) as BookingRow[];
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
        } else {
          setTrackingMap({});
        }
      } else {
        setBookings([]);
        setTrackingMap({});
      }

      // Provider score
      if (user?.id) {
        try {
          const score = await calculateProviderScore(user.id);
          setProviderScore({ score: score.score, band: score.band });
        } catch (err) {
          console.warn("Provider score unavailable", err);
        }
      }

      // Demand prediction for the most recent lane
      const laneRoute = bkRows[0]
        ? `${bkRows[0].origin} -> ${bkRows[0].destination}`
        : ctrRows[0]?.current_location
        ? `${ctrRows[0].current_location} -> ${ctrRows[0].current_location}`
        : "Chennai -> Singapore";

      try {
        const demand = await predictContainerDemand(laneRoute, new Date().getMonth() + 1);
        setDemandPrediction({ level: demand.level, route: laneRoute });
      } catch (err) {
        console.warn("Demand prediction unavailable", err);
      }

      setLastUpdated(new Date());
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
  const activeShipments = bookings.filter((b) => !["completed", "delivered", "cancelled"].includes(b.status)).length;
  const pendingPayouts = bookings.filter((b) => (b as any).payout_status === "pending").length;
  const totalCapacity = containers.reduce((sum, c) => sum + (c.total_space_cbm ?? 0), 0);
  const availableCapacity = containers.reduce((sum, c) => sum + (c.available_space_cbm ?? 0), 0);
  const usedCapacity = Math.max(0, totalCapacity - availableCapacity);
  const utilization = totalCapacity > 0 ? Math.round((usedCapacity / totalCapacity) * 100) : 0;

  const scoreBadgeVariant = providerScore?.band?.toLowerCase().includes("excellent")
    ? "success"
    : providerScore?.band?.toLowerCase().includes("good")
    ? "info"
    : "pending";
  const demandBadgeVariant = demandPrediction?.level?.toLowerCase().includes("high")
    ? "warning"
    : demandPrediction?.level?.toLowerCase().includes("medium")
    ? "info"
    : "pending";

  /* ---- render ---- */
  return (
    <DashboardLayout userType="provider">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Provider Dashboard</h1>
            <p className="text-muted-foreground">Manage your containers and shipments — live data.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
            <div className="flex items-center gap-3 rounded-full border border-border bg-card px-3 py-1.5 shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                {user?.role ? user.role.slice(0, 1).toUpperCase() : "P"}
              </div>
              <div className="text-left">
                <p className="text-xs text-muted-foreground">Signed in as</p>
                <p className="text-sm font-medium text-foreground">
                  {profileName || companyName || (user?.id ? `ID ${user.id.slice(0, 6)}` : "Provider")}
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="border-border">
                <Link to="/profile">Profile</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Overview */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Overview</h2>
            <span className="text-xs text-muted-foreground">
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Updating..."}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <StatCard
            title="Active Shipments"
            value={activeBookings.length}
            change={`${pendingPickups.length} pending pickup`}
            changeType={pendingPickups.length > 0 ? "neutral" : "positive"}
            icon={Truck}
            variant="default"
            className="animate-fade-in-up opacity-0"
            style={{ animationDelay: "0ms" }}
          />
          <StatCard
            title="My Containers"
            value={containers.length}
            change={`${containers.filter((c) => c.status === "available").length} available`}
            changeType="positive"
            icon={Package}
            variant="default"
            className="animate-fade-in-up opacity-0"
            style={{ animationDelay: "100ms" }}
          />
          <StatCard
            title="Completed Shipments"
            value={completedBookings.length}
            change={`${bookings.length} total bookings`}
            changeType="positive"
            icon={CheckCircle2}
            variant="default"
            className="animate-fade-in-up opacity-0"
            style={{ animationDelay: "150ms" }}
          />
          <StatCard
            title="Completion Rate"
            value={`${onTimeRate}%`}
            change={`${completedBookings.length} delivered`}
            changeType="positive"
            icon={Clock}
            variant="default"
            className="animate-fade-in-up opacity-0"
            style={{ animationDelay: "200ms" }}
          />
          <StatCard
            title="Revenue"
            value={`₹${totalRevenue.toLocaleString("en-IN")}`}
            change={`${bookings.length} total bookings`}
            changeType="positive"
            icon={DollarSign}
            variant="default"
            className="animate-fade-in-up opacity-0"
            style={{ animationDelay: "300ms" }}
          />
          <StatCard
            title="Pending Payouts"
            value={pendingPayouts}
            change={`${activeShipments} active shipments`}
            changeType={pendingPayouts > 0 ? "neutral" : "positive"}
            icon={RefreshCw}
            variant="default"
            className="animate-fade-in-up opacity-0"
            style={{ animationDelay: "350ms" }}
          />
          </div>
        </section>

        {/* Loading */}
        {loading && bookings.length === 0 && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Shipments List */}
          <div className="lg:col-span-2">
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
                        <div className="flex-1 min-w-0 space-y-4">
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
                        <div className="flex flex-row lg:flex-col gap-2 lg:items-end lg:min-w-[140px] self-start">
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

          {/* Insights */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Operational Insights</CardTitle>
                  <Gauge className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Capacity Utilization</span>
                    <span className="font-medium text-foreground">{utilization}%</span>
                  </div>
                  <Progress value={utilization} className="h-2 bg-muted" />
                  <p className="text-xs text-muted-foreground">
                    {usedCapacity.toFixed(1)} / {totalCapacity.toFixed(1)} CBM used
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Provider Score</p>
                    <p className="text-xs text-muted-foreground">Performance band</p>
                  </div>
                  <Badge variant={scoreBadgeVariant}>
                    {providerScore ? providerScore.band : "Scoring"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Demand Signal</p>
                    <p className="text-xs text-muted-foreground">
                      {demandPrediction ? demandPrediction.route : "Route insight"}
                    </p>
                  </div>
                  <Badge variant={demandBadgeVariant}>
                    {demandPrediction ? demandPrediction.level : "Waiting"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Upcoming Pickups</CardTitle>
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {pendingPickups.length === 0 && (
                  <p className="text-sm text-muted-foreground">No pickups waiting for confirmation.</p>
                )}
                {pendingPickups.slice(0, 3).map((booking) => (
                  <div key={booking.id} className="rounded-lg border border-border bg-muted/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">
                        BK-{booking.id.slice(0, 8).toUpperCase()}
                      </span>
                      <StatusBadge status="pending" />
                    </div>
                    <p className="text-sm text-foreground mt-1">
                      {booking.origin} → {booking.destination}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(booking.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}

                <Button asChild variant="outline" className="w-full border-border">
                  <Link to="/provider/bookings">Review Bookings</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}