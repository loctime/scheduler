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
const PWA_LAST_SLUG_COOKIE = "pwa-last-slug"

export function savePwaLastSlug(slug: string) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(PWA_LAST_SLUG_KEY, slug)
  } catch {
    // ignore
  }
  try {
    document.cookie = `${PWA_LAST_SLUG_COOKIE}=${encodeURIComponent(slug)}; Path=/; Max-Age=31536000; SameSite=Lax`
  } catch {
    // ignore
  }
}

export function clearPwaLastSlug() {
  if (typeof window === "undefined") return
  try { localStorage.removeItem(PWA_LAST_SLUG_KEY) } catch { }
  try { document.cookie = `${PWA_LAST_SLUG_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax` } catch { }
}

export function getPwaLastSlug(): string | null {
  if (typeof window === "undefined") return null
  try {
    const fromStorage = localStorage.getItem(PWA_LAST_SLUG_KEY)
    if (fromStorage) return fromStorage
  } catch {
    // ignore
  }

  try {
    const match = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${PWA_LAST_SLUG_COOKIE}=`))

    if (!match) return null

    const value = match.slice(`${PWA_LAST_SLUG_COOKIE}=`.length)
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

interface PwaCompanySelectorProps {
  suggestedSlugs?: string[]
}

export function PwaCompanySelector({ suggestedSlugs = [] }: PwaCompanySelectorProps) {
  const router = useRouter()
  const [slug, setSlug] = useState("")
  const [error, setError] = useState<string | null>(null)

  const goToSlug = (slugValue: string) => {
    savePwaLastSlug(slugValue)
    router.push(`/pwa/${slugValue}/home`)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const normalized = normalizeCompanySlug(slug.trim())
    if (!normalized) {
      setError("Introduce el identificador de la empresa")
      return
    }
    if (!isValidSlugFormat(normalized)) {
      setError("Formato invalido. Usa letras minusculas, numeros y guiones (3-40 caracteres)")
      return
    }
    goToSlug(normalized)
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
          {suggestedSlugs.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-sm font-medium">Empresas disponibles</p>
              <div className="grid gap-2">
                {suggestedSlugs.map((item) => (
                  <Button key={item} type="button" variant="outline" onClick={() => goToSlug(item)}>
                    {item}
                  </Button>
                ))}
              </div>
            </div>
          )}

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
