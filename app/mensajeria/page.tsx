"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth, isFirebaseConfigured } from "@/lib/firebase"
import { DataProvider } from "@/contexts/data-context"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ConversationsList } from "@/components/group-chat/conversations-list"
import { GroupChatInterface } from "@/components/group-chat/group-chat-interface"
import { Loader2 } from "lucide-react"

export default function MensajeriaPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [conversacionActiva, setConversacionActiva] = useState<string | null>(null)

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

  return (
    <DataProvider user={user}>
      <DashboardLayout user={user}>
        <div className="flex h-[calc(100vh-8rem)] border rounded-lg overflow-hidden">
          <div className="w-80 border-r bg-card">
            <ConversationsList
              user={user}
              onSelectConversation={setConversacionActiva}
              conversacionActiva={conversacionActiva}
            />
          </div>
          <div className="flex-1 bg-background">
            {conversacionActiva ? (
              <GroupChatInterface
                user={user}
                conversacionId={conversacionActiva}
              />
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
      </DashboardLayout>
    </DataProvider>
  )
}

