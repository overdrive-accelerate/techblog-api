import Redis from "ioredis";
import { logger } from "@/utils/logger";

let redis: Redis | null = null;

/**
 * Initialize Redis connection
 * Falls back to null if REDIS_URL is not provided (development mode)
 */
export function getRedisClient(): Redis | null {
    // If Redis is already initialized, return it
    if (redis !== undefined) {
        return redis;
    }

    // Check if REDIS_URL is provided
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
        logger.warn("REDIS_URL not found - using in-memory rate limiting (not suitable for production)");
        redis = null;
        return null;
    }

    try {
        // Create Redis client
        redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            reconnectOnError: (err) => {
                logger.error("Redis reconnect on error", err);
                return true;
            },
        });

        // Handle connection events
        redis.on("connect", () => {
            logger.info("Redis connected successfully");
        });

        redis.on("error", (err) => {
            logger.error("Redis connection error", err);
        });

        redis.on("close", () => {
            logger.warn("Redis connection closed");
        });

        logger.info("Redis client initialized", {
            host: redisUrl.split("@")[1]?.split(":")[0] || "unknown",
        });

        return redis;
    } catch (error) {
        logger.error("Failed to initialize Redis client", error instanceof Error ? error : new Error(String(error)));
        redis = null;
        return null;
    }
}

/**
 * Gracefully disconnect from Redis
 */
export async function disconnectRedis(): Promise<void> {
    if (redis) {
        try {
            await redis.quit();
            logger.info("Redis connection closed");
        } catch (error) {
            logger.error("Error closing Redis connection", error instanceof Error ? error : new Error(String(error)));
        }
    }
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
    return redis !== null && redis.status === "ready";
}
