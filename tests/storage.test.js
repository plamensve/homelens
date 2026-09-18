const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const state = {};
globalThis.chrome = {
  storage: {
    local: {
      get(keys, callback) {
        const list = Array.isArray(keys) ? keys : [keys];
        callback(Object.fromEntries(list.filter((key) => key in state).map((key) => [key, state[key]])));
      },
      set(values, callback) { Object.assign(state, values); callback(); }
    }
  }
};
globalThis.HomeLens = {};
for (const file of ["extension/src/constants.js", "extension/src/utils.js", "extension/src/storage.js"]) {
  vm.runInThisContext(fs.readFileSync(file, "utf8"), { filename: file });
}

test("re-saving a property refreshes its gallery without changing saved date", async () => {
  const first = await HomeLens.store.saveProperty({ id: "listing-1", title: "Имот", images: ["https://img.example/1.jpg"] });
  const savedAt = first.saved[0].savedAt;
  const updated = await HomeLens.store.saveProperty({ id: "listing-1", title: "Имот", images: ["https://img.example/1.jpg", "https://img.example/2.jpg"] });

  assert.equal(updated.updated, true);
  assert.equal(updated.saved.length, 1);
  assert.equal(updated.saved[0].savedAt, savedAt);
  assert.deepEqual(updated.saved[0].images, ["https://img.example/1.jpg", "https://img.example/2.jpg"]);
});
