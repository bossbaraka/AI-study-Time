import type { Metadata } from "next";
import { MissionRunner } from "@/features/mission/components/mission-runner";

export const metadata: Metadata = { title: "Current Mission" };

export default function MissionPage() {
  return <MissionRunner />;
}
