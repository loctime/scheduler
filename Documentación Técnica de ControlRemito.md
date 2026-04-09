# 📋 Documentación Técnica de ControlRemito
### Para análisis comparativo con otro repositorio

> Este documento describe cómo funciona ControlRemito en detalle técnico.
> Está redactado para que un agente que NO conoce este repositorio pueda compararlo con otro sistema equivalente.

---

## 🧭 ¿Qué es ControlRemito?

Una app web que digitaliza el flujo de pedidos entre **sucursales** y **fábricas**.
Reemplaza el papel: pedido → preparación → entrega → recepción → remito PDF firmado.

**Stack:** Next.js 15 (App Router) + TypeScript + Firebase (Auth + Firestore + Storage) + jsPDF

---

## 👥 Roles del sistema

| Rol | Qué puede hacer |
|-----|----------------|
| `maxdev` | Super admin total |
| `admin` | Administra el sistema completo |
| `branch` | Crea pedidos, recibe mercadería |
| `factory` | Prepara pedidos (arma) |
| `delivery` | Transporta pedidos entre fábrica y sucursal |

Cada usuario tiene `branchId` que lo vincula a una sucursal o fábrica específica.
Las queries de Firestore se filtran según el rol y `branchId` del usuario logueado.

---

## 🔄 Flujo de estados de un pedido

```
draft → sent → assembling → (ready*) → in_transit → received
                                                   ↘ cancelled
```

*`ready` no es un estado de orden, es un campo (`preparedAt`) dentro del estado `assembling`.

### Detalle de cada transición

| De | A | Quién | Qué se registra |
|----|---|-------|----------------|
| `draft` | `sent` | branch | `sentBy`, `sentByName`, `sentAt` |
| `sent` | `assembling` | factory | `acceptedBy`, `acceptedByName`, `acceptedAt` |
| `assembling` | (listo) | factory | `preparedBy`, `preparedByName`, `preparedAt` |
| `assembling` | `in_transit` | delivery | `deliveredBy`, `deliveredByName`, `deliveredAt` |
| `in_transit` | `received` | branch | `receivedBy`, `receivedByName`, `receivedAt` |

---

## 🗃️ Modelo de datos (Firestore)

**Ruta base:** `apps/controlRemito/`

### Colecciones principales

| Colección | Para qué |
|-----------|----------|
| `users` | Usuarios del sistema |
| `branches` | Sucursales y fábricas |
| `products` | Catálogo de productos |
| `orders` | Pedidos |
| `deliveryNotes` | Remitos finales |
| `templates` | Plantillas de pedidos |
| `remit-metadata` | Firmas y auditoría de estados |
| `replacementQueues` | Cola de reposiciones por faltantes |

---

### Entidad: `Order` (pedido)

```
id, orderNumber, status
fromBranchId / fromBranchName  ← sucursal que pide
toBranchId / toBranchName      ← fábrica que prepara
items[]                        ← array de OrderItem
templateId, allowedSendDays[]
parentOrderId                  ← si fue creado automáticamente por faltantes
notes, assemblyNotes
cancelledAt, cancelledBy, cancelReason
```

### Entidad: `OrderItem` (producto dentro de un pedido)

```
id, productId, productName, quantity, unit
status: pending | available | not_available | delivered | not_received | returned
notAvailableReason, returnReason, notReceivedReason
assembledQuantity     ← cantidad real armada por fábrica
isFullyAssembled      ← booleano
assemblyNotes, assembledBy, assembledAt
```

### Entidad: `DeliveryNote` (remito final)

Tiene 3 secciones diferenciadas:
1. **Lo pedido** (`itemsRequested` + `requestedBySignature`)
2. **Lo armado** (`itemsAssembled` + `assembledBySignature`)
3. **Lo recibido** (4 listas: `itemsDelivered`, `itemsPartial`, `itemsReturned`, `itemsNotReceived`) + firmas de delivery y recepción

### Entidad: `Signature` (firma digital)

```
userId, userName, timestamp
signatureImage   ← base64 de firma dibujada (canvas)
position         ← cargo del firmante
```

### Entidad: `RemitMetadata` (auditoría de firmas por pedido)

```
orderId, orderNumber, currentStatus
sentSignature, assemblingSignature, readySignature
inTransitSignature, receivedSignature
statusHistory[]  ← array con {status, timestamp, userId, userName}
```

### Entidad: `Template` (plantilla de pedido)

```
name, description
items[]                   ← productos con cantidad base
type: global | branch | personal
branchId
destinationBranchIds[]    ← múltiples destinos posibles
allowedSendDays[]         ← días de la semana permitidos
```

### Entidad: `ReplacementQueue` (cola de reposiciones)

```
branchId, branchName
items[]            ← ReplacementItem[]
status: pending | merged | completed | cancelled
```

Cada `ReplacementItem` tiene referencia al pedido original donde faltó el producto.

---

## ⭐ Funcionalidades clave (para comparar)

### 1. Armado con cantidades parciales
La fábrica puede registrar `assembledQuantity` distinta a la cantidad pedida.
El sistema detecta automáticamente si fue armado completamente (`isFullyAssembled`).

### 2. Sistema de reposiciones
Cuando un item llega con faltante, se crea un `ReplacementItem` en una cola por sucursal.
Esa cola se puede:
- **Fusionar** con un pedido en draft existente
- **Crear** un nuevo pedido urgente (`REP-timestamp`)
- **Fusión automática** si hay pedidos en draft disponibles

Al cargar una plantilla, el sistema pre-llena automáticamente las cantidades pendientes de la cola de reposiciones.

### 3. Remito con 3 secciones separadas
El `DeliveryNote` guarda por separado lo pedido, lo armado y lo recibido. Esto permite comparar discrepancias históricamente.

### 4. Historial de firmas con timestamps
`RemitMetadata` registra cada cambio de estado con firma + timestamp. Se reconstruye automáticamente si no existe (`rebuildRemitMetadata`).

### 5. Plantillas con días de envío permitidos
Las plantillas tienen `allowedSendDays[]`. El sistema valida que el pedido se envíe en un día permitido.
Tipos de plantilla: `global` (admin), `branch` (oficial de sucursal), `personal` (usuario).

### 6. Pedidos padre-hijo
Un pedido puede tener `parentOrderId` indicando que fue generado automáticamente (ej: por reposición urgente).
La UI agrupa pedidos por relación padre-hijo.

### 7. PDF generado en cliente
El remito se genera con jsPDF directamente en el browser (sin backend).
Incluye: logo, info del pedido, tabla de items, firmas digitales con imagen base64.

### 8. Filtrado de datos por rol
Las queries de Firestore varían según el rol:
- `branch` → ve sus propios pedidos (como origen o destino)
- `factory` → ve pedidos dirigidos a su sucursal
- `delivery` → ve pedidos en estados `assembling`, `in_transit`, `received`
- `admin/maxdev` → ve todo

---

## 🔍 Preguntas clave para comparar con el otro sistema

Al analizar el otro repositorio, buscar si tiene equivalentes a:

1. ¿Tiene estados de pedido equivalentes? ¿Cuántos pasos tiene el flujo?
2. ¿Registra quién hizo cada transición de estado (firma/auditoría)?
3. ¿Diferencia entre cantidad pedida vs cantidad armada vs cantidad recibida?
4. ¿Tiene sistema de reposiciones o faltantes?
5. ¿Tiene plantillas de pedidos con días permitidos?
6. ¿Genera PDFs? ¿En cliente o en servidor?
7. ¿Cómo filtra los datos según el rol del usuario?
8. ¿Tiene relación padre-hijo entre pedidos?
9. ¿Guarda historial de estados con timestamps?
10. ¿Las firmas tienen imagen dibujada (canvas) o solo nombre/timestamp?
11. ¿Tiene multi-tenancy (estructura bajo namespace por empresa)?
12. ¿Cómo maneja la cancelación de pedidos?

---

## ⚠️ Cosas incompletas / TODOs conocidos en ControlRemito

- `createUrgentReplacementOrder`: el `toBranchId` de la fábrica destino queda vacío (pendiente de implementar)
- Sistema de prioridades en reposiciones: marcado como TODO, actualmente procesa todo como igual prioridad
- Notificaciones push: no implementadas
- Dashboard con métricas: no implementado
- Tests: no hay tests automatizados

---

*Generado para comparación técnica. Última actualización conocida del repo: Octubre 2025.*