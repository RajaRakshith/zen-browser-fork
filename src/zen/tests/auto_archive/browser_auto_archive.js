/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { PromiseTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PromiseTestUtils.sys.mjs",
);
const { ZenAutoArchiveStoreImpl } = ChromeUtils.importESModule(
  "resource:///modules/zen/ZenAutoArchiveStore.sys.mjs",
);
PromiseTestUtils.allowMatchingRejectionsGlobally(/menu-bookmark-tab/);

add_task(async function test_auto_archive_thresholds_and_eligibility() {
  const manager = window.gZenAutoArchiveManager;
  // Use a slightly future sweep clock (within the manager's one-minute
  // timestamp tolerance) so the one-millisecond-early case stays unexpired
  // during real-time TabSelect sweeps triggered by tab removal.
  const now = Date.now() + 30_000;
  const sixHours = 6 * 60 * 60 * 1000;
  const expired = BrowserTestUtils.addTab(gBrowser, "data:text/html,expired", {
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(
    expired.linkedBrowser,
    false,
    "data:text/html,expired",
  );
  const almostExpired = BrowserTestUtils.addTab(
    gBrowser,
    "about:blank?almost-expired",
    { skipAnimation: true },
  );
  const pinned = BrowserTestUtils.addTab(
    gBrowser,
    "https://example.com/pinned",
    {
      skipAnimation: true,
    },
  );
  const essential = BrowserTestUtils.addTab(
    gBrowser,
    "https://example.com/essential",
    { skipAnimation: true },
  );
  const audible = BrowserTestUtils.addTab(
    gBrowser,
    "https://example.com/audible",
    {
      skipAnimation: true,
    },
  );
  let entries;

  try {
    gBrowser.pinTab(pinned);
    gZenPinnedTabManager.addToEssentials(essential);
    audible.setAttribute("soundplaying", "true");

    // Drain tab-select sweeps caused while the fixtures were created before
    // assigning synthetic timestamps for the explicit boundary check.
    await manager.runSweep();

    expired._lastAccessed = now - sixHours;
    almostExpired._lastAccessed = now - sixHours + 1;
    pinned._lastAccessed = now - sixHours - 1;
    essential._lastAccessed = now - sixHours - 1;
    audible._lastAccessed = now - sixHours - 1;
    const selectedTab = gBrowser.selectedTab;
    selectedTab._lastAccessed = now - sixHours - 1;

    Assert.ok(
      manager,
      "Auto archive manager is available in the browser window",
    );
    await manager.runSweep(now);
    entries = await manager.store.list();

    Assert.ok(!gBrowser.tabs.includes(expired), "A tab at six hours is closed");
    Assert.ok(
      gBrowser.tabs.includes(almostExpired),
      "A tab one millisecond early stays open",
    );
    Assert.ok(
      gBrowser.tabs.includes(selectedTab),
      "The selected tab stays open",
    );
    Assert.ok(gBrowser.tabs.includes(pinned), "Pinned tabs stay open");
    Assert.ok(gBrowser.tabs.includes(essential), "Essentials stay open");
    Assert.ok(gBrowser.tabs.includes(audible), "Audible tabs stay open");
    Assert.equal(entries.length, 1, "Only the expired regular tab is archived");
    Assert.equal(entries[0].url, "data:text/html,expired");
    Assert.equal(entries[0].userContextId, expired.userContextId);
    Assert.ok(entries[0].workspaceUuid, "The owning space is preserved");
    const persisted = await IOUtils.readJSON(
      PathUtils.join(PathUtils.profileDir, "zen-auto-archive.json"),
    );
    Assert.equal(
      persisted.entries[0].url,
      "data:text/html,expired",
      "Archive metadata is durable before the tab is closed",
    );
    const restartedStore = new ZenAutoArchiveStoreImpl();
    const restoredEntries = await restartedStore.list();
    Assert.equal(
      restoredEntries[0].url,
      "data:text/html,expired",
      "Archive entries load from disk into a fresh store instance",
    );
  } finally {
    audible.removeAttribute("soundplaying");
    for (const tab of [expired, almostExpired, pinned, essential, audible]) {
      if (gBrowser.tabs.includes(tab)) {
        gBrowser.removeTab(tab, { animate: false });
      }
    }
    await manager.runSweep();
    for (const entry of await manager.store.list()) {
      await manager.store.remove(entry.id);
    }
  }
});

add_task(
  async function test_auto_archive_stamps_missing_timestamp_on_tab_select() {
    const manager = window.gZenAutoArchiveManager;
    const previousTab = gBrowser.selectedTab;
    const tab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
      skipAnimation: true,
    });
    try {
      await manager.runSweep();
      tab._lastAccessed = 0;
      const selectedAt = Date.now();
      gBrowser.selectedTab = previousTab;
      gBrowser.selectedTab = tab;
      await TestUtils.waitForCondition(() => tab.selected);
      gBrowser.selectedTab = previousTab;
      await TestUtils.waitForCondition(
        () => !tab.selected && tab.lastAccessed >= selectedAt,
      );
      Assert.ok(
        !tab.selected && tab.lastAccessed >= selectedAt,
        "A tab keeps its selection time after it is no longer selected",
      );
    } finally {
      if (gBrowser.tabs.includes(tab)) {
        gBrowser.removeTab(tab, { animate: false });
      }
    }
  },
);

add_task(async function test_auto_archive_sweeps_after_tab_select() {
  const manager = window.gZenAutoArchiveManager;
  const url = "data:text/html,select-triggered-archive";
  const expired = BrowserTestUtils.addTab(gBrowser, url, {
    inBackground: true,
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(expired.linkedBrowser, false, url);
  let trigger;
  try {
    await manager.runSweep();
    expired._lastAccessed = Date.now() - 7 * 60 * 60 * 1000;
    trigger = BrowserTestUtils.addTab(gBrowser, "about:blank", {
      inBackground: true,
      skipAnimation: true,
    });
    gBrowser.selectedTab = trigger;
    await TestUtils.waitForCondition(
      () => !gBrowser.tabs.includes(expired),
      "a tab selection starts an automatic archive sweep",
    );
    Assert.ok(
      (await manager.store.list()).some((entry) => entry.url === url),
      "The automatic sweep archives the inactive tab",
    );
  } finally {
    for (const tab of [expired, trigger]) {
      if (tab && gBrowser.tabs.includes(tab)) {
        gBrowser.removeTab(tab, { animate: false });
      }
    }
    await manager.runSweep();
    for (const entry of await manager.store.list()) {
      if (entry.url === url) {
        await manager.store.remove(entry.id);
      }
    }
  }
});

add_task(async function test_auto_archive_skips_private_windows() {
  const privateWindow = await BrowserTestUtils.openNewBrowserWindow({
    private: true,
  });
  const privateTab = BrowserTestUtils.addTab(
    privateWindow.gBrowser,
    "https://example.com/private",
    { skipAnimation: true },
  );
  try {
    privateTab._lastAccessed = Date.now() - 7 * 60 * 60 * 1000;
    await privateWindow.gZenAutoArchiveManager.runSweep();
    Assert.ok(
      privateWindow.gBrowser.tabs.includes(privateTab),
      "Tabs in a private window are not automatically closed",
    );
    Assert.ok(
      !(await window.gZenAutoArchiveManager.store.list()).some((entry) =>
        entry.url.includes("example.com/private"),
      ),
      "Private tab metadata is never written to the profile archive",
    );
  } finally {
    await BrowserTestUtils.closeWindow(privateWindow);
  }
});

add_task(async function test_auto_archive_missing_timestamp_grace_period() {
  const manager = window.gZenAutoArchiveManager;
  const now = Date.now();
  const tab = BrowserTestUtils.addTab(
    gBrowser,
    "https://example.com/unknown-age",
    {
      skipAnimation: true,
    },
  );
  try {
    tab._lastAccessed = 0;
    Assert.ok(
      manager,
      "Auto archive manager is available in the browser window",
    );
    await manager.runSweep(now);
    Assert.ok(
      gBrowser.tabs.includes(tab),
      "A tab without a trustworthy timestamp gets grace",
    );
    Assert.ok(
      tab.lastAccessed >= now,
      "Grace starts when the missing timestamp is noticed",
    );
  } finally {
    if (gBrowser.tabs.includes(tab)) {
      gBrowser.removeTab(tab, { animate: false });
    }
  }
});
