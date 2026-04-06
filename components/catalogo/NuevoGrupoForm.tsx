"use client"

import { useState } from "react"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { db, COLLECTIONS } from "@/lib/firebase"
import type { CatalogoProducto, UbicacionCatalogo } from "@/lib/catalogo-types"
import { updateGroupProductsMembership } from "@/lib/grupos-catalogo-service"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface NuevoGrupoFormProps {
  items: CatalogoProducto[]
  ubicaciones: UbicacionCatalogo[]
  ownerId: string
  userId: string
  onCreado: () => void
  onCancelar: () => void
}

export function NuevoGrupoForm({
  items,
  ubicaciones,
  ownerId,
  userId,
  onCreado,
  onCancelar,
}: NuevoGrupoFormProps) {
  const { toast } = useToast()

  const [nombre, setNombre] = useState("")
  const [diasEnvio, setDiasEnvio] = useState<number[]>([])
  const [despachadoresIds, setDespachadoresIds] = useState<string[]>([])
  const [productosIds, setProductosIds] = useState<string[]>([])
  const [creando, setCreando] = useState(false)

  const dias = [
    { value: 1, label: "LUNES" },
    { value: 2, label: "MARTES" },
    { value: 3, label: "MIERCOLES" },
    { value: 4, label: "JUEVES" },
    { value: 5, label: "VIERNES" },
    { value: 6, label: "SABADO" },
    { value: 0, label: "DOMINGO" },
  ]

  const toggleId = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    id: string,
    checked: boolean
  ) => {
    setter((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id]
      return prev.filter((x) => x !== id)
    })
  }

  const getDespachadoresFromIds = (ids: string[]) =>
    ids
      .map((id) => ubicaciones.find((u) => u.locationId === id))
      .filter((u): u is UbicacionCatalogo => Boolean(u))
      .map(({ locationId, locationName }) => ({ locationId, locationName }))

  const crearGrupo = async () => {
    if (!db) return
    const nombreTrim = nombre.trim()
    if (!nombreTrim) {
      toast({ title: "Indicá el nombre del grupo", variant: "destructive" })
      return
    }
    if (despachadoresIds.length === 0) {
      toast({ title: "Elegí al menos un despachador", variant: "destructive" })
      return
    }
    const despachadores = getDespachadoresFromIds(despachadoresIds)
    if (despachadores.length === 0) {
      toast({ title: "Ubicaciones inválidas", variant: "destructive" })
      return
    }

    setCreando(true)
    try {
      const ref = await addDoc(collection(db, COLLECTIONS.GRUPOS_CATALOGO), {
        nombre: nombreTrim,
        ownerId,
        createdBy: userId,
        createdAt: serverTimestamp(),
        despachadores,
        productosIds,
        diasEnvio,
      })
      const productById = new Map(items.map((p) => [p.id, p]))
      const syncRes = await updateGroupProductsMembership(ref.id, productosIds, [], ownerId, productById)
      if (!syncRes.ok) {
        toast({
          title: "Grupo creado con advertencia",
          description: syncRes.error ?? "No se pudo sincronizar la asignación de productos",
          variant: "destructive",
        })
      } else {
        toast({ title: "Grupo creado" })
      }
      onCreado()
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo crear el grupo",
        variant: "destructive",
      })
    } finally {
      setCreando(false)
    }
  }

  return (
    <Card>
      
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Label className="min-w-32">Nombre del grupo</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Día de envío</Label>
          <div className="flex flex-wrap gap-3">
            {dias.map((d) => (
              <label key={d.value} className="flex items-center gap-1.5 text-sm cursor-pointer group">
                <Checkbox
                  checked={diasEnvio.includes(d.value)}
                  onCheckedChange={(checked) =>
                    toggleId(setDiasEnvio as any, d.value as any, checked === true)
                  }
                />
                <span className="font-medium group-hover:text-primary transition-colors">
                  {d.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Despachadores</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {ubicaciones.map((u) => (
              <label key={u.locationId} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={despachadoresIds.includes(u.locationId)}
                  onCheckedChange={(v) => toggleId(setDespachadoresIds, u.locationId, v === true)}
                />
                <span>{u.locationName}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Productos del catálogo</Label>
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
            {items.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={productosIds.includes(p.id)}
                  onCheckedChange={(v) => toggleId(setProductosIds, p.id, v === true)}
                />
                <span>
                  {p.nombre} ({p.unidad})
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button disabled={creando} onClick={() => void crearGrupo()}>
            {creando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Guardar
          </Button>
          <Button variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
