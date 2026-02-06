"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { LoginForm } from "@/components/login-form"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useData } from "@/contexts/data-context"

export default function PwaEntryPage() {
  const router = useRouter()
  const { user, loading } = useData()

  useEffect(() => {
    if (user) {
      router.replace("/pwa/horario")
    }
  }, [user, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (user) {
    return null
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  )
}
