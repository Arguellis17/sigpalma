@AGENTS.md

<!-- codecortex:start -->
## CodeCortex — Project Knowledge (auto-updated)

### Architecture
**sigpalma** — tsx, typescript, javascript — 95 files, 895 symbols
- **Modules (4):** validations (235loc), supabase (184loc), auth (99loc), campo (27loc)
- **Key deps:** react, next, lucide-react, @/hooks, @/app, +18 more

### Risk Map
**High-risk files:**
- `components/app/app-shell.tsx` — 7 changes, stabilizing
- `app/actions/usuarios.ts` — 5 changes, stabilizing, coupled to: usuarios-client.tsx ⚠
- `.../admin/usuarios/usuarios-client.tsx` — 4 changes, moderate, coupled to: usuarios.ts ⚠
- `lib/database.types.ts` — 4 changes, moderate
- `db/schema.ts` — 4 changes, moderate

**Hidden couplings (co-change, no import):**
- `.../admin/usuarios/usuarios-client.tsx` ↔ `app/actions/usuarios.ts` (60% co-change)

### Before Editing
Check `.codecortex/hotspots.md` for risk-ranked files before editing.
If CodeCortex MCP tools are available, call `get_edit_briefing` for coupling + risk details.
If not, read `.codecortex/modules/<module>.md` for the relevant module's dependencies and bug history.

### Project Knowledge
Read these files directly (always available, no tool call needed):
- `.codecortex/hotspots.md` — risk-ranked files with coupling + bug data
- `.codecortex/modules/*.md` — module docs, dependencies, temporal signals
- `.codecortex/constitution.md` — full architecture overview
- `.codecortex/patterns.md` — coding conventions
- `.codecortex/decisions/*.md` — architectural decisions

### MCP Tools (if available)
If a CodeCortex MCP server is connected, these tools provide live analysis:
- `get_edit_briefing` — risk + coupling + bugs for files you plan to edit.
- `get_change_coupling` — files that co-change (hidden dependencies).
- `get_project_overview` — architecture + dependency graph summary.
- `get_dependency_graph` — scoped import/call graph for file or module.
- `lookup_symbol` — precise symbol search (name, kind, file filters).
<!-- codecortex:end -->
