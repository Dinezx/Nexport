import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { isSupabaseReachable } from "@/lib/offlineAuth";

type UserRole = "exporter" | "provider" | "admin";

type SettingsForm = {
  profile: {
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    website: string;
  };
  address: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  exporter: {
    incoterm: string;
    cargoType: string;
    pickupWindow: string;
  };
  provider: {
    yardLocation: string;
    serviceRegions: string;
    fleetSize: string;
  };
};

const emptySettings: SettingsForm = {
  profile: {
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    website: "",
  },
  address: {
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  },
  exporter: {
    incoterm: "",
    cargoType: "",
    pickupWindow: "",
  },
  provider: {
    yardLocation: "",
    serviceRegions: "",
    fleetSize: "",
  },
};

export default function Profile() {
  const { user } = useAuth();
  const role = ((user?.role ?? (localStorage.getItem("userRole") as UserRole)) || "exporter") as UserRole;
  const storageKey = user?.id ? `nexport.settings.${user.id}` : `nexport.settings.${role}`;

  const [settings, setSettings] = useState<SettingsForm>(emptySettings);

  useEffect(() => {
    const loadProfile = async () => {
      let nextSettings = emptySettings;

      const raw = localStorage.getItem(storageKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<SettingsForm>;
          nextSettings = {
            ...emptySettings,
            ...parsed,
            profile: { ...emptySettings.profile, ...(parsed.profile ?? {}) },
            address: { ...emptySettings.address, ...(parsed.address ?? {}) },
            exporter: { ...emptySettings.exporter, ...(parsed.exporter ?? {}) },
            provider: { ...emptySettings.provider, ...(parsed.provider ?? {}) },
          };
        } catch {
          nextSettings = emptySettings;
        }
      }

      if (user?.id) {
        const online = await isSupabaseReachable(import.meta.env.VITE_SUPABASE_URL!);
        if (online) {
          const { data } = await supabase
            .from("profiles")
            .select("name, company, email")
            .eq("id", user.id)
            .maybeSingle();

          if (data) {
            nextSettings = {
              ...nextSettings,
              profile: {
                ...nextSettings.profile,
                contactName: data.name || nextSettings.profile.contactName,
                companyName: data.company || nextSettings.profile.companyName,
                email: data.email || nextSettings.profile.email,
              },
            };
          }
        }
      }

      setSettings(nextSettings);
    };

    loadProfile();
  }, [storageKey, user?.id]);

  const roleLabel = useMemo(() => {
    if (role === "provider") return "Provider";
    if (role === "admin") return "Admin";
    return "Exporter";
  }, [role]);

  const initials = useMemo(() => {
    const name = settings.profile.contactName || settings.profile.companyName || roleLabel;
    const parts = name.trim().split(" ").filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  }, [roleLabel, settings.profile.companyName, settings.profile.contactName]);

  return (
    <DashboardLayout userType={role}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold animate-fade-in">Profile</h1>
            <p className="text-sm text-muted-foreground">
              {roleLabel} profile overview.
            </p>
          </div>
          <Button asChild variant="outline" className="border-border">
            <Link to="/settings">Edit Profile</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-semibold">
              {initials || "P"}
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-foreground">
                {settings.profile.contactName || "Add your name"}
              </p>
              <p className="text-sm text-muted-foreground">
                {settings.profile.companyName || "Add company name"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="info">{roleLabel}</Badge>
                {settings.profile.email && (
                  <Badge variant="secondary">{settings.profile.email}</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Contact Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{settings.profile.email || "Not set"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="font-medium text-foreground">{settings.profile.phone || "Not set"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Website</p>
                <p className="font-medium text-foreground">{settings.profile.website || "Not set"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium text-foreground">
                {settings.address.line1 || "Address line 1"}
              </p>
              <p className="text-muted-foreground">
                {settings.address.line2 || "Address line 2"}
              </p>
              <p className="text-muted-foreground">
                {[settings.address.city, settings.address.state, settings.address.postalCode]
                  .filter(Boolean)
                  .join(", ") || "City, State, Postal"}
              </p>
              <p className="text-muted-foreground">
                {settings.address.country || "Country"}
              </p>
            </CardContent>
          </Card>
        </div>

        {role === "exporter" && (
          <Card>
            <CardHeader>
              <CardTitle>Exporter Operations</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-muted-foreground">Incoterm</p>
                <p className="font-medium text-foreground">{settings.exporter.incoterm || "Not set"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cargo Type</p>
                <p className="font-medium text-foreground">{settings.exporter.cargoType || "Not set"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Pickup Window</p>
                <p className="font-medium text-foreground">{settings.exporter.pickupWindow || "Not set"}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {role === "provider" && (
          <Card>
            <CardHeader>
              <CardTitle>Provider Operations</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-muted-foreground">Yard Location</p>
                <p className="font-medium text-foreground">{settings.provider.yardLocation || "Not set"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Service Regions</p>
                <p className="font-medium text-foreground">{settings.provider.serviceRegions || "Not set"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fleet Size</p>
                <p className="font-medium text-foreground">{settings.provider.fleetSize || "Not set"}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
