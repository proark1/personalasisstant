import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { describeEdgeError } from "@/lib/edgeError";
import { ContractCategory, CostFrequency } from "./useContracts";
import { useToast } from "./use-toast";

interface ExtractedContractData {
  name?: string;
  provider?: string;
  category?: ContractCategory;
  costAmount?: number;
  costFrequency?: CostFrequency;
  startDate?: string;
  endDate?: string;
  renewalDate?: string;
  cancellationNoticeDays?: number;
  autoRenews?: boolean;
  contractNumber?: string;
  notes?: string;
}

interface CancellationTemplates {
  formalLetter: string;
  emailVersion: string;
  briefVersion: string;
}

export function useContractAI() {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);

  const scanDocument = useCallback(
    async (documentPath: string, documentType?: string): Promise<ExtractedContractData | null> => {
      setIsScanning(true);
      try {
        const { data, error } = await supabase.functions.invoke("scan-contract", {
          body: { documentPath, documentType },
        });

        if (error) {
          console.error("Scan error:", error);
          toast({
            variant: "destructive",
            title: "Scan failed",
            description: await describeEdgeError(error, "Could not scan document"),
          });
          return null;
        }

        if (data?.error) {
          toast({
            variant: "destructive",
            title: "Scan failed",
            description: data.error,
          });
          return null;
        }

        const extracted = data?.data;

        if (extracted && !("error" in extracted)) {
          toast({
            title: "Document scanned",
            description: "Contract details extracted successfully",
          });
          return extracted as ExtractedContractData;
        }

        return null;
      } catch (err) {
        console.error("Scan document error:", err);
        toast({
          variant: "destructive",
          title: "Scan failed",
          description: await describeEdgeError(err, "Could not scan document"),
        });
        return null;
      } finally {
        setIsScanning(false);
      }
    },
    [toast],
  );

  const generateCancellationEmail = useCallback(
    async (contractInfo: {
      name: string;
      provider?: string;
      contractNumber?: string;
      renewalDate?: string;
      userName?: string;
      userAddress?: string;
      language?: "en" | "de";
    }): Promise<CancellationTemplates | null> => {
      setIsGeneratingEmail(true);
      try {
        const { data, error } = await supabase.functions.invoke("generate-cancellation-email", {
          body: contractInfo,
        });

        if (error) {
          console.error("Generate email error:", error);
          toast({
            variant: "destructive",
            title: "Generation failed",
            description: await describeEdgeError(error, "Could not generate cancellation email"),
          });
          return null;
        }

        if (data?.error) {
          toast({
            variant: "destructive",
            title: "Generation failed",
            description: data.error,
          });
          return null;
        }

        const templates = data?.templates as CancellationTemplates;

        if (templates) {
          toast({
            title: "Email generated",
            description: "Cancellation templates ready",
          });
          return templates;
        }

        return null;
      } catch (err) {
        console.error("Generate cancellation email error:", err);
        toast({
          variant: "destructive",
          title: "Generation failed",
          description: await describeEdgeError(err, "Could not generate cancellation email"),
        });
        return null;
      } finally {
        setIsGeneratingEmail(false);
      }
    },
    [toast],
  );

  return {
    scanDocument,
    generateCancellationEmail,
    isScanning,
    isGeneratingEmail,
  };
}
