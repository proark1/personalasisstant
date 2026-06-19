import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { describeEdgeError } from "@/lib/edgeError";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Receipt, Plus, X, AlertCircle } from "lucide-react";
import { ContractCategory, CostFrequency } from "@/hooks/useContracts";

export interface DetectedPayment {
  name: string;
  provider: string;
  amount: number;
  frequency: CostFrequency;
  category: ContractCategory;
  emailCount: number;
  confidence: "high" | "medium" | "low";
}

interface RecurringPaymentDetectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddAsContract: (payment: DetectedPayment) => void;
}

export function RecurringPaymentDetector({
  open,
  onOpenChange,
  onAddAsContract,
}: RecurringPaymentDetectorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<DetectedPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const detectPayments = async () => {
    if (!user) return;
    setLoading(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase.functions.invoke("detect-recurring-payments", {});

      if (error) {
        toast({
          variant: "destructive",
          title: "Detection failed",
          description: await describeEdgeError(error, "Detection failed"),
        });
        return;
      }

      const result = data as { payments?: DetectedPayment[]; error?: string };
      if (result.error) {
        toast({ variant: "destructive", title: "Detection failed", description: result.error });
        return;
      }

      setPayments(result.payments || []);
      if ((result.payments || []).length === 0) {
        toast({
          title: "No new recurring payments found",
          description: "All detected payments are already in your contracts.",
        });
      }
    } catch (err) {
      console.error("Detection error:", err);
      toast({ variant: "destructive", title: "Error", description: "Could not analyze emails." });
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (name: string) => {
    setDismissed((prev) => new Set([...prev, name]));
  };

  const visiblePayments = payments.filter((p) => !dismissed.has(p.name));

  const confidenceColor = (c: string) => {
    switch (c) {
      case "high":
        return "bg-emerald-500/10 text-emerald-700 border-emerald-200";
      case "medium":
        return "bg-amber-500/10 text-amber-700 border-amber-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const categoryEmoji: Record<string, string> = {
    insurance: "🛡️",
    utilities: "⚡",
    subscription: "📦",
    phone: "📱",
    internet: "🌐",
    streaming: "🎬",
    other: "📄",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Find Recurring Payments
          </DialogTitle>
          <DialogDescription>
            Scan your emails to detect subscriptions and recurring charges, then add them as
            contracts.
          </DialogDescription>
        </DialogHeader>

        {!hasSearched ? (
          <div className="flex flex-col items-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Receipt className="w-8 h-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              We'll analyze your recent emails to find recurring payment patterns like
              subscriptions, bills, and invoices.
            </p>
            <Button onClick={detectPayments} disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Receipt className="w-4 h-4" />
              )}
              Scan Emails
            </Button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center py-12 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing your emails...</p>
            <p className="text-xs text-muted-foreground">This may take a moment</p>
          </div>
        ) : visiblePayments.length === 0 ? (
          <div className="flex flex-col items-center py-8 space-y-3">
            <AlertCircle className="w-10 h-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No new recurring payments detected.</p>
            <Button variant="outline" size="sm" onClick={detectPayments}>
              Scan Again
            </Button>
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-4 px-4">
            <div className="space-y-3 pb-4">
              <p className="text-xs text-muted-foreground">
                Found {visiblePayments.length} potential recurring payment
                {visiblePayments.length !== 1 ? "s" : ""}
              </p>
              {visiblePayments.map((payment, idx) => (
                <div key={`${payment.name}-${idx}`} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{categoryEmoji[payment.category] || "📄"}</span>
                        <h4 className="font-medium text-sm truncate">{payment.name}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {payment.provider}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDismiss(payment.name)}
                      className="text-muted-foreground hover:text-foreground p-1 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {payment.amount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        €{payment.amount.toFixed(2)} /{" "}
                        {payment.frequency === "monthly"
                          ? "mo"
                          : payment.frequency === "quarterly"
                            ? "qtr"
                            : "yr"}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs capitalize">
                      {payment.category}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-xs ${confidenceColor(payment.confidence)}`}
                    >
                      {payment.confidence} confidence
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {payment.emailCount} email{payment.emailCount !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5 mt-1"
                    onClick={() => {
                      onAddAsContract(payment);
                      handleDismiss(payment.name);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add as Contract
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
