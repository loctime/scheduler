"use client"

import { useState, useRef, useEffect } from "react"
import { 
  Send, Loader2, AlertCircle, CheckCircle2, 
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
  onCancelMessage?: () => void
  accionPendiente?: any
  nombreAsistente?: string
  modo?: "ingreso" | "egreso" | "pregunta" | null
  setModo?: (modo: "ingreso" | "egreso" | "pregunta" | null) => void
  productosAcumulados?: Array<{
    productoId: string
    producto: string
    cantidad: number
    unidad?: string
    accion: "entrada" | "salida"
  }>
}

export function ChatInterface({
  messages,
  isProcessing,
  ollamaStatus,
  onSendMessage,
  onCancelMessage,
  accionPendiente,
  nombreAsistente = "Stock Assistant",
  modo,
  setModo,
  productosAcumulados = [],
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("")
  const [lastSentMessage, setLastSentMessage] = useState<string>("")
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
    // Ollama es opcional - solo bloqueamos si está procesando o sin texto
    if (!inputValue.trim() || isProcessing) return
    
    // Guardar el mensaje antes de enviarlo
    setLastSentMessage(inputValue)
    onSendMessage(inputValue)
    setInputValue("")
  }

  const handleCancel = () => {
    if (onCancelMessage) {
      // Buscar el último mensaje del usuario en los mensajes
      const ultimoMensajeUsuario = [...messages]
        .reverse()
        .find(msg => msg.tipo === "usuario")
      
      // Restaurar el mensaje al textarea
      const mensajeARestaurar = ultimoMensajeUsuario?.contenido || lastSentMessage
      
      if (mensajeARestaurar) {
        setInputValue(mensajeARestaurar)
      }
      
      // Cancelar el mensaje
      onCancelMessage()
      
      // Enfocar el textarea después de cancelar
      setTimeout(() => {
        textareaRef.current?.focus()
        // Mover el cursor al final
        if (textareaRef.current && mensajeARestaurar) {
          const length = mensajeARestaurar.length
          textareaRef.current.setSelectionRange(length, length)
        }
      }, 100)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
    // Shift + Enter permite nueva línea (comportamiento por defecto del textarea)
  }

  const handleQuickAction = (texto: string) => {
    // Ollama es opcional - solo bloqueamos si está procesando
    if (isProcessing) return
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
      {/* Área de mensajes */}
      <div className="flex-1 overflow-y-auto min-h-0" ref={scrollRef}>
        <div className="p-4 space-y-4">
          {messages.length === 0 && ollamaStatus.status === "checking" ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Iniciando asistente...</p>
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

      {/* Botones de modo */}
      {setModo && (
        <div className="px-3 border-t border-border bg-muted/30">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={modo === "ingreso" ? "default" : "outline"}
              onClick={() => {
                const nuevoModo = modo === "ingreso" ? null : "ingreso"
                setModo(nuevoModo)
              }}
              className={modo === "ingreso" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
              size="sm"
            >
              📥 Ingreso
            </Button>
            <Button
              type="button"
              variant={modo === "egreso" ? "default" : "outline"}
              onClick={() => {
                const nuevoModo = modo === "egreso" ? null : "egreso"
                setModo(nuevoModo)
              }}
              className={modo === "egreso" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
              size="sm"
            >
              📤 Egreso
            </Button>
            <Button
              type="button"
              variant={modo === "pregunta" ? "default" : "outline"}
              onClick={() => {
                const nuevoModo = modo === "pregunta" ? null : "pregunta"
                setModo(nuevoModo)
              }}
              className={modo === "pregunta" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
              size="sm"
            >
              ❓ Pregunta
            </Button>
          </div>
        </div>
      )}

      {/* Input de mensaje */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-muted/30">
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
                  : "Escribí lo que necesitás... (Shift + Enter para nueva línea)"
              }
              disabled={isProcessing}
              className={cn(
                "resize-none min-h-[44px] max-h-[200px] py-3 px-4",
                "focus-visible:ring-2 focus-visible:ring-primary/20",
                "leading-relaxed"
              )}
              rows={1}
            />
          </div>
          <div className="flex gap-1.5 shrink-0">
            {isProcessing && onCancelMessage && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-[44px] w-[44px] border-destructive/20 hover:bg-destructive/10 hover:border-destructive/40"
                onClick={handleCancel}
                title="Cancelar mensaje"
              >
                <StopCircle className="h-4 w-4 text-destructive" />
              </Button>
            )}
            <Button 
              type="submit" 
              size="icon"
              className="h-[44px] w-[44px]"
              disabled={!inputValue.trim() || isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
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
