# Personal Zen Fork Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the user's shallow GitHub fork for repeatable local macOS builds and a trustworthy upstream performance baseline.

**Architecture:** Keep `origin` pointed at the user's fork and add Zen's desktop repository as `upstream`. Bootstrap the current `dev` branch, launch it locally, and record baseline measurements before feature code changes.

**Tech Stack:** Git, Node.js/npm, Python 3, Rust/Cargo, sccache, Gecko `mach`, macOS Activity Monitor, Firefox process/memory tools.

**Spec:** [Personal Zen Fork Design](../specs/2026-11-24-personal-zen-fork-design.md)

**Prerequisite:** This plan uses the user's existing depth-10 clone in `features/zen-browser-fork`.

## Global Constraints

- Keep all product changes in one fork of `zen-browser/desktop`.
- Support macOS first; validate local builds before considering signed/notarized releases.
- Start from the checked-out `dev` branch and add upstream as a separate remote.
- Keep MPL-2.0 notices intact.
- Keep at least 30 GB free for browser build/bootstrap output.
- Required tooling: Python 3, Node.js 21+, Rust/Cargo, and sccache.
- The source checkout is depth 10; deepen history only when an upstream sync needs it.
- Do not add performance telemetry that transmits browsing activity or measurements.

## Review Focus

- `origin` must remain the user's GitHub fork after adding `upstream`; verify with `git remote -v`.
- The shallow history must not be force-replaced or unshallowed unless an upstream operation requires it; verify `git rev-parse --is-shallow-repository`.
- Bootstrap must have at least 30 GB free and all required tool versions; check before `npm run init`.
- `npm run init` must finish with an `engine` checkout and build configuration; verify its expected directories and command output.
- The local launch must use the fork's source and a separate browser profile; verify the opened app reports the Zen fork build.

---

### Task 1: Configure the upstream remote

**Files:**
- Modify: local `.git/config` only; no tracked source files.

**Interfaces:**
- Consumes: existing `origin` URL `git@github.com:RajaRakshith/zen-browser-fork.git`, local branch `dev`.
- Produces: remote `upstream` at `https://github.com/zen-browser/desktop.git`, with `upstream/dev` fetched at depth 10.

- [x] **Step 1: Confirm the checkout is clean and remotes are correct**

Run: `git status --short --branch && git remote -v && git rev-parse --is-shallow-repository`
Expected: clean `dev` branch, `origin` points to `RajaRakshith/zen-browser-fork`, shallow status is `true`.

- [x] **Step 2: Add and fetch upstream**

If `upstream` is absent, run `git remote add upstream https://github.com/zen-browser/desktop.git`; if it exists, verify its URL first. Then run: `git fetch --depth=10 upstream dev:refs/remotes/upstream/dev`
Expected: `upstream/dev` is fetched; `origin` remains unchanged.

- [x] **Step 3: Compare local and upstream branch heads**

Run: `git log --oneline --decorate --graph -12 dev upstream/dev`
Expected: current fork base and upstream head are visible for later sync planning; do not merge or rewrite commits in this task.

### Task 2: Bootstrap and launch the fork

**Files:**
- Generated: ignored `engine/` checkout and build output.
- Create: `docs/performance/zen-safari-comparison.md` with an anonymized pre-feature baseline.

**Interfaces:**
- Consumes: local `dev` source and the required macOS build tools.
- Produces: a bootstrapped local browser that can run from this checkout.

- [x] **Step 1: Check build tools and disk space**

Run: `node --version && python3 --version && rustc --version && cargo --version && sccache --version && df -h .`
Expected: Node.js 21+, Python 3, Rust/Cargo available, and at least 30 GB free.

- [x] **Step 2: Install repository dependencies**

Run: `npm install`
Expected: npm completes without modifying tracked source files.

- [x] **Step 3: Download and bootstrap the engine**

Run: `npm run init`
Expected: the `engine/` directory and local build configuration are created successfully.

- [ ] **Step 4: Launch the baseline browser** — the launch command started the development app, but visual verification was blocked because computer-use access to Nightly was not approved.

Run: `npm start`
Expected: the fork launches from its `engine` source tree.

- [ ] **Step 5: Capture a pre-feature baseline**

Use the same representative browsing workload in Zen and Safari on the same Mac. Record startup, space/tab switching, idle CPU, and memory after loading the workload. Keep page URLs, titles, and raw profiler captures out of tracked files; record only anonymized measurements in `docs/performance/zen-safari-comparison.md`.

Expected: a dated baseline exists to compare against the finished feature set.

- [ ] **Step 6: Commit the baseline worksheet**

Run: `git add docs/performance/zen-safari-comparison.md && git commit -m "docs: record Zen performance baseline"`
Expected: the reproducible baseline is committed without personal browsing details.
