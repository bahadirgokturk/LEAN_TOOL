import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signToken } from "@/lib/s5/auth";
import { createAuditSchema } from "@/lib/s5/schemas";
import { POST as createAudit } from "./audits/route";
import { createRoleTestUser, ROLE_TEST_SECRET } from "./role-test-helpers";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/s5/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/s5/db")>("@/lib/s5/db");
  return { ...actual, query: queryMock };
});

/**
 * Fills in an audit with the real browser code, then posts it to the real API.
 *
 * The 5S form lives in `public/5s/js/*.js` and never goes through the bundler,
 * so nothing else checks that what the browser sends is what the endpoint
 * accepts. That seam is where audits were lost in production, and it is the one
 * place a type checker cannot help. This walks the whole path — answer every
 * question, press save, validate the payload, insert it — without a database.
 */
type FakeElement = {
  value: string;
  textContent: string;
  innerHTML: string;
  disabled: boolean;
  style: Record<string, string>;
  classList: { add(): void; remove(): void; toggle(): void; contains(): boolean };
  selectedOptions: Array<{ text: string }>;
};

function createElement(): FakeElement {
  return {
    value: "",
    textContent: "",
    innerHTML: "",
    disabled: false,
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    selectedOptions: [{ text: "" }],
  };
}

type CapturedRequest = { path: string; options: { method: string; body: string } };

type AppState = {
  areas: Array<Record<string, unknown>>;
  answers: Record<number, unknown[]>;
  notes: Record<number, string[]>;
  photos: Record<number, Record<number, string[]>>;
  audits: unknown[];
};

type Pillars = Array<{ id: string; questions: Array<{ type: string }> }>;

type BrowserApp = {
  /** The page's `S` object — live, not a copy. */
  state(): AppState;
  /** The active question set. */
  pillars(): Pillars;
  field(id: string): FakeElement;
  submitAudit(withReport?: boolean): Promise<void>;
  failNextSave(message: string): void;
  storedDraft(): string | null;
  lastRequest: CapturedRequest | null;
};

function loadBrowserApp(): BrowserApp {
  const elements = new Map<string, FakeElement>();
  const field = (id: string) => {
    let element = elements.get(id);
    if (!element) {
      element = createElement();
      elements.set(id, element);
    }
    return element;
  };

  const storage = new Map<string, string>();
  const context: Record<string, unknown> = {
    console,
    Blob,
    document: {
      getElementById: (id: string) => field(id),
      querySelectorAll: () => [],
      querySelector: () => null,
      createElement: () => createElement(),
      addEventListener: () => {},
      body: { appendChild() {} },
    },
    window: {},
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    },
    confirm: () => false,
  };
  context.globalThis = context;
  createContext(context);

  for (const file of ["public/5s/js/app.js", "public/5s/js/audit.js"]) {
    runInContext(readFileSync(file, "utf8").replace(/^﻿/, ""), context);
  }
  runInContext(
    ";globalThis.__bridge = { get S(){ return S; }, get PILLARS(){ return PILLARS; } };",
    context
  );

  // Replace only what needs a real page or network; the audit logic stays real.
  const captured: CapturedRequest[] = [];
  let failure: string | null = null;
  context.apiFetch = async (path: string, options: { method: string; body: string }) => {
    captured.push({ path, options });
    if (failure) throw new Error(failure);
    return { id: "saved-audit-id" };
  };
  context.showToast = () => {};
  context.navigate = () => {};
  context.updateBadges = () => {};
  context.showDetail = () => {};
  context.renderHistory = () => {};

  const bridge = context.__bridge as { S: AppState; PILLARS: Pillars };
  return {
    state: () => bridge.S,
    pillars: () => bridge.PILLARS,
    field,
    submitAudit: context.submitAudit as BrowserApp["submitAudit"],
    failNextSave(message: string) {
      failure = message;
    },
    storedDraft() {
      return [...storage.values()][0] ?? null;
    },
    get lastRequest() {
      return captured[captured.length - 1] ?? null;
    },
  };
}

const PHOTO_URL =
  "/api/s5/photos?path=2026-08-18/9f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f/" +
  "123e4567-e89b-12d3-a456-426614174000.jpg";

/** Answers every question the way the form's buttons would. */
function answerEveryQuestion(app: BrowserApp) {
  app.pillars().forEach((pillar, pi) => {
    app.state().answers[pi] = [];
    app.state().notes[pi] = [];
    app.state().photos[pi] = {};
    pillar.questions.forEach((question, qi) => {
      app.state().answers[pi][qi] =
        question.type === "count" ? 0 : question.type === "score" ? 4 : question.type === "mc" ? 0 : "evet";
      app.state().notes[pi][qi] = "";
      app.state().photos[pi][qi] = [];
    });
  });
  // One photo, held as the URL the upload endpoint hands back.
  app.state().photos[0][0] = [PHOTO_URL];
}

function fillHeader(app: BrowserApp) {
  app.state().areas = [{ id: "area-1", name: "1. Grup", fabrika: "İzmir", dept: "Üretim" }];
  app.field("audit-area").value = "area-1";
  app.field("audit-date").value = "2026-08-18";
  app.field("audit-shift").value = "Sabah";
  app.field("audit-form-code").value = "5S-2026-001";
  app.field("audit-location").value = "İzmir";
  app.field("audit-team-leader").value = "Takım Lideri";
  app.field("audit-auditor").value = "Denetçi Adı";
}

function filledForm(): BrowserApp {
  const app = loadBrowserApp();
  fillHeader(app);
  answerEveryQuestion(app);
  return app;
}

describe("filling in an audit and saving it, end to end", () => {
  beforeEach(() => {
    process.env.S5_JWT_SECRET = ROLE_TEST_SECRET;
    queryMock.mockReset();
    queryMock.mockResolvedValue({ rows: [{ id: "saved-audit-id" }], rowCount: 1 });
  });

  it("sends a body the API schema accepts", async () => {
    const app = filledForm();

    await app.submitAudit();

    expect(app.lastRequest?.path).toBe("/audits");
    expect(app.lastRequest?.options.method).toBe("POST");

    const parsed = createAuditSchema.safeParse(JSON.parse(app.lastRequest!.options.body));
    expect(parsed.error?.issues).toBeUndefined();
    expect(parsed.data).toMatchObject({
      area_id: "area-1",
      area_name: "1. Grup",
      date: "2026-08-18",
      status: "tamamlandi",
    });
    // A clean sheet scores 100, and the column only takes whole numbers.
    expect(parsed.data?.total_score).toBe(100);
    expect(Number.isInteger(parsed.data?.total_score)).toBe(true);
  });

  it("stores that same body through the real endpoint", async () => {
    const app = filledForm();
    await app.submitAudit();

    const request = new NextRequest("http://localhost/api/s5/audits", {
      method: "POST",
      headers: {
        authorization: `Bearer ${signToken(createRoleTestUser("denetci"))}`,
        "content-type": "application/json",
      },
      body: app.lastRequest!.options.body,
    });

    const response = await createAudit(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(201);
    const [sql, values] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO s5_audits");

    // The photo URL survives the round trip — it is what the detail screen renders.
    const storedPhotos = JSON.parse(values[10] as string);
    expect(storedPhotos["0"]["0"]).toEqual([PHOTO_URL]);
    // Answers are stored, not silently dropped.
    expect(JSON.parse(values[8] as string)["0"]).toBeTruthy();
  });

  it("clears the local draft once the audit is stored", async () => {
    const app = filledForm();

    await app.submitAudit();

    expect(app.state().audits).toHaveLength(1);
    expect(app.storedDraft()).toBe(null);
  });

  it("keeps the local draft when saving fails", async () => {
    const app = filledForm();
    app.failNextSave("Sunucu hatası");

    await app.submitAudit();

    // Nothing was stored server-side, so the filled-in form must still be here.
    expect(app.state().audits).toHaveLength(0);
    const draft = JSON.parse(app.storedDraft() ?? "null");
    expect(draft?.answers?.["0"]).toEqual(app.state().answers[0]);
    expect(draft?.photos?.["0"]?.["0"]).toEqual([PHOTO_URL]);
    expect(draft?.header?.areaId).toBe("area-1");
  });
});
