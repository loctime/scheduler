import { NextRequest, NextResponse } from "next/server"

// Rutas privadas PWA (requieren login): app/pwa/stock-console/[companySlug] → /pwa/stock-console/xxx
function isPrivatePwaPath(pathname: string): boolean {
  return pathname === "/pwa/stock-console" || pathname.startsWith("/pwa/stock-console/")
}

// Rutas públicas PWA: /pwa/mensual (con ?uid=), /pwa/[slug]/horario, /pwa/[slug]/home; /pwa/slug/mensual sin página → 404
function isPublicPwaPath(pathname: string): boolean {
  if (pathname === "/pwa/mensual" || pathname.startsWith("/pwa/horario/") || pathname.startsWith("/pwa/mensual/")) return true
  const match = pathname.match(/^\/pwa\/([^/]+)(?:\/(horario|mensual|home))?\/?$/)
  return !!match
}

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

  const isPrivate = isPrivatePwaPath(pathname)
  const isPublic = isPublicPwaPath(pathname)

  // No redirigir a /pwa (da 404). La página stock-console muestra LoginForm cuando no hay auth.
  if (isPrivate && !hasValidFirebaseToken(request)) {
    return NextResponse.next()
  }

  // /pwa/mensual?uid=XXX es la ruta válida; solo redirigir /pwa/horario sin segmento
  if (pathname === "/pwa/horario") {
    return NextResponse.redirect(new URL("/pwa", request.url))
  }

  if (pathname.startsWith("/pwa/") && !isPrivate && !isPublic && pathname !== "/pwa" && !pathname.startsWith("/pwa/invite/")) {
    return NextResponse.redirect(new URL("/pwa", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/pwa/:path*"],
}
