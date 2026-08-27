import { CheckCircle2, Clock, UserX, type LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ExpertStatus } from "@/lib/auth/get-user";
import { cn } from "@/lib/utils";

type Block = { icon: LucideIcon; tone: string; title: string; body: string };

// Fixed copy per application status; `none` never reaches this card (the
// page shows the form instead).
const BLOCKS: Record<Exclude<ExpertStatus, "none">, Block> = {
  pending: {
    icon: Clock,
    tone: "text-primary",
    title: "Application received",
    body: "We review every expert profile by hand. You’ll get an email when your profile is approved; until then nothing is shown to clients.",
  },
  approved: {
    icon: CheckCircle2,
    tone: "text-success",
    title: "Approved expert",
    body: "Your profile is live for matching. Keep it current — clients see your headline and competencies in their report.",
  },
  rejected: {
    icon: UserX,
    tone: "text-muted-foreground",
    title: "Application not accepted",
    body: "We couldn’t accept this application. If you think that is a mistake, reply to the email you received and we’ll take another look.",
  },
};

export function ExpertStatusCard({ status }: { status: Exclude<ExpertStatus, "none"> }) {
  const block = BLOCKS[status];
  const Icon = block.icon;
  return (
    <Card>
      <CardHeader>
        <CardDescription>Expert profile</CardDescription>
        <CardTitle className="text-2xl">{block.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
          <Icon aria-hidden="true" className={cn("mt-0.5 size-5", block.tone)} />
          <p className="text-sm text-muted-foreground">{block.body}</p>
        </div>
      </CardContent>
    </Card>
  );
}
