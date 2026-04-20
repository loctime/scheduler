# Generar Productos Demo en Catálogo

**Fecha:** 2026-04-20

## Objetivo

Agregar un botón "Generar demo" en la toolbar del catálogo para crear 10 productos de almacén genérico con un solo click. Sirve para demostrar el sistema cuando el catálogo está vacío.

## Ubicación

Componente `ProductosTable.tsx` — toolbar superior, junto a los botones de importar/exportar existentes.

## Comportamiento

1. Usuario hace click en "Generar demo"
2. El botón muestra spinner y se deshabilita
3. Se llaman 10 instancias de `crearProductoCatalogo()` en paralelo via `Promise.all`
4. Al resolverse, el botón vuelve a su estado normal
5. Los productos aparecen automáticamente (Firestore realtime listener ya activo)

## Productos a generar

| nombre | unidad | stockMinimo | activo |
|---|---|---|---|
| Arroz | kg | 0 | true |
| Aceite | L | 0 | true |
| Harina | kg | 0 | true |
| Azúcar | kg | 0 | true |
| Sal | kg | 0 | true |
| Fideos | kg | 0 | true |
| Yerba | kg | 0 | true |
| Café | kg | 0 | true |
| Leche | L | 0 | true |
| Galletitas | u | 0 | true |

Campos opcionales (`proveedor`, `categoria`, `grupoCatalogoId`, etc.) se dejan vacíos.

## Implementación

- **Archivo a modificar:** `components/catalogo/ProductosTable.tsx`
- **Función a usar:** `crearProductoCatalogo()` de `lib/catalogo-service.ts`
- **Estado local:** `const [generando, setGenerando] = useState(false)`
- **Lógica:** `Promise.all(DEMO_PRODUCTS.map(p => crearProductoCatalogo({...p, ownerId, createdBy: user.uid, pedidoId: ""})))`

## Consideraciones

- No se verifica si ya existen productos antes de generar (el usuario puede llamarlo múltiples veces si quiere más)
- No requiere confirmación — es una acción reversible (los productos se pueden eliminar)
