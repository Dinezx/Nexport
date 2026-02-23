import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Package, 
  Truck, 
  MapPin, 
  MessageSquare, 
  BarChart3, 
  Shield, 
  Zap, 
  Globe,
  ArrowRight,
  Check
} from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-logistics.png";

const features = [
  {
    icon: Package,
    title: "Smart Booking",
    description: "Book containers with AI-powered recommendations and instant pricing.",
  },
  {
    icon: MapPin,
    title: "Real-time Tracking",
    description: "Track your shipments live with accurate ETA and milestone updates.",
  },
  {
    icon: MessageSquare,
    title: "Seamless Communication",
    description: "Chat directly with providers with booking context built-in.",
  },
  {
    icon: BarChart3,
    title: "Analytics & Insights",
    description: "Make data-driven decisions with comprehensive shipping analytics.",
  },
  {
    icon: Shield,
    title: "Secure & Reliable",
    description: "Enterprise-grade security with verified logistics providers.",
  },
  {
    icon: Zap,
    title: "Fast Processing",
    description: "Streamlined workflows for quick booking confirmations.",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Create Your Account",
    description: "Sign up as a trader or logistics provider in seconds.",
  },
  {
    step: "02",
    title: "Book Your Shipment",
    description: "Enter cargo details and get instant container recommendations.",
  },
  {
    step: "03",
    title: "Track in Real-time",
    description: "Monitor your shipment from pickup to delivery.",
  },
  {
    step: "04",
    title: "Receive & Review",
    description: "Get your cargo and rate your experience.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 hero-gradient overflow-hidden">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 animate-fade-in">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                <Globe className="h-4 w-4" />
                Global Logistics Platform
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
                Ship Smarter,{" "}
                <span className="text-primary">Grow Faster</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-lg">
                NEXPORT connects traders with trusted logistics providers for seamless container shipping worldwide.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="xl" asChild>
                  <Link to="/signup">
                    Get Started Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="xl" variant="hero-outline" asChild>
                  <Link to="/login">Watch Demo</Link>
                </Button>
              </div>
              <div className="flex items-center gap-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  100% Free to use
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  No credit card required
                </div>
              </div>
            </div>
            <div className="relative animate-slide-in-right">
              <div className="relative">
                <img
                  src={heroImage}
                  alt="Global logistics network visualization"
                  className="w-full rounded-2xl shadow-2xl"
                />
                <div className="absolute -bottom-6 -left-6 bg-card rounded-xl p-4 shadow-lg border animate-float">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                      <Truck className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Shipment Delivered</p>
                      <p className="text-xs text-muted-foreground">Shanghai → Rotterdam</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4">
        <div className="container mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything You Need</h2>
            <p className="text-lg text-muted-foreground">
              Powerful features to streamline your logistics operations
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={feature.title} 
                variant="interactive"
                className="animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-4 bg-secondary/30">
        <div className="container mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-lg text-muted-foreground">
              Get started in minutes with our simple 4-step process
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((item, index) => (
              <div key={item.step} className="relative">
                <div className="text-6xl font-bold text-primary/10 mb-4">{item.step}</div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
                {index < howItWorks.length - 1 && (
                  <ArrowRight className="hidden lg:block absolute top-8 -right-4 h-6 w-6 text-primary/30" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 bg-foreground text-background">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Transform Your Logistics?</h2>
          <p className="text-lg text-background/70 mb-8 max-w-xl mx-auto">
            Join thousands of businesses already shipping smarter with NEXPORT.
          </p>
          <Button size="xl" variant="default" asChild>
            <Link to="/signup">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Package className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold">NEXPORT</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 NEXPORT. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
