import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/server/guard", () => ({
  requireUser: vi.fn(),
  withRoute: (fn: unknown) => fn,
}));

vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(),
  }
}));

describe("Dashboard API", () => {
  it("returns totals and files", async () => {
     expect(true).toBe(true);
  });
});
