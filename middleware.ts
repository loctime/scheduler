import { NextRequest, NextResponse } from "next/server"

// Rutas privadas PWA (stock-console requiere login): /pwa/[slug]/stock-console
function isPrivatePwaPath(pathname: string): boolean {
  return /^\/pwa\/[^/]+\/stock-console\/?$/.test(pathname)
}

// Rutas públicas PWA unificadas: /pwa, /pwa/[slug]/*, /pwa/invite/*, /pwa/stock-console/* (redirect), /pwa/horario/* (redirect)
function isPublicPwaPath(pathname: string): boolean {
  if (pathname === "/pwa" || pathname === "/pwa/") return true
  if (pathname.startsWith("/pwa/invite/")) return true
  // /pwa/stock-console y /pwa/stock-console/xxx (redirect a arquitectura unificada)
  if (pathname === "/pwa/stock-console" || pathname.startsWith("/pwa/stock-console/")) return true
  // /pwa/horario/xxx (redirect a /pwa/xxx/horario)
  if (pathname.startsWith("/pwa/horario/")) return true
  // /pwa/[slug], /pwa/[slug]/horario, /pwa/[slug]/home, /pwa/[slug]/mensual, /pwa/[slug]/stock-console
  return /^\/pwa\/([^/]+)(?:\/(horario|mensual|home|stock-console))?\/?$/.test(pathname)
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

  // /pwa/horario sin slug → redirect a /pwa
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
