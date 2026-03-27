# UX Polish & Repo Cleanup

## TL;DR

> **Quick Summary**: Add explanatory copy to the create-plan page (header blurb + mode descriptions) and clean up untracked files.
> 
> **Deliverables**:
> - Blurb under "Create a plan" heading
> - Inline helper text for Poll/Availability mode toggle
> - Deleted PNG screenshots, gitignored build artifacts
> 
> **Estimated Effort**: Quick
> **Parallel Execution**: YES — 2 waves
> **Critical Path**: Task 1, 2, 3 are independent → Task 4 commits all

---

## Context

### Original Request
User received feedback that: (1) the app doesn't explain what it does, (2) Poll/Availability modes aren't clear, (3) untracked files need cleanup.

### Interview Summary
- **Blurb copy**: "Find a time that works for everyone. Create a plan, share the link, and let your group vote on times — no sign-up required." — approved
- **Mode explanation**: Inline text below toggle buttons, updates based on selected mode — approved
- **PNGs**: Delete them (not needed)
- **tsconfig.tsbuildinfo**: Add to .gitignore

---

## Work Objectives

### Core Objective
Improve first-time clarity of the create-plan page and clean up the repo.

### Concrete Deliverables
- Updated `projects/web/src/routes/index.tsx` with blurb and mode descriptions
- Deleted `poll-mixed-state.png` and `poll-yes-state.png`
- Updated `.gitignore` with `*.tsbuildinfo`

### Must Have
- Blurb appears directly below the "Create a plan" heading
- Mode description text updates when toggling between Poll and Availability
- PNGs deleted from working directory
- `*.tsbuildinfo` in .gitignore

### Must NOT Have
- No tooltip components — use inline Text
- No changes to functionality or layout beyond the copy additions
- No new dependencies

---

## Verification Strategy

### Test Decision
- **Automated tests**: None — copy-only changes
- **Agent-Executed QA**: Visual verification via dev server

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (All independent):
├── Task 1: Add header blurb [quick]
├── Task 2: Add mode description text [quick]
├── Task 3: Git cleanup — delete PNGs, update .gitignore [quick]

Wave 2 (After Wave 1):
└── Task 4: Commit all changes [git]
```

---

## TODOs

- [ ] 1. Add blurb under "Create a plan" heading

  **What to do**:
  - In `projects/web/src/routes/index.tsx`, add a `<Text>` element after the `<Heading>` with content: "Find a time that works for everyone. Create a plan, share the link, and let your group vote on times — no sign-up required."
  - Use `color="foreground-muted"` and `mb={4}` (adjust the Heading's `mb` if needed to avoid double spacing)

  **Must NOT do**:
  - Don't change any other elements or layout

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `projects/web/src/routes/index.tsx:152-155` — The Heading element to add the blurb after. Uses Tosui `<Text>` and `<Heading>` components already imported.

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: Blurb visible on create page
    Tool: Playwright
    Steps:
      1. Navigate to http://localhost:5173/
      2. Assert text "Find a time that works for everyone" is visible below the h2 "Create a plan"
    Expected Result: Blurb text visible, muted color, below heading
    Evidence: .sisyphus/evidence/task-1-blurb-visible.png
  ```

  **Commit**: YES (groups with Task 4)

- [ ] 2. Add inline mode description text

  **What to do**:
  - In `projects/web/src/routes/index.tsx`, add a `<Text>` element after the Poll/Availability `<HStack>` button group that shows contextual help text based on the current `mode` state
  - When `mode === "poll"`: "You pick specific time slots. Participants vote on which ones work."
  - When `mode === "availability"`: "Participants share when they're free. You find the overlap."
  - Use `size="sm"` and `color="foreground-muted"`

  **Must NOT do**:
  - Don't use a tooltip component
  - Don't change button styling or behavior

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `projects/web/src/routes/index.tsx:157-170` — The HStack containing Poll/Availability buttons. Add the Text element right after this HStack, inside the same VStack.
  - `projects/web/src/routes/index.tsx:53` — The `mode` state variable to key off of.

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: Poll mode shows correct description
    Tool: Playwright
    Steps:
      1. Navigate to http://localhost:5173/
      2. Poll mode is selected by default
      3. Assert text "You pick specific time slots" is visible
    Expected Result: Poll description text shown
    Evidence: .sisyphus/evidence/task-2-poll-description.png

  Scenario: Availability mode shows correct description
    Tool: Playwright
    Steps:
      1. Navigate to http://localhost:5173/
      2. Click the "Availability" button
      3. Assert text "Participants share when they're free" is visible
      4. Assert text "You pick specific time slots" is NOT visible
    Expected Result: Availability description text shown, poll description hidden
    Evidence: .sisyphus/evidence/task-2-availability-description.png
  ```

  **Commit**: YES (groups with Task 4)

- [ ] 3. Git cleanup — delete PNGs, gitignore build artifacts

  **What to do**:
  - Delete `poll-mixed-state.png` and `poll-yes-state.png` from repo root
  - Add `*.tsbuildinfo` to `.gitignore`

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `.gitignore` — Existing gitignore file at repo root

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: PNGs deleted and artifacts ignored
    Tool: Bash
    Steps:
      1. Run: ls poll-mixed-state.png poll-yes-state.png 2>&1
      2. Assert: "No such file or directory" for both
      3. Run: grep 'tsbuildinfo' .gitignore
      4. Assert: line exists
      5. Run: git status --porcelain
      6. Assert: tsconfig.tsbuildinfo does NOT appear in output
    Expected Result: PNGs gone, tsbuildinfo gitignored
    Evidence: .sisyphus/evidence/task-3-cleanup-verified.txt
  ```

  **Commit**: YES (groups with Task 4)

- [ ] 4. Commit all changes

  **What to do**:
  - Stage all changes and deleted files
  - Commit with message below

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Tasks 1, 2, 3

  **Commit**: YES
  - Message: `chore: add explanatory copy to create page, clean up repo`
  - Files: `projects/web/src/routes/index.tsx`, `.gitignore`, deleted PNGs
  - Pre-commit: `cd projects/web && npx tsc --noEmit`

---

## Success Criteria

### Verification Commands
```bash
pnpm dev  # Visit localhost:5173, verify blurb and mode text visible
git status  # Clean working tree, no untracked PNGs or tsbuildinfo
```

### Final Checklist
- [ ] Blurb visible under heading
- [ ] Mode description updates on toggle
- [ ] PNGs deleted
- [ ] tsbuildinfo gitignored
- [ ] All committed
