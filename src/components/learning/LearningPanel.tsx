import { useState } from "react";
import { GraduationCap, Plus, Trash2 } from "lucide-react";
import { PanelShell } from "@/components/ui/panel-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useLearning } from "@/hooks/useLearning";

export function LearningPanel() {
  const { books, courses, skills, isLoading, addBook, addCourse, addSkill, remove } = useLearning();
  const [bTitle, setBTitle] = useState("");
  const [bAuthor, setBAuthor] = useState("");
  const [cTitle, setCTitle] = useState("");
  const [cProvider, setCProvider] = useState("");
  const [sName, setSName] = useState("");

  return (
    <PanelShell
      icon={GraduationCap}
      title="Learning & Growth"
      subtitle={`${books.length} books · ${courses.length} courses · ${skills.length} skills`}
      loading={isLoading}
    >
      <Tabs defaultValue="books" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="books">Books</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
        </TabsList>

        <TabsContent value="books" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input placeholder="Title" value={bTitle} onChange={(e) => setBTitle(e.target.value)} />
            <Input
              placeholder="Author"
              value={bAuthor}
              onChange={(e) => setBAuthor(e.target.value)}
            />
            <Button
              onClick={() => {
                if (bTitle) {
                  addBook({ title: bTitle, author: bAuthor, status: "reading" });
                  setBTitle("");
                  setBAuthor("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {books.map((b) => (
            <Card key={b.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium">{b.title}</p>
                <p className="text-xs text-muted-foreground">
                  {b.author || "—"} · {b.status || "queued"}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove("books", b.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="courses" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Course title"
              value={cTitle}
              onChange={(e) => setCTitle(e.target.value)}
            />
            <Input
              placeholder="Provider"
              value={cProvider}
              onChange={(e) => setCProvider(e.target.value)}
            />
            <Button
              onClick={() => {
                if (cTitle) {
                  addCourse({ title: cTitle, provider: cProvider, status: "in_progress" });
                  setCTitle("");
                  setCProvider("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {courses.map((c) => (
            <Card key={c.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium">{c.title}</p>
                <p className="text-xs text-muted-foreground">
                  {c.provider || "—"} · {c.progress_percent ?? 0}%
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove("courses", c.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="skills" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Skill (e.g. Arabic)"
              value={sName}
              onChange={(e) => setSName(e.target.value)}
            />
            <Button
              onClick={() => {
                if (sName) {
                  addSkill({ name: sName });
                  setSName("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {skills.map((s) => (
            <Card key={s.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.current_level || "—"} → {s.target_level || "—"} · {s.practice_frequency || "—"}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove("skills", s.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </PanelShell>
  );
}
