# Personal Zen Fork Design

**Status:** Approved by the user. No product code changes are included in this document.

## Intent

Build a personal Zen Browser fork in the user's GitHub repository. The user is the primary user and expects to add browser features over time. The target experience takes inspiration from Arc's space-bound Essentials and recoverable Auto Archive, with a six-hour cleanup window. The longer-term performance goal is to make Zen feel as efficient as Safari on the user's Mac, measured on real workloads rather than assumed from code changes.

## Goals

1. Briefly reveal the sidebar whenever the user switches tabs or spaces.
2. Make each Essential belong to one space, appear only in that space, and retain its space association through Zen Sync.
3. Archive regular tabs after six hours without selection, and let the user restore them.
4. Identify and reduce measurable RAM and CPU costs without harming browsing behavior or responsiveness.
5. Keep all product changes in one fork of `zen-browser/desktop` so the user can build and maintain one customized browser.

## Non-goals

- Building a general-purpose extension or publishing separate Zen Mods.
- Rewriting Gecko or attempting to reproduce Safari's implementation.
- Promising exact Safari performance parity before measuring comparable workloads.
- Supporting Windows and Linux in the first implementation phase.
- Building a public update service or installer pipeline before the local macOS build works.

## Anti-goals

- Permanently deleting tabs when they auto-close.
- Duplicating existing shared Essentials into every space during migration.
- Making speculative resource tweaks without repeatable measurements.
- Adding telemetry that transmits browsing activity or resource measurements.

## Approaches considered

### A. One personal Zen desktop fork — selected

Implement all features in the browser source and keep them in the user's GitHub fork. This reaches Zen's privileged tab, space, and sidebar code and keeps one installable browser. The cost is building Zen and regularly reconciling changes from upstream.

### B. A collection of Mods and extensions

This is lighter to develop and distribute. It cannot reliably change Zen's internal space ownership or reduce browser-engine costs, so it does not meet the request for a unified browser.

### C. Upstream pull requests only

This would reduce the private patch set if maintainers accept the changes. The user wants personal control and ongoing feature additions, and upstream timing is outside their control.

## Current project context

- The checkout is `features/zen-browser-fork`, branch `dev`, with the user's GitHub fork as `origin`. It is a clean, depth-10 clone. An `upstream` remote still needs to be added before syncing changes.
- Zen already has a `ZenSpaceManager`, a `ZenPinnedTabManager`, per-space tab containers, a `ZenVerticalTabsManager`, Library history with recently closed tabs, and performance test suites.
- The current `zen.workspaces.separate-essentials` preference separates Essentials by **container**, not by space. Its shipped default is `true`, but multiple spaces using the same container still share that container's Essentials. Sync currently writes Essentials with `workspaceUuid: null`, so the feature needs per-space ownership and sync data.
- If no spaces are saved, Zen creates a default `Space`; migration can assign existing shared Essentials to the first restored space or that default space. The user agreed to assign them to one space rather than duplicate them.
- Zen supports unloading tabs from inactive workspaces. Firefox's inherited process tools can report approximate CPU and memory use for tabs and processes, so the first performance pass should use existing tools before adding a new dashboard.

## Proposed behavior

### Sidebar reveal

On a tab selection or space change, temporarily reveal a collapsed sidebar for three seconds. Do not change the saved expanded/collapsed preference. A later switch restarts the timer. If the user manually expands the sidebar, leave it expanded. The three-second duration is a proposed default based on “a few seconds.”

### Space-owned Essentials

Each Essential has exactly one owning space and is shown only in that space, even when spaces share a container. Sync records the owning `workspaceUuid`. During the first run after upgrade, assign Essentials that were previously global to the first restored space; if there are no saved spaces, assign them to Zen's default `Space`. Do not create duplicate tabs.

### Six-hour Auto Archive

Archive each regular, unpinned tab six elapsed hours after it was last selected. Do not archive the current tab, Essentials, pinned tabs, or tabs with active audio. Count elapsed wall-clock time across browser restarts and Mac sleep. Keep archived entries until the user restores or deletes them. Store URL, title, owning space, and container context; restore by reopening the URL in its original space and container. Full in-memory page state is not required. If an existing tab has no trustworthy last-selected timestamp, give it a six-hour grace period after upgrade rather than archiving it immediately. Six hours is a preference with six hours as its initial value.

### Resource investigation and optimization

First record a baseline for Zen and Safari on the user's Mac using the same profile conditions and browsing workload. Include startup, tab and space switching, an idle period, and a representative open-tab set. Use Activity Monitor and Firefox's process manager/memory tools; add instrumentation only if these do not answer the user's questions. Optimize one demonstrated bottleneck at a time and compare RAM, CPU, and responsiveness against the same baseline. Treat Safari as a comparative target, not a guaranteed result. If measurements reveal no safe optimization, deliver the baseline and findings without claiming a resource reduction.

## Constraints and implementation notes

- Zen is Firefox-based and its source is MPL-2.0. Preserve upstream license notices.
- The shallow clone is small, but it can make long-distance upstream merges harder. Fetch the needed branch history or deepen the clone when syncing requires it.
- Zen's build guide calls for 30 GB of free disk space plus Python 3, Node.js 21+, Rust/Cargo, and sccache. The current 79 MB checkout does not contain the bootstrapped browser engine or build output.
- Keep the `dev` branch as the initial base because that is the checked-out branch. The implementation plan should confirm the upstream sync target and local macOS build path before feature work.

## Proposed success criteria

- A local macOS build launches from the fork and includes all four features.
- Sidebar reveal works after both tab and space switches without persisting a temporary expansion.
- Essentials display in one space, survive restart and sync with their owner, and migrate to one fallback space without duplication.
- Regular tabs inactive for six hours are archived and restorable in their original space; protected tabs remain open.
- Performance findings include reproducible baseline and post-change measurements. Any optimization is retained only when the measurements improve without a meaningful interaction or stability regression.

## Confirmed decisions and implementation calls

- **User-confirmed:** keep all features in one personal Zen fork; per-space Essential ownership only needs to work on updated fork devices; migrate existing Essentials to one first/default space without duplicating tabs; use Arc-style recoverable tab archiving with the six-hour threshold.

Other defaults are implementation calls for review: start from `dev`; use the existing Library area for a persistent Archive view, adding dedicated archive storage as needed; preserve the tab's container context when restoring from Archive; and validate local macOS builds before considering signed/notarized GitHub releases.
