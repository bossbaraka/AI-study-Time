import nodemailer from "nodemailer";

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
}

export type EmailDeliveryFailureCode = "smtp_not_configured" | "smtp_send_failed";

export class EmailDeliveryError extends Error {
  constructor(readonly code: EmailDeliveryFailureCode) {
    super(code);
    this.name = "EmailDeliveryError";
  }
}

/** Remove one-time credentials before an outbound body is retained in production. */
export function redactSensitiveMailBody(body: string): string {
  return body
    .replace(/([?&]token=)[^& ]+/gi, "$1[redacted]")
    .replace(/Your invitation code: *[^ ]+/i, "Your invitation code: [redacted]");
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
}

function readSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  const rawPort = process.env.SMTP_PORT?.trim() || "587";
  const port = Number(rawPort);
  const user = process.env.SMTP_USERNAME?.trim();
  const password = process.env.SMTP_PASSWORD;

  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65_535) return null;
  if (Boolean(user) !== Boolean(password)) return null;

  const secureSetting = process.env.SMTP_SECURE?.trim().toLowerCase();
  if (secureSetting && secureSetting !== "true" && secureSetting !== "false") return null;

  return {
    host,
    port,
    secure: secureSetting ? secureSetting === "true" : port === 465,
    ...(user && password ? { user, password } : {}),
    from,
  };
}

export function isSmtpConfigured(): boolean {
  return readSmtpConfig() !== null;
}

/**
 * Send one plain-text transactional email over the configured SMTP transport.
 * The raw provider error is intentionally discarded: SMTP errors can include
 * addresses, server responses, or configuration details that must not reach
 * an API response or application log.
 */
export async function sendEmail(message: OutboundEmail): Promise<void> {
  const config = readSmtpConfig();
  if (!config) throw new EmailDeliveryError("smtp_not_configured");

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
      ...(config.user && config.password
        ? { auth: { user: config.user, pass: config.password } }
        : {}),
    });
    await transporter.sendMail({
      from: config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  } catch {
    throw new EmailDeliveryError("smtp_send_failed");
  }
}
