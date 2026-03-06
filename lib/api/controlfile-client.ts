import { auth } from "@/lib/firebase"

export type ControlfileRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  headers?: Record<string, string>
  idempotencyKey?: string
  requestId?: string
}

export class ControlfileApiError extends Error {
  code: string
  details?: unknown
  correlationId?: string

  constructor(message: string, code = "CONTROLFILE_ERROR", details?: unknown, correlationId?: string) {
    super(message)
    this.name = "ControlfileApiError"
    this.code = code
    this.details = details
    this.correlationId = correlationId
  }
}

export function getControlfileBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_CONTROLFILE_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://controlfile.onrender.com"
  )
}

function buildUrl(path: string): string {
  const base = getControlfileBaseUrl().replace(/\/$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${base}${normalizedPath}`
}

export async function controlfileRequest<T>(path: string, options: ControlfileRequestOptions = {}): Promise<T> {
  const method = options.method || "GET"
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers
  }

  const currentUser = auth?.currentUser
  if (currentUser) {
    const token = await currentUser.getIdToken()
    headers.Authorization = `Bearer ${token}`
  }

  if (options.idempotencyKey) headers["x-idempotency-key"] = options.idempotencyKey
  if (options.requestId) headers["x-request-id"] = options.requestId

  const response = await fetch(buildUrl(path), {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store"
  })

  if (!response.ok) {
    let payload: any = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    throw new ControlfileApiError(
      payload?.message || `Request failed with status ${response.status}`,
      payload?.code || `HTTP_${response.status}`,
      payload?.details,
      payload?.correlationId
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
