import { redactLogFields, redactLogString } from "./redaction";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  readonly requestId?: string;
  readonly jobId?: string;
}

export interface LoggerOptions {
  readonly context?: LogContext;
  readonly sink?: LogSink;
  readonly clock?: () => Date;
}

export type LogSink = (line: string) => void;

export interface StructuredLogRecord {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly event: string;
  readonly request_id?: string;
  readonly job_id?: string;
  readonly [field: string]: unknown;
}

function safeCorrelationId(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const sanitized = redactLogString(value.trim())
    .replace(/[^a-zA-Z0-9_.:-]/g, "_")
    .slice(0, 128);

  return sanitized || undefined;
}

function safeEventName(value: string): string {
  const sanitized = redactLogString(value.trim())
    .replace(/[^a-zA-Z0-9_.:-]/g, "_")
    .slice(0, 80);

  return sanitized || "unknown";
}

function defaultSink(line: string): void {
  globalThis.console.log(line);
}

export class StructuredLogger {
  private readonly context: LogContext;
  private readonly sink: LogSink;
  private readonly clock: () => Date;

  constructor(options: LoggerOptions = {}) {
    this.context = options.context ?? {};
    this.sink = options.sink ?? defaultSink;
    this.clock = options.clock ?? (() => new Date());
  }

  child(context: LogContext): StructuredLogger {
    return new StructuredLogger({
      context: {
        ...this.context,
        ...context,
      },
      sink: this.sink,
      clock: this.clock,
    });
  }

  log(
    level: LogLevel,
    event: string,
    fields: Readonly<Record<string, unknown>> = {},
  ): void {
    const safeFields = redactLogFields(fields);
    const record: StructuredLogRecord = {
      timestamp: this.clock().toISOString(),
      level,
      event: safeEventName(event),
      ...safeFields,
      ...(safeCorrelationId(this.context.requestId)
        ? { request_id: safeCorrelationId(this.context.requestId) }
        : {}),
      ...(safeCorrelationId(this.context.jobId)
        ? { job_id: safeCorrelationId(this.context.jobId) }
        : {}),
    };

    this.sink(JSON.stringify(record));
  }

  debug(event: string, fields?: Readonly<Record<string, unknown>>): void {
    this.log("debug", event, fields);
  }

  info(event: string, fields?: Readonly<Record<string, unknown>>): void {
    this.log("info", event, fields);
  }

  warn(event: string, fields?: Readonly<Record<string, unknown>>): void {
    this.log("warn", event, fields);
  }

  error(event: string, fields?: Readonly<Record<string, unknown>>): void {
    this.log("error", event, fields);
  }
}

export function createLogger(options: LoggerOptions = {}): StructuredLogger {
  return new StructuredLogger(options);
}

export function createRequestLogger(
  requestId: string,
  options: Omit<LoggerOptions, "context"> = {},
): StructuredLogger {
  return createLogger({ ...options, context: { requestId } });
}

export function createJobLogger(
  jobId: string,
  options: Omit<LoggerOptions, "context"> = {},
): StructuredLogger {
  return createLogger({ ...options, context: { jobId } });
}
