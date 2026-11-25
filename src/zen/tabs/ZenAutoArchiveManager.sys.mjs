// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";
import { ZenAutoArchiveStore } from "resource:///modules/zen/ZenAutoArchiveStore.sys.mjs";

const MINUTE_MS = 60 * 1000;

class ZenAutoArchiveManager extends nsZenDOMOperatedFeature {
  #enabled = Services.prefs.getBoolPref("zen.auto-archive.enabled", true);
  #inactiveHours = Services.prefs.getIntPref(
    "zen.auto-archive.inactive-hours",
    6,
  );
  #timer = null;
  #sweepPromise = Promise.resolve();
  #isUnloaded = false;

  store = ZenAutoArchiveStore;

  init() {
    if (!this.#enabled || PrivateBrowsingUtils.isWindowPrivate(window)) {
      return;
    }

    window.addEventListener("unload", this, { once: true });

    Promise.all([
      SessionStore.promiseAllWindowsRestored,
      gZenWorkspaces.promiseInitialized,
    ])
      .then(() => {
        if (this.#isUnloaded) {
          return;
        }
        gBrowser.tabContainer.addEventListener("TabSelect", this);
        this.#timer = setInterval(
          () => this.runSweep().catch(console.error),
          MINUTE_MS,
        );
        return this.runSweep();
      })
      .catch(console.error);
  }

  handleEvent(event) {
    if (event.type === "unload") {
      this.#isUnloaded = true;
      gBrowser.tabContainer.removeEventListener("TabSelect", this);
      clearInterval(this.#timer);
      return;
    }
    if (this.#isUnloaded) {
      return;
    }

    const selectedTab = event.target;
    if (!this.#hasReliableTimestamp(selectedTab, Date.now())) {
      selectedTab._lastAccessed = Date.now();
    }
    this.runSweep().catch(console.error);
  }

  runSweep(now = Date.now()) {
    if (this.#isUnloaded) {
      return Promise.resolve();
    }
    this.#sweepPromise = this.#sweepPromise
      .catch(console.error)
      .then(() => this.#doSweep(now));
    return this.#sweepPromise;
  }

  #hasReliableTimestamp(tab, now) {
    const accessedAt = tab?.lastAccessed;
    return (
      Number.isFinite(accessedAt) &&
      accessedAt > 0 &&
      accessedAt <= now + MINUTE_MS
    );
  }

  async #doSweep(now) {
    if (
      this.#isUnloaded ||
      !this.#enabled ||
      PrivateBrowsingUtils.isWindowPrivate(window)
    ) {
      return;
    }

    const inactiveMs = this.#inactiveHours * 60 * MINUTE_MS;
    for (const tab of [...gBrowser.tabs]) {
      if (
        tab === gBrowser.selectedTab ||
        tab.pinned ||
        tab.hasAttribute("zen-essential") ||
        tab.soundPlaying ||
        tab.linkedBrowser?.contentPrincipal?.originAttributes
          ?.privateBrowsingId > 0
      ) {
        continue;
      }

      if (!this.#hasReliableTimestamp(tab, now)) {
        tab._lastAccessed = now;
        continue;
      }

      if (now - tab.lastAccessed < inactiveMs) {
        continue;
      }

      const workspaceUuid =
        tab.getAttribute("zen-workspace-id") ||
        gZenWorkspaces.getActiveWorkspace()?.uuid ||
        "";
      const archived = await this.store.add({
        url: tab.linkedBrowser.currentURI.spec,
        title: tab.linkedBrowser.contentTitle || tab.label,
        workspaceUuid,
        userContextId: tab.userContextId,
        archivedAt: now,
      });

      // The archive entry is durable before the live tab is removed.
      if (gBrowser.tabs.includes(tab)) {
        gBrowser.removeTab(tab, { animate: false });
      } else {
        await this.store.remove(archived.id);
      }
    }
  }
}

window.gZenAutoArchiveManager = new ZenAutoArchiveManager();
