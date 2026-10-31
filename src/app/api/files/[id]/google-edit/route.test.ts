import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { POST } from "./route"
import * as guard from "@/server/guard"
import * as dbfiles from "@/server/files"
import * as tokens from "@/server/google/tokens"
import { db } from "@/server/db"
import { AppError } from "@/server/errors"

vi.mock("@/server/guard", () => ({
  requireUser: vi.fn(),
}))

vi.mock("@/server/files", () => ({
  getFileForUser: vi.fn()
}))

vi.mock("@/server/google/tokens", () => ({
  getAccessToken: vi.fn()
}))

vi.mock("@/server/db", async () => {
  const { sql } = await import("drizzle-orm")
  return {
    db: {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    },
  }
})

describe("POST /api/files/[id]/google-edit", () => {
  const MOCK_USER_ID = "00000000-0000-0000-0000-000000000001"
  const MOCK_FILE_ID = "00000000-0000-4000-8000-000000000002"
  const MOCK_DRIVE_ACCOUNT_ID = "00000000-0000-0000-0000-000000000003"
  const mockUser = { id: MOCK_USER_ID, email: "test@example.com", status: "approved", role: "editor" }

  beforeEach(() => {
    vi.mocked(guard.requireUser).mockResolvedValue(mockUser)
    vi.mocked(tokens.getAccessToken).mockResolvedValue("mock-token")

    vi.mocked(dbfiles.getFileForUser).mockResolvedValue({
      id: MOCK_FILE_ID,
      driveAccountId: MOCK_DRIVE_ACCOUNT_ID,
      providerFileId: "provider-123",
      webViewLink: "https://docs.google.com/test",
      trashed: false,
    })

    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("adds writer permission if not existing", async () => {
    // 1. List
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ permissions: [] }),
    })

    // 2. Add
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    const req = new Request(`http://localhost/api/files/${MOCK_FILE_ID}/google-edit`, {
      method: "POST"
    })

    const res = await POST(req, { params: Promise.resolve({ id: MOCK_FILE_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.data.url).toBe("https://docs.google.com/test")

    expect(global.fetch).toHaveBeenNthCalledWith(1,
      expect.stringContaining("permissions?supportsAllDrives=true&fields="),
      expect.any(Object)
    )

    expect(global.fetch).toHaveBeenNthCalledWith(2,
      expect.stringContaining("permissions?supportsAllDrives=true&sendNotificationEmail=false"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ type: "user", role: "writer", emailAddress: "test@example.com" })
      })
    )
  })

  it("skips adding if writer permission already exists", async () => {
    // 1. List
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        permissions: [
          { type: "user", emailAddress: "test@example.com", role: "writer" }
        ]
      }),
    })

    const req = new Request(`http://localhost/api/files/${MOCK_FILE_ID}/google-edit`, {
      method: "POST"
    })

    const res = await POST(req, { params: Promise.resolve({ id: MOCK_FILE_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it("returns 403 if user lacks drive access", async () => {
    vi.mocked(dbfiles.getFileForUser).mockRejectedValueOnce(
      new AppError("FORBIDDEN", "No access to this Drive", 403)
    )

    const req = new Request(`http://localhost/api/files/${MOCK_FILE_ID}/google-edit`, {
      method: "POST"
    })

    const res = await POST(req, { params: Promise.resolve({ id: MOCK_FILE_ID }) })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error.code).toBe("FORBIDDEN")
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
