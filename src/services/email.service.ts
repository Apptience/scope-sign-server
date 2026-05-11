import nodemailer from "nodemailer";

export type EmailJob = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

// Create a getter to safely retrieve the transporter with loaded env variables
function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.zoho.in";
  const port = parseInt(process.env.SMTP_PORT || "465");
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER || "support@example.com";
  const pass = process.env.SMTP_PASS || "replace-me";

  console.log(`[SMTP_INIT] Creating transporter for host="${host}", port=${port}, secure=${secure}, user="${user}"`);

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendEmail(job: EmailJob) {
  try {
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || '"ScopeSign" <support@example.com>';
    console.log(`[SMTP] Attempting dispatch to: "${job.to}" with subject: "${job.subject}"`);
    console.log(`[SMTP] From address: "${fromAddress}"`);
    
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: fromAddress,
      to: job.to,
      subject: job.subject,
      text: job.text,
      html: job.html,
    });
    
    console.log(`[SMTP] Dispatch successful! messageId="${info.messageId}"`);
  } catch (err: any) {
    console.error(`[SMTP] CRITICAL: Failed to dispatch email to "${job.to}". Error Name: "${err.name}", Message: "${err.message}", Code: "${err.code}"`);
    if (err.stack) {
      console.error("[SMTP] Full error stack trace:", err.stack);
    }
  }
}

export async function sendEmailVerification(input: {
  to: string;
  name: string;
  code: string;
}) {
  const escapedName = escapeHtml(input.name);
  const escapedCode = escapeHtml(input.code);

  await sendEmail({
    to: input.to,
    subject: `${input.code} is your ScopeSign verification code`,
    text: [
      `Hi ${input.name},`,
      "",
      `Your ScopeSign verification code is: ${input.code}`,
      "",
      "This code expires in 15 minutes.",
    ].join("\n"),
    html: `
      <p>Hi ${escapedName},</p>
      <p>Use this code to verify your ScopeSign account:</p>
      <p style="font-size: 28px; letter-spacing: 8px; font-weight: 700;">${escapedCode}</p>
      <p>This code expires in 15 minutes.</p>
    `,
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  code: string;
}) {
  const escapedName = escapeHtml(input.name);
  const escapedCode = escapeHtml(input.code);

  await sendEmail({
    to: input.to,
    subject: `Password Reset Code: ${input.code}`,
    text: [
      `Hi ${input.name},`,
      "",
      `Your password reset code is: ${input.code}`,
      "",
      "If you didn't request this, you can safely ignore this email.",
      "This code expires in 15 minutes.",
    ].join("\\n"),
    html: `
      <p>Hi ${escapedName},</p>
      <p>Use this code to reset your ScopeSign password:</p>
      <p style="font-size: 28px; letter-spacing: 8px; font-weight: 700;">${escapedCode}</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>This code expires in 15 minutes.</p>
    `,
  });
}
