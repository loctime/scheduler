"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth, isFirebaseConfigured } from "@/lib/firebase"
import { DataProvider } from "@/contexts/data-context"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ConversationsList } from "@/components/group-chat/conversations-list"
import { GroupChatInterface } from "@/components/group-chat/group-chat-interface"
import { Loader2, ArrowLeft, Construction } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"

export default function MensajeriaPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [conversacionActiva, setConversacionActiva] = useState<string | null>(null)
  const isMobile = useIsMobile()

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) return null

  // En móvil: mostrar solo lista o solo chat, no ambos
  const mostrarLista = isMobile ? !conversacionActiva : true
  const mostrarChat = isMobile ? !!conversacionActiva : true

  return (
    <DataProvider user={user}>
      <DashboardLayout user={user}>
        <div className="px-1 sm:px-0 space-y-3 sm:space-y-4 lg:space-y-6">
          {/* Banner de desarrollo - compacto en móvil */}
          <div className="rounded-lg border-2 border-dashed border-amber-500/50 bg-amber-500/10 p-2 sm:p-3">
            <div className="flex items-center gap-2">
              <Construction className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-xs sm:text-sm font-medium text-amber-700 dark:text-amber-300">
                🚧 En desarrollo
              </p>
            </div>
          </div>

          <div className="flex h-[calc(100vh-8rem)] border rounded-lg overflow-hidden relative">
            {/* Lista de conversaciones */}
            <div className={`${
              isMobile 
                ? mostrarLista ? "absolute inset-0 z-10" : "hidden"
                : "w-80 border-r"
            } bg-card transition-transform`}>
              <ConversationsList
                user={user}
                onSelectConversation={setConversacionActiva}
                conversacionActiva={conversacionActiva}
              />
            </div>
            
            {/* Área de chat */}
            <div className={`flex-1 bg-background ${
              isMobile && !mostrarChat ? "hidden" : ""
            }`}>
              {conversacionActiva ? (
                <div className="flex flex-col h-full">
                  {/* Botón volver en móvil */}
                  {isMobile && (
                    <div className="border-b bg-card px-4 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConversacionActiva(null)}
                        className="gap-2"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Volver a conversaciones
                      </Button>
                    </div>
                  )}
                  <div className="flex-1 overflow-hidden">
                    <GroupChatInterface
                      user={user}
                      conversacionId={conversacionActiva}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <p className="text-lg font-medium mb-2">Selecciona una conversación</p>
                    <p className="text-sm">Elige una conversación existente o crea una nueva con otro grupo</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </DataProvider>
  )
}

