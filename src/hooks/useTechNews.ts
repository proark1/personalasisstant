import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { usePersonalizedNews, NewsItem } from "@/hooks/usePersonalizedNews";

export interface SavedArticle {
  id: string;
  title: string;
  summary?: string;
  url: string;
  source?: string;
  category?: string;
  image_url?: string;
  is_read: boolean;
  is_bookmarked: boolean;
  saved_at: string;
  read_at?: string;
}

export interface NewsPreferences {
  id: string;
  topics: string[];
  sources: string[];
  update_frequency: string;
  include_in_briefing: boolean;
}

const DEFAULT_TOPICS = ["AI", "Technology", "Startups", "Machine Learning", "SaaS"];

export function useTechNews() {
  const { user } = useAuth();
  const [savedArticles, setSavedArticles] = useState<SavedArticle[]>([]);
  const [preferences, setPreferences] = useState<NewsPreferences | null>(null);
  const [loading, setLoading] = useState(false);

  // Use the personalized news hook for live news
  const {
    news: liveNews,
    loading: newsLoading,
    error: newsError,
    refetch: refetchNews,
  } = usePersonalizedNews({
    interests: preferences?.topics || DEFAULT_TOPICS,
    skills: ["AI", "Technology", "Entrepreneurship"],
    businesses: ["Gaming", "AI", "Marketing"],
  });

  // Fetch saved articles
  const fetchSavedArticles = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("saved_articles")
        .select("*")
        .eq("user_id", user.id)
        .order("saved_at", { ascending: false });

      if (error) throw error;
      setSavedArticles((data || []) as SavedArticle[]);
    } catch (error) {
      console.error("Error fetching saved articles:", error);
    }
  }, [user?.id]);

  // Fetch preferences
  const fetchPreferences = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("news_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setPreferences(data as NewsPreferences);
      } else {
        // Create default preferences
        const { data: newPrefs, error: createError } = await supabase
          .from("news_preferences")
          .insert({
            user_id: user.id,
            topics: DEFAULT_TOPICS,
            sources: [],
            update_frequency: "daily",
            include_in_briefing: true,
          })
          .select()
          .single();

        if (createError) throw createError;
        setPreferences(newPrefs as NewsPreferences);
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
    }
  }, [user?.id]);

  // Save article
  const saveArticle = async (article: NewsItem) => {
    if (!user?.id) return null;

    try {
      // Check if already saved
      const existing = savedArticles.find((a) => a.url === article.url);
      if (existing) {
        toast.info("Article already saved");
        return existing;
      }

      const { data, error } = await supabase
        .from("saved_articles")
        .insert({
          user_id: user.id,
          title: article.headline,
          summary: article.summary,
          url: article.url || "",
          category: article.category,
          is_read: false,
          is_bookmarked: true,
        })
        .select()
        .single();

      if (error) throw error;
      await fetchSavedArticles();
      toast.success("Article saved");
      return data as SavedArticle;
    } catch (error) {
      console.error("Error saving article:", error);
      toast.error("Failed to save article");
      return null;
    }
  };

  // Mark article as read
  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("saved_articles")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      await fetchSavedArticles();
    } catch (error) {
      console.error("Error marking article as read:", error);
    }
  };

  // Delete saved article
  const deleteArticle = async (id: string) => {
    try {
      const { error } = await supabase.from("saved_articles").delete().eq("id", id);

      if (error) throw error;
      await fetchSavedArticles();
      toast.success("Article removed");
    } catch (error) {
      console.error("Error deleting article:", error);
      toast.error("Failed to remove article");
    }
  };

  // Update preferences
  const updatePreferences = async (updates: Partial<NewsPreferences>) => {
    if (!preferences?.id) return;

    try {
      const { error } = await supabase
        .from("news_preferences")
        .update(updates)
        .eq("id", preferences.id);

      if (error) throw error;
      await fetchPreferences();
      toast.success("Preferences updated");
    } catch (error) {
      console.error("Error updating preferences:", error);
      toast.error("Failed to update preferences");
    }
  };

  // Get unread count
  const unreadCount = savedArticles.filter((a) => !a.is_read).length;

  // Get articles by category
  const getArticlesByCategory = (category: string) => {
    return savedArticles.filter((a) => a.category === category);
  };

  useEffect(() => {
    if (user?.id) {
      setLoading(true);
      Promise.all([fetchSavedArticles(), fetchPreferences()]).finally(() => setLoading(false));
    }
  }, [user?.id, fetchSavedArticles, fetchPreferences]);

  return {
    // Live news
    liveNews,
    newsLoading,
    newsError,
    refetchNews,

    // Saved articles
    savedArticles,
    saveArticle,
    markAsRead,
    deleteArticle,
    unreadCount,
    getArticlesByCategory,

    // Preferences
    preferences,
    updatePreferences,
    defaultTopics: DEFAULT_TOPICS,

    // General
    loading,
    refetch: () => Promise.all([fetchSavedArticles(), fetchPreferences()]),
  };
}
