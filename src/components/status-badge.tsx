import { Badge } from "@/components/ui/badge";
import { statusLabel, statusVariant } from "@/lib/format";
import type { AppointmentStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge>;
}
