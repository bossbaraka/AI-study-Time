import type { Metadata } from "next";
import { AssessmentSessionRoute } from "@/features/assessment/components/assessment-session-route";

export const metadata: Metadata = { title: "Assessment session" };

export default function AssessmentSessionPage() {
  return <AssessmentSessionRoute />;
}
