"use client"

import { MessageCircle, X, RefreshCw, Trash2, Loader2 } from "lucide-react"
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
    modoIA,
    setModoIA,
    productosAcumulados,
    pedidos,
    pedidoSeleccionado,
    setPedidoSeleccionado,
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
            <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">{nombreAsistente}</h3>
                <div className="flex items-center gap-1.5 ml-2">
                  {ollamaStatus.status === "checking" && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Conectando...</span>
                    </>
                  )}
                  {ollamaStatus.status === "ok" && ollamaStatus.modeloDisponible && (
                    <>
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-xs text-green-600 dark:text-green-400">IA disponible</span>
                    </>
                  )}
                  {ollamaStatus.status === "ok" && !ollamaStatus.modeloDisponible && (
                    <>
                      <span className="h-2 w-2 rounded-full bg-yellow-500" />
                      <span className="text-xs text-yellow-600 dark:text-yellow-400">Sin IA</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={checkOllamaConnection}
                  title="Reconectar"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={limpiarChat}
                  title="Limpiar chat"
                  disabled={messages.length === 0}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setChatIsOpen(false)}
                  title="Cerrar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Chat Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
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
                modoIA={modoIA}
                setModoIA={setModoIA}
                productosAcumulados={productosAcumulados}
                pedidos={pedidos}
                pedidoSeleccionado={pedidoSeleccionado}
                setPedidoSeleccionado={setPedidoSeleccionado}
              />
            </div>
          </div>
        </>
      )}
    </>
  )
}

