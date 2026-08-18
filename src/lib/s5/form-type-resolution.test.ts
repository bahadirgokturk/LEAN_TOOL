import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";

/**
 * Exercises the real browser code in `public/5s/js/app.js`.
 *
 * The 5S UI is plain scripts served from `public/`, so it never goes through
 * the bundler and has no other test coverage. Which question set an audit opens
 * with is exactly the kind of rule that must not regress silently: getting it
 * wrong means an auditor answers the wrong department's questions.
 */
type Bridge = {
  S: { formSablonlari: unknown[] };
  PILLARS: Array<{ questions: Array<{ text: string }> }>;
  ACTIVE_TEMPLATE_ID: string | null;
};

type AppScope = Bridge & {
  templateForFormTip: (tip: string) => { id: string } | null;
  applyTemplateForFormTip: (tip: string) => string | null;
  templateIdForArea: (area: unknown) => string | null;
  getAreaFormTip: (area: unknown) => string;
};

function loadAppScript(): AppScope {
  const source = readFileSync("public/5s/js/app.js", "utf8").replace(/^\uFEFF/, "");
  const context: Record<string, unknown> = {
    console,
    document: { getElementById: () => null, querySelectorAll: () => [], addEventListener: () => {} },
    window: {},
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  };
  context.globalThis = context;
  createContext(context);

  // `let` declarations stay out of the VM global object, so state is bridged.
  runInContext(
    `${source}
     ;globalThis.__bridge = {
       get S(){ return S; },
       get PILLARS(){ return PILLARS; },
       get ACTIVE_TEMPLATE_ID(){ return ACTIVE_TEMPLATE_ID; },
     };`,
    context
  );

  const bridge = context.__bridge as Bridge;
  return new Proxy({} as AppScope, {
    get(_target, property: string) {
      if (property in bridge) return bridge[property as keyof Bridge];
      return context[property];
    },
  });
}

const question = (text: string) => ({ text, type: "yn3", w: 3, photo: true });

const TEMPLATES = [
  {
    id: "tpl-ofis",
    adi: "Ofis Formu",
    form_tipi: "ofis",
    aktif: false,
    pillarlar: [{ id: "S1", sorular: [question("Ofis: masa üstü düzenli mi?")] }],
  },
  {
    id: "tpl-uretim",
    adi: "Üretim Formu",
    form_tipi: "uretim",
    aktif: false,
    pillarlar: [{ id: "S1", sorular: [question("Üretim: hat çevresi temiz mi?")] }],
  },
  {
    id: "tpl-genel",
    adi: "Genel Form",
    form_tipi: null,
    aktif: true,
    pillarlar: [{ id: "S1", sorular: [question("Genel soru")] }],
  },
];

const OFFICE_AREA = { id: "a1", name: "OPEX Ofisi", dept: "Ofis", alt_dept: "Ofis" };
const PRODUCTION_AREA = { id: "a2", name: "1. Grup", dept: "Üretim", alt_dept: "Tobacco" };
const QUALITY_AREA = { id: "a3", name: "KK Masası", dept: "Operasyon", alt_dept: "Kalite" };

describe("which question set an audit opens with", () => {
  function scopeWithTemplates() {
    const app = loadAppScript();
    app.S.formSablonlari = structuredClone(TEMPLATES);
    return app;
  }

  it("loads the question set bound to the scanned QR type", () => {
    const app = scopeWithTemplates();

    app.applyTemplateForFormTip("ofis");
    expect(app.ACTIVE_TEMPLATE_ID).toBe("tpl-ofis");
    expect(app.PILLARS[0].questions[0].text).toContain("Ofis: masa");

    app.applyTemplateForFormTip("uretim");
    expect(app.PILLARS[0].questions[0].text).toContain("Üretim: hat");
  });

  it("falls back to the default form for a type with no template bound", () => {
    const app = scopeWithTemplates();

    app.applyTemplateForFormTip("kalite");

    expect(app.ACTIVE_TEMPLATE_ID).toBe("tpl-genel");
  });

  it("maps a selected area onto its department's form", () => {
    const app = scopeWithTemplates();

    expect(app.getAreaFormTip(OFFICE_AREA)).toBe("ofis");
    expect(app.templateIdForArea(OFFICE_AREA)).toBe("tpl-ofis");
    expect(app.templateIdForArea(PRODUCTION_AREA)).toBe("tpl-uretim");
    // Quality has no bound template here, so the default form stands in.
    expect(app.templateIdForArea(QUALITY_AREA)).toBe("tpl-genel");
  });

  it("behaves as before when the form_tipi column has not been migrated", () => {
    const app = loadAppScript();
    app.S.formSablonlari = structuredClone(TEMPLATES).map((template) => {
      const withoutType: Record<string, unknown> = { ...template };
      delete withoutType.form_tipi;
      return withoutType;
    });

    expect(app.templateForFormTip("ofis")).toBe(null);
    expect(app.templateIdForArea(OFFICE_AREA)).toBe("tpl-genel");
  });
});
