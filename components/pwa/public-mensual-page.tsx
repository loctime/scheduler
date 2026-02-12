"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function PublicMensualPage({ companySlug }: { companySlug: string }) {
  const router = useRouter()

  useEffect(() => {
    console.log("🔧 [PublicMensualPage] Redirigiendo a:", `/dashboard/horarios-mensuales/${companySlug}`)
    
    // Redirigir a la nueva ruta del dashboard que es pública
    window.location.href = `/dashboard/horarios-mensuales/${companySlug}`
  }, [companySlug])

  // Mostrar loader mientras redirige
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirigiendo al horario mensual...</p>
      </div>
    </div>
  )
}
