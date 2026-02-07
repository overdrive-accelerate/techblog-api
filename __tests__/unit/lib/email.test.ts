import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mockResendSend, resetResendMock } from "../../setup/mocks/resend";

// Mock the Resend module with proper constructor
vi.mock("resend", () => {
    // Create a mock class that properly implements constructor
    class MockResend {
        emails = {
            send: mockResendSend,
        };
        constructor(_apiKey: string) {
            // Constructor just initializes the emails object
        }
    }

    return {
        Resend: MockResend,
    };
});

// Import AFTER mocking
import { sendVerificationEmail, sendResetPasswordEmail, resetResendClient } from "../../../src/lib/email";

// Mock logger to suppress logs during tests
vi.mock("@/utils/logger", () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

describe("Email Service", () => {
    beforeEach(() => {
        // Ensure test environment variables are set
        // Using type assertion to override readonly restriction in tests
        (process.env as any).NODE_ENV = "test";
        process.env.RESEND_API_KEY = "re_test_api_key";
        process.env.RESEND_FROM_EMAIL = "noreply@test.com";

        resetResendMock();
    });

    afterEach(() => {
        vi.clearAllMocks();
        resetResendClient(); // Reset cached Resend client between tests
    });

    describe("sendVerificationEmail", () => {
        const testEmail = "user@example.com";
        const testUrl = "https://example.com/verify?token=abc123";
        const testToken = "abc123xyz789";

        it("should send verification email successfully", async () => {
            mockResendSend.mockResolvedValue({
                data: { id: "email-123" },
                error: null,
            });

            await expect(sendVerificationEmail(testEmail, testUrl, testToken)).resolves.toBeUndefined();

            expect(mockResendSend).toHaveBeenCalledTimes(1);
            expect(mockResendSend).toHaveBeenCalledWith({
                from: "noreply@test.com",
                to: testEmail,
                subject: "Verify your email address - Tech Blog",
                html: expect.stringContaining("Verify Your Email Address"),
            });
        });

        it("should include verification URL in email HTML", async () => {
            mockResendSend.mockResolvedValue({
                data: { id: "email-123" },
                error: null,
            });

            await sendVerificationEmail(testEmail, testUrl, testToken);

            const callArgs = mockResendSend.mock.calls[0]?.[0];
            expect(callArgs).toBeDefined();
            expect(callArgs?.html).toContain(testUrl);
            expect(callArgs?.html).toContain("Verify Email Address");
        });

        it("should include branding in email template", async () => {
            mockResendSend.mockResolvedValue({
                data: { id: "email-123" },
                error: null,
            });

            await sendVerificationEmail(testEmail, testUrl, testToken);

            const callArgs = mockResendSend.mock.calls[0]?.[0];
            expect(callArgs).toBeDefined();
            expect(callArgs?.html).toContain("Tech Blog");
            expect(callArgs?.html).toContain("Share Your Technical Journey");
        });

        it("should include expiration warning in email", async () => {
            mockResendSend.mockResolvedValue({
                data: { id: "email-123" },
                error: null,
            });

            await sendVerificationEmail(testEmail, testUrl, testToken);

            const callArgs = mockResendSend.mock.calls[0]?.[0];
            expect(callArgs).toBeDefined();
            expect(callArgs?.html).toContain("1 hour");
            expect(callArgs?.html).toContain("expire");
        });

        it("should throw error when Resend API returns error", async () => {
            const apiError = {
                name: "validation_error",
                message: "Invalid email address",
            };

            mockResendSend.mockResolvedValue({
                data: null,
                error: apiError,
            });

            await expect(sendVerificationEmail(testEmail, testUrl, testToken)).rejects.toThrow(
                "Failed to send verification email: Invalid email address",
            );
        });

        it("should throw error when Resend client throws", async () => {
            mockResendSend.mockRejectedValue(new Error("Network error"));

            await expect(sendVerificationEmail(testEmail, testUrl, testToken)).rejects.toThrow("Network error");
        });

        it("should handle empty email gracefully", async () => {
            mockResendSend.mockResolvedValue({
                data: { id: "email-123" },
                error: null,
            });

            await sendVerificationEmail("", testUrl, testToken);

            expect(mockResendSend).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: "",
                }),
            );
        });
    });

    describe("sendResetPasswordEmail", () => {
        const testEmail = "user@example.com";
        const testUrl = "https://example.com/reset?token=xyz789";
        const testToken = "xyz789abc123";

        it("should send password reset email successfully", async () => {
            mockResendSend.mockResolvedValue({
                data: { id: "email-456" },
                error: null,
            });

            await expect(sendResetPasswordEmail(testEmail, testUrl, testToken)).resolves.toBeUndefined();

            expect(mockResendSend).toHaveBeenCalledTimes(1);
            expect(mockResendSend).toHaveBeenCalledWith({
                from: "noreply@test.com",
                to: testEmail,
                subject: "Reset your password - Tech Blog",
                html: expect.stringContaining("Reset Your Password"),
            });
        });

        it("should include reset URL in email HTML", async () => {
            mockResendSend.mockResolvedValue({
                data: { id: "email-456" },
                error: null,
            });

            await sendResetPasswordEmail(testEmail, testUrl, testToken);

            const callArgs = mockResendSend.mock.calls[0]?.[0];
            expect(callArgs).toBeDefined();
            expect(callArgs?.html).toContain(testUrl);
            expect(callArgs?.html).toContain("Reset Password");
        });

        it("should include security warning in password reset email", async () => {
            mockResendSend.mockResolvedValue({
                data: { id: "email-456" },
                error: null,
            });

            await sendResetPasswordEmail(testEmail, testUrl, testToken);

            const callArgs = mockResendSend.mock.calls[0]?.[0];
            expect(callArgs).toBeDefined();
            expect(callArgs?.html).toContain("Security Note");
            expect(callArgs?.html).toContain("Never share");
        });

        it("should include expiration warning in password reset email", async () => {
            mockResendSend.mockResolvedValue({
                data: { id: "email-456" },
                error: null,
            });

            await sendResetPasswordEmail(testEmail, testUrl, testToken);

            const callArgs = mockResendSend.mock.calls[0]?.[0];
            expect(callArgs).toBeDefined();
            expect(callArgs?.html).toContain("1 hour");
            expect(callArgs?.html).toContain("expire");
        });

        it("should throw error when Resend API returns error", async () => {
            const apiError = {
                name: "rate_limit_exceeded",
                message: "Too many requests",
            };

            mockResendSend.mockResolvedValue({
                data: null,
                error: apiError,
            });

            await expect(sendResetPasswordEmail(testEmail, testUrl, testToken)).rejects.toThrow(
                "Failed to send password reset email: Too many requests",
            );
        });

        it("should throw error when Resend client throws", async () => {
            mockResendSend.mockRejectedValue(new Error("Service unavailable"));

            await expect(sendResetPasswordEmail(testEmail, testUrl, testToken)).rejects.toThrow("Service unavailable");
        });

        it("should include disclaimer about ignoring email", async () => {
            mockResendSend.mockResolvedValue({
                data: { id: "email-456" },
                error: null,
            });

            await sendResetPasswordEmail(testEmail, testUrl, testToken);

            const callArgs = mockResendSend.mock.calls[0]?.[0];
            expect(callArgs).toBeDefined();
            expect(callArgs?.html).toContain("didn't request");
            expect(callArgs?.html).toContain("safely ignore");
        });
    });

    describe("Email Template Consistency", () => {
        it("should use consistent branding across all emails", async () => {
            mockResendSend.mockResolvedValue({
                data: { id: "email-123" },
                error: null,
            });

            await sendVerificationEmail("test@example.com", "https://example.com/verify", "token123");
            const verifyHtml = mockResendSend.mock.calls[0]?.[0]?.html;
            expect(verifyHtml).toBeDefined();

            mockResendSend.mockClear();
            await sendResetPasswordEmail("test@example.com", "https://example.com/reset", "token456");
            const resetHtml = mockResendSend.mock.calls[0]?.[0]?.html;
            expect(resetHtml).toBeDefined();

            // Both should contain the same branding elements
            expect(verifyHtml).toContain("Tech Blog");
            expect(resetHtml).toContain("Tech Blog");

            // Both should have consistent footer
            expect(verifyHtml).toContain("All rights reserved");
            expect(resetHtml).toContain("All rights reserved");
        });

        it("should include copy-paste URL option in all emails", async () => {
            mockResendSend.mockResolvedValue({
                data: { id: "email-123" },
                error: null,
            });

            const testUrl = "https://example.com/action";

            await sendVerificationEmail("test@example.com", testUrl, "token123");
            const verifyHtml = mockResendSend.mock.calls[0]?.[0]?.html;
            expect(verifyHtml).toBeDefined();

            mockResendSend.mockClear();
            await sendResetPasswordEmail("test@example.com", testUrl, "token456");
            const resetHtml = mockResendSend.mock.calls[0]?.[0]?.html;
            expect(resetHtml).toBeDefined();

            // Both should allow copy-paste of URL
            expect(verifyHtml).toContain("copy and paste");
            expect(resetHtml).toContain("copy and paste");
        });
    });
});
