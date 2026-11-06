/* Ndakup — écrans (chaque vue retourne du HTML) */
(function () {
  const AV = window.AV;
  const e = AV.esc, n = (v, d) => AV.n(v, d), pc = (v, d) => AV.pct(v, d);
  const S = () => AV.state;
  const P = () => AV.state.params;
  AV.views = {};

  // ---------- champs de formulaire ----------
  const F = {
    input: (name, label, o = {}) => `<label class="fld"><span>${e(label)}</span><input name="${name}" type="${o.type || "text"}" ${o.attrs || ""} value="${e(o.value == null ? "" : o.value)}" ${o.req === false ? "" : "required"}></label>`,
    select: (name, label, opts, sel) => `<label class="fld"><span>${e(label)}</span><select name="${name}">${opts.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${e(v)}" ${String(v) === String(sel) ? "selected" : ""}>${e(t)}</option>`; }).join("")}</select></label>`,
    text: (name, label, o = {}) => `<label class="fld"><span>${e(label)}</span><textarea name="${name}" rows="2" placeholder="${e(o.ph || "")}"></textarea></label>`,
    btn: (label, cls = "primary") => `<button class="btn ${cls}" type="submit">${e(label)}</button>`,
  };
  const card = (title, body, o = {}) => `<section class="card ${o.cls || ""}">${title ? `<h2>${title}</h2>` : ""}${o.sub ? `<p class="sub">${o.sub}</p>` : ""}${body}</section>`;
  const page = (title, sub, body) => `<div class="pagehead"><h1>${title}</h1>${sub ? `<p class="lead">${sub}</p>` : ""}</div>${body}`;
  const denied = (msg) => card("Accès non autorisé", `<p>${e(msg || "Ce profil n'a pas accès à cette information : chaque utilisateur ne voit que ce qui le concerne.")}</p>`);
  const farmLink = (f) => `<a href="#/f/${f.id}">${e(f.nom)}</a>`;
  const offBanner = () => (S().ui.offline ? `<div class="banner warn">Mode hors connexion : vos saisies sont enregistrées sur l'appareil et seront envoyées au retour du réseau.</div>` : "");
  const avg = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);

  // ---------- accueil / choix du profil ----------
  AV.views.home = () => `
    <div class="hero">
      <div class="hero-tag">Programme POUFA · Démonstration</div>
      <h1>Suivi technico-économique et traçabilité de la filière avicole</h1>
      <p>Prototype interactif d'Ndakup : saisie sur mobile même sans réseau, alertes sanitaires contrôlées par les services vétérinaires, tableaux de bord et QR code d'origine pour chaque lot. Toutes les données sont fictives.</p>
    </div>
    <h2 class="sect">Choisissez un profil pour explorer</h2>
    <div class="rolegrid">${Object.keys(AV.ROLES).map((k) => `<button class="rolecard" data-act="setRole" data-role="${k}"><strong>${AV.ROLES[k].nom}</strong><span>${AV.ROLES[k].desc}</span></button>`).join("")}</div>
    <div class="card pub"><h2>Vue consommateur (sans compte)</h2><p>Scannez le QR code d'un lot pour connaître son origine, comme le ferait un client en magasin.</p><a class="btn primary" href="#/scan">Ouvrir la page publique</a></div>
    <div class="card"><h2>Parcours de test conseillé</h2><ol class="steps">
      <li>Profil <b>Éleveur</b> → <b>Saisie</b> : enregistrez une journée, puis passez en <b>mode hors connexion</b> (bouton en haut) et saisissez de nouveau.</li>
      <li>Saisissez beaucoup de morts (ex. 40) : une <b>alerte</b> part vers les services vétérinaires.</li>
      <li>Profil <b>Services vétérinaires</b> → <b>Alertes</b> : qualifiez l'alerte, puis publiez-la.</li>
      <li>Profil <b>POUFA / DGE</b> → <b>Tableau de bord</b>, <b>Carte</b>, <b>Paramétrage</b> (modifiez une formule).</li>
      <li>Profil <b>Éleveur</b> → <b>Saisie</b> : cédez des animaux à un abattoir, puis <b>Lots &amp; QR</b> pour afficher le QR code.</li>
      <li>Profil <b>Abattoir</b> : validez la réception. Puis ouvrez la <b>page publique</b> et scannez.</li></ol></div>`;

  // ---------- tableau de bord d'une ferme ----------
  function farmDash(f, canEdit) {
    const b = AV.activeBande(f);
    const pr = AV.province(f.province);
    const head = `<div class="card farmhead">
      <div><h1>${e(f.nom)}</h1><p class="lead">${e(f.id)} · ${e(pr.nom)} · ${e(f.localite)} · exploitant ${e(f.exploitant)}</p>
      <div class="chips">${AV.statutBadge(f.statut)}${AV.badge("Cohorte " + f.cohorte, "info")}${f.financee ? AV.badge(f.consent ? "Financée BCEG · consentement accordé" : "Financée BCEG · consentement non accordé", f.consent ? "ok" : "warn") : ""}${AV.badge("Capacité " + n(f.capacite, 0) + " places", "mute")}${AV.badge("GPS " + f.lat + ", " + f.lon, "mute")}</div></div>
      ${canEdit && f.financee ? `<button class="btn ghost sm" data-act="consent" data-id="${f.id}" data-val="${f.consent ? 0 : 1}">${f.consent ? "Révoquer le consentement BCEG" : "Accorder le consentement BCEG"}</button>` : ""}</div>`;
    if (!b) {
      const last = AV.lastBande(f);
      return head + (f.statut !== "Opérationnelle"
        ? card("Ferme en préparation", `<p>Cette ferme n'a pas encore reçu ses premiers poussins. Elle apparaît déjà dans le registre unique des 150 fermes.</p>`)
        : card("Aucune bande en cours", `<p>${last ? "Dernière bande clôturée : " + e(last.id) + "." : ""} Ouvrez une nouvelle bande à la réception des poussins.</p>${canEdit ? `<form class="inline" data-form="ouvrirBande">${F.input("date", "Date de réception", { type: "date", value: AV.todayISO(), attrs: `max="${AV.todayISO()}"` })}${F.input("n", "Poussins reçus", { type: "number", attrs: `min="1" max="${f.capacite}"`, value: Math.min(f.capacite, 1500) })}${F.btn("Ouvrir la bande")}</form>` : ""}`)) + historique(f);
    }
    const c = AV.calc(b);
    const seuil = P().seuilMortJour;
    const progAvg = avg(AV.allStats().map((s) => s.c.mortalite).filter((v) => v != null));
    const ser = AV.series(b);
    const alerts = [];
    if (canEdit) {
      const lastP = c.lastPesee;
      const age = c.age;
      if ((!lastP && age >= P().peseeFreq) || (lastP && AV.diffDays(lastP.date, AV.todayISO()) > P().peseeFreq)) alerts.push(`<div class="banner warn">Pesée en retard : la dernière date du ${lastP ? AV.fmtDate(lastP.date) : "— (aucune pesée)"} (fréquence : tous les ${P().peseeFreq} jours).</div>`);
      P().calendrierVaccinal.forEach((v) => { if (v.jour <= age && !b.vaccins.some((x) => x.vaccin === v.vaccin)) alerts.push(`<div class="banner bad">Vaccination à faire ou en retard : ${e(v.vaccin)} (prévue à J${v.jour}).</div>`); });
      if (c.alimStockTheo < 0 || b.stockDeclare < 0) alerts.push(`<div class="banner bad">Stock d'aliment négatif : vérifiez les réceptions enregistrées.</div>`);
    }
    const kp = `<div class="kpis">
      ${AV.kpi("Âge de la bande", `J${c.age}<small> / ${P().dureeBande}</small>`, `${e(b.id)} · mise en place le ${AV.fmtDate(b.debut)}`)}
      ${AV.kpi("Effectif présent", n(c.presents, 0), `sur ${n(b.misEnPlace, 0)} poussins mis en place`)}
      ${AV.kpi("Mortalité", pc(c.mortalite), `moyenne programme : ${pc(progAvg)}`, AV.mortTone(c.mortalite))}
      ${AV.kpi("Viabilité", pc(c.viabilite))}
      ${AV.kpi("Poids moyen", c.lastPesee ? n(c.poidsMoyen, 0) + " g" : "—", c.lastPesee ? "pesée du " + AV.fmtDate(c.lastPesee.date) : "aucune pesée")}
      ${AV.kpi("GMQ", c.gmq == null ? "—" : n(c.gmq, 1) + " g/j")}
      ${AV.kpi("Indice de consommation", c.ic == null ? "—" : n(c.ic, 2), "kg d'aliment / kg de poids vif")}
      ${AV.kpi("Stock d'aliment", n(c.alimStockTheo, 0) + " kg", "reçu − utilisé", c.alimStockTheo < 0 ? "bad" : "")}
      ${AV.kpi("Régularité de saisie", pc(c.completude, 0), "jours saisis / jours écoulés", c.completude < 80 ? "warn" : "good")}
      ${AV.kpi("Poids vif produit", n(c.poidsVif, 0) + " kg", "sortis + présents − poussins")}</div>`;
    const bars = ser.map((s) => ({ x: s.j, y: s.pct, bad: s.pct > seuil }));
    const growth = b.pesees.slice().sort((a, z) => a.age - z.age).map((p) => ({ x: p.age, y: p.poids }));
    const ref = []; for (let j = 0; j <= P().dureeBande; j += 3) ref.push({ x: j, y: AV.refWeight(j) });
    const charts = `<div class="grid2">
      ${card("Mortalité du jour (% de l'effectif)", AV.chart({ series: [], bars: { data: bars }, hline: { y: seuil, label: "seuil vétérinaire " + seuil + " %" }, xmax: P().dureeBande, ytitle: "mortalité du jour" }))}
      ${card("Croissance (poids moyen, g)", AV.chart({ series: [{ name: "Pesées de la ferme", color: "var(--blue)", data: growth }, { name: "Courbe de référence", color: "var(--mut)", data: ref, dash: true }], xmax: P().dureeBande, ytitle: "poids moyen" }))}</div>`;
    const recent = ser.slice(-8).reverse().map((s) => [AV.fmtDate(s.date), "J" + s.j, n(s.morts, 0), pc(s.pct, 2), n(s.aliment, 0) + " kg", AV.syncBadge(s)]);
    const jTable = card("Dernières saisies", AV.table(["Date", "Jour", "Morts", "% effectif", "Aliment", "État"], recent) + (canEdit ? `<p class="cta"><a class="btn primary" href="#/saisie">Saisir la journée</a></p>` : ""));
    const pTable = card("Pesées", AV.table(["Date", "Âge", "Animaux pesés", "Poids moyen"], b.pesees.slice().sort((a, z) => (a.date < z.date ? 1 : -1)).map((p) => [AV.fmtDate(p.date), "J" + p.age, p.n, n(p.poids, 0) + " g"]), { empty: "Aucune pesée enregistrée." }));
    return head + alerts.join("") + kp + charts + `<div class="grid2">${jTable}${pTable}</div>` + historique(f);
  }
  function historique(f) {
    const rows = f.bandes.slice().reverse().map((b) => {
      const c = b.statut === "Clôturée" && b.bilan ? b.bilan : AV.calc(b);
      return [e(b.id), AV.statutBadge(b.statut), AV.fmtDate(b.debut), n(b.misEnPlace, 0), pc(c.mortalite), c.ic == null ? "—" : n(c.ic, 2), c.gmq == null ? "—" : n(c.gmq, 1), n(c.poidsVif, 0) + " kg"];
    });
    return card("Historique des bandes", AV.table(["Bande", "Statut", "Mise en place", "Poussins", "Mortalité", "IC", "GMQ (g/j)", "Poids vif produit"], rows, { empty: "Aucune bande." }) + `<p class="note">Aucune bande n'est supprimée. Une bande clôturée passe en lecture seule.</p>`);
  }
  AV.views.ferme = () => farmDash(AV.farm(S().ui.fermeId), true);
  AV.views.f = (id) => {
    const f = AV.farm(id), role = S().ui.role;
    if (!f) return card("Ferme introuvable", "<p>Identifiant inconnu.</p>");
    if (!AV.canSeeFarm(role, f)) return denied("Cette ferme n'est pas dans votre périmètre d'accès.");
    return `<p class="back"><a href="#" data-act="back">← Retour</a></p>` + farmDash(f, false);
  };

  // ---------- saisie éleveur ----------
  AV.views.saisie = () => {
    const f = AV.farm(S().ui.fermeId), b = AV.activeBande(f);
    if (!b) return page("Saisie", "", card("Aucune bande en cours", `<p>Ouvrez une bande depuis <a href="#/ferme">Ma ferme</a>.</p>`));
    const c = AV.calc(b), today = AV.todayISO();
    const motifs = P().listes.motifs;
    const dest = S().operateurs.map((o) => [o.id, `${o.nom} (${o.type})`]);
    const done = b.jours.some((x) => x.date === today);
    return page("Saisie de terrain", `${e(f.nom)} · bande ${e(b.id)} · jour ${c.age}`,
      offBanner() +
      card("Fiche d'élevage du jour", `<p class="sub">Effectif présent : <b>${n(c.presents, 0)}</b>. ${done ? "La saisie d'aujourd'hui est déjà enregistrée : choisissez une autre date pour un rattrapage." : "Calquée sur la fiche papier."}</p>
      <form data-form="saisie" class="stack">${F.input("date", "Date", { type: "date", value: done ? "" : today, attrs: `min="${b.debut}" max="${today}"` })}
      ${F.input("morts", "Morts du jour", { type: "number", value: 0, attrs: `min="0" max="${c.presents}" inputmode="numeric"` })}
      ${F.input("aliment", "Aliment consommé (kg)", { type: "number", value: "", attrs: `min="0" step="0.5" inputmode="decimal"` })}
      ${F.btn("Enregistrer la journée")}</form>
      <p class="note">Contrôles : morts ≤ effectif présent, pas de doublon de date. Si la mortalité du jour dépasse le seuil vétérinaire (${P().seuilMortJour} %), une alerte part automatiquement.</p>`) +
      `<div class="grid2">` +
      card("Pesée", `<form data-form="pesee" class="stack">${F.input("date", "Date", { type: "date", value: today, attrs: `min="${b.debut}" max="${today}"` })}${F.input("n", "Animaux pesés", { type: "number", value: P().echantillon, attrs: 'min="1"' })}${F.input("poids", "Poids moyen (g)", { type: "number", attrs: 'min="1" max="6000" step="1" inputmode="numeric"' })}${F.btn("Enregistrer la pesée")}</form><p class="note">Fréquence conseillée : toutes les ${P().peseeFreq} jours, échantillon de ${P().echantillon} animaux.</p>`) +
      card("Sortie / cession d'animaux", `<form data-form="sortie" class="stack">${F.input("date", "Date", { type: "date", value: today, attrs: `min="${b.debut}" max="${today}"` })}${F.input("n", "Nombre d'animaux", { type: "number", attrs: `min="1" max="${c.presents}"` })}${F.input("kg", "Poids total (kg)", { type: "number", attrs: 'min="1" step="0.5"' })}${F.select("motif", "Motif", motifs, "Abattoir")}${F.select("destId", "Destinataire", dest, "OP-01")}${F.btn("Enregistrer la cession")}</form><p class="note">Une cession crée un <b>lot</b> avec son identifiant unique et son QR code.</p>`) +
      `</div>` +
      card("Clôture de la bande", `<p>Clôture automatique quand l'effectif présent est nul, ou manuelle. Le bilan est produit automatiquement et la bande passe en lecture seule.</p><button class="btn danger" data-act="cloturer">Clôturer la bande et produire le bilan</button>`));
  };

  // ---------- sanitaire (éleveur) ----------
  AV.views.sanitaire = () => {
    const f = AV.farm(S().ui.fermeId), b = AV.activeBande(f), today = AV.todayISO();
    const decl = S().declarations.filter((d) => d.fermeId === f.id).slice().reverse();
    const al = S().alertes.filter((a) => a.fermeId === f.id).slice().reverse();
    const cal = P().calendrierVaccinal;
    const vacRows = b ? cal.map((v) => {
      const done = b.vaccins.find((x) => x.vaccin === v.vaccin);
      const age = AV.bandeAge(b);
      return [`J${v.jour}`, e(v.vaccin), done ? AV.badge("Fait le " + AV.fmtDate(done.date), "ok") : v.jour <= age ? AV.badge("En retard / à faire", "bad") : AV.badge("À venir", "mute")];
    }) : [];
    return page("Santé et biosécurité", "Déclarez vite un problème : seuls les services vétérinaires reçoivent vos déclarations.",
      offBanner() +
      card("Déclaration sanitaire", `<form data-form="declaration" class="stack">${F.input("date", "Date", { type: "date", value: today, attrs: `max="${today}"` })}${F.select("type", "Type", ["Mortalité anormale", "Signes cliniques", "Suspicion de maladie"], "Signes cliniques")}
        <fieldset class="checks"><legend>Signes observés</legend>${P().listes.signes.map((s, i) => `<label class="chk"><input type="checkbox" name="signe" value="${e(s)}"> ${e(s)}</label>`).join("")}</fieldset>
        ${F.input("n", "Animaux touchés", { type: "number", value: 0, attrs: 'min="0"' })}${F.text("note", "Précisions (facultatif)", { ph: "Décrivez ce que vous voyez" })}${F.btn("Envoyer aux services vétérinaires", "danger")}</form>
        <p class="note">La liste des signes est paramétrée par les services vétérinaires. Une alerte non vérifiée n'est jamais diffusée.</p>`) +
      `<div class="grid2">` +
      card("Vaccinations", `${AV.table(["Jour prévu", "Vaccin", "État"], vacRows, { empty: "Aucune bande en cours." })}${b ? `<form data-form="vaccin" class="stack">${F.select("vaccin", "Vaccin administré", cal.map((v) => v.vaccin).concat(["Autre"]), cal[0] && cal[0].vaccin)}${F.input("date", "Date", { type: "date", value: today, attrs: `max="${today}"` })}${F.input("n", "Animaux vaccinés", { type: "number", value: AV.calc(b).presents, attrs: 'min="1"' })}${F.btn("Enregistrer la vaccination")}</form>` : ""}`) +
      card("Traitements", `${AV.table(["Produit", "Motif", "Début", "Fin"], b ? b.traitements.map((t) => [e(t.produit), e(t.motif || "—"), AV.fmtDate(t.debut), AV.fmtDate(t.fin)]) : [], { empty: "Aucun traitement enregistré." })}${b ? `<form data-form="traitement" class="stack">${F.input("produit", "Produit")}${F.input("motif", "Motif", { req: false })}${F.input("debut", "Début", { type: "date", value: today })}${F.input("fin", "Fin", { type: "date", req: false })}${F.input("n", "Animaux traités", { type: "number", value: 0, attrs: 'min="0"', req: false })}${F.btn("Enregistrer le traitement")}</form><p class="note">Les traitements reçus sont rattachés à la bande, puis au lot avant la vente.</p>` : ""}`) +
      `</div>` +
      card("Mes déclarations et alertes", AV.table(["Date", "Type", "Statut de l'alerte", "Envoi"], al.map((a) => [AV.fmtDate(a.date), e(a.type), AV.statutBadge(a.statut), a.pending ? AV.badge("En attente d'envoi", "warn") : AV.badge("Transmise", "ok")]), { empty: "Aucune déclaration." })));
  };

  // ---------- intrants (éleveur) ----------
  AV.views.intrants = () => {
    const f = AV.farm(S().ui.fermeId), b = AV.activeBande(f);
    if (!b) return page("Intrants", "", card("Aucune bande en cours", "<p>Ouvrez une bande pour suivre vos intrants.</p>"));
    const c = AV.calc(b), today = AV.todayISO();
    const seuil = P().seuilEcartIntrants;
    return page("Intrants subventionnés", `Bande ${e(b.id)} · ce que l'État vous a fourni et ce que vous avez utilisé`,
      offBanner() +
      `<div class="kpis">${AV.kpi("Aliment reçu", n(c.alimRecu, 0) + " kg")}${AV.kpi("Aliment utilisé", n(c.aliment, 0) + " kg", "somme des saisies")}${AV.kpi("Stock théorique", n(c.alimStockTheo, 0) + " kg", "reçu − utilisé", c.alimStockTheo < 0 ? "bad" : "")}${AV.kpi("Stock compté", n(b.stockDeclare, 0) + " kg", "déclaré sur place")}${AV.kpi("Écart", pc(c.ecartIntrants), "seuil : " + seuil + " %", Math.abs(c.ecartIntrants) > seuil ? "bad" : "good")}</div>` +
      card("Réceptions d'intrants", AV.table(["Date", "Type", "Produit", "Quantité", "Subventionné", "État"], b.intrants.slice().reverse().map((i) => [AV.fmtDate(i.date), e(i.type), e(i.produit), `${n(i.qte, 0)} ${e(i.unite)}`, i.subv ? "Oui" : "Non", AV.syncBadge(i)]))) +
      `<div class="grid2">` +
      card("Enregistrer une réception", `<form data-form="intrant" class="stack">${F.input("date", "Date", { type: "date", value: today, attrs: `max="${today}"` })}${F.select("type", "Type", ["Aliment", "Vaccins", "Médicaments", "Poussins", "Autre"], "Aliment")}${F.input("produit", "Produit", { value: "Aliment croissance" })}${F.input("qte", "Quantité", { type: "number", attrs: 'min="1" step="0.5"' })}${F.select("unite", "Unité", ["kg", "doses", "boîtes", "têtes"], "kg")}<label class="chk"><input type="checkbox" name="subv" checked> Subventionné par l'État</label>${F.btn("Enregistrer")}</form>`) +
      card("Compter le stock sur place", `<form data-form="stock" class="stack">${F.input("qte", "Stock d'aliment compté (kg)", { type: "number", value: Math.max(0, Math.round(b.stockDeclare)), attrs: 'min="0" step="0.5"' })}${F.btn("Valider le comptage")}</form><p class="note">Écart (%) = (livré − utilisé − stock) / livré × 100. Il est signalé au-delà du seuil fixé par la DGE.</p>`) + `</div>`);
  };

  // ---------- lots & QR (éleveur) ----------
  function lotRows(lots, withFarm) {
    return lots.map((l) => {
      const op = AV.operateur(l.destId);
      return [e(l.id), ...(withFarm ? [farmLinkId(l.fermeId)] : []), AV.fmtDate(l.date), n(l.n, 0), n(l.kg, 0) + " kg", e(op ? op.nom : "?"), AV.statutBadge(l.statut), `<button class="btn ghost sm" data-act="showQR" data-id="${e(l.id)}">QR code</button>`];
    });
  }
  const farmLinkId = (id) => { const f = AV.farm(id); return f ? (AV.canSeeFarm(S().ui.role, f) ? `<a href="#/f/${f.id}">${e(f.nom)}</a>` : e(f.nom)) : "?"; };
  AV.views.lots = () => {
    const f = AV.farm(S().ui.fermeId);
    const lots = S().lots.filter((l) => l.fermeId === f.id).slice().reverse();
    return page("Mes lots et QR codes", "Chaque cession crée un lot : un identifiant unique, jamais réutilisé, et un QR code imprimable.",
      card("Lots de ma ferme", AV.table(["Lot", "Date", "Animaux", "Poids", "Destinataire", "Statut", ""], lotRows(lots, false), { empty: "Aucun lot : cédez des animaux depuis l'écran Saisie." })) +
      card("Comment ça marche", `<ol class="steps"><li>Vous cédez des animaux à un abattoir ou à un acheteur identifié.</li><li>Le lot reçoit son identifiant (ferme + bande + numéro d'ordre) et son QR code.</li><li>Vous imprimez l'étiquette. Le QR se lit avec un simple téléphone.</li><li>L'abattoir scanne et valide la réception : la traçabilité repose sur des événements vérifiables.</li></ol>`));
  };

  // ---------- liste des fermes ----------
  function filterBar(withStatut) {
    const fl = S().ui.filters;
    return `<div class="filters">${F.select("province", "Province", [["", "Toutes"]].concat(AV.PROVINCES.map((p) => [p.code, p.nom])), fl.province).replace("<select", '<select data-change="filter" data-key="province"')}${F.select("cohorte", "Cohorte", [["", "Toutes"], ["1", "Cohorte 1"], ["2", "Cohorte 2"]], fl.cohorte).replace("<select", '<select data-change="filter" data-key="cohorte"')}${withStatut ? F.select("statut", "Statut", [["", "Tous"], ["Opérationnelle", "Opérationnelle"], ["En préparation", "En préparation"]], fl.statut).replace("<select", '<select data-change="filter" data-key="statut"') : ""}</div>`;
  }
  const passFilter = (f) => { const fl = S().ui.filters; return (!fl.province || f.province === fl.province) && (!fl.cohorte || String(f.cohorte) === fl.cohorte) && (!fl.statut || f.statut === fl.statut); };

  AV.views.fermes = () => {
    const role = S().ui.role;
    const list = AV.visibleFermes(role).filter(passFilter);
    const rows = list.map((f) => {
      const b = AV.activeBande(f), c = b ? AV.calc(b) : null;
      return [`<a href="#/f/${f.id}">${e(f.id)}</a>`, e(f.nom), e(AV.province(f.province).nom), AV.statutBadge(f.statut), f.cohorte, f.financee ? AV.badge("BCEG", "info") : "—", c ? pc(c.mortalite) : "—", c && c.ic != null ? n(c.ic, 2) : "—", c ? pc(c.completude, 0) : "—"];
    });
    return page(role === "agent" ? "Mes fermes" : "Registre des fermes", `${list.length} ferme(s) · registre unique, identifiant automatique (code province + numéro d'ordre)`,
      filterBar(true) + card("", AV.table(["Identifiant", "Ferme", "Province", "Statut", "Cohorte", "Financement", "Mortalité", "IC", "Saisie"], rows, { empty: "Aucune ferme ne correspond aux filtres." })));
  };

  // ---------- tableau de bord national ----------
  AV.views.national = () => {
    const fermes = S().fermes.filter(passFilter);
    const ids = new Set(fermes.map((f) => f.id));
    const st = AV.allStats().filter((s) => ids.has(s.f.id));
    const morts = st.map((s) => s.c.mortalite).filter((v) => v != null);
    const vol = st.reduce((s, x) => s + x.c.poidsVif, 0);
    const alAct = S().alertes.filter((a) => ids.has(a.fermeId) && !a.pending && !["Close", "Infirmée"].includes(a.statut));
    const lots = S().lots.filter((l) => ids.has(l.fermeId));
    const valid = lots.filter((l) => l.recu).length;
    const op = fermes.filter((f) => f.statut === "Opérationnelle").length;
    const provRows = AV.PROVINCES.map((p) => {
      const sp = st.filter((s) => s.f.province === p.code);
      const fp = fermes.filter((f) => f.province === p.code);
      const m = avg(sp.map((s) => s.c.mortalite).filter((v) => v != null));
      return { p, fp: fp.length, op: fp.filter((f) => f.statut === "Opérationnelle").length, eff: sp.reduce((s, x) => s + x.c.presents, 0), m, vol: sp.reduce((s, x) => s + x.c.poidsVif, 0), comp: avg(sp.map((s) => s.c.completude)), al: alAct.filter((a) => AV.farm(a.fermeId).province === p.code).length };
    }).filter((r) => r.fp);
    const bars = provRows.filter((r) => r.m != null).map((r) => `<div class="hbar"><span>${e(r.p.nom)}</span><div><i style="width:${Math.min(100, (r.m / 8) * 100)}%;background:${r.m > P().seuilMortCarte ? "var(--red)" : r.m > 3 ? "var(--orange)" : "var(--green)"}"></i></div><b>${pc(r.m)}</b></div>`).join("");
    const pub = S().alertes.filter((a) => a.publiee);
    return page("Tableau de bord national", "Indicateurs consolidés de toutes les fermes · actualisation automatique à chaque saisie",
      filterBar(true) +
      `<div class="kpis">${AV.kpi("Fermes opérationnelles", `${op}<small> / ${fermes.length}</small>`, "passage de 79 à 150")}${AV.kpi("Bandes en cours", st.length)}${AV.kpi("Effectif présent", n(st.reduce((s, x) => s + x.c.presents, 0), 0), "têtes vivantes")}${AV.kpi("Mortalité moyenne", pc(avg(morts)), "", AV.mortTone(avg(morts)))}${AV.kpi("Poids vif produit", n(vol / 1000, 1) + " t", "bandes en cours (démo)")}${AV.kpi("Alertes actives", alAct.length, "en cours de traitement", alAct.length ? "warn" : "good")}${AV.kpi("Régularité de saisie", pc(avg(st.map((s) => s.c.completude)), 0), "moyenne des fermes")}${AV.kpi("Lots tracés", lots.length, `${valid} réception(s) validée(s) à l'abattoir`)}</div>` +
      `<div class="grid2">${card("Mortalité moyenne par province", bars || "<p>Aucune donnée.</p>")}${card("Alertes sanitaires publiées", pub.length ? pub.map((a) => `<div class="pubal"><b>${e(AV.province(AV.farm(a.fermeId).province).nom)}</b> · ${AV.fmtDate(a.date)} · ${e(a.type)} ${AV.badge("Confirmée et publiée", "bad")}</div>`).join("") + `<p class="note">Seule l'autorité vétérinaire publie une alerte. Aucune ferme n'est nommée.</p>` : "<p>Aucune alerte publiée.</p>")}</div>` +
      card("Par province", AV.table(["Province", "Fermes", "Opérationnelles", "Effectif présent", "Mortalité moy.", "Poids vif (kg)", "Saisie", "Alertes actives"], provRows.map((r) => [e(r.p.nom), r.fp, r.op, n(r.eff, 0), pc(r.m), n(r.vol, 0), pc(r.comp, 0), r.al]))));
  };

  // ---------- carte ----------
  AV.views.carte = () => {
    const mode = S().ui.mapMode || "mortalite";
    const role = S().ui.role;
    const stMap = new Map(AV.allStats().map((s) => [s.f.id, s.c]));
    const alMap = new Map();
    S().alertes.filter((a) => !a.pending && !["Close", "Infirmée"].includes(a.statut)).forEach((a) => alMap.set(a.fermeId, a));
    const pts = S().fermes.map((f) => {
      const c = stMap.get(f.id);
      let color = "#b9b5a8", r = 4, label = `${f.nom} (${f.id})`;
      if (mode === "mortalite") { if (c) { color = c.mortalite > P().seuilMortCarte ? "var(--red)" : c.mortalite > 3 ? "var(--orange)" : "var(--green)"; r = 6; label += ` · mortalité ${pc(c.mortalite)}`; } }
      else if (mode === "alerte") { if (alMap.has(f.id)) { color = "var(--red)"; r = 8; label += ` · alerte ${alMap.get(f.id).statut}`; } else if (c) { color = "var(--green)"; r = 5; } }
      else { color = f.statut === "Opérationnelle" ? "var(--green)" : "var(--blue)"; r = 5; label += " · " + f.statut; }
      return { id: f.id, lat: f.lat, lon: f.lon, color, r, label, noLink: role === "vet" };
    });
    const leg = { mortalite: [["var(--green)", "Mortalité normale"], ["var(--orange)", "> 3 %"], ["var(--red)", "> " + P().seuilMortCarte + " %"], ["#b9b5a8", "Pas de bande"]], alerte: [["var(--red)", "Alerte active"], ["var(--green)", "Aucune alerte"], ["#b9b5a8", "Pas de bande"]], statut: [["var(--green)", "Opérationnelle"], ["var(--blue)", "En préparation"]] }[mode];
    return page("Carte des exploitations", "Chaque point est une ferme, positionnée par ses coordonnées GPS relevées à l'enrôlement.",
      `<div class="filters"><label class="fld"><span>Colorer selon</span><select data-change="mapMode"><option value="mortalite" ${mode === "mortalite" ? "selected" : ""}>Mortalité</option><option value="alerte" ${mode === "alerte" ? "selected" : ""}>Alertes sanitaires</option><option value="statut" ${mode === "statut" ? "selected" : ""}>Statut</option></select></label></div>` +
      `<div class="card mapcard">${AV.map(pts, mode)}<div class="legend">${leg.map((l) => `<span class="lg"><i style="background:${l[0]}"></i>${l[1]}</span>`).join("")}</div><p class="note">Carte schématique (fond simplifié) · ${pts.length} fermes · cliquez sur un point pour ouvrir la ferme.</p></div>`);
  };

  // ---------- classement ----------
  AV.views.classement = () => {
    const role = S().ui.role;
    const st = AV.allStats().filter((s) => AV.canSeeFarm(role, s.f) && s.c.mortalite != null && s.c.ic != null && s.c.gmq != null);
    const w = P().classement, tot = w.mortalite + w.ic + w.gmq + w.regularite || 1;
    const norm = (v, arr) => { const mn = Math.min(...arr), mx = Math.max(...arr); return mx === mn ? 0.5 : (v - mn) / (mx - mn); };
    const M = st.map((s) => s.c.mortalite), I = st.map((s) => s.c.ic), G = st.map((s) => s.c.gmq), R = st.map((s) => s.c.completude);
    const rows = st.map((s) => ({ s, score: ((w.mortalite * (1 - norm(s.c.mortalite, M)) + w.ic * (1 - norm(s.c.ic, I)) + w.gmq * norm(s.c.gmq, G) + w.regularite * norm(s.c.completude, R)) / tot) * 100 })).sort((a, b) => b.score - a.score);
    return page("Classement des fermes", `Score sur 100 : mortalité ${w.mortalite} %, IC ${w.ic} %, GMQ ${w.gmq} %, régularité de saisie ${w.regularite} % (pondérations paramétrables par la DGE).`,
      card("", AV.table(["Rang", "Ferme", "Province", "Mortalité", "IC", "GMQ (g/j)", "Saisie", "Score"], rows.map((r, i) => [i + 1, farmLink(r.s.f), e(AV.province(r.s.f.province).nom), pc(r.s.c.mortalite), n(r.s.c.ic, 2), n(r.s.c.gmq, 1), pc(r.s.c.completude, 0), `<b>${n(r.score, 0)}</b>`]), { empty: "Pas assez de données (au moins une pesée est nécessaire)." })) + `<p class="note">Sert à repérer les fermes à accompagner et les bonnes pratiques à partager.</p>`);
  };

  // ---------- recoupement intrants ----------
  AV.views.recoupement = () => {
    const role = S().ui.role, seuil = P().seuilEcartIntrants;
    const st = AV.allStats().filter((s) => AV.canSeeFarm(role, s.f)).sort((a, b) => b.c.ecartIntrants - a.c.ecartIntrants);
    const flagged = st.filter((s) => Math.abs(s.c.ecartIntrants) > seuil).length;
    return page("Recoupement livraisons / déclarations", `Écart (%) = (livré − utilisé − stock) / livré × 100 · signalé au-delà de ${seuil} % (seuil fixé par la DGE) · ${flagged} ferme(s) signalée(s)`,
      card("", AV.table(["Ferme", "Province", "Aliment livré", "Utilisé (saisies)", "Stock compté", "Écart", "Statut"], st.map((s) => [farmLink(s.f), e(AV.province(s.f.province).nom), n(s.c.alimRecu, 0) + " kg", n(s.c.aliment, 0) + " kg", n(s.b.stockDeclare, 0) + " kg", pc(s.c.ecartIntrants), Math.abs(s.c.ecartIntrants) > seuil ? AV.badge("À vérifier en visite", "bad") : AV.badge("Conforme", "ok")]))) + `<p class="note">Fiabilise les déclarations des éleveurs et oriente les visites des agents techniques.</p>`);
  };

  // ---------- traçabilité (DGE) ----------
  AV.views.tracabilite = () => {
    const q = (S().ui.traceQ || "").trim().toLowerCase();
    let lots = S().lots.slice().reverse();
    if (q) lots = lots.filter((l) => { const f = AV.farm(l.fermeId), o = AV.operateur(l.destId); return l.id.toLowerCase().includes(q) || f.nom.toLowerCase().includes(q) || f.id.toLowerCase().includes(q) || (o && o.nom.toLowerCase().includes(q)); });
    const all = S().lots;
    const withRecu = all.filter((l) => l.recu).length;
    const ind = `<div class="kpis">${AV.kpi("Lots tracés", all.length)}${AV.kpi("Lots avec QR code", "100 %", "un QR par lot (seuil de recette : 95 %)", "good")}${AV.kpi("Réceptions validées", pc(all.length ? (withRecu / all.length) * 100 : 0, 0), "événements vérifiables à l'abattoir")}${AV.kpi("Lots clos", all.filter((l) => l.clos).length, "QR rejeté à la lecture")}</div>`;
    const search = card("Recherche amont / aval", `<p class="sub">En cas d'alerte sanitaire : retrouvez les lots d'une ferme et leurs destinataires, ou l'origine d'un lot.</p><div class="filters"><label class="fld grow"><span>Ferme, identifiant de lot ou opérateur</span><input data-change="traceQ" type="search" value="${e(S().ui.traceQ || "")}" placeholder="ex. Moussavou, EST-001, Abattoir démo"></label></div>` +
      AV.table(["Lot", "Ferme", "Date", "Animaux", "Poids", "Destinataire", "Statut", ""], lotRows(lots.slice(0, 40), true).map((r, i) => r.slice(0, 7).concat([`<button class="btn ghost sm" data-act="${lots[i].clos ? "lotOpen" : "lotClose"}" data-id="${e(lots[i].id)}">${lots[i].clos ? "Rouvrir" : "Clore"}</button>`])), { empty: "Aucun lot trouvé." }) + (lots.length > 40 ? `<p class="note">${lots.length - 40} autre(s) résultat(s) : affinez la recherche.</p>` : ""));
    const ops = card("Registre des opérateurs", AV.table(["Identifiant", "Nom", "Type", "Localisation", "Convention"], S().operateurs.map((o) => [e(o.id), e(o.nom), e(o.type), e(o.loc), o.convention ? AV.badge("Signée", "ok") : AV.badge("En attente : aucun compte actif", "warn")])) +
      `<form data-form="operateur" class="inline">${F.input("nom", "Nouvel opérateur")}${F.select("type", "Type", ["Abattoir", "Acheteur", "Distributeur"], "Abattoir")}${F.input("loc", "Localisation", { req: false })}<label class="chk"><input type="checkbox" name="convention"> Convention signée</label>${F.btn("Ajouter")}</form>`);
    const scans = card("Journal des lectures de QR code", AV.table(["Date", "Lot", "Résultat"], S().scans.slice().reverse().slice(0, 15).map((s) => [AV.fmtTime(s.t), e(s.lot), s.result === "ok" ? AV.badge("Lot valide", "ok") : AV.badge(s.result === "closed" ? "Lot clos : rejeté" : "QR inconnu : rejeté", "bad")]), { empty: "Aucune lecture enregistrée sur cet appareil." }));
    return page("Traçabilité des lots", "De la ferme au consommateur, sans ressaisie : la traçabilité utilise directement les données du suivi.", ind + search + `<div class="grid2">${ops}${scans}</div>`);
  };

  // ---------- rapport périodique ----------
  AV.views.rapport = () => {
    const st = AV.allStats();
    const morts = st.map((s) => s.c.mortalite).filter((v) => v != null);
    const rows = AV.PROVINCES.map((p) => {
      const sp = st.filter((s) => s.f.province === p.code);
      return [e(p.nom), sp.length, n(sp.reduce((s, x) => s + x.c.presents, 0), 0), pc(avg(sp.map((s) => s.c.mortalite).filter((v) => v != null))), n(sp.reduce((s, x) => s + x.c.poidsVif, 0), 0) + " kg"];
    });
    return page("Rapport hebdomadaire POUFA", `Édité le ${AV.fmtDate(AV.todayISO())} · données fictives de démonstration`,
      `<p class="cta noprint"><button class="btn primary" data-act="print">Imprimer / enregistrer en PDF</button></p>` +
      card("Synthèse nationale", `<div class="kpis">${AV.kpi("Bandes en cours", st.length)}${AV.kpi("Effectif présent", n(st.reduce((s, x) => s + x.c.presents, 0), 0))}${AV.kpi("Mortalité moyenne", pc(avg(morts)))}${AV.kpi("Poids vif produit", n(st.reduce((s, x) => s + x.c.poidsVif, 0) / 1000, 1) + " t")}</div>`) +
      card("Par province", AV.table(["Province", "Bandes en cours", "Effectif présent", "Mortalité moy.", "Poids vif produit"], rows)) +
      card("Alertes sanitaires publiées", S().alertes.filter((a) => a.publiee).length ? AV.table(["Date", "Province", "Type"], S().alertes.filter((a) => a.publiee).map((a) => [AV.fmtDate(a.date), e(AV.province(AV.farm(a.fermeId).province).nom), e(a.type)])) : "<p>Aucune alerte publiée.</p>") +
      `<p class="note">Modèle, périodicité (hebdomadaire, fin de bande, mensuel national) et envoi automatique paramétrables dans la plateforme livrée.</p>`);
  };

  // ---------- paramétrage (DGE) ----------
  AV.views.param = () => {
    const p = P(), fo = p.formules;
    const listEditor = (key, title) => `<div><h3>${title}</h3><div class="chips">${p.listes[key].map((v, i) => `<span class="chip">${e(v)} <button data-act="listDel" data-list="${key}" data-i="${i}" aria-label="Retirer">×</button></span>`).join("")}</div><form data-form="listAdd" class="inline" data-list="${key}">${F.input("val", "Ajouter")}${F.btn("Ajouter", "ghost")}</form></div>`;
    return page("Paramétrage sans développement", "Les règles métier ne sont jamais codées en dur : les services habilités les modifient eux-mêmes. Chaque changement est journalisé.",
      card("Paramètres généraux", `<form data-form="paramGen" class="grid3">${F.input("dureeBande", "Durée de référence d'une bande (jours)", { type: "number", value: p.dureeBande, attrs: 'min="20" max="90"' })}${F.input("peseeFreq", "Fréquence des pesées (jours)", { type: "number", value: p.peseeFreq, attrs: 'min="1" max="30"' })}${F.input("echantillon", "Taille de l'échantillon de pesée", { type: "number", value: p.echantillon, attrs: 'min="5"' })}${F.input("seuilEcartIntrants", "Seuil d'écart sur les intrants (%)", { type: "number", value: p.seuilEcartIntrants, attrs: 'min="0" step="0.5"' })}${F.input("seuilEcartAbattoir", "Seuil d'écart à l'abattoir (%)", { type: "number", value: p.seuilEcartAbattoir, attrs: 'min="0" step="0.5"' })}${F.input("seuilMortCarte", "Seuil rouge de mortalité sur la carte (%)", { type: "number", value: p.seuilMortCarte, attrs: 'min="1" step="0.5"' })}<div class="full">${F.btn("Enregistrer les paramètres")}</div></form>
        <div class="locked"><b>Seuil d'alerte sanitaire : ${p.seuilMortJour} % de l'effectif présent par jour.</b> Réglé par les seuls services vétérinaires (profil « Services vétérinaires »). Il n'est pas modifiable ici.</div>`) +
      card("Formules des indicateurs", `<p class="sub">Variables disponibles : ${AV.FORMULA_VARS.map((v) => `<code>${v}</code>`).join(" ")}. La viabilité peut aussi utiliser <code>mortalite</code>. Opérations : + − × ÷ ( ) et min, max, abs, round. Les indicateurs de toutes les fermes sont recalculés immédiatement.</p>
        <form data-form="formules" class="stack">${F.input("mortalite", "Taux de mortalité (%)", { value: fo.mortalite })}${F.input("viabilite", "Viabilité (%)", { value: fo.viabilite })}${F.input("gmq", "Gain moyen quotidien (g/jour)", { value: fo.gmq })}${F.input("ic", "Indice de consommation", { value: fo.ic })}${F.btn("Tester et enregistrer les formules")}<button class="btn ghost" type="button" data-act="formulesDefaut">Rétablir les formules proposées</button></form>`) +
      card("Pondérations du classement des fermes", `<form data-form="poids" class="grid3">${F.input("mortalite", "Mortalité", { type: "number", value: p.classement.mortalite, attrs: 'min="0" max="100"' })}${F.input("ic", "Indice de consommation", { type: "number", value: p.classement.ic, attrs: 'min="0" max="100"' })}${F.input("gmq", "GMQ", { type: "number", value: p.classement.gmq, attrs: 'min="0" max="100"' })}${F.input("regularite", "Régularité de saisie", { type: "number", value: p.classement.regularite, attrs: 'min="0" max="100"' })}<div class="full">${F.btn("Enregistrer les pondérations")}</div></form>`) +
      card("Listes paramétrables", `<div class="grid2">${listEditor("motifs", "Motifs de sortie")}</div>`) +
      card("Données de démonstration", `<p>Les données sont stockées sur cet appareil. Vous pouvez les réinitialiser à tout moment.</p><button class="btn danger" data-act="reset">Réinitialiser la démonstration</button>`));
  };

  // ---------- vétérinaires ----------
  AV.views.alertes = () => {
    const fl = S().ui.filters.alerte || "";
    let list = S().alertes.filter((a) => !a.pending).slice().reverse();
    if (fl) list = list.filter((a) => a.statut === fl);
    const pend = S().alertes.filter((a) => a.pending).length;
    const items = list.map((a) => {
      const f = AV.farm(a.fermeId);
      const next = AV.ALERT_FLOW[a.statut];
      const btns = next.map((s) => `<button class="btn ${s === "Confirmée" ? "danger" : "ghost"} sm" data-act="alertStatut" data-id="${a.id}" data-s="${s}">${s === "En analyse" ? "Prendre en charge" : s === "Close" ? "Clore" : s === "Confirmée" ? "Confirmer" : "Infirmer"}</button>`).join("");
      const pub = a.statut === "Confirmée" ? (a.publiee ? AV.badge("Publiée", "bad") : `<button class="btn primary sm" data-act="alertPublish" data-id="${a.id}">Publier l'alerte</button>`) : "";
      return `<article class="alert ${a.statut === "Nouvelle" ? "new" : ""}"><header><b>${a.id}</b> ${AV.statutBadge(a.statut)} ${a.publiee ? AV.badge("Publiée", "bad") : ""}<span class="when">${AV.fmtDate(a.date)}</span></header>
        <p><b>${e(f.nom)}</b> (${e(f.id)}) · ${e(AV.province(f.province).nom)} · bande ${e(a.bandeId)}</p><p>${e(a.type)} — ${e(a.detail)}</p>
        <ol class="hist">${a.hist.map((h) => `<li>${AV.fmtTime(h.t)} · <b>${e(h.statut)}</b> · ${e(h.par)}${h.note ? " — " + e(h.note) : ""}</li>`).join("")}</ol>
        ${next.length || pub ? `<div class="actions">${next.length ? `<input class="note-in" id="note-${a.id}" placeholder="Commentaire (facultatif)">` : ""}${btns}${pub}</div>` : ""}</article>`;
    }).join("");
    return page("Alertes sanitaires", "Les services vétérinaires qualifient les alertes et décident de leur publication : une alerte non vérifiée peut avoir de lourdes conséquences économiques.",
      `<div class="filters">${F.select("alerte", "Statut", [["", "Tous"], "Nouvelle", "En analyse", "Confirmée", "Infirmée", "Close"], fl).replace("<select", '<select data-change="filterAlerte"')}</div>` +
      (pend ? `<div class="banner warn">${pend} alerte(s) créée(s) hors connexion seront visibles ici après synchronisation.</div>` : "") +
      (items || card("", "<p>Aucune alerte.</p>")) + `<p class="note">Circuit : Nouvelle → En analyse → Confirmée / Infirmée → Close. L'historique est horodaté.</p>`);
  };
  AV.views.seuils = () => {
    const p = P();
    return page("Seuils et calendrier vaccinal", "Réglés par les seuls services vétérinaires, jamais codés en dur.",
      card("Seuil d'alerte précoce", `<form data-form="seuil" class="inline">${F.input("seuil", "Mortalité du jour (% de l'effectif présent)", { type: "number", value: p.seuilMortJour, attrs: 'min="0.1" max="20" step="0.1"' })}${F.btn("Enregistrer le seuil")}</form><p class="note">Une alerte se déclenche si la mortalité du jour dépasse ce seuil, ou sur suspicion déclarée par l'éleveur. Valeur proposée à valider.</p>`) +
      card("Calendrier vaccinal de référence", AV.table(["Jour", "Vaccin", ""], p.calendrierVaccinal.map((v, i) => [`J${v.jour}`, e(v.vaccin), `<button class="btn ghost sm" data-act="vacDel" data-i="${i}">Retirer</button>`])) + `<form data-form="vacAdd" class="inline">${F.input("jour", "Jour", { type: "number", attrs: 'min="1" max="60"' })}${F.input("vaccin", "Vaccin")}${F.btn("Ajouter", "ghost")}</form><p class="note">Calendrier proposé à titre d'exemple : à valider par les services vétérinaires.</p>`) +
      card("Signes cliniques proposés à l'éleveur", `<div class="chips">${p.listes.signes.map((v, i) => `<span class="chip">${e(v)} <button data-act="listDel" data-list="signes" data-i="${i}" aria-label="Retirer">×</button></span>`).join("")}</div><form data-form="listAdd" class="inline" data-list="signes">${F.input("val", "Ajouter un signe")}${F.btn("Ajouter", "ghost")}</form>`));
  };

  // ---------- BCEG ----------
  AV.views.bceg = () => {
    const fin = S().fermes.filter((f) => f.financee);
    const rows = fin.map((f) => {
      if (!f.consent) return [e(f.id), `<span class="mute">Données masquées</span>`, e(AV.province(f.province).nom), AV.badge("Consentement non accordé", "warn"), "—", "—", "—"];
      const b = AV.activeBande(f), c = b ? AV.calc(b) : null;
      return [e(f.id), farmLink(f), e(AV.province(f.province).nom), AV.badge("Consentement accordé", "ok"), c ? n(c.presents, 0) : "—", c ? pc(c.mortalite) : "—", c ? n(c.poidsVif, 0) + " kg" : "—"];
    });
    return page("Fermes financées par la BCEG", "Vous ne voyez que les fermes financées, et seulement avec le consentement révocable de l'exploitant.",
      card("", AV.table(["Identifiant", "Ferme", "Province", "Consentement", "Effectif présent", "Mortalité", "Poids vif produit"], rows)) +
      `<p class="note">Revenus et ventes : suivi économique prévu en phase 2. La domiciliation des revenus (visible de la BCEG seule) est un point à arbitrer.</p>`);
  };

  // ---------- abattoir ----------
  AV.views.abattoir = () => {
    const ops = S().operateurs.filter((o) => o.type === "Abattoir" && o.convention);
    const cur = S().ui.opId;
    const lots = S().lots.filter((l) => l.destId === cur).slice().reverse();
    return page("Réception des lots à l'abattoir", "Scannez le QR code du lot, vérifiez la concordance avec la sortie de ferme, puis validez.",
      `<div class="filters">${F.select("op", "Opérateur", ops.map((o) => [o.id, o.nom]), cur).replace("<select", '<select data-change="op"')}</div>` +
      card("", AV.table(["Lot", "Ferme", "Annoncé", "Reçu", "Écart", "Statut", ""], lots.map((l) => [e(l.id), farmLinkId(l.fermeId), n(l.n, 0) + " têtes · " + n(l.kg, 0) + " kg", l.recu ? n(l.recu.n, 0) + " têtes" : "—", l.recu ? (l.recu.flag ? AV.badge(pc(l.recu.ecartPct) + " · signalé", "bad") : pc(l.recu.ecartPct)) : "—", AV.statutBadge(l.statut), l.clos ? "" : `<button class="btn primary sm" data-act="reception" data-id="${e(l.id)}">${l.recu ? "Revoir" : "Valider la réception"}</button>`]), { empty: "Aucun lot cédé à cet opérateur." })) +
      `<p class="note">Écart = annoncé − reçu, signalé au-delà de ${P().seuilEcartAbattoir} %. Un abattoir n'a de compte actif qu'après signature de la convention (aucun compte sans convention).</p>`);
  };

  // ---------- journal (ANINF) ----------
  AV.views.journal = () => {
    const q = (S().ui.journalQ || "").toLowerCase();
    let rows = S().journal.slice().reverse();
    if (q) rows = rows.filter((j) => (j.action + " " + j.detail + " " + j.role).toLowerCase().includes(q));
    return page("Journal des opérations", "Journal non modifiable : qui a saisi ou modifié quoi, et quand. Aucune action de modification ou de suppression n'est offerte.",
      `<div class="filters"><label class="fld grow"><span>Rechercher</span><input type="search" data-change="journalQ" value="${e(S().ui.journalQ || "")}" placeholder="ferme, action, profil…"></label><button class="btn primary" data-act="exportJournal">Exporter en CSV</button></div>` +
      card("", AV.table(["Date", "Profil", "Opération", "Détail"], rows.slice(0, 200).map((j) => [AV.fmtTime(j.t), e((AV.ROLES[j.role] || { nom: j.role }).nom), e(j.action), e(j.detail)]), { empty: "Aucune entrée." }) + `<p class="note">${rows.length} entrée(s)${rows.length > 200 ? " · 200 plus récentes affichées, l'export contient tout" : ""}.</p>`));
  };

  // ---------- page publique (consommateur) ----------
  AV.resolveLot = (id, payload) => {
    const l = AV.lotById(id);
    if (l) return l.clos ? { status: "closed" } : { status: "ok", data: AV.lotPublic(l), demo: false };
    const d = payload ? AV.decodePayload(payload) : null;
    if (d && d.id === id) return d.c ? { status: "closed" } : { status: "ok", data: d, demo: true };
    return { status: "unknown" };
  };
  AV.views.scan = () => {
    const ok = S().lots.filter((l) => !l.clos && l.recu).slice(0, 3);
    const clos = S().lots.find((l) => l.clos);
    return `<div class="pubwrap"><div class="pubhead"><span class="pubtag">Consommons Gabonais</span><h1>Vérifiez l'origine de votre poulet</h1><p>Scannez le QR code sur l'étiquette, ou saisissez le code du lot.</p></div>
      <div class="card"><form data-form="scan" class="inline">${F.input("id", "Code du lot", { attrs: 'placeholder="ex. EST-001-B01-L01" autocapitalize="characters"' })}${F.btn("Vérifier")}</form>
      <p class="cta"><button class="btn ghost" data-act="camera">Scanner avec la caméra</button></p><div id="camwrap" hidden><video id="cam" playsinline muted></video></div></div>
      <div class="card"><h2>Essayer avec des lots d'exemple</h2><div class="chips">${ok.map((l) => `<a class="chip link" href="#/p/${l.id}">${e(l.id)}</a>`).join("")}${clos ? `<a class="chip link bad" href="#/p/${clos.id}">${e(clos.id)} (lot clos)</a>` : ""}<a class="chip link bad" href="#/p/XXX-000-B00-L00">QR inconnu</a></div></div>
      <p class="note center"><a href="#/">← Retour à la démonstration</a></p></div>`;
  };
  AV.views.p = (id, payload) => {
    const r = AV.resolveLot(id, payload);
    const back = `<p class="note center"><a href="#/scan">← Scanner un autre lot</a></p>`;
    if (r.status !== "ok") {
      const closed = r.status === "closed";
      return `<div class="pubwrap"><div class="verdict bad"><div class="v-ic">✕</div><h1>${closed ? "Lot clos" : "QR code non reconnu"}</h1><p>${closed ? "Ce lot n'est plus valide : son identifiant est clos." : "Ce code n'existe pas dans le système de traçabilité. Ne vous y fiez pas."}</p></div>${back}</div>`;
    }
    const d = r.data, validated = d.s === "Réception validée";
    const step = (ok, title, text) => `<li class="${ok ? "done" : "todo"}"><b>${title}</b><span>${text}</span></li>`;
    return `<div class="pubwrap"><div class="verdict ${validated ? "ok" : "partial"}"><div class="v-ic">${validated ? "✓" : "…"}</div><h1>${validated ? "Poulet d'origine gabonaise" : "Origine enregistrée"}</h1><p>${validated ? "Traçabilité validée : l'origine est confirmée par des événements vérifiables." : "Traçabilité partielle : la réception à l'abattoir n'est pas encore validée."}</p></div>
      <div class="card"><h2>Lot ${e(d.id)}</h2><dl class="dl"><dt>Producteur</dt><dd>${e(d.f)}</dd><dt>Localité</dt><dd>${e(d.l)}</dd><dt>Province</dt><dd>${e(d.p)}</dd><dt>Durée d'élevage</dt><dd>${d.du} jours</dd><dt>Sortie de ferme</dt><dd>${AV.fmtDate(d.d)}</dd></dl></div>
      <div class="card"><h2>Le parcours du lot</h2><ol class="tl">${step(true, "Élevage", `${e(d.f)}, ${e(d.p)}`)}${step(true, "Cession", `Remis à ${e(d.t)} le ${AV.fmtDate(d.d)}`)}${step(validated, "Réception à l'abattoir", validated ? "Réception validée le " + AV.fmtDate(d.r) : "En attente de validation")}${step(false, "Distribution", "Bientôt disponible")}</ol></div>
      ${r.demo ? `<p class="note center">Mode démonstration : données lues dans le QR code. En production, le serveur central vérifie chaque scan.</p>` : ""}
      <p class="disc">Ce QR code n'est pas un certificat sanitaire. Il atteste de l'origine et du parcours du lot, pas de sa qualité sanitaire.</p>${back}</div>`;
  };
})();
