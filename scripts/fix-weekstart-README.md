# Script de Migración: Corregir weekStart en Schedules Legacy

## Problema

Los schedules creados antes de la corrección del cálculo de `weekStart` tienen valores incorrectos. Por ejemplo:
- Schedule con `weekStart: "2026-02-16"` (domingo)
- Pero si la semana empieza en lunes (`semanaInicioDia: 1`), debería ser `weekStart: "2026-02-10"` (lunes anterior)

Esto causa que el lunes no se pueda editar porque el sistema busca el schedule con un `weekStart` diferente.

## Solución

El script `fix-weekstart-schedules.js`:
1. Lee todos los schedules de Firestore
2. Obtiene la configuración de cada usuario (`semanaInicioDia`)
3. Recalcula el `weekStart` correcto para cada schedule
4. Crea un nuevo schedule con el ID correcto
5. Elimina el schedule viejo

## Requisitos

1. Node.js instalado
2. Firebase Admin SDK configurado
3. Credenciales de servicio de Firebase (archivo `serviceAccountKey.json` en la raíz del proyecto o variable de entorno `FIREBASE_SERVICE_ACCOUNT`)

## Instalación de dependencias

```bash
cd scripts
npm install firebase-admin date-fns
```

## Uso

1. **Haz backup de tu base de datos primero** (muy importante)

2. Ejecuta el script:
```bash
node scripts/fix-weekstart-schedules.js
```

3. El script mostrará:
   - Cuántos schedules tienen `weekStart` incorrecto
   - Detalles de los primeros 10 schedules que se corregirán

4. Confirma escribiendo `SI` (en mayúsculas)

5. El script procesará los schedules en lotes y mostrará el progreso

## Qué hace el script

- **Lee** todos los schedules de `apps/horarios/schedules`
- **Obtiene** la configuración de cada usuario de `apps/horarios/config`
- **Recalcula** el `weekStart` correcto usando `startOfWeek` con la configuración del usuario
- **Crea** nuevos schedules con el ID correcto (`ownerId__weekStartCorrecto`)
- **Elimina** los schedules viejos con ID incorrecto
- **Marca** los schedules migrados con `_migratedFrom` y `_migratedAt`

## Advertencias

- ⚠️ **Este script modifica datos en Firestore**
- ⚠️ **Haz backup antes de ejecutar**
- ⚠️ **No se puede deshacer fácilmente**
- ⚠️ **Si ya existe un schedule con el ID correcto, elimina el duplicado**

## Verificación

Después de ejecutar el script, verifica:
1. Que los schedules tengan `weekStart` correcto
2. Que puedas editar el lunes sin problemas
3. Que no haya schedules duplicados
