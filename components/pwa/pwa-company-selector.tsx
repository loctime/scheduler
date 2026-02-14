"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2 } from "lucide-react"
import { isValidSlugFormat, normalizeCompanySlug } from "@/lib/public-companies"

const PWA_LAST_SLUG_KEY = "pwa-last-slug"

export function savePwaLastSlug(slug: string) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(PWA_LAST_SLUG_KEY, slug)
  } catch {
    // ignore
  }
}

export function getPwaLastSlug(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(PWA_LAST_SLUG_KEY)
  } catch {
    return null
  }
}

export function PwaCompanySelector() {
  const router = useRouter()
  const [slug, setSlug] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const normalized = normalizeCompanySlug(slug.trim())
    if (!normalized) {
      setError("Introduce el identificador de la empresa")
      return
    }
    if (!isValidSlugFormat(normalized)) {
      setError("Formato inválido. Usa letras minúsculas, números y guiones (3-40 caracteres)")
      return
    }
    savePwaLastSlug(normalized)
    router.push(`/pwa/${normalized}/home`)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-8 w-8 text-primary" />
            <CardTitle className="text-xl">Seleccionar empresa</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Introduce el identificador de tu empresa (slug) para acceder al panel PWA.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="slug">Identificador de empresa</Label>
              <Input
                id="slug"
                placeholder="ej: mi-empresa"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="mt-2"
                autoComplete="off"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full">
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
