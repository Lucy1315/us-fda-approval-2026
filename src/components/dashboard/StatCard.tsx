import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "primary" | "secondary" | "accent" | "muted" | "orphan" | "biosimilar" | "novel" | "nda" | "oncology";
}

const variantStyles = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/20 text-secondary",
  accent: "bg-accent/10 text-accent",
  muted: "bg-muted text-muted-foreground",
  orphan: "bg-amber-100 text-amber-600",
  biosimilar: "bg-emerald-100 text-emerald-600",
  novel: "bg-violet-100 text-violet-600",
  nda: "bg-sky-100 text-sky-600",
  oncology: "bg-orange-100 text-orange-600",
};

export function StatCard({ title, value, subtitle, icon: Icon, variant = "primary" }: StatCardProps) {
  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={`p-3 rounded-xl ${variantStyles[variant]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
