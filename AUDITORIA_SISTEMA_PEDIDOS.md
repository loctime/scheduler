# Auditoría estructural del sistema de pedidos

**Objetivo:** Diagnóstico técnico del sistema de pedidos. Sin refactorizar, sin implementar cambios.

---

## 1. Mapa conceptual del sistema actual

### 1.1 Qué hace cada archivo

| Archivo | Responsabilidad principal | Qué controla |
|--------|----------------------------|---------------|
| **`app/dashboard/pedidos/page.tsx`** | Orquestador de la página de pedidos. Concentra estado de UI (tabs, dialogs, edición inline del header), merge de `stockActual` (contexto + local), estado de **ajustes de pedido**, **viewMode** y **showConfig**. Define `calcularPedidoConAjuste` y `productosAPedirActualizados`. Conecta hooks (usePedidos, useEnlacePublico, useRemitos, useRecepciones), carga datos de recepción/remitos/enlaces y delega a ProductosTable, RecepcionForm, PedidoTimeline, dialogs y sidebar. | `viewMode` ("pedir" \| "stock"), `showConfig` (configMode), `ajustesPedido`, `activeTab`, `productosEnviados`, dialogs, remitos, recepciones, enlaceActivo. |
| **`components/pedidos/productos-table.tsx`** | Tabla de productos del pedido seleccionado. Renderiza lista, edición inline (nombre, stock mínimo, cantidad por pack, modo compra), creación inline de producto, drag & drop de orden, y **según modo** columna "Pedido" (con cálculo + ajustes) o "Stock" (edición de stock actual). Muestra indicadores (bajo mínimo, por debajo del mínimo). | Comportamiento vía props: `configMode` → modo "config" (muestra switch Unidad/Pack, eliminar, editar mín, cant/pack, botón Agregar). `viewMode` → etiqueta y controles "Pedido" vs "Stock". `calcularPedido` + `ajustesPedido` + `onAjustePedidoChange` → cálculo y edición de cantidades a pedir. |
| **`components/pedidos/pedidos-sidebar.tsx`** | Lista de pedidos (móvil: horizontal; desktop: vertical). Selección y botón crear. | Solo presentación y eventos; sin estado de dominio. |
| **`components/pedidos/pedido-dialogs.tsx`** | Conjunto de diálogos: crear pedido, importar productos, eliminar pedido, limpiar stock, confirmar nuevo enlace, **confirmar envío**, confirmar edición. | Contenido y acciones vía props; ConfirmarEnvioDialog incluye lógica de formato (packs vs unidades) para mostrar resumen. |
| **`components/pedidos/pedido-timeline.tsx`** | Timeline visual del estado del pedido: Creado → Enviado → Recibido → Completado. | Solo presentación a partir de `pedido.estado`. |
| **`components/pedidos/recepcion-form.tsx`** | Formulario de recepción: cantidades recibidas por producto, observaciones, devoluciones. Usa dominio (`prepararRecepcion`, `validarRecepcion`). Validación local para packs (múltiplos). | Estado local de recepción; llama `onConfirmar` con datos ya preparados por dominio. |
| **`hooks/use-pedidos.ts`** | CRUD de pedidos y productos, listener del pedido seleccionado, carga de productos, **stockActual local** (por pedido), **calcularPedido** (base: `max(0, stockMinimo - stockActual)`), `productosAPedir` (sin ajustes). No conoce `ajustesPedido` ni `viewMode`. | `pedidos`, `products`, `selectedPedido`, `stockActual` (local), `calcularPedido`, acciones de persistencia. |
| **`lib/remito-utils.ts`** | Creación de datos de remito (pedido, envío, recepción). `crearRemitoPedido` recibe `calcularPedido` y `ajustesPedido` y repite la lógica base + ajuste + packs. | No mantiene estado; recibe todo por parámetros. |
| **`src/domain/pedidos/calcularPedido.ts`** | Dominio puro: `calcularCantidadPedida`, `aplicarAjusteCantidad`, `calcularPedidoPorProducto`. **No se usa desde la UI de pedidos**; la página y la tabla replican la lógica con `calcularPedido` del hook y ajustes en página/tabla. | Ninguno (solo funciones puras). |

### 1.2 Qué controla cada prop relevante en ProductosTable

| Prop | Origen | Efecto en la tabla |
|------|--------|--------------------|
| `configMode` | `page.tsx` (`showConfig`) | Si `true`: muestra switch Unidad/Pack, botón eliminar, edición de Min y Cant/pack, botón "Agregar" y formulario de creación inline. Si `false`: solo lectura de Min, sin controles de configuración. |
| `viewMode` | `page.tsx` (`viewMode`: "pedir" \| "stock") | **"pedir"**: columna "Pedido", inputs de cantidad a pedir (base + ajuste), indicadores "por debajo del mínimo". **"stock"**: columna "Stock", inputs de stock actual (+/- y persistencia vía `onStockChange`). |
| `calcularPedido` | `use-pedidos.ts` | Función `(stockMinimo, stockActualValue) => number` usada por cada fila para obtener `pedidoBase`. La tabla suma `ajuste` y aplica lógica packs/unidades para mostrar y editar. |
| `ajustesPedido` / `onAjustePedidoChange` | `page.tsx` (estado local) | Ajuste por producto (en unidades o en packs según producto). La tabla calcula `pedidoCalculado` y `displayPedido` y delega cambios al padre. |
| `stockActual` | Merge en `page.tsx` (contexto + `usePedidos`) | Valor mostrado en "Stock:" y usado como input de `calcularPedido`. En viewMode "stock" es editable. |
| `onProductsOrderUpdate` | `use-pedidos.ts` | Habilita drag & drop y reordenación; si no se pasa, no se muestra el agarre ni se permite arrastrar. |

### 1.3 Cómo cambia la tabla según el modo

- **configMode = false, viewMode = "pedir"**  
  Tabla de pedido: columnas Stock (lectura), Min (lectura), Pedido (editable con base + ajuste). Sin drag, sin eliminar, sin crear.

- **configMode = false, viewMode = "stock"**  
  Igual pero la columna derecha es "Stock" editable (stock actual). Sin controles de pedido.

- **configMode = true, viewMode = "pedir"**  
  Añade: switch Unidad/Pack, eliminar producto, editar Min (botones +/- e input), Cant/pack si es pack, botón "Agregar", drag & drop. Columna Pedido sigue igual.

- **configMode = true, viewMode = "stock"**  
  Igual que arriba pero columna derecha es Stock editable.

La combinación es **configMode × viewMode** (cuatro variantes) más la presencia opcional de `onProductsOrderUpdate` y `onCreateProduct`, lo que hace que la misma tabla sirva como “lista de pedido”, “lista de stock” y “configuración de productos” en un solo componente.

---

## 2. Problemas estructurales detectados

### 2.1 Violación de principio de responsabilidad única (ProductosTable)

**ProductosTable** asume demasiadas responsabilidades en un solo componente:

- Render de lista de productos (presentación).
- Edición inline de campos (nombre, stock mínimo, cantidad por pack, modo compra).
- Creación inline de producto (formulario completo con validación).
- Drag & drop para orden.
- Cálculo y presentación de “cantidad a pedir” (base + ajuste) en unidades y en packs.
- Decisión de qué columna mostrar (Pedido vs Stock) y qué controles mostrar según `configMode` y `viewMode`.
- Indicadores de dominio (bajo mínimo, por debajo del mínimo).
- Estado local de optimismo (stockMinimoLocal, cantidadPorPackEdit, modoCompraLocal) para no esperar a Firestore.

Consecuencia: el componente es difícil de testear, de leer y de cambiar sin afectar varios comportamientos a la vez.

### 2.2 Estados implícitos y duplicados

- **Cálculo de pedido:**  
  - En **page**: `calcularPedidoConAjuste` (base + ajuste, con packs/unidades).  
  - En **ProductosTable**: mismo concepto inline en el `map` (pedidoBase, ajuste, total en packs o unidades).  
  - En **remito-utils**: `crearRemitoPedido` vuelve a aplicar base + ajuste + packs.  
  - En **dominio**: `calcularPedido.ts` existe pero **no se usa** en esta pantalla.  
  Hay varias fuentes de verdad para “cantidad a pedir”; una sola (idealmente el dominio) debería ser la referencia.

- **Stock actual:**  
  - `usePedidos` tiene `stockActual` local (se resetea al cambiar de pedido).  
  - `useStockChatContext()` expone `stockActual` global.  
  - La **page** hace merge (“si hay locales, combinar con globales; si no, usar globales”).  
  El flujo real (cuándo es local vs global y por qué) no está modelado de forma explícita; es una convención en un `useMemo`.

- **Ajustes de pedido:**  
  Solo viven en estado de la page. No están en el hook ni en el dominio; al cambiar de pedido no se resetean explícitamente en el código revisado (depende de si el estado se considera “por pedido” o global en la intención).

### 2.3 Lógica de negocio en componente visual

- En **ProductosTable**, dentro del `map` de productos:
  - Cálculo de `pedidoBase`, `pedidoCalculado`, `displayPedido`, `onDisplayChange` y `displaySuffix` según unidad/pack.
  - Reglas de indicadores: `isBajoMinimo`, `pedidoMayorCero`, `porDebajoMinimo`.
  Esto es lógica de dominio (cómo se calcula y cuándo se considera “bajo mínimo”) embebida en el componente de presentación.

- En la **page**, `calcularPedidoConAjuste` y la derivación de `productosAPedirActualizados` son lógica de negocio; conviviría mejor en un hook o en el dominio que en el cuerpo del componente página.

### 2.4 Dependencias cruzadas

- **Page** depende de: usePedidos, useStockChatContext, useEnlacePublico, useRemitos, useRecepciones, useData, getOwnerIdForActor, Firestore directo (doc, updateDoc, getDoc, deleteDoc), remito-utils, tipos, unidades-utils. Demasiadas fuentes de verdad y de efectos (persistencia, remitos, recepciones, enlaces, stock).

- **ProductosTable** recibe una función `calcularPedido` en lugar de recibir cantidades ya calculadas o un servicio de dominio. Así el componente depende del contrato del hook y repite la semántica del cálculo internamente.

- **remito-utils** depende de la misma firma `calcularPedido(stockMinimo, stockActual)` y de `ajustesPedido`; si la regla de negocio cambia, hay que tocar página, tabla y remito-utils.

### 2.5 Acoplamiento excesivo

- La tabla está acoplada a:
  - Forma de cálculo del pedido (función inyectada).
  - Forma de ajustes (objeto + callback).
  - Dos modos de vista (pedir/stock) y un modo de configuración (config).
  - Persistencia (onStockChange, onUpdateProduct, etc.) y orden (onProductsOrderUpdate).
  Cualquier cambio en el flujo de “cómo se calcula el pedido” o “qué es un ajuste” obliga a tocar la tabla.

- La page conoce detalles de Firestore (COLLECTIONS, updateDoc, getDoc), de remitos, de recepciones y de enlaces. Un cambio en el modelo de datos o en los servicios repercute en un archivo muy grande.

### 2.6 Flags y combinaciones difíciles de mantener

- **configMode** y **viewMode** son booleanos/cadenas independientes. La tabla usa `configMode` para mostrar/ocultar bloques (switch, eliminar, editar mín, cant/pack, agregar) y `viewMode` para elegir columna (Pedido vs Stock). No hay un tipo “modo de página” que documente las combinaciones válidas (p. ej. “edicion_pedido” | “edicion_stock” | “config_productos”).

- **ajustesPedido** y **stockActual** interactúan con el cálculo: el mismo producto puede tener ajuste 0 o no estar en el objeto; la tabla y la page deben tratar ambos casos. No hay un contrato claro de “estado de ajustes por pedido” (por ejemplo, si al cambiar de pedido se debería resetear o no).

- Condicionales dispersos en la tabla (`configMode && ...`, `viewMode === "pedir" ? ...`, `onAjustePedidoChange?.(...)`) hacen que el comportamiento dependa de muchas ramas; añadir un nuevo modo o una nueva variante multiplica las ramas.

---

## 3. Nivel de complejidad actual

**Clasificación: Alta (cercana a Crítica)**

**Justificación breve:**

- **ProductosTable** es un componente grande (~515 líneas) con muchas responsabilidades y varios estados locales; el comportamiento depende de la combinación de varias props (configMode, viewMode, ajustesPedido, calcularPedido, onProductsOrderUpdate, onCreateProduct). Un cambio en un modo puede afectar a los demás.

- La **page** supera las 1.000 líneas, mezcla orquestación, estado de UI, merge de stock, lógica de pedido con ajustes, carga de recepción/remitos/enlaces, y llamadas directas a Firestore. El flujo “quién escribe qué y cuándo” no está centralizado.

- El **cálculo de pedido** está replicado en página, tabla y remito-utils, y el módulo de dominio existente no se usa; eso aumenta el riesgo de inconsistencias y de regresiones al cambiar la regla.

- Los **flags** (configMode, viewMode, ajustesPedido, stockActual local/global) generan muchas combinaciones; no hay un modelo explícito de “modo” ni de “estado de la pantalla pedidos”, por lo que el flujo es implícito y costoso de seguir.

Se considera “Alta” y no “Crítica” porque: la funcionalidad está contenida en una zona del producto (pedidos), hay algo de dominio separado (recepcion-form, prepararRecepcion, calcularPedido.ts aunque no usado aquí) y no se detectan dependencias circulares graves. Pero sin un refactor dirigido, el siguiente feature o cambio de reglas puede llevar la complejidad a crítica.

---

## 4. Recomendación estructural (solo propuesta, sin implementar)

### 4.1 Qué debería separarse

- **ProductosTable:**  
  - Dividir por responsabilidad: por ejemplo, una lista/fila “solo lectura” o “solo pedido”, una “solo stock”, una “configuración de producto” (edición de mín, pack, eliminar, crear). O bien componentes por “celda” (CeldaPedido, CeldaStock, CeldaConfig) y una lista que componga según modo.  
  - Sacar la lógica de “cantidad a pedir” (base + ajuste, unidad/pack) a un hook o al dominio; la tabla solo recibe cantidades y callbacks.

- **Página de pedidos:**  
  - Extraer la lógica de “pedido con ajustes” y “productos a pedir” a un hook (p. ej. `usePedidoConAjustes`) que dependa de usePedidos y exponga `calcularPedidoConAjuste`, `productosAPedirActualizados`, `ajustesPedido`, `handleAjustePedidoChange`.  
  - Extraer la carga y estado de “recepción” (productosEnviados, remitos, etc.) a un hook o servicio.  
  - Reducir el uso directo de Firestore en la page; que los hooks o servicios encapsulen persistencia.

- **Cálculo de pedido:**  
  - Unificar en el dominio: usar `src/domain/pedidos/calcularPedido.ts` (o extenderlo) como única fuente para “cantidad base” y “cantidad con ajuste”, incluyendo packs.  
  - Que la page, la tabla y remito-utils consuman ese dominio (o un adapter que llame al dominio) en lugar de repetir fórmulas.

### 4.2 Qué debería centralizarse

- **Regla de “cantidad a pedir”** (base + ajuste, en unidad y en pack): en el dominio, con funciones puras o un pequeño servicio que reciba producto, stockActual y ajustes y devuelva cantidades y formato de presentación.

- **Origen del stock actual** (global vs local por pedido): un solo lugar que defina el merge (p. ej. hook o contexto) y exponga `stockActual` y `setStockActual` con contrato claro (por pedido, por sesión, etc.), para que la page no tenga que decidir la política en un `useMemo`.

- **Estado de “ajustes de pedido”**: si es por pedido, debería vivir junto al pedido seleccionado (en el mismo hook que maneja el pedido o en uno dedicado) y resetearse al cambiar de pedido, con una interfaz clara (getAjuste, setAjuste, clearAjustes).

### 4.3 Estado global

- **Stock actual:** Ya hay contexto global (stock-chat). Si se mantiene, conviene que el contrato “qué es stock actual para la pantalla de pedidos” quede definido en un solo sitio (p. ej. hook que use el contexto + estado local por pedido si hace falta) en lugar de merge ad hoc en la page.

- **Ajustes de pedido:** No es necesario que sean globales; pueden ser estado local al “pedido actual” pero manejado por un hook que la page use, para no mezclar en la page lógica de negocio y estado.

- No es estrictamente necesario un estado global para “modo de página” (pedir/stock/config); puede seguir siendo estado local de la page, pero conviene un tipo explícito (p. ej. `ModoProductos = "pedir" | "stock" | "config"`) y, si crece, un contexto pequeño o un hook `useModoProductos()` para que el resto de la app no dependa de varios booleanos sueltos.

### 4.4 Dividir la tabla por modo

- **Sí, es recomendable** en el sentido de tener componentes distintos (o ramas muy claras) por “vista”:  
  - Una vista “pedir” (solo columna pedido y tal vez mín/stock en lectura).  
  - Una vista “stock” (columna stock editable).  
  - Una vista “config” (edición de producto, orden, crear/eliminar).  
  La página decidiría qué vista mostrar según `viewMode` y `configMode`, en lugar de una sola tabla con muchos condicionales internos.  
  La lista base (orden, drag, estructura de fila) puede ser compartida; lo que cambia es el contenido de las celdas y las acciones.

### 4.5 Reducer

- **Sí, puede ayudar** para la página o para un hook “estado de la pantalla pedidos”: un reducer que agrupe acciones como `SET_VIEW_MODE`, `SET_CONFIG_MODE`, `SET_AJUSTE`, `RESET_AJUSTES`, `SELECT_PEDIDO` (y al seleccionar, resetear ajustes si se desea). Así las transiciones de estado son explícitas y se evitan múltiples `useState` que se actualizan en distintos handlers.  
  No es obligatorio para todo: por ejemplo, el estado de diálogos puede seguir siendo useState si se prefiere; el reducer tendría más sentido para “modo” y “ajustes”.

### 4.6 Modelo explícito de “modo de página”

- **Sí, conviene.** Definir un tipo, por ejemplo:  
  `type ModoProductos = "pedir" | "stock" | "config"`  
  o un estado que combine vista y configuración:  
  `{ vista: "pedir" | "stock"; configAbierto: boolean }`  
  y que la tabla (o las subvistas) reciban solo ese modo en lugar de `configMode` y `viewMode` por separado. Así se documentan las combinaciones válidas y se evitan estados incoherentes (en el futuro, si se añaden más modos, se extiende el tipo en un solo sitio).

---

## Resumen

- **ProductosTable** está sobrecargada: mezcla lista, edición, creación, drag & drop, cálculo de pedido y dos modos de columna (pedir/stock) más modo configuración.  
- Hay **lógica de dominio** (cálculo de pedido, indicadores) dentro de la tabla y de la page, y **cálculo duplicado** respecto a remito-utils y al dominio no usado.  
- **Estados** (stock actual, ajustes) están repartidos y el flujo (local vs global, qué se resetea) es implícito.  
- **Flags** (configMode, viewMode, ajustesPedido) generan muchas combinaciones sin un tipo “modo” único.  
- **Recomendación:** separar responsabilidades en la tabla (por modo/vista), centralizar el cálculo de pedido en el dominio, extraer hooks para “pedido con ajustes” y para datos de recepción/remitos, y opcionalmente un reducer y un tipo explícito para el modo de la pantalla de productos.
