import { z } from "zod";
import { S5_ROLES } from "./auth";

/**
 * Request body schemas for the 5S API.
 *
 * Handlers previously destructured `await req.json()` directly, which is typed
 * `any` — TypeScript's strict mode could not help, and malformed input surfaced
 * as a 500 from Postgres. Every write endpoint now validates here first, so
 * bad input is a 400 with a clear message.
 *
 * Convention: POST bodies require their mandatory fields; PUT bodies are merge
 * semantics, so every field is optional and `undefined` means "leave unchanged".
 */

const shortText = z.string().max(128);
const longText = z.string().max(2000);
const identifier = z.string().min(1).max(64);
const isoDate = z.string().min(1).max(32);

/** Audit answers/notes are free-form nested JSON produced by the form UI. */
const jsonRecord = z.record(z.string(), z.unknown());

const AUDIT_STATUSES = ["tamamlandi", "taslak", "iptal"] as const;
const ACTION_STATUSES = ["Açık", "Devam Ediyor", "Tamamlandı", "İptal"] as const;
const ACTION_PRIORITIES = ["Düşük", "Orta", "Yüksek", "Kritik"] as const;
const PLAN_STATUSES = ["Bekliyor", "Devam Ediyor", "Tamamlandı", "İptal"] as const;

export const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

export const createAuditSchema = z.object({
  area_id: identifier,
  area_name: shortText.optional(),
  date: isoDate,
  shift: z.string().max(16).optional(),
  total_score: z.number().int().min(0).max(100).optional(),
  pillars_json: jsonRecord.optional(),
  answers_json: jsonRecord.optional(),
  notes_json: jsonRecord.optional(),
  photos_json: jsonRecord.optional(),
  status: z.enum(AUDIT_STATUSES).optional(),
  form_code: z.string().max(64).optional(),
  location: shortText.optional(),
  team_leader: shortText.optional(),
});

export const updateAuditSchema = createAuditSchema.partial();

export const createAreaSchema = z.object({
  id: identifier,
  name: shortText.min(1),
  dept: shortText.optional(),
  alt_dept: shortText.optional(),
  fabrika: shortText.optional(),
  description: longText.optional(),
});

export const updateAreaSchema = createAreaSchema.omit({ id: true }).partial();

export const createActionSchema = z.object({
  audit_id: z.uuid().nullish(),
  area_id: identifier.nullish(),
  area_name: shortText.optional(),
  description: longText.min(1),
  assigned_to: shortText.optional(),
  due_date: isoDate.nullish(),
  status: z.enum(ACTION_STATUSES).optional(),
  priority: z.enum(ACTION_PRIORITIES).optional(),
});

export const updateActionSchema = createActionSchema.partial();

export const createUserSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
  name: shortText.min(1),
  role: z.enum(S5_ROLES),
  dept: shortText.optional(),
  fabrika: shortText.optional(),
  bolum: shortText.optional(),
});

export const updateUserSchema = createUserSchema.partial();

export const createPlanSchema = z.object({
  area_id: identifier,
  area_name: shortText.optional(),
  auditor_id: z.uuid(),
  auditor_name: shortText.optional(),
  planned_date: isoDate,
  shift: z.string().max(16).optional(),
  form_template_id: z.string().max(64).optional(),
  notes: longText.optional(),
});

export const updatePlanSchema = z.object({
  status: z.enum(PLAN_STATUSES),
  completed_audit_id: z.uuid().nullish(),
});

export const formTemplateSchema = z.object({
  adi: shortText.min(1),
  aciklama: longText.optional(),
  pillarlar: z.array(z.unknown()).optional(),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1).max(200),
  new_password: z.string().min(1).max(200),
});
