import { useState } from "react";
import { useHealthTracking } from "@/hooks/useHealthTracking";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pill, Calendar, Syringe, Plus, Trash2, AlertCircle } from "lucide-react";
import { format, isPast } from "date-fns";
import { AddMedicationDialog } from "./AddMedicationDialog";
import { AddAppointmentDialog } from "./AddAppointmentDialog";
import { AddVaccinationDialog } from "./AddVaccinationDialog";
import { FamilyHealthSafetyCard } from "./FamilyHealthSafetyCard";

const appointmentTypeColors: Record<string, string> = {
  checkup: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  dental: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400",
  specialist: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
  therapy: "bg-pink-500/20 text-pink-700 dark:text-pink-400",
  vaccination: "bg-green-500/20 text-green-700 dark:text-green-400",
  other: "bg-muted text-muted-foreground",
};

export function HealthTrackingPanel() {
  const {
    appointments,
    vaccinations,
    isLoading,
    deleteMedication,
    deleteAppointment,
    deleteVaccination,
    updateAppointment,
    getActiveMedications,
    getMedicationsNeedingRefill,
  } = useHealthTracking();
  const { members } = useFamilyMembers();
  const [activeTab, setActiveTab] = useState("medications");
  const [showMedicationDialog, setShowMedicationDialog] = useState(false);
  const [showAppointmentDialog, setShowAppointmentDialog] = useState(false);
  const [showVaccinationDialog, setShowVaccinationDialog] = useState(false);

  const getMemberName = (id: string | null) => {
    if (!id) return "Me";
    return members.find((m) => m.id === id)?.name || "Unknown";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const refillAlerts = getMedicationsNeedingRefill();

  return (
    <div className="space-y-4">
      <FamilyHealthSafetyCard />
      {/* Refill Alerts */}
      {refillAlerts.length > 0 && (
        <Card className="p-3 border-amber-500/50 bg-amber-500/10">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {refillAlerts.length} medication(s) need refill soon
            </span>
          </div>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="medications" className="flex items-center gap-2">
              <Pill className="h-4 w-4" />
              Medications
            </TabsTrigger>
            <TabsTrigger value="appointments" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Appointments
            </TabsTrigger>
            <TabsTrigger value="vaccinations" className="flex items-center gap-2">
              <Syringe className="h-4 w-4" />
              Vaccinations
            </TabsTrigger>
          </TabsList>

          <Button
            size="sm"
            onClick={() => {
              if (activeTab === "medications") setShowMedicationDialog(true);
              else if (activeTab === "appointments") setShowAppointmentDialog(true);
              else setShowVaccinationDialog(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>

        {/* Medications Tab */}
        <TabsContent value="medications" className="mt-4">
          {getActiveMedications().length === 0 ? (
            <Card className="p-8 text-center">
              <Pill className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No medications</h3>
              <p className="text-sm text-muted-foreground">Track medications for your family</p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {getActiveMedications().map((med) => (
                <Card key={med.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{med.name}</h3>
                        <Badge variant="outline">{getMemberName(med.family_member_id)}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {med.dosage && <span>{med.dosage}</span>}
                        {med.dosage && med.frequency && <span> • </span>}
                        {med.frequency && <span>{med.frequency}</span>}
                      </div>
                      {med.refill_date && (
                        <div
                          className={`text-xs mt-2 ${
                            isPast(new Date(med.refill_date))
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          Refill: {format(new Date(med.refill_date), "MMM d, yyyy")}
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteMedication(med.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Appointments Tab */}
        <TabsContent value="appointments" className="mt-4">
          {appointments.length === 0 ? (
            <Card className="p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No appointments</h3>
              <p className="text-sm text-muted-foreground">Schedule medical appointments</p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {appointments
                .filter((a) => !a.is_completed)
                .map((appt) => (
                  <Card key={appt.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{appt.title}</h3>
                          <Badge
                            className={
                              appointmentTypeColors[appt.appointment_type] ||
                              appointmentTypeColors.other
                            }
                          >
                            {appt.appointment_type}
                          </Badge>
                          <Badge variant="outline">{getMemberName(appt.family_member_id)}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {format(new Date(appt.appointment_date), "EEEE, MMM d, yyyy h:mm a")}
                        </div>
                        {appt.provider_name && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {appt.provider_name} {appt.location && `• ${appt.location}`}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateAppointment(appt.id, { is_completed: true })}
                        >
                          Done
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAppointment(appt.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        {/* Vaccinations Tab */}
        <TabsContent value="vaccinations" className="mt-4">
          {vaccinations.length === 0 ? (
            <Card className="p-8 text-center">
              <Syringe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No vaccination records</h3>
              <p className="text-sm text-muted-foreground">Keep track of immunizations</p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {vaccinations.map((vax) => (
                <Card key={vax.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{vax.vaccine_name}</h3>
                        <Badge variant="outline">{getMemberName(vax.family_member_id)}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Administered: {format(new Date(vax.date_administered), "MMM d, yyyy")}
                      </div>
                      {vax.next_dose_date && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Next dose: {format(new Date(vax.next_dose_date), "MMM d, yyyy")}
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteVaccination(vax.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AddMedicationDialog open={showMedicationDialog} onOpenChange={setShowMedicationDialog} />
      <AddAppointmentDialog open={showAppointmentDialog} onOpenChange={setShowAppointmentDialog} />
      <AddVaccinationDialog open={showVaccinationDialog} onOpenChange={setShowVaccinationDialog} />
    </div>
  );
}
