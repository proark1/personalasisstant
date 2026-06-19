import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Brain,
  Trash2,
  Users,
  MapPin,
  Briefcase,
  Building2,
  Tag,
  Package,
  Calendar,
  History,
  Sparkles,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useKnowledgeGraph, type KgEntity, type KgEntityKind } from "@/hooks/useKnowledgeGraph";
import { useMemoryAudit, type MemoryAuditItem } from "@/hooks/useMemoryAudit";
import { AIUsageCard } from "./AIUsageCard";
import { cn } from "@/lib/utils";

// "Memory & Privacy" view — three tabs:
//   1. Entities       — knowledge graph (people, projects, places…),
//                       mention counts, deep / shallow forget actions.
//   2. Items          — every memory row the assistant holds, with
//                       per-row forget. Filter by source kind.
//   3. Forget log     — audit trail of every prior forget action.

const KIND_META: Record<KgEntityKind, { label: string; icon: typeof Users; tone: string }> = {
  person: { label: "People", icon: Users, tone: "text-sky-500" },
  project: { label: "Projects", icon: Briefcase, tone: "text-violet-500" },
  place: { label: "Places", icon: MapPin, tone: "text-emerald-500" },
  organization: { label: "Organizations", icon: Building2, tone: "text-amber-500" },
  topic: { label: "Topics", icon: Tag, tone: "text-pink-500" },
  product: { label: "Products", icon: Package, tone: "text-cyan-500" },
  event: { label: "Events", icon: Calendar, tone: "text-rose-500" },
};

const SOURCE_LABEL: Record<string, string> = {
  semantic: "Semantic recall",
  episodic: "Life events",
  ai_memory: "Saved facts",
};

export function MemoryDashboard() {
  const kg = useKnowledgeGraph({ limit: 100 });
  const audit = useMemoryAudit({ limit: 100 });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Memory & Privacy
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Everything the assistant remembers about you. Browse, audit, or forget.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            kg.refresh();
            audit.refresh();
          }}
          className="gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      <AIUsageCard />

      <Tabs defaultValue="entities" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="entities" className="gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            Entities
          </TabsTrigger>
          <TabsTrigger value="items" className="gap-2">
            <Brain className="w-3.5 h-3.5" />
            Items
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <History className="w-3.5 h-3.5" />
            Forget log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entities" className="mt-3">
          <EntitiesPanel kg={kg} />
        </TabsContent>

        <TabsContent value="items" className="mt-3">
          <ItemsPanel audit={audit} />
        </TabsContent>

        <TabsContent value="audit" className="mt-3">
          <AuditPanel redactions={audit.redactions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Entities tab ----------

function EntitiesPanel({ kg }: { kg: ReturnType<typeof useKnowledgeGraph> }) {
  const [confirm, setConfirm] = useState<{ entity: KgEntity; deep: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  if (kg.loading && kg.entities.length === 0) {
    return <LoadingShell />;
  }
  if (!kg.entities.length) {
    return (
      <EmptyState
        title="No entities yet"
        description="As you chat and save notes, the assistant will surface people, projects, places, and topics here."
      />
    );
  }

  // Group by kind for a clean visual.
  const groups: Record<KgEntityKind, KgEntity[]> = {
    person: [],
    project: [],
    place: [],
    organization: [],
    topic: [],
    product: [],
    event: [],
  };
  for (const e of kg.entities) {
    if (groups[e.kind]) groups[e.kind].push(e);
  }

  return (
    <ScrollArea className="h-[55vh]">
      <div className="space-y-4 pr-3">
        {(Object.keys(groups) as KgEntityKind[])
          .filter((k) => groups[k].length > 0)
          .map((k) => {
            const meta = KIND_META[k];
            const Icon = meta.icon;
            return (
              <section key={k}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={cn("w-4 h-4", meta.tone)} />
                  <h3 className="text-sm font-medium">{meta.label}</h3>
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {groups[k].length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {groups[k].map((e) => (
                    <EntityRow
                      key={e.id}
                      entity={e}
                      onForget={(deep) => setConfirm({ entity: e, deep })}
                    />
                  ))}
                </div>
              </section>
            );
          })}
      </div>

      <AlertDialog
        open={!!confirm}
        onOpenChange={(o) => {
          if (!o) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.deep ? "Forget everything about this entity?" : "Forget this entity?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.deep ? (
                <>
                  This deletes <strong>{confirm.entity.name}</strong> and every memory item that
                  mentions it ({confirm.entity.mentionCount} item
                  {confirm.entity.mentionCount === 1 ? "" : "s"}). This can't be undone.
                </>
              ) : (
                <>
                  This removes the link to <strong>{confirm?.entity.name}</strong> but keeps the
                  underlying memory items intact. You can re-discover the entity later by chatting
                  about it.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async (e) => {
                e.preventDefault();
                if (!confirm) return;
                setBusy(true);
                try {
                  if (confirm.deep) {
                    await kg.forgetEntityDeep(confirm.entity.id);
                  } else {
                    await kg.forgetEntityShallow(confirm.entity.id);
                  }
                } finally {
                  setBusy(false);
                  setConfirm(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Forget"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  );
}

function EntityRow({ entity, onForget }: { entity: KgEntity; onForget: (deep: boolean) => void }) {
  const last = entity.lastMentionedAt
    ? formatDistanceToNow(new Date(entity.lastMentionedAt), { addSuffix: true })
    : "never";
  return (
    <Card className="p-3 flex items-start justify-between gap-3 bg-card/60">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{entity.name}</span>
          <Badge variant="outline" className="text-[10px] uppercase">
            {entity.kind}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {entity.mentionCount} mention{entity.mentionCount === 1 ? "" : "s"} · last {last}
          </span>
        </div>
        {entity.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entity.description}</p>
        )}
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[11px] px-2"
          onClick={() => onForget(false)}
        >
          Unlink
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[11px] px-2 text-destructive hover:text-destructive"
          onClick={() => onForget(true)}
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Forget all
        </Button>
      </div>
    </Card>
  );
}

// ---------- Items tab ----------

function ItemsPanel({ audit }: { audit: ReturnType<typeof useMemoryAudit> }) {
  const [confirm, setConfirm] = useState<MemoryAuditItem | null>(null);
  const [busy, setBusy] = useState(false);

  if (audit.loading && audit.items.length === 0) {
    return <LoadingShell />;
  }
  if (!audit.items.length) {
    return (
      <EmptyState
        title="No memory items yet"
        description="Saved facts, recalled notes, and life events will appear here."
      />
    );
  }
  return (
    <ScrollArea className="h-[55vh]">
      <div className="space-y-2 pr-3">
        {audit.items.map((item) => (
          <ItemRow
            key={`${item.sourceKind}:${item.sourceId}`}
            item={item}
            onForget={() => setConfirm(item)}
          />
        ))}
      </div>

      <AlertDialog
        open={!!confirm}
        onOpenChange={(o) => {
          if (!o) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forget this memory item?</AlertDialogTitle>
            <AlertDialogDescription>
              The assistant will permanently lose this{" "}
              {SOURCE_LABEL[confirm?.sourceKind ?? ""] ?? "item"}. Linked entities are kept; only
              this row is removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async (e) => {
                e.preventDefault();
                if (!confirm) return;
                setBusy(true);
                try {
                  await audit.forgetItem(confirm);
                } finally {
                  setBusy(false);
                  setConfirm(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Forget"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  );
}

function ItemRow({ item, onForget }: { item: MemoryAuditItem; onForget: () => void }) {
  const when = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });
  return (
    <Card className="p-3 flex items-start justify-between gap-3 bg-card/60">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-[10px] uppercase">
            {SOURCE_LABEL[item.sourceKind] ?? item.sourceKind}
          </Badge>
          {item.subKind && (
            <Badge variant="outline" className="text-[10px]">
              {item.subKind}
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">{when}</span>
        </div>
        {item.title && <p className="font-medium text-sm mt-1 truncate">{item.title}</p>}
        {item.content && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{item.content}</p>
        )}
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-[11px] px-2 text-destructive hover:text-destructive shrink-0"
        onClick={onForget}
      >
        <Trash2 className="w-3 h-3 mr-1" />
        Forget
      </Button>
    </Card>
  );
}

// ---------- Audit tab ----------

function AuditPanel({
  redactions,
}: {
  redactions: ReturnType<typeof useMemoryAudit>["redactions"];
}) {
  if (!redactions.length) {
    return (
      <EmptyState
        title="No forget actions yet"
        description="When you ask the assistant to forget something, it'll appear here as an audit trail."
      />
    );
  }
  return (
    <ScrollArea className="h-[55vh]">
      <div className="space-y-2 pr-3">
        {redactions.map((r) => (
          <Card key={r.id} className="p-3 bg-card/60">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px] uppercase">
                {r.targetKind}
              </Badge>
              <span className="text-xs">
                {r.cascadedCount} item{r.cascadedCount === 1 ? "" : "s"}
              </span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
              </span>
            </div>
            {r.reason && <p className="text-xs text-muted-foreground mt-1 italic">"{r.reason}"</p>}
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

// ---------- Shared bits ----------

function LoadingShell() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-center py-10 px-4">
      <Brain className="w-8 h-8 mx-auto text-muted-foreground/50 mb-3" />
      <p className="font-medium text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">{description}</p>
    </div>
  );
}
