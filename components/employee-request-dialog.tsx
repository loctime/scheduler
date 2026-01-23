import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Turno, MedioTurno } from '@/lib/types';
import { Clock, Calendar, MessageSquare } from 'lucide-react';

export interface EmployeeRequestData {
  active: boolean;
  requestedShift?: {
    type: 'existing' | 'manual';
    shiftId?: string;
    startTime?: string;
    endTime?: string;
  };
  description: string;
}

interface EmployeeRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: EmployeeRequestData;
  availableShifts: Turno[];
  mediosTurnos?: MedioTurno[];
  onSave: (data: EmployeeRequestData) => void;
}

export const EmployeeRequestDialog: React.FC<EmployeeRequestDialogProps> = ({
  open,
  onOpenChange,
  initialData,
  availableShifts,
  mediosTurnos,
  onSave
}) => {
  const [requestType, setRequestType] = useState<'existing' | 'manual'>('existing');
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');

  // Resetear formulario cuando cambia el diálogo
  useEffect(() => {
    if (open) {
      if (initialData?.active) {
        // Cargar datos existentes
        if (initialData.requestedShift) {
          setRequestType(initialData.requestedShift.type);
          if (initialData.requestedShift.type === 'existing' && initialData.requestedShift.shiftId) {
            setSelectedShiftId(initialData.requestedShift.shiftId);
          } else if (initialData.requestedShift.type === 'manual') {
            setStartTime(initialData.requestedShift.startTime || '');
            setEndTime(initialData.requestedShift.endTime || '');
          }
        }
        setDescription(initialData.description);
      } else {
        // Resetear a valores por defecto
        setRequestType('existing');
        setSelectedShiftId('');
        setStartTime('');
        setEndTime('');
        setDescription('');
      }
    }
  }, [open, initialData]);

  const handleSave = () => {
    const requestData: EmployeeRequestData = {
      active: true,
      requestedShift: {
        type: requestType,
        ...(requestType === 'existing' 
          ? { shiftId: selectedShiftId }
          : { startTime, endTime }
        )
      },
      description
    };

    onSave(requestData);
    onOpenChange(false);
  };

  const getSelectedShiftInfo = () => {
    if (requestType === 'existing' && selectedShiftId) {
      const shift = availableShifts.find(s => s.id === selectedShiftId);
      return shift ? `${shift.name} (${shift.startTime || ''}-${shift.endTime || ''})` : '';
    }
    if (requestType === 'manual' && startTime && endTime) {
      return `${startTime}-${endTime}`;
    }
    return '';
  };

  const isFormValid = () => {
    if (requestType === 'existing') {
      return selectedShiftId.trim() !== '' && description.trim() !== '';
    } else {
      return startTime.trim() !== '' && endTime.trim() !== '' && description.trim() !== '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Pedido del empleado
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Tipo de solicitud */}
          <div className="grid gap-3">
            <Label className="text-sm font-medium">Tipo de horario solicitado</Label>
            <RadioGroup value={requestType} onValueChange={(value: 'existing' | 'manual') => setRequestType(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="existing" id="existing" />
                <Label htmlFor="existing" className="text-sm">
                  Seleccionar turno existente
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manual" id="manual" />
                <Label htmlFor="manual" className="text-sm">
                  Definir horario manual
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Selección de turno existente */}
          {requestType === 'existing' && (
            <div className="grid gap-2">
              <Label htmlFor="shift">Turno solicitado</Label>
              <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar turno..." />
                </SelectTrigger>
                <SelectContent>
                  {availableShifts.map((shift) => (
                    <SelectItem key={shift.id} value={shift.id}>
                      {shift.name} ({shift.startTime || ''} - {shift.endTime || ''})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Horario manual */}
          {requestType === 'manual' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startTime">Hora inicio</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endTime">Hora fin</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Descripción */}
          <div className="grid gap-2">
            <Label htmlFor="description">Descripción del pedido</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe el motivo de tu pedido de cambio de turno..."
              rows={3}
            />
          </div>

          {/* Vista previa */}
          {getSelectedShiftInfo() && description && (
            <div className="bg-muted/50 rounded-lg p-3">
              <Label className="text-sm font-medium text-muted-foreground">Vista previa</Label>
              <p className="text-sm mt-1">
                <strong>Horario solicitado:</strong> {getSelectedShiftInfo()}
              </p>
              <p className="text-sm mt-1">
                <strong>Motivo:</strong> {description}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!isFormValid()}>
            Guardar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
