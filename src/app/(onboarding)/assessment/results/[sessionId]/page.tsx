import type { Metadata } from "next";
import { AssessmentResultsRoute } from "@/features/assessment/components/assessment-results-route";

export const metadata: Metadata = { title: "Assessment results" };

export default function AssessmentResultsPage() {
  return <AssessmentResultsRoute />;
}
