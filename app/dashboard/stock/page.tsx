"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useData } from "@/contexts/data-context"
import { useStockChat } from "@/hooks/use-stock-chat"
import { ChatInterface } from "@/components/stock/chat-interface"
import { StockSidebar } from "@/components/stock/stock-sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { MessageCircle, Package, PanelRightClose, PanelRightOpen } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export default function StockPage() {
  const { user } = useData()
  const [showInventario, setShowInventario] = useState(false)
  
  const {
    // Chat
    messages,
    isProcessing,
    enviarMensaje,
    limpiarChat,
    cancelarMensaje,
    ollamaStatus,
    checkOllamaConnection,
    accionPendiente,
    nombreAsistente,
    
    // Stock
    productos,
    stockActual,
    movimientos,
    loadingStock,
    productosStockBajo,
  } = useStockChat({
    userId: user?.uid,
    userName: user?.displayName || user?.email,
    user,
  })

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

      {/* Contenido principal - Responsive */}
      <div className="block lg:hidden">
        {/* Vista móvil: Tabs */}
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="inventario" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Inventario
              {productosStockBajo.length > 0 && (
                <span className="ml-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                  {productosStockBajo.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="chat" className="mt-0">
            <div className="h-[calc(100vh-280px)] min-h-[400px]">
              <ChatInterface
                messages={messages}
                isProcessing={isProcessing}
                ollamaStatus={ollamaStatus}
                onSendMessage={enviarMensaje}
                onClearChat={limpiarChat}
                onCancelMessage={cancelarMensaje}
                onRefreshConnection={checkOllamaConnection}
                accionPendiente={accionPendiente}
                nombreAsistente={nombreAsistente}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="inventario" className="mt-0">
            <div className="h-[calc(100vh-280px)] min-h-[400px]">
              <StockSidebar
                productos={productos}
                stockActual={stockActual}
                movimientos={movimientos}
                productosStockBajo={productosStockBajo}
                loading={loadingStock}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Vista desktop: Side by side */}
      <div className="hidden lg:flex gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Chat */}
        <div className="flex-1 min-w-0">
          <ChatInterface
            messages={messages}
            isProcessing={isProcessing}
            ollamaStatus={ollamaStatus}
            onSendMessage={enviarMensaje}
            onClearChat={limpiarChat}
            onCancelMessage={cancelarMensaje}
            onRefreshConnection={checkOllamaConnection}
            accionPendiente={accionPendiente}
            nombreAsistente={nombreAsistente}
          />
        </div>
        
        {/* Sidebar de inventario - colapsable */}
        <div className={cn(
          "transition-all duration-300 ease-in-out flex flex-col",
          showInventario ? "w-[320px]" : "w-10"
        )}>
          {/* Botón toggle */}
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "h-10 w-10 shrink-0 mb-2",
              productosStockBajo.length > 0 && !showInventario && "border-amber-500 text-amber-500"
            )}
            onClick={() => setShowInventario(!showInventario)}
            title={showInventario ? "Ocultar inventario" : "Mostrar inventario"}
          >
            {showInventario ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <>
                <PanelRightOpen className="h-4 w-4" />
                {productosStockBajo.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 text-[10px] text-white flex items-center justify-center">
                    {productosStockBajo.length}
                  </span>
                )}
              </>
            )}
          </Button>
          
          {/* Sidebar content */}
          {showInventario && (
            <div className="flex-1 min-h-0">
              <StockSidebar
                productos={productos}
                stockActual={stockActual}
                movimientos={movimientos}
                productosStockBajo={productosStockBajo}
                loading={loadingStock}
              />
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

