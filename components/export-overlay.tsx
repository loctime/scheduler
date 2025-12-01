"use client"

import { Hammer } from "lucide-react"
import { cn } from "@/lib/utils"

interface ExportOverlayProps {
  isExporting: boolean
  message?: string
}

// Componente de yunque simple
function AnvilIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Base del yunque */}
      <rect x="4" y="18" width="16" height="3" rx="1" />
      {/* Cuerpo del yunque */}
      <path d="M8 18V8a4 4 0 0 1 8 0v10" />
      {/* Parte superior (horno) */}
      <path d="M6 8h12" />
      <path d="M7 5h10" />
      {/* Pico del yunque */}
      <path d="M12 5v3" />
    </svg>
  )
}

export function ExportOverlay({ isExporting, message = "Exportando..." }: ExportOverlayProps) {
  if (!isExporting) return null

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-md"
      style={{
        pointerEvents: 'all',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onClick={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex flex-col items-center gap-8 rounded-2xl bg-card/95 backdrop-blur-sm p-12 shadow-2xl border-2 border-border/50">
        {/* Contenedor del martillo y yunque */}
        <div className="relative flex flex-col items-center justify-center">
          {/* Yunque (base) */}
          <div className="relative">
            <AnvilIcon className="h-20 w-20 text-muted-foreground/80" />
            {/* Efecto de impacto en el yunque */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-impact-sparks">
                <div className="w-1.5 h-1.5 bg-primary rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                <div className="w-1 h-1 bg-primary/70 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>
          
          {/* Martillo (arriba, golpeando) */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2">
            <Hammer 
              className={cn(
                "h-16 w-16 text-primary",
                "animate-hammer-strike"
              )}
              style={{
                transformOrigin: 'bottom center',
              }}
            />
          </div>
        </div>

        {/* Texto */}
        <div className="text-center space-y-3">
          <p className="text-2xl font-bold text-foreground">{message}</p>
          <p className="text-base text-muted-foreground">Por favor, no interactúe con la página</p>
        </div>
      </div>
    </div>
  )
}

