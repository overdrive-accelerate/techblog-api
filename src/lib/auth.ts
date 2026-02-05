import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail, sendResetPasswordEmail } from "@/lib/email";
import { logger } from "@/utils/logger";

const isProduction = process.env.NODE_ENV === "production";

if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET environment variable is required");
}

// Validate required environment variables in production
if (isProduction) {
    if (!process.env.FRONTEND_URL) {
        throw new Error("FRONTEND_URL environment variable is required in production");
    }
    if (!process.env.BETTER_AUTH_URL) {
        throw new Error("BETTER_AUTH_URL environment variable is required in production");
    }
    // BETTER_AUTH_SECRET is validated for all environments above
}

// Build trusted origins based on environment
const trustedOrigins: string[] = [];

if (isProduction) {
    // Production: only use environment variables (validated above)
    trustedOrigins.push(process.env.FRONTEND_URL!);
    trustedOrigins.push(process.env.BETTER_AUTH_URL!);
} else {
    // Development: include localhost URLs
    trustedOrigins.push(
        "http://localhost:3000",
        "http://localhost:3001",
        process.env.FRONTEND_URL || "http://localhost:3000",
    );
}

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
    secret: process.env.BETTER_AUTH_SECRET!,
    trustedOrigins,
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true, // Users must verify email before login
        sendVerificationEmail: async ({ user, url, token }: { user: any; url: string; token: string }) => {
            // Fire-and-forget to prevent timing attacks (per Better Auth security docs)
            // Don't await - let email sending happen in background
            sendVerificationEmail(user.email, url, token).catch((error) => {
                logger.error(
                    `Failed to send verification email to ${user.email} (userId: ${user.id})`,
                    error instanceof Error ? error : new Error(String(error))
                );
            });
        },
        sendResetPassword: async ({ user, url, token }: { user: any; url: string; token: string }) => {
            // Fire-and-forget to prevent timing attacks
            // Don't await - let email sending happen in background
            sendResetPasswordEmail(user.email, url, token).catch((error) => {
                logger.error(
                    `Failed to send password reset email to ${user.email} (userId: ${user.id})`,
                    error instanceof Error ? error : new Error(String(error))
                );
            });
        },
        autoSignInAfterVerification: true, // Auto login after email verification
        sendOnSignUp: true, // Send verification email immediately on signup
        resetPasswordTokenExpiresIn: 3600, // 1 hour (3600 seconds)
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 1 day (will update session if older than this)
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60, // 5 minutes
        },
    },
    advanced: {
        crossSubDomainCookies: {
            enabled: isProduction,
        },
        defaultCookieAttributes: {
            secure: isProduction,
            httpOnly: true,
            sameSite: isProduction ? "none" : "lax", // "none" required for cross-domain in production
            path: "/",
        },
    },
    socialProviders: {
        // Add OAuth providers here when needed
        // github: {
        //   clientId: process.env.GITHUB_CLIENT_ID!,
        //   clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        // },
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                required: false,
                defaultValue: "READER",
                input: false, // Don't allow users to set this directly
            },
        },
    },
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
