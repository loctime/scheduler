"use client"

import { useData } from "@/contexts/data-context"
import { Card, CardContent } from "@/components/ui/card"
import { LoginForm } from "@/components/login-form"
import { VencAppShell } from "@/components/vencapp/VencAppShell"

export default function VencAppPage() {
  const { user, userData } = useData()

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    )
  }

  const tienePermisoPedidos = userData?.permisos?.paginas?.includes("pedidos")
  if (!tienePermisoPedidos) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-red-700">Acceso denegado</h2>
          <p className="mt-2 text-sm text-red-600">
            Esta sección requiere el permiso "pedidos".
          </p>
        </div>
      </div>
    )
  }

  return <VencAppShell />
}

