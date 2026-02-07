import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Post, User } from "../../../generated/prisma/client.js";
import { PostStatus, Role } from "../../../generated/prisma/client.js";
import {
    setupAdminAuth,
    setupAuthorAuth,
    setupReaderAuth,
    setupUnauthenticated,
    mockAuthorSession,
    mockAuth,
} from "../../setup/mocks/auth";
import { prismaMock } from "../../setup/mocks/prisma";

// Helper to get mock function with correct type
type MockedFunction = ReturnType<typeof vi.fn>;
const getMock = (fn: any): MockedFunction => fn as MockedFunction;

// Slug mock is registered globally in test-utils setup

// Mock sanitize utility
vi.mock("@/utils/sanitize", () => ({
    sanitizeText: vi.fn((text: string) => text),
    sanitizeMarkdown: vi.fn((text: string) => text),
}));

// Import after mocks
import { createPostsRoute } from "../../../src/routes/posts";

// Helper to create test app
const createApp = () => {
    const app = new Hono();
    const postsRoute = createPostsRoute(prismaMock, mockAuth);
    app.route("/api/posts", postsRoute);

    // Error handler for validation and other errors
    app.onError((err, c) => {
        if (err instanceof HTTPException) {
            const response: Record<string, unknown> = {
                error: err.message,
                status: err.status,
            };
            if (err.cause) {
                response.issues = err.cause;
            }
            return c.json(response, err.status);
        }
        return c.json({ error: "Internal Server Error" }, 500);
    });
    return app;
};

// Mock factories
const createMockUser = (overrides: Partial<User> = {}): User => ({
    id: "clauthor12345678901234560",
    email: "author@example.com",
    name: "Test Author",
    role: Role.AUTHOR,
    emailVerified: true,
    image: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

const createMockPost = (overrides: Partial<Post> = {}): Post => ({
    id: "clpost1234567890123456780",
    title: "Test Post",
    slug: "test-post",
    content: "This is test content",
    excerpt: "Test excerpt",
    coverImage: null,
    status: PostStatus.DRAFT,
    viewCount: 0,
    isFeatured: false,
    publishedAt: null,
    authorId: "clauthor12345678901234567",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

describe("Posts Route", () => {
    let app: ReturnType<typeof createApp>;

    beforeEach(() => {
        // Mock reset handled by setup
        vi.clearAllMocks();
        app = createApp();
    });

    describe("GET /api/posts", () => {
        it("should return published posts for unauthenticated users", async () => {
            setupUnauthenticated();
            const mockPosts = [
                {
                    ...createMockPost({ status: PostStatus.PUBLISHED }),
                    author: createMockUser(),
                    tags: [],
                    _count: { comments: 2 },
                },
            ];
            getMock(prismaMock.post.findMany).mockResolvedValue(mockPosts as never);
            getMock(prismaMock.post.count).mockResolvedValue(1);

            const res = await app.request("/api/posts");
            const body: any = await res.json();

            expect(res.status).toBe(200);
            expect(body.posts).toHaveLength(1);
            expect(body.pagination).toBeDefined();
            expect(body.pagination.total).toBe(1);
        });

        it("should include pagination info", async () => {
            setupUnauthenticated();
            getMock(prismaMock.post.findMany).mockResolvedValue([]);
            getMock(prismaMock.post.count).mockResolvedValue(50);

            const res = await app.request("/api/posts?page=2&limit=10");
            const body: any = await res.json();

            expect(res.status).toBe(200);
            expect(body.pagination.page).toBe(2);
            expect(body.pagination.limit).toBe(10);
            expect(body.pagination.total).toBe(50);
            expect(body.pagination.totalPages).toBe(5);
        });

        it("should filter by tag slug", async () => {
            setupUnauthenticated();
            getMock(prismaMock.post.findMany).mockResolvedValue([]);
            getMock(prismaMock.post.count).mockResolvedValue(0);

            const res = await app.request("/api/posts?tagSlug=javascript");

            expect(res.status).toBe(200);
            expect(getMock(prismaMock.post.findMany)).toHaveBeenCalled();
        });

        it("should filter by featured status", async () => {
            setupUnauthenticated();
            getMock(prismaMock.post.findMany).mockResolvedValue([]);
            getMock(prismaMock.post.count).mockResolvedValue(0);

            const res = await app.request("/api/posts?isFeatured=true");

            expect(res.status).toBe(200);
        });

        it("should support search parameter", async () => {
            setupUnauthenticated();
            getMock(prismaMock.post.findMany).mockResolvedValue([]);
            getMock(prismaMock.post.count).mockResolvedValue(0);

            const res = await app.request("/api/posts?search=typescript");

            expect(res.status).toBe(200);
        });

        it("should allow admin to see all posts with status filter", async () => {
            setupAdminAuth();
            getMock(prismaMock.post.findMany).mockResolvedValue([]);
            getMock(prismaMock.post.count).mockResolvedValue(0);

            const res = await app.request("/api/posts?status=DRAFT", {
                headers: { Cookie: "better-auth.session_token=test-token" },
            });

            expect(res.status).toBe(200);
        });
    });

    describe("GET /api/posts/:slug", () => {
        it("should return published post by slug", async () => {
            setupUnauthenticated();
            const mockPost = {
                ...createMockPost({ status: PostStatus.PUBLISHED }),
                author: createMockUser(),
                tags: [],
                comments: [],
            };
            getMock(prismaMock.post.findUnique).mockResolvedValue(mockPost as never);
            getMock(prismaMock.post.update).mockResolvedValue(mockPost as never);

            const res = await app.request("/api/posts/test-post");
            const body: any = await res.json();

            expect(res.status).toBe(200);
            expect(body.title).toBe("Test Post");
        });

        it("should increment view count for published posts", async () => {
            setupUnauthenticated();
            const mockPost = {
                ...createMockPost({ status: PostStatus.PUBLISHED }),
                author: createMockUser(),
                tags: [],
                comments: [],
            };
            getMock(prismaMock.post.findUnique).mockResolvedValue(mockPost as never);
            getMock(prismaMock.post.update).mockResolvedValue(mockPost as never);

            await app.request("/api/posts/test-post");

            expect(getMock(prismaMock.post.update)).toHaveBeenCalledWith({
                where: { id: mockPost.id },
                data: { viewCount: { increment: 1 } },
            });
        });

        it("should return 404 for non-existent post", async () => {
            setupUnauthenticated();
            getMock(prismaMock.post.findUnique).mockResolvedValue(null);

            const res = await app.request("/api/posts/cnotfound1234567890123450");
            const body: any = await res.json();

            expect(res.status).toBe(404);
            expect(body.error).toBe("Post not found");
        });

        it("should return 404 for draft post when unauthenticated", async () => {
            setupUnauthenticated();
            const mockPost = {
                ...createMockPost({ status: PostStatus.DRAFT }),
                author: createMockUser(),
                tags: [],
                comments: [],
            };
            getMock(prismaMock.post.findUnique).mockResolvedValue(mockPost as never);

            const res = await app.request("/api/posts/test-post");
            const body: any = await res.json();

            expect(res.status).toBe(404);
            expect(body.error).toBe("Post not found");
        });

        it("should allow author to view their own draft", async () => {
            const authorSession = mockAuthorSession();
            setupAuthorAuth();
            const mockPost = {
                ...createMockPost({
                    status: PostStatus.DRAFT,
                    authorId: authorSession.user.id,
                }),
                author: createMockUser({ id: authorSession.user.id }),
                tags: [],
                comments: [],
            };
            getMock(prismaMock.post.findUnique).mockResolvedValue(mockPost as never);

            const res = await app.request("/api/posts/test-post", {
                headers: { Cookie: "better-auth.session_token=test-token" },
            });
            const body: any = await res.json();

            expect(res.status).toBe(200);
            expect(body.title).toBe("Test Post");
        });
    });

    describe("GET /api/posts/by-id/:id", () => {
        it("should return post by ID for author", async () => {
            const authorSession = mockAuthorSession();
            setupAuthorAuth();
            const mockPost = {
                ...createMockPost({ authorId: authorSession.user.id }),
                author: createMockUser({ id: authorSession.user.id }),
                tags: [],
                comments: [],
            };
            getMock(prismaMock.post.findUnique).mockResolvedValue(mockPost as never);

            const res = await app.request(`/api/posts/by-id/${mockPost.id}`, {
                headers: { Cookie: "better-auth.session_token=test-token" },
            });
            const body: any = await res.json();

            expect(res.status).toBe(200);
            expect(body.title).toBe("Test Post");
        });

        it("should return 401 when not authenticated", async () => {
            setupUnauthenticated();

            const res = await app.request("/api/posts/by-id/some-id");

            expect(res.status).toBe(401);
        });

        it("should return 403 when user is not owner or admin", async () => {
            setupAuthorAuth();
            const mockPost = {
                ...createMockPost({ authorId: "different-author-id" }),
                author: createMockUser({ id: "different-author-id" }),
                tags: [],
                comments: [],
            };
            getMock(prismaMock.post.findUnique).mockResolvedValue(mockPost as never);

            const res = await app.request(`/api/posts/by-id/${mockPost.id}`, {
                headers: { Cookie: "better-auth.session_token=test-token" },
            });
            const body: any = await res.json();

            expect(res.status).toBe(403);
            expect(body.error).toBe("Forbidden");
        });

        it("should allow admin to view any post", async () => {
            setupAdminAuth();
            const mockPost = {
                ...createMockPost({ authorId: "different-author-id" }),
                author: createMockUser({ id: "different-author-id" }),
                tags: [],
                comments: [],
            };
            getMock(prismaMock.post.findUnique).mockResolvedValue(mockPost as never);

            const res = await app.request(`/api/posts/by-id/${mockPost.id}`, {
                headers: { Cookie: "better-auth.session_token=test-token" },
            });

            expect(res.status).toBe(200);
        });
    });

    describe("POST /api/posts", () => {
        it("should create post when author is authenticated", async () => {
            const authorSession = mockAuthorSession();
            setupAuthorAuth();
            const newPost = {
                ...createMockPost({ authorId: authorSession.user.id }),
                author: createMockUser({ id: authorSession.user.id }),
                tags: [],
            };

            // Mock slug uniqueness check
            getMock(prismaMock.post.findUnique).mockResolvedValue(null);

            // Mock transaction
            getMock(prismaMock.$transaction).mockImplementation(async (fn: any) => {
                return fn({
                    tag: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
                    post: { create: vi.fn().mockResolvedValue(newPost) },
                });
            });

            const res = await app.request("/api/posts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Cookie: "better-auth.session_token=test-token",
                },
                body: JSON.stringify({
                    title: "Test Post",
                    content: "This is test content",
                }),
            });
            const body: any = await res.json();

            expect(res.status).toBe(201);
            expect(body.title).toBe("Test Post");
        });

        it("should return 401 when not authenticated", async () => {
            setupUnauthenticated();

            const res = await app.request("/api/posts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: "Test Post",
                    content: "Content",
                }),
            });

            expect(res.status).toBe(401);
        });

        it("should return 403 when user is reader (not author/admin)", async () => {
            setupReaderAuth();

            const res = await app.request("/api/posts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Cookie: "better-auth.session_token=test-token",
                },
                body: JSON.stringify({
                    title: "Test Post",
                    content: "Content",
                }),
            });

            expect(res.status).toBe(403);
        });

        it("should return 400 for invalid body", async () => {
            setupAuthorAuth();

            const res = await app.request("/api/posts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Cookie: "better-auth.session_token=test-token",
                },
                body: JSON.stringify({
                    title: "", // Empty title should fail validation
                    content: "",
                }),
            });

            expect(res.status).toBe(400);
        });
    });

    describe("PUT /api/posts/:id", () => {
        it("should update post when owner is authenticated", async () => {
            const authorSession = mockAuthorSession();
            setupAuthorAuth();
            const existingPost = createMockPost({ authorId: authorSession.user.id });
            const updatedPost = {
                ...existingPost,
                title: "Updated Title",
                author: createMockUser({ id: authorSession.user.id }),
                tags: [],
            };

            getMock(prismaMock.post.findUnique).mockResolvedValue(existingPost);
            getMock(prismaMock.$transaction).mockImplementation(async (fn: any) => {
                return fn({
                    postTag: { deleteMany: vi.fn() },
                    tag: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
                    post: { update: vi.fn().mockResolvedValue(updatedPost) },
                });
            });

            const res = await app.request(`/api/posts/${existingPost.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Cookie: "better-auth.session_token=test-token",
                },
                body: JSON.stringify({ title: "Updated Title" }),
            });
            const body: any = await res.json();

            expect(res.status).toBe(200);
            expect(body.title).toBe("Updated Title");
        });

        it("should return 404 when post not found", async () => {
            setupAuthorAuth();
            getMock(prismaMock.post.findUnique).mockResolvedValue(null);

            const res = await app.request("/api/posts/cnotfound1234567890123450", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Cookie: "better-auth.session_token=test-token",
                },
                body: JSON.stringify({ title: "Updated Title" }),
            });
            const body: any = await res.json();

            expect(res.status).toBe(404);
            expect(body.error).toBe("Post not found");
        });

        it("should return 403 when user is not owner or admin", async () => {
            setupAuthorAuth();
            const existingPost = createMockPost({ authorId: "different-author-id" });
            getMock(prismaMock.post.findUnique).mockResolvedValue(existingPost);

            const res = await app.request(`/api/posts/${existingPost.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Cookie: "better-auth.session_token=test-token",
                },
                body: JSON.stringify({ title: "Updated Title" }),
            });
            const body: any = await res.json();

            expect(res.status).toBe(403);
            expect(body.error).toBe("Forbidden");
        });

        it("should allow admin to update any post", async () => {
            setupAdminAuth();
            const existingPost = createMockPost({ authorId: "different-author-id" });
            const updatedPost = {
                ...existingPost,
                title: "Admin Updated",
                author: createMockUser({ id: "different-author-id" }),
                tags: [],
            };

            getMock(prismaMock.post.findUnique).mockResolvedValue(existingPost);
            getMock(prismaMock.$transaction).mockImplementation(async (fn: any) => {
                return fn({
                    postTag: { deleteMany: vi.fn() },
                    tag: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
                    post: { update: vi.fn().mockResolvedValue(updatedPost) },
                });
            });

            const res = await app.request(`/api/posts/${existingPost.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Cookie: "better-auth.session_token=test-token",
                },
                body: JSON.stringify({ title: "Admin Updated" }),
            });

            expect(res.status).toBe(200);
        });
    });

    describe("DELETE /api/posts/:id", () => {
        it("should delete post when owner is authenticated", async () => {
            const authorSession = mockAuthorSession();
            setupAuthorAuth();
            const existingPost = createMockPost({ authorId: authorSession.user.id });

            getMock(prismaMock.post.findUnique).mockResolvedValue(existingPost);
            getMock(prismaMock.post.delete).mockResolvedValue(existingPost);

            const res = await app.request(`/api/posts/${existingPost.id}`, {
                method: "DELETE",
                headers: { Cookie: "better-auth.session_token=test-token" },
            });
            const body: any = await res.json();

            expect(res.status).toBe(200);
            expect(body.message).toBe("Post deleted successfully");
        });

        it("should return 404 when post not found", async () => {
            setupAuthorAuth();
            getMock(prismaMock.post.findUnique).mockResolvedValue(null);

            const res = await app.request("/api/posts/cnotfound1234567890123450", {
                method: "DELETE",
                headers: { Cookie: "better-auth.session_token=test-token" },
            });
            const body: any = await res.json();

            expect(res.status).toBe(404);
            expect(body.error).toBe("Post not found");
        });

        it("should return 403 when user is not owner or admin", async () => {
            setupAuthorAuth();
            const existingPost = createMockPost({ authorId: "different-author-id" });
            getMock(prismaMock.post.findUnique).mockResolvedValue(existingPost);

            const res = await app.request(`/api/posts/${existingPost.id}`, {
                method: "DELETE",
                headers: { Cookie: "better-auth.session_token=test-token" },
            });
            const body: any = await res.json();

            expect(res.status).toBe(403);
            expect(body.error).toBe("Forbidden");
        });

        it("should allow admin to delete any post", async () => {
            setupAdminAuth();
            const existingPost = createMockPost({ authorId: "different-author-id" });

            getMock(prismaMock.post.findUnique).mockResolvedValue(existingPost);
            getMock(prismaMock.post.delete).mockResolvedValue(existingPost);

            const res = await app.request(`/api/posts/${existingPost.id}`, {
                method: "DELETE",
                headers: { Cookie: "better-auth.session_token=test-token" },
            });
            const body: any = await res.json();

            expect(res.status).toBe(200);
            expect(body.message).toBe("Post deleted successfully");
        });

        it("should return 401 when not authenticated", async () => {
            setupUnauthenticated();

            const res = await app.request("/api/posts/some-id", {
                method: "DELETE",
            });

            expect(res.status).toBe(401);
        });
    });
});
