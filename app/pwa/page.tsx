"use client"

import Link from "next/link"
import { LoginForm } from "@/components/login-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useData } from "@/contexts/data-context"

export default function PwaEntryPage() {
  const { user } = useData()

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

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>PWA unificada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Usa enlaces públicos para módulos de horario/mensual y ruta privada para stock.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><Link className="underline" href="/pwa/stock-console">/pwa/stock-console (privado)</Link></li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
