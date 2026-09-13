"use client";

import { useParams } from "next/navigation";
import { AssessmentResults } from "@/features/assessment/components/assessment-results";

/** Route adapter: reads the dynamic segment and hands it to the results view. */
export function AssessmentResultsRoute() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId;
  if (!sessionId) return null;
  return <AssessmentResults sessionId={sessionId} />;
}
