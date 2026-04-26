import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Loader2, Trash2, CheckCircle2 } from 'lucide-react';
import { useVisionCapture, type VisionKind } from '@/hooks/useVisionCapture';
import { cn } from '@/lib/utils';

const KIND_LABELS: Record<VisionKind, string> = {
  receipt: 'Receipt',
  business_card: 'Business card',
  medication: 'Medication',
  whiteboard: 'Whiteboard / notes',
  label: 'Label / sign',
  document: 'Document',
  contract: 'Contract',
  inventory: 'Inventory item',
  unknown: 'Unknown',
};

// "Capture" button mounted in the header. Opens a dialog with a file
// input that accepts camera capture on mobile (capture="environment"
// triggers the rear camera prompt). On desktop falls back to the file
// picker. After upload, shows the AI-classified kind + editable
// fields, then user clicks Save to commit to the right downstream table.

export function VisionCaptureButton() {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const vision = useVisionCapture();
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});
  const [chosenKind, setChosenKind] = useState<VisionKind | null>(null);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = await vision.captureFromFile(file);
    e.target.value = ''; // allow re-upload of same file
    if (r) {
      setChosenKind(r.detected_kind);
      // Seed editable fields from extraction.
      const seed: Record<string, string> = {};
      for (const [k, v] of Object.entries(r.extracted ?? {})) {
        if (typeof v === 'string' || typeof v === 'number') seed[k] = String(v);
      }
      setEditedFields(seed);
    }
  };

  const close = () => {
    setOpen(false);
    setEditedFields({});
    setChosenKind(null);
    vision.discard();
  };

  const onSave = async () => {
    // Coerce numeric-looking fields back to numbers so the edge fn
    // schema accepts them.
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(editedFields)) {
      if (v === '') continue;
      const n = Number(v);
      // Trim before the regex test: Number(" 100 ") parses fine, but
      // the strict regex would reject the surrounding whitespace and
      // we'd send a string when a number was intended.
      payload[k] = Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(v.trim()) ? n : v;
    }
    // Pass through any non-string keys from the original extraction
    // unchanged (e.g. line_items arrays).
    if (vision.result?.extracted) {
      for (const [k, v] of Object.entries(vision.result.extracted)) {
        if (!(k in payload) && (typeof v === 'object' || Array.isArray(v))) payload[k] = v;
      }
    }
    const r = await vision.commit({ kind: chosenKind ?? undefined, payload });
    if (r) {
      setOpen(false);
      setEditedFields({});
      setChosenKind(null);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 relative"
        title="Capture with camera"
        onClick={() => setOpen(true)}
      >
        <Camera className="w-4.5 h-4.5" />
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) close(); else setOpen(true); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" />
              Capture with camera
            </DialogTitle>
            <DialogDescription>
              Snap a receipt, business card, medication label, whiteboard,
              or any text. The assistant classifies it and offers to save
              it as the right thing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Picker */}
            {!vision.result && (
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onChange}
                  className="hidden"
                />
                <Button
                  className="w-full gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={vision.busy}
                >
                  {vision.busy
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> {vision.phase?.label ?? 'Analysing…'}</>
                    : <><Camera className="w-4 h-4" /> Take or choose a photo</>}
                </Button>
                {vision.busy && vision.phase ? (
                  <p className="text-[10px] text-muted-foreground text-center tabular-nums">
                    {Math.floor(vision.phase.elapsed_ms / 1000)}s elapsed · phase: {vision.phase.key}
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Up to 10 MB. JPEG/PNG/WEBP work best.
                  </p>
                )}
              </div>
            )}

            {/* Preview */}
            {vision.previewUrl && vision.result && (
              <div className="space-y-3">
                <div className="rounded-md overflow-hidden border border-border">
                  {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
                  <img
                    src={vision.previewUrl}
                    alt="captured"
                    className="w-full max-h-48 object-contain bg-muted"
                  />
                </div>

                {/* Detected kind + override */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Detected</Label>
                    <Badge variant="outline" className="text-[10px]">
                      {Math.round((vision.result.classification_confidence ?? 0) * 100)}% confident
                    </Badge>
                  </div>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={chosenKind ?? vision.result.detected_kind}
                    onChange={(e) => setChosenKind(e.target.value as VisionKind)}
                  >
                    {(Object.keys(KIND_LABELS) as VisionKind[]).map((k) => (
                      <option key={k} value={k}>{KIND_LABELS[k]}</option>
                    ))}
                  </select>
                </div>

                {/* Editable fields, one per primitive key in extracted. */}
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {Object.keys(editedFields).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No structured fields. The OCR text will be saved.
                    </p>
                  ) : (
                    Object.entries(editedFields).map(([k, v]) => (
                      <div key={k} className="space-y-1">
                        <Label htmlFor={`f-${k}`} className="text-[10px] uppercase tracking-wide capitalize">
                          {k.replace(/_/g, ' ')}
                        </Label>
                        <Input
                          id={`f-${k}`}
                          value={v}
                          onChange={(e) => setEditedFields({ ...editedFields, [k]: e.target.value })}
                          className="h-8 text-sm"
                        />
                      </div>
                    ))
                  )}
                </div>

                {/* OCR text preview */}
                {vision.result.ocr_text && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      View raw text ({vision.result.ocr_text.length} chars)
                    </summary>
                    <pre className={cn(
                      'mt-1 p-2 rounded bg-muted text-[11px] whitespace-pre-wrap max-h-32 overflow-y-auto',
                    )}>
                      {vision.result.ocr_text}
                    </pre>
                  </details>
                )}

                {chosenKind === 'label' && vision.result.extracted?.translation && (
                  <div className="rounded-md bg-emerald-500/10 p-2 text-xs">
                    <p className="font-medium text-emerald-600">Translation</p>
                    <p className="mt-0.5">{String(vision.result.extracted.translation)}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {vision.result && (
              <Button variant="ghost" onClick={close} disabled={vision.busy} className="gap-1.5">
                <Trash2 className="w-4 h-4" /> Discard
              </Button>
            )}
            {vision.result && (
              <Button onClick={onSave} disabled={vision.busy} className="gap-1.5">
                {vision.busy
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><CheckCircle2 className="w-4 h-4" /> Save</>}
              </Button>
            )}
            {!vision.result && (
              <Button variant="ghost" onClick={close} disabled={vision.busy}>Cancel</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
