# Scripts de Utilidad

## delete-old-schedules.js

Script para eliminar schedules antiguos que no tienen el campo `createdBy`.

### Requisitos

1. Firebase Admin SDK configurado
2. Credenciales de servicio de Firebase

### Configuración de Credenciales

**Opción 1: Archivo de credenciales**
1. Descarga el archivo de credenciales de servicio desde Firebase Console
2. Guárdalo como `serviceAccountKey.json` en la raíz del proyecto
3. **IMPORTANTE**: Agrega `serviceAccountKey.json` a `.gitignore` para no subirlo a Git

**Opción 2: Variable de entorno**
```bash
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
```

### Uso

```bash
node scripts/delete-old-schedules.js
```

El script:
1. Busca todos los schedules sin `createdBy`
2. Muestra una lista de los schedules encontrados
3. Pide confirmación antes de eliminar
4. Elimina los schedules antiguos en batches

### Advertencia

⚠️ **Este script elimina datos permanentemente. No se puede deshacer.**

Solo elimina schedules que NO tienen el campo `createdBy`. Los schedules con `createdBy` se mantienen intactos.

