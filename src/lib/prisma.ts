import { PrismaClient } from "../../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { logger } from "@/utils/logger";

// PostgreSQL connection pool for Supabase
// Note: DATABASE_URL is validated in src/config/env.ts at startup
const connectionString = process.env.DATABASE_URL!;

// Configure connection pool with appropriate limits
const pool = new Pool({
    connectionString,
    max: 10, // Maximum number of connections in the pool
    min: 2, // Minimum number of connections to maintain
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 10000, // Timeout after 10 seconds when acquiring connection
});

// Handle pool errors
pool.on("error", (err) => {
    logger.error("Unexpected database pool error", err);
});

const adapter = new PrismaPg(pool);

// Prisma Client singleton with PostgreSQL adapter
const prismaClientSingleton = () => {
    return new PrismaClient({ adapter });
};

declare global {
    // eslint-disable-next-line no-var
    var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export { prisma, pool };

if (process.env.NODE_ENV !== "production") {
    globalThis.prismaGlobal = prisma;
}

// Graceful shutdown function
export async function disconnectDatabase(): Promise<void> {
    await prisma.$disconnect();
    await pool.end();

    // Also disconnect Redis if available
    const { disconnectRedis } = await import("@/lib/redis");
    await disconnectRedis();

    logger.info("Database and Redis connections closed");
}
