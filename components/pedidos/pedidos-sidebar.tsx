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
  return (
    <div className="w-full lg:w-72 flex-shrink-0">
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Mis Pedidos</CardTitle>
            <Button size="sm" onClick={onCreatePedido}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          {pedidos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
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
                    "w-full text-left px-3 py-2 rounded-md transition-colors",
                    "hover:bg-accent",
                    selectedPedido?.id === pedido.id 
                      ? "bg-accent text-accent-foreground" 
                      : "text-muted-foreground"
                  )}
                >
                  <div className="font-medium truncate">{pedido.nombre}</div>
                  <div className="text-xs opacity-70">
                    Stock mín: {pedido.stockMinimoDefault}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

