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
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

/* ------------------ MOCK DATA (TEMP) ------------------ */

const activeBookings = [
  {
    id: "BK-2024-001",
    route: "Shanghai → Rotterdam",
    status: "in-transit" as const,
    eta: "Jan 25, 2026",
    progress: 65,
    containerType: "40ft HC",
  },
  {
    id: "BK-2024-002",
    route: "Mumbai → Hamburg",
    status: "pending" as const,
    eta: "Feb 02, 2026",
    progress: 15,
    containerType: "20ft Standard",
  },
  {
    id: "BK-2024-003",
    route: "Los Angeles → Tokyo",
    status: "active" as const,
    eta: "Jan 20, 2026",
    progress: 35,
    containerType: "40ft Standard",
  },
];

const aiInsights = [
  {
    title: "Optimal Shipping Window",
    description:
      "Book your next Shanghai shipment between Feb 5-10 for 12% lower rates.",
    icon: TrendingUp,
  },
  {
    title: "Container Recommendation",
    description:
      "Based on your cargo volume, a 40ft HC would be 8% more cost-effective.",
    icon: Package,
  },
];

/* ------------------ COMPONENT ------------------ */

export default function ExporterDashboard() {
  const navigate = useNavigate();

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

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Active Shipments"
            value={8}
            change="+2 this week"
            changeType="positive"
            icon={Truck}
          />
          <StatCard
            title="Total Bookings"
            value={156}
            change="+12% from last month"
            changeType="positive"
            icon={Package}
          />
          <StatCard
            title="Avg. Transit Time"
            value="18 days"
            change="-2 days improvement"
            changeType="positive"
            icon={Clock}
          />
          <StatCard
            title="Cost Savings"
            value="$12.4K"
            change="This quarter"
            changeType="neutral"
            icon={TrendingUp}
          />
        </div>

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
                    Track your current shipments
                  </p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {activeBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border border-zinc-800 bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                  >
                    {/* Left */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm font-medium text-white">
                          {booking.id}
                        </span>
                        <StatusBadge status={booking.status} />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <MapPin className="h-4 w-4" />
                        {booking.route}
                      </div>
                    </div>

                    {/* Right */}
                    <div className="flex flex-col sm:items-end gap-2 sm:w-44">
                      <div className="text-sm">
                        <span className="text-zinc-500">ETA: </span>
                        <span className="font-medium text-white">
                          {booking.eta}
                        </span>
                      </div>

                      <div className="w-full">
                        <Progress
                          value={booking.progress}
                          className="h-2 bg-zinc-700"
                        />
                      </div>

                      <div className="text-xs text-zinc-500">
                        {booking.containerType}
                      </div>

                      {/* ✅ TRACK BUTTON */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          navigate(`/tracking/${booking.id}`)
                        }
                      >
                        Track
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI Insights */}
          <div>
            <div className="rounded-xl border border-primary/20 bg-zinc-900/80">
              <div className="p-6 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold text-white">
                    AI Insights
                  </h2>
                </div>
                <p className="text-sm text-zinc-400 mt-1">
                  Smart recommendations for you
                </p>
              </div>

              <div className="p-6 space-y-4">
                {aiInsights.map((insight, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <insight.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-white">
                          {insight.title}
                        </h4>
                        <p className="text-xs text-zinc-400 mt-1">
                          {insight.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
