# Checklist manual - sectorSlots

1. **Turno corrido simple**
   - Abrir menú contextual de una celda con turno corrido.
   - Click en "Asignar sector".
   - Elegir sector en selector único.
   - Verificar que se renderiza **1 chip**.

2. **Turno cortado**
   - Abrir "Asignar sector" en turno con dos franjas.
   - Asignar Franja 1 y Franja 2.
   - Verificar que se renderizan **2 chips alineados**.

3. **Turno corrido dividido**
   - Abrir "Asignar sector" en turno corrido.
   - Click en "Dividir turno en 2 sectores".
   - Asignar Slot 1 y Slot 2.
   - Verificar que se renderizan **2 chips alineados**.

4. **Quitar sector**
   - Desde cualquier modo del diálogo, click en "Quitar sector".
   - Verificar que no se muestran chips.

5. **Quitar división**
   - En modo dividido, click en "Quitar división".
   - Verificar que vuelve a selector único y se mantiene solo slot 1.

6. **Reabrir diálogo y persistencia**
   - Guardar cambios.
   - Reabrir el diálogo.
   - Confirmar que los selectores cargan valores de `sectorSlots` persistidos.

7. **Re-render correcto**
   - Cambiar sectores múltiples veces.
   - Verificar que la celda refresca chips inmediatamente sin tocar horas.
