import type { Context } from "hono";
import type { ZodSchema } from "zod";
import { ZodError } from "zod";
import { HTTPException } from "hono/http-exception";

/**
 * Validates request body against a Zod schema
 * Returns parsed data or throws HTTPException
 */
export async function validateBody<T>(c: Context, schema: ZodSchema<T>): Promise<T> {
    try {
        let body: unknown;
        try {
            body = await c.req.json();
        } catch {
            throw new HTTPException(400, { message: "Invalid JSON" });
        }
        const validated = schema.parse(body);
        return validated;
    } catch (error) {
        if (error instanceof ZodError) {
            throw new HTTPException(400, {
                message: "Validation Error",
                cause: error.issues.map((issue) => ({
                    path: issue.path.join("."),
                    message: issue.message,
                })),
            });
        }
        throw error;
    }
}

/**
 * Validates query parameters against a Zod schema
 * Returns parsed data or throws HTTPException
 */
export function validateQuery<T>(c: Context, schema: ZodSchema<T>): T {
    try {
        const query = c.req.query();
        const validated = schema.parse(query);
        return validated;
    } catch (error) {
        if (error instanceof ZodError) {
            throw new HTTPException(400, {
                message: "Validation Error",
                cause: error.issues.map((issue) => ({
                    path: issue.path.join("."),
                    message: issue.message,
                })),
            });
        }
        throw error;
    }
}

/**
 * Validates path parameters against a Zod schema
 * Returns parsed data or throws HTTPException
 */
export function validateParams<T>(c: Context, schema: ZodSchema<T>): T {
    try {
        const params = c.req.param();
        const validated = schema.parse(params);
        return validated;
    } catch (error) {
        if (error instanceof ZodError) {
            throw new HTTPException(400, {
                message: "Validation Error",
                cause: error.issues.map((issue) => ({
                    path: issue.path.join("."),
                    message: issue.message,
                })),
            });
        }
        throw error;
    }
}
