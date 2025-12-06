"use client"

import { useState } from "react"
import { MessageCircle, X, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChatInterface } from "./chat-interface"
import { useStockChatContext } from "@/contexts/stock-chat-context"
import { cn } from "@/lib/utils"

export function StockChatFloating() {
  const {
    messages,
    isProcessing,
    enviarMensaje,
    limpiarChat,
    cancelarMensaje,
    ollamaStatus,
    checkOllamaConnection,
    accionPendiente,
    nombreAsistente,
    modo,
    setModo,
    productosAcumulados,
    chatIsOpen,
    setChatIsOpen,
    chatIsMinimized,
    setChatIsMinimized,
  } = useStockChatContext()

  if (!chatIsOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setChatIsOpen(true)}
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 transition-all duration-300",
        chatIsMinimized ? "w-80" : "w-full max-w-md"
      )}
      style={{ 
        // Asegurar que no interfiera con el contenido
        pointerEvents: "auto"
      }}
    >
      <div className="bg-background border border-border rounded-lg shadow-2xl flex flex-col h-[600px] max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm">Chat de Stock</h3>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setChatIsMinimized(!chatIsMinimized)
              }}
              title={chatIsMinimized ? "Expandir" : "Minimizar"}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setChatIsOpen(false)
                setChatIsMinimized(false)
              }}
              title="Cerrar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Chat Content */}
        {!chatIsMinimized && (
          <div className="flex-1 min-h-0">
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
              modo={modo}
              setModo={setModo}
              productosAcumulados={productosAcumulados}
            />
          </div>
        )}

        {/* Minimized view */}
        {chatIsMinimized && (
          <div className="flex-1 p-4 flex items-center justify-center text-sm text-muted-foreground">
            Chat minimizado - Click en expandir para continuar
          </div>
        )}
      </div>
    </div>
  )
}

