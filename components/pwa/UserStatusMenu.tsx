"use client"

import { useRouter } from "next/navigation"
import { User, LogOut, LogIn, RefreshCw } from "lucide-react"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useData } from "@/contexts/data-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const LOGIN_PATH = "/registro"
const PWA_PATH = "/pwa"

export function UserStatusMenu() {
  const { user } = useData()
  const router = useRouter()
  const isAuthenticated = !!user

  const displayName =
    user?.displayName?.trim() ||
    user?.email?.split("@")[0] ||
    user?.email ||
    "Usuario"

  const handleLogout = async () => {
    if (!auth) return
    await signOut(auth)
    router.push(`${LOGIN_PATH}?redirect=${encodeURIComponent(PWA_PATH)}`)
  }

  const handleChangeAccount = async () => {
    if (!auth) return
    await signOut(auth)
    router.push(`${LOGIN_PATH}?redirect=${encodeURIComponent(PWA_PATH)}&change=1`)
  }

  const handleLogin = () => {
    router.push(`${LOGIN_PATH}?redirect=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : PWA_PATH)}`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full"
          aria-label={isAuthenticated ? "Menú de usuario" : "Iniciar sesión"}
        >
          <User
            className={cn(
              "h-5 w-5",
              isAuthenticated ? "text-foreground" : "text-muted-foreground"
            )}
          />
          {isAuthenticated && (
            <span
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background"
              aria-hidden
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {isAuthenticated ? (
          <>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium truncate">{displayName}</span>
                {user?.email && (
                  <span className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </span>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleChangeAccount}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Cambiar cuenta
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} variant="destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel className="text-muted-foreground font-normal">
              No has iniciado sesión
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogin}>
              <LogIn className="mr-2 h-4 w-4" />
              Iniciar sesión
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
