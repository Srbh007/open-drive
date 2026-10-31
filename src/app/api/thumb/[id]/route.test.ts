import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { GET } from "./route"
import * as guard from "@/server/guard"
import * as dbfiles from "@/server/files"
import * as tokens from "@/server/google/tokens"

vi.mock("@/server/guard", () => ({
  requireUser: vi.fn(),
  requireDriveAccess: vi.fn(),
}))

vi.mock("@/server/files", () => ({
  getFileForUser: vi.fn()
}))

vi.mock("@/server/google/tokens", () => ({
  getAccessToken: vi.fn()
}))

describe("GET /api/thumb/[id]", () => {
  const MOCK_USER_ID = "00000000-0000-0000-0000-000000000001"
  const MOCK_FILE_ID = "00000000-0000-4000-8000-000000000002"
  const MOCK_DRIVE_ACCOUNT_ID = "00000000-0000-0000-0000-000000000003"
  const mockUser = { id: MOCK_USER_ID, status: "approved", role: "editor" }

  beforeEach(() => {
    vi.mocked(guard.requireUser).mockResolvedValue(mockUser)
    vi.mocked(tokens.getAccessToken).mockResolvedValue("mock-token")

    vi.mocked(dbfiles.getFileForUser).mockResolvedValue({
      id: MOCK_FILE_ID,
      driveAccountId: MOCK_DRIVE_ACCOUNT_ID,
      providerFileId: "provider-123",
      mimeType: "image/jpeg",
      trashed: false,
      version: "v123",
    })

    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("returns 304 if If-None-Match matches db version", async () => {
    const req = new Request(`http://localhost/api/thumb/${MOCK_FILE_ID}`, {
      headers: { "if-none-match": '"v123"' },
    })

    const res = await GET(req, { params: Promise.resolve({ id: MOCK_FILE_ID }) })
    expect(res.status).toBe(304)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("fetches thumbnail link and replaces size param", async () => {
    // 1. Meta fetch
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ thumbnailLink: "https://lh3.googleusercontent.com/u/0/d/abc=s220", version: "v123" }),
    })

    // 2. Thumb fetch
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg" }),
      body: new ReadableStream(),
    })

    const req = new Request(`http://localhost/api/thumb/${MOCK_FILE_ID}?size=m`)
    const res = await GET(req, { params: Promise.resolve({ id: MOCK_FILE_ID }) })

    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("private, max-age=86400")
    expect(res.headers.get("etag")).toBe('"v123"')

    expect(global.fetch).toHaveBeenNthCalledWith(1,
      expect.stringContaining("fields=thumbnailLink,version"),
      expect.any(Object)
    )

    expect(global.fetch).toHaveBeenNthCalledWith(2,
      "https://lh3.googleusercontent.com/u/0/d/abc=s600",
      expect.any(Object)
    )
  })

  it("returns 404 if no thumbnail available", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: "v123" }), // no thumbnailLink
    })

    const req = new Request(`http://localhost/api/thumb/${MOCK_FILE_ID}`)
    const res = await GET(req, { params: Promise.resolve({ id: MOCK_FILE_ID }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")
  })
})
