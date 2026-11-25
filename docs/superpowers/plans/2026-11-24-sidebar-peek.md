# Sidebar Peek Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Briefly reveal Zen's collapsed sidebar after tab and space changes without changing the saved sidebar preference.

**Architecture:** Put the transient reveal timer in `ZenVerticalTabsManager`, which owns sidebar layout state. Trigger it for `TabSelect` and after a successful space switch in `ZenSpaceManager`; use the existing expanded-state attributes without writing `zen.view.sidebar-expanded`.

**Tech Stack:** JavaScript ES modules, XUL/DOM, Gecko browser-chrome Mochitests, `mach test`.

**Spec:** [Personal Zen Fork Design](../specs/2026-11-24-personal-zen-fork-design.md)

**Prerequisite:** Complete [Fork Foundation](2026-11-24-fork-foundation.md) first.

## Global Constraints

- Keep all product changes in the user's Zen desktop fork.
- Support macOS first; the behavior must use Zen's existing sidebar layout state.
- Reveal for 3,000 ms and leave the saved `zen.view.sidebar-expanded` preference unchanged.
- Keep MPL-2.0 notices intact.
- Use the bootstrapped `engine` checkout from the fork-foundation plan.

## Review Focus

- Collapsed preference stays false after the timer; assert both the pref and visual attribute.
- A second tab/space switch resets the timer; assert the sidebar remains visible until 3,000 ms after the latest switch.
- A manually expanded sidebar remains expanded when the timer fires; assert the pref remains true.
- Both tab selection and workspace change trigger the same transient behavior; cover each path.
- Hidden windows/private windows do not throw during reveal; run the existing spaces suite in addition to the focused test.

---

### Task 1: Add the transient sidebar reveal

**Files:**
- Modify: `src/zen/common/modules/ZenVerticalTabsManager.mjs`
- Modify: `src/zen/spaces/ZenSpaceManager.mjs`
- Modify: `src/zen/tests/spaces/browser.toml`
- Create: `src/zen/tests/spaces/browser_sidebar_peek.js`

**Interfaces:**
- Produces: `gZenVerticalTabsManager.showTransientSidebar(durationMs = 3000)`; callers do not change the saved preference.
- Consumes: the existing root/toolbox/tab-container `zen-sidebar-expanded` attributes and the existing space-switch completion path.

- [x] **Step 1: Add a failing browser-chrome test for tab-switch reveal**

Create `browser_sidebar_peek.js`. Set `zen.view.sidebar-expanded=false`, select another tab, and assert the runtime sidebar state becomes expanded while the preference remains false.

- [x] **Step 2: Run the focused test and confirm it fails**

Run: `python3 scripts/run_tests.py spaces/browser_sidebar_peek.js`
Expected: FAIL because no transient reveal is wired.

- [x] **Step 3: Implement `showTransientSidebar(durationMs = 3000)`**

In `ZenVerticalTabsManager.mjs`, apply the expanded runtime attributes without writing `zen.view.sidebar-expanded`; clear the prior timer before each reveal and collapse after the requested duration only if the saved preference is still false.

- [x] **Step 4: Wire tab and space transitions**

Register a `TabSelect` listener in `ZenVerticalTabsManager.init()`. Call the same method after `#performWorkspaceChange` completes in `ZenSpaceManager.mjs` so direct space switches are covered even if selection does not change.

- [x] **Step 5: Add timer and manual-override assertions**

Assert the runtime state returns to collapsed after 3,000 ms, a repeated transition restarts that interval, and a manually expanded sidebar stays expanded.

- [ ] **Step 6: Run the focused test and spaces suite**

Run: `python3 scripts/run_tests.py spaces/browser_sidebar_peek.js` and `python3 scripts/run_tests.py spaces`
Expected: both pass; the preference assertions remain unchanged across the transient state.

- [x] **Step 7: Commit the sidebar behavior and tests**

Run: `git add src/zen/common/modules/ZenVerticalTabsManager.mjs src/zen/spaces/ZenSpaceManager.mjs src/zen/tests/spaces/browser.toml src/zen/tests/spaces/browser_sidebar_peek.js && git commit -m "feat: briefly reveal sidebar after switches"`
Expected: one focused commit contains the transient reveal and its regression tests.
