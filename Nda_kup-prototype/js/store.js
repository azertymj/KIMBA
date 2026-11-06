/* Ndakup — état, calculs, règles de gestion et actions */
(function () {
  const AV = window.AV;
  const KEY = "Ndakup-proto-v1";

  // ---------- dates ----------
  AV.pad = (n, l = 2) => String(n).padStart(l, "0");
  AV.iso = (d) => `${d.getFullYear()}-${AV.pad(d.getMonth() + 1)}-${AV.pad(d.getDate())}`;
  AV.today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  AV.todayISO = () => AV.iso(AV.today());
  AV.addDays = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return AV.iso(new Date(y, m - 1, d + n)); };
  AV.diffDays = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);
  AV.fmtDate = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");
  AV.fmtTime = (t) => new Date(t).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

  // ---------- formules paramétrables (jamais codées en dur) ----------
  AV.FORMULA_VARS = ["morts_cumules", "mis_en_place", "poids_moyen", "poids_initial", "age_jours", "aliment_total", "poids_vif_produit"];
  AV.evalFormula = function (expr, vars) {
    if (!/^[\w\s+\-*/().,]*$/.test(expr)) throw new Error("Caractères non autorisés");
    const names = Object.keys(vars);
    const allowed = new Set(names.concat(["min", "max", "abs", "round"]));
    (expr.match(/[A-Za-z_]\w*/g) || []).forEach((id) => { if (!allowed.has(id)) throw new Error("Variable inconnue : " + id); });
    const fn = new Function(...names, "min", "max", "abs", "round", '"use strict"; return (' + expr + ");");
    const v = fn(...names.map((n) => vars[n]), Math.min, Math.max, Math.abs, Math.round);
    if (typeof v !== "number" || !isFinite(v)) return null;
    return v;
  };
  const safeEval = (expr, vars) => { try { return AV.evalFormula(expr, vars); } catch (e) { return null; } };

  // ---------- état ----------
  AV.load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch (e) {} return null; };
  AV.save = () => { try { localStorage.setItem(KEY, JSON.stringify(AV.state)); } catch (e) {} };
  AV.index = () => { AV.fmap = new Map(AV.state.fermes.map((f) => [f.id, f])); };
  AV.init = () => {
    AV.state = AV.load() || AV.seed();
    AV.state.ui.offline = typeof navigator !== "undefined" && navigator.onLine === false;
    AV.index();
  };
  AV.reset = () => { try { localStorage.removeItem(KEY); } catch (e) {} AV.state = AV.seed(); AV.index(); AV.save(); };
  AV.log = (action, detail) => AV.state.journal.push({ t: new Date().toISOString(), role: AV.state.ui.role || "public", action, detail });
  AV.farm = (id) => AV.fmap.get(id);
  AV.operateur = (id) => AV.state.operateurs.find((o) => o.id === id);
  AV.province = (code) => AV.PROVINCES.find((p) => p.code === code);
  AV.activeBande = (f) => f.bandes.find((b) => b.statut === "En cours") || null;
  AV.lastBande = (f) => f.bandes[f.bandes.length - 1] || null;
  AV.bandeAge = (b) => (b.statut === "En cours" ? AV.diffDays(b.debut, AV.todayISO()) + 1 : b.bilan ? b.bilan.age : AV.diffDays(b.debut, b.fin) + 1);

  // ---------- séries et indicateurs ----------
  AV.series = (b) => {
    const js = b.jours.slice().sort((x, y) => (x.date < y.date ? -1 : 1));
    return js.map((x) => {
      const before = b.misEnPlace
        - js.filter((y) => y.date < x.date).reduce((s, y) => s + y.morts, 0)
        - b.sorties.filter((s) => s.date < x.date).reduce((s, y) => s + y.n, 0);
      return { date: x.date, j: AV.diffDays(b.debut, x.date) + 1, morts: x.morts, aliment: x.aliment, effAvant: before, pct: before > 0 ? (x.morts / before) * 100 : 0, sync: x.sync };
    });
  };

  AV.calc = function (b, P) {
    P = P || AV.state.params;
    const morts = b.jours.reduce((s, x) => s + x.morts, 0);
    const sortN = b.sorties.reduce((s, x) => s + x.n, 0);
    const sortKg = b.sorties.reduce((s, x) => s + x.kg, 0);
    const presents = b.misEnPlace - morts - sortN;
    const pes = b.pesees.slice().sort((a, c) => (a.date < c.date ? -1 : 1));
    const last = pes[pes.length - 1];
    const poidsMoyen = last ? last.poids : b.poidsInitial;
    const ageP = last ? last.age : 1;
    const aliment = b.jours.reduce((s, x) => s + x.aliment, 0);
    const poidsVif = sortKg + (presents * poidsMoyen) / 1000 - (b.misEnPlace * b.poidsInitial) / 1000;
    const base = { morts_cumules: morts, mis_en_place: b.misEnPlace, poids_moyen: poidsMoyen, poids_initial: b.poidsInitial, age_jours: ageP, aliment_total: aliment, poids_vif_produit: poidsVif };
    const out = { morts, sortN, sortKg, presents, poidsMoyen, aliment, poidsVif, age: AV.bandeAge(b) };
    out.mortalite = safeEval(P.formules.mortalite, base);
    out.viabilite = safeEval(P.formules.viabilite, Object.assign({}, base, { mortalite: out.mortalite }));
    out.gmq = last ? safeEval(P.formules.gmq, base) : null;
    out.ic = last && poidsVif > 0 ? safeEval(P.formules.ic, base) : null;
    if (out.ic !== null && out.ic <= 0) out.ic = null;
    // complétude : jours saisis / jours écoulés
    const today = AV.todayISO();
    const lastRec = b.jours.reduce((m, x) => (x.date > m ? x.date : m), "");
    const lastDay = b.statut === "En cours" ? (lastRec > AV.addDays(today, -1) ? lastRec : AV.addDays(today, -1)) : b.fin || today;
    const ecoules = Math.max(1, AV.diffDays(b.debut, lastDay) + 1);
    out.completude = Math.min(100, (b.jours.length / ecoules) * 100);
    const ser = AV.series(b);
    out.pctDernier = ser.length ? ser[ser.length - 1].pct : 0;
    out.lastPesee = last || null;
    // intrants
    const recu = b.intrants.filter((i) => i.type === "Aliment").reduce((s, i) => s + i.qte, 0);
    out.alimRecu = recu;
    out.alimStockTheo = recu - aliment;
    out.alimStockCompte = b.stockDeclare;
    out.ecartIntrants = recu > 0 ? ((recu - aliment - b.stockDeclare) / recu) * 100 : 0;
    return out;
  };

  // statistiques de toutes les fermes ayant une bande en cours
  AV.allStats = () => AV.state.fermes.filter((f) => AV.activeBande(f)).map((f) => { const b = AV.activeBande(f); return { f, b, c: AV.calc(b) }; });

  // ---------- visibilité (cloisonnement) ----------
  AV.canSeeFarm = (role, f) => {
    if (!f) return false;
    if (role === "dge") return true;
    if (role === "eleveur") return f.id === AV.state.ui.fermeId;
    if (role === "agent") return f.province === "EST";
    if (role === "bceg") return f.financee && f.consent;
    return false;
  };
  AV.visibleFermes = (role) => AV.state.fermes.filter((f) => AV.canSeeFarm(role, f));

  // ---------- hors connexion ----------
  const syncables = (f) => {
    const out = [];
    f.bandes.forEach((b) => ["jours", "pesees", "sorties", "vaccins", "traitements", "intrants"].forEach((k) => (b[k] || []).forEach((x) => out.push(x))));
    return out;
  };
  AV.pending = () => {
    let n = 0;
    AV.state.fermes.forEach((f) => syncables(f).forEach((x) => { if (x.sync === false) n++; }));
    AV.state.declarations.forEach((d) => { if (d.sync === false) n++; });
    AV.state.alertes.forEach((a) => { if (a.pending) n++; });
    return n;
  };
  AV.sync = () => {
    let n = 0;
    AV.state.fermes.forEach((f) => syncables(f).forEach((x) => { if (x.sync === false) { x.sync = true; n++; } }));
    AV.state.declarations.forEach((d) => { if (d.sync === false) { d.sync = true; n++; } });
    AV.state.alertes.forEach((a) => { if (a.pending) { a.pending = false; n++; } });
    if (n) AV.log("Synchronisation", `${n} saisie(s) envoyée(s) au serveur après retour du réseau`);
    AV.save();
    return n;
  };
  const syncFlag = () => !AV.state.ui.offline;

  // ---------- actions métier ----------
  AV.act = {};
  const bad = (msg) => ({ ok: false, msg });

  AV.createAlerte = (f, b, { type, detail, pct, date }) => {
    const a = {
      id: `AL-${AV.pad(AV.state.alertes.length + 1, 4)}`, fermeId: f.id, bandeId: b.id, date, type, detail, pct: pct || 0,
      statut: "Nouvelle", publiee: false, pending: AV.state.ui.offline,
      hist: [{ t: new Date().toISOString(), statut: "Nouvelle", par: "Système", note: "Alerte automatique" }],
    };
    AV.state.alertes.push(a);
    AV.log("Alerte précoce", `${a.id} · ${f.id} · ${type}${a.pending ? " (en attente de synchronisation)" : ""}`);
    return a;
  };

  AV.act.saisieJour = (fid, { date, morts, aliment }) => {
    const f = AV.farm(fid), b = AV.activeBande(f);
    if (!b) return bad("Aucune bande en cours : ouvrez d'abord une bande.");
    const today = AV.todayISO();
    if (!date || date < b.debut || date > today) return bad(`La date doit être comprise entre le ${AV.fmtDate(b.debut)} et aujourd'hui.`);
    if (b.jours.some((x) => x.date === date)) return bad("Une saisie existe déjà pour cette date : le doublon est bloqué.");
    morts = Number(morts); aliment = Number(aliment);
    if (!Number.isInteger(morts) || morts < 0) return bad("Le nombre de morts doit être un entier positif ou nul.");
    if (!(aliment >= 0)) return bad("La quantité d'aliment doit être positive ou nulle.");
    const eff = b.misEnPlace - b.jours.filter((x) => x.date < date).reduce((s, x) => s + x.morts, 0) - b.sorties.filter((s) => s.date < date).reduce((s, x) => s + x.n, 0);
    if (morts > eff) return bad(`Contrôle de cohérence : ${morts} morts saisis pour un effectif présent de ${eff}.`);
    b.jours.push({ date, morts, aliment, sync: syncFlag() });
    b.stockDeclare = Math.round((b.stockDeclare - aliment) * 10) / 10;
    const pct = eff > 0 ? (morts / eff) * 100 : 0;
    AV.log("Saisie fiche d'élevage", `${f.id} · ${AV.fmtDate(date)} · ${morts} mort(s) · ${aliment} kg d'aliment${AV.state.ui.offline ? " (hors ligne)" : ""}`);
    let alerte = null;
    if (pct > AV.state.params.seuilMortJour) {
      alerte = AV.createAlerte(f, b, { type: "Mortalité anormale", detail: `Mortalité du jour ${pct.toFixed(2)} % de l'effectif présent (seuil ${AV.state.params.seuilMortJour} %)`, pct, date });
    }
    AV.save();
    return { ok: true, pct, alerte, stockNeg: b.stockDeclare < 0 };
  };

  AV.act.pesee = (fid, { date, n, poids }) => {
    const f = AV.farm(fid), b = AV.activeBande(f);
    if (!b) return bad("Aucune bande en cours.");
    n = Number(n); poids = Number(poids);
    if (!date || date < b.debut || date > AV.todayISO()) return bad("Date de pesée hors de la bande.");
    if (b.pesees.some((p) => p.date === date)) return bad("Une pesée existe déjà pour cette date.");
    if (!Number.isInteger(n) || n < 1) return bad("Indiquez le nombre d'animaux pesés.");
    if (!(poids > 0 && poids <= 6000)) return bad("Le poids moyen doit être compris entre 1 et 6000 g.");
    b.pesees.push({ date, age: AV.diffDays(b.debut, date) + 1, n, poids, sync: syncFlag() });
    AV.log("Pesée", `${f.id} · ${AV.fmtDate(date)} · ${n} animaux · ${poids} g en moyenne`);
    AV.save();
    return { ok: true };
  };

  AV.act.sortie = (fid, { date, n, kg, destId, motif }) => {
    const f = AV.farm(fid), b = AV.activeBande(f);
    if (!b) return bad("Aucune bande en cours.");
    n = Number(n); kg = Number(kg);
    const c = AV.calc(b);
    if (!date || date < b.debut || date > AV.todayISO()) return bad("Date de sortie hors de la bande.");
    if (!Number.isInteger(n) || n < 1) return bad("Indiquez le nombre d'animaux sortis.");
    if (n > c.presents) return bad(`Contrôle de cohérence : ${n} sorties pour un effectif présent de ${c.presents}.`);
    if (!(kg > 0)) return bad("Indiquez le poids total sorti (kg).");
    if (!destId) return bad("Le destinataire est obligatoire pour toute cession.");
    const ordre = b.sorties.length + 1;
    const lotId = `${b.id}-L${AV.pad(ordre)}`;
    b.sorties.push({ date, n, kg, motif, destId, lot: lotId, sync: syncFlag() });
    const lot = { id: lotId, fermeId: f.id, bandeId: b.id, ordre, date, n, kg, destId, motif, duree: AV.diffDays(b.debut, date) + 1, statut: "Cédé", clos: false, recu: null };
    AV.state.lots.push(lot);
    AV.log("Cession de lot", `${lotId} · ${n} animaux · ${kg} kg → ${AV.operateur(destId).nom}`);
    if (c.presents - n === 0) AV.act.cloturer(fid);
    AV.save();
    return { ok: true, lot };
  };

  AV.act.cloturer = (fid) => {
    const f = AV.farm(fid), b = AV.activeBande(f);
    if (!b) return bad("Aucune bande en cours.");
    b.bilan = AV.calc(b);
    b.statut = "Clôturée";
    b.fin = AV.todayISO();
    AV.log("Clôture de bande", `${b.id} · mortalité ${b.bilan.mortalite == null ? "—" : b.bilan.mortalite.toFixed(1)} % · IC ${b.bilan.ic == null ? "—" : b.bilan.ic.toFixed(2)}`);
    AV.save();
    return { ok: true };
  };

  AV.act.ouvrirBande = (fid, { date, n }) => {
    const f = AV.farm(fid);
    if (AV.activeBande(f)) return bad("Une bande est déjà en cours.");
    n = Number(n);
    if (!date || date > AV.todayISO()) return bad("La date de réception ne peut pas être dans le futur.");
    if (!Number.isInteger(n) || n < 1) return bad("Indiquez le nombre de poussins reçus.");
    if (n > f.capacite) return bad(`Le nombre de poussins dépasse la capacité de la ferme (${f.capacite}).`);
    const rang = f.bandes.reduce((m, b) => Math.max(m, b.rang), 0) + 1;
    const b = {
      id: `${f.id}-B${AV.pad(rang)}`, rang, debut: date, misEnPlace: n, poidsInitial: 42, statut: "En cours",
      jours: [], pesees: [], sorties: [], vaccins: [], traitements: [],
      intrants: [{ date, type: "Poussins", produit: "Poussins de chair", qte: n, unite: "têtes", subv: true, sync: syncFlag() }],
      stockDeclare: 0,
    };
    f.bandes.push(b);
    AV.log("Ouverture de bande", `${b.id} · ${n} poussins · réception le ${AV.fmtDate(date)}`);
    AV.save();
    return { ok: true };
  };

  AV.act.intrantRecu = (fid, { date, type, produit, qte, unite, subv }) => {
    const f = AV.farm(fid), b = AV.activeBande(f);
    if (!b) return bad("Aucune bande en cours.");
    qte = Number(qte);
    if (!(qte > 0)) return bad("Indiquez une quantité positive.");
    b.intrants.push({ date, type, produit, qte, unite, subv: !!subv, sync: syncFlag() });
    if (type === "Aliment") b.stockDeclare = Math.round((b.stockDeclare + qte) * 10) / 10;
    AV.log("Réception d'intrant", `${f.id} · ${type} · ${produit} · ${qte} ${unite}`);
    AV.save();
    return { ok: true };
  };

  AV.act.stockCompte = (fid, { qte }) => {
    const f = AV.farm(fid), b = AV.activeBande(f);
    if (!b) return bad("Aucune bande en cours.");
    qte = Number(qte);
    if (!(qte >= 0)) return bad("Indiquez le stock compté sur place (kg).");
    b.stockDeclare = qte;
    AV.log("Stock d'aliment compté", `${f.id} · ${qte} kg`);
    AV.save();
    return { ok: true };
  };

  AV.act.declaration = (fid, { type, signes, n, note, date }) => {
    const f = AV.farm(fid), b = AV.activeBande(f) || AV.lastBande(f);
    n = Number(n);
    if (!(n >= 0)) return bad("Indiquez le nombre d'animaux touchés.");
    if (!signes.length && !note) return bad("Cochez au moins un signe clinique ou décrivez la situation.");
    const d = { id: `DS-${AV.pad(AV.state.declarations.length + 1, 4)}`, fermeId: f.id, bandeId: b ? b.id : "—", date, type, signes, n, note, sync: syncFlag() };
    AV.state.declarations.push(d);
    AV.log("Déclaration sanitaire", `${d.id} · ${f.id} · ${type} · ${n} animaux`);
    const a = AV.createAlerte(f, b || { id: "—" }, { type: "Déclaration sanitaire", detail: `${type} — ${signes.join(", ") || note}`, pct: 0, date });
    AV.save();
    return { ok: true, alerte: a };
  };

  AV.act.vaccin = (fid, { date, vaccin, n }) => {
    const f = AV.farm(fid), b = AV.activeBande(f);
    if (!b) return bad("Aucune bande en cours.");
    n = Number(n);
    if (!(n > 0)) return bad("Indiquez le nombre d'animaux vaccinés.");
    b.vaccins.push({ date, vaccin, n, sync: syncFlag() });
    AV.log("Vaccination", `${f.id} · ${vaccin} · ${n} animaux`);
    AV.save();
    return { ok: true };
  };

  AV.act.traitement = (fid, { debut, fin, produit, motif, n }) => {
    const f = AV.farm(fid), b = AV.activeBande(f);
    if (!b) return bad("Aucune bande en cours.");
    n = Number(n);
    if (!produit) return bad("Indiquez le produit utilisé.");
    if (fin && fin < debut) return bad("La date de fin précède la date de début.");
    b.traitements.push({ debut, fin, produit, motif, n, sync: syncFlag() });
    AV.log("Traitement", `${f.id} · ${produit} · ${motif || "—"}`);
    AV.save();
    return { ok: true };
  };

  // alertes : circuit Nouvelle → En analyse → Confirmée/Infirmée → Close
  AV.ALERT_FLOW = { Nouvelle: ["En analyse"], "En analyse": ["Confirmée", "Infirmée"], Confirmée: ["Close"], Infirmée: ["Close"], Close: [] };
  AV.act.alerteStatut = (id, statut, note) => {
    const a = AV.state.alertes.find((x) => x.id === id);
    if (!a) return bad("Alerte introuvable.");
    if (AV.state.ui.role !== "vet") return bad("Seuls les services vétérinaires peuvent qualifier une alerte.");
    if (!AV.ALERT_FLOW[a.statut].includes(statut)) return bad("Transition non autorisée.");
    a.statut = statut;
    a.hist.push({ t: new Date().toISOString(), statut, par: "Services vétérinaires", note: note || "" });
    if (statut === "Infirmée" || statut === "Close") a.publiee = false;
    AV.log("Qualification d'alerte", `${id} → ${statut}`);
    AV.save();
    return { ok: true };
  };
  AV.act.alertePublier = (id) => {
    const a = AV.state.alertes.find((x) => x.id === id);
    if (!a) return bad("Alerte introuvable.");
    if (AV.state.ui.role !== "vet") return bad("Seule l'autorité vétérinaire peut publier une alerte.");
    if (a.statut !== "Confirmée") return bad("Seule une alerte confirmée peut être publiée.");
    a.publiee = true;
    AV.log("Publication d'alerte", `${id} publiée par l'autorité vétérinaire`);
    AV.save();
    return { ok: true };
  };

  AV.act.consentement = (fid, val) => {
    const f = AV.farm(fid);
    f.consent = !!val;
    AV.log("Consentement BCEG", `${f.id} · consentement ${val ? "accordé" : "révoqué"}`);
    AV.save();
  };

  AV.act.operateur = ({ nom, type, loc, convention }) => {
    if (!nom) return bad("Indiquez le nom de l'opérateur.");
    if (AV.state.operateurs.some((o) => o.nom.toLowerCase() === nom.toLowerCase())) return bad("Cet opérateur existe déjà (doublon bloqué).");
    const o = { id: `OP-${AV.pad(AV.state.operateurs.length + 1)}`, nom, type, loc, convention: !!convention };
    AV.state.operateurs.push(o);
    AV.log("Registre des opérateurs", `${o.id} · ${nom} · convention ${convention ? "signée" : "non signée"}`);
    AV.save();
    return { ok: true };
  };

  AV.act.lotClos = (id, clos) => {
    const l = AV.lotById(id);
    if (!l) return bad("Lot introuvable.");
    l.clos = clos;
    l.statut = clos ? "Clos" : l.recu ? "Réception validée" : "Cédé";
    AV.log(clos ? "Clôture de lot" : "Réouverture de lot", id);
    AV.save();
    return { ok: true };
  };

  AV.act.receptionAbattoir = (id, { n, kg, constat }) => {
    const l = AV.lotById(id);
    if (!l) return bad("Lot introuvable.");
    if (l.clos) return bad("Ce lot est clos : réception impossible.");
    n = Number(n); kg = Number(kg);
    if (!Number.isInteger(n) || n < 0) return bad("Indiquez le nombre d'animaux reçus.");
    if (!(kg > 0)) return bad("Indiquez le poids reçu (kg).");
    const ecart = ((l.n - n) / l.n) * 100;
    const flag = Math.abs(ecart) > AV.state.params.seuilEcartAbattoir;
    l.recu = { date: AV.todayISO(), n, kg, ecartPct: ecart, flag, constat: constat || "" };
    l.statut = "Réception validée";
    AV.log("Réception à l'abattoir", `${id} · reçu ${n}/${l.n} · écart ${ecart.toFixed(1)} %${flag ? " (signalé)" : ""}`);
    AV.save();
    return { ok: true, flag, ecart };
  };

  // ---------- lots, QR, lecture publique ----------
  AV.lotById = (id) => AV.state.lots.find((l) => l.id === id);
  AV.lotPublic = (l) => {
    const f = AV.farm(l.fermeId);
    const pr = f ? AV.province(f.province) : null;
    const op = AV.operateur(l.destId);
    return { id: l.id, f: f ? f.nom : "?", l: f ? f.localite : "?", p: pr ? pr.nom : "?", d: l.date, n: l.n, du: l.duree, t: op ? op.nom : "?", s: l.statut, r: l.recu ? l.recu.date : "", c: l.clos ? 1 : 0 };
  };
  const b64 = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64 = (s) => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/")))));
  AV.lotURL = (l) => `${location.href.split("#")[0]}#/p/${l.id}?d=${b64(AV.lotPublic(l))}`;
  AV.decodePayload = (s) => { try { return unb64(s); } catch (e) { return null; } };
  AV.qrSVG = (text, cell = 4) => { const q = qrcode(0, "M"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: cell, margin: 2, scalable: true }); };
  AV.logScan = (id, result) => { AV.state.scans.push({ t: new Date().toISOString(), lot: id, result }); AV.save(); };

  // ---------- paramétrage ----------
  AV.testFormulas = (formules) => {
    const sample = { morts_cumules: 50, mis_en_place: 1800, poids_moyen: 1600, poids_initial: 42, age_jours: 28, aliment_total: 4200, poids_vif_produit: 2600, mortalite: 2.7 };
    const errs = {};
    Object.keys(formules).forEach((k) => {
      try {
        const vars = Object.assign({}, sample);
        if (k === "mortalite") delete vars.mortalite;
        const v = AV.evalFormula(formules[k], vars);
        if (v === null) errs[k] = "Le résultat n'est pas un nombre valide.";
      } catch (e) { errs[k] = e.message; }
    });
    return errs;
  };
})();
