/* Ndakup — helpers d'affichage (formats, badges, graphiques SVG) */
(function () {
  const AV = window.AV;

  AV.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  AV.n = (v, d = 1) => (v == null || !isFinite(v) ? "—" : Number(v).toLocaleString("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: 0 }));
  AV.pct = (v, d = 1) => (v == null || !isFinite(v) ? "—" : AV.n(v, d) + " %");
  const e = AV.esc;

  AV.badge = (text, tone = "mute") => `<span class="badge ${tone}">${e(text)}</span>`;
  AV.statutTone = (s) => ({ Nouvelle: "bad", "En analyse": "warn", Confirmée: "bad", Infirmée: "ok", Close: "mute", Opérationnelle: "ok", "En préparation": "info", Suspendue: "warn", "En cours": "ok", Clôturée: "mute", Cédé: "info", "Réception validée": "ok", Clos: "bad" }[s] || "mute");
  AV.statutBadge = (s) => AV.badge(s, AV.statutTone(s));
  AV.syncBadge = (x) => (x.sync === false ? AV.badge("En attente d'envoi", "warn") : AV.badge("Synchronisé", "ok"));

  AV.kpi = (label, value, sub = "", tone = "") => `<div class="kpi ${tone}"><div class="kpi-l">${e(label)}</div><div class="kpi-v">${value}</div>${sub ? `<div class="kpi-s">${sub}</div>` : ""}</div>`;
  AV.mortTone = (v) => (v == null ? "" : v > AV.state.params.seuilMortCarte ? "bad" : v > 3 ? "warn" : "good");

  AV.table = (head, rows, opts = {}) =>
    `<div class="tablewrap"><table class="tbl ${opts.cls || ""}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${
      rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${head.length}" class="empty">${opts.empty || "Aucune donnée."}</td></tr>`
    }</tbody></table></div>`;

  // ----- graphique en lignes / barres (SVG) -----
  AV.chart = function ({ series, bars, hline, xmax, ymax, ytitle, w = 560, h = 230 }) {
    const m = { l: 44, r: 12, t: 14, b: 30 };
    const iw = w - m.l - m.r, ih = h - m.t - m.b;
    const all = [].concat(...series.map((s) => s.data), bars ? bars.data : []);
    xmax = xmax || Math.max(1, ...all.map((p) => p.x));
    ymax = ymax || Math.max(1e-6, ...all.map((p) => p.y), hline ? hline.y * 1.15 : 0) * 1.1;
    const X = (x) => m.l + (x / xmax) * iw, Y = (y) => m.t + ih - (y / ymax) * ih;
    let g = "";
    for (let i = 0; i <= 4; i++) {
      const y = (ymax / 4) * i;
      g += `<line x1="${m.l}" x2="${w - m.r}" y1="${Y(y)}" y2="${Y(y)}" class="grid"/><text x="${m.l - 6}" y="${Y(y) + 3}" class="ax" text-anchor="end">${AV.n(y, ymax < 10 ? 1 : 0)}</text>`;
    }
    const step = xmax > 30 ? 10 : xmax > 14 ? 5 : 1;
    for (let x = 0; x <= xmax; x += step) g += `<text x="${X(x)}" y="${h - 10}" class="ax" text-anchor="middle">${x}</text>`;
    g += `<text x="${m.l + iw / 2}" y="${h - 0}" class="ax" text-anchor="middle" dy="-0">jour</text>`;
    if (bars) {
      const bw = Math.max(2, (iw / xmax) * 0.62);
      bars.data.forEach((p) => { g += `<rect x="${X(p.x) - bw / 2}" y="${Y(p.y)}" width="${bw}" height="${Math.max(0, m.t + ih - Y(p.y))}" rx="1.5" fill="${p.bad ? "var(--red)" : bars.color || "var(--green)"}"><title>J${p.x} : ${AV.n(p.y, 2)}</title></rect>`; });
    }
    if (hline) g += `<line x1="${m.l}" x2="${w - m.r}" y1="${Y(hline.y)}" y2="${Y(hline.y)}" stroke="var(--red)" stroke-dasharray="5 4"/><text x="${w - m.r}" y="${Y(hline.y) - 4}" class="ax" text-anchor="end" fill="var(--red)">${e(hline.label)}</text>`;
    series.forEach((s) => {
      if (!s.data.length) return;
      const d = s.data.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join("");
      g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.dash ? 1.6 : 2.4}" ${s.dash ? 'stroke-dasharray="5 4"' : ""} stroke-linejoin="round"/>`;
      if (!s.dash) s.data.forEach((p) => { g += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3.2" fill="${s.color}"><title>J${p.x} : ${AV.n(p.y, 1)}</title></circle>`; });
    });
    const legend = series.filter((s) => s.name).map((s) => `<span class="lg"><i style="background:${s.color}"></i>${e(s.name)}</span>`).join("");
    return `<div class="chart"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${e(ytitle || "graphique")}">${g}</svg>${legend ? `<div class="legend">${legend}</div>` : ""}</div>`;
  };

  // ----- carte schématique (coordonnées GPS) -----
  AV.map = function (points, mode) {
    const W = 420, H = 440, lon0 = 8.2, lon1 = 14.8, lat0 = 2.6, lat1 = -4.2;
    const X = (lon) => ((lon - lon0) / (lon1 - lon0)) * W, Y = (lat) => ((lat0 - lat) / (lat0 - lat1)) * H;
    let g = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="var(--map)" rx="12"/>';
    for (let lon = 9; lon <= 14; lon++) g += `<line x1="${X(lon)}" x2="${X(lon)}" y1="0" y2="${H}" class="grid"/><text x="${X(lon) + 2}" y="${H - 5}" class="ax">${lon}°E</text>`;
    for (let lat = -4; lat <= 2; lat++) g += `<line y1="${Y(lat)}" y2="${Y(lat)}" x1="0" x2="${W}" class="${lat === 0 ? "grid eq" : "grid"}"/><text x="3" y="${Y(lat) - 2}" class="ax">${lat}°</text>`;
    g += `<text x="14" y="${H / 2 - 40}" class="ocean">Océan</text><text x="14" y="${H / 2 - 24}" class="ocean">Atlantique</text>`;
    AV.PROVINCES.forEach((p) => { g += `<text x="${X(p.lon)}" y="${Y(p.lat) - 20}" text-anchor="middle" class="plab">${AV.esc(p.chef)}</text>`; });
    points.forEach((p) => {
      const col = p.color;
      const dot = `<circle cx="${X(p.lon).toFixed(1)}" cy="${Y(p.lat).toFixed(1)}" r="${p.r || 5}" fill="${col}" stroke="#fff" stroke-width="1.2"><title>${AV.esc(p.label)}</title></circle>`;
      g += p.noLink ? dot : `<a href="#/f/${p.id}">${dot}</a>`;
    });
    return `<svg class="map" viewBox="0 0 ${W} ${H}" role="img" aria-label="Carte schématique des fermes">${g}</svg>`;
  };

  // ----- modale & toasts -----
  AV.toast = (msg, tone = "") => {
    const box = document.getElementById("toasts");
    if (!box) return;
    const t = document.createElement("div");
    t.className = "toast " + tone;
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.classList.add("out"), 4200);
    setTimeout(() => t.remove(), 4700);
  };
  AV.modal = (html) => {
    const m = document.getElementById("modal");
    m.innerHTML = `<div class="modal-bg" data-act="closeModal"></div><div class="modal-box" role="dialog" aria-modal="true"><button class="modal-x" data-act="closeModal" aria-label="Fermer">×</button>${html}</div>`;
    m.hidden = false;
  };
  AV.closeModal = () => { const m = document.getElementById("modal"); m.hidden = true; m.innerHTML = ""; };

  AV.downloadCSV = (name, rows) => {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
})();
