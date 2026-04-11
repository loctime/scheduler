# Legacy Cleanup — Pedidos / Remitos / Stock

**Date:** 2026-04-11
**Scope:** Medium cleanup (Option B from brainstorm)
**Status:** Design approved, pending implementation plan

## Context

The `horarios simple` project has accumulated legacy code and duplicated
architecture in the pedidos / remitos / stock subsystems. A prior audit
(`AUDITORIA_SISTEMA_PEDIDOS.md`) flagged several issues; a follow-up inventory
(this session, 2026-04-11) found orphaned files and a half-finished migration
from an old stock context to a newer ubicaciones-based service.

Environment is **dev**, so Firestore data loss is acceptable. There are no
production users whose data needs to be preserved.

## Goals

1. Delete confirmed orphan files that nothing imports.
2. Complete the half-finished migration from `contexts/stock-context.tsx`
   (which reads from the legacy `stock_movimientos` collection) to a new
   provider built on `lib/stock-ubicaciones-service.ts`
   (which uses `stock_ubicaciones` and `stock_movements_v2`).
3. Remove the legacy Firestore collections' rules entries once no code touches
   them.
4. Leave the project in a state where there is exactly one source of truth for
   stock reads/writes, and the remaining code under `components/pedidos/`,
   `lib/`, and `src/domain/pedidos/` is all actively used.

## Non-goals

- Consolidating the replicated `calcularPedido` logic into the domain layer.
  (That was Option C in the brainstorm; the user chose B.)
- Splitting `components/pedidos/productos-table.tsx` (515 lines).
- Fixing the orthogonal data-integrity issues flagged in the audit
  (stock-can-go-negative, non-atomic recepción → stock, permissive Firestore
  rules on `apps/horarios/remitos`). Those are separate work.
- Migrating or preserving any data currently in the legacy collections.

## Design

### Phase 1 — Delete confirmed orphans

These files and rule entries have zero inbound references and can be deleted
without any code rewrites:

- `src/domain/pedidos/calcularPedido.ts`
- `lib/remito-enlace-publico.ts`
- In `firestore.rules`: the `match /apps/horarios/stock_actual/{docId}` block
- Legacy docs under `docs/docs_v2/`:
  - `ESQUEMA_REMITOS.md`
  - `ARQUITECTURA_REMITOS.md`
  - `FLUJO_REMITOS_BLINDADO.md`
  - `ESTRUCTURA_REMITOS.md`

After Phase 1, `tsc --noEmit` must remain clean.

### Phase 2 — Migrate stock-context to stock-ubicaciones

**Step 2.1 — API audit.** Before writing any new code, document:

- The exact surface of `contexts/stock-context.tsx`: every property and method
  exposed by `useStock()` / `useStockChatContext()`.
- Every call site in the codebase (the inventory estimated ~7 files).
  For each, note which parts of the API it actually uses.
- The current surface of `lib/stock-ubicaciones-service.ts`. Identify any gaps
  between what consumers need and what the service provides.

This audit lives in the implementation plan, not in this spec.

**Step 2.2 — New provider.** Create
`contexts/stock-ubicaciones-context.tsx` that:

- Subscribes to the `stock_ubicaciones` collection with `onSnapshot`, scoped
  by the same owner/location filter the old `stock-context.tsx` applied
  (identified in Step 2.1).
- Delegates all mutations to `lib/stock-ubicaciones-service.ts` — the context
  is a thin React layer, not a second copy of business logic.
- Exposes a hook `useStockUbicaciones()` whose shape matches what the
  consumer audit in 2.1 showed is actually needed. No speculative methods.
- Only adds methods to `stock-ubicaciones-service.ts` if the audit proves a
  consumer needs them.

**Step 2.3 — Incremental migration.** In this order:

1. Wrap `app/dashboard/layout.tsx` with the new provider (alongside the old
   one, temporarily, so nothing breaks mid-migration).
2. Migrate each `useStock()` call site one at a time. After each file,
   `tsc --noEmit` must pass.
3. Once all call sites are migrated, remove the old provider from the layout.
4. Delete `contexts/stock-context.tsx`.

**Step 2.4 — movimientosService cleanup.** After Step 2.3:

- Re-check imports of `src/services/stock/movimientosService.ts`.
- If no imports remain: delete it.
- If any imports remain: either migrate those call sites to write to
  `stock_movements_v2` via the service layer, or (if the caller is itself
  dead code) delete the caller.

**Step 2.5 — Firestore rules.** Remove the
`match /apps/horarios/stock_movimientos/{docId}` block from `firestore.rules`.

### Phase 3 — Verification

Before considering the cleanup complete:

- `tsc --noEmit` passes with zero errors.
- `__tests__/stock-domain.test.js` still passes.
- Smoke test by running the dev server and exercising:
  - Dashboard loads.
  - `/dashboard/mi-stock` shows stock data.
  - Editing a stock value persists (reload the page, value is still there).
  - Any pages in the 7-consumer list still render without runtime errors.
- `grep` for `stock_movimientos`, `stock_actual`, `remito-enlace-publico`,
  `calcularPedido` in the codebase returns zero hits.

## Risks and open questions

1. **API parity.** `lib/stock-ubicaciones-service.ts` may not expose
   everything the old context did. Step 2.1 surfaces this; the plan may need
   to include a "extend the service" subtask. Mitigation: do the audit
   before writing new code.
2. **Unknown movimientosService callers.** Until we grep in Step 2.4, we
   don't know how entangled this service is. If it turns out to be deeply
   used by non-legacy code, the cleanup may need to extend into Phase 3 or
   get split into its own follow-up.
3. **Silent runtime breakage.** TypeScript won't catch everything — some
   consumers may destructure properties that no longer exist, or depend on
   real-time update timing. The smoke test in Phase 3 is the safety net.
4. **Scope creep.** The audit flagged other issues (stock-can-go-negative,
   permissive remitos rules, non-atomic recepción). Those are out of scope
   for this cleanup and must not be mixed in. If they come up during
   implementation, log them and move on.

## Success criteria

- Every file in Phase 1 is deleted.
- `contexts/stock-context.tsx` no longer exists.
- No code imports from or writes to `stock_movimientos` or `stock_actual`.
- `firestore.rules` has no entries for those two collections.
- All Phase 3 verification steps pass.
- The brainstorm's stated outcome — "el sistema de stock unificado en una
  sola fuente" — is true.
