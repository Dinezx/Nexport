import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "pending" | "active" | "in-transit" | "delivered" | "cancelled" | "completed";

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { label: string; variant: "pending" | "info" | "warning" | "success" | "destructive" }> = {
  pending: { label: "Pending", variant: "pending" },
  active: { label: "Active", variant: "info" },
  "in-transit": { label: "In Transit", variant: "warning" },
  delivered: { label: "Delivered", variant: "success" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge variant={config.variant} className={cn(
      "capitalize transition-all duration-200",
      status === "in-transit" && "animate-pulse-glow",
      className
    )}>
      {status === "in-transit" && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current inline-block animate-pulse" />}
      {config.label}
    </Badge>
  );
}
