import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";

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
  notifications: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    operational: boolean;
    payouts: boolean;
  };
  preferences: {
    transportMode: string;
    priority: string;
    insuranceRequired: boolean;
  };
  billing: {
    billingEmail: string;
    taxId: string;
    payoutMethod: string;
    payoutAccount: string;
  };
  security: {
    mfaEnabled: boolean;
    sessionTimeout: string;
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

const defaultSettings: SettingsForm = {
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
    country: "India",
  },
  notifications: {
    email: true,
    sms: false,
    whatsapp: false,
    operational: true,
    payouts: true,
  },
  preferences: {
    transportMode: "sea",
    priority: "balanced",
    insuranceRequired: true,
  },
  billing: {
    billingEmail: "",
    taxId: "",
    payoutMethod: "bank",
    payoutAccount: "",
  },
  security: {
    mfaEnabled: false,
    sessionTimeout: "1h",
  },
  exporter: {
    incoterm: "FOB",
    cargoType: "general",
    pickupWindow: "48h",
  },
  provider: {
    yardLocation: "",
    serviceRegions: "",
    fleetSize: "",
  },
};

function mergeSettings(base: SettingsForm, override?: Partial<SettingsForm>) {
  if (!override) return base;
  return {
    ...base,
    ...override,
    profile: { ...base.profile, ...(override.profile ?? {}) },
    address: { ...base.address, ...(override.address ?? {}) },
    notifications: { ...base.notifications, ...(override.notifications ?? {}) },
    preferences: { ...base.preferences, ...(override.preferences ?? {}) },
    billing: { ...base.billing, ...(override.billing ?? {}) },
    security: { ...base.security, ...(override.security ?? {}) },
    exporter: { ...base.exporter, ...(override.exporter ?? {}) },
    provider: { ...base.provider, ...(override.provider ?? {}) },
  };
}

export default function Settings() {
  const { user } = useAuth();
  const role = ((user?.role ?? (localStorage.getItem("userRole") as UserRole)) || "exporter") as UserRole;
  const storageKey = user?.id ? `nexport.settings.${user.id}` : `nexport.settings.${role}`;

  const [form, setForm] = useState<SettingsForm>(defaultSettings);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const loadSettings = () => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      setForm(defaultSettings);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<SettingsForm>;
      setForm(mergeSettings(defaultSettings, parsed));
    } catch {
      setForm(defaultSettings);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [storageKey]);

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      localStorage.setItem(storageKey, JSON.stringify(form));
      setLastSaved(new Date());
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    }
  };

  const roleLabel = useMemo(() => {
    if (role === "provider") return "Provider";
    if (role === "admin") return "Admin";
    return "Exporter";
  }, [role]);

  return (
    <DashboardLayout userType={role}>
      <form onSubmit={handleSave} className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold animate-fade-in">Settings</h1>
            <p className="text-sm text-muted-foreground">
              {roleLabel} preferences and account details.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {saveState === "saved" && (
              <span className="text-xs text-success">Saved</span>
            )}
            {saveState === "error" && (
              <span className="text-xs text-destructive">Save failed</span>
            )}
            {lastSaved && (
              <span className="text-xs text-muted-foreground">
                Last saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            <Button type="button" variant="outline" onClick={loadSettings}>
              Reset
            </Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Company & Contact</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    value={form.profile.companyName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, companyName: e.target.value },
                      }))
                    }
                    placeholder="Your Company Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Primary Contact</Label>
                  <Input
                    value={form.profile.contactName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, contactName: e.target.value },
                      }))
                    }
                    placeholder="Contact Person"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.profile.email}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, email: e.target.value },
                      }))
                    }
                    placeholder="you@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={form.profile.phone}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, phone: e.target.value },
                      }))
                    }
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Website</Label>
                  <Input
                    value={form.profile.website}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, website: e.target.value },
                      }))
                    }
                    placeholder="https://yourcompany.com"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Address</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Address Line 1</Label>
                  <Input
                    value={form.address.line1}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        address: { ...prev.address, line1: e.target.value },
                      }))
                    }
                    placeholder="Street, building, floor"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Address Line 2</Label>
                  <Input
                    value={form.address.line2}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        address: { ...prev.address, line2: e.target.value },
                      }))
                    }
                    placeholder="Area or landmark"
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={form.address.city}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        address: { ...prev.address, city: e.target.value },
                      }))
                    }
                    placeholder="City"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    value={form.address.state}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        address: { ...prev.address, state: e.target.value },
                      }))
                    }
                    placeholder="State"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Postal Code</Label>
                  <Input
                    value={form.address.postalCode}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        address: { ...prev.address, postalCode: e.target.value },
                      }))
                    }
                    placeholder="Postal Code"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input
                    value={form.address.country}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        address: { ...prev.address, country: e.target.value },
                      }))
                    }
                    placeholder="Country"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="operations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Email Notifications</Label>
                  <Switch
                    checked={form.notifications.email}
                    onCheckedChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        notifications: { ...prev.notifications, email: value },
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>SMS Notifications</Label>
                  <Switch
                    checked={form.notifications.sms}
                    onCheckedChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        notifications: { ...prev.notifications, sms: value },
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>WhatsApp Alerts</Label>
                  <Switch
                    checked={form.notifications.whatsapp}
                    onCheckedChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        notifications: { ...prev.notifications, whatsapp: value },
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Operational Updates</Label>
                  <Switch
                    checked={form.notifications.operational}
                    onCheckedChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        notifications: { ...prev.notifications, operational: value },
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Payout Alerts</Label>
                  <Switch
                    checked={form.notifications.payouts}
                    onCheckedChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        notifications: { ...prev.notifications, payouts: value },
                      }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Logistics Preferences</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Primary Transport Mode</Label>
                  <Select
                    value={form.preferences.transportMode}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        preferences: { ...prev.preferences, transportMode: value },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sea">Sea</SelectItem>
                      <SelectItem value="air">Air</SelectItem>
                      <SelectItem value="road">Road</SelectItem>
                      <SelectItem value="rail">Rail</SelectItem>
                      <SelectItem value="multimodal">Multimodal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={form.preferences.priority}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        preferences: { ...prev.preferences, priority: value },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cost">Cost Focused</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="speed">Speed Focused</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between sm:col-span-2">
                  <Label>Insurance Required</Label>
                  <Switch
                    checked={form.preferences.insuranceRequired}
                    onCheckedChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        preferences: { ...prev.preferences, insuranceRequired: value },
                      }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {role === "exporter" && (
              <Card>
                <CardHeader>
                  <CardTitle>Exporter Details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Incoterm</Label>
                    <Select
                      value={form.exporter.incoterm}
                      onValueChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          exporter: { ...prev.exporter, incoterm: value },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select incoterm" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FOB">FOB</SelectItem>
                        <SelectItem value="CIF">CIF</SelectItem>
                        <SelectItem value="EXW">EXW</SelectItem>
                        <SelectItem value="DAP">DAP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Primary Cargo Type</Label>
                    <Select
                      value={form.exporter.cargoType}
                      onValueChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          exporter: { ...prev.exporter, cargoType: value },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select cargo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="fragile">Fragile</SelectItem>
                        <SelectItem value="perishable">Perishable</SelectItem>
                        <SelectItem value="hazardous">Hazardous</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Pickup Window</Label>
                    <Input
                      value={form.exporter.pickupWindow}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          exporter: { ...prev.exporter, pickupWindow: e.target.value },
                        }))
                      }
                      placeholder="e.g., 48h"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {role === "provider" && (
              <Card>
                <CardHeader>
                  <CardTitle>Provider Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Yard Location</Label>
                    <Input
                      value={form.provider.yardLocation}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          provider: { ...prev.provider, yardLocation: e.target.value },
                        }))
                      }
                      placeholder="Chennai, India"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Service Regions</Label>
                    <Textarea
                      value={form.provider.serviceRegions}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          provider: { ...prev.provider, serviceRegions: e.target.value },
                        }))
                      }
                      placeholder="South Asia, Middle East"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fleet Size (containers)</Label>
                    <Input
                      value={form.provider.fleetSize}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          provider: { ...prev.provider, fleetSize: e.target.value },
                        }))
                      }
                      placeholder="e.g., 120"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Billing & Payouts</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Billing Email</Label>
                  <Input
                    type="email"
                    value={form.billing.billingEmail}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        billing: { ...prev.billing, billingEmail: e.target.value },
                      }))
                    }
                    placeholder="billing@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>GST / Tax ID</Label>
                  <Input
                    value={form.billing.taxId}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        billing: { ...prev.billing, taxId: e.target.value },
                      }))
                    }
                    placeholder="Tax ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payout Method</Label>
                  <Select
                    value={form.billing.payoutMethod}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        billing: { ...prev.billing, payoutMethod: value },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="swift">SWIFT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Account / UPI / SWIFT</Label>
                  <Input
                    value={form.billing.payoutAccount}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        billing: { ...prev.billing, payoutAccount: e.target.value },
                      }))
                    }
                    placeholder="Account details"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Security Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Multi-Factor Authentication</Label>
                  <Switch
                    checked={form.security.mfaEnabled}
                    onCheckedChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        security: { ...prev.security, mfaEnabled: value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Session Timeout</Label>
                  <Select
                    value={form.security.sessionTimeout}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        security: { ...prev.security, sessionTimeout: value },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select timeout" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30m">30 minutes</SelectItem>
                      <SelectItem value="1h">1 hour</SelectItem>
                      <SelectItem value="4h">4 hours</SelectItem>
                      <SelectItem value="8h">8 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </form>
    </DashboardLayout>
  );
}
