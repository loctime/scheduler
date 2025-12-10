"use client"

import { Check, Circle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Pedido } from "@/lib/types"

interface PedidoTimelineProps {
  pedido: Pedido
}

const estados = [
  { key: "creado" as const, label: "Creado" },
  { key: "enviado" as const, label: "Enviado" },
  { key: "recibido" as const, label: "Recibido" },
  { key: "completado" as const, label: "Completado" },
]

export function PedidoTimeline({ pedido }: PedidoTimelineProps) {
  const estadoActual = pedido.estado || "creado"
  const estadoIndex = estados.findIndex(e => e.key === estadoActual)

  return (
    <div className="flex items-center justify-between sm:justify-start gap-1 sm:gap-4 py-4 flex-wrap">
      {estados.map((estado, index) => {
        const isActive = index <= estadoIndex
        const isCurrent = index === estadoIndex

        return (
          <div key={estado.key} className="flex items-center gap-0.5 sm:gap-2 flex-1 sm:flex-initial justify-center sm:justify-start">
            <div className="flex flex-col items-center gap-0.5 sm:gap-2">
              <div
                className={cn(
                  "flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full border-2 transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted bg-background text-muted-foreground"
                )}
              >
                {isActive ? (
                  <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                ) : (
                  <Circle className="h-3 w-3 sm:h-4 sm:w-4" />
                )}
              </div>
              <span
                className={cn(
                  "text-[9px] sm:text-xs font-medium text-center",
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {estado.label}
              </span>
            </div>
            {index < estados.length - 1 && (
              <div
                className={cn(
                  "hidden sm:block h-0.5 w-8 transition-colors",
                  index < estadoIndex ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
