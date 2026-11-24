/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const SIDEBAR_EXPANDED_PREF = "zen.view.sidebar-expanded";

async function withCollapsedSidebar(test) {
  await TestUtils.waitForCondition(
    () => !document.documentElement.hasAttribute("zen-sidebar-expanded"),
    "Sidebar starts collapsed"
  );
  await test();
}

add_task(async function test_tab_selection_temporarily_expands_sidebar() {
  await withCollapsedSidebar(async () => {
    const otherTab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
      skipAnimation: true,
    });

    try {
      gBrowser.selectedTab = otherTab;
      await TestUtils.waitForCondition(
        () => document.documentElement.hasAttribute("zen-sidebar-expanded"),
        "Selecting a tab briefly expands the sidebar"
      );
      Assert.ok(
        !Services.prefs.getBoolPref(SIDEBAR_EXPANDED_PREF),
        "The transient reveal does not change the saved preference"
      );

      await new Promise(resolve => setTimeout(resolve, 2700));
      Assert.ok(
        document.documentElement.hasAttribute("zen-sidebar-expanded"),
        "The sidebar remains expanded just before the 3-second deadline"
      );
      await TestUtils.waitForCondition(
        () => !document.documentElement.hasAttribute("zen-sidebar-expanded"),
        "The sidebar collapses after the default reveal interval",
        750
      );
      Assert.ok(
        !Services.prefs.getBoolPref(SIDEBAR_EXPANDED_PREF),
        "Collapsing the transient reveal leaves the preference unchanged"
      );
    } finally {
      BrowserTestUtils.removeTab(otherTab);
    }
  });
});

add_task(async function test_repeated_reveal_restarts_timer() {
  await withCollapsedSidebar(async () => {
    gZenVerticalTabsManager.showTransientSidebar(300);
    await new Promise(resolve => setTimeout(resolve, 180));
    gZenVerticalTabsManager.showTransientSidebar(500);
    await new Promise(resolve => setTimeout(resolve, 350));

    Assert.ok(
      document.documentElement.hasAttribute("zen-sidebar-expanded"),
      "A later reveal restarts the collapse timer"
    );

    await TestUtils.waitForCondition(
      () => !document.documentElement.hasAttribute("zen-sidebar-expanded"),
      "The restarted timer eventually collapses the sidebar",
      1000
    );
    Assert.ok(
      !Services.prefs.getBoolPref(SIDEBAR_EXPANDED_PREF),
      "The timer does not change the saved preference"
    );
  });
});

add_task(async function test_workspace_change_reveals_sidebar() {
  await withCollapsedSidebar(async () => {
    const originalWorkspace = gZenWorkspaces.getActiveWorkspaceFromCache();
    const originalThemePicker = window.gZenThemePicker;
    if (!originalThemePicker) {
      window.gZenThemePicker = { onWorkspaceChange() {} };
    }
    let testWorkspace;
    try {
      await gZenWorkspaces.createAndSaveWorkspace("Sidebar Peek Test");
      testWorkspace = gZenWorkspaces
        .getWorkspaces()
        .find(workspace => workspace.name === "Sidebar Peek Test");
      await gZenWorkspaces.changeWorkspace(testWorkspace);
      Assert.ok(
        document.documentElement.hasAttribute("zen-sidebar-expanded"),
        "Changing spaces briefly expands the sidebar"
      );
      Assert.ok(
        !Services.prefs.getBoolPref(SIDEBAR_EXPANDED_PREF),
        "Changing spaces leaves the saved preference collapsed"
      );
    } finally {
      if (testWorkspace) {
        await gZenWorkspaces.changeWorkspace(originalWorkspace);
        await gZenWorkspaces.removeWorkspace(testWorkspace.uuid);
      }
      if (!originalThemePicker) {
        delete window.gZenThemePicker;
      }
    }
  });
});

add_task(async function test_manual_expansion_is_not_collapsed_by_timer() {
  await withCollapsedSidebar(async () => {
    const originalUpdateEvent = gZenVerticalTabsManager._updateEvent;
    gZenVerticalTabsManager._updateEvent = () => {};
    try {
      gZenVerticalTabsManager.showTransientSidebar(100);
      await SpecialPowers.pushPrefEnv({
        set: [[SIDEBAR_EXPANDED_PREF, true]],
      });
      Assert.ok(
        gZenVerticalTabsManager._prefsSidebarExpanded,
        "The manager observes the stored expanded preference"
      );

      await new Promise(resolve => setTimeout(resolve, 200));
      Assert.ok(
        document.documentElement.hasAttribute("zen-sidebar-expanded"),
        "The timer does not collapse a manually expanded sidebar"
      );
      Assert.ok(
        Services.prefs.getBoolPref(SIDEBAR_EXPANDED_PREF),
        "The saved preference reflects the manual expansion"
      );
    } finally {
      await SpecialPowers.popPrefEnv();
      gZenVerticalTabsManager._updateEvent = originalUpdateEvent;
      gNavToolbox.removeAttribute("zen-sidebar-expanded");
      document.documentElement.removeAttribute("zen-sidebar-expanded");
      gBrowser.tabContainer.removeAttribute("expanded");
      delete gZenVerticalTabsManager._hadSidebarCollapse;
    }
  });
});
