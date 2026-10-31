import { describe, it, expect, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/server/guard", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: 'u1', role: 'viewer' }),
}));

vi.mock("@/server/errors", () => ({
  withRoute: (fn: unknown) => fn,
}));

vi.mock("@/server/access", () => ({
  getAccessibleDriveIds: vi.fn().mockResolvedValue(['d1']),
}));






vi.mock("@/server/db", () => {
  const mockQuery = Object.assign(Promise.resolve([{ id: 'd1', quotaUsed: '100', quotaTotal: '1000' }]), {
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  });
  return { db: { select: vi.fn().mockReturnValue(mockQuery) } };
});


describe("Dashboard API", () => {
  it("resolves dashboard data", async () => {
     const res = await GET(new Request("http://localhost"));
     expect(res).toBeDefined();
  });
});
