import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AutoAction {
  actionType: string;
  entityType: string;
  entityId?: string;
  actionData: Record<string, unknown>;
  reason: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const authHeader = req.headers.get('authorization');
  let userId: string | null = null;
  
  if (authHeader) {
    try {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) userId = user.id;
    } catch (e) {
      console.log('Could not get user from auth header');
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    userId = body.userId || userId;
    const autoApply = body.autoApply || false; // If true, apply actions automatically

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Running auto-pilot for user: ${userId}`);

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const actions: AutoAction[] = [];

    // Fetch relevant data
    const [tasksResult, eventsResult, mealPlansResult, shoppingListsResult] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', userId).eq('completed', false).eq('trashed', false),
      supabase.from('events').select('*').eq('user_id', userId).gte('start_time', now.toISOString()),
      supabase.from('meal_plans').select('*, recipes(name, ingredients)').eq('user_id', userId).gte('meal_date', today),
      supabase.from('shopping_lists').select('id, name, items').eq('user_id', userId),
    ]);

    const tasks = tasksResult.data || [];
    const events = eventsResult.data || [];
    const mealPlans = mealPlansResult.data || [];
    const shoppingLists = shoppingListsResult.data || [];

    // 1. RESCHEDULE OVERDUE TASKS
    const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < now);
    
    for (const task of overdueTasks.slice(0, 5)) { // Limit to 5
      const daysOverdue = Math.floor((now.getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24));
      
      // Suggest rescheduling to tomorrow or next week based on priority
      let suggestedDate = new Date(now);
      if (task.priority === 'high') {
        suggestedDate.setDate(suggestedDate.getDate() + 1); // Tomorrow
      } else if (daysOverdue > 7) {
        // Been overdue for a week, suggest next week
        suggestedDate.setDate(suggestedDate.getDate() + 7);
      } else {
        suggestedDate.setDate(suggestedDate.getDate() + 3); // 3 days from now
      }

      actions.push({
        actionType: 'reschedule_task',
        entityType: 'task',
        entityId: task.id,
        actionData: {
          taskTitle: task.title,
          currentDueDate: task.due_date,
          suggestedDueDate: suggestedDate.toISOString().split('T')[0],
          priority: task.priority,
        },
        reason: `Task "${task.title}" is ${daysOverdue} day(s) overdue`,
      });
    }

    // 2. BREAK DOWN LARGE/STUCK TASKS
    const stuckTasks = tasks.filter(t => {
      if (!t.created_at) return false;
      const daysSinceCreation = Math.floor((now.getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceCreation > 7 && t.priority !== 'low' && !t.parent_id;
    });

    for (const task of stuckTasks.slice(0, 3)) {
      actions.push({
        actionType: 'suggest_breakdown',
        entityType: 'task',
        entityId: task.id,
        actionData: {
          taskTitle: task.title,
          daysPending: Math.floor((now.getTime() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24)),
          suggestedSubtasks: [
            `Research/gather info for: ${task.title}`,
            `Draft/start: ${task.title}`,
            `Complete: ${task.title}`,
          ],
        },
        reason: `Task "${task.title}" has been pending for over a week - consider breaking it down`,
      });
    }

    // 3. GENERATE SHOPPING LIST FROM MEAL PLANS
    if (mealPlans.length > 0) {
      const upcomingMeals = mealPlans.filter(mp => {
        const mealDate = new Date(mp.meal_date);
        const daysAhead = Math.floor((mealDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysAhead >= 0 && daysAhead <= 3;
      });

      if (upcomingMeals.length > 0) {
        const allIngredients: string[] = [];
        
        upcomingMeals.forEach(meal => {
          if (meal.recipes?.ingredients) {
            try {
              const ingredients = typeof meal.recipes.ingredients === 'string' 
                ? JSON.parse(meal.recipes.ingredients) 
                : meal.recipes.ingredients;
              if (Array.isArray(ingredients)) {
                allIngredients.push(...ingredients.map((i: any) => typeof i === 'string' ? i : i.name));
              }
            } catch (e) {
              // Skip invalid ingredients
            }
          }
        });

        // Check if ingredients are already in a shopping list
        const existingItems = new Set<string>();
        shoppingLists.forEach(list => {
          try {
            const items = typeof list.items === 'string' ? JSON.parse(list.items) : list.items;
            if (Array.isArray(items)) {
              items.forEach((item: any) => {
                existingItems.add(typeof item === 'string' ? item.toLowerCase() : item.name?.toLowerCase());
              });
            }
          } catch (e) {}
        });

        const newIngredients = [...new Set(allIngredients)].filter(
          ing => !existingItems.has(ing.toLowerCase())
        );

        if (newIngredients.length > 0) {
          actions.push({
            actionType: 'create_shopping_list',
            entityType: 'shopping_list',
            actionData: {
              suggestedName: `Groceries for ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
              items: newIngredients.slice(0, 20),
              mealCount: upcomingMeals.length,
            },
            reason: `${newIngredients.length} ingredients needed for ${upcomingMeals.length} upcoming meal(s)`,
          });
        }
      }
    }

    // 4. SUGGEST FOLLOW-UP TASKS AFTER MEETINGS
    const recentMeetings = events.filter(e => {
      const eventEnd = new Date(e.end_time);
      const hoursSinceEnd = (now.getTime() - eventEnd.getTime()) / (1000 * 60 * 60);
      return hoursSinceEnd > 0 && hoursSinceEnd <= 24 && 
        (e.title.toLowerCase().includes('meeting') || 
         e.title.toLowerCase().includes('call') ||
         e.attendees?.length > 0);
    });

    for (const meeting of recentMeetings.slice(0, 2)) {
      // Check if a follow-up task already exists
      const hasFollowUp = tasks.some(t => 
        t.title.toLowerCase().includes(meeting.title.toLowerCase()) ||
        t.title.toLowerCase().includes('follow up') && 
        new Date(t.created_at) > new Date(meeting.end_time)
      );

      if (!hasFollowUp) {
        actions.push({
          actionType: 'create_followup',
          entityType: 'task',
          actionData: {
            eventTitle: meeting.title,
            eventDate: meeting.start_time,
            suggestedTaskTitle: `Follow up: ${meeting.title}`,
            suggestedCategory: meeting.category || 'business',
            attendees: meeting.attendees,
          },
          reason: `Meeting "${meeting.title}" ended - create follow-up task`,
        });
      }
    }

    // 5. SUGGEST BREAKS FOR BUSY DAYS
    const todayEvents = events.filter(e => e.start_time.startsWith(today));
    if (todayEvents.length >= 4) {
      // Check for gaps between meetings
      const sortedEvents = todayEvents.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );

      let hasGap = false;
      for (let i = 0; i < sortedEvents.length - 1; i++) {
        const end = new Date(sortedEvents[i].end_time);
        const nextStart = new Date(sortedEvents[i + 1].start_time);
        const gapMinutes = (nextStart.getTime() - end.getTime()) / (1000 * 60);
        if (gapMinutes >= 30) hasGap = true;
      }

      if (!hasGap) {
        actions.push({
          actionType: 'suggest_break',
          entityType: 'event',
          actionData: {
            eventCount: todayEvents.length,
            suggestedBreakTime: '15 minutes between meetings',
          },
          reason: `Busy day with ${todayEvents.length} events and no breaks - consider adding buffer time`,
        });
      }
    }

    // Store pending actions
    for (const action of actions) {
      const status = autoApply ? 'auto_applied' : 'pending';
      
      await supabase.from('auto_actions_log').insert({
        user_id: userId,
        action_type: action.actionType,
        entity_type: action.entityType,
        entity_id: action.entityId,
        action_data: action.actionData,
        reason: action.reason,
        status,
        approved_at: autoApply ? now.toISOString() : null,
      });

      // If auto-apply is enabled, execute the action
      if (autoApply && action.actionType === 'reschedule_task' && action.entityId) {
        await supabase
          .from('tasks')
          .update({ due_date: action.actionData.suggestedDueDate })
          .eq('id', action.entityId);
      }
    }

    console.log(`Auto-pilot complete: ${actions.length} actions suggested`);

    return new Response(JSON.stringify({ 
      success: true,
      actions,
      actionsCount: actions.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Auto-pilot error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
