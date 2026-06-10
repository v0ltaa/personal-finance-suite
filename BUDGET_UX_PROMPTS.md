# Budget Designer — UI/UX Improvement Prompts

Generated from a full UI/UX review of `src/pages/BudgetDesigner.jsx` and `src/components/budget/*`.
Each prompt is self-contained — paste it into Claude Code as-is. They're ordered by priority;
do them top to bottom. Tick them off as they're completed.

- [x] Prompt 1 — Critical interaction bugs *(done in review session)*
- [x] Prompt 2 — Mobile & touch usability *(done in review session)*
- [x] Prompt 3 — Shared accessible Modal component *(done in review session)*
- [x] Prompt 4 — Wizard navigation (Back button, scroll-to-top) *(done in review session)*
- [ ] Prompt 5 — Save feedback (toasts) + draft autosave
- [ ] Prompt 6 — Accessibility pass
- [ ] Prompt 7 — Typography & visual hierarchy cleanup
- [ ] Prompt 8 — Dark-mode-safe charts
- [ ] Prompt 9 — Line-item editing discoverability & keyboard flow
- [ ] Prompt 10 — Empty states, mode-change warning, shared rule editor

**Overview-screen prompts** (the screen used 95% of the time — prioritize these over 6–10):

- [x] Prompt 11 — Fix the Savings card's three conflicting totals *(done in review session)*
- [ ] Prompt 12 — Inline editing on overview cards (no modal round-trip)
- [ ] Prompt 13 — Replace the unreadable By Category donut with a ranked bar list
- [ ] Prompt 14 — Summary-strip clarity, £ deltas on gauges, monthly/annual toggle

---

## Prompt 1 — Critical interaction bugs

> In the Budget Designer (`src/pages/BudgetDesigner.jsx`, `src/components/budget/StepSummary.jsx`, `src/components/budget/StepIncome.jsx`), fix these four bugs:
>
> 1. **Load dialog: deleting a budget doesn't refresh the list.** `savedBudgets` is computed from `loadBudgets()` during render, and `handleDelete` writes to localStorage without any setState, so the deleted row stays visible. Add a `budgetsVersion` state (or hold the list in state), bump it in `handleDelete`, and also ask for confirmation before deleting (the trash icon currently deletes instantly with no undo). If the deleted budget is the currently loaded one, clear `loadedBudgetId`.
> 2. **Summary "Edit X" buttons go to the wrong steps.** In `StepSummary.jsx` the buttons map `["Income","Committed","Essentials","Savings","Lifestyle"]` to indices 0–4, but step 0 is Setup, so "Edit Income" opens Setup, etc. Also, in "realistic" mode (`budget.budgetMode === "realistic"`) step 4 is Lifestyle and step 5 is Savings (swapped vs traditional). Build the label→step mapping from the budget mode so each button opens the right step.
> 3. **Reset wipes data without confirmation.** `handleReset` in `BudgetDesigner.jsx` (triggered by "Start Fresh" on the summary and "New" in the overview header) clears all inputs immediately. Add a confirm step ("Start a fresh budget? Unsaved changes will be lost.").
> 4. **`StepIncome` syncs state during render.** It does `Promise.resolve().then(() => onChange(...))` inside the render body to push `monthlyTakeHome` up. Replace with a `useEffect` keyed on `monthlyTakeHome`.

## Prompt 2 — Mobile & touch usability

> In the Budget Designer components (`src/components/budget/`), fix touch/mobile issues:
>
> 1. **Row delete buttons are invisible on touch devices.** `BudgetLineItem.jsx` and `EditableRow` in `BudgetOverview.jsx` use `opacity-0 group-hover:opacity-100` for the remove (X) button — hover doesn't exist on touch, so items can't be deleted on mobile. Make them always visible on touch / small screens (e.g. `opacity-100 sm:opacity-0 sm:group-hover:opacity-100`) or use a pointer-media query.
> 2. **Overview header toolbar overflows on mobile.** In `BudgetOverview.jsx` the header has Save/Load/Settings/Export/New buttons in a non-wrapping flex row. Make it wrap (`flex-wrap`) and consider collapsing less-used actions on small screens.
> 3. **Progress indicator gives no context on mobile.** `ProgressIndicator.jsx` hides all labels below `sm`, showing only numbered dots. Show at least the active step's label on mobile, e.g. the active pill keeps its label, or add a "Step 3 of 7 · Committed" line under the pills.
> 4. **Frequency dropdown labels are cryptic.** `BudgetLineItem.jsx` and `EditableRow` render options as `/{f.value.slice(0, 2)}` producing "/we", "/mo", "/qu", "/an". Use readable short labels: "/wk", "/mo", "/qtr", "/yr" (map from `FREQUENCY_OPTIONS` in `src/lib/ukTax.js`, e.g. add a `short` field there).

## Prompt 3 — Shared accessible Modal component

> The Budget Designer has six hand-rolled modal dialogs: save, load, settings in `src/pages/BudgetDesigner.jsx`, and the category EditDialog plus income edit dialog in `src/components/budget/BudgetOverview.jsx`. None support Escape-to-close, focus trapping, body scroll lock, or dialog ARIA roles.
>
> Create a reusable `Modal` component in `src/components/ui/modal.jsx` that:
> - renders a backdrop + centered Card, closes on backdrop click and Escape,
> - sets `role="dialog"`, `aria-modal="true"`, and labels itself from a `title` prop,
> - locks body scroll while open, focuses the dialog on open and restores focus on close,
> - accepts `maxWidth` and an optional footer, with a standard header (title + X close button),
> - uses the existing Card / Button components from `src/components/ui/` and the existing `animate-fade-in` style.
>
> Then refactor all six dialogs to use it, keeping their current content and behavior identical.

## Prompt 4 — Wizard navigation

> Improve the Budget Designer wizard navigation (`src/pages/BudgetDesigner.jsx` and the `Step*.jsx` components in `src/components/budget/`):
>
> 1. **Add a Back button.** Every step except the first shows only "Continue" — the only way back is the progress pills. Add a secondary "Back" button next to Continue on each step (steps receive an `onBack` prop; BudgetDesigner decrements the step).
> 2. **Scroll to top on step change.** Advancing from a long step leaves the user mid-page on the next step. Scroll the window to top when `step` changes.
> 3. **Show step position.** Add "Step N of 7" context near the step heading (helps mobile especially).
> Keep the existing pill click-navigation working as-is.

## Prompt 5 — Save feedback (toasts) + draft autosave

> The Budget Designer (`src/pages/BudgetDesigner.jsx`) gives no feedback after save/load/delete/export, and all wizard progress is lost on refresh unless the user explicitly saves. `react-hot-toast` is already a dependency (check `src/App.jsx` or main layout for an existing `<Toaster>`; add one if missing).
>
> 1. Show success toasts: "Budget saved", "Budget loaded", "Budget deleted", "CSV exported" (export lives in `src/components/budget/BudgetOverview.jsx` — `exportBudgetCSV`).
> 2. **Draft autosave:** persist the in-progress wizard state (income, committed, essentials, savings, discretionary, step, completedSteps, budgetMode, budgetRule, viewMode) to a `budget_designer_draft` localStorage key, debounced ~500ms. On mount, if a draft exists and differs from the last saved budget, restore it. Clear the draft on explicit Save and on Reset.
> 3. **Unsaved-changes indicator:** when current state differs from the loaded saved budget, show a subtle dot/"Unsaved changes" hint near the Save button in both wizard header and overview header.

## Prompt 6 — Accessibility pass

> Do an accessibility pass over the Budget Designer (`src/pages/BudgetDesigner.jsx`, `src/components/budget/*`, `src/components/Tip.jsx`):
>
> 1. **Toggle switches** (employer-match toggles in `StepIncome.jsx`, single-person toggle in `BudgetLineItem.jsx`, employer-match-in-savings toggle in the settings dialog in `BudgetDesigner.jsx`) are bare `<button>`s. Add `role="switch"`, `aria-checked`, and an accessible name. Consider extracting a shared `Switch` component in `src/components/ui/switch.jsx` since the same markup is copy-pasted 3+ times.
> 2. **Labels:** form labels aren't associated with inputs anywhere — add `htmlFor`/`id` pairs (generate ids with `useId`).
> 3. **Icon-only buttons** (X close buttons, trash delete, remove-row X) need `aria-label`s.
> 4. **Tip component** (`src/components/Tip.jsx`) is hover/click only — make it a focusable `<button>` with `aria-expanded` and `aria-describedby`, opening on focus and closing on blur/Escape.
> 5. Ensure warning/danger states don't rely on color alone (add icons or text where missing).

## Prompt 7 — Typography & visual hierarchy cleanup

> The Budget Designer components (`src/components/budget/*`, dialogs in `src/pages/BudgetDesigner.jsx`) mix `text-[10px]`, `text-[11px]`, `text-xs`, and `text-sm` arbitrarily — e.g. helper text is 10px in one card and xs in another; section labels vary between 10px-uppercase-tracking and xs-medium. Audit and normalize to a small scale:
> - section/field labels: one consistent style (suggest `text-xs font-medium text-muted-foreground`),
> - helper/caption text: one consistent style (suggest `text-xs text-muted-foreground`; reserve 10–11px only for dense stat-tile captions),
> - keep `tabular-nums` on all money figures (a few are missing it).
> Don't change layout or copy — only normalize the type styles, and make hit targets at least 32px tall for interactive elements that are currently tiny (e.g. preset chips, add-item buttons).

## Prompt 8 — Dark-mode-safe charts

> The Budget Designer charts hardcode light-theme colors: in `src/components/budget/BudgetOverview.jsx` the doughnut charts use `borderColor: "hsl(40, 30%, 97%)"` (cream — looks broken in dark mode) and a hardcoded `PIE_COLORS` array; in `src/components/budget/StepSummary.jsx` the bar chart hardcodes HSL fills and doesn't theme axis tick colors. The app uses CSS custom properties for theming (see `src/index.css` / Tailwind config for tokens like `--card`, `--border`, `--muted-foreground`).
>
> Read the theme tokens at render time (`getComputedStyle(document.documentElement).getPropertyValue(...)`) or via a small hook, and:
> 1. set doughnut `borderColor` to the card/background token,
> 2. set chart.js tick/legend label colors to the muted-foreground token,
> 3. keep categorical palettes but verify they have adequate contrast on both themes,
> 4. re-render charts when the theme changes if the app has a theme toggle.

## Prompt 9 — Line-item editing discoverability & keyboard flow

> In `src/components/budget/BudgetLineItem.jsx`, item names are edited by clicking the plain-text name — there's no visual affordance, so users don't discover renaming. Improve editing UX:
> 1. Show a subtle edit affordance on the name (e.g. a small pencil icon on hover/focus, or underline-dotted styling) and make the name a real focusable button with `aria-label="Rename {name}"`.
> 2. When the name input opens, select the existing text. Escape cancels (reverts), Enter commits.
> 3. **Keyboard flow:** pressing Enter in an amount field should move focus to the next row's amount field so users can fill a list quickly.
> 4. Apply the same Enter-to-next behavior to `EditableRow` in `src/components/budget/BudgetOverview.jsx`.

## Prompt 10 — Empty states, mode-change warning, shared rule editor

> Final polish pass on the Budget Designer:
> 1. **Mode change mid-wizard:** in `src/pages/BudgetDesigner.jsx`, switching budget approach (settings dialog or StepSetup) silently swaps the order of the Savings and Lifestyle steps (labels come from `stepLabels`). If the user has completed steps past 3 and switches mode, show a brief note/toast that the remaining step order changed.
> 2. **Council Tax fragility:** the single-person discount and helpers key off the literal item name `"Council Tax"` (see `effectiveMonthly` in `BudgetDesigner.jsx`, `StepCommitted.jsx`, `BudgetOverview.jsx`, and `BudgetLineItem.jsx`). Renaming the row silently loses the discount. Add an item flag (e.g. `supportsSinglePersonDiscount: true` on the default item) and key the logic off the flag, falling back to the name match for old saved budgets.
> 3. **Shared budget-rule editor:** the Needs/Wants/Savings percent inputs + presets block is copy-pasted in `StepSetup.jsx` and the settings dialog in `BudgetDesigner.jsx`. Extract a `BudgetRuleEditor` component in `src/components/budget/` and use it in both places.
> 4. **Empty states:** "No items yet" in overview cards is dead text — make it a click target ("+ Add item") that opens the edit dialog for that category.

---

# Overview-screen prompts (added after live review of a real budget)

## Prompt 11 — Fix the Savings card's three conflicting totals

> In `src/components/budget/BudgetOverview.jsx`, the Savings category card is confusing when there are no named savings goals but there IS auto-saved surplus and an employer pension match. It currently shows, stacked: "No items yet" (italic dead text), an "Unallocated (auto-saved)" chip, an "Employer pension match" chip, "Total £X/mo", and "Including employer match £Y/mo" — three different totals and a "no items" message that contradicts them.
>
> Restructure the card:
> 1. Replace "No items yet" with an actionable "+ Add a savings goal" button that opens the savings edit dialog (`setEditingCategory("savings")` — note the card itself is already clickable, so stop propagation).
> 2. Present a single visual hierarchy: named goals first, then "Auto-saved surplus" and "Employer match" as clearly-secondary rows (not boxed chips), then ONE total row. If the employer match is counted in the savings % (`budgetRule.countEmployerMatchInSavings`), the headline total should be the including-match figure with a small breakdown line beneath; otherwise show the take-home savings total with the match as a "+£X outside take-home" footnote.
> 3. Make sure the ring-gauge "Savings" tile at the top of the page and this card agree on which figure they display, so the % and the £ amount can be cross-read.

## Prompt 12 — Inline editing on overview cards

> The Budget Overview (`src/components/budget/BudgetOverview.jsx`) is the screen used most, but every amount change requires opening a modal (click card → EditDialog → find row → edit → close). Add inline editing on the category cards:
> 1. Clicking an amount in a `LineRow` turns it into the same raw-text-while-focused £ input used in `EditableRow` (keep decimals/formula support — the `rawInput` pattern). Committing on blur/Enter updates the item via the existing `onChange*` props.
> 2. The card's click-to-open-dialog behavior must not fight inline editing: only open the dialog from the header/edit icon, not from clicks on rows.
> 3. Keep the modal for adding/removing/renaming items and changing frequency; inline is for amount tweaks only.
> 4. Items with amount 0 are currently hidden from cards — add a subtle "+ N more at £0" expander so zero items can be brought back without the modal.

## Prompt 13 — Replace the By Category donut with a ranked bar list

> In `src/components/budget/BudgetOverview.jsx`, the "By Category" doughnut chart is unreadable with a real budget: ~20 slices, many under 1%, and a multi-row legend that overflows the card. Replace it with a ranked horizontal bar list:
> - one row per category: name, thin proportional bar, £/mo, % of take-home;
> - sort descending, show the top 10, group the rest into "Other (N)" with an expand toggle;
> - reuse the existing `PIE_COLORS` for bar colors; no chart.js needed for this panel.
> Keep the "Needs · Wants · Savings" doughnut (3 segments — that one works) but fix its hardcoded `borderColor: "hsl(40, 30%, 97%)"` to read the card background token so it isn't broken in dark mode.

## Prompt 14 — Summary-strip clarity, £ deltas on gauges, monthly/annual toggle

> Polish the Budget Overview header area in `src/components/budget/BudgetOverview.jsx`:
> 1. **"Daily spend" is ambiguous.** It's `(takeHome − committed − essentials − savings) / 30` — i.e. lifestyle + unallocated per day. Rename it "Fun money / day" and add a tooltip (`Tip` component from `src/components/Tip.jsx`) explaining the formula.
> 2. **Unallocated tile** should hint at where it flows: small caption "auto-saved" (lifestyle-first) or "added to wants" (savings-first), matching the existing effectiveSavings/effectiveWants logic.
> 3. **Ring gauges**: under each gauge, show the £ gap to target instead of making the user do mental math — e.g. "£38.73 under cap" / "£12 over cap" / "£43 above minimum", colored to match the ring.
> 4. **Monthly/annual toggle** in the page header ("All figures are monthly" becomes a /mo · /yr segmented control) that multiplies all displayed amounts by 12 in annual mode — display only, no state model changes.
> 5. **Income card in manual mode** shows "Manual take-home £2,070" and "Net take-home £2,070/mo" — redundant; show one row plus the pension/match lines if set.
