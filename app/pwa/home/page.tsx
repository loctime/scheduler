"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCompanySlug } from "@/hooks/use-company-slug"
import { Button } from "@/components/ui/button"
import { Calendar, FileText, Users } from "lucide-react"

export default function PwaHomePage() {
  const router = useRouter()
  const { companySlug } = useCompanySlug()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Panel PWA</h1>
            <p className="text-muted-foreground">
              Acceso rápido a todas las funcionalidades del sistema
            </p>
          </div>

          {/* Main Navigation Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Horario Semanal */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <Calendar className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    <h3 className="font-semibold">Horario Semanal</h3>
                    <p className="text-sm text-muted-foreground">Vista y edición semanal</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Button
                    className="w-full"
                    disabled={!companySlug}
                    onClick={() => companySlug && router.push(`/pwa/horario/${companySlug}`)}
                  >
                    Ir a Horario
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Horarios Mensuales */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    <h3 className="font-semibold">Horarios Mensuales</h3>
                    <p className="text-sm text-muted-foreground">Vista mensual completa</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Button
                    className="w-full"
                    disabled={!companySlug}
                    onClick={() => companySlug && router.push(`/pwa/mensual/${companySlug}`)}
                  >
                    Ir a Mensual
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Stock Console */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <Users className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    <h3 className="font-semibold">Stock Console</h3>
                    <p className="text-sm text-muted-foreground">Gestión de stock</p>
                  </div>
                </div>
                <Link href="/pwa/stock-console" className="mt-4 block">
                  <Button className="w-full" variant="outline">Ir a Stock</Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Info Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información de Acceso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Rutas Privadas (requieren login):</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• /pwa/horario/[companySlug] - Horario semanal</li>
                    <li>• /pwa/mensual/[companySlug] - Vista mensual</li>
                    <li>• /pwa/stock-console - Gestión de stock</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Rutas Públicas (acceso libre):</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• /pwa/horario/[companySlug] - Horario público</li>
                    <li>• /pwa/mensual/[companySlug] - Vista mensual pública</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
