

# Task Feature — World-Class UI/UX Upgrade

## Current State Assessment

The task system is functional but has several friction points:
- **Deleting is destructive** — no undo, no confirmation, instant permanent delete
- **No task completion animation** beyond confetti — the item just disappears
- **Completed tasks section is flat** — no clear all, no auto-hide after time
- **Empty state is minimal** — just text and a link
- **No progress summary** at the top of the task list
- **Swipe-to-delete has no undo** — accidentally swiping left permanently deletes

## What Changes

### 1. Undo Delete with Toast (Critical Safety Net)

When a task is deleted (via swipe, button, or bulk), show a 5-second "Undo" toast instead of permanently deleting immediately. The task is removed from the UI instantly (feels snappy) but can be restored with one tap.

- Soft-delete pattern: mark as `trashed: true` in state, actually delete from DB after 5s
- Toast shows task title + Undo button
- Works for both single and bulk delete

### 2. Task Completion Animation

When completing a task, add a satisfying micro-animation:
- The checkbox morphs to a filled circle with a scale-bounce
- The task text gets a strikethrough animation (left to right wipe)
- The row fades and slides down into the "Completed" section after a 600ms delay
- This makes task completion feel rewarding and tangible

### 3. Smart Task Stats Bar

Replace the plain "X remaining" text in the header with a compact stats row:
- Tasks remaining count (with animated counter)
- Overdue count (red, only if > 0)
- Completed today count
- A thin progress bar showing % complete for the day

### 4. Improved Completed Section

- Auto-collapse completed tasks after 5 items (show "Show all X completed" toggle)
- Add a "Clear completed" button to bulk-remove done tasks
- Show completion time relative ("2 hours ago")

### 5. Better Empty State

When no tasks exist, show an encouraging animated illustration:
- Checkmark animation (reuse existing success-checkmark component)
- "Nothing on your plate" message
- Quick-add prompt with category suggestions ("Add a personal task", "Add a work task")

### 6. Inline Quick Edit

- Tap on a task title to edit it inline (no modal needed for simple title changes)
- Long-press opens the full edit modal
- This reduces friction for the most common edit: renaming a task

### 7. Swipe Gesture Improvements

- Add haptic feedback threshold indicator (subtle color intensification as you approach the trigger point)
- Show "Release to delete" / "Release to complete" text labels on the swipe backgrounds
- Swipe-to-delete triggers the undo toast instead of permanent delete

---

## Technical Plan

### Files to Modify

**`src/components/tasks/TaskList.tsx`**
- Add stats bar below the header showing: remaining, overdue, completed today, progress %
- Implement undo-delete pattern: `trashedTasks` state + timeout-based actual deletion
- Wrap `onDeleteTask` calls with undo toast logic
- Collapse completed section to max 5 items with toggle
- Add "Clear completed" button
- Show relative time for completed tasks
- Better empty state with category quick-add buttons

**`src/components/tasks/SwipeableTaskItem.tsx`**
- Add text labels ("Complete" / "Delete") on swipe action backgrounds
- Add progressive color intensification as drag approaches threshold
- Change delete action to trigger undo flow (via callback change)

**`src/components/tasks/SortableTaskItem` (inside TaskList.tsx)**
- Add inline title editing on tap (controlled input that activates on click)
- Completion animation: framer-motion `AnimatePresence` with exit animation (slide + fade)

**`src/hooks/useUndoDelete.ts`**
- Already exists but is unused — wire it into TaskList's delete flow
- Extend to support bulk undo (array of items)

**`src/components/calendar/CalendarHubPanel.tsx`**
- Pass undo-delete handler down to TaskList

### No database changes needed
All improvements are UI/UX and hook logic only.

