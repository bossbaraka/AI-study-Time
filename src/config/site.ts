import type { Metadata, Viewport } from "next";

export const siteConfig = {
  name: "Mureeh Study Assistant",
  shortName: "Mureeh",
  description:
    "Mureeh doesn't simply tell students what to study. It manages their learning journey until they achieve their goal.",
  url: "https://mureeh.app",
} as const;

export const appConfig = {
  /** Base path of the authenticated student application. */
  studentBasePath: "/app",
  guardianBasePath: "/guardian",
  /** Simulated API latency window for mock services (ms). */
  mockLatency: { min: 240, max: 620 },
  /** Focus-mode session timer defaults (seconds). */
  focusCheckIntervalSeconds: 1,
} as const;

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s — ${siteConfig.shortName}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#071625" },
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
  ],
};
