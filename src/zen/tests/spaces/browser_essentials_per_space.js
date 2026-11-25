/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { PromiseTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PromiseTestUtils.sys.mjs"
);

PromiseTestUtils.allowMatchingRejectionsGlobally(/menu-bookmark-tab/);

add_task(async function test_essentials_are_owned_by_one_space() {
  const originalWorkspace = gZenWorkspaces.getActiveWorkspace();
  const firstWorkspaceId = originalWorkspace.uuid;
  const sharedContainerId = originalWorkspace.containerTabId || 0;
  let secondWorkspace;
  let firstEssential;
  let secondEssential;

  try {
    firstEssential = BrowserTestUtils.addTab(gBrowser, "about:blank", {
      skipAnimation: true,
      userContextId: sharedContainerId,
    });
    gZenPinnedTabManager.addToEssentials(firstEssential);
    const firstSection = gZenWorkspaces.getEssentialsSection(
      sharedContainerId,
      firstWorkspaceId
    );

    await gZenWorkspaces.createAndSaveWorkspace(
      "Essentials Space B",
      undefined,
      false,
      sharedContainerId
    );
    secondWorkspace = gZenWorkspaces
      .getWorkspaces()
      .find(workspace => workspace.name === "Essentials Space B");
    await gZenWorkspaces.changeWorkspace(secondWorkspace);

    secondEssential = BrowserTestUtils.addTab(gBrowser, "about:blank", {
      skipAnimation: true,
      userContextId: sharedContainerId,
    });
    gZenPinnedTabManager.addToEssentials(secondEssential);
    const secondSection = gZenWorkspaces.getEssentialsSection(
      sharedContainerId,
      secondWorkspace.uuid
    );
    Assert.strictEqual(
      firstSection.getAttribute("container"),
      secondSection.getAttribute("container"),
      "The test spaces have the same container context"
    );

    Assert.notStrictEqual(
      firstSection,
      secondSection,
      "Two spaces with the same container have separate Essential sections"
    );
    Assert.ok(
      firstSection.contains(firstEssential),
      "The first Essential stays with the first space"
    );
    Assert.ok(
      secondSection.contains(secondEssential),
      "The second Essential is added to the second space"
    );
    Assert.ok(
      BrowserTestUtils.isHidden(firstSection),
      "The first space's Essentials are hidden in the second space"
    );
    Assert.ok(
      BrowserTestUtils.isVisible(secondSection),
      "The second space's Essentials are visible"
    );
    Assert.strictEqual(
      firstEssential.getAttribute("zen-workspace-id"),
      firstWorkspaceId,
      "The first Essential stores its owning space"
    );
    Assert.strictEqual(
      secondEssential.getAttribute("zen-workspace-id"),
      secondWorkspace.uuid,
      "The second Essential stores its owning space"
    );

    gZenPinnedTabManager.removeEssentials(firstEssential);
    Assert.strictEqual(
      firstEssential.getAttribute("zen-workspace-id"),
      firstWorkspaceId,
      "Unpinning returns the Essential to its owning space"
    );
    Assert.ok(
      gZenWorkspaces.workspaceElement(firstWorkspaceId).tabsContainer.contains(
        firstEssential
      ),
      "The unpinned tab returns to its owning space's tab list"
    );
  } finally {
    if (gZenWorkspaces.activeWorkspace !== firstWorkspaceId) {
      await gZenWorkspaces.changeWorkspace(originalWorkspace);
    }
    if (firstEssential?.isConnected) {
      BrowserTestUtils.removeTab(firstEssential);
    }
    if (secondEssential?.isConnected) {
      BrowserTestUtils.removeTab(secondEssential);
    }
    if (secondWorkspace) {
      await gZenWorkspaces.removeWorkspace(secondWorkspace.uuid);
    }
  }
});

add_task(async function test_legacy_essentials_migrate_to_first_space() {
  const firstWorkspace = gZenWorkspaces.getWorkspaces()[0];
  const tab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });

  try {
    tab.removeAttribute("zen-workspace-id");
    gZenSessionStore.restoreInitialTabData(tab, { zenEssential: true });
    const ownerAfterFirstRestore = tab.getAttribute("zen-workspace-id");
    const essentialsAfterFirstRestore = gBrowser.tabs.filter(
      candidate =>
        candidate.hasAttribute("zen-essential") &&
        candidate.getAttribute("zen-workspace-id") === firstWorkspace.uuid
    ).length;
    Assert.strictEqual(
      ownerAfterFirstRestore,
      firstWorkspace.uuid,
      "A restored Essential without an owner migrates to the first space"
    );

    gZenSessionStore.restoreInitialTabData(tab, { zenEssential: true });
    Assert.strictEqual(
      tab.getAttribute("zen-workspace-id"),
      ownerAfterFirstRestore,
      "restoring the same legacy Essential again keeps its owner stable"
    );
    Assert.equal(
      gBrowser.tabs.filter(
        candidate =>
          candidate.hasAttribute("zen-essential") &&
          candidate.getAttribute("zen-workspace-id") === firstWorkspace.uuid
      ).length,
      essentialsAfterFirstRestore,
      "restoring it again does not duplicate the Essential"
    );
  } finally {
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_container_and_restore_owner_routing() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.workspaces.separate-essentials", true]],
  });
  const defaultWorkspace = gZenWorkspaces.getWorkspaces()[0];
  let containerWorkspace;
  let tab;
  try {
    await gZenWorkspaces.createAndSaveWorkspace(
      "Container Essentials Space",
      undefined,
      false,
      1
    );
    containerWorkspace = gZenWorkspaces
      .getWorkspaces()
      .find(workspace => workspace.name === "Container Essentials Space");

    const defaultContainerSection = gZenWorkspaces.getEssentialsSection(
      defaultWorkspace.containerTabId || 0,
      defaultWorkspace.uuid
    );
    const containerSection = gZenWorkspaces.getEssentialsSection(
      1,
      containerWorkspace.uuid
    );
    Assert.equal(
      containerSection.getAttribute("container"),
      "1",
      "the Essential section keeps its container context"
    );
    Assert.notStrictEqual(
      containerSection,
      defaultContainerSection,
      "a different container has a distinct Essential section"
    );

    tab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
      skipAnimation: true,
      userContextId: 1,
    });
    gZenSessionStore.restoreInitialTabData(tab, {
      zenEssential: true,
      zenWorkspace: containerWorkspace.uuid,
    });
    gZenWorkspaces.beginSessionRestoreFragments();
    gZenWorkspaces
      .getSessionRestoreFragment({
        zenEssential: true,
        zenWorkspace: containerWorkspace.uuid,
        userContextId: 1,
      })
      .appendChild(tab);
    gZenWorkspaces.flushSessionRestoreFragments();

    Assert.ok(
      containerSection.contains(tab),
      "session restore routes the Essential into its owner space and container"
    );
    Assert.equal(
      tab.userContextId,
      1,
      "session restore preserves the tab's container identity"
    );

    await gZenWorkspaces.changeWorkspace(defaultWorkspace);
    Assert.ok(
      BrowserTestUtils.isHidden(containerSection),
      "the container Essential section is hidden in another space"
    );
    await gZenWorkspaces.changeWorkspace(containerWorkspace);
    Assert.ok(
      BrowserTestUtils.isVisible(containerSection),
      "the container Essential section is visible in its owner space"
    );
  } finally {
    if (containerWorkspace &&
        gZenWorkspaces.activeWorkspace === containerWorkspace.uuid) {
      await gZenWorkspaces.changeWorkspace(defaultWorkspace);
    }
    if (tab?.isConnected) {
      await BrowserTestUtils.removeTab(tab);
    }
    if (containerWorkspace) {
      await gZenWorkspaces.removeWorkspace(containerWorkspace.uuid);
    }
    await SpecialPowers.popPrefEnv();
  }
});
