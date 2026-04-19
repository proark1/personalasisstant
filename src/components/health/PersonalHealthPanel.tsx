import { useState } from 'react';
import { Pill, Plus, Trash2 } from 'lucide-react';
import { PanelShell } from '@/components/ui/panel-shell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { usePersonalHealth } from '@/hooks/usePersonalHealth';

export function PersonalHealthPanel() {
  const { medications, doctors, labResults, workouts, isLoading, addMedication, addDoctor, addLabResult, addWorkout, remove } = usePersonalHealth();
  const [med, setMed] = useState(''); const [doc, setDoc] = useState(''); const [lab, setLab] = useState(''); const [labVal, setLabVal] = useState(''); const [workType, setWorkType] = useState('');

  return (
    <PanelShell icon={Pill} title="Personal Health" subtitle={`${medications.filter(m => m.is_active !== false).length} active meds · ${doctors.length} doctors`} loading={isLoading}>
      <Tabs defaultValue="medications" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="medications">Meds</TabsTrigger>
          <TabsTrigger value="doctors">Doctors</TabsTrigger>
          <TabsTrigger value="labs">Lab Results</TabsTrigger>
          <TabsTrigger value="workouts">Workouts</TabsTrigger>
        </TabsList>

        <TabsContent value="medications" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input placeholder="Medication name" value={med} onChange={e => setMed(e.target.value)} />
            <Button onClick={() => { if (med) { addMedication({ name: med }); setMed(''); } }}><Plus className="h-4 w-4" /></Button>
          </div>
          {medications.map(m => (
            <Card key={m.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.dose || '—'} · {m.frequency || '—'} · refill: {m.refill_date || '—'}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove('personal_medications', m.id)}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="doctors" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input placeholder="Doctor name" value={doc} onChange={e => setDoc(e.target.value)} />
            <Button onClick={() => { if (doc) { addDoctor({ name: doc }); setDoc(''); } }}><Plus className="h-4 w-4" /></Button>
          </div>
          {doctors.map(d => (
            <Card key={d.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground">{d.specialty || '—'} · last: {d.last_visit || '—'} · next: {d.next_visit || '—'}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove('personal_doctors', d.id)}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="labs" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input placeholder="Test name (e.g. Vitamin D)" value={lab} onChange={e => setLab(e.target.value)} />
            <Input type="number" placeholder="Value" value={labVal} onChange={e => setLabVal(e.target.value)} className="w-32" />
            <Button onClick={() => { if (lab) { addLabResult({ test_name: lab, value: labVal ? Number(labVal) : null }); setLab(''); setLabVal(''); } }}><Plus className="h-4 w-4" /></Button>
          </div>
          {labResults.map(r => (
            <Card key={r.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium">{r.test_name} <span className="text-muted-foreground font-normal">{r.value ?? ''} {r.unit || ''}</span></p>
                <p className="text-xs text-muted-foreground">{r.test_date} · {r.status || '—'}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove('lab_results', r.id)}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="workouts" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input placeholder="Workout type (e.g. Run, Push day)" value={workType} onChange={e => setWorkType(e.target.value)} />
            <Button onClick={() => { if (workType) { addWorkout({ workout_type: workType }); setWorkType(''); } }}><Plus className="h-4 w-4" /></Button>
          </div>
          {workouts.map(w => (
            <Card key={w.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium">{w.workout_type || 'Workout'}</p>
                <p className="text-xs text-muted-foreground">{w.workout_date} · {w.duration_minutes || 0} min</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove('workouts', w.id)}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </PanelShell>
  );
}
