import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticRoot = path.join(repoRoot, "crates", "ironclaw_webui_v2_static", "static");

const expectedBuild = {
  frontendDist: "../crates/ironclaw_webui_v2_static/static",
  devUrl: "http://localhost:1420/index.html",
  beforeDevCommand: "npm run dev:webui-static",
  beforeBuildCommand: "npm run prepare:webui-static",
};

const requiredStaticFiles = [
  "index.html",
  "js/main.js",
  "js/main.bundle.js",
  "styles/app.css",
  "styles/tailwind.generated.css",
  "vendor/purify.min.js",
  "vendor/marked.umd.js",
  "vendor/highlight.min.js",
];

const forbiddenIndexFragments = [
  "cdn.tailwindcss.com",
  "@tailwindcss/browser",
  "https://esm.sh",
  "https://unpkg.com",
  "https://cdn.jsdelivr.net",
];

function fail(message) {
  throw new Error(message);
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

async function assertAccess(relativePath) {
  await access(path.join(staticRoot, relativePath));
}

async function assertBuildConfig() {
  const tauriConfig = await readJson("src-tauri/tauri.conf.json");
  const build = tauriConfig.build ?? {};

  for (const [key, expected] of Object.entries(expectedBuild)) {
    if (build[key] !== expected) {
      fail(`src-tauri/tauri.conf.json build.${key} must be ${JSON.stringify(expected)}, got ${JSON.stringify(build[key])}`);
    }
  }

  const packageJson = await readJson("package.json");
  const scripts = packageJson.scripts ?? {};
  if (scripts["prepare:webui-static"] !== "node scripts/prepare-webui-static.mjs") {
    fail("package.json scripts.prepare:webui-static must prepare the shared static WebUI");
  }
  if (scripts["dev:webui-static"] !== "node scripts/serve-webui-static.mjs") {
    fail("package.json scripts.dev:webui-static must serve the shared static WebUI");
  }
  if (scripts["smoke:webui-static"] !== "node scripts/smoke-webui-static.mjs") {
    fail("package.json scripts.smoke:webui-static must exercise the shared static WebUI");
  }
}

async function assertStaticRoot() {
  for (const file of requiredStaticFiles) {
    await assertAccess(file);
  }

  const index = await readFile(path.join(staticRoot, "index.html"), "utf8");
  if (!index.includes('src="/js/main.bundle.js"')) {
    fail("static index.html must load the bundled shared WebUI entry /js/main.bundle.js");
  }
  if (!index.includes('href="/styles/tailwind.generated.css"')) {
    fail("static index.html must load generated local Tailwind CSS");
  }
  if (!index.includes('href="/styles/app.css"')) {
    fail("static index.html must load local app.css");
  }

  for (const fragment of forbiddenIndexFragments) {
    if (index.includes(fragment)) {
      fail(`static index.html must not depend on external frontend asset ${fragment}`);
    }
  }
}

async function assertBundleFreshness() {
  const bundle = await stat(path.join(staticRoot, "js", "main.bundle.js"));
  const entry = await stat(path.join(staticRoot, "js", "main.js"));
  const css = await stat(path.join(staticRoot, "styles", "tailwind.generated.css"));

  if (bundle.mtimeMs + 1000 < entry.mtimeMs) {
    fail("js/main.bundle.js is older than js/main.js; run npm run prepare:webui-static");
  }
  if (css.size < 1024) {
    fail("styles/tailwind.generated.css is unexpectedly small; run npm run prepare:webui-static");
  }
}

await assertBuildConfig();
await assertStaticRoot();
await assertBundleFreshness();

console.log(`Static frontend contract OK: Tauri packages ${path.relative(repoRoot, staticRoot)}`);
