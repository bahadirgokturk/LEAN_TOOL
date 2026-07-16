import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_LOG_TYPES = [
  "risk_report",
  "workload_analysis",
  "meeting_summary",
  "delay_alert",
  "weekly_report",
  "activity_suggestion",
] as const;

const MAX_SYSTEM_PROMPT_LENGTH = 4000;
const MAX_USER_MESSAGE_LENGTH = 20000;

// Server-side proxy for Claude calls. The Anthropic API key never reaches the
// browser: it's read from an env var here and the request is authenticated
// against the caller's own Supabase session (RLS decides what they can see).
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const { projectId, logType, systemPrompt, userMessage, schema } = (body ?? {}) as Record<string, unknown>;

  if (typeof projectId !== "string" || !projectId) {
    return NextResponse.json({ error: "projectId zorunludur." }, { status: 400 });
  }
  if (typeof logType !== "string" || !VALID_LOG_TYPES.includes(logType as (typeof VALID_LOG_TYPES)[number])) {
    return NextResponse.json({ error: "Geçersiz logType." }, { status: 400 });
  }
  if (typeof systemPrompt !== "string" || typeof userMessage !== "string") {
    return NextResponse.json({ error: "systemPrompt ve userMessage zorunludur." }, { status: 400 });
  }
  if (systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH || userMessage.length > MAX_USER_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "İstek çok uzun." }, { status: 400 });
  }
  // Optional structured-output schema. When present, Claude is constrained to return a
  // JSON object matching it (output_config.format), which we parse and return as `data`.
  let outputSchema: Record<string, unknown> | null = null;
  if (schema != null) {
    if (typeof schema !== "object" || Array.isArray(schema)) {
      return NextResponse.json({ error: "Geçersiz schema." }, { status: 400 });
    }
    if (JSON.stringify(schema).length > 8000) {
      return NextResponse.json({ error: "Schema çok büyük." }, { status: 400 });
    }
    outputSchema = schema as Record<string, unknown>;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  // Confirms the caller is this project's PM (AI features are PM-only, same as legacy app).
  // Relies on RLS: is_project_pm() runs as the caller, project_members row must be visible to them.
  const { data: isPm, error: pmCheckError } = await supabase.rpc("is_project_pm", {
    p_project_id: projectId,
  });

  if (pmCheckError || !isPm) {
    return NextResponse.json({ error: "Bu işlem için PM yetkisi gereklidir." }, { status: 403 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI servisi yapılandırılmamış." }, { status: 503 });
  }

  let aiText = "";
  let aiData: unknown = null;
  try {
    const requestBody: Record<string, unknown> = {
      model: "claude-sonnet-5",
      // Structured reports can be long; give plenty of headroom (only billed for used tokens).
      max_tokens: outputSchema ? 8000 : 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    };
    // Structured output: constrain the model to a JSON object matching the schema.
    if (outputSchema) {
      requestBody.output_config = { format: { type: "json_schema", schema: outputSchema } };
      // Sonnet 5 runs adaptive thinking by DEFAULT; those thinking tokens were eating the
      // max_tokens budget and truncating the JSON (stop_reason: max_tokens). Reports don't
      // need extended reasoning, so disable thinking → the whole budget goes to the JSON.
      requestBody.thinking = { type: "disabled" };
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => null);
      const message = errBody?.error?.message || `API hatası: ${resp.status}`;
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const data = await resp.json();
    // Extract every text block and join them. Do NOT read content[0] blindly:
    // newer models (Sonnet 5 etc.) may put a thinking block first, so the first
    // block often has no .text and the response would look empty.
    aiText = Array.isArray(data.content)
      ? data.content
          .filter((b: { type?: string }) => b?.type === "text")
          .map((b: { text?: string }) => b.text || "")
          .join("")
          .trim()
      : "";

    if (outputSchema) {
      // Try a direct parse first; if that fails, salvage the JSON object substring
      // (tolerates code fences or stray prose if output_config wasn't honoured).
      const tryParse = (t: string): unknown => {
        try { return JSON.parse(t); } catch { return null; }
      };
      aiData = tryParse(aiText);
      if (aiData == null && aiText) {
        const s = aiText.indexOf("{");
        const e = aiText.lastIndexOf("}");
        if (s >= 0 && e > s) aiData = tryParse(aiText.slice(s, e + 1));
      }
      if (aiData == null) {
        // Surface why (truncation vs refusal vs empty) so the client shows an actionable error.
        const stop = data?.stop_reason || "bilinmiyor";
        const types = Array.isArray(data.content) ? data.content.map((b: { type?: string }) => b?.type).join(",") : "yok";
        return NextResponse.json(
          { error: `Yapılandırılmış yanıt alınamadı (durum: ${stop}, blok: ${types}, uzunluk: ${aiText.length}).` },
          { status: 502 },
        );
      }
      // Store the clean JSON string so history stays consistent.
      aiText = JSON.stringify(aiData);
    }
  } catch {
    return NextResponse.json({ error: "AI servisine ulaşılamadı." }, { status: 502 });
  }

  await supabase.from("ai_logs").insert({
    project_id: projectId,
    log_type: logType,
    prompt: userMessage.slice(0, 500),
    response: aiText,
    created_by: user.id,
  });

  return NextResponse.json({ text: aiText, data: aiData });
}
