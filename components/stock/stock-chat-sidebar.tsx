"use client"

import { MessageCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChatInterface } from "./chat-interface"
import { useStockChatContext } from "@/contexts/stock-chat-context"
import { cn } from "@/lib/utils"

interface StockChatSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function StockChatSidebar({ isOpen, onClose }: StockChatSidebarProps) {
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
  } = useStockChatContext()

  if (!isOpen) {
    return null
  }

  return (
    <div className="flex flex-col h-full border-l border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">Chat de Stock</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
          title="Cerrar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Chat Content */}
      <div className="flex-1 min-h-0">
        <ChatInterface
          messages={messages}
          isProcessing={isProcessing}
          ollamaStatus={ollamaStatus}
          onSendMessage={enviarMensaje}
          onCancelMessage={cancelarMensaje}
          accionPendiente={accionPendiente}
          nombreAsistente={nombreAsistente}
          modo={modo}
          setModo={setModo}
          productosAcumulados={productosAcumulados}
        />
      </div>
    </div>
  )
}

