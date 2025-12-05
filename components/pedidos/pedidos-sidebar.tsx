"use client"

import { Button } from "@/components/ui/button"
import { Plus, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { Pedido } from "@/lib/types"

interface PedidosSidebarProps {
  pedidos: Pedido[]
  selectedPedido: Pedido | null
  onSelectPedido: (pedido: Pedido) => void
  onCreatePedido: () => void
}

export function PedidosSidebar({ 
  pedidos, 
  selectedPedido, 
  onSelectPedido, 
  onCreatePedido 
}: PedidosSidebarProps) {
  // En móvil: selector horizontal compacto
  // En desktop: sidebar vertical
  return (
    <>
      {/* Mobile: selector horizontal */}
      <div className="lg:hidden">
        <div className="flex items-center gap-1 p-1 rounded-lg border border-border bg-card">
          {pedidos.length === 0 ? (
            <>
              <span className="text-xs text-muted-foreground px-1">Sin pedidos</span>
              <div className="flex-1" />
              <Button size="sm" className="h-7 text-xs" onClick={onCreatePedido}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Crear
              </Button>
            </>
          ) : (
            <>
              {/* Lista horizontal scrolleable */}
              <div className="flex-1 flex gap-1 overflow-x-auto scrollbar-none">
                {pedidos.map(pedido => (
                  <button
                    key={pedido.id}
                    onClick={() => onSelectPedido(pedido)}
                    className={cn(
                      "flex-shrink-0 px-2 py-1 rounded text-xs font-medium transition-colors",
                      selectedPedido?.id === pedido.id 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    {pedido.nombre}
                  </button>
                ))}
              </div>
              {/* Botón agregar */}
              <Button size="icon" className="h-7 w-7 shrink-0" onClick={onCreatePedido}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Desktop: sidebar vertical */}
      <div className="hidden lg:block w-48 flex-shrink-0">
        <div className="rounded-lg border border-border bg-card p-1.5 sticky top-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold">Mis Pedidos</span>
            <Button size="icon" className="h-6 w-6" onClick={onCreatePedido}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          {pedidos.length === 0 ? (
            <div className="text-center py-3 text-muted-foreground">
              <FileText className="h-5 w-5 mx-auto mb-1 opacity-50" />
              <p className="text-[10px]">No tienes pedidos</p>
              <Button variant="link" size="sm" className="h-5 text-[10px] px-0" onClick={onCreatePedido}>
                Crear pedido
              </Button>
            </div>
          ) : (
            <div className="space-y-0.5">
              {pedidos.map(pedido => (
                <button
                  key={pedido.id}
                  onClick={() => onSelectPedido(pedido)}
                  className={cn(
                    "w-full text-left px-1.5 py-1 rounded text-xs transition-colors",
                    "hover:bg-accent",
                    selectedPedido?.id === pedido.id 
                      ? "bg-accent text-accent-foreground font-medium" 
                      : "text-muted-foreground"
                  )}
                >
                  <div className="truncate">{pedido.nombre}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
