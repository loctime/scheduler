"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useData } from "@/contexts/data-context"
import { useStockChatContext } from "@/contexts/stock-chat-context"
import { StockSidebar } from "@/components/stock/stock-sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Package, PanelRightClose, PanelRightOpen } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export default function StockPage() {
  const { user } = useData()
  const [showInventario, setShowInventario] = useState(false)
  
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
          {productosStockBajo.length > 0 && (
            <Badge variant="destructive" className="self-start">
              {productosStockBajo.length} con stock bajo
            </Badge>
          )}
        </div>
      </div>

      {/* Contenido principal - Solo inventario (el chat está flotante) */}
      <div className="h-[calc(100vh-220px)] min-h-[500px]">
        <StockSidebar
          productos={productos}
          stockActual={stockActual}
          movimientos={movimientos}
          productosStockBajo={productosStockBajo}
          loading={loadingStock}
        />
      </div>
    </DashboardLayout>
  )
}

