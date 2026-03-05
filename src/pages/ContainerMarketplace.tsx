import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Filter, MapPin, Ship, Gauge, CalendarDays } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const CONTAINER_TYPES = ["normal", "dry", "reefer"] as const;
const TRANSPORT_MODES = ["sea", "road", "air"] as const;

type MarketplaceContainer = {
  id: string;
  container_number: string | null;
  container_type: string;
  container_size: string;
  total_space_cbm: number;
  available_space_cbm: number;
  origin: string;
  destination?: string | null;
  transport_mode: string;
  departure_date?: string | null;
  status: string;
  provider_id?: string | null;
};

export default function ContainerMarketplace() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    origin: "",
    destination: "",
    containerType: "",
    transportMode: "",
    minAvailableCbm: "",
    departureDate: "",
  });
  const [loading, setLoading] = useState(false);
  const [containers, setContainers] = useState<MarketplaceContainer[]>([]);
  const [error, setError] = useState<string | null>(null);

  const role = useMemo(() => user?.role || "exporter", [user?.role]);

  const fetchContainers = async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase.from("containers").select("*").neq("status", "full");

      if (filters.origin) query = query.ilike("origin", `%${filters.origin}%`);
      if (filters.destination) query = query.ilike("destination", `%${filters.destination}%`);
      if (filters.containerType) query = query.eq("container_type", filters.containerType);
      if (filters.transportMode) query = query.eq("transport_mode", filters.transportMode);
      if (filters.minAvailableCbm) query = query.gte("available_space_cbm", Number(filters.minAvailableCbm));
      if (filters.departureDate) query = query.gte("departure_date", filters.departureDate);

      const { data, error: qError } = await query.order("created_at", { ascending: false }).limit(100);
      if (qError) throw qError;
      setContainers((data || []) as MarketplaceContainer[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load containers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DashboardLayout userType={role as any}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Container Marketplace</h1>
            <p className="text-muted-foreground">Browse available capacity from providers and filter by route, type, and departure.</p>
          </div>
          <Button variant="outline" onClick={fetchContainers} disabled={loading} className="border-border">
            <Filter className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Find the right container by route and capacity.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Origin</label>
              <Input
                placeholder="e.g. Chennai Port"
                value={filters.origin}
                onChange={(e) => setFilters({ ...filters, origin: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Destination</label>
              <Input
                placeholder="e.g. Singapore Port"
                value={filters.destination}
                onChange={(e) => setFilters({ ...filters, destination: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Container Type</label>
              <Select
                value={filters.containerType}
                onValueChange={(value) => setFilters({ ...filters, containerType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  {CONTAINER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Transport</label>
              <Select
                value={filters.transportMode}
                onValueChange={(value) => setFilters({ ...filters, transportMode: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  {TRANSPORT_MODES.map((t) => (
                    <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Min Available CBM</label>
              <Input
                type="number"
                min={0}
                placeholder="10"
                value={filters.minAvailableCbm}
                onChange={(e) => setFilters({ ...filters, minAvailableCbm: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Departure After</label>
              <Input
                type="date"
                value={filters.departureDate}
                onChange={(e) => setFilters({ ...filters, departureDate: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex gap-3">
              <Button onClick={fetchContainers} disabled={loading} className="bg-primary text-primary-foreground">
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Apply Filters
              </Button>
              <Button
                variant="ghost"
                onClick={() => setFilters({ origin: "", destination: "", containerType: "", transportMode: "", minAvailableCbm: "", departureDate: "" })}
                disabled={loading}
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {containers.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-10">No containers found for your filters.</div>
            )}
            {containers.map((ctr) => (
              <Card key={ctr.id} className="border-border">
                <CardHeader className="space-y-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold">{ctr.container_number || "Container"}</CardTitle>
                    <Badge variant="secondary" className="capitalize">{ctr.container_type}</Badge>
                  </div>
                  <CardDescription className="flex items-center gap-2 text-foreground/80">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {ctr.origin} {ctr.destination ? `-> ${ctr.destination}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Ship className="h-4 w-4" /> {ctr.transport_mode?.toUpperCase()}
                  </div>
                  {ctr.departure_date && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4" /> Departure: {new Date(ctr.departure_date).toLocaleDateString()}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Badge className={cn("text-xs", ctr.available_space_cbm <= 5 ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500")}>Available {ctr.available_space_cbm} CBM</Badge>
                    <Badge variant="outline" className="text-xs">Total {ctr.total_space_cbm} CBM</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Gauge className="h-4 w-4" /> Status: {ctr.status}
                  </div>
                  <Button className="w-full" variant="outline">
                    Express Interest
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
