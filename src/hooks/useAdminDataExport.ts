// Orchestrates the admin database export/import on the client side. The
// edge functions are deliberately dumb — they handle one table-page at a
// time — and this hook is the loop that pages through every table,
// assembles the JSON bundle, and triggers the download. Same pattern in
// reverse for import.
//
// Memory: we assemble the final file as an array of Blob parts rather
// than building one giant JS object and JSON.stringify'ing it at the
// end. JSON.stringify on a 200MB object can spike memory to ~1GB and
// hard-crash the tab; Blob[] lets the browser stream pieces to disk
// without ever materialising the whole string. Each per-table
// JSON.stringify call stays bounded by HARD_CAP_PER_TABLE.

import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ImportMode = 'upsert' | 'replace' | 'insert';

interface TableInfo {
  table_name: string;
  estimated_rows: number;
  depends_on?: string[];
}

interface ExportProgress {
  tablesTotal: number;
  tablesDone: number;
  rowsDone: number;
  currentTable: string | null;
}

interface ImportProgress {
  tablesTotal: number;
  tablesDone: number;
  rowsDone: number;
  currentTable: string | null;
}

interface ImportSummary {
  totalInserted: number;
  totalErrors: number;
  tableErrors: number;
  authCreated: number;
  finishedAt: Date;
}

interface ExportBundle {
  generated_at: string;
  schema_version: number;
  source: string;
  auth_users?: Record<string, unknown>[];
  tables: Record<string, Record<string, unknown>[]>;
  // Primary key columns per table — recorded at export time so the
  // import side can pass the right `onConflict` to upsert (especially
  // important for composite keys, which default `id` would miss).
  primary_keys?: Record<string, string[]>;
  // Names of tables each table depends on (FKs into public.*). Used by
  // the import flow to order writes parents-before-children.
  depends_on?: Record<string, string[]>;
  truncated?: Record<string, number>;
  errors?: Record<string, string>;
}

const PAGE_SIZE = 1000; // matches the cap inside admin-data-export
const IMPORT_CHUNK = 500;
// Per-table cap. 200k rows × ~1KB ≈ 200MB worst-case for a single
// table, which is still inside the comfort zone for one JSON.stringify
// call. Anything over this gets recorded in `truncated` so the admin
// knows the export is partial.
const HARD_CAP_PER_TABLE = 200_000;

async function invokeFn<T = unknown>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // Edge functions return {error: '...'} with non-2xx, supabase-js
    // surfaces both — prefer the typed body when present.
    const inner = (data as { error?: string } | null)?.error;
    throw new Error(inner || error.message);
  }
  const innerErr = (data as { error?: string } | null)?.error;
  if (innerErr) throw new Error(innerErr);
  return data as T;
}

// Depth-first topological sort. Tables that are referenced by others
// come out first, so the import writes parents before children. Cycles
// are broken by treating an in-progress visit as already-handled — the
// dependent simply lands wherever its chain bottoms out, which is what
// we'd want anyway since FKs in a cycle can't all be satisfied on the
// first pass.
function topoSort(tables: TableInfo[]): string[] {
  const allNames = new Set(tables.map((t) => t.table_name));
  const adj = new Map<string, string[]>();
  for (const t of tables) {
    adj.set(
      t.table_name,
      (t.depends_on ?? []).filter((d) => allNames.has(d)),
    );
  }
  const result: string[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (name: string): void => {
    if (state.get(name) === 'done' || state.get(name) === 'visiting') return;
    state.set(name, 'visiting');
    for (const dep of adj.get(name) ?? []) visit(dep);
    state.set(name, 'done');
    result.push(name);
  };
  // Sort alphabetically first so ties (independent tables) have a
  // deterministic order in the resulting bundle.
  for (const t of [...tables].sort((a, b) => a.table_name.localeCompare(b.table_name))) {
    visit(t.table_name);
  }
  return result;
}

// Streamy file writer: pushes JSON fragments into a Blob[] as each
// table completes. Never holds the entire serialized bundle as a
// single string.
class BundleWriter {
  private parts: BlobPart[] = [];
  private firstTable = true;
  private primaryKeys: Record<string, string[]> = {};
  private dependsOn: Record<string, string[]> = {};
  private truncated: Record<string, number> = {};
  private errors: Record<string, string> = {};

  constructor(header: { generated_at: string; schema_version: number; source: string }) {
    // Open the object and the `tables` map; everything else is appended
    // at finish() so it lands after the heavy `tables` field.
    this.parts.push(
      `{"generated_at":${JSON.stringify(header.generated_at)},` +
        `"schema_version":${header.schema_version},` +
        `"source":${JSON.stringify(header.source)},` +
        `"tables":{`,
    );
  }

  addTable(name: string, rows: Record<string, unknown>[]): void {
    if (!this.firstTable) this.parts.push(',');
    this.parts.push(JSON.stringify(name) + ':');
    this.parts.push(JSON.stringify(rows));
    this.firstTable = false;
  }

  recordPrimaryKey(name: string, pk: string[]): void {
    if (pk.length > 0) this.primaryKeys[name] = pk;
  }

  recordDependsOn(name: string, deps: string[]): void {
    if (deps.length > 0) this.dependsOn[name] = deps;
  }

  recordTruncated(name: string, atRow: number): void {
    this.truncated[name] = atRow;
  }

  recordError(name: string, message: string): void {
    this.errors[name] = message;
  }

  finish(authUsers?: Record<string, unknown>[]): Blob {
    this.parts.push('}');
    if (authUsers && authUsers.length > 0) {
      this.parts.push(',"auth_users":' + JSON.stringify(authUsers));
    }
    if (Object.keys(this.primaryKeys).length > 0) {
      this.parts.push(',"primary_keys":' + JSON.stringify(this.primaryKeys));
    }
    if (Object.keys(this.dependsOn).length > 0) {
      this.parts.push(',"depends_on":' + JSON.stringify(this.dependsOn));
    }
    if (Object.keys(this.truncated).length > 0) {
      this.parts.push(',"truncated":' + JSON.stringify(this.truncated));
    }
    if (Object.keys(this.errors).length > 0) {
      this.parts.push(',"errors":' + JSON.stringify(this.errors));
    }
    this.parts.push('}');
    return new Blob(this.parts, { type: 'application/json' });
  }
}

function triggerDownload(blob: Blob) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dori-db-export-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Release the blob URL after the click handler has had a chance to run.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function useAdminDataExport() {
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    tablesTotal: 0,
    tablesDone: 0,
    rowsDone: 0,
    currentTable: null,
  });
  const [exportLogs, setExportLogs] = useState<string[]>([]);

  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    tablesTotal: 0,
    tablesDone: 0,
    rowsDone: 0,
    currentTable: null,
  });
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const appendExportLog = (line: string) =>
    setExportLogs(prev => [...prev.slice(-99), line]);
  const appendImportLog = (line: string) =>
    setImportLogs(prev => [...prev.slice(-199), line]);

  const runExport = useCallback(
    async (opts: { includeAuthUsers: boolean }) => {
      setExporting(true);
      setExportLogs([]);
      setExportProgress({ tablesTotal: 0, tablesDone: 0, rowsDone: 0, currentTable: null });

      try {
        appendExportLog('→ Listing tables…');
        const { tables } = await invokeFn<{ tables: TableInfo[] }>('admin-data-export', {
          action: 'list_tables',
        });
        const sorted = [...tables].sort((a, b) => a.table_name.localeCompare(b.table_name));
        setExportProgress(p => ({ ...p, tablesTotal: sorted.length }));
        appendExportLog(`✓ ${sorted.length} tables to export`);

        const writer = new BundleWriter({
          generated_at: new Date().toISOString(),
          schema_version: 1,
          source: 'admin-data-export',
        });

        // Record FK adjacency so the import side can topologically sort
        // without making its own schema-discovery round trip.
        for (const t of sorted) {
          if (t.depends_on && t.depends_on.length > 0) {
            writer.recordDependsOn(t.table_name, t.depends_on);
          }
        }

        for (const t of sorted) {
          setExportProgress(p => ({ ...p, currentTable: t.table_name }));
          appendExportLog(`→ ${t.table_name}…`);
          const collected: Record<string, unknown>[] = [];
          let offset = 0;
          let pkCols: string[] = [];
          let truncated = false;
          let failed: string | null = null;

          while (true) {
            try {
              const res = await invokeFn<{
                rows: Record<string, unknown>[];
                has_more: boolean;
                next_offset: number;
                total: number;
                primary_key: string[];
              }>('admin-data-export', {
                action: 'export_table',
                table: t.table_name,
                offset,
                limit: PAGE_SIZE,
              });
              if (res.primary_key?.length && pkCols.length === 0) {
                pkCols = res.primary_key;
              }
              collected.push(...res.rows);
              setExportProgress(p => ({ ...p, rowsDone: p.rowsDone + res.rows.length }));
              if (!res.has_more) break;
              offset = res.next_offset;
              if (collected.length >= HARD_CAP_PER_TABLE) {
                writer.recordTruncated(t.table_name, collected.length);
                appendExportLog(`~ ${t.table_name} truncated at ${HARD_CAP_PER_TABLE}`);
                truncated = true;
                break;
              }
            } catch (e) {
              failed = (e as Error).message;
              writer.recordError(t.table_name, failed);
              appendExportLog(`! ${t.table_name}: ${failed}`);
              break;
            }
          }

          writer.addTable(t.table_name, collected);
          writer.recordPrimaryKey(t.table_name, pkCols);
          appendExportLog(
            `✓ ${t.table_name}: ${collected.length} rows` +
              (truncated ? ' (truncated)' : '') +
              (failed ? ' (errored)' : ''),
          );
          setExportProgress(p => ({ ...p, tablesDone: p.tablesDone + 1 }));
        }

        let users: Record<string, unknown>[] | undefined;
        if (opts.includeAuthUsers) {
          appendExportLog('→ auth.users…');
          setExportProgress(p => ({ ...p, currentTable: 'auth.users' }));
          users = [];
          let page = 1;
          while (true) {
            try {
              const res = await invokeFn<{
                users: Record<string, unknown>[];
                has_more: boolean;
              }>('admin-data-export', {
                action: 'export_auth_users',
                page,
                per_page: 500,
              });
              users.push(...res.users);
              if (!res.has_more) break;
              page++;
            } catch (e) {
              writer.recordError('auth.users', (e as Error).message);
              appendExportLog(`! auth.users: ${(e as Error).message}`);
              break;
            }
          }
          appendExportLog(`✓ auth.users: ${users.length} users`);
        }

        appendExportLog('→ Building file…');
        const blob = writer.finish(users);
        triggerDownload(blob);
        appendExportLog(`✓ Download triggered (${Math.round(blob.size / 1024).toLocaleString()} KB)`);
      } finally {
        setExporting(false);
        setExportProgress(p => ({ ...p, currentTable: null }));
      }
    },
    [],
  );

  const runImport = useCallback(
    async (
      bundle: ExportBundle,
      opts: { mode: ImportMode },
    ) => {
      if (!bundle || typeof bundle !== 'object' || !bundle.tables) {
        throw new Error('Bundle is missing a `tables` object — is this the right file?');
      }

      setImporting(true);
      setImportLogs([]);
      setImportSummary(null);

      // Order writes parents-before-children using the FK adjacency
      // recorded at export time. Falls back to plain alphabetical when
      // the bundle is from an older export that didn't store this — the
      // server will surface FK errors per-row in that case and the
      // admin can re-run for a second pass.
      const allTables = Object.keys(bundle.tables);
      const tableNames = bundle.depends_on
        ? topoSort(
            allTables.map((name) => ({
              table_name: name,
              estimated_rows: 0,
              depends_on: bundle.depends_on?.[name] ?? [],
            })),
          )
        : [...allTables].sort();
      setImportProgress({
        tablesTotal: tableNames.length,
        tablesDone: 0,
        rowsDone: 0,
        currentTable: null,
      });

      let totalInserted = 0;
      let totalErrors = 0;
      let tableErrors = 0;
      let authCreated = 0;

      try {
        // Auth users first so the FKs from public.* line up. createUser is
        // idempotent in our function (it skips existing ids), so re-running
        // an import is safe.
        if (Array.isArray(bundle.auth_users) && bundle.auth_users.length > 0) {
          appendImportLog(`→ auth.users (${bundle.auth_users.length})…`);
          // chunk to keep the request body under the function ceiling
          for (let i = 0; i < bundle.auth_users.length; i += 100) {
            const chunk = bundle.auth_users.slice(i, i + 100);
            try {
              const res = await invokeFn<{
                created: number;
                skipped: number;
                errors: { id: string; message: string }[];
              }>('admin-data-import', {
                action: 'import_auth_users',
                users: chunk,
              });
              authCreated += res.created;
              if (res.errors.length > 0) {
                totalErrors += res.errors.length;
                for (const err of res.errors.slice(0, 5)) {
                  appendImportLog(`! auth.users ${err.id}: ${err.message}`);
                }
              }
            } catch (e) {
              appendImportLog(`! auth.users chunk failed: ${(e as Error).message}`);
            }
          }
          appendImportLog(`✓ auth.users: ${authCreated} created`);
        }

        for (const tableName of tableNames) {
          const rows = bundle.tables[tableName] || [];
          setImportProgress(p => ({ ...p, currentTable: tableName }));
          if (rows.length === 0) {
            appendImportLog(`· ${tableName}: empty, skipped`);
            setImportProgress(p => ({ ...p, tablesDone: p.tablesDone + 1 }));
            continue;
          }
          appendImportLog(`→ ${tableName} (${rows.length})…`);

          if (opts.mode === 'replace') {
            try {
              await invokeFn('admin-data-import', { action: 'wipe_table', table: tableName });
              appendImportLog(`~ wiped ${tableName}`);
            } catch (e) {
              appendImportLog(`! wipe failed for ${tableName}: ${(e as Error).message}`);
              tableErrors++;
              setImportProgress(p => ({ ...p, tablesDone: p.tablesDone + 1 }));
              continue;
            }
          }

          // Replace mode wipes first then inserts; otherwise we upsert (or
          // plain insert in 'insert' mode).
          const writeMode = opts.mode === 'insert' ? 'insert' : opts.mode === 'replace' ? 'insert' : 'upsert';
          // Pass the primary key columns from the bundle so upsert
          // resolves the right conflict target — especially critical for
          // tables with composite keys, where the server-side default of
          // `id` would silently fail or insert duplicates.
          const pk = bundle.primary_keys?.[tableName];
          const onConflict = pk && pk.length > 0 ? pk.join(',') : undefined;

          let inserted = 0;
          let errs = 0;
          for (let i = 0; i < rows.length; i += IMPORT_CHUNK) {
            const chunk = rows.slice(i, i + IMPORT_CHUNK);
            try {
              const res = await invokeFn<{
                inserted: number;
                errors: { index: number; message: string }[];
              }>('admin-data-import', {
                action: 'import_table',
                table: tableName,
                rows: chunk,
                mode: writeMode,
                on_conflict: onConflict,
              });
              inserted += res.inserted;
              if (res.errors.length > 0) {
                errs += res.errors.length;
                // Surface first couple of errors only — full list would
                // flood the UI on a bundle from a wildly different schema.
                for (const err of res.errors.slice(0, 3)) {
                  appendImportLog(`! ${tableName}[${i + err.index}]: ${err.message}`);
                }
              }
              setImportProgress(p => ({ ...p, rowsDone: p.rowsDone + chunk.length }));
            } catch (e) {
              const msg = (e as Error).message;
              appendImportLog(`! ${tableName}: ${msg}`);
              errs += chunk.length;
            }
          }
          if (errs > 0 && inserted === 0) tableErrors++;
          totalInserted += inserted;
          totalErrors += errs;
          appendImportLog(`✓ ${tableName}: ${inserted}/${rows.length} rows${errs ? ` (${errs} errors)` : ''}`);
          setImportProgress(p => ({ ...p, tablesDone: p.tablesDone + 1 }));
        }

        setImportSummary({
          totalInserted,
          totalErrors,
          tableErrors,
          authCreated,
          finishedAt: new Date(),
        });
      } finally {
        setImporting(false);
        setImportProgress(p => ({ ...p, currentTable: null }));
      }
    },
    [],
  );

  return {
    exporting,
    exportProgress,
    exportLogs,
    runExport,
    importing,
    importProgress,
    importLogs,
    importSummary,
    runImport,
  };
}
