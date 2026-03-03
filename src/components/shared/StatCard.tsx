import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  className?: string;
  variant?: "default" | "dark";
  style?: React.CSSProperties;
}

export function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  className,
  variant = "dark",
  style,
}: StatCardProps) {
  if (variant === "dark") {
    return (
      <div style={style} className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-900 hover:-translate-y-1 hover:shadow-lg group",
        className
      )}>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-400">{title}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
            {change && (
              <p
                className={cn(
                  "text-sm font-medium",
                  changeType === "positive" && "text-emerald-400",
                  changeType === "negative" && "text-red-400",
                  changeType === "neutral" && "text-zinc-500"
                )}
              >
                {change}
              </p>
            )}
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </div>
    );
  }

  // Default light variant (original design)
  return (
    <div style={style} className={cn(
      "rounded-xl border bg-card text-card-foreground shadow-card hover:shadow-card-hover transition-all duration-300 p-6 hover:-translate-y-1 group",
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
          {change && (
            <p
              className={cn(
                "text-sm font-medium",
                changeType === "positive" && "text-success",
                changeType === "negative" && "text-destructive",
                changeType === "neutral" && "text-muted-foreground"
              )}
            >
              {change}
            </p>
          )}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </div>
  );
}