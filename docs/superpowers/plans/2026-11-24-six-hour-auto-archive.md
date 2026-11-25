# Six-Hour Auto Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Archive regular tabs after six hours without selection and let the user restore them in their original space.

**Architecture:** Add a per-profile persistent archive store and a browser-window manager that tracks tab selection timestamps, checks eligibility, and closes expired tabs. Add a Library Archive section that restores a saved URL in the recorded space or deletes an archive entry.

**Tech Stack:** JavaScript ES modules, Gecko `JSONFile`, Zen Library Lit components, SessionStore/Spaces, browser-chrome Mochitests.

**Spec:** [Personal Zen Fork Design](../specs/2026-11-24-personal-zen-fork-design.md)

**Prerequisite:** Complete [Fork Foundation](2026-11-24-fork-foundation.md) first.

## Global Constraints

- Keep all product changes in the user's Zen desktop fork.
- Support macOS first; skip private windows and private tabs.
- Archive six elapsed hours after last selection, including browser quit and Mac sleep.
- Do not archive the current tab, pinned tabs, Essentials, or tabs with active audio.
- Keep URL, title, archive time, owning space, and container context until restored or deleted.
- Restore by reopening the URL in its original space and container; a six-hour grace period applies to existing tabs without a trustworthy timestamp.
- Keep MPL-2.0 notices intact and use the bootstrapped `engine` checkout.

## Review Focus

- A tab expires at 6 hours and not before; test both sides of the threshold.
- Current, pinned, Essential, audible, and private tabs stay open; assert each exclusion.
- An archived entry survives browser restart and remains available after many later closes; test persistence beyond SessionStore's recently-closed limit.
- Restoring reopens in the original space and removes the archive entry; test same- and different-space restore flows.
- A tab without prior selection metadata gets a six-hour grace period; test first-start migration behavior.

---

### Task 1: Add persistent archive storage and eligibility manager

**Files:**
- Create: `src/zen/tabs/ZenAutoArchiveStore.sys.mjs`
- Create: `src/zen/tabs/ZenAutoArchiveManager.sys.mjs`
- Modify: `src/zen/tabs/moz.build`
- Modify: `src/zen/common/ZenPreloadedScripts.js`
- Create: `prefs/zen/auto-archive.yaml`
- Modify: `src/zen/tests/moz.build`
- Create: `src/zen/tests/auto_archive/browser.toml`
- Create: `src/zen/tests/auto_archive/browser_auto_archive.js`

**Interfaces:**
- `ZenAutoArchiveStore.add(entry) -> Promise<void>` persists `{ id, url, title, workspaceUuid, userContextId, archivedAt }` in `PathUtils.profileDir/zen-auto-archive.json`.
- `ZenAutoArchiveStore.list() -> Promise<entry[]>` returns entries newest first.
- `ZenAutoArchiveStore.remove(id) -> Promise<void>` deletes an entry.
- `window.gZenAutoArchiveManager.runSweep(now = Date.now()) -> Promise<void>` archives eligible expired tabs and removes their browser tabs.

- [ ] **Step 1: Add failing tests for timing and eligibility**

Use a test timestamp 6 hours old and one 6 hours minus 1 ms old. Assert only the expired unpinned regular tab archives. Assert selected, pinned, Essential, audible, and private tabs remain open.

- [ ] **Step 2: Register the auto-archive browser test manifest**

Add `auto_archive/browser.toml` to `src/zen/tests/moz.build` and set an enabled test preference with the six-hour default available to production profiles.

- [ ] **Step 3: Implement the profile-local JSON store**

Create `ZenAutoArchiveStore.sys.mjs` using Gecko `JSONFile` in the profile directory. Store URL/title/owner/container/time only; do not serialize page content or browsing telemetry.

- [ ] **Step 4: Implement the manager and scheduler**

Create `ZenAutoArchiveManager.sys.mjs` and expose it as `window.gZenAutoArchiveManager`; use `tab.lastAccessed` as the selection timestamp, update missing timestamps on `TabSelect`, sweep on startup and after selection changes, and apply the six-hour grace period where an old tab has no reliable timestamp.

- [ ] **Step 5: Wire manager startup after restored spaces and tabs**

Load the manager from `ZenPreloadedScripts.js` and initialize after `SessionStore.promiseAllWindowsRestored` and `gZenWorkspaces.promiseInitialized` resolve. Do not start in private windows.

- [ ] **Step 6: Run the focused auto-archive test**

Run: `python3 scripts/run_tests.py auto_archive/browser_auto_archive.js`
Expected: threshold, exclusion, restart, and grace-period assertions pass.

- [ ] **Step 7: Commit the archive store and scheduler**

Run: `git add src/zen/tabs/ZenAutoArchiveStore.sys.mjs src/zen/tabs/ZenAutoArchiveManager.sys.mjs src/zen/tabs/moz.build src/zen/common/ZenPreloadedScripts.js prefs/zen/auto-archive.yaml src/zen/tests/moz.build src/zen/tests/auto_archive/browser.toml src/zen/tests/auto_archive/browser_auto_archive.js && git commit -m "feat: archive inactive tabs after six hours"`
Expected: one focused commit contains archive persistence, scheduling, exclusions, and tests.

### Task 2: Add the persistent Library Archive view

**Files:**
- Create: `src/zen/library/sections/ZenLibraryArchiveSection.mjs`
- Modify: `src/zen/library/ZenLibrary.mjs`
- Modify: `src/zen/library/moz.build`
- Modify: `locales/en-US/browser/browser/zen-library.ftl`
- Modify: `src/zen/tests/library/browser.toml`
- Create: `src/zen/tests/library/browser_library_auto_archive.js`

**Interfaces:**
- Consumes: `ZenAutoArchiveStore.list()` and `ZenAutoArchiveStore.remove(id)` from Task 1.
- Produces: Library section id `archive` with actions to reopen an entry in its stored `workspaceUuid` or remove it.

- [ ] **Step 1: Add failing Library tests**

Assert the Archive section lists a stored entry, restore opens its URL in the recorded space and removes it from Archive, and delete removes it without opening.

- [ ] **Step 2: Register and localize the Archive section**

Register `ZenLibraryArchiveSection` in `ZenLibrary.mjs`, add it to `library/moz.build`, and add labels/actions to `zen-library.ftl`.

- [ ] **Step 3: Implement restore and delete actions**

Use the stored workspace UUID and `userContextId` to activate or route the restored tab in its original space and container. Remove the entry only after a successful restore; leave it available if opening fails.

- [ ] **Step 4: Run Archive and Library tests**

Run: `python3 scripts/run_tests.py library/browser_library_auto_archive.js` and `python3 scripts/run_tests.py library`
Expected: restore/delete behavior passes without breaking existing Library sections.

- [ ] **Step 5: Commit the Library Archive view**

Run: `git add src/zen/library/sections/ZenLibraryArchiveSection.mjs src/zen/library/ZenLibrary.mjs src/zen/library/moz.build locales/en-US/browser/browser/zen-library.ftl src/zen/tests/library/browser.toml src/zen/tests/library/browser_library_auto_archive.js && git commit -m "feat: add Library archive view"`
Expected: one focused commit contains the persistent Archive list and its restore/delete actions.
