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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      style={{
        pointerEvents: 'all',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onClick={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex flex-col items-center gap-4 rounded-lg bg-card p-8 shadow-lg border">
        <Spinner className="h-8 w-8 text-primary" />
        <p className="text-lg font-medium text-foreground">{message}</p>
        <p className="text-sm text-muted-foreground">Por favor, no interactúe con la página</p>
      </div>
    </div>
  )
}

