"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.sendEmailVerification = sendEmailVerification;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
// Create a getter to safely retrieve the transporter with loaded env variables
function getTransporter() {
    const host = process.env.SMTP_HOST || "smtp.zoho.in";
    const port = parseInt(process.env.SMTP_PORT || "465");
    const secure = process.env.SMTP_SECURE === "true";
    const user = process.env.SMTP_USER || "support@example.com";
    const pass = process.env.SMTP_PASS || "replace-me";
    console.log(`[SMTP_INIT] Creating transporter for host="${host}", port=${port}, secure=${secure}, user="${user}"`);
    return nodemailer_1.default.createTransport({
        host,
        port,
        secure,
        auth: {
            user,
            pass,
        },
    });
}
function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
async function sendEmail(job) {
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
    }
    catch (err) {
        console.error(`[SMTP] CRITICAL: Failed to dispatch email to "${job.to}". Error Name: "${err.name}", Message: "${err.message}", Code: "${err.code}"`);
        if (err.stack) {
            console.error("[SMTP] Full error stack trace:", err.stack);
        }
    }
}
async function sendEmailVerification(input) {
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
async function sendPasswordResetEmail(input) {
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
