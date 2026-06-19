import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  BookOpen,
  GraduationCap,
  Calculator,
  Pencil,
  FlaskConical,
  Globe,
} from "lucide-react";
import { useFamilyAssistant } from "@/hooks/useFamilyAssistant";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/contexts/LanguageContext";
import { describeEdgeError } from "@/lib/edgeError";
import { toast } from "sonner";

interface HomeworkHelperProps {
  preselectedChild?: string;
  onClose?: () => void;
}

const SUBJECTS = [
  { value: "math", labelKey: "family.homework.subjectMath", icon: Calculator },
  { value: "writing", labelKey: "family.homework.subjectWriting", icon: Pencil },
  { value: "science", labelKey: "family.homework.subjectScience", icon: FlaskConical },
  { value: "history", labelKey: "family.homework.subjectHistory", icon: Globe },
  { value: "reading", labelKey: "family.homework.subjectReading", icon: BookOpen },
  { value: "other", labelKey: "family.homework.subjectOther", icon: GraduationCap },
];

const PROBLEM_TYPES = {
  math: [
    "Word problem",
    "Equation solving",
    "Geometry",
    "Fractions",
    "Decimals",
    "Multiplication/Division",
    "General",
  ],
  writing: ["Essay structure", "Grammar", "Spelling", "Creative writing", "Book report", "General"],
  science: ["Biology", "Chemistry", "Physics", "Earth science", "Experiment help", "General"],
  history: ["Timeline/dates", "Historical events", "Geography", "Civics", "General"],
  reading: [
    "Comprehension questions",
    "Vocabulary",
    "Summary writing",
    "Character analysis",
    "General",
  ],
  other: ["General help", "Study tips", "Test preparation"],
};

export function HomeworkHelper({ preselectedChild, onClose: _onClose }: HomeworkHelperProps) {
  const { members } = useFamilyMembers();
  const { getHomeworkHelp, isLoading, streamingResponse } = useFamilyAssistant();
  const { t } = useLanguage();

  const [selectedChild, setSelectedChild] = useState(preselectedChild || "");
  const [subject, setSubject] = useState("");
  const [problemType, setProblemType] = useState("");
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");

  const children = members.filter((m) => m.relationship === "child");
  const selectedChildData = children.find((c) => c.id === selectedChild);

  const getChildAge = (birthDate: string | null): number => {
    if (!birthDate) return 10;
    return Math.floor(
      (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
    );
  };

  const handleGetHelp = async () => {
    if (!question.trim() || !subject) return;

    const childAge = selectedChildData ? getChildAge(selectedChildData.birth_date) : 10;

    try {
      const result = await getHomeworkHelp(subject, question, childAge, problemType || undefined);
      setResponse(result);
    } catch (error) {
      console.error("Error getting homework help:", error);
      toast.error(await describeEdgeError(error, t("family.homework.error")));
    }
  };

  const SubjectIcon = SUBJECTS.find((s) => s.value === subject)?.icon || BookOpen;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" />
          {t("family.homework.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Child selection */}
        {children.length > 0 && (
          <div className="space-y-2">
            <Label>{t("family.homework.whoNeedsHelp")}</Label>
            <Select value={selectedChild} onValueChange={setSelectedChild}>
              <SelectTrigger>
                <SelectValue placeholder={t("family.homework.selectChild")} />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.name} {child.school_grade ? `(${child.school_grade})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Subject selection */}
        <div className="space-y-2">
          <Label>{t("family.homework.subject")}</Label>
          <div className="grid grid-cols-3 gap-2">
            {SUBJECTS.map((s) => {
              const Icon = s.icon;
              return (
                <Button
                  key={s.value}
                  variant={subject === s.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSubject(s.value);
                    setProblemType("");
                  }}
                  className="flex flex-col gap-1 h-auto py-2"
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs">{t(s.labelKey)}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Problem type */}
        {subject && PROBLEM_TYPES[subject as keyof typeof PROBLEM_TYPES] && (
          <div className="space-y-2">
            <Label>{t("family.homework.problemType")}</Label>
            <Select value={problemType} onValueChange={setProblemType}>
              <SelectTrigger>
                <SelectValue placeholder={t("family.homework.selectType")} />
              </SelectTrigger>
              <SelectContent>
                {PROBLEM_TYPES[subject as keyof typeof PROBLEM_TYPES].map((type) => (
                  <SelectItem key={type} value={type.toLowerCase()}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Question input */}
        <div className="space-y-2">
          <Label>{t("family.homework.whatHelp")}</Label>
          <Textarea
            placeholder={t("family.homework.questionPlaceholder")}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="min-h-[100px]"
          />
        </div>

        {/* Submit button */}
        <Button
          onClick={handleGetHelp}
          disabled={isLoading || !question.trim() || !subject}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t("family.homework.gettingHelp")}
            </>
          ) : (
            <>
              <SubjectIcon className="w-4 h-4 mr-2" />
              {t("family.homework.getHelp")}
            </>
          )}
        </Button>

        {/* Response */}
        {(streamingResponse || response) && (
          <ScrollArea className="h-[300px] border rounded-lg p-4">
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
              {isLoading ? streamingResponse : response}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
