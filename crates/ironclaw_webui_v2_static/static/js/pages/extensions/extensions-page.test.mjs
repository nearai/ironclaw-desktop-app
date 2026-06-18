import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function extensionsPageSourceForTest() {
  const source = readFileSync(new URL("./extensions-page.js", import.meta.url), "utf8");
  const lines = [];
  for (const line of source.split("\n")) {
    if (line.startsWith("import ")) continue;
    lines.push(line.replace(/^export function /, "function "));
  }
  return `${lines.join("\n")}\nglobalThis.__testExports = { ExtensionsPage };`;
}

function renderExtensionsPage(tab) {
  const context = {
    ActionToast() {},
    ChannelsTab() {},
    ConfigureModal() {},
    InstalledTab() {},
    McpTab() {},
    Navigate() {},
    React: {
      useCallback: (fn) => fn,
      useEffect: () => {},
      useRef: (initial) => ({ current: initial }),
      useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
    },
    RegistryTab() {},
    globalThis: {},
    html(strings, ...values) {
      return { strings: Array.from(strings), values };
    },
    resolveConnectorDeepLink: () => null,
    useExtensions: () => ({
      status: {},
      extensions: [],
      channels: [],
      mcpServers: [],
      channelRegistry: [],
      mcpRegistry: [],
      catalogEntries: [],
      connectableChannels: [],
      isLoading: false,
      isBusy: false,
      actionResult: null,
      clearResult: () => {},
      install: () => {},
      addCustomMcp: () => {},
      activate: () => {},
      remove: () => {},
      invalidate: () => {},
    }),
    useParams: () => ({ tab }),
    useSearchParams: () => [new URLSearchParams(), () => {}],
  };
  vm.runInNewContext(extensionsPageSourceForTest(), context);
  return {
    ...context,
    rendered: context.globalThis.__testExports.ExtensionsPage(),
  };
}

for (const tab of ["unknown", "bogus"]) {
  test(`ExtensionsPage redirects ${tab} tab to registry`, () => {
    const { Navigate, rendered } = renderExtensionsPage(tab);

    assert.equal(rendered.values[0], Navigate);
    assert.match(rendered.strings.join(""), /to="\/extensions\/registry"/);
  });
}

test("ExtensionsPage renders the installed tab instead of redirecting", () => {
  const { ActionToast, Navigate, rendered } = renderExtensionsPage("installed");

  assert.notEqual(rendered.values[0], Navigate);
  assert.equal(rendered.values[0], ActionToast);
  assert.doesNotMatch(rendered.strings.join(""), /to="\/extensions\/registry"/);
});
