import type { Context, Next } from "hono";
import { getRedisClient, isRedisAvailable } from "@/lib/redis";
import { logger } from "@/utils/logger";

/**
 * Distributed rate limiter using Redis (with in-memory fallback)
 * Automatically uses Redis when available, falls back to in-memory for development
 */

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

// In-memory store for rate limit tracking (fallback when Redis is unavailable)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically (only used for in-memory fallback)
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetTime < now) {
            rateLimitStore.delete(key);
        }
    }
}, 60000); // Clean up every minute

interface RateLimitOptions {
    /** Maximum number of requests allowed in the window */
    limit: number;
    /** Time window in milliseconds */
    windowMs: number;
    /** Custom key generator (default: IP address) */
    keyGenerator?: (c: Context) => string;
    /** Custom message for rate limit exceeded */
    message?: string;
    /** Skip rate limiting for certain requests */
    skip?: (c: Context) => boolean;
}

/**
 * Creates a rate limiting middleware
 */
export function rateLimiter(options: RateLimitOptions) {
    const {
        limit,
        windowMs,
        keyGenerator = (c) => getClientIP(c),
        message = "Too many requests, please try again later",
        skip,
    } = options;

    return async (c: Context, next: Next) => {
        // Skip if configured
        if (skip && skip(c)) {
            return next();
        }

        const key = `ratelimit:${keyGenerator(c)}`;
        const now = Date.now();
        const redis = getRedisClient();

        let count: number;
        let resetTime: number;
        let remaining: number;
        let resetSeconds: number;

        // Use Redis if available
        if (redis && isRedisAvailable()) {
            try {
                // Use Redis INCR with expiration
                const redisKey = key;
                const currentCount = await redis.incr(redisKey);

                if (currentCount === 1) {
                    // First request in this window, set expiration
                    await redis.pexpire(redisKey, windowMs);
                }

                // Get TTL to calculate reset time
                const ttl = await redis.pttl(redisKey);
                resetTime = now + (ttl > 0 ? ttl : windowMs);
                count = currentCount;
                remaining = Math.max(0, limit - count);
                resetSeconds = Math.ceil((resetTime - now) / 1000);
            } catch (error) {
                // In production, fail closed - do not fall back to in-memory
                if (process.env.NODE_ENV === "production") {
                    logger.error("Redis rate limit error in production - rejecting request", error instanceof Error ? error : new Error(String(error)));
                    return c.json(
                        {
                            error: "Service temporarily unavailable",
                            message: "Rate limiting service is unavailable. Please try again later.",
                        },
                        503
                    );
                }
                // In development, fall back to in-memory with warning
                logger.warn("Redis rate limit error in development, falling back to in-memory", { error: String(error) });
                return handleInMemoryRateLimit(c, next, key, limit, windowMs, message);
            }
        } else {
            // Redis not configured
            if (process.env.NODE_ENV === "production") {
                logger.error("Redis not configured in production - this is not suitable for distributed systems");
            }
            // Fall back to in-memory rate limiting (development only)
            return handleInMemoryRateLimit(c, next, key, limit, windowMs, message);
        }

        // Set rate limit headers
        c.header("X-RateLimit-Limit", limit.toString());
        c.header("X-RateLimit-Remaining", remaining.toString());
        c.header("X-RateLimit-Reset", resetSeconds.toString());

        // Check if limit exceeded
        if (count > limit) {
            c.header("Retry-After", resetSeconds.toString());
            return c.json(
                {
                    error: "Rate limit exceeded",
                    message,
                    retryAfter: resetSeconds,
                },
                429
            );
        }

        return next();
    };
}

/**
 * In-memory rate limiting fallback
 */
function handleInMemoryRateLimit(
    c: Context,
    next: Next,
    key: string,
    limit: number,
    windowMs: number,
    message: string
) {
    const now = Date.now();
    let entry = rateLimitStore.get(key);

    // Initialize or reset if window expired
    if (!entry || entry.resetTime < now) {
        entry = {
            count: 0,
            resetTime: now + windowMs,
        };
    }

    entry.count++;
    rateLimitStore.set(key, entry);

    // Calculate remaining
    const remaining = Math.max(0, limit - entry.count);
    const resetSeconds = Math.ceil((entry.resetTime - now) / 1000);

    // Set rate limit headers
    c.header("X-RateLimit-Limit", limit.toString());
    c.header("X-RateLimit-Remaining", remaining.toString());
    c.header("X-RateLimit-Reset", resetSeconds.toString());

    // Check if limit exceeded
    if (entry.count > limit) {
        c.header("Retry-After", resetSeconds.toString());
        return c.json(
            {
                error: "Rate limit exceeded",
                message,
                retryAfter: resetSeconds,
            },
            429
        );
    }

    return next();
}

/**
 * Get client IP address from request
 */
function getClientIP(c: Context): string {
    const trustProxy = process.env.TRUST_PROXY === "true";
    if (trustProxy) {
        // Check common proxy headers (Render uses x-forwarded-for)
        const forwarded = c.req.header("x-forwarded-for");
        if (forwarded) {
            const firstIP = forwarded.split(",")[0];
            if (firstIP) return firstIP.trim();
        }

        const realIP = c.req.header("x-real-ip");
        if (realIP) {
            return realIP;
        }

        // Fallback to CF header if using Cloudflare
        const cfIP = c.req.header("cf-connecting-ip");
        if (cfIP) {
            return cfIP;
        }
    }

    // Generate a unique identifier based on request characteristics
    // This prevents all unknown clients from sharing one rate limit bucket
    const userAgent = c.req.header("user-agent") || "";
    const acceptLanguage = c.req.header("accept-language") || "";
    const fingerprint = `unknown-${hashString(userAgent + acceptLanguage)}`;
    return fingerprint;
}

/**
 * Simple hash function for fingerprinting
 */
function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
}

// Pre-configured rate limiters for different use cases

/** General API rate limiter - 100 requests per minute */
export const generalRateLimit = rateLimiter({
    limit: 100,
    windowMs: 60 * 1000, // 1 minute
});

/** Auth rate limiter - stricter for auth endpoints */
export const authRateLimit = rateLimiter({
    limit: process.env.NODE_ENV === "development" ? 50 : 30, // 30 attempts per 5 min in prod
    windowMs: process.env.NODE_ENV === "development" ? 60 * 1000 : 5 * 60 * 1000, // 1 min in dev, 5 min in prod
    message: "Too many authentication attempts, please try again later",
});

/** Upload rate limiter - 20 uploads per hour */
export const uploadRateLimit = rateLimiter({
    limit: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: "Upload limit reached, please try again later",
});

/** Write operations rate limiter - 30 per minute */
export const writeRateLimit = rateLimiter({
    limit: 30,
    windowMs: 60 * 1000, // 1 minute
    message: "Too many write operations, please slow down",
});

/** Strict rate limiter for sensitive operations - 5 per minute */
export const strictRateLimit = rateLimiter({
    limit: 5,
    windowMs: 60 * 1000, // 1 minute
    message: "Rate limit exceeded for sensitive operation",
});

/** Email rate limiter - moderate strictness for email operations */
export const emailRateLimit = rateLimiter({
    limit: process.env.NODE_ENV === "development" ? 10 : 5, // 10 in dev, 5 in prod
    windowMs: process.env.NODE_ENV === "development" ? 60 * 1000 : 15 * 60 * 1000, // 1 min in dev, 15 min in prod
    message: "Too many email requests, please try again later",
});
