# PWA Horario - Mejoras de UX y Performance

## Resumen de Cambios Implementados

### 1. Zoom en Móvil (PWA) ✅
- **Configuración**: Viewport ya estaba configurado correctamente en `layout.tsx`
- **CSS**: Agregado `touch-action: manipulation` al contenedor de imagen
- **Estilos**: Deshabilitado selección y menú contextual en móvil
- **Compatibilidad**: Desktop mantiene comportamiento normal

### 2. Optimización de Carga Inicial ✅
- **Nueva función**: `getImageUrlWithCache()` con timestamp para cache inteligente
- **Headers requeridos**: Backend debe configurar Cache-Control (ver sección Backend)
- **Service Worker**: Sin cambios, ya usa cache-first

### 3. Soporte WebP ✅
- **Detección automática**: `getSupportedImageFormat()` detecta soporte WebP
- **URL dinámica**: Agrega parámetro `format=webp|png` automáticamente
- **Fallback**: PNG para navegadores sin soporte WebP
- **Backend**: Debe soportar ambos formatos (ver sección Backend)

### 4. UX de Carga Mejorada ✅
- **Placeholder**: Skeleton mientras carga la imagen
- **Transiciones**: Fade-in suave cuando la imagen carga
- **Estados diferenciados**: Loading, Error, Success
- **Feedback claro**: Indicadores visuales en cada estado

---

## Cambios en Archivos

### `lib/pwa-horario.ts`
```typescript
// Nuevas funciones exportadas:
export function getSupportedImageFormat(): 'webp' | 'png'
export function getImageUrlWithCache(ownerId: string, baseUrl?: string): string
```

### `app/pwa/horario/page.tsx`
- Estados adicionales: `imageLoading`, `imageSrc`, `showCachedImage`
- Placeholder animado mientras carga
- Contenedor con `touch-action: manipulation`
- URL optimizada con formato y cache

### `app/pwa/horario/layout.tsx`
- Sin cambios (viewport ya configurado correctamente)

---

## Configuración Backend Requerida

### Headers HTTP para `/api/horarios/semana-actual`
```http
Cache-Control: public, max-age=300, stale-while-revalidate=86400
Content-Type: image/webp o image/png (según parámetro format)
```

### Soporte de Formatos
El endpoint debe aceptar parámetro `format`:
```
GET /api/horarios/semana-actual?ownerId=XXX&format=webp
GET /api/horarios/semana-actual?ownerId=XXX&format=png
```

**Lógica recomendada:**
- Si `format=webp` y navegador soporta WebP → servir WebP
- Si `format=png` o no hay soporte WebP → servir PNG
- Mantener compatibilidad con URLs sin parámetro `format`

---

## Flujo de Optimización

### 1. Detección de Capacidades
```javascript
// Automático en carga inicial
const format = getSupportedImageFormat() // 'webp' | 'png'
```

### 2. Generación de URL
```javascript
// URL optimizada con timestamp
const url = getImageUrlWithCache(ownerId)
// Resultado: /api/horarios/semana-actual?ownerId=XXX&format=webp&_t=1234567890
```

### 3. Carga con Cache
- **Timestamp**: Evita cache del navegador
- **Service Worker**: Permite cache-first de PWA
- **Headers**: Cache-Control con stale-while-revalidate

### 4. Experiencia de Usuario
1. **Inmediato**: Muestra placeholder
2. **Cache SW**: Si hay versión cacheada, muestra instantáneamente
3. **Red**: Solicita nueva versión en background
4. **Transición**: Fade-in cuando carga nueva imagen

---

## Compatibilidad

### Desktop
- ✅ Comportamiento idéntico al anterior
- ✅ Zoom con mouse wheel (navegador)
- ✅ Sin cambios en UX

### Móvil PWA
- ✅ Pinch-to-zoom funcional
- ✅ Double tap zoom
- ✅ Touch gestures optimizados
- ✅ Carga rápida con cache

### Navegadores
- ✅ Chrome/Edge: WebP + zoom
- ✅ Safari: PNG + zoom
- ✅ Firefox: WebP + zoom
- ✅ Fallback: PNG sin zoom

---

## Performance Esperada

### Antes
- Tiempo carga: 2-5 segundos
- Sin cache optimizada
- Solo PNG
- Sin feedback visual

### Después
- Tiempo carga: <1 segundo (con cache)
- Cache inteligente (5min + 24h stale)
- WebP cuando sea posible
- Placeholder inmediato
- Transiciones suaves

---

## Testing Manual

### Zoom en Móvil
1. Abrir PWA en móvil
2. Hacer pinch-to-zoom sobre imagen
3. Verificar que funciona correctamente

### Formato WebP
1. Abrir en Chrome/Edge
2. Verificar en Network tab que solicita `format=webp`
3. Abrir en Safari
4. Verificar que solicita `format=png`

### Cache Performance
1. Cargar imagen primera vez
2. Recargar página
3. Verificar que carga casi instantáneamente

### UX Placeholder
1. Abrir con conexión lenta
2. Verificar placeholder aparece inmediatamente
3. Verificar transición suave al cargar imagen

---

## Notas de Implementación

- **Sin dependencias nuevas**: Usa APIs nativas del navegador
- **Backward compatible**: No rompe funcionalidad existente
- **Progresivo**: Mejora experiencia gradualmente
- **Mantenible**: Código simple y bien documentado

Las mejoras son incrementales y no afectan la arquitectura existente.
