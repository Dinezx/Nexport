import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";
import {
  Package,
  LayoutDashboard,
  FileText,
  MapPin,
  MessageSquare,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Users,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

interface DashboardLayoutProps {
  userType: "exporter" | "provider" | "admin";
  children: React.ReactNode;
}

/* ------------------ NAV LINKS ------------------ */

const exporterLinks = [
  { label: "Dashboard", href: "/exporter/dashboard", icon: LayoutDashboard },
  { label: "Bookings", href: "/exporter/bookings", icon: FileText },
  { label: "Messages", href: "/chat", icon: MessageSquare },
  { label: "Settings", href: "/settings", icon: Settings },
];

const providerLinks = [
  { label: "Dashboard", href: "/provider/dashboard", icon: LayoutDashboard },
  { label: "Shipments", href: "/provider/shipments", icon: Truck },
  { label: "Messages", href: "/chat", icon: MessageSquare },
  { label: "Settings", href: "/settings", icon: Settings },
];

const adminLinks = [
  { label: "Overview", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Bookings", href: "/admin/bookings", icon: FileText },
  { label: "Providers", href: "/admin/providers", icon: Truck },
  { label: "Settings", href: "/settings", icon: Settings },
];

/* ------------------ COMPONENT ------------------ */

export function DashboardLayout({ children, userType }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  /* ------------------ AUTH GUARD (FIXED) ------------------ */

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    const storedRole = localStorage.getItem("userRole");

    if (storedRole && storedRole !== userType) {
      navigate("/login", { replace: true });
    }
  }, [user, loading, navigate, userType]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  const links =
    userType === "admin"
      ? adminLinks
      : userType === "provider"
      ? providerLinks
      : exporterLinks;

  const handleLogout = () => {
    localStorage.removeItem("userRole");
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-secondary/30">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
                <Package className="h-5 w-5 text-sidebar-primary-foreground" />
              </div>
              {!collapsed && (
                <span className="text-xl font-bold text-sidebar-foreground">
                  NEXPORT
                </span>
              )}
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              {links.map((link) => {
                const isActive = location.pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <link.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{link.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-sidebar-border">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {!collapsed && <span>Log out</span>}
            </button>
          </div>

          {/* Collapse Toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300",
          collapsed ? "ml-16" : "ml-64"
        )}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
