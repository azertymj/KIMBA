/* Ndakup — routeur, profils, événements et formulaires */
(function () {
  const AV = window.AV;
  const e = AV.esc;
  const S = () => AV.state;
  const $ = (id) => document.getElementById(id);

  // ---------- routage ----------
  function parseHash() {
    const raw = (location.hash || "").replace(/^#\/?/, "");
    const [path, query] = raw.split("?");
    const parts = path.split("/").filter(Boolean);
    const payload = query && query.startsWith("d=") ? query.slice(2) : "";
    let arg = parts.slice(1).join("/");
    try { arg = decodeURIComponent(arg); } catch (err) {}
    return { route: parts[0] || "", arg, payload };
  }
  const go = (r) => { const h = "#/" + r; if (location.hash === h) AV.render(); else location.hash = h; };
  AV.go = go;

  // ---------- rendu ----------
  AV.render = function () {
    const { route, arg, payload } = parseHash();
    const ui = S().ui, role = ui.role;
    const isPub = route === "scan" || route === "p";
    document.body.classList.toggle("public", isPub);
    document.body.dataset.role = isPub ? "public" : role || "none";

    // en-tête
    const pend = AV.pending();
    $("hdr").innerHTML = `<div class="tricolor"></div><div class="hdr-in">
      <a class="brand" href="#/${role && !isPub ? AV.NAV[role][0][0] : ""}"><span class="brand-dot"></span>Ndakup<small>démo POUFA</small></a>
      <div class="hdr-tools">
        ${isPub ? `<a class="btn ghost sm" href="#/">Démonstration</a>` : `
        <label class="roleselect"><span>Profil</span><select data-change="role"><option value="">— choisir —</option>${Object.keys(AV.ROLES).map((k) => `<option value="${k}" ${k === role ? "selected" : ""}>${AV.ROLES[k].nom}</option>`).join("")}</select></label>
        <button class="net ${ui.offline ? "off" : "on"}" data-act="toggleOffline" title="Simuler la perte de réseau" aria-pressed="${ui.offline}"><i></i>${ui.offline ? "Hors connexion" : "En ligne"}</button>
        ${pend ? `<button class="btn warn sm" data-act="syncNow">${pend} à synchroniser</button>` : ""}`}
      </div></div>`;

    // navigation
    const nav = !isPub && role ? AV.NAV[role] : [];
    $("nav").innerHTML = nav.map(([k, t]) => `<a href="#/${k}" class="${route === k || (route === "f" && k === "fermes") ? "active" : ""}">${t}</a>`).join("");
    $("nav").hidden = !nav.length;

    // contenu
    let html;
    try {
      if (isPub) {
        if (route === "p") {
          const key = location.hash;
          if (AV._lastScan !== key) { AV._lastScan = key; const r = AV.resolveLot(arg, payload); AV.logScan(arg, r.status); }
          html = AV.views.p(arg, payload);
        } else html = AV.views.scan();
      } else if (!role || route === "home") {
        html = AV.views.home();
      } else {
        const allowed = AV.NAV[role].map((x) => x[0]).concat(["f"]);
        if (!route) { go(AV.NAV[role][0][0]); return; }
        if (!allowed.includes(route) || !AV.views[route]) html = `<section class="card"><h2>Accès non autorisé</h2><p>Votre profil (${e(AV.ROLES[role].nom)}) n'a pas accès à cet écran : chaque utilisateur ne voit que ce qui le concerne.</p></section>`;
        else html = AV.views[route](arg);
      }
    } catch (err) {
      console.error(err);
      html = `<section class="card"><h2>Erreur d'affichage</h2><p>${e(err.message)}</p></section>`;
    }
    $("main").innerHTML = html;
    window.scrollTo(0, 0);
  };

  // ---------- profil, hors connexion ----------
  function setRole(role) {
    S().ui.role = role || null;
    AV.save();
    if (!role) { go(""); return; }
    go(AV.NAV[role][0][0]);
  }

  // ---------- actions (clics) ----------
  const H = {};
  H.setRole = (el) => setRole(el.dataset.role);
  H.toggleOffline = () => {
    const ui = S().ui;
    ui.offline = !ui.offline;
    if (!ui.offline) { const k = AV.sync(); AV.toast(k ? `Réseau rétabli : ${k} saisie(s) synchronisée(s).` : "Réseau rétabli.", "ok"); }
    else AV.toast("Mode hors connexion : les saisies sont gardées sur l'appareil.", "warn");
    AV.render();
  };
  H.syncNow = () => {
    if (S().ui.offline) { AV.toast("Pas de réseau : la synchronisation aura lieu au retour de la connexion.", "warn"); return; }
    AV.toast(`${AV.sync()} saisie(s) synchronisée(s).`, "ok"); AV.render();
  };
  H.consent = (el) => { AV.act.consentement(el.dataset.id, el.dataset.val === "1"); AV.toast("Consentement mis à jour et journalisé.", "ok"); AV.render(); };
  H.cloturer = () => {
    if (!confirm("Clôturer la bande ? Elle passera en lecture seule et son bilan sera produit.")) return;
    const r = AV.act.cloturer(S().ui.fermeId);
    if (r.ok) { AV.toast("Bande clôturée : bilan produit.", "ok"); go("ferme"); } else AV.toast(r.msg, "bad");
  };
  H.back = () => history.back();
  H.print = () => {
    document.body.classList.toggle("printing-qr", !$("modal").hidden);
    window.print();
    document.body.classList.remove("printing-qr");
  };
  H.closeModal = () => AV.closeModal();
  H.showQR = (el) => {
    const l = AV.lotById(el.dataset.id);
    if (!l) return;
    const url = AV.lotURL(l);
    const op = AV.operateur(l.destId);
    AV.modal(`<div class="qrbox"><h2>Lot ${e(l.id)}</h2><div class="qr">${AV.qrSVG(url, 5)}</div>
      <p class="qrmeta">${e(AV.farm(l.fermeId).nom)} · ${AV.fmtDate(l.date)} · ${AV.n(l.n, 0)} animaux · → ${e(op ? op.nom : "")}</p>
      <p class="note">Le QR renvoie vers la fiche publique du lot, sans donnée personnelle. Il se lit avec un simple téléphone.</p>
      <div class="actions"><a class="btn primary" href="${e(url)}" target="_blank" rel="noopener">Ouvrir la page publique</a><button class="btn ghost" data-act="print">Imprimer l'étiquette</button></div></div>`);
  };
  H.alertStatut = (el) => {
    const note = ($("note-" + el.dataset.id) || {}).value || "";
    const r = AV.act.alerteStatut(el.dataset.id, el.dataset.s, note);
    if (r.ok) { AV.toast("Alerte mise à jour.", "ok"); AV.render(); } else AV.toast(r.msg, "bad");
  };
  H.alertPublish = (el) => {
    if (!confirm("Publier cette alerte ? Elle sera visible dans les indicateurs consolidés.")) return;
    const r = AV.act.alertePublier(el.dataset.id);
    if (r.ok) { AV.toast("Alerte publiée par l'autorité vétérinaire.", "ok"); AV.render(); } else AV.toast(r.msg, "bad");
  };
  H.lotClose = (el) => { AV.act.lotClos(el.dataset.id, true); AV.toast("Lot clos : son QR code sera rejeté à la lecture.", "warn"); AV.render(); };
  H.lotOpen = (el) => { AV.act.lotClos(el.dataset.id, false); AV.toast("Lot rouvert.", "ok"); AV.render(); };
  H.reception = (el) => {
    const l = AV.lotById(el.dataset.id);
    AV.modal(`<h2>Réception du lot ${e(l.id)}</h2><p class="sub">Annoncé par la ferme : ${AV.n(l.n, 0)} têtes · ${AV.n(l.kg, 0)} kg</p>
      <form data-form="reception" class="stack"><input type="hidden" name="id" value="${e(l.id)}">
      <label class="fld"><span>Nombre reçu</span><input name="n" type="number" min="0" required value="${l.recu ? l.recu.n : l.n}"></label>
      <label class="fld"><span>Poids reçu (kg)</span><input name="kg" type="number" min="1" step="0.5" required value="${l.recu ? l.recu.kg : l.kg}"></label>
      <label class="fld"><span>Constats (facultatif)</span><textarea name="constat" rows="2"></textarea></label>
      <button class="btn primary" type="submit">Valider la réception</button></form>`);
  };
  H.reset = () => { if (!confirm("Réinitialiser toutes les données de démonstration ?")) return; AV.reset(); S().ui.role = "dge"; AV.toast("Démonstration réinitialisée.", "ok"); go("param"); };
  H.exportJournal = () => {
    AV.downloadCSV("journal-Ndakup.csv", [["Date", "Profil", "Opération", "Détail"]].concat(S().journal.slice().reverse().map((j) => [AV.fmtTime(j.t), (AV.ROLES[j.role] || { nom: j.role }).nom, j.action, j.detail])));
    AV.log("Export du journal", "Journal exporté en CSV"); AV.save();
  };
  H.listDel = (el) => { const l = S().params.listes[el.dataset.list]; const v = l.splice(Number(el.dataset.i), 1); AV.log("Paramétrage", `Liste « ${el.dataset.list} » : « ${v[0]} » retiré`); AV.save(); AV.render(); };
  H.vacDel = (el) => { const v = S().params.calendrierVaccinal.splice(Number(el.dataset.i), 1); AV.log("Calendrier vaccinal", `${v[0].vaccin} retiré`); AV.save(); AV.render(); };
  H.formulesDefaut = () => { S().params.formules = AV.defaultParams().formules; AV.log("Paramétrage", "Formules rétablies aux valeurs proposées"); AV.save(); AV.toast("Formules rétablies.", "ok"); AV.render(); };

  let camStream = null;
  H.camera = async () => {
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices) { AV.toast("Lecture par caméra non disponible sur ce navigateur : saisissez le code du lot.", "warn"); return; }
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const v = $("cam"); $("camwrap").hidden = false; v.srcObject = camStream; await v.play();
      const det = new BarcodeDetector({ formats: ["qr_code"] });
      const loop = async () => {
        if (!camStream) return;
        try {
          const codes = await det.detect(v);
          if (codes.length) {
            const raw = codes[0].rawValue, i = raw.indexOf("#/p/");
            camStream.getTracks().forEach((t) => t.stop()); camStream = null;
            if (i >= 0) { location.hash = raw.slice(i + 1); return; }
            AV.toast("Ce QR code n'est pas un code de lot Ndakup.", "bad"); return;
          }
        } catch (err) {}
        requestAnimationFrame(loop);
      };
      loop();
    } catch (err) { AV.toast("Accès à la caméra refusé.", "bad"); }
  };

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-act]");
    if (!el) return;
    const fn = H[el.dataset.act];
    if (fn) { ev.preventDefault(); fn(el, ev); }
  });

  // ---------- changements (filtres, profil) ----------
  const C = {
    role: (el) => setRole(el.value),
    filter: (el) => { S().ui.filters[el.dataset.key] = el.value; AV.save(); AV.render(); },
    filterAlerte: (el) => { S().ui.filters.alerte = el.value; AV.render(); },
    mapMode: (el) => { S().ui.mapMode = el.value; AV.render(); },
    traceQ: (el) => { S().ui.traceQ = el.value; AV.render(); },
    journalQ: (el) => { S().ui.journalQ = el.value; AV.render(); },
    op: (el) => { S().ui.opId = el.value; AV.save(); AV.render(); },
  };
  document.addEventListener("change", (ev) => {
    const el = ev.target.closest("[data-change]");
    if (el && C[el.dataset.change]) C[el.dataset.change](el);
  });

  // ---------- formulaires ----------
  const val = (fd, k) => fd.get(k);
  const fid = () => S().ui.fermeId;
  const done = (r, okMsg, after) => {
    if (!r.ok) { AV.toast(r.msg, "bad"); return false; }
    if (okMsg) AV.toast(okMsg, S().ui.offline ? "warn" : "ok");
    if (after) after(r);
    return true;
  };
  const onlyRole = (role) => { if (S().ui.role !== role) { AV.toast("Action réservée au profil « " + AV.ROLES[role].nom + " ».", "bad"); return false; } return true; };
  const FM = {};
  FM.saisie = (fd) => {
    const r = AV.act.saisieJour(fid(), { date: val(fd, "date"), morts: val(fd, "morts"), aliment: val(fd, "aliment") });
    if (!r.ok) { AV.toast(r.msg, "bad"); return; }
    AV.toast(S().ui.offline ? "Saisie gardée sur l'appareil (hors connexion)." : "Journée enregistrée.", S().ui.offline ? "warn" : "ok");
    if (r.alerte) AV.toast(S().ui.offline ? "Alerte créée : elle partira aux services vétérinaires au retour du réseau." : "Mortalité anormale : alerte transmise aux services vétérinaires.", "bad");
    if (r.stockNeg) AV.toast("Stock d'aliment négatif : vérifiez les réceptions.", "bad");
    go("ferme");
  };
  FM.pesee = (fd) => done(AV.act.pesee(fid(), { date: val(fd, "date"), n: val(fd, "n"), poids: val(fd, "poids") }), "Pesée enregistrée.", () => go("ferme"));
  FM.sortie = (fd) => done(AV.act.sortie(fid(), { date: val(fd, "date"), n: val(fd, "n"), kg: val(fd, "kg"), motif: val(fd, "motif"), destId: val(fd, "destId") }), "Cession enregistrée : lot créé avec son QR code.", () => go("lots"));
  FM.ouvrirBande = (fd) => done(AV.act.ouvrirBande(fid(), { date: val(fd, "date"), n: val(fd, "n") }), "Bande ouverte.", () => AV.render());
  FM.intrant = (fd) => done(AV.act.intrantRecu(fid(), { date: val(fd, "date"), type: val(fd, "type"), produit: val(fd, "produit"), qte: val(fd, "qte"), unite: val(fd, "unite"), subv: fd.get("subv") }), "Réception enregistrée.", () => AV.render());
  FM.stock = (fd) => done(AV.act.stockCompte(fid(), { qte: val(fd, "qte") }), "Stock compté enregistré.", () => AV.render());
  FM.declaration = (fd) => done(AV.act.declaration(fid(), { date: val(fd, "date"), type: val(fd, "type"), signes: fd.getAll("signe"), n: val(fd, "n"), note: val(fd, "note") }),
    S().ui.offline ? "Déclaration gardée sur l'appareil : elle partira au retour du réseau." : "Déclaration transmise aux services vétérinaires.", () => AV.render());
  FM.vaccin = (fd) => done(AV.act.vaccin(fid(), { date: val(fd, "date"), vaccin: val(fd, "vaccin"), n: val(fd, "n") }), "Vaccination enregistrée.", () => AV.render());
  FM.traitement = (fd) => done(AV.act.traitement(fid(), { debut: val(fd, "debut"), fin: val(fd, "fin"), produit: val(fd, "produit"), motif: val(fd, "motif"), n: val(fd, "n") }), "Traitement enregistré.", () => AV.render());
  FM.operateur = (fd) => { if (!onlyRole("dge")) return; done(AV.act.operateur({ nom: (val(fd, "nom") || "").trim(), type: val(fd, "type"), loc: val(fd, "loc"), convention: fd.get("convention") }), "Opérateur ajouté au registre.", () => AV.render()); };
  FM.reception = (fd) => { if (!onlyRole("abattoir")) return; const r = AV.act.receptionAbattoir(val(fd, "id"), { n: val(fd, "n"), kg: val(fd, "kg"), constat: val(fd, "constat") }); if (!r.ok) { AV.toast(r.msg, "bad"); return; } AV.closeModal(); AV.toast(r.flag ? `Réception validée, écart de ${AV.n(r.ecart, 1)} % signalé.` : "Réception validée.", r.flag ? "warn" : "ok"); AV.render(); };
  FM.scan = (fd) => { const id = (val(fd, "id") || "").trim(); if (!id) return; location.hash = "#/p/" + encodeURIComponent(id); };
  FM.paramGen = (fd) => {
    if (!onlyRole("dge")) return;
    const p = S().params, keys = ["dureeBande", "peseeFreq", "echantillon", "seuilEcartIntrants", "seuilEcartAbattoir", "seuilMortCarte"];
    for (const k of keys) { const v = Number(val(fd, k)); if (!(v > 0)) { AV.toast("Valeur invalide pour « " + k + " ».", "bad"); return; } }
    keys.forEach((k) => (p[k] = Number(val(fd, k))));
    AV.log("Paramétrage", "Paramètres généraux modifiés"); AV.save(); AV.toast("Paramètres enregistrés.", "ok"); AV.render();
  };
  FM.formules = (fd) => {
    if (!onlyRole("dge")) return;
    const f = { mortalite: val(fd, "mortalite").trim(), viabilite: val(fd, "viabilite").trim(), gmq: val(fd, "gmq").trim(), ic: val(fd, "ic").trim() };
    const errs = AV.testFormulas(f);
    const keys = Object.keys(errs);
    if (keys.length) { AV.toast(`Formule « ${keys[0]} » refusée : ${errs[keys[0]]}`, "bad"); return; }
    S().params.formules = f;
    AV.log("Paramétrage", "Formules des indicateurs modifiées : " + Object.keys(f).map((k) => `${k} = ${f[k]}`).join(" ; "));
    AV.save(); AV.toast("Formules enregistrées : tous les indicateurs sont recalculés.", "ok"); AV.render();
  };
  FM.poids = (fd) => {
    if (!onlyRole("dge")) return;
    const w = {}; ["mortalite", "ic", "gmq", "regularite"].forEach((k) => (w[k] = Number(val(fd, k))));
    if (Object.values(w).some((v) => !(v >= 0)) || Object.values(w).reduce((s, v) => s + v, 0) <= 0) { AV.toast("Pondérations invalides.", "bad"); return; }
    S().params.classement = w; AV.log("Paramétrage", "Pondérations du classement modifiées"); AV.save(); AV.toast("Pondérations enregistrées.", "ok"); AV.render();
  };
  FM.listAdd = (fd, form) => {
    const key = form.dataset.list, v = (val(fd, "val") || "").trim();
    if (key === "signes" ? !onlyRole("vet") : !onlyRole("dge")) return;
    const l = S().params.listes[key];
    if (!v) return;
    if (l.some((x) => x.toLowerCase() === v.toLowerCase())) { AV.toast("Cet élément existe déjà.", "bad"); return; }
    l.push(v); AV.log("Paramétrage", `Liste « ${key} » : « ${v} » ajouté`); AV.save(); AV.render();
  };
  FM.seuil = (fd) => {
    if (!onlyRole("vet")) return;
    const v = Number(val(fd, "seuil"));
    if (!(v > 0 && v <= 20)) { AV.toast("Seuil invalide.", "bad"); return; }
    const old = S().params.seuilMortJour; S().params.seuilMortJour = v;
    AV.log("Seuil d'alerte", `Seuil de mortalité du jour : ${old} % → ${v} % (services vétérinaires)`); AV.save(); AV.toast("Seuil enregistré. Il s'applique à toutes les fermes.", "ok"); AV.render();
  };
  FM.vacAdd = (fd) => {
    if (!onlyRole("vet")) return;
    const j = Number(val(fd, "jour")), v = (val(fd, "vaccin") || "").trim();
    if (!(j >= 1) || !v) { AV.toast("Indiquez le jour et le vaccin.", "bad"); return; }
    const cal = S().params.calendrierVaccinal; cal.push({ jour: j, vaccin: v }); cal.sort((a, b) => a.jour - b.jour);
    AV.log("Calendrier vaccinal", `J${j} · ${v} ajouté`); AV.save(); AV.render();
  };

  document.addEventListener("submit", (ev) => {
    const form = ev.target.closest("form[data-form]");
    if (!form) return;
    ev.preventDefault();
    const fn = FM[form.dataset.form];
    if (fn) fn(new FormData(form), form);
  });

  // ---------- démarrage ----------
  function boot() {
    AV.init();
    window.addEventListener("hashchange", AV.render);
    window.addEventListener("online", () => { S().ui.offline = false; const k = AV.sync(); AV.toast(k ? `Réseau rétabli : ${k} saisie(s) synchronisée(s).` : "Réseau rétabli.", "ok"); AV.render(); });
    window.addEventListener("offline", () => { S().ui.offline = true; AV.toast("Réseau perdu : mode hors connexion.", "warn"); AV.render(); });
    AV.render();
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
