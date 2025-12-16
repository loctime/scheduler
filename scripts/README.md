# Scripts de Utilidad

## Requisitos Comunes

Todos los scripts requieren:
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

## delete-old-schedules.js

Script para eliminar schedules antiguos que no tienen el campo `createdBy`.

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

## add-invitation-permission.js

Script para agregar el permiso de crear links de invitado a un usuario (especialmente útil para cuentas antiguas de sucursal que no tienen este permiso).

### Uso

```bash
# Opción 1: Pasar el UID como argumento
node scripts/add-invitation-permission.js uefWFJ8LMbXOhYN186RITrUVHF42

# Opción 2: El script pedirá el UID interactivamente
node scripts/add-invitation-permission.js
```

El script:
1. Busca el usuario por UID en `apps/horarios/users/{userId}`
2. Muestra la información del usuario encontrado
3. Verifica si ya tiene el permiso (y pregunta si desea continuar)
4. Agrega el campo `permisos.crearLinks = true` al documento del usuario
5. Preserva todos los demás datos del usuario

### Ejemplo

```bash
node scripts/add-invitation-permission.js uefWFJ8LMbXOhYN186RITrUVHF42
```

### Notas

- El script preserva todos los datos existentes del usuario
- Si el usuario ya tiene `permisos.crearLinks = true`, el script lo notificará y pedirá confirmación
- Si el usuario no tiene el objeto `permisos`, se creará automáticamente

