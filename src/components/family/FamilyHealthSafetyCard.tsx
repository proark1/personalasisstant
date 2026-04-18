import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, FileText, Phone, Heart, Plus } from 'lucide-react';
import { useFamilyHealth } from '@/hooks/useFamilyHealth';
import { AddImportantDocumentDialog } from './AddImportantDocumentDialog';
import { AddEmergencyContactDialog } from './AddEmergencyContactDialog';

export function FamilyHealthSafetyCard() {
  const { documents, emergencyContacts, insurance, expiringDocuments, isLoading } = useFamilyHealth();
  const [docOpen, setDocOpen] = useState(false);
  const [emerOpen, setEmerOpen] = useState(false);

  const daysUntil = (date: string) => Math.floor((new Date(date).getTime() - Date.now()) / 86400000);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Health & Safety
          </CardTitle>
          {expiringDocuments.length > 0 && (
            <Badge variant="destructive">{expiringDocuments.length} expiring</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <FileText className="h-4 w-4" /> Important Documents ({documents.length})
                  </h4>
                  <Button size="sm" variant="ghost" onClick={() => setDocOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {expiringDocuments.slice(0, 3).map(d => {
                  const days = d.expiry_date ? daysUntil(d.expiry_date) : null;
                  return (
                    <div key={d.id} className="flex items-center justify-between text-sm rounded-md bg-muted/50 px-2 py-1.5">
                      <span>{d.document_type}</span>
                      {days !== null && (
                        <Badge variant={days < 30 ? 'destructive' : days < 90 ? 'default' : 'secondary'}>
                          {days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
                        </Badge>
                      )}
                    </div>
                  );
                })}
                {documents.length === 0 && (
                  <p className="text-xs text-muted-foreground">No documents tracked. Add passports, IDs, visas to get expiry alerts.</p>
                )}
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <Phone className="h-4 w-4" /> Emergency Contacts ({emergencyContacts.length})
                  </h4>
                  <Button size="sm" variant="ghost" onClick={() => setEmerOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {emergencyContacts.slice(0, 3).map(c => (
                  <div key={c.id} className="flex items-center justify-between text-sm rounded-md bg-muted/50 px-2 py-1.5">
                    <span className="truncate">{c.name} {c.relationship && <span className="text-muted-foreground">· {c.relationship}</span>}</span>
                    <a href={`tel:${c.phone}`} className="text-primary text-xs">{c.phone}</a>
                  </div>
                ))}
                {emergencyContacts.length === 0 && (
                  <p className="text-xs text-muted-foreground">Add emergency contacts for quick access in a crisis.</p>
                )}
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-1.5">
                  <Heart className="h-4 w-4" /> Insurance ({insurance.length})
                </h4>
                {insurance.slice(0, 2).map(i => (
                  <div key={i.id} className="text-sm rounded-md bg-muted/50 px-2 py-1.5">
                    <div className="font-medium">{i.insurance_type}</div>
                    <div className="text-xs text-muted-foreground">{i.provider} {i.policy_number && `· ${i.policy_number}`}</div>
                  </div>
                ))}
              </section>
            </>
          )}
        </CardContent>
      </Card>
      <AddImportantDocumentDialog open={docOpen} onOpenChange={setDocOpen} />
      <AddEmergencyContactDialog open={emerOpen} onOpenChange={setEmerOpen} />
    </>
  );
}
