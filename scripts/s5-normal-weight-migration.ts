// Generate guarded SQL from an offline backup and an independently checked plan.
// Does not connect to a database. Default is a dry run ending with ROLLBACK.
// Usage: node scripts/s5-normal-weight-migration.ts backup.json plan.json [--commit]
import { readFileSync } from "node:fs";

const backup = JSON.parse(readFileSync(process.argv[2], "utf8"));
const plan = JSON.parse(readFileSync(process.argv[3], "utf8"));
const literal = (value: unknown) => "'" + JSON.stringify(value).replace(/'/g, "''") + "'::jsonb";
if (backup.audits.length !== plan.changes.length) throw new Error("Plan size mismatch");
const sql = `BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
LOCK TABLE public.s5_audits, public.s5_form_templates IN SHARE ROW EXCLUSIVE MODE;
DO $migration$
DECLARE
  backup jsonb := ${literal(backup)};
  changes jsonb := ${literal(plan.changes)};
  a jsonb;
  t jsonb;
  target jsonb;
  affected integer;
BEGIN
  IF (SELECT count(*) FROM public.s5_audits) <> jsonb_array_length(backup->'audits')
     OR (SELECT count(*) FROM public.s5_form_templates) <> jsonb_array_length(backup->'templates') THEN
    RAISE EXCEPTION 'Record count changed since backup; refresh backup and plan';
  END IF;
  FOR t IN SELECT value FROM jsonb_array_elements(backup->'templates') LOOP
    IF NOT EXISTS (SELECT 1 FROM public.s5_form_templates WHERE id=(t->>'id')::uuid AND pillarlar=t->'pillarlar') THEN
      RAISE EXCEPTION 'Template changed since backup';
    END IF;
  END LOOP;
  FOR a IN SELECT value FROM jsonb_array_elements(backup->'audits') LOOP
    SELECT value INTO STRICT target FROM jsonb_array_elements(changes) WHERE value->>'id'=a->>'id';
    UPDATE public.s5_audits SET total_score=(target->>'after')::integer, pillars_json=target->'pillars'
    WHERE id=(a->>'id')::uuid AND form_template_id=a->>'form_template_id'
      AND total_score=(a->>'total_score')::integer AND pillars_json=a->'pillars_json'
      AND answers_json=a->'answers_json'
      AND md5(coalesce(photos_json::text,''))=a->>'photos_hash'
      AND md5(coalesce(notes_json::text,''))=a->>'notes_hash'
      AND updated_at=(a->>'updated_at')::timestamptz;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN RAISE EXCEPTION 'Audit changed since backup: %', a->>'id'; END IF;
  END LOOP;
  FOR t IN SELECT value FROM jsonb_array_elements(backup->'templates') LOOP
    UPDATE public.s5_form_templates SET pillarlar=(
      SELECT jsonb_agg(jsonb_set(p.value,'{sorular}',(
        SELECT jsonb_agg(CASE WHEN q.value->>'w'='1' THEN jsonb_set(q.value,'{w}','2') ELSE q.value END ORDER BY q.n)
        FROM jsonb_array_elements(p.value->'sorular') WITH ORDINALITY q(value,n)
      )) ORDER BY p.n)
      FROM jsonb_array_elements(t->'pillarlar') WITH ORDINALITY p(value,n)
    ) WHERE id=(t->>'id')::uuid;
  END LOOP;
  FOR a IN SELECT value FROM jsonb_array_elements(backup->'audits') LOOP
    SELECT value INTO STRICT target FROM jsonb_array_elements(changes) WHERE value->>'id'=a->>'id';
    IF NOT EXISTS (SELECT 1 FROM public.s5_audits WHERE id=(a->>'id')::uuid
      AND total_score=(target->>'after')::integer AND pillars_json=target->'pillars'
      AND answers_json=a->'answers_json' AND md5(coalesce(photos_json::text,''))=a->>'photos_hash'
      AND md5(coalesce(notes_json::text,''))=a->>'notes_hash') THEN
      RAISE EXCEPTION 'Post-update integrity check failed';
    END IF;
  END LOOP;
END $migration$;
${process.argv.includes("--commit") ? "COMMIT" : "ROLLBACK"};`;
console.log(sql);
