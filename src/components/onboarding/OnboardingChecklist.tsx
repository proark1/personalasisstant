import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronRight, Sparkles, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { describeEdgeError } from "@/lib/edgeError";
import { toast } from "sonner";

// Dashboard-level "first 5 minutes" checklist. Appears on first load for
// users who haven't dismissed it yet; each item is a one-tap shortcut to
// the highest-leverage setup step. Dismissing flips a flag on
// proactive_settings so we never nag again.
export function OnboardingChecklist() {
  const { user, profile } = useAuth();
  const { workspaces } = useWorkspace();

  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null);
  const [calendarLinked, setCalendarLinked] = useState<boolean | null>(null);
  const [topOfMind, setTopOfMind] = useState<string[]>(["", "", ""]);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      // Baseline state of everything we want to surface as checklist items.
      const [settingsRes, tgRes, calRes] = await Promise.all([
        supabase
          .from("proactive_settings")
          .select("onboarding_checklist_dismissed")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("telegram_links")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("external_calendar_connections")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle(),
      ]);
      if (!alive) return;
      setDismissed(!!settingsRes.data?.onboarding_checklist_dismissed);
      setTelegramLinked(!!tgRes.data);
      setCalendarLinked(!!calRes.data);
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const hasDisplayName = !!(profile?.display_name && profile.display_name.trim());
  const hasWorkspace = workspaces.length > 0;
  const hasStarterTasks = useMemo(() => topOfMind.some((t) => t.trim().length > 0), [topOfMind]);

  const steps = [
    { key: "profile", label: "Set your display name", done: hasDisplayName, href: "/settings" },
    {
      key: "telegram",
      label: "Link Telegram so Dori can reach you",
      done: !!telegramLinked,
      href: "/settings",
    },
    { key: "calendar", label: "Connect your calendar", done: !!calendarLinked, href: "/settings" },
    {
      key: "workspace",
      label: "Create or join a workspace",
      done: hasWorkspace,
      href: "/workspaces",
    },
  ];
  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  async function dismiss() {
    if (!user?.id) return;
    const { error } = await supabase.from("proactive_settings").upsert(
      {
        user_id: user.id,
        onboarding_checklist_dismissed: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) {
      // Don't hide it if we failed to persist — otherwise it comes back
      // on next refresh and the user feels the dismiss never worked.
      console.error("dismiss checklist failed", error);
      toast.error("Could not save preference. Try again.");
      return;
    }
    setDismissed(true);
  }

  async function seedTasks() {
    if (!user?.id) return;
    const cleaned = topOfMind
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 3);
    if (cleaned.length === 0) return;
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke("dori-onboarding-seed", {
        body: {
          top_of_mind: cleaned,
          timezone:
            typeof Intl !== "undefined"
              ? Intl.DateTimeFormat().resolvedOptions().timeZone
              : undefined,
        },
      });
      if (error) throw error;
      toast.success(
        `Added ${(data as { created_tasks?: number } | null)?.created_tasks ?? cleaned.length} starter tasks`,
      );
      setTopOfMind(["", "", ""]);
    } catch (e) {
      console.error("seedTasks failed", e);
      toast.error(await describeEdgeError(e, "Could not add tasks"));
    } finally {
      setSeeding(false);
    }
  }

  // Don't render anything while loading or after dismissal — no flash.
  if (dismissed !== false) return null;

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-primary" />
              Getting started
              <span className="text-xs text-muted-foreground font-normal">
                ({completedCount}/{steps.length})
              </span>
            </CardTitle>
            <CardDescription>5 minutes of setup. Dori gets way more useful.</CardDescription>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={dismiss} title="Dismiss">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          {steps.map((s) => (
            <Link
              to={s.href}
              key={s.key}
              className={`flex items-center gap-3 px-2 py-1.5 rounded-md transition-colors ${s.done ? "opacity-60" : "hover:bg-accent/60"}`}
            >
              <span
                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${s.done ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"}`}
              >
                {s.done ? <Check className="w-3 h-3" /> : null}
              </span>
              <span className={`flex-1 text-sm ${s.done ? "line-through" : ""}`}>{s.label}</span>
              <ChevronRight className="w-4 h-4 opacity-40" />
            </Link>
          ))}
        </div>

        {!allDone && (
          <div className="rounded-md border border-border bg-background/60 p-3 space-y-2">
            <div className="text-sm font-medium">What's on your mind today? (up to 3)</div>
            <div className="space-y-1.5">
              {topOfMind.map((v, i) => (
                <Input
                  key={i}
                  placeholder={
                    i === 0
                      ? "e.g. Draft the investor update"
                      : i === 1
                        ? "e.g. Follow up with Sarah"
                        : "e.g. Book a dentist"
                  }
                  value={v}
                  onChange={(e) =>
                    setTopOfMind((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))
                  }
                  className="h-8 text-sm"
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={!hasStarterTasks || seeding} onClick={seedTasks}>
                {seeding ? "Adding…" : "Add as tasks"}
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Skip for now
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
