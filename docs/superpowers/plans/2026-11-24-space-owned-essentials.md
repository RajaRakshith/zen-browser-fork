# Space-Owned Essentials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Essential one owning space and preserve that owner through local restore and Zen Sync on updated fork devices.

**Architecture:** Store the owner space UUID on Essential tabs, key their visible sections by owner space (and preserve container context), migrate currently shared Essentials into one fallback space, and project/apply `workspaceUuid` in the existing Spaces Sync model.

**Tech Stack:** JavaScript ES modules, SessionStore, Zen Spaces Sync, browser-chrome Mochitests.

**Spec:** [Personal Zen Fork Design](../specs/2026-11-24-personal-zen-fork-design.md)

**Prerequisite:** Complete [Fork Foundation](2026-11-24-fork-foundation.md) first.

## Global Constraints

- Keep all product changes in the user's Zen desktop fork.
- Support macOS first; keep the feature in Zen's built-in Spaces and Essentials code.
- An Essential belongs to one space even when multiple spaces use the same container.
- Migrate old shared Essentials to the first restored space, or Zen's default `Space`, without duplicating tabs.
- Preserve the owning `workspaceUuid` through Sync on updated fork devices; stock/older clients are outside the supported sync set.
- Keep MPL-2.0 notices intact and use the bootstrapped `engine` checkout.

## Review Focus

- Two spaces with the same container show different Essentials; test same-container isolation.
- Spaces with different containers preserve cookie context while Essentials remain space-owned; test container-specific behavior.
- Old Essentials without an owner migrate once to the fallback space; assert no duplicate tabs after repeated startup.
- Sync projection includes the owner UUID and apply restores it; test both directions.
- Removing or moving an Essential updates its owner and visible section; test pin, unpin, move, and close paths.

---

### Task 1: Make Essential ownership space-specific

**Files:**
- Modify: `src/zen/spaces/ZenSpaceManager.mjs`
- Modify: `src/zen/tabs/ZenPinnedTabManager.mjs`
- Modify: `src/zen/sessionstore/ZenWindowSync.sys.mjs`
- Modify: `src/zen/tests/spaces/browser.toml`
- Create: `src/zen/tests/spaces/browser_essentials_per_space.js`
- Modify: `src/zen/tests/container_essentials/browser_container_specific_essentials.js` if current assertions rely on cross-space sharing.

**Interfaces:**
- Produces: `gZenWorkspaces.getEssentialsSection(container = 0, workspaceUuid = this.activeWorkspace)` returning the section for that exact space/container pair.
- Consumes: a tab element's `zen-workspace-id` as the owner when supplied; explicit `workspaceUuid` for session-restore data; when missing during migration, use the first restored workspace UUID.

- [x] **Step 1: Add failing tests for two spaces that share one container**

Create a test that adds an Essential in one space and asserts it is absent from a second space with the same container; assert a second Essential can be added to the second space independently.

- [x] **Step 2: Run the focused spaces test and confirm it fails**

Run: `python3 scripts/run_tests.py spaces/browser_essentials_per_space.js`
Expected: FAIL because Essentials are currently visible by container, not by space.

- [x] **Step 3: Key Essential sections by space and container**

Update `getEssentialsSection` and the visibility predicate in `ZenSpaceManager.mjs` to require the owner UUID to match the active workspace. Keep container IDs as cookie-context metadata and as a secondary section key. Update workspace loops to pass each loop's UUID explicitly, and update `#sessionRestoreContainer` to use `aTabData.zenWorkspace` rather than placing all Essentials in a shared section.

- [x] **Step 4: Assign and preserve an owner when pinning, moving, or unpinning**

Update `ZenPinnedTabManager.mjs` so adding an Essential assigns the current/origin space, and removing it returns it to the appropriate owning/current workspace. Do not clear `zen-workspace-id` for Essentials. Update `ZenWindowSync.sys.mjs` so moving an Essential across windows inserts it into the target tab's owner-space section.

- [x] **Step 5: Migrate old shared Essentials once**

During workspace restore, assign Essential tabs with no owner to the first restored workspace; if no spaces are in the session, use the generated default `Space`. Preserve their existing `usercontextid` values.

- [ ] **Step 6: Run spaces and container Essentials tests**

Run: `python3 scripts/run_tests.py spaces` and `python3 scripts/run_tests.py container_essentials`
Expected: per-space isolation and existing container context behavior pass.

- [x] **Step 7: Commit the space-owned Essential model**

Run: `git add src/zen/spaces/ZenSpaceManager.mjs src/zen/tabs/ZenPinnedTabManager.mjs src/zen/sessionstore/ZenWindowSync.sys.mjs src/zen/tests/spaces/browser.toml src/zen/tests/spaces/browser_essentials_per_space.js src/zen/tests/container_essentials/browser_container_specific_essentials.js && git commit -m "feat: scope Essentials to spaces"`
Expected: one focused commit contains per-space display, migration, and browser tests.

### Task 2: Preserve Essential ownership through Sync

**Files:**
- Modify: `src/zen/sync/ZenSpacesSyncModel.sys.mjs`
- Modify: `src/zen/sync/ZenSpacesSyncApplier.sys.mjs`
- Modify: `src/zen/tests/device_sync/browser.toml`
- Create: `src/zen/tests/device_sync/browser_essentials_space_owner.js`

**Interfaces:**
- Consumes: Essential tab attribute `zen-workspace-id` and the space-owned section model from Task 1.
- Produces: Sync tab records with `essential: true` and the owning `workspaceUuid`; Sync apply restores that owner on the tab.

- [ ] **Step 1: Add failing projection and apply tests**

Assert an Essential in space A projects `workspaceUuid: A`, and an applied Essential record with `workspaceUuid: B` is restored only in space B.

- [ ] **Step 2: Run the focused device-sync test and confirm it fails**

Run: `python3 scripts/run_tests.py device_sync/browser_essentials_space_owner.js`
Expected: FAIL because Essentials currently project with `workspaceUuid: null`.

- [ ] **Step 3: Update the projection and apply paths**

In `ZenSpacesSyncModel.sys.mjs`, project `workspaceUuid` for Essentials from the owner attribute. In `ZenSpacesSyncApplier.sys.mjs`, apply the owner to the restored tab before sections are refreshed.

- [ ] **Step 4: Run the focused test and full device-sync suite**

Run: `python3 scripts/run_tests.py device_sync/browser_essentials_space_owner.js` and `python3 scripts/run_tests.py device_sync`
Expected: round-trip ownership tests and existing Sync tests pass.

- [ ] **Step 5: Commit the Essential Sync change**

Run: `git add src/zen/sync/ZenSpacesSyncModel.sys.mjs src/zen/sync/ZenSpacesSyncApplier.sys.mjs src/zen/tests/device_sync/browser.toml src/zen/tests/device_sync/browser_essentials_space_owner.js && git commit -m "feat: sync Essential space ownership"`
Expected: one focused commit contains Sync projection/apply and round-trip tests.
