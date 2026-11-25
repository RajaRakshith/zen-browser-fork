/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const Library = customElements.get("zen-library");
const { ZenAutoArchiveStore } = ChromeUtils.importESModule(
  "resource:///modules/zen/ZenAutoArchiveStore.sys.mjs",
);

async function openArchiveSection() {
  Library.toggle("archive");
  const library = document.querySelector("zen-library");
  await TestUtils.waitForCondition(
    () =>
      Library.libraryProgress === 1 && !library.hasAttribute("transitioning"),
    "the Library opens on Archive",
  );
  const section = document.querySelector("zen-library-archive-section");
  await section.updateComplete;
  return section;
}

async function closeLibrary() {
  if (!Library.isLibraryOpen) {
    return;
  }
  Library.toggle();
  await TestUtils.waitForCondition(
    () => !Library.isLibraryOpen && Library.libraryProgress === 0,
    "the Library closes",
  );
}

add_task(async function test_archive_lists_and_restores_in_owning_space() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.library.enabled", true],
      ["zen.library.last-tab", "history"],
    ],
  });
  await gZenWorkspaces.promiseInitialized;
  const originalWorkspace = gZenWorkspaces.getActiveWorkspace();
  const restoreWorkspace = await gZenWorkspaces.createAndSaveWorkspace(
    "Archive Restore Test",
  );
  const id = "library-archive-restore-test";
  const url = "data:text/html,restored-from-library-archive";
  let restoredTab;

  try {
    await ZenAutoArchiveStore.add({
      id,
      url,
      title: "Archived test page",
      workspaceUuid: restoreWorkspace.uuid,
      userContextId: restoreWorkspace.containerTabId,
      archivedAt: Date.now(),
    });
    await gZenWorkspaces.changeWorkspace(originalWorkspace);

    const section = await openArchiveSection();
    const row = await TestUtils.waitForCondition(
      () => section.querySelector(`[data-entry-id="${id}"]`),
      "the archived tab is listed",
    );
    Assert.ok(
      row.textContent.includes("Archived test page"),
      "the row shows the saved title",
    );

    row.querySelector(".zen-library-archive-restore").click();
    await TestUtils.waitForCondition(
      () => gZenWorkspaces.activeWorkspace === restoreWorkspace.uuid,
      "restore returns to the tab's owning space",
    );
    await TestUtils.waitForCondition(
      () =>
        gBrowser.tabs.find((tab) => tab.linkedBrowser.currentURI.spec === url),
      "restore opens the archived URL",
    );
    restoredTab = gBrowser.tabs.find(
      (tab) => tab.linkedBrowser.currentURI.spec === url,
    );
    Assert.equal(
      restoredTab.getAttribute("zen-workspace-id"),
      restoreWorkspace.uuid,
      "the restored tab belongs to its original space",
    );
    Assert.equal(
      restoredTab.userContextId,
      restoreWorkspace.containerTabId,
      "the restored tab keeps its original container",
    );
    Assert.ok(
      !(await ZenAutoArchiveStore.list()).some((entry) => entry.id === id),
      "a successfully restored entry is removed from Archive",
    );
  } finally {
    await closeLibrary();
    if (restoredTab && gBrowser.tabs.includes(restoredTab)) {
      gBrowser.removeTab(restoredTab, { animate: false });
    }
    await ZenAutoArchiveStore.remove(id);
    if (gZenWorkspaces.getWorkspaceFromId(restoreWorkspace.uuid)) {
      await gZenWorkspaces.removeWorkspace(restoreWorkspace.uuid);
    }
    if (
      originalWorkspace &&
      gZenWorkspaces.getWorkspaceFromId(originalWorkspace.uuid)
    ) {
      await gZenWorkspaces.changeWorkspace(originalWorkspace);
    }
    await SpecialPowers.popPrefEnv();
  }
});

add_task(
  async function test_archive_delete_removes_entry_without_opening_tab() {
    await SpecialPowers.pushPrefEnv({
      set: [
        ["zen.library.enabled", true],
        ["zen.library.last-tab", "history"],
      ],
    });
    await gZenWorkspaces.promiseInitialized;
    const id = "library-archive-delete-test";
    const url = "data:text/html,deleted-from-library-archive";
    try {
      await ZenAutoArchiveStore.add({
        id,
        url,
        title: "Page to delete",
        workspaceUuid: gZenWorkspaces.activeWorkspace,
        userContextId: gZenWorkspaces.getActiveWorkspace()?.containerTabId,
        archivedAt: Date.now(),
      });
      const section = await openArchiveSection();
      const row = await TestUtils.waitForCondition(
        () => section.querySelector(`[data-entry-id="${id}"]`),
        "the archived tab is listed",
      );
      row.querySelector(".zen-library-archive-delete").click();
      await TestUtils.waitForCondition(
        async () =>
          !(await ZenAutoArchiveStore.list()).some((entry) => entry.id === id),
        "delete removes the archive entry",
      );
      Assert.ok(
        !gBrowser.tabs.some((tab) => tab.linkedBrowser.currentURI.spec === url),
        "deleting an archive entry does not open its URL",
      );
    } finally {
      await closeLibrary();
      await ZenAutoArchiveStore.remove(id);
      await SpecialPowers.popPrefEnv();
    }
  },
);
