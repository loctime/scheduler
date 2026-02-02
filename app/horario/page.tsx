"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Calendar, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useData } from "@/contexts/data-context"
import { useOwnerId } from "@/hooks/use-owner-id"

export default function HorarioRedirectPage() {
  const router = useRouter()
  const { userData } = useData()
  const ownerId = useOwnerId()

  useEffect(() => {
    // Si tenemos ownerId, redirigir a la página pública
    if (ownerId) {
      router.replace(`/horario/${ownerId}`)
    }
  }, [ownerId, router])

  if (!ownerId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="text-gray-500 mb-4">
              <Calendar className="h-12 w-12 mx-auto" />
            </div>
            <h1 className="text-lg font-semibold mb-2">Cargando...</h1>
            <p className="text-gray-600 text-sm">
              Preparando tu horario...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <div className="text-gray-500 mb-4">
            <Calendar className="h-12 w-12 mx-auto" />
          </div>
          <h1 className="text-lg font-semibold mb-2">Redirigiendo...</h1>
          <p className="text-gray-600 text-sm mb-4">
            Te estamos redirigiendo a tu horario público.
          </p>
          <Button
            onClick={() => router.push(`/horario/${ownerId}`)}
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Ver Horario Público
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
