/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html, repeat } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

const { ZenAutoArchiveStore } = ChromeUtils.importESModule(
  "resource:///modules/zen/ZenAutoArchiveStore.sys.mjs",
);

export class ZenLibraryArchiveSection extends MozLitElement {
  static id = "archive";
  static label = "library-archive-section-title";

  static render(library) {
    return html`
      <zen-library-archive-section
        class="zen-library-section"
        data-section="archive"
        .library=${library}
      ></zen-library-archive-section>
    `;
  }

  static properties = {
    entries: { state: true },
    busy: { state: true },
  };

  constructor() {
    super();
    this.entries = [];
    this.busy = new Set();
  }

  createRenderRoot() {
    return this;
  }

  onShown() {
    this.#load();
  }

  onLibraryOpened() {
    // The active section can stay marked as showing while the Library closes,
    // so onShown is not guaranteed to fire on the next open.
    this.#load();
  }

  async #load() {
    this.entries = await ZenAutoArchiveStore.list();
  }

  async #delete(entry) {
    this.busy = new Set(this.busy).add(entry.id);
    try {
      await ZenAutoArchiveStore.remove(entry.id);
      this.entries = this.entries.filter((item) => item.id !== entry.id);
    } finally {
      const busy = new Set(this.busy);
      busy.delete(entry.id);
      this.busy = busy;
    }
  }

  async #restore(entry) {
    if (this.busy.has(entry.id)) {
      return;
    }
    this.busy = new Set(this.busy).add(entry.id);
    try {
      const workspace = gZenWorkspaces.getWorkspaceFromId(entry.workspaceUuid);
      if (!workspace) {
        throw new Error(
          `Archived tab's workspace no longer exists: ${entry.workspaceUuid}`,
        );
      }
      await gZenWorkspaces.changeWorkspace(workspace);
      const tab = gBrowser.addTab(entry.url, {
        inBackground: false,
        userContextId: workspace.containerTabId ?? entry.userContextId,
        triggeringPrincipal:
          Services.scriptSecurityManager.getSystemPrincipal(),
      });
      tab.setAttribute("zen-workspace-id", workspace.uuid);
      await ZenAutoArchiveStore.remove(entry.id);
      this.entries = this.entries.filter((item) => item.id !== entry.id);
    } catch (error) {
      console.error("Failed to restore archived tab", error);
    } finally {
      const busy = new Set(this.busy);
      busy.delete(entry.id);
      this.busy = busy;
    }
  }

  render() {
    return html`
      ${
        this.entries.length
          ? repeat(
              this.entries,
              (entry) => entry.id,
              (entry) => html`
                <div class="zen-library-row" data-entry-id=${entry.id}>
                  <img
                    class="zen-library-row-icon"
                    src="page-icon:${entry.url}"
                    alt=""
                  />
                  <div class="zen-library-row-text">
                    <span class="zen-library-row-title"
                      >${entry.title || entry.url}</span
                    >
                    <span class="zen-library-row-subtitle">${entry.url}</span>
                  </div>
                  <div class="zen-library-row-actions">
                    <toolbarbutton
                      class="toolbarbutton-1 zen-library-archive-delete"
                      data-l10n-id="library-auto-archive-delete-button"
                      ?disabled=${this.busy.has(entry.id)}
                      @click=${(event) => {
                        event.stopPropagation();
                        this.#delete(entry);
                      }}
                    >
                      <img
                        class="toolbarbutton-icon"
                        src="chrome://browser/skin/zen-icons/trash.svg"
                        alt=""
                      />
                    </toolbarbutton>
                    <toolbarbutton
                      class="toolbarbutton-1 zen-library-archive-restore"
                      data-l10n-id="library-auto-archive-restore-button"
                      ?disabled=${this.busy.has(entry.id)}
                      @click=${(event) => {
                        event.stopPropagation();
                        this.#restore(entry);
                      }}
                    >
                      <img
                        class="toolbarbutton-icon"
                        src="chrome://browser/skin/zen-icons/u-turn-to-left.svg"
                        alt=""
                      />
                    </toolbarbutton>
                  </div>
                </div>
              `,
            )
          : html`<div
              class="zen-library-empty"
              data-l10n-id="library-auto-archive-empty"
            ></div>`
      }
    `;
  }
}

customElements.define("zen-library-archive-section", ZenLibraryArchiveSection);
