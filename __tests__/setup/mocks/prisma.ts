import { vi } from "vitest";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import type {
    User,
    Post,
    Tag,
    Comment,
    PublishRequest,
    Profile,
} from "../../../generated/prisma/client.js";
import {
    Role,
    PostStatus,
    PublishRequestStatus,
} from "../../../generated/prisma/client.js";

// Register the mock using vi.mock
// This replaces the real @/lib/prisma module with our mock implementation
vi.mock("@/lib/prisma", async () => {
    const mockModule = await import("../../../src/lib/__mocks__/prisma.js");
    return {
        prisma: mockModule.prismaMock,
        prismaMock: mockModule.prismaMock,
        pool: mockModule.pool,
        disconnectDatabase: mockModule.disconnectDatabase,
    };
});

// Import and re-export the mock for use in tests
const mockModule = await import("../../../src/lib/__mocks__/prisma.js");
export const prismaMock = mockModule.prismaMock;
export type MockPrismaClient = typeof prismaMock;

// Note: Each test should set up its mock expectations using .mockResolvedValue() etc.
// Tests that need to check call counts should manually call .mockClear() in beforeEach
// NEVER use vi.clearAllMocks() as it breaks the manual Prisma mocks

// Re-export enums for convenience
export { Role, PostStatus, PublishRequestStatus };

// ============================================
// Mock Data Factories
// ============================================

/**
 * Create a mock User object
 */
export const mockUser = (overrides: Partial<User> = {}): User => ({
    id: "cltest1234567890123456780",
    email: "test@example.com",
    name: "Test User",
    role: Role.READER,
    emailVerified: true,
    image: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
});

/**
 * Create a mock Post object
 */
export const mockPost = (overrides: Partial<Post> = {}): Post => ({
    id: "clpost1234567890123456780",
    title: "Test Post",
    slug: "test-post",
    content: "Test content for the post",
    excerpt: "Test excerpt",
    status: PostStatus.DRAFT,
    isFeatured: false,
    viewCount: 0,
    publishedAt: null,
    authorId: "clauthor12345678901234567",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    coverImage: null,
    ...overrides,
});

/**
 * Create a mock Tag object
 */
export const mockTag = (overrides: Partial<Tag> = {}): Tag => ({
    id: "cltag12345678901234567809",
    name: "Test Tag",
    slug: "test-tag",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
});

/**
 * Create a mock Comment object
 */
export const mockComment = (overrides: Partial<Comment> = {}): Comment => ({
    id: "clcomment123456789012345",
    content: "Test comment content",
    postId: "clpost1234567890123456780",
    authorId: "clauthor12345678901234567",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
});

/**
 * Create a mock PublishRequest object
 */
export const mockPublishRequest = (overrides: Partial<PublishRequest> = {}): PublishRequest => ({
    id: "clpub1234567890123456780",
    postId: "clpost1234567890123456780",
    authorId: "clauthor12345678901234567",
    status: PublishRequestStatus.PENDING,
    message: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
});

/**
 * Create a mock Profile object
 */
export const mockProfile = (overrides: Partial<Profile> = {}): Profile => ({
    id: "clprofile12345678901234567",
    userId: "cluser1234567890123456780",
    name: "Test User",
    bio: "Test bio",
    avatar: null,
    website: "https://example.com",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
});

/**
 * Create a mock draft post
 */
export const mockDraftPost = (overrides: Partial<Post> = {}) =>
    mockPost({
        status: PostStatus.DRAFT,
        publishedAt: null,
        ...overrides,
    });

/**
 * Create a mock published post
 */
export const mockPublishedPost = (overrides: Partial<Post> = {}) =>
    mockPost({
        status: PostStatus.PUBLISHED,
        publishedAt: new Date("2024-01-15T00:00:00.000Z"),
        ...overrides,
    });
