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
  const mockBuilder = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
  };
  return { db: { select: vi.fn().mockReturnValue(mockBuilder) } };
});

describe("Favorites API", () => {
  it("resolves favorites data", async () => {
     const res = await GET(new Request("http://localhost"));
     expect(res).toBeDefined();
  });
});
