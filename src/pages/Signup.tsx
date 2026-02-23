import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Mail, Lock, User, Truck, Building } from "lucide-react";
import { cn } from "@/lib/utils";

type UserRole = "exporter" | "provider";

export default function Signup() {
  const navigate = useNavigate();

  const [role, setRole] = useState<UserRole>("exporter");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
  setError(null);
  setLoading(true);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role,
        company,
      },
    },
  });

  if (error) {
    setError(error.message);
    setLoading(false);
    return;
  }

  // DO NOT insert into profiles here
  // Trigger will handle it

  setLoading(false);
  navigate("/login");
};


  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold">NEXPORT</span>
        </Link>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Create Account</CardTitle>
            <CardDescription>Sign up to get started</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Label>I am a</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setRole("exporter")}
                className={cn(
                  "p-3 border rounded-lg flex gap-2 justify-center",
                  role === "exporter" && "border-primary bg-primary/5"
                )}
              >
                <User /> Exporter
              </button>

              <button
                onClick={() => setRole("provider")}
                className={cn(
                  "p-3 border rounded-lg flex gap-2 justify-center",
                  role === "provider" && "border-primary bg-primary/5"
                )}
              >
                <Truck /> Provider
              </button>
            </div>

            <Label>Full Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />

            <Label>Company</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} />

            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />

            <Label>Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button className="w-full" onClick={handleSignup} disabled={loading}>
              {loading ? "Creating..." : "Create Account"}
            </Button>

            <p className="text-sm text-center">
              Already have an account?{" "}
              <Link to="/login" className="text-primary underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
