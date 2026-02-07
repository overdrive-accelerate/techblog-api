import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { setupAuthorAuth, setupUnauthenticated, mockAuth } from "../../setup/mocks/auth";

// Import after mocks are registered by setup
import { createMeRoute } from "../../../src/routes/me";

// Response type interfaces
interface MeResponse {
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
        emailVerified: boolean;
    };
    session: {
        expiresAt: string;
    };
}

// Helper to create test app
const createApp = () => {
    const app = new Hono();
    const meRoute = createMeRoute(mockAuth);
    app.route("/api/me", meRoute);

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

describe("Me Route", () => {
    let app: ReturnType<typeof createApp>;

    beforeEach(() => {
        app = createApp();
    });

    describe("GET /api/me", () => {
        it("should return current user info when authenticated", async () => {
            setupAuthorAuth();

            const res = await app.request("/api/me", {
                headers: { Cookie: "better-auth.session_token=test-token" },
            });
            const body = (await res.json()) as MeResponse;

            expect(res.status).toBe(200);
            expect(body.user).toBeDefined();
            expect(body.user.id).toBe("clauthor12345678901234567");
            expect(body.user.email).toBe("author@example.com");
            expect(body.user.name).toBe("Author User");
            expect(body.user.role).toBe("AUTHOR");
            expect(body.user.emailVerified).toBe(true);
            expect(body.session).toBeDefined();
            expect(body.session.expiresAt).toBeDefined();
        });

        it("should return 401 when not authenticated", async () => {
            setupUnauthenticated();

            const res = await app.request("/api/me");

            expect(res.status).toBe(401);
        });

        it("should not expose sensitive fields", async () => {
            setupAuthorAuth();

            const res = await app.request("/api/me", {
                headers: { Cookie: "better-auth.session_token=test-token" },
            });
            const body = (await res.json()) as MeResponse & { user: Record<string, unknown> };

            expect(res.status).toBe(200);
            // Ensure no password or other sensitive fields
            expect((body.user as any).password).toBeUndefined();
            expect((body.user as any).createdAt).toBeUndefined();
            expect((body.user as any).updatedAt).toBeUndefined();
            // Only expose necessary fields
            expect(Object.keys(body.user).sort()).toEqual(["id", "email", "name", "role", "emailVerified"].sort());
        });

        it("should include session expiration", async () => {
            setupAuthorAuth();

            const res = await app.request("/api/me", {
                headers: { Cookie: "better-auth.session_token=test-token" },
            });
            const body = (await res.json()) as MeResponse;

            expect(res.status).toBe(200);
            expect(body.session).toBeDefined();
            expect(body.session.expiresAt).toBeDefined();
            expect(typeof body.session.expiresAt).toBe("string");
        });
    });
});
