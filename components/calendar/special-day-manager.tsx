/**
 * Componente para gestionar días especiales (CRUD e importación)
 */

import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { 
  Plus, 
  Download, 
  Edit, 
  Trash2, 
  Calendar as CalendarIcon,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import { useCalendarSpecialDays, useHolidayImport } from '@/hooks/use-calendar-special-days'
import { SpecialDayBadge } from './special-day-badge'
import type { 
  CalendarSpecialDay, 
  SpecialDayType, 
  SpecialDayScope, 
  SpecialDaySeverity 
} from '@/lib/types/calendar-special-days'

interface SpecialDayManagerProps {
  city?: string
  province?: string
  country?: string
  className?: string
}

export function SpecialDayManager({
  city = 'Viedma',
  province = 'Río Negro',
  country = 'Argentina',
  className = ''
}: SpecialDayManagerProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingDay, setEditingDay] = useState<CalendarSpecialDay | null>(null)
  const [importingYear, setImportingYear] = useState(new Date().getFullYear())
  
  // Form state
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    title: '',
    description: '',
    type: 'local' as SpecialDayType,
    scope: 'municipal' as SpecialDayScope,
    severity: 'info' as SpecialDaySeverity,
    affectsScheduling: true
  })

  const { 
    specialDays, 
    formattedSpecialDays, 
    loading, 
    error,
    addSpecialDay, 
    updateSpecialDay, 
    deleteSpecialDay,
    refresh 
  } = useCalendarSpecialDays({
    autoSubscribe: true,
    initialFilter: {
      city: city.toLowerCase(),
      province: province.toLowerCase(),
      country: country.toLowerCase()
    }
  })

  const { 
    importing, 
    importNationalHolidays, 
    importRioNegroHolidays,
    importRioNegroCitiesHolidays 
  } = useHolidayImport()

  // Reset form
  const resetForm = () => {
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      title: '',
      description: '',
      type: 'local',
      scope: 'municipal',
      severity: 'info',
      affectsScheduling: true
    })
    setEditingDay(null)
  }

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const specialDayData = {
        date: formData.date,
        city,
        province,
        country,
        title: formData.title,
        description: formData.description || undefined,
        type: formData.type,
        scope: formData.scope,
        severity: formData.severity,
        affectsScheduling: formData.affectsScheduling,
        source: 'manual' as const
      }

      if (editingDay) {
        await updateSpecialDay(editingDay.id, specialDayData)
      } else {
        await addSpecialDay(specialDayData)
      }

      setShowAddDialog(false)
      resetForm()
      refresh()

    } catch (error) {
      console.error('Error saving special day:', error)
    }
  }

  // Handle edit
  const handleEdit = (specialDay: CalendarSpecialDay) => {
    setEditingDay(specialDay)
    setFormData({
      date: specialDay.date,
      title: specialDay.title,
      description: specialDay.description || '',
      type: specialDay.type,
      scope: specialDay.scope,
      severity: specialDay.severity,
      affectsScheduling: specialDay.affectsScheduling
    })
    setShowAddDialog(true)
  }

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      await deleteSpecialDay(id)
      refresh()
    } catch (error) {
      console.error('Error deleting special day:', error)
    }
  }

  // Handle import
  const handleImportNational = async () => {
    try {
      await importNationalHolidays(importingYear)
      refresh()
    } catch (error) {
      console.error('Error importing national holidays:', error)
    }
  }

  const handleImportRioNegro = async () => {
    try {
      await importRioNegroHolidays(importingYear)
      refresh()
    } catch (error) {
      console.error('Error importing Rio Negro holidays:', error)
    }
  }

  const handleImportRioNegroCities = async () => {
    try {
      await importRioNegroCitiesHolidays(importingYear)
      refresh()
    } catch (error) {
      console.error('Error importing Rio Negro cities holidays:', error)
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Días Especiales
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {/* Import buttons */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Importar Feriados
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Importar Feriados</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="importYear">Año</Label>
                      <Input
                        id="importYear"
                        type="number"
                        value={importingYear}
                        onChange={(e) => setImportingYear(parseInt(e.target.value))}
                        min={2020}
                        max={2030}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Button
                        onClick={handleImportNational}
                        disabled={importing}
                        className="w-full"
                        variant="outline"
                      >
                        {importing ? 'Importando...' : 'Importar Feriados Nacionales'}
                      </Button>
                      
                      <Button
                        onClick={handleImportRioNegro}
                        disabled={importing}
                        className="w-full"
                        variant="outline"
                      >
                        {importing ? 'Importando...' : 'Importar Feriados Río Negro'}
                      </Button>
                      
                      <Button
                        onClick={handleImportRioNegroCities}
                        disabled={importing}
                        className="w-full"
                        variant="outline"
                      >
                        {importing ? 'Importando...' : 'Importar Todas las Ciudades de Río Negro'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Add button */}
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Día
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingDay ? 'Editar Día Especial' : 'Agregar Día Especial'}
                    </DialogTitle>
                  </DialogHeader>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="date">Fecha</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="title">Título</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Ej: Día del Trabajador"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="description">Descripción (opcional)</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Descripción detallada del día especial"
                        rows={3}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="type">Tipo</Label>
                        <Select value={formData.type} onValueChange={(value: SpecialDayType) => setFormData({ ...formData, type: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="feriado">Feriado</SelectItem>
                            <SelectItem value="no_laborable">No Laborable</SelectItem>
                            <SelectItem value="local">Local</SelectItem>
                            <SelectItem value="evento">Evento</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="scope">Alcance</Label>
                        <Select value={formData.scope} onValueChange={(value: SpecialDayScope) => setFormData({ ...formData, scope: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nacional">Nacional</SelectItem>
                            <SelectItem value="provincial">Provincial</SelectItem>
                            <SelectItem value="municipal">Municipal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="severity">Severidad</Label>
                      <Select value={formData.severity} onValueChange={(value: SpecialDaySeverity) => setFormData({ ...formData, severity: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="info">Info</SelectItem>
                          <SelectItem value="warning">Advertencia</SelectItem>
                          <SelectItem value="critical">Crítico</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="affectsScheduling"
                        checked={formData.affectsScheduling}
                        onCheckedChange={(checked) => setFormData({ ...formData, affectsScheduling: checked })}
                      />
                      <Label htmlFor="affectsScheduling">Afecta generación de horarios</Label>
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowAddDialog(false)
                          resetForm()
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit">
                        {editingDay ? 'Actualizar' : 'Agregar'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Location info */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">
            Mostrando días especiales para: <strong>{city}, {province}, {country}</strong>
          </div>
        </CardContent>
      </Card>

      {/* Special days list */}
      <Card>
        <CardHeader>
          <CardTitle>
            Días Especiales ({formattedSpecialDays.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : formattedSpecialDays.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay días especiales configurados</p>
              <p className="text-sm">Agrega días especiales manualmente o importa feriados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {formattedSpecialDays.map((specialDay) => (
                <div key={specialDay.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <SpecialDayBadge specialDay={specialDay} size="sm" showTooltip={false} />
                      <span className="text-sm text-muted-foreground">
                        {specialDay.dateDisplay}
                      </span>
                    </div>
                    
                    {specialDay.description && (
                      <p className="text-sm text-muted-foreground">
                        {specialDay.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{specialDay.location}</span>
                      {specialDay.affectsScheduling && (
                        <Badge variant="outline" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Afecta horarios
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(specialDays.find(d => d.id === specialDay.id)!)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar día especial?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción eliminará permanentemente "{specialDay.title}" del {specialDay.dateDisplay}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(specialDay.id)}>
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
