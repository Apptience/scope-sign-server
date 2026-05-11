"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.sendEmailVerification = sendEmailVerification;
const nodemailer_1 = __importDefault(require("nodemailer"));
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST || "smtp.zoho.in",
    port: parseInt(process.env.SMTP_PORT || "465"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
        user: process.env.SMTP_USER || "support@example.com",
        pass: process.env.SMTP_PASS || "replace-me",
    },
});
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
        console.log(`[SMTP] Attempting to dispatch email to: "${job.to}" with subject: "${job.subject}"`);
        console.log(`[SMTP] Transport config: host="${process.env.SMTP_HOST || "smtp.zoho.in"}", port=${process.env.SMTP_PORT || "465"}, user="${process.env.SMTP_USER || "support@example.com"}"`);
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"ScopeSign" <support@example.com>',
            to: job.to,
            subject: job.subject,
            text: job.text,
            html: job.html,
        });
        console.log(`[SMTP] Dispatch successful! messageId="${info.messageId}"`);
    }
    catch (err) {
        console.error(`[SMTP] CRITICAL: Failed to dispatch email to "${job.to}".`, err);
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
