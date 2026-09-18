const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

globalThis.HomeLens = {};
for (const file of ["extension/src/constants.js", "extension/src/utils.js", "extension/src/extractor.js"]) {
  vm.runInThisContext(fs.readFileSync(file, "utf8"), { filename: file });
}

function mockImage(values = {}) {
  const attributes = values.attributes || {};
  return {
    currentSrc: values.currentSrc || "",
    src: values.src || "",
    srcset: values.srcset || "",
    dataset: values.dataset || {},
    naturalWidth: values.width || 800,
    naturalHeight: values.height || 600,
    getAttribute(name) { return attributes[name] || null; },
    closest() { return values.link ? { href: values.link } : null; }
  };
}

test("collects JSON-LD, lazy and responsive listing images", () => {
  const galleryImages = [
    mockImage({ src: "https://img.example/one.jpg", srcset: "https://img.example/one-small.jpg 400w, https://img.example/one-large.jpg 1200w" }),
    mockImage({ dataset: { lazySrc: "/two.webp", full: "https://img.example/two-large.webp" } }),
    mockImage({ src: "data:image/png;base64,ignored", link: "https://img.example/three.jpg" })
  ];
  const doc = {
    querySelector(selector) {
      if (selector.includes("og:image")) return { getAttribute: () => "https://img.example/social.jpg" };
      return null;
    },
    querySelectorAll() { return galleryImages; },
    images: galleryImages
  };

  const result = HomeLens.extractor.collectImages(doc, {
    image: ["https://img.example/hero.jpg", { contentUrl: "https://img.example/four.png" }]
  }, "https://portal.example/listing/1");

  assert.equal(result[0], "https://img.example/hero.jpg");
  assert.ok(result.includes("https://img.example/two-large.webp"));
  assert.ok(result.includes("https://img.example/one-large.jpg"));
  assert.ok(result.includes("https://img.example/three.jpg"));
  assert.ok(!result.some((url) => url.startsWith("data:")));
});

test("keeps the full discovered listing gallery", () => {
  const images = Array.from({ length: 60 }, (_, index) => mockImage({ src: `https://img.example/${index}.jpg` }));
  const doc = { querySelector: () => null, querySelectorAll: () => images, images };
  assert.equal(HomeLens.extractor.collectImages(doc, {}, "https://portal.example/listing/1").length, 60);
});
