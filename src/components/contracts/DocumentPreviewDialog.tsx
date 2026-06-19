import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Loader2, FileText, Image as ImageIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentPath: string | null;
  contractName?: string;
}

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  documentPath,
  contractName,
}: DocumentPreviewDialogProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getSignedUrl() {
      if (!documentPath || !open) {
        setSignedUrl(null);
        return;
      }

      // If it's already a full URL, use it directly
      if (documentPath.startsWith("http")) {
        setSignedUrl(documentPath);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: signedUrlError } = await supabase.storage
          .from("contract-documents")
          .createSignedUrl(documentPath, 60 * 60); // 1 hour

        if (signedUrlError) {
          setError("Could not load document");
          console.error("Signed URL error:", signedUrlError);
        } else if (data?.signedUrl) {
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        setError("Could not load document");
        console.error("Document preview error:", err);
      } finally {
        setLoading(false);
      }
    }

    getSignedUrl();
  }, [documentPath, open]);

  const isImage =
    documentPath &&
    (documentPath.endsWith(".jpg") ||
      documentPath.endsWith(".jpeg") ||
      documentPath.endsWith(".png") ||
      documentPath.endsWith(".webp"));

  const isPdf = documentPath && documentPath.endsWith(".pdf");

  const openInNewTab = () => {
    if (signedUrl) {
      window.open(signedUrl, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {isImage ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
              {contractName || "Document Preview"}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={openInNewTab}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Open
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center h-[500px]">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
              <FileText className="w-12 h-12 mb-4 opacity-50" />
              <p>{error}</p>
              <Button variant="outline" className="mt-4" onClick={openInNewTab}>
                Try opening externally
              </Button>
            </div>
          )}

          {!loading && !error && signedUrl && (
            <>
              {isImage ? (
                <ScrollArea className="h-[500px]">
                  <div className="p-4 flex items-center justify-center">
                    <img
                      src={signedUrl}
                      alt={contractName || "Contract document"}
                      className="max-w-full h-auto rounded-lg shadow-lg"
                    />
                  </div>
                </ScrollArea>
              ) : isPdf ? (
                <iframe
                  src={signedUrl}
                  className="w-full h-[600px] border-0"
                  title={contractName || "Contract document"}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
                  <FileText className="w-12 h-12 mb-4 opacity-50" />
                  <p>Preview not available for this file type</p>
                  <Button variant="outline" className="mt-4" onClick={openInNewTab}>
                    Open in new tab
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
