"use client"

import { MessageCircle, X } from "lucide-react"
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
  } = useStockChatContext()

  return (
    <>
      {/* Botón flotante - solo cuando el chat está cerrado */}
      {!chatIsOpen && (
        <div className="fixed bottom-4 left-4 z-50">
          <Button
            onClick={() => setChatIsOpen(true)}
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90"
          >
            <MessageCircle className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Sidebar - cuando el chat está abierto */}
      {chatIsOpen && (
        <>
          {/* Overlay para cerrar al hacer click fuera */}
          <div
            className="fixed inset-0 bg-black/20 z-40 lg:hidden"
            onClick={() => setChatIsOpen(false)}
          />
          
          {/* Sidebar */}
          <div className="fixed top-0 right-0 h-full w-full lg:w-1/4 z-50 bg-background border-l border-border shadow-2xl flex flex-col transition-all duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">{nombreAsistente}</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setChatIsOpen(false)}
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Chat Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
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
          </div>
        </>
      )}
    </>
  )
}

