"use client"

import type { ReactNode } from "react"
import { useState, useEffect } from "react"
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
import { Calendar, Users, LogOut, Settings, CalendarDays, Menu, ShoppingCart, Shield, MessageSquare, AlertTriangle, Package, CheckSquare, ShoppingBag, Factory, ClipboardCheck, BookMarked, Warehouse } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useData } from "@/contexts/data-context"
import { canUser, type UserAction } from "@/lib/permissions"

interface DashboardLayoutProps {
  children: ReactNode
  user: any
}

const navGroups = [
  {
    id: "operativa",
    label: "Operativa",
    icon: Calendar,
    items: [
      { href: "/dashboard", label: "Horarios", icon: Calendar },
      { href: "/dashboard/horarios-mensuales", label: "Vista Mensual", icon: CalendarDays },
      { href: "/dashboard/empleados", label: "Empleados", icon: Users },
      { href: "/dashboard/tareas", label: "Tareas", icon: CheckSquare },
      { href: "/dashboard/dias-especiales", label: "Dias Especiales", icon: AlertTriangle, action: "ver_admin"},
    ],
  },
  {
    id: "logistica",
    label: "Logística",
    icon: Package,
    items: [
      { href: "/dashboard/pedidos", label: "Stock", icon: ShoppingCart, action: "ver_pedidos" },
      { href: "/dashboard/pedir", label: "Pedir insumos", icon: ShoppingBag, action: "crear_pedido" },
      { href: "/dashboard/logistica-fabrica", label: "Fábrica", icon: Factory, action: "ver_logistica" },
      { href: "/dashboard/recepciones", label: "Recepciones", icon: ClipboardCheck, action: "recibir_pedido" },
      { href: "/dashboard/catalogo", label: "Catálogo", icon: BookMarked, action: "ver_admin" },
      { href: "/dashboard/mi-stock", label: "Mi stock", icon: Warehouse, action: "editar_stock" },
      { href: "/dashboard/stock-console", label: "Stock rápido (PWA)", icon: Package, action: "editar_stock" },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    icon: Settings,
    items: [
      { href: "/mensajeria", label: "Mensajeria", icon: MessageSquare },
      { href: "/dashboard/admin", label: "Administracion", icon: Shield, action: "ver_admin" },
      { href: "/dashboard/configuracion", label: "Configuracion", icon: Settings },
    ],
  },
]

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { userData } = useData()

  const handleSignOut = async () => {
    if (!auth) return
    await signOut(auth)
  }

  // Filtrar grupos y sus items segun acciones
  const navGroupsFiltered = navGroups.map(group => ({
    ...group,
    items: group.items.filter((item) => {
      if (!item.action) return true
      return canUser(
        { uid: user?.uid, role: userData?.role, locationId: userData?.locationId },
        item.action as UserAction
      )
    })
  })).filter(group => group.items.length > 0)

  // Determinar grupo activo basado en el pathname
  const activeGroupId = navGroupsFiltered.find(group => 
    group.items.some(item => pathname === item.href)
  )?.id || navGroupsFiltered[0]?.id

  const [manualActiveGroupId, setManualActiveGroupId] = useState<string | null>(null)
  const currentGroupId = manualActiveGroupId || activeGroupId

  // Resetear el grupo manual cuando cambia el activeGroupId (navegación real)
  useEffect(() => {
    setManualActiveGroupId(null)
  }, [activeGroupId])

  const NavContent = ({ onItemClick, items }: { onItemClick?: () => void, items: any[] }) => (
    <div className="flex flex-col gap-1 md:flex-row">
      {items.map((item) => {
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

  const CategoryNav = ({ activeId, onSelect }: { activeId: string, onSelect: (id: string) => void }) => (
    <div className="flex gap-1 overflow-x-auto pb-0">
      {navGroupsFiltered.map((group) => {
        const Icon = group.icon
        const isActive = group.id === activeId
        return (
          <Button
            key={group.id}
            variant="ghost"
            onClick={() => onSelect(group.id)}
            className={cn(
              "flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-3 text-muted-foreground hover:bg-transparent hover:text-foreground",
              isActive && "border-primary text-foreground font-bold",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="text-sm uppercase tracking-wider">{group.label}</span>
          </Button>
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
              <SheetContent side="left" className="w-[280px] sm:w-[300px] overflow-y-auto">
                <SheetHeader>
                  <div className="flex items-center gap-2 pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                      <Calendar className="h-6 w-6 text-accent-foreground" />
                    </div>
                    <SheetTitle className="text-lg font-bold">Menú</SheetTitle>
                  </div>
                </SheetHeader>
                <div className="space-y-6">
                  {navGroupsFiltered.map(group => (
                    <div key={group.id}>
                      <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</h3>
                      <NavContent items={group.items} onItemClick={() => setMobileMenuOpen(false)} />
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>

            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent sm:h-10 sm:w-10">
              <Calendar className="h-4 w-4 text-accent-foreground sm:h-6 sm:w-6" />
            </div>
            <h1 className="text-base font-bold text-card-foreground sm:text-xl">Gestión de Horarios</h1>
          </div>

          <div className="flex items-center gap-2">
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

        {/* Navigation - Desktop only - Double Navbar */}
        <nav className="hidden border-t border-border bg-card px-6 md:block">
          <CategoryNav activeId={currentGroupId} onSelect={setManualActiveGroupId} />
          <div className="border-t border-border/50">
            <NavContent items={navGroupsFiltered.find(g => g.id === currentGroupId)?.items || []} />
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-3 sm:p-4 md:p-6 transition-all duration-300">
        {children}
      </main>
    </div>
  )
}


