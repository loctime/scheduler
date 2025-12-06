"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useData } from "@/contexts/data-context"
import { useStockChatContext } from "@/contexts/stock-chat-context"
import { StockSidebar } from "@/components/stock/stock-sidebar"
import { StockChatSidebar } from "@/components/stock/stock-chat-sidebar"
import { Button } from "@/components/ui/button"
import { MessageCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export default function StockPage() {
  const { user } = useData()
  const [chatIsOpen, setChatIsOpen] = useState(true)
  
  const {
    // Stock
    productos,
    stockActual,
    movimientos,
    loadingStock,
    productosStockBajo,
  } = useStockChatContext()

  return (
    <DashboardLayout user={user}>
      {/* Header */}
      <div className="mb-4 lg:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              Control de Stock
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gestioná tu inventario con comandos de voz natural
            </p>
          </div>
          <div className="flex items-center gap-2">
            {productosStockBajo.length > 0 && (
              <Badge variant="destructive" className="self-start">
                {productosStockBajo.length} con stock bajo
              </Badge>
            )}
            {!chatIsOpen && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setChatIsOpen(true)}
                className="gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                Abrir Chat
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Contenido principal - Layout de dos columnas */}
      <div className="h-[calc(100vh-220px)] min-h-[500px] flex flex-col lg:flex-row gap-4">
        {/* Inventario - Columna izquierda */}
        <div className={cn(
          "transition-all duration-300",
          chatIsOpen ? "hidden lg:flex lg:flex-1" : "flex-1 w-full"
        )}>
          <StockSidebar
            productos={productos}
            stockActual={stockActual}
            movimientos={movimientos}
            productosStockBajo={productosStockBajo}
            loading={loadingStock}
          />
        </div>

        {/* Chat - Sidebar derecho */}
        {chatIsOpen && (
          <div className="w-full lg:w-full lg:max-w-md flex-shrink-0">
            <StockChatSidebar
              isOpen={chatIsOpen}
              onClose={() => setChatIsOpen(false)}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

