import { vi } from "vitest";

/**
 * Mock slug utility functions to avoid database calls during tests
 * This mock is registered globally in test-utils setup
 */

// Shared slugify implementation
const slugifyImpl = (text: string): string => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w\-]+/g, "")
        .replace(/\-\-+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "");
};

// Register the mock for the slug module
// Signatures match production code: (text/title/name, excludeId?, prisma?)
vi.mock("@/utils/slug", () => ({
    slugify: vi.fn((text: string) => slugifyImpl(text)),
    generateUniqueSlug: vi.fn(async (title: string, _excludeId?: string, _prisma?: any) => slugifyImpl(title)),
    generateUniqueTagSlug: vi.fn(async (name: string, _excludeId?: string, _prisma?: any) => slugifyImpl(name)),
}));
