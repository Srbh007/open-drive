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

// Allow passing specific context (e.g. Next.js 15 { params: Promise<{ id: string }> })
export function withRoute<TArgs extends unknown[]>(
  handler: (req: Request, ...args: TArgs) => Promise<unknown> | unknown
) {
  return async (req: Request, ...args: TArgs) => {
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
