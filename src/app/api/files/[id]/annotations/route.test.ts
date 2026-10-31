import { describe, it, expect, vi } from "vitest";

vi.mock("@/server/guard", () => ({
  requireUser: vi.fn(),
  withRoute: (fn: unknown) => fn,
}));

vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  }
}));

describe("Annotations API", () => {
  it("dummy test", () => {
    expect(true).toBe(true);
  });
});
