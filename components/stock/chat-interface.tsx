"use client"

import { useState, useRef, useEffect } from "react"
import { 
  Send, Loader2, RefreshCw, Trash2, AlertCircle, CheckCircle2, 
  XCircle, HelpCircle, Bot, User, AlertTriangle, StopCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/lib/types"

interface OllamaStatus {
  status: "checking" | "ok" | "error"
  message?: string
  modeloDisponible?: boolean
}

interface ChatInterfaceProps {
  messages: ChatMessage[]
  isProcessing: boolean
  ollamaStatus: OllamaStatus
  onSendMessage: (message: string) => void
  onClearChat: () => void
  onCancelMessage?: () => void
  onRefreshConnection: () => void
  accionPendiente?: any
  nombreAsistente?: string
}

export function ChatInterface({
  messages,
  isProcessing,
  ollamaStatus,
  onSendMessage,
  onClearChat,
  onCancelMessage,
  onRefreshConnection,
  accionPendiente,
  nombreAsistente = "Stock Assistant",
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll al final cuando hay nuevos mensajes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus en textarea al montar
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Auto-resize del textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      const scrollHeight = textarea.scrollHeight
      const maxHeight = 200 // Máximo 200px (aproximadamente 8-9 líneas)
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`
      textarea.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden"
    }
  }, [inputValue])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isProcessing || ollamaStatus.status !== "ok") return
    
    onSendMessage(inputValue)
    setInputValue("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
    // Shift + Enter permite nueva línea (comportamiento por defecto del textarea)
  }

  const handleQuickAction = (texto: string) => {
    if (isProcessing || ollamaStatus.status !== "ok") return
    onSendMessage(texto)
  }

  // Sugerencias rápidas
  const sugerencias = [
    { texto: "¿Qué puedo hacer?", icon: HelpCircle },
    { texto: "Mostrar productos", icon: null },
    { texto: "¿Qué me falta pedir?", icon: null },
  ]

  return (
    <div className="flex flex-col h-full rounded-lg border border-border bg-card overflow-hidden">
      {/* Header con estado de conexión */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-medium text-sm">{nombreAsistente}</span>
          <div className="flex items-center gap-1.5 ml-2">
            {ollamaStatus.status === "checking" && (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Conectando...</span>
              </>
            )}
            {ollamaStatus.status === "ok" && (
              <>
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs text-green-600 dark:text-green-400">Conectado</span>
              </>
            )}
            {ollamaStatus.status === "error" && (
              <>
                <span className="h-2 w-2 rounded-full bg-destructive" />
                <span className="text-xs text-destructive">Desconectado</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onRefreshConnection}
            title="Reconectar"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClearChat}
            title="Limpiar chat"
            disabled={messages.length === 0}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Área de mensajes */}
      <div className="flex-1 overflow-y-auto min-h-0" ref={scrollRef}>
        <div className="p-4 space-y-4">
          {messages.length === 0 && ollamaStatus.status !== "ok" ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              {ollamaStatus.status === "checking" ? (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Conectando con Ollama...</p>
                </>
              ) : (
                <>
                  <XCircle className="h-10 w-10 text-destructive mb-4" />
                  <h3 className="font-semibold mb-2">Sin conexión</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {ollamaStatus.message || "Asegurate de que Ollama esté corriendo"}
                  </p>
                  <Button onClick={onRefreshConnection} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reintentar
                  </Button>
                </>
              )}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Iniciando asistente...</p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isProcessing && (
                <div className="flex items-start gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 bg-muted rounded-2xl rounded-tl-md px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Pensando...</span>
                    {onCancelMessage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 -mr-1"
                        onClick={onCancelMessage}
                        title="Cancelar"
                      >
                        <StopCircle className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sugerencias rápidas */}
      {messages.length > 0 && !isProcessing && !accionPendiente && ollamaStatus.status === "ok" && (
        <div className="px-3 pb-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {sugerencias.map((sug, i) => (
              <button
                key={i}
                onClick={() => handleQuickAction(sug.texto)}
                className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-accent transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
              >
                {sug.icon && <sug.icon className="h-3 w-3" />}
                {sug.texto}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Botones de confirmación */}
      {accionPendiente && (
        <div className="px-3 pb-2">
          <div className="flex gap-2 justify-center p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <Button
              size="sm"
              onClick={() => handleQuickAction("sí")}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Confirmar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleQuickAction("no")}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Input de mensaje */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-muted/30">
        {ollamaStatus.status === "error" && (
          <div className="flex items-center gap-2 text-xs text-destructive mb-2 p-2 rounded bg-destructive/10">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span>{ollamaStatus.message || "Asegurate de que Ollama esté corriendo"}</span>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                accionPendiente 
                  ? "Escribí 'sí' para confirmar o 'no' para cancelar..."
                  : ollamaStatus.status === "ok" 
                    ? "Escribí lo que necesitás... (Shift + Enter para nueva línea)" 
                    : "Esperando conexión..."
              }
              disabled={isProcessing || ollamaStatus.status !== "ok"}
              className={cn(
                "resize-none min-h-[44px] max-h-[200px] py-3 px-4",
                "focus-visible:ring-2 focus-visible:ring-primary/20",
                "leading-relaxed"
              )}
              rows={1}
            />
          </div>
          <Button 
            type="submit" 
            size="icon"
            className="h-[44px] w-[44px] shrink-0"
            disabled={!inputValue.trim() || isProcessing || ollamaStatus.status !== "ok"}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.tipo === "usuario"
  const isError = message.tipo === "error"
  const isConfirmacion = message.tipo === "confirmacion"

  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
          isError ? "bg-destructive/10" : isConfirmacion ? "bg-amber-500/10" : "bg-primary/10"
        )}>
          {isError ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : isConfirmacion ? (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          ) : (
            <Bot className="h-4 w-4 text-primary" />
          )}
        </div>
      )}
      
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
          isUser && "bg-primary text-primary-foreground rounded-br-md",
          message.tipo === "sistema" && "bg-muted rounded-tl-md",
          isConfirmacion && "bg-amber-500/10 border border-amber-500/20 rounded-tl-md",
          isError && "bg-destructive/10 text-destructive border border-destructive/20 rounded-tl-md"
        )}
      >
        <p className="whitespace-pre-wrap">{message.contenido}</p>
        <span className={cn(
          "text-[10px] opacity-50 mt-1.5 block",
          isUser ? "text-right" : "text-left"
        )}>
          {message.timestamp.toLocaleTimeString("es-AR", { 
            hour: "2-digit", 
            minute: "2-digit" 
          })}
        </span>
      </div>

      {isUser && (
        <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-accent-foreground" />
        </div>
      )}
    </div>
  )
}
