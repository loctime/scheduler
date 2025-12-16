# Cambios Pendientes de Documentación

Este documento lista las funcionalidades encontradas en el código que podrían no estar completamente documentadas o necesitan actualización.

## 🔍 Funcionalidades Encontradas que Necesitan Documentación

### 1. ✅ Reiniciar Pedido

**Ubicación**: `app/dashboard/pedidos/page.tsx`

**Funcionalidad**: Permite reiniciar un pedido desde estado "enviado" de vuelta a "creado".

**Detalles**:
- Solo se puede reiniciar pedidos en estado "enviado"
- Elimina el remito de envío asociado (si existe)
- Restablece el estado del pedido a "creado"
- Elimina `remitoEnvioId` y `fechaEnvio` del pedido

**Estado en documentación**: ✅ **DOCUMENTADO** (agregado en README.md)

**Ubicación**: README.md - Sección "Gestión de Pedidos y Stock" → "Reiniciar Pedido"

---

### 2. ⚠️ Rol Invited y Sistema de OwnerId

**Ubicación**: Múltiples archivos (registro, hooks, reglas)

**Funcionalidad**: Sistema de usuarios invitados que trabajan en nombre de otro usuario.

**Detalles encontrados**:
- Los usuarios con rol `invited` tienen un campo `ownerId` que los vincula al usuario propietario
- Los usuarios invitados pueden acceder a los recursos del propietario (pedidos, stock, etc.)
- Funciona mediante la función `puedeAccederComoInvitado()` en las reglas de Firestore
- Se usa `esPropietario(userId)` que retorna `true` si el usuario es el propietario o es un invitado del propietario

**Estado en documentación**: ✅ **MEJORADO** (ampliada la documentación en SISTEMA_ROLES_GRUPOS.md)

**Ubicación**: 
- `SISTEMA_ROLES_GRUPOS.md` - Sección de roles, ahora incluye detalles sobre `ownerId` y cómo funciona el sistema
- Se agregó información sobre la creación de links para usuarios `invited`

**Nota**: La documentación ahora explica mejor cómo funciona el sistema de usuarios invitados, aunque aún podría beneficiarse de ejemplos de uso prácticos

---

### 3. ⚠️ Campos origenDefault y destinoDefault en Pedidos

**Ubicación**: `lib/types.ts` - Interfaz `Pedido`

**Campos encontrados**:
```typescript
origenDefault?: string  // Origen por defecto del pedido
destinoDefault?: string // Destino por defecto del pedido
```

**Estado en documentación**: ❌ Están en la estructura de datos pero no documentados en uso

**Recomendación**: 
- Verificar si estos campos se usan en el código
- Si se usan, documentar su propósito y cómo se utilizan
- Si no se usan, considerar si deben eliminarse o documentarlos como "futuro"

---

### 4. ⚠️ Campo permisos en Links de Invitación

**Ubicación**: `app/registro/page.tsx`

**Funcionalidad**: Los links de invitación pueden tener un campo `permisos` que se aplica al usuario al registrarse.

**Código encontrado**:
```typescript
const permisosDelLink = linkData.permisos
// ...
if (permisosDelLink) {
  updateData.permisos = permisosDelLink
}
```

**Estado en documentación**: ❌ No documentado

**Recomendación**: 
- Verificar cómo funciona el sistema de permisos
- Si se usa, documentar la estructura y propósito
- Actualizar `SISTEMA_ROLES_GRUPOS.md` con información sobre permisos

---

### 5. ✅ Confirmación para Editar Horarios Completados

**Ubicación**: `hooks/use-schedule-updates.ts`

**Funcionalidad**: Sistema que previene ediciones accidentales de horarios marcados como completados.

**Detalles**:
- Cuando se intenta editar un horario completado, se muestra un modal de confirmación
- La función `handleAssignmentUpdate` incluye lógica para manejar esta confirmación
- Los comentarios indican que la verificación se maneja en el modal

**Estado en documentación**: ⚠️ Mencionado en "Horarios Fijos" pero podría necesitar más detalle

**Recomendación**: Verificar si está documentado el flujo de confirmación

---

## 📋 Checklist de Verificación

### Funcionalidades del README.md
- [x] Gestión de Horarios - ✅ Documentado
- [x] Gestión de Pedidos y Stock - ⚠️ Falta "Reiniciar Pedido"
- [x] Chat de Stock con IA - ✅ Documentado
- [x] Sistema de Roles y Grupos - ⚠️ Falta detalle sobre "invited"
- [x] Estructura de Datos - ⚠️ Falta documentar origenDefault/destinoDefault
- [x] Uso de la Aplicación - ✅ Documentado

### Funcionalidades de SISTEMA_ROLES_GRUPOS.md
- [x] Roles principales - ⚠️ Falta detalle sobre "invited"
- [x] Sistema de Grupos - ✅ Documentado
- [x] Panel de Fábrica - ✅ Documentado
- [x] Links de Registro - ⚠️ Falta mencionar campo "permisos"
- [x] Sistema de Mensajería - ✅ Documentado

---

## 🎯 Recomendaciones de Actualización

### Prioridad Alta

1. ✅ **Documentar Reiniciar Pedido** - **COMPLETADO**
   - ✅ Agregado a la sección "Gestión de Pedidos y Stock" del README.md
   - ✅ Explicado cuándo y cómo usar esta funcionalidad

2. ✅ **Ampliar documentación del rol Invited** - **MEJORADO**
   - ✅ Explicado qué es y para qué sirve en SISTEMA_ROLES_GRUPOS.md
   - ✅ Documentado el flujo de creación de usuarios invitados
   - ✅ Explicado cómo funciona el sistema de permisos con `ownerId`
   - ⚠️ Pendiente: Agregar ejemplos prácticos de uso (opcional)

### Prioridad Media

3. **Verificar y documentar origenDefault/destinoDefault**
   - Revisar si se usan en el código
   - Documentar su uso o marcarlos como "no implementado"

4. **Documentar sistema de permisos en links de invitación**
   - Verificar la estructura del objeto permisos
   - Documentar cómo se aplican al usuario

### Prioridad Baja

5. **Verificar documentación de confirmación para horarios completados**
   - Asegurar que el flujo esté bien documentado

---

## 📝 Notas Adicionales

- El sistema está generalmente bien documentado
- La mayoría de las funcionalidades principales están cubiertas
- Los puntos identificados son principalmente mejoras y detalles adicionales
- Algunos campos pueden estar en preparación para funcionalidades futuras

---

**Fecha de revisión**: $(date)
**Revisado por**: AI Assistant
**Próxima revisión sugerida**: Después de cada commit mayor

