import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Plus,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { usePlaidLink, type BankConnection, type FinanceAccount } from "@/hooks/useFinanceSummary";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface BankConnectionsCardProps {
  connections: BankConnection[];
  accounts: FinanceAccount[];
  syncing: boolean;
  onSyncOne: (id: string) => Promise<unknown>;
  onDisconnect: (id: string) => Promise<unknown>;
}

// "Connected banks" card. The Plaid Link UI itself isn't bundled
// here (operator wires `react-plaid-link` to consume the link_token);
// the dialog supports both "let me drop in the public_token I got
// from the sandbox flow" and "give me the link_token to copy into
// my own integration".
export function BankConnectionsCard({
  connections,
  accounts,
  syncing,
  onSyncOne,
  onDisconnect,
}: BankConnectionsCardProps) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Connected banks
          </h2>
          <p className="text-xs text-muted-foreground">
            Link a bank via Plaid to auto-sync transactions and balances.
          </p>
        </div>
        <ConnectDialog />
      </div>

      {connections.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4 text-center">
          No banks linked yet.
        </p>
      ) : (
        <div className="space-y-2">
          {connections.map((c) => {
            const linkedAccounts = accounts.filter((a) => a.bank_connection_id === c.id);
            return (
              <div key={c.id} className="rounded-md border border-border bg-card/40 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">
                        {c.institution_name || "Linked bank"}
                      </p>
                      <StatusPill status={c.status} />
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {c.provider}
                      </span>
                    </div>
                    {c.last_synced_at && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Synced{" "}
                        {formatDistanceToNow(new Date(c.last_synced_at), { addSuffix: true })}
                      </p>
                    )}
                    {c.last_error && (
                      <p className="text-[10px] text-destructive mt-0.5 line-clamp-2">
                        <AlertTriangle className="w-3 h-3 inline mr-1" />
                        {c.last_error}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => onSyncOne(c.id)}
                      disabled={syncing}
                    >
                      <RefreshCw className={syncing ? "w-3 h-3 animate-spin" : "w-3 h-3"} />
                      Sync
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => onDisconnect(c.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {linkedAccounts.length > 0 && (
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    {linkedAccounts.map((a) => (
                      <div key={a.id} className="flex items-center gap-1.5">
                        <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                        <span className="truncate">
                          {a.name}
                          {a.mask && <span className="text-muted-foreground/60"> ··{a.mask}</span>}
                        </span>
                        <span className="ml-auto font-mono">
                          {a.current_balance != null ? Number(a.current_balance).toFixed(2) : "—"}{" "}
                          {a.currency || ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function StatusPill({ status }: { status: BankConnection["status"] }) {
  const meta = {
    good: { label: "OK", tone: "bg-emerald-500/15 text-emerald-600", Icon: CheckCircle2 },
    reauth_required: {
      label: "Reauth needed",
      tone: "bg-amber-500/15 text-amber-600",
      Icon: AlertTriangle,
    },
    error: { label: "Error", tone: "bg-destructive/15 text-destructive", Icon: AlertTriangle },
    disabled: { label: "Disabled", tone: "bg-muted text-muted-foreground", Icon: AlertTriangle },
  } as const;
  const m = meta[status] ?? meta.error;
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase inline-flex items-center gap-1 ${m.tone}`}
    >
      <m.Icon className="w-3 h-3" />
      {m.label}
    </span>
  );
}

// Two flows in one dialog:
//   1. "Get a Plaid link_token" — returns the token + lets the user
//      copy it into their own Plaid Link client. Keeps this UI self-
//      contained without bundling the SDK.
//   2. "Paste a public_token" — for the Plaid sandbox flow where the
//      operator opens Plaid Link from another tool and pastes the
//      callback token here.
//
// Once `react-plaid-link` is wired in, the operator can replace the
// copy-token UX with a real button that opens Plaid Link inline.
function ConnectDialog() {
  const [open, setOpen] = useState(false);
  const { createToken, exchange, busy } = usePlaidLink();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [country, setCountry] = useState("US");
  const [publicToken, setPublicToken] = useState("");
  const [institutionName, setInstitutionName] = useState("");

  const reset = () => {
    setLinkToken(null);
    setPublicToken("");
    setInstitutionName("");
    setCountry("US");
  };

  const handleCreate = async () => {
    const codes = country
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const t = await createToken(codes.length ? codes : ["US"]);
    if (t) setLinkToken(t.link_token);
  };

  const handleExchange = async () => {
    if (!publicToken.trim()) return;
    const ok = await exchange(publicToken.trim(), {
      name: institutionName.trim() || undefined,
    });
    if (ok) {
      setOpen(false);
      reset();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Connect bank
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect a bank via Plaid</DialogTitle>
          <DialogDescription>
            Step 1 — get a link token. Step 2 — open Plaid Link with that token and paste the
            resulting public_token below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="country">Country codes (comma-separated)</Label>
            <Input
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
              placeholder="US, GB, DE"
            />
          </div>
          {!linkToken ? (
            <Button onClick={handleCreate} disabled={busy} className="w-full">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate link_token"}
            </Button>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">link_token</Label>
              <div className="flex items-center gap-2">
                <Input value={linkToken} readOnly className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(linkToken);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="border-t border-border pt-3 space-y-2">
            <Label className="text-xs">
              Once you've completed Plaid Link, paste the public_token:
            </Label>
            <Input
              value={publicToken}
              onChange={(e) => setPublicToken(e.target.value)}
              placeholder="public-sandbox-…"
              className="font-mono text-xs"
            />
            <Input
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              placeholder="Institution name (optional)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleExchange} disabled={busy || !publicToken.trim()}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Link account"}
          </Button>
        </DialogFooter>
        <Badge variant="outline" className="text-[10px] mx-auto">
          Once react-plaid-link is wired in, this becomes a single click.
        </Badge>
      </DialogContent>
    </Dialog>
  );
}
