import { vi } from "vitest";

/**
 * Mock slug utility functions to avoid database calls during tests
 */

// Simple slugify function
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
vi.mock("@/utils/slug", () => ({
    slugify: vi.fn((text: string) => slugifyImpl(text)),
    generateUniqueSlug: vi.fn(async (title: string, _excludeId?: string) => slugifyImpl(title)),
    generateUniqueTagSlug: vi.fn(async (name: string, _excludeId?: string) => slugifyImpl(name)),
}));
