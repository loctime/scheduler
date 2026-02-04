"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Calendar, Users, LogOut, Settings, CalendarDays, Menu, ShoppingCart, Factory, Shield, UserCog, MessageSquare, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useStockChatContext } from "@/contexts/stock-chat-context"
import { useData } from "@/contexts/data-context"

interface DashboardLayoutProps {
  children: ReactNode
  user: any
}

const navItems = [
  { href: "/dashboard", label: "Horarios", icon: Calendar },
  { href: "/dashboard/horarios-mensuales", label: "Vista Mensual", icon: CalendarDays },
  { href: "/dashboard/empleados", label: "Empleados", icon: Users },
  { href: "/dashboard/pedidos", label: "Pedidos", icon: ShoppingCart },
  { href: "/mensajeria", label: "Mensajería", icon: MessageSquare },
  { href: "/dashboard/dias-especiales", label: "Días Especiales", icon: AlertTriangle, role: "admin" },
  { href: "/dashboard/fabrica", label: "Fábrica", icon: Factory, role: "factory" },
  { href: "/dashboard/gerente", label: "Gerente", icon: UserCog, role: "manager" },
  { href: "/dashboard/admin", label: "Administración", icon: Shield, role: "admin" },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings },
]

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { userData } = useData()
  
  // Obtener estado del chat para ajustar el padding del contenido
  let chatIsOpen = false
  let setChatIsOpen: ((open: boolean) => void) | undefined = undefined
  try {
    const chatContext = useStockChatContext()
    chatIsOpen = chatContext.chatIsOpen
    setChatIsOpen = chatContext.setChatIsOpen
  } catch {
    // Si no hay contexto (página fuera del dashboard), no hacer nada
  }

  const handleSignOut = async () => {
    if (!auth) return
    await signOut(auth)
  }

  // Mapeo de .rutas a IDs de páginas (debe coincidir con el de layout.tsx)
  const ROUTE_TO_PAGE_ID: Record<string, string> = {
    "/dashboard": "horarios",
    "/dashboard/horarios": "horarios",
    "/dashboard/horarios-mensuales": "horarios",
    "/dashboard/pedidos": "pedidos",
    "/dashboard/fabrica": "fabrica",
    "/dashboard/fabrica/historial": "fabrica",
    "/dashboard/empleados": "empleados",
    "/dashboard/turnos": "turnos",
    "/dashboard/configuracion": "configuracion",
    "/dashboard/gerente": "gerente",
    "/dashboard/admin": "admin",
    "/dashboard/dias-especiales": "admin", // Solo admin puede gestionar días especiales
  }

  // Filtrar navItems según el role del usuario y permisos
  const navItemsFiltered = navItems.filter((item) => {
    // Si el usuario tiene permisos definidos, verificar que la página esté permitida
    if (userData?.permisos?.paginas && Array.isArray(userData.permisos.paginas) && userData.permisos.paginas.length > 0) {
      const pageId = ROUTE_TO_PAGE_ID[item.href]
      // Si la ruta no está mapeada (como /mensajeria), NO permitirla cuando hay permisos definidos
      if (!pageId) {
        // Excluir mensajería y otras rutas no mapeadas cuando hay permisos definidos
        return false
      }
      
      // Si el permiso es "horarios", verificar según el rol del usuario
      if (userData.permisos.paginas.includes("horarios")) {
        // Si el usuario es "invited" (creado por fábrica/sucursal), solo permitir vista mensual
        if (userData.role === "invited") {
          // Solo permitir "/dashboard/horarios-mensuales", excluir "/dashboard" y "/dashboard/horarios"
          if (item.href === "/dashboard/horarios-mensuales") {
            // Continuar con las otras verificaciones
          } else if (item.href === "/dashboard" || item.href === "/dashboard/horarios") {
            // Excluir la vista de edición de horarios para usuarios invited
            return false
          } else {
            // Para otras páginas, verificar normalmente
            if (!userData.permisos.paginas.includes(pageId)) {
              return false
            }
          }
        } else {
          // Si NO es "invited" (fue creado por gerente), permitir ambas vistas
          const tienePermiso = userData.permisos.paginas.includes(pageId)
          if (!tienePermiso) {
            return false
          }
        }
      } else {
        // Si no tiene permiso de "horarios", verificar normalmente
        const tienePermiso = userData.permisos.paginas.includes(pageId)
        if (!tienePermiso) {
          return false
        }
      }
      // Si pasa la verificación de permisos, continuar con las otras verificaciones
    }
    
    // Si el usuario es invitado y NO tiene permisos definidos, solo mostrar Pedidos
    if (userData?.role === "invited" && (!userData?.permisos?.paginas || !Array.isArray(userData.permisos.paginas) || userData.permisos.paginas.length === 0)) {
      return item.href === "/dashboard/pedidos"
    }
    
    // Si el item requiere un rol específico, verificar que el usuario lo tenga
    // PERO si el usuario tiene permisos definidos y tiene el permiso para esa página, permitirla
    if ((item as any).role) {
      const pageId = ROUTE_TO_PAGE_ID[item.href]
      // Si tiene permisos definidos y tiene el permiso para esta página, permitirla aunque no tenga el rol
      if (userData?.permisos?.paginas && Array.isArray(userData.permisos.paginas) && pageId && userData.permisos.paginas.includes(pageId)) {
        // Permitir porque tiene el permiso
      } else if (userData?.role !== (item as any).role) {
        // No tiene el rol requerido ni el permiso, bloquear
        return false
      }
    }
    // Usuarios normales ven todas las páginas (excepto las que requieren roles específicos)
    return true
  })
  
  // Debug: mostrar permisos en consola
  if (userData?.permisos?.paginas) {
    console.log("🔐 Permisos del usuario:", userData.permisos.paginas)
    console.log("📋 Items filtrados:", navItemsFiltered.map(item => item.href))
  }

  const NavContent = ({ onItemClick }: { onItemClick?: () => void }) => (
    <div className="flex flex-col gap-1 md:flex-row">
      {navItemsFiltered.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href
        return (
          <Link key={item.href} href={item.href} onClick={onItemClick}>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start md:w-auto flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-5 text-muted-foreground hover:bg-transparent hover:text-foreground md:rounded-none",
                isActive && "border-primary text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium">{item.label}</span>
            </Button>
          </Link>
        )
      })}
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="flex h-16 items-center justify-between px-3 sm:px-6">
          <div className="flex items-center gap-2">
            {/* Menú hamburguesa para móvil */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Abrir menú</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] sm:w-[300px]">
                <SheetHeader>
                  <div className="flex items-center gap-2 pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                      <Calendar className="h-6 w-6 text-accent-foreground" />
                    </div>
                    <SheetTitle className="text-lg font-bold">Menú</SheetTitle>
                  </div>
                </SheetHeader>
                <NavContent onItemClick={() => setMobileMenuOpen(false)} />
              </SheetContent>
            </Sheet>

            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent sm:h-10 sm:w-10">
              <Calendar className="h-4 w-4 text-accent-foreground sm:h-6 sm:w-6" />
            </div>
            <h1 className="text-base font-bold text-card-foreground sm:text-xl">Gestión de Horarios</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="relative h-8 w-8 sm:h-10 sm:w-10"
              onClick={() => setChatIsOpen?.(true)}
              title="Abrir chat"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full sm:h-10 sm:w-10">
                <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                  <AvatarImage src={user?.photoURL || ""} alt={user?.displayName || ""} />
                  <AvatarFallback className="bg-accent text-accent-foreground">
                    {user?.displayName?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover">
              <DropdownMenuLabel className="text-popover-foreground">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.displayName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Navigation - Desktop only */}
        <nav className="hidden border-t border-border bg-card px-6 md:block">
          <NavContent />
        </nav>
      </header>

      {/* Main Content */}
      <main className={cn(
        "flex-1 p-3 sm:p-4 md:p-6 transition-all duration-300",
        chatIsOpen && "lg:pr-[25%]" // padding-right cuando chat está abierto (25% del ancho) solo en desktop
      )}>
        {children}
      </main>
    </div>
  )
}
