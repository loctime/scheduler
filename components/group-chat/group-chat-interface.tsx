"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send } from "lucide-react"
import { useGroupMessaging } from "@/hooks/use-group-messaging"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface GroupChatInterfaceProps {
  user: any
  conversacionId: string
  onClose?: () => void
}

export function GroupChatInterface({ user, conversacionId, onClose }: GroupChatInterfaceProps) {
  const { mensajes, enviarMensaje } = useGroupMessaging(user)
  const [mensaje, setMensaje] = useState("")
  const [enviando, setEnviando] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [mensajes])

  return (
    <div className="flex flex-col h-full">
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
        <div className="flex gap-2">
          <Input
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            placeholder="Escribe un mensaje..."
            disabled={enviando}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleEnviar(e)
              }
            }}
          />
          <Button type="submit" disabled={enviando || !mensaje.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}

