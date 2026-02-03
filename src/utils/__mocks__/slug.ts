import { vi } from "vitest";

/**
 * Mock slug utility functions
 * These are used in tests to avoid hitting the real database
 */

// Simple slugify function that converts text to slug format
export const slugify = vi.fn((text: string): string => {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
});

// Mock generateUniqueSlug - returns slugified name (for posts)
export const generateUniqueSlug = vi.fn(
    async (title: string, _excludeId?: string): Promise<string> => {
        return slugify(title);
    }
);

// Mock generateUniqueTagSlug - returns slugified name
export const generateUniqueTagSlug = vi.fn(
    async (name: string, _excludeId?: string): Promise<string> => {
        return slugify(name);
    }
);
