import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import * as LeanDocsCache from "../lean-docs-client/cache";

// Exercise the actual legacy UI, not a reimplementation of its save logic.
const html = readFileSync("public/kaizen-docs/index.html", "utf8");
const script = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));

function createApp(quotaExceeded = false) {
  const stored = new Map<string, string>();
  const elements = new Map<string, { value: string; innerHTML: string; textContent: string; style: object; classList: object; addEventListener: () => void }>();
  const document = {
    getElementById(id: string) {
      if (!elements.has(id)) elements.set(id, {
        value: "", innerHTML: "", textContent: "", style: {},
        classList: { toggle() {}, remove() {}, add() {} },
        addEventListener() {},
      });
      return elements.get(id);
    },
    querySelector: (selector: string) => selector === ".content-area"
      ? { classList: { add() {}, remove() {} } } : null,
    querySelectorAll: () => [],
  };
  const records = new Map<string, Record<string, unknown>>();
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return Response.json([]);
    const request = JSON.parse(String(init.body));
    const payload = structuredClone(request.payload);
    payload.isAdimlar = payload.isAdimlar.map((row: Record<string, unknown>) => ({
      ...row, foto: "/api/lean-docs/media?path=saved-photo.jpg",
    }));
    records.set(request.id, payload);
    return Response.json({ id: request.id, payload });
  });
  const context = createContext({
    document, fetch, console, Response, crypto, setTimeout, clearTimeout, LeanDocsCache,
    sessionStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (quotaExceeded) throw new DOMException("Quota exceeded", "QuotaExceededError");
        stored.set(key, value);
      },
    },
  });
  // Initial hydration runs separately in production; tests control the saved records.
  runInContext(script.replace(/renderDashboard\(\);\s*hydrateRemoteRecords\(\);\s*$/, ""), context);
  runInContext(`
    showToast = function(message) { globalThis.lastToast = message; };
    sofValidate = function() { return true; };
    renderSofEkCards = renderSofKkdCards = sofRenderRows = function() {};
  `, context);
  const run = (code: string) => runInContext(code, context);
  return { run, records, fetch };
}

describe("SOF record lifecycle", () => {
  it("saves two records and edits the first without losing either, even when browser storage is full", async () => {
    const app = createApp(true);
    app.run(`initSofForm(null); document.getElementById('sof-op-name').value='First';
      sofRows=[{id:1,adim:'Step one',foto:'data:image/jpeg;base64,/9j/'}];`);
    await app.run("sofSave()");
    const firstId = [...app.records.keys()][0];
    app.run(`initSofForm(null); document.getElementById('sof-op-name').value='Second';`);
    await app.run("sofSave()");
    expect(app.run("getStore('sofDocuments').length")).toBe(2);
    app.run(`initSofForm(getStore('sofDocuments').find(d=>d.id===${JSON.stringify(firstId)}));
      document.getElementById('sof-op-name').value='First revised';`);
    await app.run("sofSave()");
    expect(app.records.size).toBe(2);
    expect(app.records.get(firstId)?.opName).toBe("First revised");
    expect(app.run("getStore('sofDocuments').length")).toBe(2);
  });

  it("switching from update to create never overwrites the selected record", async () => {
    const app = createApp();
    app.run("initSofForm({id:'existing',opName:'Original',isAdimlar:[]}); sofSetType('sifirdan');");
    await app.run("sofSave()");
    expect([...app.records.keys()][0]).not.toBe("existing");
  });

  it("caches saved photo URLs instead of the original base64 images", async () => {
    const app = createApp();
    app.run("initSofForm(null); sofRows=[{id:1,adim:'Step',foto:'data:image/jpeg;base64,/9j/'}];");
    await app.run("sofSave()");
    expect(app.run("getStore('sofDocuments')[0].isAdimlar[0].foto"))
      .toBe("/api/lean-docs/media?path=saved-photo.jpg");
  });

  it("keeps the draft on server failure", async () => {
    const app = createApp();
    app.fetch.mockResolvedValueOnce(Response.json({ error: "Kaydedilemedi" }, { status: 500 }));
    app.run("initSofForm(null); document.getElementById('sof-op-name').value='Unsaved work';");
    await app.run("sofSave()");
    expect(app.run("sofVal('sof-op-name')")).toBe("Unsaved work");
    expect(app.run("getStore('sofDocuments')")).toEqual([]);
  });

  it("ignores a second click while saving and reuses the draft id after a failed response", async () => {
    const app = createApp();
    let complete!: (response: Response) => void;
    app.fetch.mockImplementationOnce(() => new Promise<Response>((resolve) => { complete = resolve; }));
    app.run("initSofForm(null);");
    const first = app.run("sofSave()");
    await app.run("sofSave()");
    expect(app.fetch).toHaveBeenCalledTimes(1);
    const firstRequest = JSON.parse(String(app.fetch.mock.calls[0][1]?.body));
    complete(Response.json({ error: "Temporary failure" }, { status: 500 }));
    await first;
    await app.run("sofSave()");
    expect([...app.records.keys()]).toEqual([firstRequest.id]);
  });

  it("requires selecting an existing SOF in update mode", async () => {
    const app = createApp();
    app.run("initSofForm(null); sofSetType('guncelle');");
    await app.run("sofSave()");
    expect(app.fetch).not.toHaveBeenCalled();
    expect(app.run("lastToast")).toContain("seçin");
  });
});
