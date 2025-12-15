"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth, isFirebaseConfigured } from "@/lib/firebase"
import { DataProvider, useData } from "@/contexts/data-context"
import { StockChatProvider } from "@/contexts/stock-chat-context"
import { StockChatFloating } from "@/components/stock/stock-chat-floating"
import { Loader2 } from "lucide-react"

// Mapeo de rutas a IDs de páginas
const ROUTE_TO_PAGE_ID: Record<string, string> = {
  "/dashboard": "horarios",
  "/dashboard/horarios": "horarios",
  "/dashboard/horarios-mensuales": "horarios", // Vista mensual también mapea a "horarios"
  "/dashboard/pedidos": "pedidos",
  "/dashboard/fabrica": "fabrica",
  "/dashboard/fabrica/historial": "fabrica",
  "/dashboard/empleados": "empleados",
  "/dashboard/turnos": "turnos",
  "/dashboard/configuracion": "configuracion",
  "/dashboard/gerente": "gerente",
  "/dashboard/admin": "admin",
}

// Páginas permitidas para usuarios invitados (por defecto)
const ALLOWED_PAGES_FOR_INVITED = ["/dashboard/pedidos"]

// Páginas que requieren rol específico
const FACTORY_PAGES = ["/dashboard/fabrica", "/dashboard/fabrica/historial"]
const MANAGER_PAGES = ["/dashboard/gerente"]
const ADMIN_PAGES = ["/dashboard/admin"]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      router.push("/")
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/")
      } else {
        setUser(currentUser)
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <DataProvider user={user}>
      <StockChatProvider user={user}>
        <ProtectedRoute user={user} pathname={pathname} router={router}>
          {children}
        </ProtectedRoute>
        <StockChatFloating />
      </StockChatProvider>
    </DataProvider>
  )
}

// Componente para proteger rutas según el role del usuario
function ProtectedRoute({ 
  children, 
  user, 
  pathname, 
  router 
}: { 
  children: React.ReactNode
  user: any
  pathname: string
  router: any
}) {
  const { userData } = useData()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (userData) {
      const pageId = ROUTE_TO_PAGE_ID[pathname]
      
      // Verificar permisos basados en páginas accesibles si el usuario tiene permisos definidos
      if (userData.permisos?.paginas && Array.isArray(userData.permisos.paginas) && userData.permisos.paginas.length > 0) {
        // Si tiene permisos definidos, verificar que la página esté en la lista
        if (pageId) {
          let tienePermiso = false
          
          // Si el permiso es "horarios", verificar según el rol del usuario
          if (userData.permisos.paginas.includes("horarios")) {
            // Si el usuario es "invited" (creado por fábrica/sucursal), solo permitir vista mensual
            if (userData.role === "invited") {
              // Solo permitir acceso a vista mensual, bloquear vista de edición
              if (pathname === "/dashboard/horarios-mensuales") {
                tienePermiso = true
              } else if (pathname === "/dashboard" || pathname === "/dashboard/horarios") {
                // Bloquear acceso a la vista de edición para usuarios invited
                tienePermiso = false
              } else {
                // Para otras páginas, verificar normalmente
                tienePermiso = userData.permisos.paginas.includes(pageId)
              }
            } else {
              // Si NO es "invited" (fue creado por gerente), permitir ambas vistas
              tienePermiso = userData.permisos.paginas.includes(pageId)
            }
          } else {
            // Si no tiene permiso de "horarios", verificar normalmente
            tienePermiso = userData.permisos.paginas.includes(pageId)
          }
          
          if (!tienePermiso) {
            // Redirigir a la primera página permitida o a pedidos por defecto
            const primeraPagina = userData.permisos.paginas[0]
            // Buscar la ruta correspondiente a la primera página permitida
            // Si es "horarios", preferir "/dashboard/horarios-mensuales" si está disponible
            let rutaPermitida = "/dashboard/pedidos"
            if (primeraPagina === "horarios") {
              // Preferir vista mensual si el usuario tiene permiso de horarios
              rutaPermitida = "/dashboard/horarios-mensuales"
            } else {
              for (const [ruta, id] of Object.entries(ROUTE_TO_PAGE_ID)) {
                if (id === primeraPagina) {
                  rutaPermitida = ruta
                  break
                }
              }
            }
            router.push(rutaPermitida)
            return
          }
        }
        // Si no hay pageId pero tiene permisos, permitir acceso (puede ser una ruta no mapeada pero permitida)
      } else {
        // Lógica de permisos basada en roles (comportamiento anterior)
        // Si el usuario es invitado y está intentando acceder a una página no permitida
        if (userData.role === "invited" && !ALLOWED_PAGES_FOR_INVITED.includes(pathname)) {
          router.push("/dashboard/pedidos")
          return
        }
        // Si el usuario intenta acceder a páginas de fábrica sin ser factory
        if (FACTORY_PAGES.some(page => pathname.startsWith(page)) && userData.role !== "factory") {
          router.push("/dashboard/pedidos")
          return
        }
        // Si el usuario intenta acceder a páginas de gerente sin ser manager
        if (MANAGER_PAGES.some(page => pathname.startsWith(page)) && userData.role !== "manager") {
          router.push("/dashboard")
          return
        }
        // Si el usuario intenta acceder a páginas de admin sin ser admin
        if (ADMIN_PAGES.some(page => pathname.startsWith(page)) && userData.role !== "admin") {
          router.push("/dashboard")
          return
        }
      }
      setChecking(false)
    }
  }, [userData, pathname, router])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return <>{children}</>
}

