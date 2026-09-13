"use client";

import { useParams } from "next/navigation";
import { AssessmentRunner } from "@/features/assessment/components/assessment-runner";

/** Route adapter: reads the dynamic segment and hands it to the runner. */
export function AssessmentSessionRoute() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId;
  if (!sessionId) return null;
  return <AssessmentRunner sessionId={sessionId} />;
}
