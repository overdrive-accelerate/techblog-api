import { prisma as defaultPrisma } from "@/lib/prisma";
import type { PrismaClient } from "../../generated/prisma/client.js";

/**
 * Converts a string to a URL-friendly slug
 */
export function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-") // Replace spaces with -
        .replace(/[^\w\-]+/g, "") // Remove all non-word chars
        .replace(/\-\-+/g, "-") // Replace multiple - with single -
        .replace(/^-+/, "") // Trim - from start of text
        .replace(/-+$/, ""); // Trim - from end of text
}

// Type for the minimal Prisma client interface needed by these functions
type SlugPrismaClient = Pick<PrismaClient, "post" | "tag">;

/**
 * Generates a unique slug for a post with exponential backoff
 * If slug exists, appends a number (e.g., my-post-1, my-post-2)
 * Uses random jitter to reduce collision probability in high-concurrency scenarios
 * @param title - The title to generate a slug from
 * @param excludeId - Optional ID to exclude from uniqueness check (for updates)
 * @param prisma - Optional Prisma client (for testing)
 */
export async function generateUniqueSlug(
    title: string,
    excludeId?: string,
    prisma: SlugPrismaClient = defaultPrisma,
): Promise<string> {
    const baseSlug = slugify(title);
    let slug = baseSlug;
    let counter = 1;
    const maxAttempts = 10; // Increased from implicit infinite to explicit limit
    let attempt = 0;

    while (attempt < maxAttempts) {
        attempt++;

        const existing = await prisma.post.findUnique({
            where: { slug },
            select: { id: true },
        });

        // If no existing post or it's the same post being updated
        if (!existing || existing.id === excludeId) {
            return slug;
        }

        // Add exponential backoff with jitter to reduce collision probability
        if (attempt > 1) {
            const backoff = Math.min(100 * Math.pow(2, attempt - 2), 1000); // Max 1 second
            const jitter = Math.random() * 50; // Random jitter 0-50ms
            await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
        }

        // Try next variation - add random suffix for high-concurrency scenarios
        if (attempt > 5) {
            // After 5 attempts, add random suffix to break patterns
            const randomSuffix = Math.random().toString(36).substring(2, 6);
            slug = `${baseSlug}-${counter}-${randomSuffix}`;
        } else {
            slug = `${baseSlug}-${counter}`;
        }
        counter++;
    }

    // Fallback: use timestamp if we still can't find a unique slug
    const timestamp = Date.now().toString(36);
    return `${baseSlug}-${timestamp}`;
}

/**
 * Generates a unique slug for a tag with exponential backoff
 * @param name - The tag name to generate a slug from
 * @param excludeId - Optional ID to exclude from uniqueness check (for updates)
 * @param prisma - Optional Prisma client (for testing)
 */
export async function generateUniqueTagSlug(
    name: string,
    excludeId?: string,
    prisma: SlugPrismaClient = defaultPrisma,
): Promise<string> {
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let counter = 1;
    const maxAttempts = 10;
    let attempt = 0;

    while (attempt < maxAttempts) {
        attempt++;

        const existing = await prisma.tag.findUnique({
            where: { slug },
            select: { id: true },
        });

        if (!existing || existing.id === excludeId) {
            return slug;
        }

        // Add exponential backoff with jitter
        if (attempt > 1) {
            const backoff = Math.min(100 * Math.pow(2, attempt - 2), 1000);
            const jitter = Math.random() * 50;
            await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
        }

        slug = `${baseSlug}-${counter}`;
        counter++;
    }

    // Fallback with timestamp
    const timestamp = Date.now().toString(36);
    return `${baseSlug}-${timestamp}`;
}
