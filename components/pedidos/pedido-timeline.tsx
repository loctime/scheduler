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
    <div className="flex items-center gap-4 py-4">
      {estados.map((estado, index) => {
        const isActive = index <= estadoIndex
        const isCurrent = index === estadoIndex

        return (
          <div key={estado.key} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted bg-background text-muted-foreground"
                )}
              >
                {isActive ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {estado.label}
              </span>
            </div>
            {index < estados.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-12 transition-colors",
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
