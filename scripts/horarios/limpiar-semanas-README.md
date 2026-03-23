# Script para Limpiar Semanas Completadas

## 🎯 Objetivo
Este script elimina el estado `completada: true` de todas las semanas en Firestore, permitiendo que sean editables nuevamente.

## 📋 Pasos para Ejecutar

### 1️⃣ Configurar Firebase
Edita el archivo `limpiar-semanas-completadas.js` y reemplaza la configuración:

```javascript
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROJECT.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROJECT.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};
```

### 2️⃣ Instalar dependencias
```bash
cd scripts
npm install
```

### 3️⃣ Ejecutar el script
```bash
npm start
```

## 🔧 ¿Qué hace el script?

1. **Busca todas las semanas** con `completada: true`
2. **Las procesa en lotes** de 500 (límite de Firestore)
3. **Actualiza cada semana** a `completada: false`
4. **Muestra progreso** en consola

## 📊 Resultado Esperado

```
🧹 Iniciando limpieza de semanas completadas...
📊 Encontradas 15 semanas completadas
⚡ Procesando 1 lotes...
🔄 Limpiando semana: schedule-week-2026-01-26__abc123 (weekStart: 2026-01-26)
🔄 Limpiando semana: schedule-week-2026-02-02__def456 (weekStart: 2026-02-02)
...
✅ ¡Limpieza completada! Todas las semanas ahora son editables
📈 Se limpiaron 15 semanas
🎉 Script finalizado correctamente
```

## ⚠️ Advertencias

- **IRREVERSIBLE**: Este cambio no se puede deshacer automáticamente
- **BACKUP**: Considera hacer un backup antes de ejecutar
- **PRODUCCIÓN**: No ejecutar en producción sin permiso

## 🔄 Después de Ejecutar

1. **Refresca la aplicación** en el navegador
2. **Verifique** que todas las semanas sean editables
3. **El botón "LISTO"** debería funcionar normalmente

## 🛡️ Seguridad

El script solo modifica el campo `completada` sin afectar:
- ✅ Asignaciones de horarios
- ✅ Datos de empleados  
- ✅ Configuraciones
- ✅ Otros metadatos
