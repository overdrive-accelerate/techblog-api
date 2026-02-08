import { Resend } from "resend";
import { getEnv } from "@/config/env";
import { logger } from "@/utils/logger";

/**
 * Email service using Resend for transactional emails
 * Handles email verification and password reset flows
 */

// Lazy-initialize Resend client on first use
let resend: Resend | null = null;

function getResendClient(): Resend {
    if (!resend) {
        // Use process.env directly in tests, getEnv() in production
        // This allows tests to mock environment without complex getEnv mocking
        const apiKey = process.env.NODE_ENV === "test" ? process.env.RESEND_API_KEY : getEnv().RESEND_API_KEY;

        if (!apiKey) {
            throw new Error("RESEND_API_KEY is not configured");
        }

        resend = new Resend(apiKey);
    }
    return resend;
}

/**
 * Reset Resend client (for testing only)
 * @internal
 */
export function resetResendClient(): void {
    resend = null;
}

/**
 * Base email template with branded design
 */
function getEmailTemplate(content: string, buttonText: string, buttonUrl: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 30px 40px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #111827;">
                                Tech Blog
                            </h1>
                            <p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">
                                Share Your Technical Journey
                            </p>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            ${content}
                        </td>
                    </tr>

                    <!-- Button -->
                    <tr>
                        <td style="padding: 0 40px 40px 40px;" align="center">
                            <a href="${buttonUrl}"
                               style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
                                ${buttonText}
                            </a>
                            <p style="margin: 20px 0 0 0; font-size: 13px; color: #6b7280;">
                                Or copy and paste this URL into your browser:
                            </p>
                            <p style="margin: 8px 0 0 0; font-size: 13px; color: #2563eb; word-break: break-all;">
                                ${buttonUrl}
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
                            <p style="margin: 0; font-size: 13px; color: #6b7280;">
                                This email was sent to you because a request was made for your account.
                            </p>
                            <p style="margin: 8px 0 0 0; font-size: 13px; color: #6b7280;">
                                If you didn't make this request, you can safely ignore this email.
                            </p>
                            <p style="margin: 16px 0 0 0; font-size: 12px; color: #9ca3af;">
                                © ${new Date().getFullYear()} Tech Blog. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

/**
 * Sends email verification link to user
 * Called when user signs up or requests new verification email
 *
 * @param email - User's email address
 * @param url - Full verification URL with token
 * @param token - Verification token (for logging purposes)
 */
export async function sendVerificationEmail(email: string, url: string, token: string): Promise<void> {
    // Use process.env directly in tests for easier mocking
    const fromEmail = process.env.NODE_ENV === "test" ? process.env.RESEND_FROM_EMAIL : getEnv().RESEND_FROM_EMAIL;

    if (!fromEmail) {
        throw new Error("RESEND_FROM_EMAIL is not configured");
    }

    const client = getResendClient();

    const content = `
        <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #111827;">
            Verify Your Email Address
        </h2>
        <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">
            Welcome to Tech Blog! We're excited to have you join our community of technical writers and readers.
        </p>
        <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">
            To complete your registration and start sharing your technical insights, please verify your email address by clicking the button below.
        </p>
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
            This verification link will expire in <strong>1 hour</strong> for security reasons.
        </p>
    `;

    const html = getEmailTemplate(content, "Verify Email Address", url);

    // Development: Log verification link to console for easy testing
    // Security: Only log in local development, mask sensitive data in shared environments
    if (process.env.NODE_ENV === "development" && !process.env.CI) {
        // Mask email for privacy (show first 3 chars + domain)
        const maskedEmail = email.replace(/^(.{3}).*?(@.*)$/, "$1***$2");

        // Show full link for local testing convenience
        // Note: This is only for local development. Never log in production or CI.
        console.log("\n" + "=".repeat(80));
        console.log("🔗 [DEV ONLY] Email Verification Link");
        console.log("=".repeat(80));
        console.log(`📧 To: ${maskedEmail} (full: ${email})`);
        console.log(`🔗 Link: ${url}`);
        console.log("⚠️  WARNING: This link grants email verification. Do not share!");
        console.log("=".repeat(80) + "\n");
    }

    try {
        const result = await client.emails.send({
            from: fromEmail,
            to: email,
            subject: "Verify your email address - Tech Blog",
            html,
        });

        if (result.error) {
            logger.error("Failed to send verification email", new Error(result.error.message), { email });
            throw new Error(`Failed to send verification email: ${result.error.message}`);
        }

        logger.info("Verification email sent successfully", {
            email,
            emailId: result.data?.id,
            tokenPreview: token.substring(0, 10) + "...",
        });
    } catch (error) {
        logger.error("Error sending verification email", error instanceof Error ? error : new Error(String(error)), {
            email,
        });
        throw error;
    }
}

/**
 * Sends password reset link to user
 * Called when user requests password reset
 *
 * @param email - User's email address
 * @param url - Full password reset URL with token
 * @param token - Reset token (for logging purposes)
 */
export async function sendResetPasswordEmail(email: string, url: string, token: string): Promise<void> {
    // Use process.env directly in tests for easier mocking
    const fromEmail = process.env.NODE_ENV === "test" ? process.env.RESEND_FROM_EMAIL : getEnv().RESEND_FROM_EMAIL;

    if (!fromEmail) {
        throw new Error("RESEND_FROM_EMAIL is not configured");
    }

    const client = getResendClient();

    const content = `
        <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #111827;">
            Reset Your Password
        </h2>
        <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">
            We received a request to reset the password for your Tech Blog account.
        </p>
        <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">
            Click the button below to create a new password. If you didn't request this password reset, you can safely ignore this email.
        </p>
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
            This reset link will expire in <strong>1 hour</strong> for security reasons.
        </p>
        <div style="margin: 20px 0; padding: 16px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>Security Note:</strong> Never share this link with anyone. Our team will never ask for your password.
            </p>
        </div>
    `;

    const html = getEmailTemplate(content, "Reset Password", url);

    // Development: Log reset link to console for easy testing
    // Security: Only log in local development, mask sensitive data in shared environments
    if (process.env.NODE_ENV === "development" && !process.env.CI) {
        // Mask email for privacy (show first 3 chars + domain)
        const maskedEmail = email.replace(/^(.{3}).*?(@.*)$/, "$1***$2");

        // Show full link for local testing convenience
        // Note: This is only for local development. Never log in production or CI.
        console.log("\n" + "=".repeat(80));
        console.log("🔑 [DEV ONLY] Password Reset Link");
        console.log("=".repeat(80));
        console.log(`📧 To: ${maskedEmail} (full: ${email})`);
        console.log(`🔗 Link: ${url}`);
        console.log("⚠️  WARNING: This link grants password reset. Do not share!");
        console.log("=".repeat(80) + "\n");
    }

    try {
        const result = await client.emails.send({
            from: fromEmail,
            to: email,
            subject: "Reset your password - Tech Blog",
            html,
        });

        if (result.error) {
            logger.error("Failed to send password reset email", new Error(result.error.message), { email });
            throw new Error(`Failed to send password reset email: ${result.error.message}`);
        }

        logger.info("Password reset email sent successfully", {
            email,
            emailId: result.data?.id,
            tokenPreview: token.substring(0, 10) + "...",
        });
    } catch (error) {
        logger.error("Error sending password reset email", error instanceof Error ? error : new Error(String(error)), {
            email,
        });
        throw error;
    }
}
