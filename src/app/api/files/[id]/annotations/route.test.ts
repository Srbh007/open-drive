import { describe, it, expect, vi } from "vitest";
import { GET, PUT } from "./route";

vi.mock("@/server/guard", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: 'u1', role: 'viewer' }),
}));

vi.mock("@/server/errors", () => ({
  withRoute: (fn: unknown) => fn,
  AppError: class extends Error {
    constructor(public code: string, message: string, public status: number) {
      super(message);
    }
  }
}));

vi.mock("@/server/files", () => ({
  getFileForUser: vi.fn().mockResolvedValue({ id: 'f1' }),
}));

vi.mock("@/server/audit", () => ({
  writeAudit: vi.fn(),
}));



vi.mock("@/server/db", () => {
  const mockBuilder = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{}]),
  };
  return { db: { select: vi.fn().mockReturnValue(mockBuilder), insert: vi.fn().mockReturnValue(mockBuilder) } };
});

describe("Annotations API", () => {
  it("GET resolves", async () => {
     const req = new Request("http://localhost");
     const res = await GET(req, { params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174000' }) });
     expect(res).toBeDefined();
  });

  it("PUT resolves", async () => {
     const req = new Request("http://localhost", { method: 'PUT', body: JSON.stringify({ caption: 'hello' }) });
     const res = await PUT(req, { params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174000' }) });
     expect(res).toBeDefined();
  });
});
