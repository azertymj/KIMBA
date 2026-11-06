/* Ndakup — données de démonstration (entièrement fictives) et constantes */
(function () {
  const AV = (window.AV = window.AV || {});

  AV.PROVINCES = [
    { code: "EST", nom: "Estuaire", chef: "Libreville", lat: 0.39, lon: 9.45 },
    { code: "HOG", nom: "Haut-Ogooué", chef: "Franceville", lat: -1.63, lon: 13.58 },
    { code: "MOG", nom: "Moyen-Ogooué", chef: "Lambaréné", lat: -0.7, lon: 10.24 },
    { code: "NGO", nom: "Ngounié", chef: "Mouila", lat: -1.87, lon: 11.06 },
    { code: "NYA", nom: "Nyanga", chef: "Tchibanga", lat: -2.85, lon: 11.03 },
    { code: "OIV", nom: "Ogooué-Ivindo", chef: "Makokou", lat: 0.57, lon: 12.87 },
    { code: "OLO", nom: "Ogooué-Lolo", chef: "Koulamoutou", lat: -1.13, lon: 12.46 },
    { code: "OMA", nom: "Ogooué-Maritime", chef: "Port-Gentil", lat: -0.72, lon: 8.78 },
    { code: "WNT", nom: "Woleu-Ntem", chef: "Oyem", lat: 1.6, lon: 11.58 },
  ];

  AV.ROLES = {
    eleveur: { nom: "Éleveur", desc: "Saisit les données de sa ferme : mortalités, aliment, pesées, sorties, déclarations sanitaires." },
    agent: { nom: "Agent technique", desc: "Accompagne les fermes de sa zone et vérifie les déclarations." },
    dge: { nom: "POUFA / DGE", desc: "Pilote le programme, consulte toutes les fermes et fixe les paramètres de suivi." },
    vet: { nom: "Services vétérinaires", desc: "Fixent les seuils d'alerte, qualifient et publient les alertes." },
    bceg: { nom: "BCEG", desc: "Suit les fermes qu'elle finance, avec le consentement de l'exploitant." },
    abattoir: { nom: "Abattoir (opérateur)", desc: "Scanne et valide la réception des lots, sous convention." },
    aninf: { nom: "Auditeur ANINF", desc: "Consulte le journal non modifiable des opérations." },
  };

  AV.NAV = {
    eleveur: [["ferme", "Ma ferme"], ["saisie", "Saisie"], ["sanitaire", "Sanitaire"], ["intrants", "Intrants"], ["lots", "Lots & QR"]],
    agent: [["fermes", "Mes fermes"], ["recoupement", "Intrants"], ["classement", "Classement"]],
    dge: [["national", "Tableau de bord"], ["carte", "Carte"], ["fermes", "Fermes"], ["classement", "Classement"], ["recoupement", "Intrants"], ["tracabilite", "Traçabilité"], ["rapport", "Rapport"], ["param", "Paramétrage"]],
    vet: [["alertes", "Alertes"], ["seuils", "Seuils & calendrier"], ["carte", "Carte"]],
    bceg: [["bceg", "Fermes financées"]],
    abattoir: [["abattoir", "Réception des lots"]],
    aninf: [["journal", "Journal d'audit"]],
  };

  AV.defaultParams = () => ({
    dureeBande: 45,
    peseeFreq: 7,
    echantillon: 50,
    seuilMortJour: 1.0, // % de l'effectif présent — réglé par les seuls services vétérinaires
    seuilEcartIntrants: 5,
    seuilEcartAbattoir: 3,
    seuilMortCarte: 5,
    formules: {
      mortalite: "morts_cumules / mis_en_place * 100",
      viabilite: "100 - mortalite",
      gmq: "(poids_moyen - poids_initial) / age_jours",
      ic: "aliment_total / poids_vif_produit",
    },
    calendrierVaccinal: [
      { jour: 7, vaccin: "Newcastle + Bronchite infectieuse" },
      { jour: 14, vaccin: "Gumboro" },
      { jour: 21, vaccin: "Newcastle (rappel)" },
    ],
    classement: { mortalite: 40, ic: 30, gmq: 20, regularite: 10 },
    listes: {
      motifs: ["Vente", "Abattoir", "Autre"],
      signes: ["Difficultés respiratoires", "Diarrhée", "Baisse de consommation", "Abattement / plumes ébouriffées", "Signes nerveux (torticolis)", "Gonflement de la tête"],
    },
  });

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const SURN = ["Moussavou", "Nzamba", "Ndong", "Obame", "Ondo", "Mintsa", "Nguema", "Mouketou", "Bivigou", "Ekomi", "Mabika", "Ntoutoume", "Boussougou", "Ngoma", "Mavoungou", "Mba", "Oyane", "Bekale", "Mengue", "Allogo", "Koumba", "Nzigou", "Ndjoubi", "Mounguengui", "Ayingone", "Mikolo", "Biyoghe", "Ndembet", "Issembe", "Mapangou"];
  const FIRST = ["Jean", "Marie", "Pierre", "Chantal", "Rodrigue", "Arlette", "Brice", "Sandrine", "Hervé", "Josiane", "Paul", "Estelle", "Luc", "Nadège", "Franck", "Carine", "Serge", "Prisca"];
  const INFRA = ["Poulailler", "Magasin d'aliment", "Point d'eau", "Clôture", "Pédiluve", "Groupe électrogène"];

  const W = (j) => 2400 / (1 + Math.exp(-(j - 24) / 7)); // courbe de croissance de référence (g)
  AV.refWeight = W;

  function genBande(rnd, f, rang, mis, age, start, o) {
    const jours = [];
    let eff = mis;
    for (let j = 1; j <= age; j++) {
      const p = (j <= 7 ? 0.0018 : 0.0005) * o.mm * (0.5 + rnd());
      let morts = Math.round(eff * p + (rnd() < 0.25 ? rnd() : 0));
      if (o.spike && j === age) morts = Math.round(eff * (0.025 + rnd() * 0.015));
      morts = Math.min(morts, eff);
      const feed = Math.round((eff * (12 + 2.2 * j) * 1.4 * o.ff) / 1000);
      eff -= morts;
      if (j === age || rnd() < o.reg) jours.push({ date: AV.addDays(start, j - 1), morts, aliment: feed, sync: true });
    }
    const pesees = [];
    [7, 14, 21, 28, 35, 42].forEach((j) => {
      if (j <= age) {
        pesees.push({ date: AV.addDays(start, j - 1), age: j, n: 50, poids: Math.round(W(j) * o.wf * (0.97 + rnd() * 0.06)), sync: true });
      }
    });
    const vaccins = [];
    AV.defaultParams().calendrierVaccinal.forEach((c) => {
      if (c.jour <= age && (rnd() < 0.92 || o.cleanStock)) vaccins.push({ date: AV.addDays(start, c.jour - 1), vaccin: c.vaccin, n: mis, sync: true });
    });
    const alimTot = jours.reduce((s, x) => s + x.aliment, 0);
    const recu = Math.round((mis * 4.0 * o.ff) / 100) * 100;
    const leak = o.cleanStock ? recu * 0.01 : rnd() < 0.12 ? recu * (0.06 + rnd() * 0.08) : recu * rnd() * 0.02;
    return {
      id: `${f.id}-B${String(rang).padStart(2, "0")}`,
      rang, debut: start, misEnPlace: mis, poidsInitial: 42, statut: "En cours",
      jours, pesees, sorties: [], vaccins, traitements: [],
      intrants: [
        { date: start, type: "Poussins", produit: "Poussins de chair", qte: mis, unite: "têtes", subv: true, sync: true },
        { date: start, type: "Aliment", produit: "Aliment démarrage / croissance", qte: recu, unite: "kg", subv: true, sync: true },
        { date: start, type: "Vaccins", produit: "Kit vaccins", qte: 3, unite: "boîtes", subv: true, sync: true },
      ],
      stockDeclare: Math.round(recu - alimTot - leak),
    };
  }

  AV.seed = function () {
    const rnd = mulberry32(20261106);
    const today = AV.todayISO();
    const params = AV.defaultParams();

    const operateurs = [
      { id: "OP-01", nom: "Abattoir démo Libreville", type: "Abattoir", loc: "Libreville", convention: true },
      { id: "OP-02", nom: "Abattoir démo Port-Gentil", type: "Abattoir", loc: "Port-Gentil", convention: true },
      { id: "OP-03", nom: "Abattoir démo Franceville", type: "Abattoir", loc: "Franceville", convention: false },
      { id: "OP-04", nom: "Distributeur démo Libreville", type: "Distributeur", loc: "Libreville", convention: true },
      { id: "OP-05", nom: "Acheteur démo (restauration)", type: "Acheteur", loc: "Libreville", convention: true },
      { id: "OP-06", nom: "Grossiste démo Oyem", type: "Distributeur", loc: "Oyem", convention: true },
    ];

    const quota = { EST: 30, HOG: 16, MOG: 14, NGO: 14, NYA: 12, OIV: 14, OLO: 14, OMA: 12, WNT: 24 };
    const order = [];
    AV.PROVINCES.forEach((pr) => { for (let i = 1; i <= quota[pr.code]; i++) order.push({ pr, i }); });

    const others = order.map((_, i) => i).filter((i) => i > 0);
    shuffle(others, rnd);
    const opSet = new Set([0].concat(others.slice(0, 78)));
    const spikeFarms = new Set(others.filter((i) => opSet.has(i)).slice(0, 5));

    const usedNames = new Set();
    const fermes = [];
    order.forEach((o, k) => {
      const id = `${o.pr.code}-${String(o.i).padStart(3, "0")}`;
      const sn = SURN[Math.floor(rnd() * SURN.length)];
      const fn = FIRST[Math.floor(rnd() * FIRST.length)];
      let nom = `Ferme ${sn}`;
      if (usedNames.has(nom)) nom = `Ferme ${sn} ${fn.charAt(0)}.`;
      let n = 2;
      while (usedNames.has(nom)) nom = `Ferme ${sn} ${fn.charAt(0)}.${n++}`;
      usedNames.add(nom);
      const infra = INFRA.filter(() => rnd() < 0.6);
      if (!infra.includes("Poulailler")) infra.unshift("Poulailler");
      const f = {
        id, nom, exploitant: `${fn} ${sn}`, province: o.pr.code,
        localite: rnd() < 0.5 ? o.pr.chef : `${o.pr.chef} — zone rurale`,
        lat: +(o.pr.lat + (rnd() - 0.5) * 0.6).toFixed(4),
        lon: +(o.pr.lon + (rnd() - 0.5) * 0.6).toFixed(4),
        capacite: Math.round((500 + rnd() * 4500) / 100) * 100,
        infra, ami: `AMI-${String(k + 1).padStart(4, "0")}`,
        cohorte: opSet.has(k) ? 1 : 2,
        statut: opSet.has(k) ? "Opérationnelle" : "En préparation",
        financee: rnd() < 0.3, consent: false, bandes: [],
      };
      if (f.financee) f.consent = rnd() < 0.8;
      if (k === 0) {
        f.nom = "Ferme Moussavou"; f.exploitant = "Chantal Moussavou"; f.capacite = 2000;
        f.localite = "Libreville"; f.lat = 0.4162; f.lon = 9.4673; f.financee = true; f.consent = true;
        f.infra = ["Poulailler", "Magasin d'aliment", "Point d'eau", "Clôture", "Pédiluve"];
      }
      if (opSet.has(k)) {
        const age = k === 0 ? 30 : 3 + Math.floor(rnd() * 41);
        const mis = k === 0 ? 1800 : Math.round((f.capacite * (0.7 + rnd() * 0.3)) / 10) * 10;
        const start = AV.addDays(today, -age);
        const b = genBande(rnd, f, 2, mis, age, start, {
          mm: k === 0 ? 0.85 : 0.6 + rnd() * 1.0, ff: 0.95 + rnd() * 0.15, wf: 0.9 + rnd() * 0.18,
          reg: k === 0 ? 1 : 0.7 + rnd() * 0.3, spike: spikeFarms.has(k), cleanStock: k === 0,
        });
        f.bandes.push(b);
        f._spike = spikeFarms.has(k);
      }
      fermes.push(f);
    });

    // Ferme de démonstration : bande précédente clôturée (historique)
    const demo = fermes[0];
    const b1start = AV.addDays(today, -85);
    const b1 = genBande(rnd, demo, 1, 1700, 45, b1start, { mm: 0.9, ff: 1, wf: 1, reg: 1, spike: false, cleanStock: true });
    b1.statut = "Clôturée";
    b1.fin = AV.addDays(b1start, 44);
    b1.stockDeclare = 0;
    const lastW = b1.pesees[b1.pesees.length - 1].poids;
    const mortsB1 = b1.jours.reduce((s, x) => s + x.morts, 0);
    const vivants = 1700 - mortsB1;
    const n1 = Math.round(vivants * 0.6), n2 = vivants - n1;
    b1.sorties.push({ date: AV.addDays(b1start, 43), n: n1, kg: Math.round((n1 * lastW) / 1000), motif: "Abattoir", destId: "OP-01", lot: `${b1.id}-L01`, sync: true });
    b1.sorties.push({ date: AV.addDays(b1start, 44), n: n2, kg: Math.round((n2 * lastW) / 1000), motif: "Vente", destId: "OP-04", lot: `${b1.id}-L02`, sync: true });
    b1.bilan = Object.assign({}, AV.calc(b1, params), { age: 45 });
    demo.bandes.unshift(b1);

    // Lots
    const lots = [];
    const mkLot = (f, bandeId, ordre, date, n, kg, destId, motif, statut) => ({
      id: `${bandeId}-L${String(ordre).padStart(2, "0")}`, fermeId: f.id, bandeId, ordre, date, n, kg, destId, motif,
      duree: 45, statut, clos: false, recu: null,
    });
    const lotA = mkLot(demo, b1.id, 1, b1.sorties[0].date, n1, b1.sorties[0].kg, "OP-01", "Abattoir", "Réception validée");
    lotA.recu = { date: AV.addDays(lotA.date, 1), n: lotA.n - 2, kg: lotA.kg - 3, ecartPct: (2 / lotA.n) * 100, flag: false };
    lots.push(lotA, mkLot(demo, b1.id, 2, b1.sorties[1].date, n2, b1.sorties[1].kg, "OP-04", "Vente", "Cédé"));

    const opFarms = fermes.filter((f) => f.bandes.length && f.id !== demo.id);
    shuffle(opFarms, rnd).slice(0, 34).forEach((f, i) => {
      const bid = `${f.id}-B01`;
      const n = Math.round((f.capacite * 0.85) / 10) * 10;
      const dest = ["OP-01", "OP-02", "OP-04", "OP-05", "OP-06"][Math.floor(rnd() * 5)];
      const l = mkLot(f, bid, 1, AV.addDays(today, -(20 + Math.floor(rnd() * 25))), n, Math.round(n * 2.25), dest, dest === "OP-05" ? "Vente" : "Abattoir", rnd() < 0.7 ? "Réception validée" : "Cédé");
      if (l.statut === "Réception validée") l.recu = { date: AV.addDays(l.date, 1), n: l.n - Math.floor(rnd() * 8), kg: l.kg, ecartPct: rnd() * 1.5, flag: false };
      if (i === 0) { l.clos = true; l.statut = "Clos"; } // lot clos : démonstration du rejet à la lecture
      lots.push(l);
    });

    // Alertes
    const alertes = [];
    const statuts = ["Nouvelle", "En analyse", "Confirmée", "Nouvelle", "Infirmée"];
    fermes.filter((f) => f._spike).forEach((f, i) => {
      const b = f.bandes[0];
      const s = AV.series(b);
      const last = s[s.length - 1];
      const st = statuts[i % statuts.length];
      const a = {
        id: `AL-${String(alertes.length + 1).padStart(4, "0")}`, fermeId: f.id, bandeId: b.id, date: last.date,
        type: "Mortalité anormale", detail: `Mortalité du jour ${last.pct.toFixed(2)} % de l'effectif présent (seuil ${params.seuilMortJour} %)`,
        pct: last.pct, statut: st, publiee: false, pending: false,
        hist: [{ t: new Date(Date.now() - 86400000).toISOString(), statut: "Nouvelle", par: "Système", note: "Alerte automatique" }],
      };
      if (st !== "Nouvelle") a.hist.push({ t: new Date(Date.now() - 43200000).toISOString(), statut: "En analyse", par: "Services vétérinaires", note: "Prélèvements demandés" });
      if (st === "Confirmée" || st === "Infirmée") a.hist.push({ t: new Date(Date.now() - 21600000).toISOString(), statut: st, par: "Services vétérinaires", note: st === "Confirmée" ? "Foyer confirmé, mesures de biosécurité imposées" : "Cause non infectieuse (coup de chaleur)" });
      if (st === "Confirmée" && alertes.filter((x) => x.publiee).length === 0) a.publiee = true;
      alertes.push(a);
    });

    const now = Date.now();
    const iso = (d) => new Date(now - d * 86400000).toISOString();
    const journal = [
      { t: iso(21), role: "admin", action: "Import", detail: "Liste POUFA (formulaires AMI) : 150 fermes importées" },
      { t: iso(20), role: "admin", action: "Paramétrage initial", detail: "Listes, statuts, formules et calendrier vaccinal chargés" },
      { t: iso(20), role: "vet", action: "Seuil d'alerte", detail: "Seuil de mortalité du jour fixé à 1 % de l'effectif présent" },
      { t: iso(14), role: "admin", action: "Reprise des données", detail: "Fiches papier et outil transitoire : rapport de reprise validé" },
    ];

    return {
      v: 1, seedDate: today, params, fermes, lots, operateurs, alertes, declarations: [], journal, scans: [],
      ui: { role: null, fermeId: "EST-001", opId: "OP-01", offline: false, filters: { province: "", cohorte: "", statut: "" } },
    };
  };
})();
