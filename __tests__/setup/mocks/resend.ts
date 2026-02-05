import { vi } from "vitest";

/**
 * Mock Resend client for testing
 * Fully mocks the Resend API without making actual network calls
 */

export const mockResendSend = vi.fn();

export const mockResend = {
    emails: {
        send: mockResendSend,
    },
};

// Mock Resend constructor
export const ResendMock = vi.fn(() => mockResend);

// Reset mock between tests
export function resetResendMock() {
    mockResendSend.mockReset();
    mockResendSend.mockResolvedValue({
        data: { id: "mock-email-id-123" },
        error: null,
    });
}
