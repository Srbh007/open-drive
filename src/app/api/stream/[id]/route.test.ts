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
    name: "test.mp4",
    title: null,
    mimeType: "video/mp4",
    isFolder: false,
    size: 1000,
    hasThumbnail: false,
    webViewLink: null,
    width: null,
    height: null,
    durationMs: null,
    modifiedAt: new Date(),
    version: null,
    trashed: false,
    ...overrides
  }
}

describe("GET /api/stream/[id]", () => {
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

  it("forwards Range header and streams 206 for normal files", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(new ReadableStream(), {
      status: 206,
      headers: new Headers({
        "content-type": "video/mp4",
        "content-range": "bytes 0-100/1000",
        "content-length": "101",
      }),
    }))

    const req = new Request(`http://localhost/api/stream/${MOCK_FILE_ID}`, {
      headers: { Range: "bytes=0-100" },
    })

    const res = await GET(req, { params: Promise.resolve({ id: MOCK_FILE_ID }) })

    expect(res.status).toBe(206)
    expect(res.headers.get("content-range")).toBe("bytes 0-100/1000")
    expect(res.headers.get("content-type")).toBe("video/mp4")
    expect(res.headers.get("cache-control")).toBe("private, max-age=0")
    expect(res.headers.get("accept-ranges")).toBe("bytes")

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("alt=media"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer mock-token",
          Range: "bytes=0-100",
        }),
      })
    )
  })

  it("handles 416 errors correctly", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(null, {
      status: 416,
      headers: new Headers({
        "content-range": "bytes */1000",
      }),
    }))

    const req = new Request(`http://localhost/api/stream/${MOCK_FILE_ID}`, {
      headers: { Range: "bytes=2000-3000" },
    })

    const res = await GET(req, { params: Promise.resolve({ id: MOCK_FILE_ID }) })

    expect(res.status).toBe(416)
    expect(res.headers.get("content-range")).toBe("bytes */1000")
  })

  it("maps Google Docs mime type to docx for export", async () => {
    vi.mocked(dbfiles.getFileForUser).mockResolvedValueOnce(makeFileRow({
      mimeType: "application/vnd.google-apps.document"
    }))

    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(new ReadableStream(), {
      status: 200,
      headers: new Headers({
        "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    }))

    const req = new Request(`http://localhost/api/stream/${MOCK_FILE_ID}`)
    const res = await GET(req, { params: Promise.resolve({ id: MOCK_FILE_ID }) })

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    expect(res.headers.has("accept-ranges")).toBe(false)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("export?mimeType="),
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Range: expect.any(String),
        }),
      })
    )
  })
})
