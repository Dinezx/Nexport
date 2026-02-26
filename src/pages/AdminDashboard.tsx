import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Package,
  Truck,
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

/* ---------- types ---------- */

type BookingRow = {
  id: string;
  origin: string;
  destination: string;
  status: string;
  created_at: string;
  user_id: string;
  price: number | null;
};

type ProfileRow = {
  id: string;
  role: string;
  email: string | null;
  name: string | null;
  created_at: string;
};

type ContainerRow = {
  id: string;
  provider_id: string;
  status: string;
};

/* ---------- component ---------- */

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [containers, setContainers] = useState<ContainerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---- fetch ---- */
  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [bkRes, prRes, ctrRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("profiles").select("*").limit(500),
        supabase.from("containers").select("*").limit(500),
      ]);

      if (bkRes.error) throw bkRes.error;
      if (prRes.error) throw prRes.error;
      if (ctrRes.error) throw ctrRes.error;

      setBookings((bkRes.data ?? []) as BookingRow[]);
      setProfiles((prRes.data ?? []) as ProfileRow[]);
      setContainers((ctrRes.data ?? []) as ContainerRow[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  /* ---- real-time ---- */
  useEffect(() => {
    fetchData();

    const bookingCh = supabase
      .channel("admin-bookings-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () =>
        fetchData()
      )
      .subscribe();

    const profileCh = supabase
      .channel("admin-profiles-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () =>
        fetchData()
      )
      .subscribe();

    const containerCh = supabase
      .channel("admin-containers-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "containers" }, () =>
        fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingCh);
      supabase.removeChannel(profileCh);
      supabase.removeChannel(containerCh);
    };
  }, []);

  /* ---- derived stats ---- */
  const totalUsers = profiles.length;
  const exporters = profiles.filter((p) => p.role === "exporter");
  const providers = profiles.filter((p) => p.role === "provider");
  const activeBookings = bookings.filter(
    (b) => !["completed", "delivered", "cancelled"].includes(b.status)
  );
  const completedBookings = bookings.filter((b) =>
    ["completed", "delivered"].includes(b.status)
  );
  const totalRevenue = bookings
    .filter((b) => b.status !== "cancelled" && b.price)
    .reduce((sum, b) => sum + (b.price ?? 0), 0);

  // Build recent activity from real data
  const recentActivity = bookings.slice(0, 8).map((b) => {
    const isCompleted = ["completed", "delivered"].includes(b.status);
    const isPending = b.status === "pending_payment";
    return {
      type: isCompleted ? "delivery" : isPending ? "alert" : "booking",
      message: `Booking BK-${b.id.slice(0, 8).toUpperCase()} — ${b.origin} → ${b.destination} (${b.status.replace(/_/g, " ")})`,
      time: timeAgo(b.created_at),
      icon: isCompleted ? CheckCircle2 : isPending ? AlertCircle : Package,
    };
  });

  /* ---- render ---- */
  return (
    <DashboardLayout userType="admin">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-zinc-400">System overview — live data</p>
          </div>
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
            title="Total Users"
            value={totalUsers}
            change={`${exporters.length} exporters · ${providers.length} providers`}
            changeType="positive"
            icon={Users}
          />
          <StatCard
            title="Active Bookings"
            value={activeBookings.length}
            change={`${bookings.length} total`}
            changeType="positive"
            icon={Package}
          />
          <StatCard
            title="Containers"
            value={containers.length}
            change={`${containers.filter((c) => c.status === "available").length} available`}
            changeType="positive"
            icon={Truck}
          />
          <StatCard
            title="Total Revenue"
            value={`₹${totalRevenue.toLocaleString("en-IN")}`}
            change={`${completedBookings.length} completed bookings`}
            changeType="neutral"
            icon={Activity}
          />
        </div>

        {/* Loading */}
        {loading && bookings.length === 0 && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Main Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Activity */}
          <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/80">
            <div className="p-6 border-b border-zinc-800">
              <h2 className="text-xl font-bold text-white">Recent Activity</h2>
              <p className="text-sm text-zinc-400">Latest booking events</p>
            </div>
            <div className="p-6 space-y-4">
              {recentActivity.length === 0 && !loading && (
                <p className="text-zinc-500 text-center py-8">No activity yet</p>
              )}
              {recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors"
                >
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 border ${
                      activity.type === "alert"
                        ? "bg-amber-500/10 border-amber-500/20"
                        : activity.type === "delivery"
                        ? "bg-emerald-500/10 border-emerald-500/20"
                        : "bg-primary/10 border-primary/20"
                    }`}
                  >
                    <activity.icon
                      className={`h-5 w-5 ${
                        activity.type === "alert"
                          ? "text-amber-400"
                          : activity.type === "delivery"
                          ? "text-emerald-400"
                          : "text-primary"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200">{activity.message}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-zinc-500">
                      <Clock className="h-3 w-3" />
                      {activity.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Providers */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80">
            <div className="p-6 border-b border-zinc-800">
              <h2 className="text-xl font-bold text-white">Providers</h2>
              <p className="text-sm text-zinc-400">{providers.length} registered</p>
            </div>
            <div className="p-6 space-y-4">
              {providers.length === 0 && !loading && (
                <p className="text-zinc-500 text-center py-4">No providers yet</p>
              )}
              {providers.slice(0, 6).map((provider, index) => {
                const providerContainers = containers.filter(
                  (c) => c.provider_id === provider.id
                );
                const providerBookings = bookings.filter((b) =>
                  providerContainers.some((c) => c.id === (b as any).container_id)
                );
                return (
                  <div
                    key={provider.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-zinc-500 w-6">
                        #{index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-sm text-white">
                          {provider.name || provider.email || "Provider"}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {providerContainers.length} containers · {providerBookings.length} bookings
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      {providerContainers.length} ctrs
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Bookings Table */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80">
          <div className="flex flex-row items-center justify-between p-6 border-b border-zinc-800">
            <div>
              <h2 className="text-xl font-bold text-white">Recent Bookings</h2>
              <p className="text-sm text-zinc-400">Latest booking activity across the platform</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <TrendingUp className="h-4 w-4" />
              <span>{bookings.length} total</span>
            </div>
          </div>
          <div className="p-6 space-y-3">
            {bookings.slice(0, 8).map((booking) => (
              <div
                key={booking.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-zinc-800 bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-sm text-white">
                    BK-{booking.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span className="text-sm text-zinc-400">
                    {booking.price ? `₹${booking.price.toLocaleString("en-IN")}` : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-zinc-300">
                    {booking.origin} → {booking.destination}
                  </span>
                  <Badge
                    className={
                      ["completed", "delivered"].includes(booking.status)
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : ["in_transit", "at_origin_port", "at_destination_port"].includes(
                            booking.status
                          )
                        ? "bg-primary/10 text-primary border-primary/20"
                        : booking.status === "paid"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }
                  >
                    {booking.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

/* ---------- utility ---------- */

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}