const NS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('field');
const backgroundLayer = document.getElementById('backgroundLayer');
const connectorLayer = document.getElementById('connectorLayer');
const eventLayer = document.getElementById('eventLayer');
const nodeLayer = document.getElementById('nodeLayer');
const overlayLayer = document.getElementById('overlayLayer');

const readoutText = document.getElementById('readoutText');
const selectedCard = document.getElementById('selectedCard');
const selectedName = document.getElementById('selectedName');
const selectedEffect = document.getElementById('selectedEffect');
const legend = document.getElementById('legend');

const stabilityValue = document.getElementById('stabilityValue');
const energyValue = document.getElementById('energyValue');
const collapseValue = document.getElementById('collapseValue');
const stabilityBar = document.getElementById('stabilityBar');
const energyBar = document.getElementById('energyBar');
const collapseBar = document.getElementById('collapseBar');

const amino = [
  {
    id: 'anticipacion',
    short: 'AN',
    name: 'Anticipación',
    x: 335,
    y: 188,
    role: 'detecta señales débiles',
    energy: 'Señal',
    effect: 'revela eventos antes de que rompan el vínculo',
    apply: 'anticipation'
  },
  {
    id: 'agilidad',
    short: 'AG',
    name: 'Agilidad',
    x: 846,
    y: 212,
    role: 'responde con rapidez',
    energy: 'Impulso',
    effect: 'repara daño inmediato en un conector',
    apply: 'agility'
  },
  {
    id: 'adecuacion',
    short: 'AD',
    name: 'Adecuación',
    x: 865,
    y: 568,
    role: 'ajusta forma y contexto',
    energy: 'Ajuste',
    effect: 'reduce tensión por mala configuración espacial',
    apply: 'fit'
  },
  {
    id: 'aprendizaje',
    short: 'AP',
    name: 'Aprendizaje',
    x: 340,
    y: 574,
    role: 'convierte experiencia en memoria',
    energy: 'Memoria',
    effect: 'aumenta resistencia de la cadena ante eventos repetidos',
    apply: 'learning'
  },
  {
    id: 'antifragilidad',
    short: 'AF',
    name: 'Antifragilidad',
    x: 610,
    y: 372,
    role: 'convierte crisis en mejora',
    energy: 'Transformación',
    effect: 'si se aplica sobre crisis crítica, fortalece el vínculo',
    apply: 'antifragility'
  }
];

const links = [
  { id: 'an-ag', from: 'anticipacion', to: 'agilidad', label: 'leer → responder', health: 0.74, memory: 0, tension: 0.18 },
  { id: 'ag-ad', from: 'agilidad', to: 'adecuacion', label: 'actuar → ajustar', health: 0.70, memory: 0, tension: 0.22 },
  { id: 'ad-ap', from: 'adecuacion', to: 'aprendizaje', label: 'ajustar → aprender', health: 0.68, memory: 0, tension: 0.2 },
  { id: 'ap-af', from: 'aprendizaje', to: 'antifragilidad', label: 'error → mejora', health: 0.66, memory: 0, tension: 0.26 },
  { id: 'af-an', from: 'antifragilidad', to: 'anticipacion', label: 'caos → escenario', health: 0.62, memory: 0, tension: 0.25 },
  { id: 'ag-ap', from: 'agilidad', to: 'aprendizaje', label: 'acción → feedback', health: 0.52, memory: 0, tension: 0.34 }
];

const state = new Map();
const nodeEls = new Map();
const linkEls = new Map();
const eventEls = new Map();
let events = [];
let selected = null;
let dragging = null;
let dragOffset = { x: 0, y: 0 };
let fieldEnergy = 0.58;
let collapse = 0.18;
let challengeActive = false;
let challengeTimer = 0;
let eventsSurvived = 0;
let lastTime = performance.now();

function el(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
  if (parent) parent.appendChild(node);
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function nodeById(id) {
  return state.get(id);
}

function svgPoint(event) {
  const pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function init() {
  state.clear();
  amino.forEach((item, index) => {
    state.set(item.id, {
      ...item,
      vx: Math.sin(index * 1.4) * 0.14,
      vy: Math.cos(index * 1.2) * 0.14,
      charge: 0.82,
      phase: Math.random() * Math.PI * 2
    });
  });

  links.forEach((link, index) => {
    link.health = 0.58 + index * 0.035;
    link.memory = 0;
    link.tension = 0.22;
    link.cooldown = 0;
  });

  selected = null;
  dragging = null;
  events = [];
  fieldEnergy = 0.58;
  collapse = 0.18;
  challengeActive = false;
  challengeTimer = 0;
  eventsSurvived = 0;

  drawBackground();
  drawConnectors();
  drawNodes();
  drawLegend();
  updateSelectedPanel();
  updateView();
}

function drawBackground() {
  clear(backgroundLayer);

  const center = { x: 600, y: 380 };
  [84, 150, 220, 300, 382, 466].forEach((r, index) => {
    el('circle', {
      cx: center.x,
      cy: center.y,
      r,
      class: `bg-line ${index % 2 ? '' : 'strong'}`
    }, backgroundLayer);
  });

  for (let i = 0; i < 28; i++) {
    const a = (Math.PI * 2 * i) / 28;
    el('line', {
      x1: center.x + Math.cos(a) * 80,
      y1: center.y + Math.sin(a) * 80,
      x2: center.x + Math.cos(a) * 484,
      y2: center.y + Math.sin(a) * 484,
      class: i % 4 === 0 ? 'bg-line orange' : 'bg-line'
    }, backgroundLayer);
  }

  el('text', {
    x: 600,
    y: 383,
    fill: 'rgba(29,32,36,0.18)',
    'font-size': 84,
    'font-family': 'Georgia, serif',
    'text-anchor': 'middle',
    'dominant-baseline': 'middle'
  }, backgroundLayer).textContent = 'LIFE';

  for (let i = 0; i < 34; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 120 + Math.random() * 430;
    el('circle', {
      cx: center.x + Math.cos(a) * r,
      cy: center.y + Math.sin(a) * r * 0.72,
      r: 1.2 + Math.random() * 2.2,
      fill: i % 3 === 0 ? 'rgba(0,102,255,0.25)' : 'rgba(255,90,0,0.42)'
    }, backgroundLayer);
  }
}

function drawConnectors() {
  clear(connectorLayer);
  linkEls.clear();

  links.forEach(link => {
    const group = el('g', { 'data-link': link.id }, connectorLayer);
    const hit = el('path', { class: 'connector-hit' }, group);
    const path = el('path', { class: 'connector' }, group);
    const label = el('text', { class: 'connector-label' }, group);
    label.textContent = link.label;
    hit.addEventListener('click', () => applySelectedEnergy(link.id));
    linkEls.set(link.id, { group, hit, path, label });
  });
}

function drawNodes() {
  clear(nodeLayer);
  nodeEls.clear();

  state.forEach(node => {
    const group = el('g', {
      class: 'node',
      'data-node': node.id,
      transform: `translate(${node.x},${node.y})`
    }, nodeLayer);

    el('circle', { class: 'halo', cx: 0, cy: 0, r: 48 }, group);
    el('circle', { class: 'core', cx: 0, cy: 0, r: 29 }, group);
    el('circle', { class: 'energy-ring', cx: 0, cy: 0, r: 37, 'stroke-dasharray': '0 240' }, group);
    el('text', { class: 'short', x: 0, y: 1 }, group).textContent = node.short;
    el('text', { class: 'name', x: 0, y: 50 }, group).textContent = node.name;

    group.addEventListener('click', event => {
      event.stopPropagation();
      selectNode(node.id);
    });
    group.addEventListener('pointerdown', startDrag);
    nodeEls.set(node.id, group);
  });
}

function drawLegend() {
  legend.innerHTML = amino.map(item => `
    <div class="legend-item">
      <span class="legend-token">${item.short}</span>
      <span><strong>${item.name}</strong><br>${item.energy}: ${item.effect}</span>
    </div>
  `).join('');
}

function selectNode(id) {
  selected = selected === id ? null : id;
  updateSelectedPanel();
  updateView();
}

function updateSelectedPanel() {
  const node = selected ? nodeById(selected) : null;
  selectedCard.classList.toggle('is-active', !!node);
  selectedName.textContent = node ? `${node.name} · ${node.energy}` : 'Ninguna';
  selectedEffect.textContent = node ? node.effect : 'Selecciona un nodo y luego haz clic sobre un conector o evento.';
}

function linkGeometry(link, time = performance.now()) {
  const a = nodeById(link.from);
  const b = nodeById(link.to);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  const pulse = Math.sin(time * 0.002 + link.id.length) * 10;
  const bend = (link.health < 0.34 ? 34 : 20) + pulse;
  const cx = mx + nx * bend;
  const cy = my + ny * bend;
  return { a, b, cx, cy, mx, my };
}

function updateConnectors(time) {
  links.forEach(link => {
    const els = linkEls.get(link.id);
    const g = linkGeometry(link, time);
    const d = `M ${g.a.x} ${g.a.y} Q ${g.cx} ${g.cy} ${g.b.x} ${g.b.y}`;
    els.hit.setAttribute('d', d);
    els.path.setAttribute('d', d);
    els.label.setAttribute('x', g.cx);
    els.label.setAttribute('y', g.cy - 10);

    els.path.classList.toggle('is-strong', link.health >= 0.72);
    els.path.classList.toggle('is-fragile', link.health < 0.58 && link.health >= 0.34);
    els.path.classList.toggle('is-critical', link.health < 0.34 && link.health > 0.05);
    els.path.classList.toggle('is-broken', link.health <= 0.05);
    els.path.style.opacity = String(0.28 + link.health * 0.72);
    els.label.style.opacity = link.health > 0.64 ? 0.9 : 0.25;
  });
}

function updateNodes(time) {
  state.forEach(node => {
    const group = nodeEls.get(node.id);
    group.setAttribute('transform', `translate(${node.x},${node.y})`);
    group.classList.toggle('is-selected', selected === node.id);
    group.classList.toggle('is-loaded', node.charge > 0.66);
    const halo = group.querySelector('.halo');
    halo.setAttribute('r', 46 + Math.sin(time * 0.003 + node.phase) * 3 + node.charge * 8);
    const ring = group.querySelector('.energy-ring');
    ring.setAttribute('stroke-dasharray', `${node.charge * 232} 232`);
    ring.setAttribute('transform', `rotate(-90)`);
  });
}

function updateEvents(time) {
  const known = new Set(events.map(item => item.id));

  [...eventEls.keys()].forEach(id => {
    if (!known.has(id)) {
      eventEls.get(id).remove();
      eventEls.delete(id);
    }
  });

  events.forEach(event => {
    let group = eventEls.get(event.id);
    if (!group) {
      group = el('g', { class: 'event', 'data-event': event.id }, eventLayer);
      el('circle', { class: 'event-ring', cx: 0, cy: 0, r: 18 }, group);
      el('circle', { class: 'event-core', cx: 0, cy: 0, r: 6 }, group);
      group.addEventListener('click', () => applySelectedEnergy(event.linkId, event.id));
      eventEls.set(event.id, group);
    }

    const link = links.find(item => item.id === event.linkId);
    const g = linkGeometry(link, time);
    const x = quadraticPoint(g.a.x, g.cx, g.b.x, event.t);
    const y = quadraticPoint(g.a.y, g.cy, g.b.y, event.t);
    const ring = group.querySelector('.event-ring');
    const core = group.querySelector('.event-core');
    const pulse = Math.sin(time * 0.011 + event.phase) * 4;
    group.setAttribute('transform', `translate(${x},${y})`);
    group.classList.toggle('is-positive', event.kind === 'opportunity');
    ring.setAttribute('r', 16 + event.intensity * 14 + pulse);
    core.setAttribute('r', 5 + event.intensity * 3);
  });
}

function quadraticPoint(a, c, b, t) {
  return (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;
}

function computeMetrics() {
  const avgHealth = links.reduce((sum, link) => sum + link.health, 0) / links.length;
  const avgCharge = [...state.values()].reduce((sum, node) => sum + node.charge, 0) / state.size;
  const pressure = events.reduce((sum, event) => sum + event.intensity * (event.kind === 'opportunity' ? 0.25 : 1), 0) / 5;
  const broken = links.filter(link => link.health <= 0.05).length / links.length;
  const stability = clamp(avgHealth * 0.78 + avgCharge * 0.10 - pressure * 0.16 - broken * 0.24, 0, 1);
  collapse = clamp(collapse + ((1 - stability) * 0.52 + pressure * 0.30 + broken * 0.34 - collapse) * 0.018, 0, 1);
  fieldEnergy = clamp(avgCharge * 0.72 + avgHealth * 0.18 - pressure * 0.1, 0, 1);
  return { stability, energy: fieldEnergy, collapse, pressure, broken };
}

function updateMetrics() {
  const metrics = computeMetrics();
  setMetric(stabilityValue, stabilityBar, metrics.stability);
  setMetric(energyValue, energyBar, metrics.energy);
  setMetric(collapseValue, collapseBar, metrics.collapse);
}

function setMetric(valueEl, barEl, value) {
  const percent = Math.round(clamp(value, 0, 1) * 100);
  valueEl.textContent = `${percent}%`;
  barEl.style.width = `${percent}%`;
}

function updateView(time = performance.now()) {
  updateConnectors(time);
  updateNodes(time);
  updateEvents(time);
  updateMetrics();
}

function startDrag(event) {
  const id = event.currentTarget.dataset.node;
  const node = nodeById(id);
  const point = svgPoint(event);
  dragging = node;
  dragOffset = { x: point.x - node.x, y: point.y - node.y };
  node.vx = 0;
  node.vy = 0;
  event.currentTarget.setPointerCapture(event.pointerId);
}

function moveDrag(event) {
  if (!dragging) return;
  const point = svgPoint(event);
  const nx = clamp(point.x - dragOffset.x, 96, 1104);
  const ny = clamp(point.y - dragOffset.y, 78, 690);
  dragging.vx = (nx - dragging.x) * 0.42;
  dragging.vy = (ny - dragging.y) * 0.42;
  dragging.x = nx;
  dragging.y = ny;
  updateView();
}

function endDrag() {
  if (!dragging) return;
  const related = links.filter(link => link.from === dragging.id || link.to === dragging.id);
  const avg = related.reduce((sum, link) => sum + link.health, 0) / related.length;
  readoutText.textContent = avg > 0.66
    ? `${dragging.name} quedó sosteniendo relaciones activas.`
    : `${dragging.name} quedó en zona de prueba; observa qué conectores se vuelven frágiles.`;
  dragging = null;
}

function physics(dt, time) {
  const center = { x: 600, y: 380 };

  state.forEach(node => {
    if (dragging && dragging.id === node.id) return;
    node.vx += (center.x - node.x) * 0.000012 * dt;
    node.vy += (center.y - node.y) * 0.000012 * dt;
    node.vx += Math.sin(time * 0.001 + node.phase) * 0.004 * dt;
    node.vy += Math.cos(time * 0.0011 + node.phase) * 0.0035 * dt;
  });

  links.forEach(link => {
    const a = nodeById(link.from);
    const b = nodeById(link.to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    const ideal = 310;
    const force = (d - ideal) * 0.00006 * link.health * dt;
    const nx = dx / d;
    const ny = dy / d;
    if (!dragging || dragging.id !== a.id) { a.vx += nx * force; a.vy += ny * force; }
    if (!dragging || dragging.id !== b.id) { b.vx -= nx * force; b.vy -= ny * force; }

    const tension = clamp(Math.abs(d - ideal) / 300, 0, 1);
    link.tension = tension;
    link.health = clamp(link.health - tension * 0.00055 * dt + link.memory * 0.00028 * dt, 0, 1);
  });

  const nodes = [...state.values()];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      if (d < 118) {
        const push = (118 - d) * 0.0012 * dt;
        const nx = dx / d;
        const ny = dy / d;
        if (!dragging || dragging.id !== a.id) { a.vx -= nx * push; a.vy -= ny * push; }
        if (!dragging || dragging.id !== b.id) { b.vx += nx * push; b.vy += ny * push; }
      }
    }
  }

  state.forEach(node => {
    if (dragging && dragging.id === node.id) return;
    node.vx *= Math.pow(0.962, dt);
    node.vy *= Math.pow(0.962, dt);
    node.x = clamp(node.x + node.vx * dt, 96, 1104);
    node.y = clamp(node.y + node.vy * dt, 78, 690);
    node.charge = clamp(node.charge - 0.00018 * dt + fieldEnergy * 0.00004 * dt, 0, 1);
  });

  events.forEach(event => {
    event.age += dt;
    event.intensity = clamp(event.intensity + event.growth * dt, 0, 1);
    const link = links.find(item => item.id === event.linkId);
    if (!link) return;
    const damage = event.kind === 'opportunity' ? 0.00012 : 0.00125;
    link.health = clamp(link.health - damage * event.intensity * dt * (1 - link.memory * 0.5), 0, 1);
    if (link.health <= 0.05 && event.kind !== 'opportunity') {
      collapse = clamp(collapse + 0.0008 * dt, 0, 1);
    }
  });

  events = events.filter(event => event.age < event.life && event.intensity < 1.02);

  if (challengeActive) {
    challengeTimer += dt;
    if (challengeTimer > 180 && events.length < 3) {
      spawnEvent();
      challengeTimer = 0;
    }
    if (eventsSurvived >= 5) {
      challengeActive = false;
      readoutText.textContent = 'Reto superado: sostuviste cinco eventos sin romper la red.';
    }
  }
}

function spawnEvent(kind = null) {
  const candidates = [...links].filter(link => link.health > 0.05);
  if (!candidates.length) return;
  const fragile = candidates.sort((a, b) => a.health - b.health)[0];
  const link = Math.random() < 0.68 ? fragile : candidates[Math.floor(Math.random() * candidates.length)];
  const eventKind = kind || (Math.random() < 0.18 ? 'opportunity' : 'stress');
  const event = {
    id: `event-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    linkId: link.id,
    kind: eventKind,
    t: 0.24 + Math.random() * 0.52,
    intensity: 0.18 + Math.random() * 0.22,
    growth: eventKind === 'opportunity' ? 0.0017 : 0.0026,
    age: 0,
    life: 540 + Math.random() * 320,
    phase: Math.random() * Math.PI * 2
  };
  events.push(event);
  readoutText.textContent = eventKind === 'opportunity'
    ? 'Apareció una oportunidad: puede fortalecer una cadena si aplicas energía correcta.'
    : 'Apareció una interferencia sobre un conector frágil.';
}

function applySelectedEnergy(linkId, eventId = null) {
  if (!selected) {
    readoutText.textContent = 'Selecciona primero un aminoácido para aplicar su energía.';
    return;
  }

  const node = nodeById(selected);
  if (node.charge < 0.18) {
    readoutText.textContent = `${node.name} no tiene energía suficiente. Recarga o usa otro aminoácido.`;
    return;
  }

  const link = links.find(item => item.id === linkId);
  const event = eventId ? events.find(item => item.id === eventId) : null;
  if (!link) return;

  let message = '';
  let delta = 0;
  let cost = 0.18;

  switch (node.apply) {
    case 'anticipation':
      delta = event ? 0.14 : 0.06;
      if (event) event.growth *= 0.48;
      message = 'Anticipación redujo la velocidad del evento: la red gana tiempo de respuesta.';
      break;
    case 'agility':
      delta = 0.22;
      cost = 0.24;
      message = 'Agilidad reparó el daño inmediato del conector.';
      break;
    case 'fit':
      delta = 0.16 + (link.tension > 0.38 ? 0.08 : 0);
      link.tension = Math.max(0, link.tension - 0.28);
      message = 'Adecuación alivió la tensión espacial de la cadena.';
      break;
    case 'learning':
      delta = 0.12;
      link.memory = clamp(link.memory + 0.34, 0, 1);
      message = 'Aprendizaje dejó memoria: ese vínculo resistirá mejor eventos similares.';
      break;
    case 'antifragility':
      if (event && event.intensity > 0.45) {
        delta = 0.34;
        link.memory = clamp(link.memory + 0.18, 0, 1);
        message = 'Antifragilidad transformó una crisis en fortalecimiento de la cadena.';
      } else {
        delta = 0.10;
        message = 'Antifragilidad necesita crisis real para convertir presión en mejora.';
      }
      break;
  }

  link.health = clamp(link.health + delta, 0, 1);
  node.charge = clamp(node.charge - cost, 0, 1);
  fieldEnergy = clamp(fieldEnergy - cost * 0.22 + delta * 0.12, 0, 1);
  collapse = clamp(collapse - delta * 0.08, 0, 1);

  if (event) {
    events = events.filter(item => item.id !== event.id);
    eventsSurvived += 1;
    pulseOnLink(link);
  } else {
    pulseOnLink(link);
  }

  readoutText.textContent = message;
  updateView();
}

function pulseOnLink(link) {
  const g = linkGeometry(link);
  const pulse = el('circle', { class: 'feedback-pulse', cx: g.mx, cy: g.my, r: 8 }, overlayLayer);
  let frame = 0;
  const animate = () => {
    frame += 1;
    pulse.setAttribute('r', 8 + frame * 1.2);
    pulse.style.opacity = String(Math.max(0, 1 - frame / 30));
    if (frame < 30) requestAnimationFrame(animate);
    else pulse.remove();
  };
  animate();
}

function rechargeEnergy() {
  state.forEach(node => {
    node.charge = clamp(node.charge + 0.22, 0, 1);
  });
  fieldEnergy = clamp(fieldEnergy + 0.18, 0, 1);
  collapse = clamp(collapse + 0.025, 0, 1);
  readoutText.textContent = 'Energía recargada. El costo es una leve subida de presión sistémica.';
  updateView();
}

function startChallenge() {
  challengeActive = true;
  challengeTimer = 0;
  eventsSurvived = 0;
  events = [];
  spawnEvent('stress');
  readoutText.textContent = 'Reto corto: resiste cinco eventos sin romper la red. Usa energías con criterio.';
}

function reset() {
  init();
  readoutText.textContent = 'Arrastra nodos para tensar o estabilizar la red. Haz clic en un aminoácido para seleccionar su energía.';
}

function loop(now) {
  const dt = Math.min(2.4, (now - lastTime) / 16.67);
  lastTime = now;
  physics(dt, now);
  updateView(now);
  requestAnimationFrame(loop);
}

svg.addEventListener('pointermove', moveDrag);
svg.addEventListener('pointerup', endDrag);
svg.addEventListener('pointercancel', endDrag);
svg.addEventListener('click', event => {
  if (event.target === svg) {
    selected = null;
    updateSelectedPanel();
    updateView();
  }
});

document.getElementById('spawnEventBtn').addEventListener('click', () => spawnEvent());
document.getElementById('energyBtn').addEventListener('click', rechargeEnergy);
document.getElementById('challengeBtn').addEventListener('click', startChallenge);
document.getElementById('resetBtn').addEventListener('click', reset);

init();
requestAnimationFrame(loop);
