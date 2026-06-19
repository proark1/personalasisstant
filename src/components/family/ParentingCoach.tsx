import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Heart, MessageCircle, Baby, Users, Brain, Shield } from "lucide-react";
import { useFamilyAssistant } from "@/hooks/useFamilyAssistant";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { describeEdgeError } from "@/lib/edgeError";
import { toast } from "sonner";

interface ParentingCoachProps {
  onClose?: () => void;
}

const TOPICS = [
  {
    value: "behavior",
    labelKey: "family.parenting.topicBehavior",
    icon: Shield,
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
  {
    value: "communication",
    labelKey: "family.parenting.topicCommunication",
    icon: MessageCircle,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  {
    value: "development",
    labelKey: "family.parenting.topicDevelopment",
    icon: Baby,
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  {
    value: "siblings",
    labelKey: "family.parenting.topicSiblings",
    icon: Users,
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  },
  {
    value: "emotional",
    labelKey: "family.parenting.topicEmotional",
    icon: Heart,
    color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  },
  {
    value: "learning",
    labelKey: "family.parenting.topicLearning",
    icon: Brain,
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  },
];

const COMMON_QUESTION_KEYS = [
  "family.parenting.starter1",
  "family.parenting.starter2",
  "family.parenting.starter3",
  "family.parenting.starter4",
  "family.parenting.starter5",
];

export function ParentingCoach({ onClose: _onClose }: ParentingCoachProps) {
  const { members } = useFamilyMembers();
  const { getParentingAdvice, isLoading, streamingResponse } = useFamilyAssistant();
  const { t } = useLanguage();

  const [topic, setTopic] = useState("");
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");

  const children = members.filter((m) => m.relationship === "child");

  const getChildAge = (birthDate: string | null): number | null => {
    if (!birthDate) return null;
    return Math.floor(
      (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
    );
  };

  const childAges = children
    .map((c) => getChildAge(c.birth_date))
    .filter((age): age is number => age !== null);

  const handleGetAdvice = async () => {
    if (!question.trim() || !topic) return;

    try {
      const result = await getParentingAdvice(topic, question, childAges);
      setResponse(result);
    } catch (error) {
      console.error("Error getting parenting advice:", error);
      toast.error(await describeEdgeError(error, t("family.parenting.error")));
    }
  };

  const SelectedTopicIcon = TOPICS.find((topicItem) => topicItem.value === topic)?.icon || Heart;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-primary" />
          {t("family.parenting.title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("family.parenting.subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Children context */}
        {children.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">
              {t("family.parenting.yourChildren")}
            </span>
            {children.map((child) => {
              const age = getChildAge(child.birth_date);
              return (
                <Badge key={child.id} variant="secondary">
                  {child.name} {age ? `(${age}y)` : ""}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Topic selection */}
        <div className="space-y-2">
          <Label>{t("family.parenting.whatTopic")}</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TOPICS.map((topicItem) => {
              const Icon = topicItem.icon;
              return (
                <Button
                  key={topicItem.value}
                  variant={topic === topicItem.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTopic(topicItem.value)}
                  className="flex items-center gap-2 justify-start h-auto py-2"
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs text-left">{t(topicItem.labelKey)}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Quick starters */}
        {topic && (
          <div className="space-y-2">
            <Label className="text-muted-foreground">{t("family.parenting.quickStarters")}</Label>
            <div className="flex flex-wrap gap-1">
              {COMMON_QUESTION_KEYS.map((key) => {
                const q = t(key);
                return (
                  <Button
                    key={key}
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setQuestion((prev) => (prev ? prev : q))}
                  >
                    {q}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Question input */}
        <div className="space-y-2">
          <Label>{t("family.parenting.yourQuestion")}</Label>
          <Textarea
            placeholder={t("family.parenting.questionPlaceholder")}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="min-h-[100px]"
          />
        </div>

        {/* Submit button */}
        <Button
          onClick={handleGetAdvice}
          disabled={isLoading || !question.trim() || !topic}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t("family.parenting.gettingAdvice")}
            </>
          ) : (
            <>
              <SelectedTopicIcon className="w-4 h-4 mr-2" />
              {t("family.parenting.getAdvice")}
            </>
          )}
        </Button>

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground text-center">
          {t("family.parenting.disclaimer")}
        </p>

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
