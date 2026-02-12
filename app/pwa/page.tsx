"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { LoginForm } from "@/components/login-form"
import { Card, CardContent } from "@/components/ui/card"
import { useData } from "@/contexts/data-context"
import { useCompanySlug } from "@/hooks/use-company-slug"

export default function PwaEntryPage() {
  const { user } = useData()
  const router = useRouter()
  const { companySlug, isLoading } = useCompanySlug()

  useEffect(() => {
    if (!user || isLoading) return
    if (companySlug) {
      router.replace(`/pwa/horario/${companySlug}`)
      return
    }
    router.replace("/pwa/home")
  }, [user, companySlug, isLoading, router])

  if (!user) {
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground">Redirigiendo...</p>
    </div>
  )
}
