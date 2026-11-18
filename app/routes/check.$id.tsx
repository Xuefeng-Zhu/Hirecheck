import { useActionQuery } from "@agent-native/core/client/hooks";
import { IconArrowLeft, IconLoader2, IconMessageCircle } from "@tabler/icons-react";
import { Link, useNavigate, useParams } from "react-router";

import { ReportView } from "@/components/hirecheck/report-view";
import { Button } from "@/components/ui/button";
import { getChatHomeThreadId } from "@/lib/chat-home-thread";
import { chatThreadPath, type ChatRouteState } from "@/lib/chat-paths";

import type { HireCheckReport } from "../../server/lib/hirecheck/types";

export function meta() {
  return [{ title: "HireCheck report" }];
}

export default function CheckReport() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const q = useActionQuery("get-report", { id } as never);
  const report = q.data as (HireCheckReport & { id: string }) | undefined;

  function askAgent() {
    const name = report?.matched?.businessName || report?.input.name;
    const state: ChatRouteState = {
      initialMessage: `About HireCheck report ${id} (${name}): `,
    } as ChatRouteState;
    navigate(chatThreadPath(getChatHomeThreadId()), { state });
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link to="/check" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <IconArrowLeft className="size-4" /> New check
        </Link>
        {report && (
          <Button variant="outline" size="sm" onClick={askAgent}>
            <IconMessageCircle className="mr-1 size-4" /> Ask a follow-up
          </Button>
        )}
      </div>
      {q.isLoading && <IconLoader2 className="size-6 animate-spin" />}
      {q.error && <p className="text-red-600">Report not found.</p>}
      {report && <ReportView report={report} />}
    </div>
  );
}
