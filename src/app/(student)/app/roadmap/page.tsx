"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageSkeleton } from "@/components/ui/skeleton";

/**
 * Legacy dashboard roadmap route. The authoritative roadmap now lives at
 * /roadmap (Phase 6) — this page is a bridge so old links and the sidebar
 * never dead-end. The Phase-1 phases mock is no longer presented as the
 * student's real roadmap.
 */
export default function LegacyRoadmapBridge() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/roadmap");
  }, [router]);
  return <PageSkeleton blocks={3} />;
}
