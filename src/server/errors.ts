import 'server-only';
import { NextResponse } from 'next/server';
import { log } from './log';

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'GONE'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR';

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'AppError';
  }
}

type RouteHandler = (req: Request, ...args: unknown[]) => Promise<unknown> | unknown;

export function withRoute(handler: RouteHandler) {
  return async (req: Request, ...args: unknown[]) => {
    try {
      const data = await handler(req, ...args);
      return NextResponse.json({ ok: true, data });
    } catch (error) {
      if (error instanceof AppError) {
        log.error(`AppError: ${error.code} - ${error.message}`);
        return NextResponse.json(
          { ok: false, error: { code: error.code, message: error.message } },
          { status: error.status }
        );
      }

      log.error('Unhandled error', { error });
      return NextResponse.json(
        { ok: false, error: { code: 'UPSTREAM_ERROR', message: 'Internal Server Error' } },
        { status: 500 }
      );
    }
  };
}
