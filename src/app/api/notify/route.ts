import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const MAX_NOTIFICATION_RECIPIENTS = 50;

const ROLE_TR: Record<string, string> = { pm: "Proje Yöneticisi", member: "Ekip Üyesi" };

// Sends a "you were added to project X" notification to the given project members.
// Best-effort: the caller must be the project's PM; email failures never block the app.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const { projectId, memberIds } = (body ?? {}) as { projectId?: string; memberIds?: string[] };
  if (typeof projectId !== "string" || !projectId || !Array.isArray(memberIds) || !memberIds.length) {
    return NextResponse.json({ error: "projectId ve memberIds zorunludur." }, { status: 400 });
  }
  if (
    memberIds.length > MAX_NOTIFICATION_RECIPIENTS ||
    memberIds.some((id) => typeof id !== "string" || id.length === 0 || id.length > 128)
  ) {
    return NextResponse.json({ error: "Geçersiz veya çok fazla alıcı." }, { status: 400 });
  }
  const uniqueMemberIds = [...new Set(memberIds)];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const rateLimitResponse = await enforceRateLimit(supabase, {
    endpoint: "notify",
    limit: 5,
    windowSeconds: 600,
  });
  if (rateLimitResponse) return rateLimitResponse;

  // Only the project's PM may trigger these notifications.
  const { data: isPm, error: pmErr } = await supabase.rpc("is_project_pm", { p_project_id: projectId });
  if (pmErr || !isPm) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  // SendGrid — API-based, works reliably from serverless (unlike Gmail SMTP, which Google
  // blocks from datacenter IPs). Needs a verified single sender (SENDGRID_FROM) + API key.
  const sgKey = (process.env.SENDGRID_API_KEY || "").trim();
  const sgFrom = (process.env.SENDGRID_FROM || process.env.GMAIL_USER || "").trim();
  if (!sgKey || !sgFrom) {
    // Not configured yet — succeed quietly so project creation isn't affected.
    return NextResponse.json({ sent: 0, skipped: "email-not-configured" });
  }

  // Fetch project name, the PM's display name, and the target members (RLS-scoped to caller).
  const [{ data: project }, { data: pmRow }, { data: members }] = await Promise.all([
    supabase.from("projects").select("name").eq("id", projectId).maybeSingle(),
    supabase.from("project_members").select("name, surname").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
    supabase.from("project_members").select("name, surname, email, role").eq("project_id", projectId).in("id", uniqueMemberIds),
  ]);

  if (!project || !members?.length) return NextResponse.json({ sent: 0 });

  const pmName = pmRow ? `${pmRow.name} ${pmRow.surname}`.trim() : (user.email ?? "Proje Yöneticisi");
  const origin = getTrustedAppOrigin();

  let sent = 0;
  for (const m of members) {
    // Don't email the PM themselves.
    if (user.email && m.email.toLowerCase() === user.email.toLowerCase()) continue;
    const fullName = `${m.name} ${m.surname}`.trim();
    const roleTr = ROLE_TR[m.role] ?? m.role;
    const subject = `"${project.name}" projesine eklendiniz`;
    const text =
      `Merhaba ${fullName},\n\n` +
      `${pmName}, "${project.name}" projesini oluşturdu ve sizi ${roleTr} olarak ekledi.\n\n` +
      `Uygulamaya giriş yaparak projeyi görüntüleyebilirsiniz:\n${origin}/app\n\n` +
      `— Saueressig OPEX Proje Yönetimi`;
    const html =
      `<p>Merhaba <strong>${escapeHtml(fullName)}</strong>,</p>` +
      `<p><strong>${escapeHtml(pmName)}</strong>, <strong>"${escapeHtml(project.name)}"</strong> projesini oluşturdu ve sizi <strong>${escapeHtml(roleTr)}</strong> olarak ekledi.</p>` +
      `<p><a href="${origin}/app">Uygulamaya giriş yaparak projeyi görüntüleyin</a></p>` +
      `<p style="color:#6b7280;font-size:13px;">— Saueressig OPEX Proje Yönetimi</p>`;
    try {
      const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${sgKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: m.email }] }],
          from: { email: sgFrom, name: "Saueressig OPEX" },
          subject,
          content: [
            { type: "text/plain", value: text },
            { type: "text/html", value: html },
          ],
        }),
      });
      if (resp.ok) sent++;
      else console.error("[notify] SendGrid failed for", m.email, resp.status, await resp.text().catch(() => ""));
    } catch (e) {
      console.error("[notify] send failed for", m.email, e);
    }
  }

  return NextResponse.json({ sent });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function getTrustedAppOrigin(): string {
  const configured = (process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (!configured) return "https://lean-tool-pi.vercel.app";

  const url = new URL(configured);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("APP_ORIGIN must use HTTPS (HTTP is allowed only for localhost)");
  }
  return url.origin;
}
