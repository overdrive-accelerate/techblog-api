import { vi } from "vitest";

/**
 * Mock slug utility functions
 * These are used in tests to avoid hitting the real database
 */

// Helper function for slug transformation (shared logic)
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

// Simple slugify function that converts text to slug format
export const slugify = vi.fn((text: string): string => {
    return slugifyImpl(text);
});

// Mock generateUniqueSlug - returns slugified name (for posts)
// Matches production signature: (title, excludeId?, prisma?)
export const generateUniqueSlug = vi.fn(async (title: string, _excludeId?: string, _prisma?: any): Promise<string> => {
    return slugifyImpl(title);
});

// Mock generateUniqueTagSlug - returns slugified name (for tags)
// Matches production signature: (name, excludeId?, prisma?)
export const generateUniqueTagSlug = vi.fn(
    async (name: string, _excludeId?: string, _prisma?: any): Promise<string> => {
        return slugifyImpl(name);
    },
);
