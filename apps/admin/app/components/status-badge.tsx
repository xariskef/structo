import { Badge } from "@structo/ui/components/badge";
import { cn } from "@structo/ui/lib/utils";

type Status = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

const CONFIG: Record<
  Status,
  { label: string; variant: "default" | "secondary" | "outline"; className?: string }
> = {
  PUBLISHED: { label: "Published", variant: "default" },
  DRAFT: { label: "Draft", variant: "secondary" },
  SCHEDULED: {
    label: "Scheduled",
    variant: "outline",
    className: "border-amber-400 text-amber-600",
  },
  ARCHIVED: { label: "Archived", variant: "outline" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const config = CONFIG[(status as Status) ?? "DRAFT"] ?? CONFIG.DRAFT;
  return (
    <Badge
      variant={config.variant}
      className={cn("text-[10px]", config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
