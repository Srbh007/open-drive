import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ body, init })),
  },
}));

vi.mock('./log', () => ({
  log: {
    error: vi.fn(),
  },
}));

import { AppError, withRoute } from './errors';

describe('withRoute', () => {
  it('maps AppError to error envelope with right status', async () => {
    const handler = () => {
      throw new AppError('FORBIDDEN', 'Access denied', 403);
    };

    const wrapped = withRoute(handler);
    const response = await wrapped(new Request('http://localhost')) as unknown as { body: unknown, init: unknown };

    expect(response.body).toEqual({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Access denied' },
    });
    expect(response.init).toEqual({ status: 403 });
  });

  it('maps generic error to UPSTREAM_ERROR with 500 status', async () => {
    const handler = () => {
      throw new Error('Something broke');
    };

    const wrapped = withRoute(handler);
    const response = await wrapped(new Request('http://localhost')) as unknown as { body: unknown, init: unknown };

    expect(response.body).toEqual({
      ok: false,
      error: { code: 'UPSTREAM_ERROR', message: 'Internal Server Error' },
    });
    expect(response.init).toEqual({ status: 500 });
  });

  it('returns success payload on successful handler', async () => {
    const handler = () => {
      return { hello: 'world' };
    };

    const wrapped = withRoute(handler);
    const response = await wrapped(new Request('http://localhost')) as unknown as { body: unknown, init: unknown };

    expect(response.body).toEqual({
      ok: true,
      data: { hello: 'world' },
    });
  });
});
