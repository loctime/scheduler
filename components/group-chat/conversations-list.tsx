"use client"

import { useState, useEffect } from "react"
import { useGroupMessaging } from "@/hooks/use-group-messaging"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { MessageCircle, Factory, Building2, Loader2, User, Search, X } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useGroups } from "@/hooks/use-groups"
import { useData } from "@/contexts/data-context"
import { collection, getDocs, query, orderBy } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"

interface ConversationsListProps {
  user: any
  onSelectConversation: (conversacionId: string) => void
}

interface UserInfo {
  id: string
  uid: string
  email?: string
  displayName?: string
  photoURL?: string
  role?: string
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
    obtenerOCrearConversacionDirecta,
    loading 
  } = useGroupMessaging(user)
  const { groups } = useGroups(user)
  const { userData } = useData()
  
  const [usuarios, setUsuarios] = useState<UserInfo[]>([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(false)
  const [mostrarUsuarios, setMostrarUsuarios] = useState(false)
  const [busquedaUsuario, setBusquedaUsuario] = useState("")

  // Cargar usuarios disponibles
  useEffect(() => {
    if (!db || !user || !mostrarUsuarios) return

    const cargarUsuarios = async () => {
      setLoadingUsuarios(true)
      try {
        const usersQuery = query(
          collection(db, COLLECTIONS.USERS),
          orderBy("displayName")
        )
        const snapshot = await getDocs(usersQuery)
        const usuariosData = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((u: UserInfo) => u.uid !== user.uid) as UserInfo[]
        
        setUsuarios(usuariosData)
      } catch (error) {
        console.error("Error al cargar usuarios:", error)
      } finally {
        setLoadingUsuarios(false)
      }
    }

    cargarUsuarios()
  }, [user, mostrarUsuarios])

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

  const handleCreateWithUser = async (usuarioId: string) => {
    const conversacionId = await obtenerOCrearConversacionDirecta(usuarioId)
    if (conversacionId) {
      handleSelectConversation(conversacionId)
      setMostrarUsuarios(false)
      setBusquedaUsuario("")
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

  // Filtrar usuarios según búsqueda
  const usuariosFiltrados = usuarios.filter(u => {
    if (!busquedaUsuario.trim()) return true
    const busqueda = busquedaUsuario.toLowerCase()
    return (
      u.displayName?.toLowerCase().includes(busqueda) ||
      u.email?.toLowerCase().includes(busqueda)
    )
  })

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
              // Calcular no leídos según el tipo de conversación
              let noLeidos = 0
              if (conv.tipo === "directo") {
                // En conversaciones directas, usar userId
                noLeidos = conv.noLeidos?.[user?.uid || ""] || 0
              } else {
                // En conversaciones de grupo, usar grupoId o userId
                noLeidos = conv.noLeidos?.[user?.uid || ""] || 
                           conv.noLeidos?.[userData?.grupoIds?.[0] || ""] || 0
              }
              
              return (
                <Button
                  key={conv.id}
                  variant={conversacionActiva === conv.id ? "secondary" : "ghost"}
                  className="w-full justify-start mb-1 h-auto py-3"
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  {conv.tipo === "directo" ? (
                    <User className="h-4 w-4 mr-2 shrink-0" />
                  ) : (
                    <MessageCircle className="h-4 w-4 mr-2 shrink-0" />
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-medium truncate">
                      {conv.tipo === "directo" 
                        ? conv.nombresParticipantes?.find(n => n !== (userData?.displayName || user?.email?.split("@")[0] || "Usuario")) || "Usuario"
                        : conv.nombresParticipantes?.join(" ↔ ") || "Conversación"}
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

          {/* Mensajería personal */}
          <div className="mt-4 p-2 border-t">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Mensajería personal</div>
              {mostrarUsuarios ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setMostrarUsuarios(false)
                    setBusquedaUsuario("")
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setMostrarUsuarios(true)}
                >
                  Ver usuarios
                </Button>
              )}
            </div>

            {mostrarUsuarios && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuario..."
                    value={busquedaUsuario}
                    onChange={(e) => setBusquedaUsuario(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>

                {loadingUsuarios ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : usuariosFiltrados.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2 text-center">
                    {busquedaUsuario ? "No se encontraron usuarios" : "No hay usuarios disponibles"}
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {usuariosFiltrados.map((usuario) => (
                      <Button
                        key={usuario.id}
                        variant="outline"
                        className="w-full justify-start mb-1 h-auto py-2"
                        onClick={() => handleCreateWithUser(usuario.uid)}
                      >
                        <User className="h-4 w-4 mr-2 shrink-0" />
                        <div className="flex-1 text-left min-w-0">
                          <div className="text-sm font-medium truncate">
                            {usuario.displayName || usuario.email?.split("@")[0] || "Usuario"}
                          </div>
                          {usuario.email && usuario.email !== usuario.displayName && (
                            <div className="text-xs text-muted-foreground truncate">
                              {usuario.email}
                            </div>
                          )}
                          {usuario.role && (
                            <div className="text-xs text-muted-foreground">
                              {usuario.role}
                            </div>
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

