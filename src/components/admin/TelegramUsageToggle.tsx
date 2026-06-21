import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Coins } from "lucide-react";

// Admin toggle for the per-reply token/cost footer on Telegram answers.
// Backed by the global app_settings table (key: telegram_token_usage_enabled).
const KEY = "telegram_token_usage_enabled";

// app_settings isn't in the generated Supabase types yet, so we talk to it
// through an untyped client handle.
// deno-lint-ignore no-explicit-any
const db = supabase as any;

export function TelegramUsageToggle() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await db
          .from("app_settings")
          .select("value")
          .eq("key", KEY)
          .maybeSingle();
        if (data) setEnabled(data.value === true || data.value === "true");
      } catch {
        // default on
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onToggle = async (next: boolean) => {
    const prev = enabled;
    setEnabled(next);
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await db.from("app_settings").upsert(
        {
          key: KEY,
          value: next,
          updated_at: new Date().toISOString(),
          updated_by: auth?.user?.id ?? null,
        },
        { onConflict: "key" },
      );
      if (error) throw error;
      toast.success(`Token usage footer ${next ? "enabled" : "disabled"}`);
    } catch {
      setEnabled(prev);
      toast.error("Couldn't update setting (admins only)");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-card/50">
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Coins className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
          <div>
            <Label htmlFor="tg-usage" className="text-sm font-medium">
              Show token usage &amp; cost on Telegram replies
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Appends total tokens (input + output) and an estimated cost to every Telegram answer.
            </p>
          </div>
        </div>
        <Switch
          id="tg-usage"
          checked={enabled}
          disabled={loading || saving}
          onCheckedChange={onToggle}
        />
      </CardContent>
    </Card>
  );
}
