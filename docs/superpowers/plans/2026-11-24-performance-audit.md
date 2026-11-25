# Zen and Safari Performance Audit Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Identify whether the customized Zen fork has safe, measurable RAM or CPU improvements over its upstream baseline and compare the result with Safari on the user's Mac.

**Architecture:** Reuse Firefox's process manager and memory tools plus macOS Activity Monitor and Firefox Profiler. Repeat the foundation baseline after the feature plans, record anonymized results, and create a separate implementation plan only for a specific bottleneck supported by profiles.

**Tech Stack:** Gecko `about:processes`, `about:memory`, Firefox Profiler, macOS Activity Monitor, Zen's existing `src/zen/tests/performance` suite.

**Spec:** [Personal Zen Fork Design](../specs/2026-11-24-personal-zen-fork-design.md)

## Global Constraints

- Compare Zen and Safari on the same Mac with the same representative workload and profile conditions.
- Measure startup, tab/space switching, idle CPU, and memory after the same tabs are open.
- Keep MPL-2.0 notices intact.
- Do not add telemetry that transmits browsing activity or measurements.
- Do not claim Safari parity; only report measured comparisons.
- If no safe optimization is supported by measurements, deliver findings without a code change.

## Review Focus

- Workload and profile state must be reproducible; record browser versions, OS version, tab count, and conditions.
- CPU is sampled over a defined interval rather than a single moment; include the sampling interval in the report.
- Memory compares the same process category and uses the same unit; distinguish process RSS from total browser memory.
- Performance changes must not create responsiveness or stability regressions; compare switching and startup as well as resource numbers.
- Personal URLs, titles, and raw profiles remain local; use anonymized tab categories in tracked artifacts.

---

### Task 1: Record the post-feature comparison

**Files:**
- Modify: `docs/performance/zen-safari-comparison.md` (anonymized results only)
- Reference: pre-feature baseline recorded by the fork-foundation plan.

**Interfaces:**
- Consumes: pre-feature Zen/Safari baseline and a repeatable representative tab set.
- Produces: a dated comparison table and an explicit finding: candidate bottleneck, no safe candidate, or insufficient evidence.

- [ ] **Step 1: Repeat the baseline workload on the completed fork and Safari**

Run three trials per browser with the same sites/categories, same tab count, same wait intervals, and no unrelated heavy applications. Record app startup, switching responsiveness, idle CPU samples, and memory after settling.

- [ ] **Step 2: Inspect the browser process breakdown**

Use `about:processes` and `about:memory` in Zen. If a process dominates CPU or memory, capture a Firefox Profiler recording for the relevant action.

- [ ] **Step 3: Record anonymized results and compare medians**

Write measurements to `docs/performance/zen-safari-comparison.md`; do not include page URLs, titles, or raw profiler captures. Compare the median of three trials against the foundation baseline and Safari.

- [ ] **Step 4: Decide whether to create a focused optimization plan**

If a repeatable Zen-owned bottleneck has a safe fix, write a new plan naming the exact source files and regression checks before changing code. If the bottleneck is page/extension behavior, or no safe browser fix is supported, record that finding and finish this audit without speculative tweaks.

- [ ] **Step 5: Commit the anonymized comparison**

Run: `git add docs/performance/zen-safari-comparison.md && git commit -m "docs: compare Zen and Safari performance"`
Expected: the before/after comparison is committed without URLs, titles, or raw profiles.
