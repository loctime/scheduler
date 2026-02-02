import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Turno, MedioTurno, ShiftAssignment } from '@/lib/types';
import { Clock, Calendar, MessageSquare } from 'lucide-react';

export interface EmployeeRequestData {
  active: boolean;
  requestedShift?: {
    type: 'existing' | 'manual' | 'franco' | 'medio-franco';
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
  onAssign?: (assignment: ShiftAssignment) => void;
  onDelete?: () => void;
}

export const EmployeeRequestDialog: React.FC<EmployeeRequestDialogProps> = ({
  open,
  onOpenChange,
  initialData,
  availableShifts,
  mediosTurnos,
  onSave,
  onAssign,
  onDelete
}) => {
  const [requestType, setRequestType] = useState<
    'existing' | 'manual' | 'franco' | 'medio-franco'
  >('existing');
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
          if (initialData.requestedShift.type === 'existing' && initialData.requestedShift.shiftId) {
            setRequestType('existing');
            setSelectedShiftId(initialData.requestedShift.shiftId);
            setStartTime(initialData.requestedShift.startTime || '');
            setEndTime(initialData.requestedShift.endTime || '');
          } else if (initialData.requestedShift.type === 'manual') {
            setRequestType('manual');
            setStartTime(initialData.requestedShift.startTime || '');
            setEndTime(initialData.requestedShift.endTime || '');
          } else if (initialData.requestedShift.type === 'franco') {
            setRequestType('franco');
            setSelectedShiftId('');
            setStartTime('');
            setEndTime('');
          } else if (initialData.requestedShift.type === 'medio-franco') {
            setRequestType('medio-franco');
            setSelectedShiftId('');
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

  const handleShiftSelect = (shift: Turno) => {
    setRequestType('existing');
    setSelectedShiftId(shift.id);
    setStartTime(shift.startTime || '');
    setEndTime(shift.endTime || '');
  };

  const handleFrancoSelect = () => {
    setRequestType('franco');
    setSelectedShiftId('');
    setStartTime('');
    setEndTime('');
  };

  const handleMedioFrancoSelect = () => {
    setRequestType('medio-franco');
    setSelectedShiftId('');
  };

  const handleSave = () => {
    let requestedShift: EmployeeRequestData['requestedShift'];
    let assignment: ShiftAssignment | null = null;
    
    switch (requestType) {
      case 'franco':
        requestedShift = { type: 'franco' as const };
        assignment = { type: 'franco' };
        break;
      case 'medio-franco':
        requestedShift = { type: 'medio-franco' as const, startTime, endTime };
        assignment = { type: 'medio_franco', startTime, endTime };
        break;
      case 'existing':
        requestedShift = { type: 'existing' as const, shiftId: selectedShiftId, startTime, endTime };
        if (selectedShiftId) {
          assignment = { type: 'shift', shiftId: selectedShiftId, startTime, endTime };
        }
        break;
      case 'manual':
      default:
        requestedShift = { type: 'manual' as const, startTime, endTime };
        assignment = { type: 'shift', startTime, endTime };
        break;
    }

    const requestData: EmployeeRequestData = {
      active: true,
      requestedShift,
      description
    };

    // Guardar el request
    onSave(requestData);
    
    // Asignar el horario en la celda inmediatamente
    if (assignment && onAssign) {
      onAssign(assignment);
    }
    
    onOpenChange(false);
  };

  const getSelectedShiftInfo = () => {
    switch (requestType) {
      case 'franco':
        return 'Franco';
      case 'medio-franco':
        return startTime && endTime ? `Medio franco (${startTime}-${endTime})` : 'Medio franco';
      case 'existing':
        if (selectedShiftId) {
          const shift = availableShifts.find(s => s.id === selectedShiftId);
          return shift ? `${shift.name} (${shift.startTime || ''}-${shift.endTime || ''})` : '';
        }
        break;
      case 'manual':
        if (startTime && endTime) {
          return `${startTime}-${endTime}`;
        }
        break;
    }
    return '';
  };

  const isFormValid = () => {
    if (description.trim() === '') {
      return false;
    }
    
    switch (requestType) {
      case 'franco':
        return true; // Solo requiere descripción
      case 'medio-franco':
      case 'existing':
      case 'manual':
      default:
        return startTime.trim() !== '' && endTime.trim() !== '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Pedido del empleado
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Selección de turnos - Visual igual a la grilla */}
          <div className="grid gap-3">
            <Label className="text-sm font-medium">Seleccionar turno solicitado</Label>
            <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/20 min-h-[80px]">
              {availableShifts.map((shift) => (
                <Button
                  key={shift.id}
                  type="button"
                  variant={selectedShiftId === shift.id && requestType === 'existing' ? "default" : "outline"}
                  className="h-10 flex-[0_0_calc(33.333%-0.5rem)] text-sm font-semibold flex items-center justify-center rounded-md border-2 shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95 px-2"
                  style={{ 
                    backgroundColor: selectedShiftId === shift.id && requestType === 'existing' ? shift.color : undefined,
                    color: selectedShiftId === shift.id && requestType === 'existing' ? '#ffffff' : undefined,
                    borderColor: shift.color
                  }}
                  onClick={() => handleShiftSelect(shift)}
                >
                  <span className="text-center truncate">
                    {shift.name.length > 8 ? shift.name.substring(0, 8) : shift.name}
                  </span>
                </Button>
              ))}
              <Button
                type="button"
                variant={requestType === 'franco' ? "default" : "outline"}
                className="h-10 flex-[0_0_calc(33.333%-0.5rem)] text-sm font-semibold flex items-center justify-center rounded-md border-2 shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95 px-2"
                style={{ 
                  backgroundColor: requestType === 'franco' ? '#10b981' : undefined,
                  color: requestType === 'franco' ? '#ffffff' : undefined,
                  borderColor: '#10b981'
                }}
                onClick={handleFrancoSelect}
              >
                <span className="text-center truncate">Franco</span>
              </Button>
              <Button
                type="button"
                variant={requestType === 'medio-franco' ? "default" : "outline"}
                className="h-10 flex-[0_0_calc(33.333%-0.5rem)] text-sm font-semibold flex items-center justify-center rounded-md border-2 shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95 px-2"
                style={{ 
                  backgroundColor: requestType === 'medio-franco' ? '#f59e0b' : undefined,
                  color: requestType === 'medio-franco' ? '#ffffff' : undefined,
                  borderColor: '#f59e0b'
                }}
                onClick={handleMedioFrancoSelect}
              >
                <span className="text-center truncate">Medio franco</span>
              </Button>
            </div>
          </div>

          {/* Horario solicitado - Solo visible para manual, existing y medio-franco */}
          {requestType !== 'franco' && (
            <div className="grid gap-3">
              <Label className="text-sm font-medium">Horario solicitado</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startTime">Hora inicio</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    disabled={requestType === 'existing'}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endTime">Hora fin</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    disabled={requestType === 'existing'}
                  />
                </div>
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
                <strong>Turno solicitado:</strong> {getSelectedShiftInfo()}
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
          {/* Botón de eliminar - solo visible si hay un pedido activo */}
          {initialData?.active && onDelete && (
            <Button 
              variant="destructive" 
              onClick={() => {
                onDelete?.()
                onOpenChange(false)
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar pedido
            </Button>
          )}
          <Button onClick={handleSave} disabled={!isFormValid()}>
            Guardar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
