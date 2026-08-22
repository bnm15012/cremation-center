/**
 * SMTP email utility using nodemailer.
 *
 * Required env vars (server-side only):
 *   SMTP_HOST  — e.g. smtp.gmail.com or smtp.resend.com
 *   SMTP_PORT  — e.g. 587 or 465
 *   SMTP_USER  — your email / API key user
 *   SMTP_PASS  — SMTP password / API key
 *   SMTP_FROM  — e.g. "Cremation System <noreply@example.com>"
 */
import nodemailer from "nodemailer";

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in env."
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

const FROM =
  process.env.SMTP_FROM ?? "Cremation System <noreply@cremation.local>";

const APP_URL = process.env.APP_URL ?? "http://localhost:8082";

// ── Password reset email ──────────────────────────────────────────────────────
export async function sendPasswordResetEmail(email: string, otp: string) {
  const transport = getTransport();

  await transport.sendMail({
    from: FROM,
    to: email,
    subject: "Password reset code - Cremation System",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
        <div style="background:#1e293b;padding:24px;border-radius:12px 12px 0 0;text-align:center">
          <h1 style="color:#fb923c;margin:0;font-size:22px">Cremation System</h1>
          <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">Record Management System</p>
        </div>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px;padding:32px">
          <h2 style="margin:0 0 8px">Password Reset</h2>
          <p style="color:#475569;margin:0 0 20px">
            You requested to reset your password. Use the code below to complete the reset.
            It expires in <strong>15 minutes</strong>.
          </p>
          <div style="background:#f1f5f9;padding:18px;border-radius:8px;text-align:center;margin-bottom:24px">
            <p style="font-size:28px;letter-spacing:8px;font-weight:700;color:#0f172a;margin:0">${otp}</p>
          </div>
          <p style="color:#94a3b8;font-size:12px;margin:0">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      </div>
    `,
  });
}

// ── Invite email ──────────────────────────────────────────────────────────────
export async function sendInviteEmail(
  email: string,
  fullName: string,
  role: "admin" | "staff",
  token: string
) {
  const transport = getTransport();
  const link = `${APP_URL}/accept-invite?token=${token}`;
  const roleLabel = role === "admin" ? "Administrator" : "Staff";

  await transport.sendMail({
    from: FROM,
    to: email,
    subject: "You've been invited to Cremation System",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
        <div style="background:#1e293b;padding:24px;border-radius:12px 12px 0 0;text-align:center">
          <h1 style="color:#fb923c;margin:0;font-size:22px">Cremation System</h1>
          <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">Record Management System</p>
        </div>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px;padding:32px">
          <h2 style="margin:0 0 8px">Hello, ${fullName}</h2>
          <p style="color:#475569;margin:0 0 20px">
            You have been added as a <strong>${roleLabel}</strong> on Cremation System
            record management system. Click the button below to set your password and activate
            your account.
          </p>
          <a href="${link}"
             style="display:inline-block;background:#1e293b;color:#ffffff;padding:13px 28px;
                    border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;
                    margin-bottom:24px">
            Set Password &amp; Activate Account
          </a>
          <p style="color:#94a3b8;font-size:12px;margin:0">
            This link expires in <strong>48 hours</strong>. If you weren't expecting this
            invitation, you can safely ignore this email.
          </p>
        </div>
      </div>
    `,
  });
}
