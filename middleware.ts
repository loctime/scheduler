import { NextRequest, NextResponse } from "next/server"

const PRIVATE_PWA_PATHS = ["/pwa/stock-console"]
const PUBLIC_PWA_PREFIXES = ["/pwa/horario/", "/pwa/mensual/"]

function decodeJwtPayload(token: string): any | null {
  try {
    const [, payload] = token.split(".")
    if (!payload) return null
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
    return decoded
  } catch {
    return null
  }
}

function hasValidFirebaseToken(request: NextRequest): boolean {
  const token = request.cookies.get("firebase_id_token")?.value
  if (!token) return false

  const payload = decodeJwtPayload(token)
  if (!payload) return false

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  if (!projectId) return false

  const now = Math.floor(Date.now() / 1000)
  const issuer = `https://securetoken.google.com/${projectId}`

  return (
    payload.aud === projectId &&
    payload.iss === issuer &&
    typeof payload.exp === "number" &&
    payload.exp > now
  )
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPrivatePwaPath = PRIVATE_PWA_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  const isPublicPwaPath = PUBLIC_PWA_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (isPrivatePwaPath && !hasValidFirebaseToken(request)) {
    const loginUrl = new URL("/pwa", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname === "/pwa/horario" || pathname === "/pwa/mensual") {
    return NextResponse.redirect(new URL("/pwa", request.url))
  }

  if (pathname.startsWith("/pwa/") && !isPrivatePwaPath && !isPublicPwaPath && pathname !== "/pwa" && !pathname.startsWith("/pwa/invite/")) {
    return NextResponse.redirect(new URL("/pwa", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/pwa/:path*"],
}
