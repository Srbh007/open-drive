import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('env validation', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { NODE_ENV: 'test' } as unknown as NodeJS.ProcessEnv;
  });

  it('throws on missing variables when SKIP_ENV_VALIDATION is not set', async () => {
    process.env.SKIP_ENV_VALIDATION = "0";
    await expect(async () => {
      await import('./env');
    }).rejects.toThrow("Invalid environment variables");
  });

  it('bypasses validation when SKIP_ENV_VALIDATION=1', async () => {
    process.env.SKIP_ENV_VALIDATION = "1";
    const envModule = await import('./env');
    expect(envModule.env).toBeDefined();
  });
});
