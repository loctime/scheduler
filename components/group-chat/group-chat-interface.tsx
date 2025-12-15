"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, X } from "lucide-react"
import { useGroupMessaging } from "@/hooks/use-group-messaging"
import { useData } from "@/contexts/data-context"
import { useIsMobile } from "@/hooks/use-mobile"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface GroupChatInterfaceProps {
  user: any
  conversacionId: string
  onClose?: () => void
}

export function GroupChatInterface({ user, conversacionId, onClose }: GroupChatInterfaceProps) {
  const { mensajes, enviarMensaje, conversaciones } = useGroupMessaging(user, conversacionId)
  const { userData } = useData()
  const isMobile = useIsMobile()
  const [mensaje, setMensaje] = useState("")
  const [enviando, setEnviando] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // Obtener información de la conversación activa
  const conversacionActiva = conversaciones.find(c => c.id === conversacionId)
  const miNombre = userData?.displayName || user.displayName || user.email?.split("@")[0] || "Usuario"
  const nombreConversacion = conversacionActiva?.tipo === "directo"
    ? conversacionActiva.nombresParticipantes?.find(n => n !== miNombre) || "Usuario"
    : conversacionActiva?.nombresParticipantes?.join(" ↔ ") || "Conversación"

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mensaje.trim() || enviando) return

    setEnviando(true)
    const exito = await enviarMensaje(conversacionId, mensaje)
    if (exito) {
      setMensaje("")
    }
    setEnviando(false)
  }

  useEffect(() => {
    // Usar setTimeout para evitar bucles infinitos
    const timer = setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
      }
    }, 100)
    
    return () => clearTimeout(timer)
  }, [mensajes])

  return (
    <div className="flex flex-col h-full">
      {/* Header con nombre del chat */}
      <div className="border-b bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-lg">{nombreConversacion}</h2>
          {conversacionActiva?.tipo && (
            <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
              {conversacionActiva.tipo === "directo" ? "Privado" : "Grupo"}
            </span>
          )}
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {mensajes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>No hay mensajes aún. ¡Envía el primero!</p>
            </div>
          ) : (
            mensajes.map((msg) => {
              const esMio = msg.remitenteId === user.uid
              return (
                <div
                  key={msg.id}
                  className={`flex ${esMio ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      esMio
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {!esMio && (
                      <div className="text-xs font-semibold mb-1 opacity-80">
                        {msg.remitenteNombre}
                        {msg.remitenteRole && (
                          <span className="ml-1 opacity-60">({msg.remitenteRole})</span>
                        )}
                      </div>
                    )}
                    <div className="text-sm whitespace-pre-wrap break-words">{msg.contenido}</div>
                    <div className="text-xs opacity-70 mt-1">
                      {msg.timestamp
                        ? format(msg.timestamp, "HH:mm", { locale: es })
                        : ""}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <form onSubmit={handleEnviar} className="p-4 border-t">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={mensaje}
              onChange={(e) => {
                setMensaje(e.target.value)
                // Auto-ajustar altura del textarea
                if (textareaRef.current) {
                  textareaRef.current.style.height = "auto"
                  textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
                }
              }}
              placeholder="Escribe un mensaje..."
              disabled={enviando}
              rows={1}
              className="resize-none min-h-[40px] max-h-[120px] pr-12"
              onKeyDown={(e) => {
                // En móvil: Enter siempre hace salto de línea (comportamiento nativo del textarea)
                // En desktop: Shift+Enter hace salto de línea, Enter solo envía
                if (!isMobile && e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleEnviar(e)
                }
                // En móvil, el Enter del teclado virtual hace salto de línea automáticamente
              }}
            />
          </div>
          <Button 
            type="submit" 
            disabled={enviando || !mensaje.trim()}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}

