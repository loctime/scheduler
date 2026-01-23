import React, { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, Edit, X } from 'lucide-react';

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
}

/**
 * ShiftRequestMarker - Componente visual interactivo para pedidos de empleados
 * 
 * Características:
 * - Si active es false → muestra ícono inactivo clickable
 * - Si active es true → muestra ícono activo con tooltip
 * - Click para activar/desactivar o editar descripción
 * - No afecta lógica de negocio ni bloquea edición
 */
export const ShiftRequestMarker: React.FC<ShiftRequestMarkerProps> = ({
  active,
  description,
  onToggle,
  onEditDescription
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tempDescription, setTempDescription] = useState(description || '');

  // Texto a mostrar en el tooltip (solo si está activo)
  const tooltipText = description 
    ? `Pedido – ${description}`
    : 'Pedido';

  const handleClick = () => {
    if (!active) {
      // Si está inactivo, activar y abrir diálogo para descripción
      onToggle();
      setTempDescription('');
      setIsDialogOpen(true);
    } else {
      // Si está activo, abrir diálogo para editar o desactivar
      setIsDialogOpen(true);
      setTempDescription(description || '');
    }
  };

  const handleSave = () => {
    if (tempDescription.trim()) {
      onEditDescription(tempDescription.trim());
      if (!active) {
        onToggle();
      }
    } else if (active) {
      // Si no hay descripción y estaba activo, desactivar
      onToggle();
    }
    setIsDialogOpen(false);
  };

  const handleDeactivate = () => {
    onToggle();
    setIsDialogOpen(false);
  };

  return (
    <>
      {active ? (
        // Marcador activo con tooltip
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="inline-flex items-center justify-center w-4 h-4 text-blue-500 hover:text-blue-600 transition-colors cursor-pointer"
                onClick={handleClick}
              >
                <MessageSquare className="w-3 h-3" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-sm">{tooltipText}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        // Marcador inactivo (clickable pero sin tooltip)
        <div 
          className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-blue-500 transition-colors cursor-pointer"
          onClick={handleClick}
        >
          <MessageSquare className="w-3 h-3" />
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {active ? 'Editar pedido del empleado' : 'Agregar pedido del empleado'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="description">Descripción del pedido</Label>
              <Input
                id="description"
                value={tempDescription}
                onChange={(e) => setTempDescription(e.target.value)}
                placeholder="Ej: Necesito cambiar mi turno por motivos personales"
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            {active && (
              <Button variant="outline" onClick={handleDeactivate}>
                <X className="w-4 h-4 mr-2" />
                Desactivar
              </Button>
            )}
            <Button onClick={handleSave}>
              {active ? 'Guardar cambios' : 'Activar pedido'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ShiftRequestMarker;
