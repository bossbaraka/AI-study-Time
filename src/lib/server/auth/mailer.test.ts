import { beforeEach, describe, expect, it, vi } from "vitest";

const { createTransport } = vi.hoisted(() => ({ createTransport: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport } }));

import nodemailer from "nodemailer";
import {
  EmailDeliveryError,
  isSmtpConfigured,
  redactSensitiveMailBody,
  sendEmail,
} from "./mailer";

beforeEach(() => {
  vi.stubEnv("SMTP_HOST", "smtp.example.test");
  vi.stubEnv("SMTP_PORT", "587");
  vi.stubEnv("SMTP_SECURE", "false");
  vi.stubEnv("SMTP_USERNAME", "mailer");
  vi.stubEnv("SMTP_PASSWORD", "test-only-password");
  vi.stubEnv("SMTP_FROM", "Mureeh <no-reply@example.test>");
  vi.mocked(nodemailer.createTransport).mockReset();
});

describe("SMTP mail delivery", () => {
  it("redacts reset, verification, and invitation credentials before production retention", () => {
    expect(
      redactSensitiveMailBody(
        "Verify at https://example.test/verify?token=secret-token and reset with ?token=reset-token",
      ),
    ).toBe(
      "Verify at https://example.test/verify?token=[redacted] and reset with ?token=[redacted]",
    );
    expect(redactSensitiveMailBody("Your invitation code: MU-ABCD-EFGH"))
      .toBe("Your invitation code: [redacted]");
  });

  it("requires a complete, bounded SMTP configuration", async () => {
    vi.stubEnv("SMTP_HOST", "");
    expect(isSmtpConfigured()).toBe(false);
    await expect(
      sendEmail({ to: "student@example.test", subject: "Test", text: "Hello" }),
    ).rejects.toMatchObject({ code: "smtp_not_configured" });
  });

  it("sends plain-text content through the configured authenticated transport", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "test-message" });
    vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as never);

    await sendEmail({ to: "student@example.test", subject: "Verify", text: "Open the link" });

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: "smtp.example.test",
      port: 587,
      secure: false,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
      auth: { user: "mailer", pass: "test-only-password" },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: "Mureeh <no-reply@example.test>",
      to: "student@example.test",
      subject: "Verify",
      text: "Open the link",
    });
  });

  it("uses implicit TLS on port 465 and never leaks provider errors", async () => {
    vi.stubEnv("SMTP_PORT", "465");
    vi.stubEnv("SMTP_SECURE", "");
    const sendMail = vi.fn().mockRejectedValue(new Error("sensitive SMTP response"));
    vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as never);

    let caught: unknown;
    try {
      await sendEmail({ to: "student@example.test", subject: "Verify", text: "Open the link" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(EmailDeliveryError);
    expect(caught).toMatchObject({ code: "smtp_send_failed" });
    expect((caught as Error).message).not.toContain("sensitive SMTP response");
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: true }));
  });
});
