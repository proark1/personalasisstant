// Admin: dump the whole database to a JSON file (or load one back in).
// Built so the admin can migrate off Supabase without losing data —
// pure JSON, no provider-specific format. The actual heavy lifting lives
// in the `useAdminDataExport` hook; this component is just the UI shell.

import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Download,
  Upload,
  Database,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileJson,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminDataExport, type ImportMode } from "@/hooks/useAdminDataExport";
import { formatDistanceToNow } from "date-fns";

export function AdminDataExportImport() {
  const {
    exporting,
    exportProgress,
    exportLogs,
    runExport,
    importing,
    importProgress,
    importLogs,
    importSummary,
    runImport,
  } = useAdminDataExport();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [includeAuthUsers, setIncludeAuthUsers] = useState(true);
  const [importMode, setImportMode] = useState<ImportMode>("upsert");

  const handleExport = async () => {
    try {
      await runExport({ includeAuthUsers });
      toast.success("Export complete");
    } catch (e) {
      toast.error("Export failed: " + (e as Error).message);
    }
  };

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setConfirmOpen(true);
    // reset the input so picking the same file twice still fires onChange
    e.target.value = "";
  };

  const handleConfirmImport = async () => {
    if (!pendingFile) return;
    setConfirmOpen(false);
    try {
      const text = await pendingFile.text();
      const bundle = JSON.parse(text);
      await runImport(bundle, { mode: importMode });
      toast.success("Import complete");
    } catch (e) {
      toast.error("Import failed: " + (e as Error).message);
    } finally {
      setPendingFile(null);
    }
  };

  const busy = exporting || importing;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Database className="h-6 w-6 text-primary mt-1" />
        <div>
          <h2 className="text-lg font-semibold">Database Export &amp; Import</h2>
          <p className="text-sm text-muted-foreground">
            Download a full JSON snapshot of every <code className="text-xs">public.*</code> table
            (and optionally auth users), or restore from a previous snapshot. Admin only — runs with
            the service role on the server.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4" />
              Export
            </CardTitle>
            <CardDescription>
              Paginates every table on the server and assembles one JSON file in your browser.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-border/50 p-3">
              <div className="space-y-0.5">
                <Label htmlFor="include-auth" className="text-sm">
                  Include auth.users
                </Label>
                <p className="text-xs text-muted-foreground">
                  Email / metadata only — never passwords.
                </p>
              </div>
              <Switch
                id="include-auth"
                checked={includeAuthUsers}
                onCheckedChange={setIncludeAuthUsers}
                disabled={busy}
              />
            </div>

            <Button onClick={handleExport} disabled={busy} className="w-full" size="lg">
              <Download className="h-4 w-4 mr-2" />
              {exporting ? "Exporting…" : "Export everything"}
            </Button>

            {exporting && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{exportProgress.currentTable || "Starting…"}</span>
                  <span>
                    {exportProgress.tablesDone} / {exportProgress.tablesTotal} tables ·{" "}
                    {exportProgress.rowsDone.toLocaleString()} rows
                  </span>
                </div>
                <Progress
                  value={
                    exportProgress.tablesTotal
                      ? (exportProgress.tablesDone / exportProgress.tablesTotal) * 100
                      : 0
                  }
                />
              </div>
            )}

            {exportLogs.length > 0 && (
              <ScrollArea className="h-40 rounded-md border border-border/50 p-2">
                <ul className="space-y-1 text-xs font-mono">
                  {exportLogs.map((line, i) => (
                    <li key={i} className="text-muted-foreground">
                      {line}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4" />
              Import
            </CardTitle>
            <CardDescription>
              Upload a JSON bundle produced by Export. Rows are written in chunks via the service
              role.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-border/50 p-3 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Mode</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={importMode === "upsert" ? "default" : "outline"}
                    onClick={() => setImportMode("upsert")}
                    disabled={busy}
                  >
                    Upsert
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={importMode === "replace" ? "default" : "outline"}
                    onClick={() => setImportMode("replace")}
                    disabled={busy}
                  >
                    Replace
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={importMode === "insert" ? "default" : "outline"}
                    onClick={() => setImportMode("insert")}
                    disabled={busy}
                  >
                    Insert
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {importMode === "upsert" &&
                    "Merge by primary key — existing rows updated, new ones inserted."}
                  {importMode === "replace" && "Wipe each table first, then insert. Destructive."}
                  {importMode === "insert" && "Plain insert — skips rows that already exist."}
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              onClick={handlePickFile}
              disabled={busy}
              className="w-full"
              size="lg"
              variant="outline"
            >
              <FileJson className="h-4 w-4 mr-2" />
              {importing ? "Importing…" : "Choose JSON bundle"}
            </Button>

            {importing && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{importProgress.currentTable || "Starting…"}</span>
                  <span>
                    {importProgress.tablesDone} / {importProgress.tablesTotal} tables ·{" "}
                    {importProgress.rowsDone.toLocaleString()} rows
                  </span>
                </div>
                <Progress
                  value={
                    importProgress.tablesTotal
                      ? (importProgress.tablesDone / importProgress.tablesTotal) * 100
                      : 0
                  }
                />
              </div>
            )}

            {importSummary && (
              <div className="rounded-md border border-border/50 p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Imported {importSummary.totalInserted.toLocaleString()} rows
                  {importSummary.authCreated > 0 && (
                    <span className="text-muted-foreground">
                      · {importSummary.authCreated} auth users created
                    </span>
                  )}
                </div>
                {importSummary.totalErrors > 0 && (
                  <div className="flex items-center gap-2 text-amber-500">
                    <AlertTriangle className="h-4 w-4" />
                    {importSummary.totalErrors} row error
                    {importSummary.totalErrors === 1 ? "" : "s"} — see log
                  </div>
                )}
                {importSummary.tableErrors > 0 && (
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-4 w-4" />
                    {importSummary.tableErrors} table{importSummary.tableErrors === 1 ? "" : "s"}{" "}
                    skipped
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Finished {formatDistanceToNow(importSummary.finishedAt, { addSuffix: true })}
                </p>
              </div>
            )}

            {importLogs.length > 0 && (
              <ScrollArea className="h-40 rounded-md border border-border/50 p-2">
                <ul className="space-y-1 text-xs font-mono">
                  {importLogs.map((line, i) => (
                    <li
                      key={i}
                      className={
                        line.startsWith("!")
                          ? "text-destructive"
                          : line.startsWith("~")
                            ? "text-amber-500"
                            : "text-muted-foreground"
                      }
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Safety notes */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm space-y-2">
            <p>
              <strong>Heads up.</strong> The export downloads <em>everything</em> in the public
              schema. Treat the file like a password — it contains personal data for every user.
            </p>
            <p className="text-xs text-muted-foreground">
              First time?{" "}
              <code className="text-xs">
                supabase functions deploy admin-data-export admin-data-import
              </code>{" "}
              and apply the latest migration. Without those, the buttons above will report the edge
              function as unreachable.
            </p>
            <Separator className="bg-amber-500/20" />
            <ul className="space-y-1 text-muted-foreground text-xs list-disc list-inside">
              <li>
                <Badge variant="outline" className="mr-1">
                  Upsert
                </Badge>
                safest default; existing rows update in place by primary key.
              </li>
              <li>
                <Badge variant="outline" className="mr-1">
                  Replace
                </Badge>
                wipes each target table before writing. Use only on an empty / staging database.
              </li>
              <li>
                <Badge variant="outline" className="mr-1">
                  Insert
                </Badge>
                fails fast on duplicates — useful for catching schema drift.
              </li>
              <li>Auth users keep their original UUIDs so foreign keys line up after restore.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import {pendingFile?.name ?? "bundle"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Mode: <strong>{importMode}</strong>.
              {importMode === "replace" && (
                <span className="block mt-2 text-destructive">
                  Every table in the bundle will be wiped before insert. This cannot be undone.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingFile(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImport}>
              {importMode === "replace" ? "Wipe &amp; import" : "Run import"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
