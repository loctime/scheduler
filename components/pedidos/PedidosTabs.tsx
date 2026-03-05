"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type PedidosTabId = "productos" | "remitos" | "recepcion"

export interface PedidosTabsProps {
  activeTab: PedidosTabId
  setActiveTab: (tab: PedidosTabId) => void
  selectedPedido: { estado?: string } | null
  remitosCount: number
}

export function PedidosTabs({
  activeTab,
  setActiveTab,
  selectedPedido,
  remitosCount
}: PedidosTabsProps) {
  const showRecepcionTab =
    selectedPedido?.estado === "enviado" || selectedPedido?.estado === "recibido"

  return (
    <div className="flex gap-0.5 sm:gap-1 border-t sm:border-t-0 border-l sm:border-l sm:border-r border-border overflow-x-hidden">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 sm:h-8 px-1.5 sm:px-3 rounded-none border-b-2 border-transparent text-[11px] sm:text-sm font-medium flex-1 sm:flex-initial",
          activeTab === "productos" && "border-primary text-primary font-medium"
        )}
        onClick={() => setActiveTab("productos")}
      >
        <span className="hidden sm:inline">Productos</span>
        <span className="sm:hidden">Productos</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 sm:h-8 px-1.5 sm:px-3 rounded-none border-b-2 border-transparent text-[11px] sm:text-sm font-medium flex-1 sm:flex-initial",
          activeTab === "remitos" && "border-primary text-primary font-medium"
        )}
        onClick={() => setActiveTab("remitos")}
      >
        <span className="hidden sm:inline">Remitos {remitosCount > 0 && `(${remitosCount})`}</span>
        <span className="sm:hidden">Remitos {remitosCount > 0 && `(${remitosCount})`}</span>
      </Button>
      {showRecepcionTab && (
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 sm:h-8 px-1.5 sm:px-3 rounded-none border-b-2 border-transparent text-[11px] sm:text-sm font-medium flex-1 sm:flex-initial",
            activeTab === "recepcion" && "border-primary text-primary font-medium"
          )}
          onClick={() => setActiveTab("recepcion")}
        >
          <span className="hidden sm:inline">Recepción</span>
          <span className="sm:hidden">Rec.</span>
        </Button>
      )}
    </div>
  )
}
