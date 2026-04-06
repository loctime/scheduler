"use client"

import { useState } from "react"
import { deleteDoc, doc, updateDoc } from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { db, COLLECTIONS } from "@/lib/firebase"
import type { CatalogoProducto, GrupoCatalogoUI, UbicacionCatalogo } from "@/lib/catalogo-types"
import { actualizarProductoCatalogo } from "@/lib/catalogo-service"
import { updateGroupProductsMembership } from "@/lib/grupos-catalogo-service"
import { useToast } from "@/hooks/use-toast"
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react"

interface GrupoCardProps {
  grupo: GrupoCatalogoUI
  items: CatalogoProducto[]
  ubicaciones: UbicacionCatalogo[]
  productById: Map<string, CatalogoProducto>
  ownerId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GrupoCard({
  grupo,
  items,
  ubicaciones,
  productById,
  ownerId,
  open,
  onOpenChange,
}: GrupoCardProps) {
  const { toast } = useToast()

  const [isEditing, setIsEditing] = useState(false)
  const [editNombre, setEditNombre] = useState("")
  const [editDiasEnvio, setEditDiasEnvio] = useState<number[]>([])
  const [editDespachadoresIds, setEditDespachadoresIds] = useState<string[]>([])
  const [editProductosIds, setEditProductosIds] = useState<string[]>([])
  const [isGuardandoEdicion, setIsGuardandoEdicion] = useState(false)

  const dias = [
    { value: 1, label: "LUNES" },
    { value: 2, label: "MARTES" },
    { value: 3, label: "MIERCOLES" },
    { value: 4, label: "JUEVES" },
    { value: 5, label: "VIERNES" },
    { value: 6, label: "SABADO" },
    { value: 0, label: "DOMINGO" },
  ]

  const getDiasEnvioDisplay = (diasIds?: number[]) => {
    if (!diasIds || diasIds.length === 0) return null
    return diasIds
      .map(id => Number(id))  // Convertir int64 a number normal
      .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
      .map((id) => dias.find((d) => d.value === id)?.label)
      .join(", ")
  }

  const [selectorOpen, setSelectorOpen] = useState(false)
  const [selectorProductosIds, setSelectorProductosIds] = useState<string[]>([])
  const [isGuardandoSelector, setIsGuardandoSelector] = useState(false)

  const [isEliminando, setIsEliminando] = useState(false)

  const getDespachadoresFromIds = (ids: string[]) =>
    ids
      .map((id) => ubicaciones.find((u) => u.locationId === id))
      .filter((u): u is UbicacionCatalogo => Boolean(u))
      .map(({ locationId, locationName }) => ({ locationId, locationName }))

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

  const iniciarEdicion = () => {
    setEditNombre(grupo.nombre)
    setEditDiasEnvio((grupo.diasEnvio || []).map(id => Number(id)))
    setEditDespachadoresIds(grupo.despachadores.map((d) => d.locationId))
    setEditProductosIds(grupo.productosIds)
    setIsEditing(true)
  }

  const guardarEdicion = async () => {
    if (!db) return
    const nombreTrim = editNombre.trim()
    if (!nombreTrim) {
      toast({ title: "Indicá el nombre del grupo", variant: "destructive" })
      return
    }
    const despachadores = getDespachadoresFromIds(editDespachadoresIds)
    if (despachadores.length === 0) {
      toast({ title: "Elegí al menos un despachador", variant: "destructive" })
      return
    }

    setIsGuardandoEdicion(true)
    try {
      await updateDoc(doc(db, COLLECTIONS.GRUPOS_CATALOGO, grupo.id), {
        nombre: nombreTrim,
        despachadores,
        productosIds: editProductosIds,
        diasEnvio: editDiasEnvio,
      })
      const syncRes = await updateGroupProductsMembership(
        grupo.id,
        editProductosIds,
        grupo.productosIds,
        ownerId,
        productById
      )
      if (!syncRes.ok) {
        toast({
          title: "Grupo actualizado con advertencia",
          description: syncRes.error ?? "No se pudo sincronizar la asignación de productos",
          variant: "destructive",
        })
      } else {
        toast({ title: "Grupo actualizado" })
      }
      setIsEditing(false)
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo actualizar el grupo",
        variant: "destructive",
      })
    } finally {
      setIsGuardandoEdicion(false)
    }
  }

  const abrirSelector = () => {
    setSelectorProductosIds(grupo.productosIds)
    setSelectorOpen(true)
  }

  const guardarSelector = async () => {
    setIsGuardandoSelector(true)
    try {
      const res = await updateGroupProductsMembership(
        grupo.id,
        selectorProductosIds,
        grupo.productosIds,
        ownerId,
        productById
      )
      if (!res.ok) {
        toast({ title: "Error", description: res.error, variant: "destructive" })
        return
      }
      toast({ title: "Productos del grupo actualizados" })
      setSelectorOpen(false)
      setSelectorProductosIds([])
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo guardar",
        variant: "destructive",
      })
    } finally {
      setIsGuardandoSelector(false)
    }
  }

  const eliminarGrupo = async () => {
    if (!db) return
    setIsEliminando(true)
    try {
      for (const productId of grupo.productosIds) {
        const res = await actualizarProductoCatalogo(
          productId,
          { grupoCatalogoId: null, pedidoId: "" },
          ownerId
        )
        if (!res.ok) throw new Error(res.error ?? "No se pudo desasignar productos del grupo")
      }
      await deleteDoc(doc(db, COLLECTIONS.GRUPOS_CATALOGO, grupo.id))
      toast({ title: "Grupo eliminado" })
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo eliminar",
        variant: "destructive",
      })
    } finally {
      setIsEliminando(false)
    }
  }

  const productosAsignados = grupo.productosIds
    .map((id) => productById.get(id))
    .filter((x): x is CatalogoProducto => Boolean(x))

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card className="py-0 gap-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-1">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex min-w-[260px] flex-1 items-center gap-2 text-left">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <div className="flex flex-col">
              <span className="font-medium">{grupo.nombre}</span>
              {grupo.diasEnvio && grupo.diasEnvio.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  Envío: {getDiasEnvioDisplay(grupo.diasEnvio)}
                </span>
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <div className="flex flex-wrap items-center gap-2">
          {grupo.diasEnvio && grupo.diasEnvio.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {grupo.diasEnvio.length === 7 
                ? "Todos los días" 
                : grupo.diasEnvio
                    .map(id => Number(id))  // Convertir int64 a number normal
                    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
                    .map((id) => dias.find((d) => d.value === id)?.label)
                    .join(", ")
              }
            </Badge>
          )}
          {grupo.despachadores.map((d) => (
            <Badge key={d.locationId} className="bg-green-100 text-green-800 hover:bg-green-100">
              {d.locationName}
            </Badge>
          ))}
          <Badge variant="secondary">{grupo.productosIds.length} productos</Badge>
          <Button variant="ghost" size="icon" onClick={iniciarEdicion}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            disabled={isEliminando}
            onClick={() => void eliminarGrupo()}
          >
            {isEliminando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

        <CollapsibleContent>
        <CardContent className="space-y-3 px-3 pb-3 pt-0">
            {isEditing ? (
              <div className="rounded-md border p-4 space-y-4">
                <div className="space-y-2">
                  <Label>Nombre del grupo</Label>
                  <Input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Día de envío</Label>
                  <div className="flex flex-wrap gap-3">
                    {dias.map((d) => (
                      <label key={d.value} className="flex items-center gap-1.5 text-sm cursor-pointer group">
                        <Checkbox
                          checked={editDiasEnvio.includes(d.value)}
                          onCheckedChange={(checked) =>
                            toggleId(setEditDiasEnvio as any, d.value as any, checked === true)
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
                          checked={editDespachadoresIds.includes(u.locationId)}
                          onCheckedChange={(v) =>
                            toggleId(setEditDespachadoresIds, u.locationId, v === true)
                          }
                        />
                        <span>{u.locationName}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Productos del catálogo</Label>
                  <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border p-3">
                    {items.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={editProductosIds.includes(p.id)}
                          onCheckedChange={(v) => toggleId(setEditProductosIds, p.id, v === true)}
                        />
                        <span>
                          {p.nombre} ({p.unidad})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button disabled={isGuardandoEdicion} onClick={() => void guardarEdicion()}>
                    {isGuardandoEdicion ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    Guardar
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {productosAsignados.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Este grupo no tiene productos asignados.
                    </p>
                  ) : (
                    productosAsignados.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-md border px-3 py-2 text-sm flex items-center justify-between"
                      >
                        <span>{p.nombre}</span>
                        <span className="text-muted-foreground">{p.unidad}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="space-y-3">
                  <Button variant="outline" onClick={abrirSelector}>
                    <Plus className="mr-1 h-4 w-4" />
                    Agregar producto
                  </Button>
                  {selectorOpen ? (
                    <div className="rounded-md border p-3 space-y-3">
                      <div className="max-h-56 space-y-2 overflow-y-auto">
                        {items.map((p) => (
                          <label key={p.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={selectorProductosIds.includes(p.id)}
                              onCheckedChange={(v) =>
                                toggleId(setSelectorProductosIds, p.id, v === true)
                              }
                            />
                            <span>
                              {p.nombre} ({p.unidad})
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button disabled={isGuardandoSelector} onClick={() => void guardarSelector()}>
                          {isGuardandoSelector ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : null}
                          Guardar selección
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectorOpen(false)
                            setSelectorProductosIds([])
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
