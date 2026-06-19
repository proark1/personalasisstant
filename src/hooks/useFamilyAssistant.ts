import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FamilyMember } from "./useFamilyMembers";
import { toast } from "sonner";

interface FamilyMemberContext {
  name: string;
  age: number | null;
  relationship: string;
  school?: string;
  grade?: string;
  activities?: { name: string; schedule: string; location?: string }[];
  allergies?: string[];
}

interface FamilyContext {
  members: FamilyMemberContext[];
  todayEvents?: { title: string; time: string; location?: string }[];
  weather?: { temperature: number; condition: string };
  userLocation?: string;
}

interface _ActivitySuggestion {
  name: string;
  description: string;
  duration: string;
  supplies: string[];
  tips: string;
}

export function useFamilyAssistant() {
  const [isLoading, setIsLoading] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState("");

  const buildFamilyContext = useCallback(
    (
      members: FamilyMember[],
      todayEvents?: { title: string; start_time: string; location?: string }[],
      weather?: { temperature: number; condition: string },
      userLocation?: string,
    ): FamilyContext => {
      return {
        members: members.map((m) => ({
          name: m.name,
          age: m.birth_date
            ? Math.floor(
                (Date.now() - new Date(m.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
              )
            : null,
          relationship: m.relationship,
          school: m.school_name || undefined,
          grade: m.school_grade || undefined,
          activities: m.activities,
          allergies: m.allergies || undefined,
        })),
        todayEvents: todayEvents?.map((e) => ({
          title: e.title,
          time: new Date(e.start_time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          location: e.location || undefined,
        })),
        weather,
        userLocation,
      };
    },
    [],
  );

  const streamResponse = async (
    action: "activity_finder" | "homework_helper" | "parenting_coach",
    query: string,
    familyContext: FamilyContext,
    options?: {
      weatherCondition?: string;
      subject?: string;
      childAge?: number;
      problemType?: string;
      childAges?: number[];
      topic?: string;
    },
    onDelta?: (chunk: string) => void,
  ): Promise<string> => {
    setIsLoading(true);
    setStreamingResponse("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/family-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action,
            query,
            familyContext,
            ...options,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Error: ${response.status}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setStreamingResponse(fullContent);
              onDelta?.(content);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      return fullContent;
    } catch (error) {
      console.error("Family assistant error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to get response");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const findActivities = useCallback(
    async (
      members: FamilyMember[],
      weather?: { temperature: number; condition: string },
      query?: string,
      onDelta?: (chunk: string) => void,
    ): Promise<string> => {
      const familyContext = buildFamilyContext(members, undefined, weather);
      return streamResponse(
        "activity_finder",
        query || "Suggest fun activities for our family today",
        familyContext,
        { weatherCondition: weather?.condition },
        onDelta,
      );
    },
    [buildFamilyContext],
  );

  const getHomeworkHelp = useCallback(
    async (
      subject: string,
      question: string,
      childAge: number,
      problemType?: string,
      onDelta?: (chunk: string) => void,
    ): Promise<string> => {
      return streamResponse(
        "homework_helper",
        question,
        { members: [] },
        { subject, childAge, problemType: problemType || "general question" },
        onDelta,
      );
    },
    [],
  );

  const getParentingAdvice = useCallback(
    async (
      topic: string,
      question: string,
      childAges: number[],
      onDelta?: (chunk: string) => void,
    ): Promise<string> => {
      return streamResponse(
        "parenting_coach",
        question,
        { members: [] },
        { topic, childAges },
        onDelta,
      );
    },
    [],
  );

  return {
    isLoading,
    streamingResponse,
    findActivities,
    getHomeworkHelp,
    getParentingAdvice,
    buildFamilyContext,
  };
}
