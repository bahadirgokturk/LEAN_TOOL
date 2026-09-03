// ============================================================
// OTOMATİK ÜRETİLDİ — elle düzenlemeyin.
// Kaynak: src/5s-client/  ·  Üretmek için: npm run build:5s
// ============================================================
"use strict";
(() => {
  // src/lib/s5/analytics.ts
  var pillarIds = ["S1", "S2", "S3", "S4", "S5"];
  function mean(values) {
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) / 100 : null;
  }
  function pillarValues(audit) {
    const source = audit.pillars_json;
    return pillarIds.map((id, index) => {
      var _a;
      const entry = Array.isArray(source) ? source[index] : source && typeof source === "object" ? source[id] : null;
      if (!entry || typeof entry !== "object") return null;
      const raw = (_a = entry.pct) != null ? _a : entry.score;
      if (raw === void 0 || raw === null || raw === "") return null;
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    });
  }
  function aggregatePillars(audits) {
    const rows = audits.map(pillarValues);
    return pillarIds.map((_, index) => mean(rows.map((row) => row[index]).filter((value) => value !== null)));
  }
  function buildAnalytics(audits, areas, calculateLevel) {
    const byId = new Map(areas.map((area) => [area.id, area]));
    const groupedAudits = /* @__PURE__ */ new Map();
    for (const audit of audits) {
      const id = audit.area_id || `historical:${audit.area_name || audit.id}`;
      if (!byId.has(id)) byId.set(id, { id, name: audit.area_name || "Arşiv bölgesi" });
      const group = groupedAudits.get(id) || [];
      group.push(audit);
      groupedAudits.set(id, group);
    }
    const rows = Array.from(byId.values()).map((area) => {
      const records = groupedAudits.get(area.id) || [];
      return { ...area, count: records.length, score: mean(records.map((record) => Number(record.total_score || 0))), level: mean(records.map(calculateLevel)), pillars: aggregatePillars(records) };
    });
    const groups = /* @__PURE__ */ new Map();
    for (const area of rows) {
      const factory = area.fabrika || "Diğer";
      const department = area.alt_dept || area.dept || "Genel";
      const key = JSON.stringify([factory, department]);
      if (!groups.has(key)) groups.set(key, { name: `${factory} · ${department}`, areas: [] });
      groups.get(key).areas.push(area);
    }
    return { count: audits.length, level: mean(audits.map(calculateLevel)), pillars: aggregatePillars(audits), areas: rows, groups: Array.from(groups.values()) };
  }

  // src/5s-client/reports.ts
  var charts = /* @__PURE__ */ new Map();
  var escapeHtml = (value) => String(value != null ? value : "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  var levelText = (level) => level === null ? "—" : formatSLevel(level);
  var pointsText = (value) => value === null ? "—" : String(Math.round(value * 10) / 10);
  function getModel(audits = getFilteredAudits()) {
    const areas = S.areas.filter((area) => (!S.fabrikaFilter || S.fabrikaFilter === "all" || area.fabrika === S.fabrikaFilter) && (!S.adminFilter || S.adminFilter === "all" || area.dept === S.adminFilter));
    return buildAnalytics(audits, areas, calculateSLevel);
  }
  function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  }
  function renderMetrics(model, report) {
    const best = model.areas.filter((area) => area.score !== null).sort((left, right) => right.score - left.score)[0];
    const planned = S.atamalar || [];
    const completion = planned.length ? Math.round(planned.filter((plan) => plan.status === "Tamamlandı").length / planned.length * 100) : 0;
    const open = S.actions.filter((action) => action.status === "Açık").length;
    setText(report ? "r-level" : "m-total", model.count ? levelText(model.level) : "—");
    setText(report ? "r-completion" : "m-avg", String(completion));
    setText(report ? "r-best" : "m-best", (best == null ? void 0 : best.name) || "—");
    setText(report ? "r-best-s" : "m-best-score", best ? `${Math.round(best.score)} puan` : "");
    setText(report ? "r-actions" : "m-actions", String(open));
    setText(report ? "r-count" : "m-total-sub", `${model.count} denetim — seçili dönem`);
  }
  function table(headers, rows) {
    return `<div class="tbl-wrap"><table><thead><tr>${headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">Seçili dönemde veri yok</td></tr>`}</tbody></table></div>`;
  }
  function areaTable(areas) {
    return table(["Bölge", "Toplam (S)", ...pillarIds], areas.map((area) => [area.name, levelText(area.level), ...area.pillars.map(pointsText)]));
  }
  function draw(id, type, labels, values) {
    var _a;
    (_a = charts.get(id)) == null ? void 0 : _a.destroy();
    charts.delete(id);
    const canvas = document.getElementById(id);
    if (!(canvas instanceof HTMLCanvasElement) || !window.Chart) return;
    const isRadar = type === "radar";
    charts.set(id, new window.Chart(canvas, {
      type,
      data: { labels, datasets: [{ label: isRadar ? "Pillar puanı" : "5S seviyesi", data: values, backgroundColor: isRadar ? "rgba(13,34,64,.25)" : values.map((value) => value === null ? "transparent" : value >= 4 ? "rgba(46,125,79,.7)" : value >= 3 ? "rgba(13,34,64,.7)" : value >= 2 ? "rgba(212,130,10,.7)" : "rgba(230,51,18,.7)"), borderColor: "#0d2240", borderWidth: isRadar ? 2 : 0, pointBackgroundColor: "#E63312" }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false }, datalabels: { display: false } },
        scales: isRadar ? { r: { min: 0, max: 100, ticks: { stepSize: 25 } } } : {
          y: { min: 0, max: 5, ticks: { callback: (value) => `${value}S` } },
          x: { ticks: { autoSkip: false, maxRotation: 60, minRotation: labels.length > 8 ? 45 : 0 } }
        }
      }
    }));
  }
  function overallLabels(areas) {
    return areas.map((area) => `${area.name} · ${area.alt_dept || area.dept || "Genel"}${area.fabrika ? ` · ${area.fabrika}` : ""}`);
  }
  function renderDashboardCharts(audits) {
    const model = getModel(audits);
    renderMetrics(model, false);
    draw("radarChart", "radar", PILLARS.map((pillar) => pillar.id), model.pillars);
    draw("bolumBarChart", "bar", overallLabels(model.areas), model.areas.map((area) => area.level));
  }
  function renderReports() {
    const container = document.getElementById("report-charts");
    if (!container) return;
    for (const [id, chart] of charts) if (id.startsWith("report-")) {
      chart.destroy();
      charts.delete(id);
    }
    const model = getModel();
    renderMetrics(model, true);
    const periods = { year: "Bu yıl", lastmonth: "Geçen ay", month: "Bu ay" };
    setText("report-scope", `Dashboard ile aynı filtreler: ${S.fabrikaFilter === "all" ? "Tüm fabrikalar" : S.fabrikaFilter || "Tüm fabrikalar"} / ${S.adminFilter === "all" ? "Tüm departmanlar" : S.adminFilter || "Tüm departmanlar"} / ${periods[String(S.timeFilter)] || "Bu yıl"}`);
    const radarTable = table(["Pillar", "Ortalama puan"], PILLARS.map((pillar, index) => [pillar.name, pointsText(model.pillars[index])]));
    container.innerHTML = `<section class="card report-chart-row"><div><h3>5S Radar Analizi</h3><div class="report-canvas"><canvas id="report-radar"></canvas></div></div>${radarTable}</section>
    <section class="card"><h3>Tüm Bölgeler — 5S Seviyesi</h3><div class="report-canvas"><canvas id="report-overall"></canvas></div></section>
    ${model.groups.map((group, index) => `<section class="card report-chart-row"><div><h3>${escapeHtml(group.name)}</h3><div class="report-canvas"><canvas id="report-group-${index}"></canvas></div></div>${areaTable(group.areas)}</section>`).join("")}`;
    draw("report-radar", "radar", PILLARS.map((pillar) => pillar.id), model.pillars);
    draw("report-overall", "bar", overallLabels(model.areas), model.areas.map((area) => area.level));
    model.groups.forEach((group, index) => draw(`report-group-${index}`, "bar", group.areas.map((area) => area.name), group.areas.map((area) => area.level)));
  }
  function renderComparison() {
    const element = document.getElementById("karsilastirma-table");
    if (element) element.innerHTML = areaTable(buildAnalytics(S.audits, S.areas, calculateSLevel).areas.filter((area) => area.count));
  }
  function exportCSV() {
    var _a, _b;
    const rows = [["Tarih", "Alan", "Fabrika", "Denetçi", "Vardiya", "Toplam Puan", ...PILLARS.map((pillar) => pillar.name)]];
    for (const audit of S.audits) {
      const area = S.areas.find((candidate) => candidate.id === audit.area_id);
      const pillars = buildAnalytics([audit], [], calculateSLevel).pillars;
      rows.push([((_a = audit.date) == null ? void 0 : _a.slice(0, 10)) || "", (area == null ? void 0 : area.name) || audit.area_name || audit.area_id || "", (area == null ? void 0 : area.fabrika) || "", audit.auditor_name || "", audit.shift || "", (_b = audit.total_score) != null ? _b : 0, ...pillars.map((value) => value != null ? value : "")]);
    }
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `5S-Rapor-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  window.renderReports = renderReports;
  window.exportCSV = exportCSV;
  window.s5Analytics = { renderDashboardCharts, renderComparison };
})();
