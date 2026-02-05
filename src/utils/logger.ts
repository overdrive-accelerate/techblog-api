/**
 * Production-ready structured logger
 * Zero external dependencies, outputs JSON to stdout/stderr
 * Compatible with log aggregation services (Railway, CloudWatch, Datadog, etc.)
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: Record<string, unknown>;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

class Logger {
    private minLevel: LogLevel;
    private isProduction: boolean;

    constructor() {
        this.isProduction = process.env.NODE_ENV === "production";
        // In production: info and above, in development: debug and above
        this.minLevel = this.isProduction ? "info" : "debug";
    }

    private shouldLog(level: LogLevel): boolean {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
    }

    private formatLog(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): string {
        // In development, use human-readable format
        if (!this.isProduction) {
            const timestamp = new Date().toLocaleTimeString();
            const levelIcon = {
                debug: "🔍",
                info: "ℹ️",
                warn: "⚠️",
                error: "❌",
            }[level];

            let output = `${levelIcon} [${timestamp}] ${message}`;

            if (context && Object.keys(context).length > 0) {
                output += ` ${JSON.stringify(context)}`;
            }

            if (error) {
                output += `\n  ${error.name}: ${error.message}`;
                if (error.stack) {
                    output += `\n${error.stack}`;
                }
            }

            return output;
        }

        // In production, use structured JSON format
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
        };

        if (context && Object.keys(context).length > 0) {
            entry.context = context;
        }

        if (error) {
            entry.error = {
                name: error.name,
                message: error.message,
                stack: this.isProduction ? undefined : error.stack,
            };
        }

        return JSON.stringify(entry);
    }

    private write(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
        if (!this.shouldLog(level)) return;

        const logString = this.formatLog(level, message, context, error);

        // Write to stderr for errors and warnings, stdout for info and debug
        if (level === "error" || level === "warn") {
            process.stderr.write(logString + "\n");
        } else {
            process.stdout.write(logString + "\n");
        }
    }

    /**
     * Log debug information (development only)
     */
    debug(message: string, context?: Record<string, unknown>): void {
        this.write("debug", message, context);
    }

    /**
     * Log general information
     */
    info(message: string, context?: Record<string, unknown>): void {
        this.write("info", message, context);
    }

    /**
     * Log warnings
     */
    warn(message: string, context?: Record<string, unknown>): void {
        this.write("warn", message, context);
    }

    /**
     * Log errors
     */
    error(message: string, error?: Error, context?: Record<string, unknown>): void {
        this.write("error", message, context, error);
    }
}

// Export singleton instance
export const logger = new Logger();
