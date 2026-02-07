import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { setupAuthorAuth, setupAdminAuth, setupUnauthenticated, mockAuth } from "../../setup/mocks/auth";
import { prismaMock } from "../../setup/mocks/prisma";
import { mockSupabaseStorage } from "../../setup/mocks/supabase";

// Helper to get mock function with correct type
type MockedFunction = ReturnType<typeof vi.fn>;
const getMock = (fn: any): MockedFunction => fn as MockedFunction;

// Mock sanitize utility
vi.mock("@/utils/sanitize", () => ({
    sanitizeFileName: vi.fn((name: string) => name.replace(/[^a-zA-Z0-9_-]/g, "_")),
    sanitizeText: vi.fn((text: string) => text),
    sanitizeMarkdown: vi.fn((text: string) => text),
    sanitizeUrl: vi.fn((url: string) => url),
    escapeHtml: vi.fn((text: string) => text),
}));

// Import after mocks are registered by setup
import { createUploadRoute } from "../../../src/routes/upload";
import { validateEnv } from "../../../src/config/env";

// Initialize env validation for this test file (uses process.env set in test-utils.ts)
validateEnv();

// Helper to create test app
const createApp = () => {
    const app = new Hono();
    const uploadRoute = createUploadRoute(mockAuth, prismaMock);
    app.route("/api/upload", uploadRoute);

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

// Helper to create a valid JPEG file
const createJpegFile = (size: number = 1024): File => {
    // JPEG magic bytes: FF D8 FF
    const buffer = new Uint8Array(size);
    buffer[0] = 0xff;
    buffer[1] = 0xd8;
    buffer[2] = 0xff;
    const blob = new Blob([buffer], { type: "image/jpeg" });
    return new File([blob], "test.jpg", { type: "image/jpeg" });
};

// Helper to create a valid PNG file
const createPngFile = (size: number = 1024): File => {
    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    const buffer = new Uint8Array(size);
    buffer[0] = 0x89;
    buffer[1] = 0x50;
    buffer[2] = 0x4e;
    buffer[3] = 0x47;
    buffer[4] = 0x0d;
    buffer[5] = 0x0a;
    buffer[6] = 0x1a;
    buffer[7] = 0x0a;
    const blob = new Blob([buffer], { type: "image/png" });
    return new File([blob], "test.png", { type: "image/png" });
};

// Helper to create a fake file (wrong magic bytes)
const createFakeImageFile = (size: number = 1024): File => {
    // Wrong magic bytes - not a real image
    const buffer = new Uint8Array(size);
    buffer[0] = 0x00;
    buffer[1] = 0x00;
    buffer[2] = 0x00;
    const blob = new Blob([buffer], { type: "image/jpeg" });
    return new File([blob], "fake.jpg", { type: "image/jpeg" });
};

describe("Upload Route", () => {
    let app: ReturnType<typeof createApp>;

    beforeEach(() => {
        // DO NOT call vi.clearAllMocks() - it breaks manual Prisma mocks
        // Instead, clear only the mocks owned by this test file
        getMock(prismaMock.upload.create).mockClear();
        getMock(prismaMock.upload.findUnique).mockClear();
        getMock(prismaMock.upload.delete).mockClear();
        mockSupabaseStorage.from.mockClear();

        app = createApp();
    });

    describe("POST /api/upload/image", () => {
        it("should upload a valid JPEG image", async () => {
            setupAuthorAuth();
            const file = createJpegFile(1024);

            mockSupabaseStorage.from.mockReturnValue({
                upload: vi.fn().mockResolvedValue({ data: { path: "test-path" }, error: null }),
                getPublicUrl: vi.fn().mockReturnValue({
                    data: { publicUrl: "https://example.com/test.jpg" },
                }),
            } as any);

            getMock(prismaMock.upload.create).mockResolvedValue({
                id: "upload123",
                filePath: "blog-images/user123/test.jpg",
                fileName: "test.jpg",
                mimeType: "image/jpeg",
                fileSize: 1024,
                url: "https://example.com/test.jpg",
                userId: "clauthor12345678901234567",
                createdAt: new Date(),
            } as any);

            const formData = new FormData();
            formData.append("file", file);

            const res = await app.request("/api/upload/image", {
                method: "POST",
                headers: { Cookie: "better-auth.session_token=test-token" },
                body: formData,
            });
            const body: any = await res.json();

            expect(res.status).toBe(200);
            expect(body.url).toBeDefined();
            expect(body.path).toBeDefined();
            expect(body.size).toBe(1024);
            expect(body.type).toBe("image/jpeg");
        });

        it("should upload a valid PNG image", async () => {
            setupAuthorAuth();
            const file = createPngFile(2048);

            mockSupabaseStorage.from.mockReturnValue({
                upload: vi.fn().mockResolvedValue({ data: { path: "test-path" }, error: null }),
                getPublicUrl: vi.fn().mockReturnValue({
                    data: { publicUrl: "https://example.com/test.png" },
                }),
            } as any);

            getMock(prismaMock.upload.create).mockResolvedValue({
                id: "upload123",
                filePath: "blog-images/user123/test.png",
                fileName: "test.png",
                mimeType: "image/png",
                fileSize: 2048,
                url: "https://example.com/test.png",
                userId: "clauthor12345678901234567",
                createdAt: new Date(),
            } as any);

            const formData = new FormData();
            formData.append("file", file);

            const res = await app.request("/api/upload/image", {
                method: "POST",
                headers: { Cookie: "better-auth.session_token=test-token" },
                body: formData,
            });

            expect(res.status).toBe(200);
        });

        it("should return 400 when no file provided", async () => {
            setupAuthorAuth();

            const formData = new FormData();

            const res = await app.request("/api/upload/image", {
                method: "POST",
                headers: { Cookie: "better-auth.session_token=test-token" },
                body: formData,
            });
            const body: any = await res.json();

            expect(res.status).toBe(400);
            expect(body.error).toBe("No file provided");
        });

        it("should return 400 for invalid file type", async () => {
            setupAuthorAuth();

            const buffer = new Uint8Array(1024);
            const blob = new Blob([buffer], { type: "application/pdf" });
            const file = new File([blob], "document.pdf", { type: "application/pdf" });

            const formData = new FormData();
            formData.append("file", file);

            const res = await app.request("/api/upload/image", {
                method: "POST",
                headers: { Cookie: "better-auth.session_token=test-token" },
                body: formData,
            });
            const body: any = await res.json();

            expect(res.status).toBe(400);
            expect(body.error).toBe("Invalid file type");
            expect(body.allowed).toBeDefined();
        });

        it("should return 400 for file size exceeding 5MB", async () => {
            setupAuthorAuth();

            const largeFile = createJpegFile(6 * 1024 * 1024); // 6MB

            const formData = new FormData();
            formData.append("file", largeFile);

            const res = await app.request("/api/upload/image", {
                method: "POST",
                headers: { Cookie: "better-auth.session_token=test-token" },
                body: formData,
            });
            const body: any = await res.json();

            expect(res.status).toBe(400);
            expect(body.error).toBe("File too large");
            expect(body.maxSize).toBe("5MB");
            expect(body.receivedSize).toBeDefined();
        });

        it("should return 400 for file with invalid magic bytes (spoofed type)", async () => {
            setupAuthorAuth();

            const fakeFile = createFakeImageFile(1024);

            const formData = new FormData();
            formData.append("file", fakeFile);

            const res = await app.request("/api/upload/image", {
                method: "POST",
                headers: { Cookie: "better-auth.session_token=test-token" },
                body: formData,
            });
            const body: any = await res.json();

            expect(res.status).toBe(400);
            expect(body.error).toBe("Invalid file content");
        });

        it("should return 401 when not authenticated", async () => {
            setupUnauthenticated();

            const file = createJpegFile(1024);
            const formData = new FormData();
            formData.append("file", file);

            const res = await app.request("/api/upload/image", {
                method: "POST",
                body: formData,
            });

            expect(res.status).toBe(401);
        });

        it("should sanitize filename to prevent path traversal", async () => {
            setupAuthorAuth();

            const file = createJpegFile(1024);
            // Simulate a file with dangerous characters
            Object.defineProperty(file, "name", {
                value: "../../../etc/passwd.jpg",
                writable: false,
            });

            mockSupabaseStorage.from.mockReturnValue({
                upload: vi.fn().mockResolvedValue({ data: { path: "test-path" }, error: null }),
                getPublicUrl: vi.fn().mockReturnValue({
                    data: { publicUrl: "https://example.com/test.jpg" },
                }),
            } as any);

            getMock(prismaMock.upload.create).mockResolvedValue({
                id: "upload123",
                filePath: "blog-images/user123/sanitized.jpg",
                fileName: file.name,
                mimeType: "image/jpeg",
                fileSize: 1024,
                url: "https://example.com/test.jpg",
                userId: "clauthor12345678901234567",
                createdAt: new Date(),
            } as any);

            const formData = new FormData();
            formData.append("file", file);

            const res = await app.request("/api/upload/image", {
                method: "POST",
                headers: { Cookie: "better-auth.session_token=test-token" },
                body: formData,
            });
            const body: any = await res.json();

            expect(res.status).toBe(200);
            // Verify the resulting path doesn't contain path traversal sequences
            expect(body.path).toBeDefined();
            expect(body.path).not.toContain("..");
            expect(body.path).not.toContain("etc/passwd");
            expect(body.path).toMatch(/^blog-images\//);
        });

        it("should handle Supabase upload errors", async () => {
            setupAuthorAuth();

            const file = createJpegFile(1024);

            mockSupabaseStorage.from.mockReturnValue({
                upload: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: "Storage quota exceeded" },
                }),
            } as any);

            const formData = new FormData();
            formData.append("file", file);

            const res = await app.request("/api/upload/image", {
                method: "POST",
                headers: { Cookie: "better-auth.session_token=test-token" },
                body: formData,
            });
            const body: any = await res.json();

            expect(res.status).toBe(500);
            expect(body.error).toBe("Failed to upload image");
        });
    });

    describe("DELETE /api/upload/image", () => {
        it("should delete own uploaded file", async () => {
            setupAuthorAuth();

            const uploadRecord = {
                id: "upload123",
                userId: "clauthor12345678901234567",
                filePath: "blog-images/clauthor12345678901234567/test.jpg",
            };

            getMock(prismaMock.upload.findUnique).mockResolvedValue(uploadRecord as any);
            getMock(prismaMock.upload.delete).mockResolvedValue(uploadRecord as any);

            mockSupabaseStorage.from.mockReturnValue({
                remove: vi.fn().mockResolvedValue({ data: null, error: null }),
            } as any);

            const res = await app.request("/api/upload/image", {
                method: "DELETE",
                headers: {
                    Cookie: "better-auth.session_token=test-token",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ path: "blog-images/clauthor12345678901234567/test.jpg" }),
            });
            const body: any = await res.json();

            expect(res.status).toBe(200);
            expect(body.message).toBe("Image deleted successfully");
        });

        it("should allow admin to delete any file", async () => {
            setupAdminAuth();

            const uploadRecord = {
                id: "upload123",
                userId: "other-user-id", // Different user
                filePath: "blog-images/other-user-id/test.jpg",
            };

            getMock(prismaMock.upload.findUnique).mockResolvedValue(uploadRecord as any);
            getMock(prismaMock.upload.delete).mockResolvedValue(uploadRecord as any);

            mockSupabaseStorage.from.mockReturnValue({
                remove: vi.fn().mockResolvedValue({ data: null, error: null }),
            } as any);

            const res = await app.request("/api/upload/image", {
                method: "DELETE",
                headers: {
                    Cookie: "better-auth.session_token=test-token",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ path: "blog-images/other-user-id/test.jpg" }),
            });

            expect(res.status).toBe(200);
        });

        it("should return 404 when file not found", async () => {
            setupAuthorAuth();

            getMock(prismaMock.upload.findUnique).mockResolvedValue(null);

            const res = await app.request("/api/upload/image", {
                method: "DELETE",
                headers: {
                    Cookie: "better-auth.session_token=test-token",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ path: "blog-images/clauthor12345678901234567/nonexistent.jpg" }),
            });
            const body: any = await res.json();

            expect(res.status).toBe(404);
            expect(body.error).toBe("File not found");
        });

        it("should return 403 when trying to delete another user's file (IDOR protection)", async () => {
            setupAuthorAuth();

            const uploadRecord = {
                id: "upload123",
                userId: "other-user-id", // Different user
                filePath: "blog-images/other-user-id/test.jpg",
            };

            getMock(prismaMock.upload.findUnique).mockResolvedValue(uploadRecord as any);

            const res = await app.request("/api/upload/image", {
                method: "DELETE",
                headers: {
                    Cookie: "better-auth.session_token=test-token",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ path: "blog-images/other-user-id/test.jpg" }),
            });
            const body: any = await res.json();

            expect(res.status).toBe(403);
            expect(body.error).toBe("Forbidden");
        });

        it("should return 400 for invalid file path (path traversal protection)", async () => {
            setupAuthorAuth();

            const res = await app.request("/api/upload/image", {
                method: "DELETE",
                headers: {
                    Cookie: "better-auth.session_token=test-token",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ path: "../../../etc/passwd" }),
            });
            const body: any = await res.json();

            expect(res.status).toBe(400);
            expect(body.error).toBe("Invalid file path");
        });

        it("should return 400 for path not starting with blog-images/", async () => {
            setupAuthorAuth();

            const res = await app.request("/api/upload/image", {
                method: "DELETE",
                headers: {
                    Cookie: "better-auth.session_token=test-token",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ path: "public/uploads/test.jpg" }),
            });
            const body: any = await res.json();

            expect(res.status).toBe(400);
            expect(body.error).toBe("Invalid file path");
        });

        it("should return 401 when not authenticated", async () => {
            setupUnauthenticated();

            const res = await app.request("/api/upload/image", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: "blog-images/user123/test.jpg" }),
            });

            expect(res.status).toBe(401);
        });

        it("should handle Supabase delete errors", async () => {
            setupAuthorAuth();

            const uploadRecord = {
                id: "upload123",
                userId: "clauthor12345678901234567",
                filePath: "blog-images/clauthor12345678901234567/test.jpg",
            };

            getMock(prismaMock.upload.findUnique).mockResolvedValue(uploadRecord as any);

            mockSupabaseStorage.from.mockReturnValue({
                remove: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: "Storage service unavailable" },
                }),
            } as any);

            const res = await app.request("/api/upload/image", {
                method: "DELETE",
                headers: {
                    Cookie: "better-auth.session_token=test-token",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ path: "blog-images/clauthor12345678901234567/test.jpg" }),
            });
            const body: any = await res.json();

            expect(res.status).toBe(500);
            expect(body.error).toBe("Failed to delete image");
        });
    });
});
