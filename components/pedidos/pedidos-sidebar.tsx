"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
        <Card className="border-border bg-card">
          <CardContent className="p-2">
            {pedidos.length === 0 ? (
              <div className="flex items-center justify-between py-2 px-2">
                <span className="text-sm text-muted-foreground">Sin pedidos</span>
                <Button size="sm" onClick={onCreatePedido}>
                  <Plus className="h-4 w-4 mr-1" />
                  Crear
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* Lista horizontal scrolleable */}
                <div className="flex-1 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {pedidos.map(pedido => (
                    <button
                      key={pedido.id}
                      onClick={() => onSelectPedido(pedido)}
                      className={cn(
                        "flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
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
                <Button size="icon" className="h-9 w-9 shrink-0" onClick={onCreatePedido}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Desktop: sidebar vertical */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        <Card className="border-border bg-card sticky top-4">
          <CardHeader className="pb-3 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Mis Pedidos</CardTitle>
              <Button size="icon" className="h-8 w-8" onClick={onCreatePedido}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            {pedidos.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tienes pedidos</p>
                <Button variant="link" size="sm" onClick={onCreatePedido}>
                  Crear primer pedido
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {pedidos.map(pedido => (
                  <button
                    key={pedido.id}
                    onClick={() => onSelectPedido(pedido)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md transition-colors text-sm",
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
          </CardContent>
        </Card>
      </div>
    </>
  )
}
