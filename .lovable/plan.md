

# Next-Level UI/UX Polish Plan

## What's Already Done
- GlassCard system, PanelShell, EmptyState, PanelSkeleton shared components
- Panel transition animations (AnimatePresence) in MobileLayout and StandardMode concept
- Bottom tab spring indicator, sidebar active indicator
- MoreSheet stagger animations, ContextualHeader animated title
- Auth page floating orbs and entrance animations
- Scroll fade masks, pressable dashboard cards

## Remaining Gaps

### 1. Desktop Panel Transitions Missing
`StandardMode.tsx` still uses raw conditional rendering (`{activePanel === 'x' && ...}`) with no `AnimatePresence`. Mobile has it, desktop does not. Every panel swap is an instant cut.

**Fix:** Wrap the panel area in `AnimatePresence mode="wait"` with a keyed `motion.div`, same pattern as MobileLayout.

**File:** `StandardMode.tsx` (lines 406-678)

### 2. Onboarding Flow Polish
`Onboarding.tsx` exists but hasn't been reviewed for consistency with the new design system.

**Fix:** Review and upgrade to use GlassCard, entrance animations, and consistent spacing.

**File:** `src/pages/Onboarding.tsx`

### 3. Toast Notifications Upgrade
The app uses sonner toasts which are functional but visually generic. World-class apps have branded, animated toast notifications.

**Fix:** Style the Sonner toaster with glassmorphism, add subtle slide+scale entrance, and use the app's color tokens.

**File:** `src/components/ui/sonner.tsx`

### 4. Dialog/Sheet Polish
Dialogs and sheets across the app use default Radix styling. No entrance spring animation, no glassmorphism backdrop.

**Fix:** Update the base `Dialog` and `Sheet` components with a subtle `backdrop-blur` overlay and spring-animated content entrance.

**Files:** `src/components/ui/dialog.tsx`, `src/components/ui/sheet.tsx`

### 5. Input Focus States
Input fields have basic ring focus. World-class apps have a subtle glow or animated border on focus.

**Fix:** Add a primary-colored glow shadow on `focus-visible` to the base Input and Textarea components.

**Files:** `src/components/ui/input.tsx`, `src/components/ui/textarea.tsx`

### 6. Button Micro-Interactions
Buttons use Tailwind transitions but no spring physics or active feedback beyond color change.

**Fix:** Add `active:scale-[0.97]` and a subtle transition to all button variants. Add a shimmer effect to primary CTA buttons.

**File:** `src/components/ui/button.tsx`

### 7. NotFound Page Polish
`NotFound.tsx` is likely a plain page. Should match the app's visual identity.

**Fix:** Add a branded 404 page with the Dori mascot, glassmorphism card, and a "Go Home" CTA with entrance animation.

**File:** `src/pages/NotFound.tsx`

### 8. Skeleton Shimmer Consistency
Some panels may still show plain gray skeletons instead of the shimmer effect from the design system.

**Fix:** Ensure the base `Skeleton` component uses the `.shimmer` CSS class for a polished loading feel.

**File:** `src/components/ui/skeleton.tsx`

## Technical Details

### Desktop Panel Transitions (StandardMode)
Replace the conditional block with:
```text
<AnimatePresence mode="wait">
  <motion.div
    key={activePanel}
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -6 }}
    transition={{ duration: 0.2 }}
    className="flex-1 flex flex-col"
  >
    <Suspense fallback={<PanelFallback />}>
      {renderDesktopPanel()}
    </Suspense>
  </motion.div>
</AnimatePresence>
```

### Input Glow Effect
```text
focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]
focus-visible:border-primary/50
transition-shadow duration-200
```

### Dialog Backdrop
```text
DialogOverlay: bg-black/40 backdrop-blur-sm
DialogContent: animate-in fade-in-0 zoom-in-95 → spring entrance
```

## Files Modified Summary
- `src/components/layout/StandardMode.tsx` — AnimatePresence panel transitions
- `src/pages/Onboarding.tsx` — design system alignment
- `src/components/ui/sonner.tsx` — glassmorphism toast styling
- `src/components/ui/dialog.tsx` — backdrop blur, spring entrance
- `src/components/ui/sheet.tsx` — backdrop blur
- `src/components/ui/input.tsx` — focus glow
- `src/components/ui/textarea.tsx` — focus glow
- `src/components/ui/button.tsx` — active scale, micro-interactions
- `src/components/ui/skeleton.tsx` — shimmer effect
- `src/pages/NotFound.tsx` — branded 404 page

