/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(
  async function test_MirroredEssentialUsesDestinationWorkspaceFallback() {
    await withNewSyncedWindow(async win => {
      const sourceOnlyWorkspaceId = "workspace-only-in-source-window";
      const tab = gBrowser.addTrustedTab("about:blank", {
        inBackground: true,
      });
      tab.setAttribute("zen-workspace-id", sourceOnlyWorkspaceId);

      gZenPinnedTabManager.addToEssentials(tab);

      await TestUtils.waitForCondition(
        () =>
          gZenWindowSync
            .getItemFromWindow(win, tab.id)
            ?.hasAttribute("zen-essential"),
        "the Essential is mirrored into the other window"
      );

      const mirror = gZenWindowSync.getItemFromWindow(win, tab.id);
      const destinationOwnerId = win.gZenWorkspaces.activeWorkspace;
      Assert.ok(
        win.gZenWorkspaces.getWorkspaces().some(
          workspace => workspace.uuid === destinationOwnerId
        ),
        "the fallback owner is a workspace in the destination window"
      );
      Assert.notEqual(
        destinationOwnerId,
        sourceOnlyWorkspaceId,
        "the source-only owner does not exist in the destination window"
      );
      Assert.equal(
        mirror.getAttribute("zen-workspace-id"),
        destinationOwnerId,
        "the mirrored Essential falls back to the destination's active space"
      );
      Assert.ok(
        win.gZenWorkspaces.getEssentialsSection(mirror).contains(mirror),
        "the mirrored Essential is inserted into its destination-owned section"
      );

      await BrowserTestUtils.removeTab(tab);
    });
  }
);
