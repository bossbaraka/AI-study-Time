import type { Metadata } from "next";
import { AssessmentIntro } from "@/features/assessment/components/assessment-intro";

export const metadata: Metadata = { title: "Assessment" };

export default function AssessmentPage() {
  return <AssessmentIntro />;
}
