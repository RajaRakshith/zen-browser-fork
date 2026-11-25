// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { JSONFile } from "resource://gre/modules/JSONFile.sys.mjs";

const STORE_FILE = "zen-auto-archive.json";

/** Profile-local metadata for tabs closed by automatic cleanup. */
export class ZenAutoArchiveStoreImpl {
  #ready = null;
  #savePromise = Promise.resolve();

  async #data() {
    if (!this.#ready) {
      this.#ready = (async () => {
        const file = new JSONFile({
          path: PathUtils.join(PathUtils.profileDir, STORE_FILE),
          dataPostProcessor(data) {
            return {
              entries: Array.isArray(data?.entries) ? data.entries : [],
            };
          },
        });
        try {
          await file.load();
          return structuredClone(file.data);
        } finally {
          await file.finalize();
        }
      })();
    }
    return this.#ready;
  }

  #save(data) {
    const path = PathUtils.join(PathUtils.profileDir, STORE_FILE);
    const snapshot = structuredClone(data);
    this.#savePromise = this.#savePromise
      .catch(() => {})
      .then(() =>
        IOUtils.writeJSON(path, snapshot, { tmpPath: `${path}.tmp` }),
      );
    return this.#savePromise;
  }

  async add(entry) {
    const data = await this.#data();
    const record = {
      id: entry.id || Services.uuid.generateUUID().toString(),
      url: String(entry.url),
      title: String(entry.title ?? ""),
      workspaceUuid: String(entry.workspaceUuid ?? ""),
      userContextId: Number(entry.userContextId) || 0,
      archivedAt: Number(entry.archivedAt) || Date.now(),
    };
    data.entries.push(record);
    await this.#save(data);
    return record;
  }

  async list() {
    const { entries } = await this.#data();
    return entries
      .map((entry) => ({ ...entry }))
      .sort((a, b) => b.archivedAt - a.archivedAt);
  }

  async remove(id) {
    const data = await this.#data();
    data.entries = data.entries.filter((entry) => entry.id !== id);
    await this.#save(data);
  }
}

export const ZenAutoArchiveStore = new ZenAutoArchiveStoreImpl();
