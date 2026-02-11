"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, ArrowLeft } from "lucide-react"

/**
 * Página 404 controlada para rutas públicas mensuales de companySlug
 * 
 * Características:
 * - No revela información sensible
 * - Mensaje genérico sin confirmar existencia
 * - Opciones de navegación seguras
 * - Logging del intento para seguridad
 */
export default function PublicMensualNotFound() {
  const router = useRouter()

  useEffect(() => {
    // Log del intento de acceso para seguridad
    console.log(`🔍 [PublicMensual404] Acceso a vista mensual no encontrada: ${window.location.pathname}`)
    
    // En producción, esto podría ir a una colección de logs
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'page_not_found', {
        page_title: 'Public Mensual Not Found',
        page_location: window.location.pathname
      })
    }
  }, [])

  const handleGoHome = () => {
    router.push('/')
  }

  const handleGoBack = () => {
    router.back()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            {/* Icono de error */}
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            
            {/* Mensaje principal */}
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-gray-900">
                Vista mensual no encontrada
              </h1>
              <p className="text-sm text-gray-600">
                La vista mensual que buscas no está disponible o el enlace es incorrecto.
              </p>
            </div>

            {/* Instrucciones */}
            <div className="text-left bg-gray-50 rounded-lg p-3 space-y-2">
              <p className="text-xs text-gray-600">
                <strong>Posibles causas:</strong>
              </p>
              <ul className="text-xs text-gray-600 space-y-1 ml-4">
                <li>• El enlace fue escrito incorrectamente</li>
                <li>• La vista mensual fue desactivada</li>
                <li>• La empresa cambió su enlace público</li>
                <li>• El horario nunca fue publicado</li>
              </ul>
            </div>

            {/* Botones de acción */}
            <div className="space-y-2 pt-2">
              <Button 
                onClick={handleGoHome}
                className="w-full"
                variant="default"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Ir al inicio
              </Button>
              
              <Button 
                onClick={handleGoBack}
                className="w-full"
                variant="outline"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver atrás
              </Button>
            </div>

            {/* Información de contacto */}
            <div className="text-xs text-gray-500 pt-2 border-t">
              <p>
                Si crees que esto es un error, contacta al administrador del horario.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
