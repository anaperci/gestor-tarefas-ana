import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR";

const STATUS_FOR_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  BAD_REQUEST: 400,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = STATUS_FOR_CODE[code];
    this.details = details;
  }
}

export function apiError(code: ErrorCode, message: string, details?: unknown): NextResponse {
  const body: Record<string, unknown> = { error: message, code };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status: STATUS_FOR_CODE[code] });
}

type Handler<Ctx> = (request: Request, context: Ctx) => Promise<Response> | Response;

export function withErrorHandling<Ctx = unknown>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (err) {
      if (err instanceof ApiError) {
        return apiError(err.code, err.message, err.details);
      }
      if (err instanceof ZodError) {
        return apiError("VALIDATION_ERROR", "Dados inválidos", err.flatten());
      }
      const route = new URL(request.url).pathname;
      console.error(`[api-error] unhandled at ${route}:`, err);
      return apiError("INTERNAL_ERROR", "Erro interno. Tente novamente.");
    }
  };
}

export async function parseJson<T>(
  request: Request,
  schema: { parse: (raw: unknown) => T }
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError("BAD_REQUEST", "Body inválido (JSON malformado)");
  }
  return schema.parse(raw);
}
