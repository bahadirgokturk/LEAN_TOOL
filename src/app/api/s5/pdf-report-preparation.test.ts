import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";

type ReportPhoto = {
  key: string;
  src: string;
  label: string;
  finding: string;
  action: string;
  ownerDeadline: string;
  selected: boolean;
};

function loadReportHelpers() {
  const element = () => ({
    value: "",
    textContent: "",
    innerHTML: "",
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {},
    appendChild() {},
    append() {},
    querySelector: () => null,
    querySelectorAll: () => [],
  });
  const context: Record<string, unknown> = {
    console,
    Blob,
    URL,
    document: {
      getElementById: () => null,
      querySelectorAll: () => [],
      querySelector: () => null,
      createElement: element,
      addEventListener() {},
      body: { appendChild() {} },
    },
    window: {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    confirm: () => false,
  };
  context.globalThis = context;
  createContext(context);
  for (const file of ["public/5s/js/app.js", "public/5s/js/audit.js"]) {
    runInContext(readFileSync(file, "utf8").replace(/^﻿/, ""), context);
  }
  runInContext(
    `globalThis.__report = {
      collect: _collectAuditReportPhotos,
      normalize: _normalizeAuditReportRows,
      get PILLARS(){ return PILLARS; }
    };`,
    context,
  );
  return context.__report as {
    collect(audit: Record<string, unknown>): ReportPhoto[];
    normalize(rows: ReportPhoto[]): ReportPhoto[];
    PILLARS: Array<{ id: string; questions: Array<{ text: string }> }>;
  };
}

describe("5S PDF report preparation", () => {
  it("collects every audit photo with a stable key and an empty editable finding", () => {
    const app = loadReportHelpers();
    const photos = app.collect({
      photos_json: { 0: { 0: ["/photo-a.jpg", "/photo-b.jpg"] }, 1: { 2: ["/photo-c.jpg"] } },
      notes_json: { 0: ["Sahadaki açıklama"] },
    });

    expect(photos).toHaveLength(3);
    expect(photos[0]).toMatchObject({
      key: "0:0:0",
      src: "/photo-a.jpg",
      label: "S1 · S.1",
      finding: "",
      selected: true,
    });
  });

  it("keeps only selected photos and trims editable action fields", () => {
    const app = loadReportHelpers();
    const rows: ReportPhoto[] = [
      { key: "a", src: "/a.jpg", label: "S1", finding: "  Bulgu  ", action: "  Düzelt  ", ownerDeadline: "  Bakım / 20.09  ", selected: true },
      { key: "b", src: "/b.jpg", label: "S2", finding: "Diğer", action: "", ownerDeadline: "", selected: false },
    ];

    expect(app.normalize(rows)).toEqual([
      { key: "a", src: "/a.jpg", label: "S1", finding: "Bulgu", action: "Düzelt", ownerDeadline: "Bakım / 20.09", selected: true },
    ]);
  });
});
