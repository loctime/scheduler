"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { useData } from "@/contexts/data-context"
import { useStockChat } from "@/hooks/use-stock-chat"
import { ChatInterface } from "@/components/stock/chat-interface"
import { StockSidebar } from "@/components/stock/stock-sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageCircle, Package, BarChart3 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function StockPage() {
  const { user } = useData()
  
  const {
    // Chat
    messages,
    isProcessing,
    enviarMensaje,
    limpiarChat,
    ollamaStatus,
    checkOllamaConnection,
    accionPendiente,
    
    // Stock
    productos,
    stockActual,
    movimientos,
    loadingStock,
    productosStockBajo,
  } = useStockChat({
    userId: user?.uid,
    userName: user?.displayName || user?.email,
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
                onRefreshConnection={checkOllamaConnection}
                accionPendiente={accionPendiente}
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
      <div className="hidden lg:flex gap-6 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Chat - 2/3 del espacio */}
        <div className="flex-[2]">
          <ChatInterface
            messages={messages}
            isProcessing={isProcessing}
            ollamaStatus={ollamaStatus}
            onSendMessage={enviarMensaje}
            onClearChat={limpiarChat}
            onRefreshConnection={checkOllamaConnection}
            accionPendiente={accionPendiente}
          />
        </div>
        
        {/* Sidebar de inventario - 1/3 del espacio */}
        <div className="flex-1 min-w-[300px] max-w-[400px]">
          <StockSidebar
            productos={productos}
            stockActual={stockActual}
            movimientos={movimientos}
            productosStockBajo={productosStockBajo}
            loading={loadingStock}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}

