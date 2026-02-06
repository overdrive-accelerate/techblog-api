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

// Helper to create a mock for a Prisma model delegate
const createModelMock = () => ({
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
