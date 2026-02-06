import { vi } from "vitest";
import type { PrismaClient } from "../../../generated/prisma/client.ts";

/**
 * Creates a Prisma mock compatible with Bun + Vitest.
 *
 * IMPORTANT: vitest-mock-extended's mockDeep is incompatible with Bun due to Proxy issues.
 * See: https://github.com/oven-sh/bun/issues/21735
 *
 * Instead, we manually create vi.fn() mocks for each Prisma model method.
 * This ensures .mockResolvedValue() and other mock methods work correctly.
 */

/**
 * Type for a Prisma model delegate mock
 */
interface PrismaModelMock {
    findUnique: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findFirstOrThrow: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    createManyAndReturn: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
    fields: Record<string, never>;
}

// Helper to create a mock for a Prisma model delegate
const createModelMock = (): PrismaModelMock => ({
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    createManyAndReturn: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
    fields: {},
});

// Create the mock Prisma Client with all models
export const prismaMock = {
    user: createModelMock(),
    post: createModelMock(),
    tag: createModelMock(),
    postTag: createModelMock(),
    publishRequest: createModelMock(),
    comment: createModelMock(),
    profile: createModelMock(),
    upload: createModelMock(),

    // Transaction methods
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),

    // Connection methods
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),

    // Utility methods
    $use: vi.fn(),
    $on: vi.fn(),
    $extends: vi.fn(),
} as unknown as PrismaClient;

// Export as 'prisma' to match the real module's export
export const prisma = prismaMock;

// Mock the pool
export const pool = {
    end: vi.fn().mockResolvedValue(undefined),
};

// Mock disconnectDatabase
export const disconnectDatabase = vi.fn().mockResolvedValue(undefined);

// Export type for convenience
export type MockPrismaClient = typeof prismaMock;
