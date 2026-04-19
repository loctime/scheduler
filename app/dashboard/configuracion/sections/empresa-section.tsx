"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Save, Globe, Pencil, Check, X } from "lucide-react"
import { Configuracion } from "@/lib/types"
import { doc, setDoc } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import {
  changePublicCompanySlug,
  normalizeCompanySlug,
  isValidSlugFormat,
} from "@/lib/public-companies"

type Props = {
  config: Configuracion
  saveSection: (partial: Partial<Configuracion>) => Promise<void>
  ownerId: string | null
  onSlugChanged: (slug: string) => void
}

export function EmpresaSection({ config, saveSection, ownerId, onSlugChanged }: Props) {
  const { toast } = useToast()
  const [nombreEmpresa, setNombreEmpresa] = useState(config.nombreEmpresa || "")
  const [colorEmpresa, setColorEmpresa] = useState<string | undefined>(config.colorEmpresa)
  const [saving, setSaving] = useState(false)

  const [editingSlug, setEditingSlug] = useState(false)
  const [slugInput, setSlugInput] = useState("")
  const [savingSlug, setSavingSlug] = useState(false)

  useEffect(() => {
    setNombreEmpresa(config.nombreEmpresa || "")
    setColorEmpresa(config.colorEmpresa)
  }, [config.nombreEmpresa, config.colorEmpresa])

  const dirty =
    (nombreEmpresa || "") !== (config.nombreEmpresa || "") ||
    (colorEmpresa || "") !== (config.colorEmpresa || "")

  const handleSave = async () => {
    try {
      setSaving(true)
      await saveSection({
        nombreEmpresa: nombreEmpresa || "Empleado",
        colorEmpresa: colorEmpresa || undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSlug = async () => {
    if (!ownerId || !slugInput.trim()) return
    const normalized = normalizeCompanySlug(slugInput.trim())
    if (!isValidSlugFormat(normalized)) {
      toast({
        title: "Slug inválido",
        description: "Solo letras minúsculas, números y guiones. Entre 3 y 40 caracteres.",
        variant: "destructive",
      })
      return
    }
    if (normalized === config.publicSlug) {
      setEditingSlug(false)
      return
    }
    try {
      setSavingSlug(true)
      await changePublicCompanySlug(normalized, ownerId, config.nombreEmpresa || "")
      const configRef = doc(db!, COLLECTIONS.CONFIG, ownerId)
      await setDoc(configRef, { publicSlug: normalized }, { merge: true })
      onSlugChanged(normalized)
      setEditingSlug(false)
      toast({ title: "Slug actualizado", description: `La app ahora está en /pwa/${normalized}/` })
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo cambiar el slug", variant: "destructive" })
    } finally {
      setSavingSlug(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuración General</CardTitle>
          <CardDescription>Configuración básica de la empresa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="nombreEmpresa">Nombre de la empresa</Label>
            <Input
              id="nombreEmpresa"
              type="text"
              placeholder="Empleado"
              value={nombreEmpresa}
              onChange={(e) => setNombreEmpresa(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Este nombre se mostrará en la columna de empleados en la grilla de horarios
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="colorEmpresa">Color de fondo de la celda</Label>
            <div className="flex gap-2">
              <Input
                id="colorEmpresa"
                type="color"
                value={colorEmpresa || "#ffffff"}
                onChange={(e) => setColorEmpresa(e.target.value)}
                className="h-10 w-20 p-1 cursor-pointer"
              />
              <Input
                type="text"
                placeholder="#ffffff"
                value={colorEmpresa || ""}
                onChange={(e) => setColorEmpresa(e.target.value || undefined)}
                className="flex-1"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Color de fondo de la celda del nombre de empresa. Déjalo vacío para usar el color por defecto.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !dirty}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar empresa
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {config.publicSlug && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              URL de la aplicación
            </CardTitle>
            <CardDescription>
              Identificador público de tu empresa en la app. Si lo cambiás, los enlaces anteriores dejan de funcionar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground shrink-0">/pwa/</span>
              {editingSlug ? (
                <>
                  <Input
                    value={slugInput}
                    onChange={(e) => setSlugInput(normalizeCompanySlug(e.target.value))}
                    className="font-mono text-sm"
                    placeholder="mi-empresa"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" onClick={handleSaveSlug} disabled={savingSlug}>
                    {savingSlug ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditingSlug(false)
                      setSlugInput(config.publicSlug || "")
                    }}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="font-mono text-sm font-medium">{config.publicSlug}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setSlugInput(config.publicSlug || "")
                      setEditingSlug(true)
                    }}
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </>
              )}
              <span className="text-sm text-muted-foreground shrink-0">/</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Solo letras minúsculas, números y guiones. Ej:{" "}
              <code className="bg-muted px-1 rounded">mi-empresa</code>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
