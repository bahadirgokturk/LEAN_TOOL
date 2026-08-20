/**
 * Shared globals of the 5S browser app.
 *
 * The 5S UI is a set of plain scripts in `public/5s/js` that talk to each other
 * through globals — there is no module system there. As files are migrated to
 * TypeScript one at a time, this file describes the globals a migrated module
 * may rely on, so the compiler can check those uses instead of trusting them.
 *
 * Every declaration here mirrors something that already exists at runtime in
 * `public/5s/js/app.js`. Keep them in step.
 */

type S5Role = "admin" | "denetci" | "takimlider" | "departman";

interface S5User {
  id: string;
  username: string;
  name: string;
  role: S5Role;
  fabrika?: string;
  dept?: string;
  bolum?: string;
}

interface S5Audit {
  id: string;
  area_id?: string | null;
  area_name?: string;
  auditor_id?: string | null;
  auditor_name?: string;
  date?: string;
  total_score?: number;
  [column: string]: unknown;
}

interface S5Area {
  id: string;
  name: string;
  dept?: string;
  alt_dept?: string;
  fabrika?: string;
}

interface S5Plan {
  id: string;
  area_id: string;
  area_name?: string;
  auditor_id: string;
  planned_date?: string;
  shift?: string;
  status?: string;
  notes?: string;
  form_template_id?: string | null;
}

interface S5FormTemplate {
  id: string;
  adi: string;
  aciklama?: string;
  pillarlar?: unknown[];
  aktif?: boolean;
  form_tipi?: string | null;
}

/** The single client-side store every screen renders from. */
interface S5Store {
  audits: S5Audit[];
  areas: S5Area[];
  actions: Array<Record<string, unknown>>;
  users: S5User[];
  atamalar: S5Plan[];
  /** Undefined until the templates have been fetched. */
  formSablonlari: S5FormTemplate[] | undefined;
  auditors: string[];
  [key: string]: unknown;
}

declare let S: S5Store;

/** The signed-in user, or null before login and after logout. */
declare let CURRENT_USER: S5User | null;

/**
 * Calls the 5S API.
 *
 * Returns null when the session has expired (the helper logs the user out) or
 * when the endpoint answers 204, so callers must handle a null result.
 */
declare function apiFetch<T = unknown>(path: string, options?: RequestInit): Promise<T | null>;

declare function navigate(page: string): void;
declare function updateBadges(): void;
declare function applyActiveTemplate(): void;
declare function showToast(message: string): void;

/** QR form type → label, e.g. `uretim` → `Üretim`. */
declare const FORM_TIP_LABEL: Record<string, string>;
