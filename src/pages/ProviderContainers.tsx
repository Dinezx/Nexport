import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LOCATIONS } from "@/lib/constants";

/* ---------------- Types ---------------- */

type Container = {
  id: string;
  container_number: string;
  container_type: string;
  container_size: string;
  total_space_cbm: number;
  available_space_cbm: number;
  origin: string;
  destination: string;
  transport_mode: string;
  status: string;
  created_at: string;
};

/* ---------------- Component ---------------- */

export default function ProviderContainers() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);
  const { toast } = useToast();

  const [form, setForm] = useState({
    container_type: "",
    container_size: "",
    total_space_cbm: "",
    available_space_cbm: "",
    origin: "",
    destination: "",
    transport_mode: "",
  });
  const [locationSearch, setLocationSearch] = useState("");

  /* ---------------- Fetch Containers using Service ---------------- */
  const fetchContainers = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "User not authenticated", variant: "destructive" });
        setError("User not authenticated");
        return;
      }

      // Use container service to fetch containers
      const { data, error } = await supabase
        .from("containers")
        .select("*")
        .eq("provider_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContainers(data ?? []);
    } catch (err) {
      console.error("Failed to load containers:", err);
      toast({ title: "Failed to load containers", variant: "destructive" });
      setError("Failed to load containers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();
  }, []);

  /* ---------------- Handle Form ---------------- */

  const resetForm = () => {
    setForm({
      container_type: "",
      container_size: "",
      total_space_cbm: "",
      available_space_cbm: "",
      origin: "",
      destination: "",
      transport_mode: "",
    });
    setEditingContainer(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "User not authenticated", variant: "destructive" });
        return;
      }

      const totalSpace = parseFloat(form.total_space_cbm);
      const availableSpace = editingContainer ? parseFloat(form.available_space_cbm) : totalSpace;

      if (availableSpace > totalSpace) {
        toast({ title: "Available space cannot exceed total space", variant: "destructive" });
        return;
      }

      const status = availableSpace === 0 ? "full" : "active";
      const containerNumber = editingContainer ? editingContainer.container_number : `CONT-${Date.now()}`;

      const containerData = {
        provider_id: user.id,
        container_number: containerNumber,
        container_type: form.container_type,
        container_size: form.container_size,
        total_space_cbm: totalSpace,
        available_space_cbm: availableSpace,
        origin: form.origin,
        destination: form.destination,
        transport_mode: form.transport_mode,
        status,
      };

      if (editingContainer) {
        const { error } = await supabase
          .from("containers")
          .update(containerData)
          .eq("id", editingContainer.id);
        if (error) throw error;
        toast({ title: "Container updated successfully" });
      } else {
        const { error } = await supabase
          .from("containers")
          .insert(containerData);
        if (error) throw error;
        toast({ title: "Container added successfully" });
      }

      resetForm();
      fetchContainers();
    } catch (err) {
      console.error(err);
      toast({ title: "Error saving container", variant: "destructive" });
    }
  };

  const handleEdit = (container: Container) => {
    setEditingContainer(container);
    setForm({
      container_type: container.container_type,
      container_size: container.container_size,
      total_space_cbm: container.total_space_cbm.toString(),
      available_space_cbm: container.available_space_cbm.toString(),
      origin: container.origin,
      destination: container.destination,
      transport_mode: container.transport_mode,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this container?")) return;
    try {
      // Use container service to delete
      const { error } = await supabase
        .from("containers")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Container deleted successfully", variant: "default" });
      fetchContainers();
    } catch (err) {
      console.error(err);
      toast({ title: "Error deleting container", variant: "destructive" });
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <DashboardLayout userType="provider">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Container Management</h1>
          <Button onClick={() => setShowForm(true)} disabled={showForm}>
            <Plus className="mr-2 h-4 w-4" />
            Add Container
          </Button>
        </div>

        {/* Form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editingContainer ? "Edit Container" : "Add New Container"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Container Type</Label>
                    <Select value={form.container_type} onValueChange={(value) => setForm({ ...form, container_type: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="dry">Dry</SelectItem>
                        <SelectItem value="reefer">Reefer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Container Size</Label>
                    <Select value={form.container_size} onValueChange={(value) => setForm({ ...form, container_size: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="20ft">20 ft</SelectItem>
                        <SelectItem value="40ft">40 ft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Total Space (CBM)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={form.total_space_cbm}
                      onChange={(e) => setForm({ ...form, total_space_cbm: e.target.value, available_space_cbm: editingContainer ? form.available_space_cbm : e.target.value })}
                      required
                    />
                  </div>
                  {editingContainer && (
                    <div>
                      <Label>Available Space (CBM)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={form.available_space_cbm}
                        onChange={(e) => setForm({ ...form, available_space_cbm: e.target.value })}
                        required
                      />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Origin</Label>
                    <Input
                      placeholder="Search location"
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                      className="mb-2"
                    />
                    <Select
                      value={form.origin}
                      onValueChange={(value) => setForm({ ...form, origin: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCATIONS.filter((location) =>
                          location.toLowerCase().includes(locationSearch.toLowerCase())
                        ).map((location) => (
                          <SelectItem key={location} value={location}>
                            {location}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Transport Mode</Label>
                    <Select value={form.transport_mode} onValueChange={(value) => setForm({ ...form, transport_mode: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sea">Sea</SelectItem>
                        <SelectItem value="road">Road</SelectItem>
                        <SelectItem value="air">Air</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit">{editingContainer ? "Update" : "Add"} Container</Button>
                  <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-destructive font-medium">{error}</p>
        )}

        {/* Container List */}
        <div className="grid gap-4">
          {containers.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>{c.container_number} - {c.container_type} - {c.container_size}</span>
                  <div className="flex gap-2">
                    <Badge variant={c.status === "allocated" ? "destructive" : c.status === "in_transit" ? "outline" : "secondary"}>
                      {c.status}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => handleEdit(c)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm">
                  <b>Origin:</b> {c.origin}
                </div>
                <div className="text-sm">
                  <b>Destination:</b> {c.destination}
                </div>
                <div className="text-sm">
                  <b>Transport:</b> {c.transport_mode}
                </div>
                <div className="text-sm">
                  <b>Total Space:</b> {c.total_space_cbm ? c.total_space_cbm + ' CBM' : '--'}
                </div>
                <div className="text-sm">
                  <b>Available Space:</b> {c.available_space_cbm ? c.available_space_cbm + ' CBM' : '--'}
                </div>
                <div className="text-sm">
                  <b>Utilization:</b> {
                    c.total_space_cbm && c.available_space_cbm !== undefined && c.total_space_cbm > 0
                      ? `${(((c.total_space_cbm - c.available_space_cbm) / c.total_space_cbm) * 100).toFixed(1)}%`
                      : '--'
                  }
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty */}
        {!loading && containers.length === 0 && (
          <p className="text-muted-foreground">
            No containers found. Add your first container.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
