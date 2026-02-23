import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Package, 
  Truck, 
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock
} from "lucide-react";

const recentActivity = [
  {
    type: "booking",
    message: "New booking BK-2024-156 created by TradeX Corp",
    time: "2 minutes ago",
    icon: Package,
  },
  {
    type: "user",
    message: "New provider registered: FastShip Logistics",
    time: "15 minutes ago",
    icon: Truck,
  },
  {
    type: "delivery",
    message: "Shipment BK-2024-142 delivered successfully",
    time: "1 hour ago",
    icon: CheckCircle2,
  },
  {
    type: "alert",
    message: "Delay reported for shipment BK-2024-138",
    time: "2 hours ago",
    icon: AlertCircle,
  },
  {
    type: "user",
    message: "New trader registered: Global Imports Inc",
    time: "3 hours ago",
    icon: Users,
  },
];

const topProviders = [
  { name: "Global Freight Co.", bookings: 45, rating: 4.9 },
  { name: "Pacific Logistics", bookings: 38, rating: 4.8 },
  { name: "Express Cargo", bookings: 32, rating: 4.7 },
  { name: "FastShip Logistics", bookings: 28, rating: 4.6 },
];

const recentBookings = [
  { id: "BK-2024-156", trader: "TradeX Corp", route: "Shanghai → LA", status: "pending" },
  { id: "BK-2024-155", trader: "Import Masters", route: "Mumbai → Hamburg", status: "active" },
  { id: "BK-2024-154", trader: "Global Trade Co", route: "Tokyo → Seattle", status: "in-transit" },
  { id: "BK-2024-153", trader: "WorldWide Inc", route: "Rotterdam → NYC", status: "completed" },
];

export default function AdminDashboard() {
  return (
    <DashboardLayout userType="admin">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-zinc-400">System overview and management</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Users"
            value="2,847"
            change="+124 this month"
            changeType="positive"
            icon={Users}
          />
          <StatCard
            title="Active Bookings"
            value="486"
            change="+18% from last week"
            changeType="positive"
            icon={Package}
          />
          <StatCard
            title="Active Providers"
            value="156"
            change="+8 new providers"
            changeType="positive"
            icon={Truck}
          />
          <StatCard
            title="System Health"
            value="99.9%"
            change="All systems operational"
            changeType="neutral"
            icon={Activity}
          />
        </div>

        {/* Main Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Activity */}
          <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/80">
            <div className="p-6 border-b border-zinc-800">
              <h2 className="text-xl font-bold text-white">Recent Activity</h2>
              <p className="text-sm text-zinc-400">Latest system events and updates</p>
            </div>
            <div className="p-6 space-y-4">
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
              <h2 className="text-xl font-bold text-white">Top Providers</h2>
              <p className="text-sm text-zinc-400">By booking volume this month</p>
            </div>
            <div className="p-6 space-y-4">
              {topProviders.map((provider, index) => (
                <div
                  key={provider.name}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-zinc-500 w-6">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-sm text-white">{provider.name}</p>
                      <p className="text-xs text-zinc-500">
                        {provider.bookings} bookings
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-primary/20">★ {provider.rating}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Bookings Table */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80">
          <div className="flex flex-row items-center justify-between p-6 border-b border-zinc-800">
            <div>
              <h2 className="text-xl font-bold text-white">Recent Bookings</h2>
              <p className="text-sm text-zinc-400">Latest booking activity</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <TrendingUp className="h-4 w-4" />
              <span>+12% this week</span>
            </div>
          </div>
          <div className="p-6 space-y-3">
            {recentBookings.map((booking) => (
              <div
                key={booking.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-zinc-800 bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-sm text-white">{booking.id}</span>
                  <span className="text-sm text-zinc-400">{booking.trader}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-zinc-300">{booking.route}</span>
                  <Badge
                    className={
                      booking.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : booking.status === "in-transit"
                        ? "bg-primary/10 text-primary border-primary/20"
                        : booking.status === "active"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }
                  >
                    {booking.status}
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