"use client";

import { Award, Download, Lock, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { SectionBlock } from "@/components/layout/section-block";
import { useCertificates } from "@/features/engagement/hooks/use-engagement";
import { useT } from "@/lib/i18n/provider";
import { cn, formatDate } from "@/lib/utils";
import type { Certificate } from "@/types/domain";


/**
 * Certificates — issued only on mastery. A pending certificate
 * states exactly which evidence is missing (no vague gating).
 */
export default function CertificatesPage() {
  const t = useT();
  const certificatesQuery = useCertificates();

  if (certificatesQuery.isLoading) return <PageSkeleton blocks={2} />;
  if (certificatesQuery.isError || !certificatesQuery.data) {
    return (
      <ErrorState
        title={t("state.error.title")}
        body={t("state.error.body")}
        onRetry={() => void certificatesQuery.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("certificates.title")} subtitle={t("certificates.subtitle")} />

      <SectionBlock>
        <ul className="flex flex-col gap-4">
          {certificatesQuery.data.map((certificate) => (
            <CertificateCard key={certificate.id} certificate={certificate} />
          ))}
        </ul>
      </SectionBlock>
    </div>
  );
}

function CertificateCard({ certificate }: { certificate: Certificate }) {
  const t = useT();
  const issued = certificate.status === "issued";

  return (
    <li
      className={cn(
        "flex flex-col gap-5 rounded-xl border bg-surface p-6 sm:flex-row sm:items-center sm:justify-between",
        issued ? "border-mastery/35" : "border-border",
      )}
    >
      <div className="flex min-w-0 items-start gap-4">
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-lg border",
            issued
              ? "border-mastery/40 bg-mastery-subtle text-mastery"
              : "border-border bg-muted text-muted-foreground",
          )}
          aria-hidden="true"
        >
          {issued ? <Award className="size-5" /> : <Lock className="size-5" />}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">{certificate.title}</h2>
            <Badge tone={issued ? "mastery" : "warning"}>
              {issued ? t("certificates.issued") : t("certificates.pending")}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{certificate.issuedFor}</p>
          {issued && certificate.credentialId && certificate.issuedAt && (
            <p className="tabular mt-2 flex items-center gap-1.5 text-2xs text-muted-foreground">
              <ScrollText className="size-3" aria-hidden="true" />
              {t("certificates.credential", { id: certificate.credentialId })} ·{" "}
              {formatDate(certificate.issuedAt)}
            </p>
          )}
          {!issued && certificate.missingRequirement && (
            <p className="mt-2 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning-foreground">
              {t("certificates.missing", { requirement: certificate.missingRequirement })}
            </p>
          )}
        </div>
      </div>

      {issued ? (
        <Button variant="secondary" className="shrink-0">
          <Download className="size-4" aria-hidden="true" />
          {t("certificates.download")}
        </Button>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">{t("mastery.notAchieved")}</span>
      )}
    </li>
  );
}
