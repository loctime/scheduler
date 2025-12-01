"use client"

import { Spinner } from "@/components/ui/spinner"

interface ExportOverlayProps {
  isExporting: boolean
  message?: string
}

export function ExportOverlay({ isExporting, message = "Exportando..." }: ExportOverlayProps) {
  if (!isExporting) return null

  return (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
      style={{
        pointerEvents: 'all',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onClick={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Contenedor simple con spinner y texto */}
      <div className="flex flex-col items-center gap-6">
        <Spinner className="h-12 w-12 text-primary" />
        <div className="text-center space-y-2">
          <p className="text-2xl font-semibold text-foreground">{message}</p>
          <p className="text-base text-muted-foreground">Por favor, no interactúe con la página</p>
        </div>
      </div>
    </div>
  )
}

