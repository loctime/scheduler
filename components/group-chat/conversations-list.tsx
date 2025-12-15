"use client"

import { useGroupMessaging } from "@/hooks/use-group-messaging"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageCircle, Factory, Building2, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useGroups } from "@/hooks/use-groups"
import { useData } from "@/contexts/data-context"

interface ConversationsListProps {
  user: any
  onSelectConversation: (conversacionId: string) => void
}

export function ConversationsList({
  user,
  onSelectConversation,
}: ConversationsListProps) {
  const { 
    conversaciones, 
    conversacionActiva, 
    setConversacionActiva, 
    obtenerOCrearConversacion, 
    loading 
  } = useGroupMessaging(user)
  const { groups } = useGroups(user)
  const { userData } = useData()

  const handleSelectConversation = (conversacionId: string) => {
    setConversacionActiva(conversacionId)
    onSelectConversation(conversacionId)
  }

  const handleCreateWithGroup = async (grupoId: string) => {
    const conversacionId = await obtenerOCrearConversacion(grupoId, "grupo")
    if (conversacionId) {
      handleSelectConversation(conversacionId)
    }
  }

  const handleCreateWithFactory = async () => {
    // Buscar grupo de fábrica o usuarios con rol factory
    const grupoFabrica = groups.find(g => {
      const nombreLower = g.nombre.toLowerCase()
      return nombreLower.includes("fábrica") || 
             nombreLower.includes("fabrica") ||
             nombreLower.includes("factory")
    })
    
    if (grupoFabrica) {
      await handleCreateWithGroup(grupoFabrica.id)
    } else {
      // Si no hay grupo de fábrica, buscar usuarios con rol factory
      // Por ahora, solo mostramos un mensaje
      console.log("No se encontró grupo de fábrica")
    }
  }

  // Filtrar grupos disponibles (excluir el propio)
  const miGrupoId = userData?.grupoIds?.[0]
  const gruposDisponibles = groups.filter(
    g => g.id !== miGrupoId && g.id !== user?.uid
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg">Conversaciones</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Lista de conversaciones existentes */}
          {conversaciones.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No hay conversaciones. Crea una nueva conversación con otro grupo.
            </div>
          ) : (
            conversaciones.map((conv) => {
              const noLeidos = conv.noLeidos?.[user?.uid || ""] || 
                               conv.noLeidos?.[userData?.grupoIds?.[0] || ""] || 0
              return (
                <Button
                  key={conv.id}
                  variant={conversacionActiva === conv.id ? "secondary" : "ghost"}
                  className="w-full justify-start mb-1 h-auto py-3"
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <MessageCircle className="h-4 w-4 mr-2 shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-medium truncate">
                      {conv.nombresParticipantes?.join(" ↔ ") || "Conversación"}
                    </div>
                    {conv.ultimoMensaje && (
                      <div className="text-xs text-muted-foreground truncate mt-1">
                        {conv.ultimoMensaje}
                      </div>
                    )}
                    {conv.ultimoMensajeAt && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {conv.ultimoMensajeAt?.toDate 
                          ? format(conv.ultimoMensajeAt.toDate(), "dd/MM HH:mm", { locale: es })
                          : conv.ultimoMensajeAt instanceof Date
                          ? format(conv.ultimoMensajeAt, "dd/MM HH:mm", { locale: es })
                          : ""}
                      </div>
                    )}
                  </div>
                  {noLeidos > 0 && (
                    <span className="ml-2 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs shrink-0">
                      {noLeidos}
                    </span>
                  )}
                </Button>
              )
            })
          )}

          {/* Botón para crear conversación con fábrica */}
          {userData?.role === "branch" && (
            <div className="mt-4 p-2 border-t">
              <div className="text-sm font-medium mb-2">Nueva conversación</div>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleCreateWithFactory}
              >
                <Factory className="h-4 w-4 mr-2" />
                Enviar a Fábrica
              </Button>
            </div>
          )}

          {/* Lista de grupos disponibles */}
          {gruposDisponibles.length > 0 && (
            <div className="mt-4 p-2 border-t">
              <div className="text-sm font-medium mb-2">Otros grupos</div>
              {gruposDisponibles.map((grupo) => (
                <Button
                  key={grupo.id}
                  variant="outline"
                  className="w-full justify-start mb-1"
                  onClick={() => handleCreateWithGroup(grupo.id)}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  <span className="truncate">{grupo.nombre}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

