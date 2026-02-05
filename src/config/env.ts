import { z } from "zod";
import { logger } from "@/utils/logger";

/**
 * Environment variable validation schema
 * Validates all required environment variables at startup
 */
const envSchema = z.object({
    // Node Environment
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    // Server Configuration
    PORT: z.coerce.number().int().positive().default(3001),
    TRUST_PROXY: z.enum(["true", "false"]).default("false").transform((val) => val === "true"),

    // Database - Required
    DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL connection string").min(1),
    DIRECT_URL: z.string().url("DIRECT_URL must be a valid PostgreSQL connection string").optional(),

    // Authentication - Required
    BETTER_AUTH_SECRET: z
        .string()
        .min(32, "BETTER_AUTH_SECRET must be at least 32 characters for security")
        .regex(
            /^[A-Za-z0-9+/=_-]+$/,
            "BETTER_AUTH_SECRET should contain only alphanumeric characters and +/=_-"
        ),
    BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL (e.g., https://api.yourdomain.com)"),

    // File Storage - Required
    SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
    SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),

    // Frontend - Required for CORS
    FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL").optional(),

    // Redis - Optional (falls back to in-memory)
    REDIS_URL: z.string().url("REDIS_URL must be a valid Redis connection string").optional(),
});

export type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

/**
 * Validates environment variables at startup
 * Throws error with clear message if validation fails
 */
export function validateEnv(): Env {
    // Return cached validation result if already validated
    if (validatedEnv) {
        return validatedEnv;
    }

    try {
        validatedEnv = envSchema.parse(process.env);

        // Log successful validation in development
        if (validatedEnv.NODE_ENV === "development") {
            logger.info("Environment variables validated successfully");
        }

        return validatedEnv;
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.issues.map((err) => {
                const path = err.path.join(".");
                return `  ❌ ${path}: ${err.message}`;
            });

            const errorMessage = [
                "",
                "❌ Environment Variable Validation Failed:",
                "",
                ...errorMessages,
                "",
                "Please check your .env file or Railway environment variables.",
                "See RAILWAY_SETUP.md for required environment variables.",
                "",
            ].join("\n");

            // Log the error
            console.error(errorMessage);

            // Throw to prevent server from starting
            throw new Error("Environment validation failed. Check logs above for details.");
        }
        throw error;
    }
}

/**
 * Get validated environment variables
 * Must call validateEnv() first during startup
 */
export function getEnv(): Env {
    if (!validatedEnv) {
        throw new Error("Environment variables not validated. Call validateEnv() during startup.");
    }
    return validatedEnv;
}

/**
 * Check if a specific environment variable exists
 */
export function hasEnvVar(key: keyof Env): boolean {
    const env = getEnv();
    return env[key] !== undefined && env[key] !== null && env[key] !== "";
}
