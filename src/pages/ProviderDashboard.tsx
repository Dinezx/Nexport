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
} from "lucide-react";
import { Link } from "react-router-dom";

const shipments = [
  {
    id: "SHP-2024-001",
    bookingId: "BK-2024-001",
    route: "Shanghai → Rotterdam",
    status: "in-transit" as const,
    currentLocation: "Indian Ocean",
    eta: "Jan 25, 2026",
    timeline: [
      { label: "Picked up", completed: true, date: "Jan 10" },
      { label: "In transit", completed: true, date: "Jan 12" },
      { label: "Customs", completed: false, date: "Jan 23" },
      { label: "Delivered", completed: false, date: "Jan 25" },
    ],
  },
  {
    id: "SHP-2024-002",
    bookingId: "BK-2024-002",
    route: "Mumbai → Hamburg",
    status: "pending" as const,
    currentLocation: "Mumbai Port",
    eta: "Feb 02, 2026",
    timeline: [
      { label: "Picked up", completed: true, date: "Jan 15" },
      { label: "In transit", completed: false, date: "Jan 18" },
      { label: "Customs", completed: false, date: "Jan 30" },
      { label: "Delivered", completed: false, date: "Feb 02" },
    ],
  },
  {
    id: "SHP-2024-003",
    bookingId: "BK-2024-003",
    route: "Los Angeles → Tokyo",
    status: "active" as const,
    currentLocation: "Loading at Port",
    eta: "Jan 20, 2026",
    timeline: [
      { label: "Picked up", completed: true, date: "Jan 08" },
      { label: "In transit", completed: false, date: "Jan 12" },
      { label: "Customs", completed: false, date: "Jan 18" },
      { label: "Delivered", completed: false, date: "Jan 20" },
    ],
  },
];

export default function ProviderDashboard() {
  return (
    <DashboardLayout userType="provider">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Provider Dashboard</h1>
            <p className="text-zinc-400">Manage and update your shipments.</p>
          </div>
          <div className="flex gap-3">
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

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Active Shipments"
            value={24}
            change="+3 this week"
            changeType="positive"
            icon={Truck}
          />
          <StatCard
            title="Pending Pickups"
            value={6}
            change="Due today: 2"
            changeType="neutral"
            icon={Package}
          />
          <StatCard
            title="On-time Delivery"
            value="94%"
            change="+2% from last month"
            changeType="positive"
            icon={Clock}
          />
          <StatCard
            title="Revenue (MTD)"
            value="$48.2K"
            change="+18% growth"
            changeType="positive"
            icon={DollarSign}
          />
        </div>

        {/* Shipments List */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80">
          <div className="p-6 border-b border-zinc-800">
            <h2 className="text-xl font-bold text-white">Active Shipments</h2>
            <p className="text-sm text-zinc-400">Update status and track deliveries</p>
          </div>
          <div className="p-6 space-y-6">
            {shipments.map((shipment) => (
              <div
                key={shipment.id}
                className="p-6 rounded-xl border border-zinc-800 bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                  {/* Shipment Info */}
                  <div className="flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-sm font-bold text-white">{shipment.id}</span>
                      <StatusBadge status={shipment.status} />
                      <span className="text-xs text-zinc-500">
                        Booking: {shipment.bookingId}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-6 text-sm">
                      <div className="flex items-center gap-2 text-zinc-300">
                        <MapPin className="h-4 w-4 text-zinc-500" />
                        <span>{shipment.route}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-300">
                        <Truck className="h-4 w-4 text-zinc-500" />
                        <span>{shipment.currentLocation}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-300">
                        <Calendar className="h-4 w-4 text-zinc-500" />
                        <span>ETA: {shipment.eta}</span>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="flex items-center gap-2 pt-2">
                      {shipment.timeline.map((step, index) => (
                        <div key={step.label} className="flex items-center">
                          <div className="flex flex-col items-center">
                            <div
                              className={`h-3 w-3 rounded-full ${
                                step.completed
                                  ? "bg-primary"
                                  : "bg-zinc-700 border-2 border-zinc-600"
                              }`}
                            />
                            <span className="text-xs text-zinc-500 mt-1 whitespace-nowrap">
                              {step.label}
                            </span>
                          </div>
                          {index < shipment.timeline.length - 1 && (
                            <div
                              className={`h-0.5 w-8 sm:w-16 mx-1 ${
                                step.completed ? "bg-primary" : "bg-zinc-700"
                              }`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-row lg:flex-col gap-2">
                    <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      Update Status
                    </Button>
                    <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
                      Details
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}