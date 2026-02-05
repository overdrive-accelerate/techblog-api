#!/usr/bin/env bun
/**
 * Test script to verify Resend email configuration
 * Usage: bun run scripts/test-email.ts your-email@example.com
 */

import { Resend } from "resend";

const testEmail = async (recipientEmail: string) => {
    // Check environment variables
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;

    if (!apiKey) {
        console.error("❌ RESEND_API_KEY is not set in environment variables");
        process.exitCode = 1;
        return;
    }

    if (!fromEmail) {
        console.error("❌ RESEND_FROM_EMAIL is not set in environment variables");
        process.exitCode = 1;
        return;
    }

    console.log("✓ Environment variables found");
    console.log(`  From: ${fromEmail}`);
    console.log(`  To: ${recipientEmail}`);
    console.log(`  API Key: [set]`);
    console.log("\n📧 Sending test email...\n");

    const resend = new Resend(apiKey);

    try {
        const result = await resend.emails.send({
            from: fromEmail,
            to: recipientEmail,
            subject: "Test Email - Blog API",
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                🎉 Resend is Working!
            </h1>
        </div>

        <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                Great news! Your Resend email configuration is working correctly.
            </p>

            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 24px 0;">
                <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #111827;">Configuration Details:</h2>
                <ul style="margin: 0; padding-left: 20px; color: #6b7280;">
                    <li style="margin: 8px 0;">From: <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${fromEmail}</code></li>
                    <li style="margin: 8px 0;">To: <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${recipientEmail}</code></li>
                    <li style="margin: 8px 0;">Service: Resend API</li>
                </ul>
            </div>

            <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280;">
                You can now use email verification and password reset features in your Blog API.
            </p>
        </div>

        <div style="text-align: center; margin-top: 24px; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">Tech Blog API - Test Email</p>
        </div>
    </div>
</body>
</html>
            `,
        });

        if (result.error) {
            console.error("❌ Failed to send email:");
            console.error(`   Error: ${result.error.message}`);
            console.error(`   Name: ${result.error.name}`);
            process.exitCode = 1;
            return;
        }

        console.log("✅ Email sent successfully!");
        console.log(`   Email ID: ${result.data?.id}`);
        console.log("\n📬 Check your inbox at:", recipientEmail);
        console.log("   (Also check spam folder if you don't see it)\n");
        process.exitCode = 0;
    } catch (error) {
        console.error("❌ Error sending email:");
        console.error(error);
        process.exitCode = 1;
    }
};

// Main execution
const main = async () => {
    // Get recipient email from command line argument
    const recipientEmail: string | undefined = process.argv[2];

    if (!recipientEmail) {
        console.error("Usage: bun run scripts/test-email.ts <recipient-email>");
        console.error("Example: bun run scripts/test-email.ts your-email@example.com");
        process.exitCode = 1;
        return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
        console.error(`❌ Invalid email format: ${recipientEmail}`);
        process.exitCode = 1;
        return;
    }

    // TypeScript now knows recipientEmail is string (narrowed by the checks above)
    await testEmail(recipientEmail);
};

// Run main and let event loop drain naturally
main();
