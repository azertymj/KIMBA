/* =========================================================
   SENTINEL MINE — Application de démonstration
   Toutes les données (capteurs, alertes, IA, stocks) sont
   simulées côté client. Aucun backend requis.
========================================================= */

/* ---------------------------------------------------------
   1. CONFIGURATION
--------------------------------------------------------- */
const TYPE_CONFIG = {
  vibration:   { unit:'mm/s', label:'Vibration',      base:2.5,  noise:0.35, driftChance:0.06 },
  temperature: { unit:'°C',   label:'Température',    base:58,   noise:2.2,  driftChance:0.05 },
  pression:    { unit:'bar',  label:'Pression',       base:12,   noise:0.8,  driftChance:0.05 },
  debit:       { unit:'m³/h', label:'Débit',          base:340,  noise:14,   driftChance:0.04 },
  courant:     { unit:'A',    label:'Courant moteur', base:85,   noise:4,    driftChance:0.05 }
};

const SITES = [
  'Mine de manganèse — Moanda',
  'Champ pétrolier — Gamba',
  'Barrage hydroélectrique — Kinguélé',
  'Station de pompage — Owendo',
  'Raffinerie — Port-Gentil'
];

const RECOMMENDATIONS = {
  vibration:   'Vérifier alignement et roulements.',
  temperature: 'Contrôler le circuit de refroidissement.',
  pression:    'Inspecter les joints et clapets.',
  debit:       'Contrôler colmatage / filtration.',
  courant:     'Vérifier charge moteur et connectique.'
};

let PARTS = [
  { id:'p1', name:'Kit de roulements SKF',        ref:'RB-2201', types:['vibration'],   stock:8,  reorder:3 },
  { id:'p2', name:'Accouplement flexible',        ref:'CF-450',  types:['vibration'],   stock:4,  reorder:2 },
  { id:'p3', name:'Ventilateur de refroidissement', ref:'FN-118', types:['temperature'], stock:6,  reorder:3 },
  { id:'p4', name:'Capteur PT100 de rechange',    ref:'PT-100X', types:['temperature'], stock:12, reorder:4 },
  { id:'p5', name:'Joint haute pression',         ref:'JHP-33',  types:['pression'],    stock:2,  reorder:4 },
  { id:'p6', name:'Clapet anti-retour',           ref:'CAR-77',  types:['pression'],    stock:5,  reorder:2 },
  { id:'p7', name:'Cartouche filtrante',          ref:'CF-900',  types:['debit'],       stock:9,  reorder:3 },
  { id:'p8', name:'Membrane de pompe',            ref:'MP-14',   types:['debit'],       stock:3,  reorder:3 },
  { id:'p9', name:'Contacteur moteur',            ref:'CM-63',   types:['courant'],     stock:7,  reorder:3 },
  { id:'p10', name:'Câblage triphasé (lot)',      ref:'CT-3PH',  types:['courant'],     stock:1,  reorder:2 },
];

let sensors = [];
let alerts = [];
let sensorIdCounter = 1;
let activeSiteFilter = 'Tous';
let activeAlertFilter = 'tous';
let uptimeHistory = [];
let loadHistory = [];
let riskHistory = [];

/* ---------------------------------------------------------
   2. INITIALISATION DES CAPTEURS DE DÉMO
--------------------------------------------------------- */
function seedInitialSensors(){
  const seeds = [
    { machine:'Concasseur primaire C-01',   site:SITES[0], type:'vibration',   threshold:7 },
    { machine:"Pompe d'exhaure P-12",       site:SITES[0], type:'temperature', threshold:92 },
    { machine:'Tête de puits WH-07',        site:SITES[1], type:'pression',    threshold:22 },
    { machine:'Turbine hydraulique T-02',   site:SITES[2], type:'vibration',   threshold:6.5 },
    { machine:'Moteur convoyeur M-05',      site:SITES[0], type:'courant',     threshold:120 },
    { machine:'Pompe de refoulement P-03',  site:SITES[3], type:'debit',       threshold:180 },
    { machine:'Foreuse rotative F-09',      site:SITES[0], type:'vibration',   threshold:8 },
    { machine:'Colonne de distillation D-2',site:SITES[4], type:'temperature', threshold:145 },
  ];
  seeds.forEach(s => addSensor(s.machine, s.site, s.type, s.threshold, true));
}

function addSensor(machine, site, type, threshold, silent){
  const cfg = TYPE_CONFIG[type];
  const id = 'sn-' + (sensorIdCounter++);
  const startVal = cfg.base + (Math.random()-0.5)*cfg.noise*2;
  sensors.push({
    id, machine, site, type,
    threshold: threshold || cfg.base * 1.6,
    history: Array.from({length:20}, ()=> startVal + (Math.random()-0.5)*cfg.noise),
    value: startVal,
    state: 'normal',
    aiScore: Math.round(8 + Math.random()*10),
    drifting: false,
    driftTarget: 0
  });
  if(!silent) pushToast(`Capteur activé sur « ${machine} »`);
  renderFilters();
  renderEverything();
}

function removeSensor(id){
  const s = sensors.find(x=>x.id===id);
  sensors = sensors.filter(x=>x.id!==id);
  renderFilters();
  renderEverything();
  if(s) pushToast(`Capteur retiré : ${s.machine}`);
}

/* ---------------------------------------------------------
   3. SIMULATION TEMPS RÉEL + SCORE IA
--------------------------------------------------------- */
function tick(){
  sensors.forEach(s=>{
    const cfg = TYPE_CONFIG[s.type];

    if(!s.drifting && Math.random() < cfg.driftChance/40){
      s.drifting = true;
      s.driftTarget = s.threshold * (1.02 + Math.random()*0.15);
    }

    if(s.drifting){
      s.value += (s.driftTarget - s.value) * 0.06 + (Math.random()-0.5)*cfg.noise*0.4;
      if(Math.abs(s.value - s.driftTarget) < cfg.noise*0.5 && Math.random() < 0.15){
        s.drifting = false;
      }
    } else {
      s.value += (cfg.base - s.value)*0.03 + (Math.random()-0.5)*cfg.noise;
    }

    s.history.push(s.value);
    if(s.history.length > 30) s.history.shift();

    // --- Score de risque IA (0-100) : proximité du seuil + tendance récente ---
    const ratio = s.value / s.threshold;
    const trend = (s.history[s.history.length-1] - s.history[Math.max(0,s.history.length-6)]) / (cfg.noise*6 || 1);
    let score = ratio*72 + Math.max(0,trend)*22 + Math.random()*6;
    s.aiScore = Math.max(2, Math.min(99, Math.round(score)));

    let newState = 'normal';
    if(ratio >= 1) newState = 'critique';
    else if(ratio >= 0.85 || s.aiScore >= 70) newState = 'attention';

    if(newState !== s.state){
      if(newState === 'critique'){ generateAlert(s, 'critique'); consumePart(s.type); }
      else if(newState === 'attention') generateAlert(s, 'attention');
    }
    s.state = newState;
  });

  updateGlobalHistories();
  renderEverything();
}

function estimateETA(s){
  if(s.state === 'normal') return null;
  if(s.state === 'critique') return '< 24 h';
  const remaining = s.threshold - s.value;
  const trend = (s.history[s.history.length-1] - s.history[0]) / s.history.length;
  if(trend <= 0) return '48–72 h';
  const stepsToFail = remaining / trend;
  const hours = Math.max(6, Math.round(stepsToFail * 2));
  if(hours > 96) return '4–7 j';
  if(hours > 48) return '2–4 j';
  return '24–48 h';
}

/* ---------------------------------------------------------
   4. ALERTES
--------------------------------------------------------- */
function generateAlert(s, level){
  const cfg = TYPE_CONFIG[s.type];
  const msg = level === 'critique'
    ? `Seuil critique dépassé (${s.value.toFixed(1)} ${cfg.unit} / seuil ${s.threshold} ${cfg.unit}). ${RECOMMENDATIONS[s.type]}`
    : `Dérive détectée par l'IA (score ${s.aiScore}/100). Surveillance renforcée recommandée.`;
  alerts.unshift({
    id: 'al-' + Date.now() + Math.random().toString(16).slice(2),
    sensorId: s.id, machine: s.machine, site: s.site, type: s.type,
    level, msg, time: new Date(), ordered:false
  });
  if(alerts.length > 60) alerts.pop();
}

function orderPart(alertId){
  const a = alerts.find(x=>x.id===alertId);
  if(!a || a.ordered) return;
  a.ordered = true;
  pushToast(`Commande de pièce envoyée pour « ${a.machine} »`);
  renderEverything();
}

/* ---------------------------------------------------------
   5. PIÈCES DE RECHANGE
--------------------------------------------------------- */
function consumePart(type){
  const candidates = PARTS.filter(p => p.types.includes(type) && p.stock > 0);
  if(candidates.length === 0) return;
  const p = candidates[Math.floor(Math.random()*candidates.length)];
  p.stock = Math.max(0, p.stock - 1);
}

function restockPart(id){
  const p = PARTS.find(x=>x.id===id);
  if(!p) return;
  p.stock += 10;
  pushToast(`Réapprovisionnement confirmé : ${p.name} (+10)`);
  renderParts();
}

/* ---------------------------------------------------------
   6. NAVIGATION
--------------------------------------------------------- */
const PAGE_META = {
  dashboard: { title:'Tableau de bord', sub:'Supervision en temps réel du parc industriel' },
  sensors:   { title:'Capteurs IoT', sub:'Gestion complète du parc de capteurs connectés' },
  alerts:    { title:'Alertes', sub:'Historique des alertes générées par le moteur IA' },
  parts:     { title:'Pièces de rechange', sub:'Suivi des stocks et réapprovisionnement' },
  history:   { title:'Historique & analyses', sub:'Tendances sur 30 jours' }
};

function goToPage(page){
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById('page-' + page).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  document.getElementById('pageTitle').textContent = PAGE_META[page].title;
  document.getElementById('pageSub').textContent = PAGE_META[page].sub;
  closeSidebarMobile();
  window.scrollTo(0,0);
}

document.querySelectorAll('.nav-item').forEach(item=>{
  item.addEventListener('click', ()=> goToPage(item.dataset.page));
});

/* ---------------------------------------------------------
   7. RENDU — FILTRES
--------------------------------------------------------- */
function renderFilters(){
  const sitesPresent = ['Tous', ...new Set(sensors.map(s=>s.site))];
  const bar = document.getElementById('filterBar');
  bar.innerHTML = sitesPresent.map(site=>{
    const short = site === 'Tous' ? 'Tous les sites' : (site.split('—')[1]?.trim() || site);
    return `<button class="chip ${site===activeSiteFilter?'active':''}" data-site="${site}">${short}</button>`;
  }).join('');
  bar.querySelectorAll('.chip').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      activeSiteFilter = btn.dataset.site;
      renderFilters();
      renderSensorGrid();
    });
  });
}

/* ---------------------------------------------------------
   8. RENDU — CAPTEURS (grille + tableau)
--------------------------------------------------------- */
function sparkPath(history, w, h){
  const max = Math.max(...history), min = Math.min(...history);
  const range = (max - min) || 1;
  const step = w / (history.length - 1);
  return history.map((v,i)=>{
    const x = i*step;
    const y = h - ((v-min)/range) * (h-6) - 3;
    return `${i===0?'M':'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function aiScoreLabel(score){
  if(score >= 70) return 'Risque élevé';
  if(score >= 40) return 'Risque modéré';
  return 'Risque faible';
}

function renderSensorGrid(){
  const grid = document.getElementById('sensorGrid');
  const list = sensors.filter(s => activeSiteFilter==='Tous' || s.site===activeSiteFilter);

  if(list.length === 0){
    grid.innerHTML = `<div class="empty-state">Aucun capteur sur ce site. Ajoutez-en un pour démarrer la surveillance.</div>`;
    return;
  }

  grid.innerHTML = list.map(s=>{
    const cfg = TYPE_CONFIG[s.type];
    const path = sparkPath(s.history, 220, 40);
    const color = s.state==='critique' ? 'var(--red)' : s.state==='attention' ? 'var(--ore)' : 'var(--teal)';
    const eta = estimateETA(s);
    return `
    <div class="sensor-card s-${s.state}">
      <div class="sc-head">
        <div>
          <div class="sc-title">${s.machine}</div>
          <div class="sc-meta">${(s.site.split('—')[1]||s.site).trim()} · ${cfg.label}</div>
        </div>
        <button class="sc-remove" onclick="removeSensor('${s.id}')" title="Retirer le capteur">✕</button>
      </div>
      <div class="sc-body">
        <div class="sc-value"><span class="num mono">${s.value.toFixed(1)}</span><span class="unit mono">${cfg.unit}</span></div>
        <div class="sc-spark"><svg viewBox="0 0 220 40" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="${color}" stroke-width="2"/></svg></div>
      </div>
      <div class="sc-ai">
        <span class="ai-tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1"/></svg>IA</span>
        <span>${aiScoreLabel(s.aiScore)} — <b>${s.aiScore}/100</b></span>
      </div>
      <div class="sc-foot">
        <span class="badge ${s.state}">${s.state}</span>
        <span class="eta mono">${eta ? `Panne estimée : <b>${eta}</b>` : `Seuil : ${s.threshold} ${cfg.unit}`}</span>
      </div>
    </div>`;
  }).join('');
}

function renderSensorsTable(){
  const body = document.getElementById('sensorsTableBody');
  if(sensors.length === 0){
    body.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-dim); padding:30px;">Aucun capteur enregistré.</td></tr>`;
    return;
  }
  body.innerHTML = sensors.map(s=>{
    const cfg = TYPE_CONFIG[s.type];
    return `<tr>
      <td class="part-name">${s.machine}</td>
      <td>${(s.site.split('—')[1]||s.site).trim()}</td>
      <td>${cfg.label}</td>
      <td class="mono">${s.value.toFixed(1)} ${cfg.unit}</td>
      <td class="mono">${s.threshold} ${cfg.unit}</td>
      <td class="mono" style="color:var(--ai);">${s.aiScore}/100</td>
      <td><span class="badge ${s.state}">${s.state}</span></td>
      <td><button class="mini-btn" onclick="removeSensor('${s.id}')">Retirer</button></td>
    </tr>`;
  }).join('');
}

/* ---------------------------------------------------------
   9. RENDU — ALERTES
--------------------------------------------------------- */
function alertRowHTML(a){
  const t = a.time.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  return `
    <div class="alert-item ${a.level}">
      <div class="alert-top">
        <span class="alert-machine">${a.machine}</span>
        <span class="alert-time mono">${t}</span>
      </div>
      <div class="alert-msg">${a.msg}</div>
      <div class="alert-actions">
        <button class="mini-btn ${a.ordered?'ordered':''}" onclick="orderPart('${a.id}')">${a.ordered?'✓ Pièce commandée':'Commander la pièce'}</button>
      </div>
    </div>`;
}

function renderAlertsDash(){
  const list = document.getElementById('alertsListDash');
  document.getElementById('alertCountChip').textContent = alerts.length;
  if(alerts.length===0){ list.innerHTML = `<div class="empty-state" style="border:none; padding:30px;">Aucune alerte pour le moment.</div>`; return; }
  list.innerHTML = alerts.slice(0,12).map(alertRowHTML).join('');
}

function renderAlertsFull(){
  const list = document.getElementById('alertsListFull');
  const filtered = alerts.filter(a => activeAlertFilter==='tous' || a.level===activeAlertFilter);
  if(filtered.length===0){ list.innerHTML = `<div class="empty-state" style="border:none; padding:30px;">Aucune alerte dans ce filtre.</div>`; return; }
  list.innerHTML = filtered.map(alertRowHTML).join('');
}

document.querySelectorAll('[data-alertfilter]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    activeAlertFilter = btn.dataset.alertfilter;
    document.querySelectorAll('[data-alertfilter]').forEach(b=>b.classList.toggle('active', b===btn));
    renderAlertsFull();
  });
});

/* ---------------------------------------------------------
   10. RENDU — PIÈCES DE RECHANGE
--------------------------------------------------------- */
function renderParts(){
  const body = document.getElementById('partsTableBody');
  const low = PARTS.filter(p => p.stock <= p.reorder).length;
  document.getElementById('partsLowStockNote').textContent = low > 0
    ? `${low} référence(s) sous le seuil de réapprovisionnement`
    : 'Tous les stocks sont suffisants';

  body.innerHTML = PARTS.map(p=>{
    const pct = Math.min(100, Math.round((p.stock / (p.reorder*3)) * 100));
    const low = p.stock <= p.reorder;
    const barColor = low ? 'var(--red)' : pct < 60 ? 'var(--ore)' : 'var(--teal)';
    const compatLabels = p.types.map(t=>TYPE_CONFIG[t].label).join(', ');
    return `<tr>
      <td><div class="part-name">${p.name}</div><div class="part-ref">Réf. ${p.ref}</div></td>
      <td>${compatLabels}</td>
      <td><span class="stock-bar"><span class="stock-fill" style="width:${pct}%; background:${barColor};"></span></span><span class="mono">${p.stock}</span></td>
      <td class="mono">${p.reorder}</td>
      <td>${low ? '<span class="badge critique">à commander</span>' : '<span class="badge normal">ok</span>'}</td>
      <td><button class="mini-btn" onclick="restockPart('${p.id}')">Réapprovisionner</button></td>
    </tr>`;
  }).join('');
}

/* ---------------------------------------------------------
   11. KPI + BANNIÈRE IA
--------------------------------------------------------- */
function renderKPIs(){
  document.getElementById('kpiSensors').textContent = sensors.length;
  const crit = sensors.filter(s=>s.state==='critique').length;
  const warn = sensors.filter(s=>s.state==='attention').length;
  document.getElementById('kpiAlerts').textContent = alerts.length;
  document.getElementById('kpiAlertsSub').textContent = `${crit} critiques`;

  const uptime = sensors.length ? Math.max(0, (((sensors.length - crit - warn*0.5) / sensors.length) * 100)) : 100;
  document.getElementById('kpiUptime').innerHTML = `${uptime.toFixed(1)}<small>%</small>`;

  const avgScore = sensors.length ? Math.round(sensors.reduce((a,s)=>a+s.aiScore,0)/sensors.length) : 0;
  document.getElementById('kpiAiScore').innerHTML = `${avgScore}<small>/100</small>`;
  const trendEl = document.getElementById('kpiAiTrend');
  trendEl.textContent = avgScore >= 55 ? 'En hausse' : avgScore >= 30 ? 'Stable' : 'En baisse';
  trendEl.className = 'kpi-trend ' + (avgScore >= 55 ? 'down' : 'up');

  document.getElementById('aiMachineCount').textContent = sensors.length;
  const highRisk = sensors.filter(s=>s.aiScore>=70).length;
  document.getElementById('aiRiskCount').textContent = highRisk;

  const badge = document.getElementById('navAlertBadge');
  badge.textContent = alerts.length;
  badge.style.display = alerts.length ? 'inline-block' : 'none';
  document.getElementById('notifDot').style.display = alerts.length ? 'block' : 'none';
}

/* ---------------------------------------------------------
   12. GRAPHIQUE TEMPS RÉEL (canvas)
--------------------------------------------------------- */
function updateGlobalHistories(){
  const crit = sensors.filter(s=>s.state==='critique').length;
  const warn = sensors.filter(s=>s.state==='attention').length;
  const uptime = sensors.length ? Math.max(0, (((sensors.length - crit - warn*0.5) / sensors.length) * 100)) : 100;
  const load = sensors.length ? sensors.reduce((a,s)=>a + Math.min(120,(s.value/s.threshold)*100),0)/sensors.length : 0;
  const risk = sensors.length ? sensors.reduce((a,s)=>a+s.aiScore,0)/sensors.length : 0;

  uptimeHistory.push(uptime); if(uptimeHistory.length>40) uptimeHistory.shift();
  loadHistory.push(load); if(loadHistory.length>40) loadHistory.shift();
  riskHistory.push(risk); if(riskHistory.length>40) riskHistory.shift();
}

function drawRealtimeChart(){
  const canvas = document.getElementById('realtimeChart');
  const wrap = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const w = wrap.clientWidth, h = 220;
  canvas.width = w*dpr; canvas.height = h*dpr;
  canvas.style.width = w+'px'; canvas.style.height = h+'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,w,h);

  const styles = getComputedStyle(document.body);
  const gridColor = styles.getPropertyValue('--steel-line').trim();
  const teal = styles.getPropertyValue('--teal').trim();
  const ore = styles.getPropertyValue('--ore').trim();
  const ai = styles.getPropertyValue('--ai').trim();

  // grille horizontale
  ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
  for(let i=0;i<=4;i++){
    const y = 12 + i*((h-32)/4);
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
  }

  const series = [
    { data: uptimeHistory, color: teal, max:100 },
    { data: loadHistory,   color: ore,  max:120 },
    { data: riskHistory,   color: ai,   max:100 },
  ];

  series.forEach(s=>{
    if(s.data.length < 2) return;
    const stepX = w / (Math.max(s.data.length,40)-1);
    ctx.beginPath();
    s.data.forEach((v,i)=>{
      const x = i*stepX;
      const y = 12 + (1 - Math.min(v,s.max)/s.max) * (h-32);
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.lineJoin='round'; ctx.stroke();
  });
}

function renderRealtimeLegend(){
  document.getElementById('realtimeLegend').innerHTML = `
    <span class="legend-item"><span class="legend-dot" style="background:var(--teal)"></span>Disponibilité</span>
    <span class="legend-item"><span class="legend-dot" style="background:var(--ore)"></span>Charge moyenne machines</span>
    <span class="legend-item"><span class="legend-dot" style="background:var(--ai)"></span>Score de risque IA moyen</span>`;
}

/* ---------------------------------------------------------
   13. GRAPHIQUES HISTORIQUES FICTIFS (SVG) — page Historique
--------------------------------------------------------- */
function renderAvailabilityChart(){
  const days = 30; const data = []; let v = 96.5;
  for(let i=0;i<days;i++){ v += (Math.random()-0.48)*1.4; v = Math.max(89, Math.min(99.5, v)); data.push(v); }
  const w=620,h=150,pad=8,max=100,min=88;
  const stepX=(w-pad*2)/(days-1);
  const toY = val => h - pad - ((val-min)/(max-min))*(h-pad*2);
  const linePath = data.map((v,i)=> `${i===0?'M':'L'}${(pad+i*stepX).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const areaPath = linePath + ` L${(pad+(days-1)*stepX).toFixed(1)},${h-pad} L${pad},${h-pad} Z`;
  const thresholdY = toY(95);
  document.getElementById('chartAvailability').innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:170px; display:block;">
      <defs><linearGradient id="availGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--teal)" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="var(--teal)" stop-opacity="0"/>
      </linearGradient></defs>
      <line x1="${pad}" y1="${thresholdY}" x2="${w-pad}" y2="${thresholdY}" stroke="var(--ore)" stroke-width="1" stroke-dasharray="4 4"/>
      <path d="${areaPath}" fill="url(#availGrad)"/>
      <path d="${linePath}" fill="none" stroke="var(--teal)" stroke-width="2"/>
    </svg>`;
}

function renderAlertTypesChart(){
  const data = [
    { label:'Vibration', value:34, color:'var(--red)' },
    { label:'Température', value:27, color:'var(--ore)' },
    { label:'Pression', value:18, color:'var(--blue)' },
    { label:'Courant', value:14, color:'var(--teal)' },
    { label:'Débit', value:7, color:'var(--text-mid)' },
  ];
  const max = Math.max(...data.map(d=>d.value));
  document.getElementById('chartAlertTypes').innerHTML = data.map(d=>`
    <div class="bar-row">
      <span class="bar-label">${d.label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(d.value/max*100).toFixed(0)}%; background:${d.color};"></div></div>
      <span class="bar-val">${d.value}%</span>
    </div>`).join('');
}

function renderCostSavedChart(){
  const months = ['Fév','Mars','Avr','Mai','Juin','Juil'];
  const saved=[42,51,47,63,58,71], lost=[18,14,16,9,11,6];
  const max = Math.max(...saved,...lost);
  const w=620,h=170,pad=30;
  const groupW=(w-pad*2)/months.length, barW=groupW*0.3;
  let bars='';
  months.forEach((m,i)=>{
    const gx = pad + i*groupW + groupW*0.18;
    const hS=(saved[i]/max)*(h-pad*2), hL=(lost[i]/max)*(h-pad*2);
    bars += `<rect x="${gx}" y="${h-pad-hS}" width="${barW}" height="${hS}" fill="var(--teal)" rx="1"/>`;
    bars += `<rect x="${gx+barW+4}" y="${h-pad-hL}" width="${barW}" height="${hL}" fill="var(--red)" rx="1"/>`;
    bars += `<text x="${gx+barW}" y="${h-pad+16}" font-size="10" fill="var(--text-dim)" text-anchor="middle" font-family="JetBrains Mono, monospace">${m}</text>`;
  });
  document.getElementById('chartCostSaved').innerHTML = `<svg viewBox="0 0 ${w} ${h}" style="width:100%; height:170px; display:block;">${bars}</svg>`;
}

function renderSitesChart(){
  const data = [
    { label:'Moanda (manganèse)', value:9, color:'var(--ore)' },
    { label:'Gamba (pétrole)', value:6, color:'var(--blue)' },
    { label:'Kinguélé (hydro)', value:4, color:'var(--teal)' },
    { label:'Owendo (pompage)', value:5, color:'var(--red)' },
    { label:'Port-Gentil (raffinerie)', value:3, color:'var(--text-mid)' },
  ];
  const total = data.reduce((a,b)=>a+b.value,0);
  const cx=90,cy=90,r=70,rInner=42; let angle=-Math.PI/2; let paths='';
  data.forEach(d=>{
    const slice=(d.value/total)*Math.PI*2;
    const x1=cx+r*Math.cos(angle), y1=cy+r*Math.sin(angle);
    const x2=cx+r*Math.cos(angle+slice), y2=cy+r*Math.sin(angle+slice);
    const xi1=cx+rInner*Math.cos(angle+slice), yi1=cy+rInner*Math.sin(angle+slice);
    const xi2=cx+rInner*Math.cos(angle), yi2=cy+rInner*Math.sin(angle);
    const large = slice > Math.PI ? 1 : 0;
    paths += `<path d="M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${xi1},${yi1} A${rInner},${rInner} 0 ${large} 0 ${xi2},${yi2} Z" fill="${d.color}"/>`;
    angle += slice;
  });
  const legend = data.map(d=>`<span class="legend-item"><span class="legend-dot" style="background:${d.color}"></span>${d.label} (${d.value})</span>`).join('');
  document.getElementById('chartSites').innerHTML = `
    <div style="display:flex; align-items:center; gap:20px; flex-wrap:wrap;">
      <svg viewBox="0 0 180 180" style="width:150px; height:150px; flex-shrink:0;">${paths}</svg>
      <div style="display:flex; flex-direction:column; gap:8px;">${legend}</div>
    </div>`;
}

function renderHistoryCharts(){
  renderAvailabilityChart();
  renderAlertTypesChart();
  renderCostSavedChart();
  renderSitesChart();
}

/* ---------------------------------------------------------
   14. RENDU GLOBAL
--------------------------------------------------------- */
function renderEverything(){
  renderSensorGrid();
  renderSensorsTable();
  renderAlertsDash();
  renderAlertsFull();
  renderParts();
  renderKPIs();
  renderRealtimeLegend();
  drawRealtimeChart();
}

/* ---------------------------------------------------------
   15. TOASTS
--------------------------------------------------------- */
function pushToast(msg){
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(),300); }, 3800);
}

/* ---------------------------------------------------------
   16. THÈME CLAIR / SOMBRE
--------------------------------------------------------- */
document.getElementById('themeToggle').addEventListener('click', ()=>{
  const wasLight = document.body.getAttribute('data-theme') === 'light';
  const nowLight = !wasLight;
  document.body.setAttribute('data-theme', nowLight ? 'light' : 'dark');
  document.getElementById('themeIconMoon').classList.toggle('hidden', nowLight);
  document.getElementById('themeIconSun').classList.toggle('hidden', !nowLight);
  drawRealtimeChart();
});

/* ---------------------------------------------------------
   17. SIDEBAR MOBILE
--------------------------------------------------------- */
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
document.getElementById('hamburger').addEventListener('click', ()=>{
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('show');
});
function closeSidebarMobile(){
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('show');
}
sidebarOverlay.addEventListener('click', closeSidebarMobile);

window.addEventListener('resize', ()=> drawRealtimeChart());

/* ---------------------------------------------------------
   18. MODAL AJOUT CAPTEUR
--------------------------------------------------------- */
const overlay = document.getElementById('modalOverlay');
function openModal(){ overlay.classList.add('open'); }
document.getElementById('btnOpenModal').addEventListener('click', openModal);
document.getElementById('btnOpenModal2').addEventListener('click', openModal);
document.getElementById('btnCancel').addEventListener('click', ()=> overlay.classList.remove('open'));
overlay.addEventListener('click', (e)=>{ if(e.target===overlay) overlay.classList.remove('open'); });

document.getElementById('btnConfirm').addEventListener('click', ()=>{
  const machine = document.getElementById('inMachine').value.trim();
  const site = document.getElementById('inSite').value;
  const type = document.getElementById('inType').value;
  const threshold = parseFloat(document.getElementById('inThreshold').value);

  if(!machine){
    document.getElementById('inMachine').style.borderColor = 'var(--red)';
    return;
  }
  addSensor(machine, site, type, threshold);
  document.getElementById('inMachine').value = '';
  document.getElementById('inThreshold').value = '';
  document.getElementById('inMachine').style.borderColor = '';
  overlay.classList.remove('open');
});

/* ---------------------------------------------------------
   19. NOTIFICATIONS (raccourci vers la page alertes)
--------------------------------------------------------- */
document.getElementById('notifBtn').addEventListener('click', ()=> goToPage('alerts'));

/* ---------------------------------------------------------
   20. DÉMARRAGE
--------------------------------------------------------- */
seedInitialSensors();
for(let i=0;i<10;i++) updateGlobalHistories(); // pré-remplir le graphique temps réel
renderHistoryCharts();
renderEverything();
setInterval(tick, 2000);