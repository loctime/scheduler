# Legacy Cleanup — Pedidos / Remitos / Stock

**Date:** 2026-04-11
**Scope:** Medium cleanup (Option B from brainstorm)
**Status:** Design approved; revised 2026-04-11 after deeper audit
**Environment:** dev (Firestore data loss acceptable)

## Context

The `horarios simple` project has accumulated legacy code in the
pedidos / remitos / stock subsystems. A prior audit
(`AUDITORIA_SISTEMA_PEDIDOS.md`) flagged several issues; a follow-up inventory
(2026-04-11) plus a deeper read of the actual code produced the real picture:

- The "half-finished migration" from `contexts/stock-context.tsx` is actually
  a **zombie**. `StockProvider` is wrapped around `app/dashboard/layout.tsx`
  and subscribes to three Firestore collections (`pedidos`, `products`,
  `stock_movimientos`), but **zero consumers call `useStock()`**. It was
  replaced at some point; the file survived.
- `src/services/pedidos/pedidosService.ts` has zero inbound imports. Its
  dependencies (`pedidoState.ts`, `stockOperations.ts`,
  `calcularPedido.ts`) are therefore also dead — only `pedidosService`
  imports them.
- `src/services/stock/movimientosService.ts` IS active (used by
  `hooks/use-stock-console.ts` → `components/stock-console-content.tsx`).
  Stock data already writes to the new `stock_ubicaciones` collection via
  `stockUbicacionRef` from `lib/stock-ubicaciones-service.ts`. But **the
  audit-log write on line ~113 still targets the legacy
  `COLLECTIONS.STOCK_MOVIMIENTOS`**.
- The `stock_movements_v2` collection exists but is backend-only
  (`allow write: if false`) — per `docs/LOGISTICS_V2_BACKEND_CONTRACT.md` it's
  written by the v2 backend, not the client. We cannot migrate the client's
  audit-log write there without breaking the contract.

## Goals

1. Delete confirmed dead files (zero inbound imports).
2. Remove the zombie `StockProvider` from `app/dashboard/layout.tsx` and
   delete `contexts/stock-context.tsx`.
3. Stop writing to the legacy `stock_movimientos` collection. The
   client-side audit log in `movimientosService.ts` is the only remaining
   writer.
4. Remove `STOCK_MOVIMIENTOS` from `lib/firebase.ts` COLLECTIONS and drop
   the `stock_movimientos` + `stock_actual` rule blocks from
   `firestore.rules`.
5. Leave the project with no references to `stock_movimientos`,
   `stock_actual`, `calcularPedido`, `pedidosService`, `pedidoState`,
   `stockOperations`, or `remito-enlace-publico`.

## Non-goals

- Consolidating the replicated `calcularPedido` logic into the domain layer
  (Option C in the brainstorm). The unused domain file is being deleted, not
  adopted.
- Splitting `components/pedidos/productos-table.tsx` (515 lines).
- Fixing the orthogonal data-integrity issues flagged in the audit
  (stock-can-go-negative, non-atomic recepción → stock, permissive Firestore
  rules on `apps/horarios/remitos`).
- Preserving any historical data in the legacy collections.
- Replacing the deleted client-side audit log with a new one. The v2 backend
  is expected to produce `stock_movements_v2` entries for stock operations it
  handles; the `stock-console` path will no longer write its own log entry.
  If this audit trail turns out to be needed, it will be a separate task.
- Touching `rules/firestore.rules` or `rules/horarios.rules`. Only
  `firestore.rules` at the project root is active (per `firebase.json`).

## Design

### Phase 1 — Delete dead files

Zero inbound references. Order inside the phase doesn't matter; each is
safe independently.

- `src/services/pedidos/pedidosService.ts`
- `src/domain/pedidos/calcularPedido.ts`
- `src/domain/pedidos/stockOperations.ts`
- `src/domain/pedidos/pedidoState.ts`
- `lib/remito-enlace-publico.ts`
- `docs/docs_v2/ESQUEMA_REMITOS.md`
- `docs/docs_v2/ARQUITECTURA_REMITOS.md`
- `docs/docs_v2/FLUJO_REMITOS_BLINDADO.md`
- `docs/docs_v2/ESTRUCTURA_REMITOS.md`

After this phase, `tsc --noEmit` must remain clean.

### Phase 2 — Remove the zombie StockProvider

- Edit `app/dashboard/layout.tsx`: remove the `StockProvider` import and
  unwrap its usage from the JSX tree. Leave surrounding providers
  untouched.
- Delete `contexts/stock-context.tsx`.

After this phase, grep for `StockProvider` and `useStock(` must return zero
hits in application code.

### Phase 3 — Stop writing to `stock_movimientos`

- Edit `src/services/stock/movimientosService.ts`: inside `confirmarMovimientos`,
  remove the block that builds `movimientoData` and calls
  `transaction.set(movimientoRef, …)`, including the unused local variables
  (`movimientoRef`, `movimientoData`, `movimientosGuardados`,
  `movimientoGuardado`). Keep the `stock_ubicaciones` read/validate/update
  flow exactly as-is. The function's return shape currently includes
  `movimientos: MovimientoStock[]`; change it to `movimientos: []` or remove
  that field after verifying consumers — see Step 3.x in the plan for the
  exact approach.
- If the `MovimientoStock[]` field is consumed by `use-stock-console.ts` or
  `stock-console-content.tsx`, update those call sites to not depend on it.
- Remove `STOCK_MOVIMIENTOS` from `lib/firebase.ts` COLLECTIONS.
- Remove the `match /apps/horarios/stock_movimientos/{docId}` block from
  `firestore.rules` (around lines 330–339).
- Remove the `match /apps/horarios/stock_actual/{docId}` block from
  `firestore.rules` (around lines 315–324).

### Phase 4 — Verification

- `tsc --noEmit` passes with zero errors.
- `__tests__/stock-domain.test.js` still passes.
- `pnpm dev` starts the project; smoke test:
  - `/dashboard` loads without runtime errors.
  - `/dashboard/mi-stock` loads and displays stock.
  - `/dashboard/stock-console` loads, and confirming a movement updates the
    stock value in `stock_ubicaciones` (reload to verify persistence).
- `grep -r stock_movimientos src/ lib/ app/ components/ hooks/ contexts/`
  returns zero matches.
- Same grep for: `stock_actual` (as a collection, not the `stockActual`
  field), `remito-enlace-publico`, `calcularPedido`, `pedidosService`,
  `pedidoState`, `stockOperations`.

## Risks and open questions

1. **Runtime references to `useStock()` in files not grepped.** The grep was
   over the repo root excluding `node_modules`. If there's a code path in
   generated output or a file extension we missed, deleting `stock-context.tsx`
   could break it. Mitigation: Phase 2 removes the provider wrapper first and
   runs `tsc --noEmit` before deleting the file.
2. **Audit trail loss.** Removing the client-side movement log means the
   stock console will no longer produce `stock_movimientos` entries. If any
   UI reads from that collection (it shouldn't — the old reader was
   `stock-context.tsx` which is being deleted), the list will go empty. The
   smoke test in Phase 4 covers the remaining UI paths.
3. **TypeScript return type drift.** Removing the movement-log write changes
   the return shape of `confirmarMovimientos`. Callers may rely on the
   `movimientos` array. The plan must update callers in the same task that
   changes the service, or the build breaks.
4. **Scope creep.** The broader audit flagged other issues
   (stock-can-go-negative, permissive remitos rules, non-atomic recepción).
   Those are out of scope for this cleanup. If they come up during
   implementation, log them and move on.

## Success criteria

- Every file in Phase 1 is deleted.
- `contexts/stock-context.tsx` no longer exists.
- `StockProvider` no longer wraps the dashboard layout.
- `src/services/stock/movimientosService.ts` no longer writes to
  `stock_movimientos`.
- `lib/firebase.ts` no longer exposes `STOCK_MOVIMIENTOS` in COLLECTIONS.
- `firestore.rules` has no entries for `stock_movimientos` or `stock_actual`.
- All Phase 4 verification steps pass.
