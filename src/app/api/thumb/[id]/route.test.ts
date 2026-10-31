import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { GET } from "./route"
import * as guard from "@/server/guard"
import * as dbfiles from "@/server/files"
import * as tokens from "@/server/google/tokens"
import { files } from "@/server/db/schema"

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

function makeFileRow(overrides: Partial<typeof files.$inferSelect> = {}): typeof files.$inferSelect {
  return {
    id: "00000000-0000-4000-8000-000000000002",
    driveAccountId: "00000000-0000-0000-0000-000000000003",
    providerFileId: "provider-123",
    parentProviderId: null,
    name: "test.jpg",
    title: null,
    mimeType: "image/jpeg",
    isFolder: false,
    size: 1000,
    hasThumbnail: true,
    webViewLink: null,
    width: null,
    height: null,
    durationMs: null,
    modifiedAt: new Date(),
    version: "v123",
    trashed: false,
    ...overrides
  }
}

describe("GET /api/thumb/[id]", () => {
  const MOCK_USER_ID = "00000000-0000-0000-0000-000000000001"
  const MOCK_FILE_ID = "00000000-0000-4000-8000-000000000002"
  const mockUser = {
    id: MOCK_USER_ID,
    status: "approved" as const,
    role: "editor" as const,
    googleSub: "sub123",
    email: "test@test.com",
    name: "Test",
    image: null,
    approvedBy: null,
    approvedAt: null,
    createdAt: new Date(),
  }

  beforeEach(() => {
    vi.mocked(guard.requireUser).mockResolvedValue(mockUser)
    vi.mocked(tokens.getAccessToken).mockResolvedValue("mock-token")

    vi.mocked(dbfiles.getFileForUser).mockResolvedValue(makeFileRow())

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
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(JSON.stringify({ thumbnailLink: "https://lh3.googleusercontent.com/u/0/d/abc=s220", version: "v123" }), {
      status: 200,
    }))

    // 2. Thumb fetch
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(new ReadableStream(), {
      status: 200,
      headers: new Headers({ "content-type": "image/jpeg" }),
    }))

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
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(JSON.stringify({ version: "v123" }), {
      status: 200,
    }))

    const req = new Request(`http://localhost/api/thumb/${MOCK_FILE_ID}`)
    const res = await GET(req, { params: Promise.resolve({ id: MOCK_FILE_ID }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")
  })

  it("returns 404 if thumbnail domain is invalid", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(JSON.stringify({ thumbnailLink: "https://evil.com/u/0/d/abc=s220", version: "v123" }), {
      status: 200,
    }))

    const req = new Request(`http://localhost/api/thumb/${MOCK_FILE_ID}`)
    const res = await GET(req, { params: Promise.resolve({ id: MOCK_FILE_ID }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.message).toBe("Invalid thumbnail domain")

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})
