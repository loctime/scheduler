import React, { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EmployeeRequestDialog, EmployeeRequestData } from '@/components/employee-request-dialog';
import { getEmployeeRequest, saveEmployeeRequest, deleteEmployeeRequest } from '@/lib/employee-requests';
import { saveEmployeeRequestWithCache } from '@/lib/employee-request-cache';
import { Turno, MedioTurno } from '@/lib/types';
import { MessageSquare } from 'lucide-react';
import { useData } from '@/contexts/data-context';

/**
 * Componente para marcar visualmente pedidos de empleados.
 * 
 * IMPORTANTE: Este es SOLO un marcador visual interactivo. No bloquea edición ni afecta lógica del sistema.
 */
interface ShiftRequestMarkerProps {
  /** Si el marcador está activo o no */
  active: boolean;
  /** Descripción opcional del pedido */
  description?: string;
  /** Callback al hacer click para activar/desactivar */
  onToggle: () => void;
  /** Callback al editar la descripción */
  onEditDescription: (description: string) => void;
  /** ID del schedule */
  scheduleId: string;
  /** ID del empleado */
  employeeId: string;
  /** Fecha de la celda */
  date: string;
  /** Turnos disponibles para el diálogo */
  availableShifts: Turno[];
  /** Medios turnos disponibles */
  mediosTurnos?: MedioTurno[];
  /** Función para actualizar caché */
  updateEmployeeRequestCache?: (key: string, request: any) => void;
  /** Función para actualizar asignaciones en el schedule */
  onAssignmentUpdate?: (date: string, employeeId: string, assignments: any[], options?: { scheduleId?: string }) => void;
  /** Función para asignar horario directamente en la celda */
  onAssign?: (assignment: any) => void;
}

/**
 * ShiftRequestMarker - Componente visual interactivo para pedidos de empleados
 * 
 * Características:
 * - Si active es false → muestra ícono inactivo clickable
 * - Si active es true → muestra ícono activo con tooltip
 * - Click para activar/desactivar o editar descripción
 * - Persiste datos en Firestore
 * - No afecta lógica de negocio ni bloquea edición
 */
export const ShiftRequestMarker: React.FC<ShiftRequestMarkerProps> = ({
  active,
  description,
  onToggle,
  onEditDescription,
  scheduleId,
  employeeId,
  date,
  availableShifts,
  mediosTurnos,
  updateEmployeeRequestCache,
  onAssignmentUpdate,
  onAssign
}) => {
  const { userData } = useData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [requestData, setRequestData] = useState<EmployeeRequestData | undefined>();

  // Cargar datos existentes al montar el componente
  useEffect(() => {
    const loadRequestData = async () => {
      try {
        const request = await getEmployeeRequest(scheduleId, employeeId, date);
        if (request) {
          setRequestData({
            active: request.active,
            requestedShift: request.requestedShift,
            description: request.description
          });
        }
      } catch (error) {
        console.error('Error loading employee request:', error);
      }
    };

    loadRequestData();
  }, [scheduleId, employeeId, date]);

  // Generar texto para el tooltip
  const getTooltipText = () => {
    if (!active || !requestData) return '';
    
    let shiftInfo = '';
    if (requestData.requestedShift) {
      if (requestData.requestedShift.type === 'existing' && requestData.requestedShift.shiftId) {
        const shift = availableShifts.find(s => s.id === requestData.requestedShift?.shiftId);
        if (shift) {
          shiftInfo = `${shift.name} (${shift.startTime || ''}-${shift.endTime || ''})`;
        }
      } else if (requestData.requestedShift.type === 'manual') {
        shiftInfo = `${requestData.requestedShift.startTime || ''}-${requestData.requestedShift.endTime || ''}`;
      }
    }

    const parts = ['Pedido del empleado'];
    if (shiftInfo) parts.push(shiftInfo);
    if (requestData.description) parts.push(requestData.description);
    
    return parts.join(' – ');
  };

  const handleClick = () => {
    setIsDialogOpen(true);
  };

  const handleSaveRequest = async (data: EmployeeRequestData) => {
    try {
      // Determinar el ownerId a usar
      const ownerId = userData?.role === 'invited' && userData?.ownerId 
        ? userData.ownerId 
        : userData?.uid || '';

      // 🔥 DESACTIVADO: Employee requests completamente deshabilitados
      console.warn('🚫 [ShiftRequestMarker] Employee requests desactivados - no se guardará en Firestore')
      
      // Simular éxito sin escribir en Firestore
      if (updateEmployeeRequestCache) {
        console.warn('🚫 [ShiftRequestMarker] saveEmployeeRequestWithCache desactivado')
        // const success = await saveEmployeeRequestWithCache(
        //   scheduleId, 
        //   employeeId, 
        //   date, 
        //   data, 
        //   ownerId,
        //   updateEmployeeRequestCache,
        //   onAssignmentUpdate
        // )
      } else {
        console.warn('🚫 [ShiftRequestMarker] saveEmployeeRequest desactivado')
        // await saveEmployeeRequest(scheduleId, employeeId, date, data, ownerId);
      }
      
      // Actualizar estado local
      const isActive = data.active;
      const description = data.description;
      
      if (isActive !== active) {
        onToggle();
      }
      onEditDescription(description);
      
      setRequestData(data);
    } catch (error) {
      console.error('Error saving employee request:', error);
    }
  };

  const handleDeleteRequest = async () => {
    try {
      // 🔥 DESACTIVADO: Employee requests completamente deshabilitados
      console.warn('🚫 [ShiftRequestMarker] deleteEmployeeRequest desactivado')
      
      // const ownerId = userData?.role === 'invited' && userData?.ownerId 
      //   ? userData.ownerId 
      //   : userData?.uid || '';

      // await deleteEmployeeRequest(scheduleId, employeeId, date, ownerId);
      
      // Actualizar estado local
      if (active) {
        onToggle();
      }
      onEditDescription('');
      
      setRequestData(undefined);
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error deleting employee request:', error);
    }
  };

  const tooltipText = getTooltipText();

  return (
    <>
      {active ? (
        // Marcador activo con tooltip - más grande y llamativo
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="inline-flex items-center justify-center w-6 h-6 text-blue-600 hover:text-blue-700 transition-all duration-200 cursor-pointer bg-blue-100 rounded-full shadow-md hover:shadow-lg hover:scale-110"
                onClick={handleClick}
              >
                <MessageSquare className="w-4 h-4" />
              </div>
            </TooltipTrigger>
            {tooltipText && (
              <TooltipContent>
                <p className="text-sm max-w-xs">{tooltipText}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      ) : (
        // Marcador inactivo (clickable pero sin tooltip) - más sutil
        <div 
          className="inline-flex items-center justify-center w-5 h-5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all duration-200 cursor-pointer rounded-full"
          onClick={handleClick}
        >
          <MessageSquare className="w-3 h-3" />
        </div>
      )}

      <EmployeeRequestDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialData={requestData}
        availableShifts={availableShifts}
        mediosTurnos={mediosTurnos}
        onSave={handleSaveRequest}
        onAssign={onAssign}
        onDelete={handleDeleteRequest}
      />
    </>
  );
};

export default ShiftRequestMarker;
