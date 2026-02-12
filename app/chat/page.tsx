"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth, isFirebaseConfigured } from "@/lib/firebase"
import { DataProvider } from "@/contexts/data-context"
import { StockChatProvider } from "@/contexts/stock-chat-context"
import { ChatInterface } from "@/components/stock/chat-interface"
import { useStockChatContext } from "@/contexts/stock-chat-context"
import { Loader2, MessageCircle, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PWAUpdateNotification } from "@/components/pwa-update-notification"

function ChatContent() {
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
  } = useStockChatContext()

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header fijo */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h1 className="font-semibold text-base">{nombreAsistente}</h1>
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
        </div>
      </div>

      {/* Chat Interface - Ocupa todo el espacio restante */}
      <div className="flex-1 min-h-0 p-4">
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
  )
}

export default function ChatPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      router.push("/")
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/")
      } else {
        setUser(currentUser)
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  // El Service Worker se registra automáticamente mediante PWAUpdateNotification

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <DataProvider user={user}>
      <StockChatProvider user={user}>
        <ChatContent />
        <PWAUpdateNotification swPath="/sw-pwa.js" />
      </StockChatProvider>
    </DataProvider>
  )
}

