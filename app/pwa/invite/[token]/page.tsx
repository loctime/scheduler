"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { procesarRegistroInvitacion } from "@/lib/invitacion-utils"
import { useData } from "@/contexts/data-context"

export default function PwaInvitePage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { user, loading } = useData()
  const [processing, setProcessing] = useState(false)

  const token = params.token as string

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.replace(`/registro?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent("/pwa/horario")}`)
      return
    }

    const consumirToken = async () => {
      try {
        setProcessing(true)
        await procesarRegistroInvitacion(user, token)
        router.replace("/pwa/horario")
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "No se pudo completar la invitación",
          variant: "destructive",
        })
        router.replace("/pwa")
      } finally {
        setProcessing(false)
      }
    }

    consumirToken()
  }, [loading, router, token, toast, user])

  if (processing || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return null
}
