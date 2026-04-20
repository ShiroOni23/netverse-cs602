const canvas = document.getElementById('networkCanvas');
const ctx = canvas.getContext('2d');

const topologyPresetEl = document.getElementById('topologyPreset');
const sourceEl = document.getElementById('source');
const destinationEl = document.getElementById('destination');
const trafficRateEl = document.getElementById('trafficRate');
const sendPacketBtn = document.getElementById('sendPacket');
const toggleTrafficBtn = document.getElementById('toggleTraffic');
const toggleRandomFailureBtn = document.getElementById('toggleRandomFailure');
const restoreLinksBtn = document.getElementById('restoreLinks');
const routingTableEl = document.getElementById('routingTable');
const dijkstraStepsEl = document.getElementById('dijkstraSteps');
const metricsEl = document.getElementById('metrics');
const eventLogEl = document.getElementById('eventLog');

const presets = {
  campus: {
    name: 'Campus Mesh',
    nodes: {
      A: { x: 130, y: 120 },
      B: { x: 340, y: 90 },
      C: { x: 600, y: 120 },
      D: { x: 220, y: 320 },
      E: { x: 480, y: 340 },
      F: { x: 780, y: 230 }
    },
    links: [
      ['A', 'B', 3], ['B', 'C', 4], ['A', 'D', 5], ['D', 'E', 2],
      ['E', 'C', 2], ['C', 'F', 3], ['E', 'F', 4], ['B', 'D', 4], ['A', 'E', 8]
    ]
  },
  isp: {
    name: 'ISP Core Ring',
    nodes: {
      R1: { x: 140, y: 130 },
      R2: { x: 350, y: 90 },
      R3: { x: 600, y: 120 },
      R4: { x: 810, y: 220 },
      R5: { x: 620, y: 380 },
      R6: { x: 340, y: 380 },
      R7: { x: 150, y: 270 }
    },
    links: [
      ['R1', 'R2', 6], ['R2', 'R3', 5], ['R3', 'R4', 4], ['R4', 'R5', 3],
      ['R5', 'R6', 5], ['R6', 'R7', 4], ['R7', 'R1', 2], ['R2', 'R6', 6],
      ['R3', 'R5', 4], ['R1', 'R6', 7]
    ]
  },
  wan: {
    name: 'Multi-Site Enterprise WAN',
    nodes: {
      HQ: { x: 150, y: 180 },
      DC: { x: 380, y: 110 },
      BR1: { x: 620, y: 110 },
      BR2: { x: 820, y: 210 },
      BR3: { x: 650, y: 400 },
      BR4: { x: 370, y: 420 },
      BR5: { x: 170, y: 360 }
    },
    links: [
      ['HQ', 'DC', 3], ['DC', 'BR1', 4], ['BR1', 'BR2', 5], ['BR2', 'BR3', 3],
      ['BR3', 'BR4', 4], ['BR4', 'BR5', 2], ['BR5', 'HQ', 2], ['DC', 'BR4', 6],
      ['HQ', 'BR1', 7], ['DC', 'BR3', 6]
    ]
  }
};

let currentPreset = 'campus';
let nodes = {};
let links = [];
let packetQueue = [];
let linkFailures = new Set();
let trafficTimer = null;
let packetsDelivered = 0;
let packetsDropped = 0;
let lastPath = [];
let lastCost = 0;

function keyFor(u, v) {
  return [u, v].sort().join('::');
}

function setPreset(presetKey) {
  currentPreset = presetKey;
  const preset = presets[presetKey];
  nodes = JSON.parse(JSON.stringify(preset.nodes));
  links = JSON.parse(JSON.stringify(preset.links));
  linkFailures = new Set();
  packetQueue = [];
  packetsDelivered = 0;
  packetsDropped = 0;
  lastPath = [];
  lastCost = 0;
  refillSelectors();
  rebuildInsights();
  logEvent(`Loaded topology: ${preset.name}`);
}

function buildGraph() {
  const graph = {};
  Object.keys(nodes).forEach((n) => {
    graph[n] = [];
  });

  for (const [u, v, w] of links) {
    if (linkFailures.has(keyFor(u, v))) {
      continue;
    }
    graph[u].push([v, w]);
    graph[v].push([u, w]);
  }
  return graph;
}

function dijkstra(graph, start) {
  const dist = {};
  const prev = {};
  const unvisited = new Set(Object.keys(graph));
  const steps = [];

  for (const n of unvisited) {
    dist[n] = Infinity;
  }
  dist[start] = 0;

  while (unvisited.size) {
    let u = null;
    for (const n of unvisited) {
      if (u === null || dist[n] < dist[u]) {
        u = n;
      }
    }

    if (u === null || dist[u] === Infinity) {
      break;
    }

    unvisited.delete(u);
    const updates = [];

    for (const [v, w] of graph[u]) {
      const alt = dist[u] + w;
      if (alt < dist[v]) {
        dist[v] = alt;
        prev[v] = u;
        updates.push(`${v}=${alt} via ${u}`);
      }
    }

    steps.push({ node: u, updates });
  }

  return { dist, prev, steps };
}

function shortestPath(start, end) {
  const graph = buildGraph();
  const { prev, dist, steps } = dijkstra(graph, start);
  const path = [];
  let cur = end;

  while (cur) {
    path.push(cur);
    if (cur === start) {
      break;
    }
    cur = prev[cur];
  }

  path.reverse();
  if (path[0] !== start || dist[end] === Infinity) {
    return { path: [], cost: Infinity, steps };
  }
  return { path, cost: dist[end], steps };
}

function buildRoutingTable() {
  const graph = buildGraph();
  const table = {};

  for (const src of Object.keys(nodes)) {
    const { dist, prev } = dijkstra(graph, src);
    table[src] = {};

    for (const dst of Object.keys(nodes)) {
      if (src === dst) {
        continue;
      }

      if (dist[dst] === Infinity) {
        table[src][dst] = { nextHop: '-', cost: 'INF' };
        continue;
      }

      let hop = dst;
      let cursor = dst;
      while (prev[cursor] && prev[cursor] !== src) {
        cursor = prev[cursor];
      }
      if (prev[cursor] === src) {
        hop = cursor;
      }

      table[src][dst] = { nextHop: hop, cost: dist[dst] };
    }
  }

  routingTableEl.textContent = JSON.stringify(table, null, 2);
}

function drawNode(name, pos) {
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 22, 0, Math.PI * 2);
  ctx.fillStyle = '#7ce8ff';
  ctx.shadowColor = 'rgba(124,232,255,0.85)';
  ctx.shadowBlur = 16;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#05223f';
  ctx.font = 'bold 14px Poppins';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, pos.x, pos.y);
}

function drawLink(u, v, w) {
  const a = nodes[u];
  const b = nodes[v];
  const failed = linkFailures.has(keyFor(u, v));

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineWidth = failed ? 3 : 2.2;
  ctx.strokeStyle = failed ? '#ef476f' : '#4cc9f0';
  if (failed) {
    ctx.setLineDash([8, 8]);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  ctx.fillStyle = failed ? '#ef476f' : '#ffd166';
  ctx.font = 'bold 12px Poppins';
  ctx.fillText(String(w), mx, my - 8);
}

function drawLinks() {
  for (const [u, v, w] of links) {
    drawLink(u, v, w);
  }
}

function drawPackets() {
  for (const p of packetQueue) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#ff8fab';
    ctx.shadowColor = 'rgba(255,143,171,0.9)';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function advancePackets() {
  const survivors = [];

  for (const packet of packetQueue) {
    if (packet.segment >= packet.path.length - 1) {
      packetsDelivered += 1;
      continue;
    }

    const from = packet.path[packet.segment];
    const to = packet.path[packet.segment + 1];
    if (linkFailures.has(keyFor(from, to))) {
      packetsDropped += 1;
      logEvent(`Packet dropped: failed link ${from}-${to}`);
      continue;
    }

    packet.t += 0.02;
    if (packet.t >= 1) {
      packet.segment += 1;
      packet.t = 0;
      if (packet.segment >= packet.path.length - 1) {
        packetsDelivered += 1;
        continue;
      }
    }

    const a = nodes[packet.path[packet.segment]];
    const b = nodes[packet.path[packet.segment + 1]];
    packet.x = a.x + (b.x - a.x) * packet.t;
    packet.y = a.y + (b.y - a.y) * packet.t;
    survivors.push(packet);
  }

  packetQueue = survivors;
}

function renderDijkstraSteps(steps) {
  const lines = [];
  steps.forEach((step, idx) => {
    const updateText = step.updates.length ? step.updates.join(', ') : 'no updates';
    lines.push(`${idx + 1}. visit ${step.node} -> ${updateText}`);
  });
  dijkstraStepsEl.textContent = lines.join('\n') || 'Run a route to view Dijkstra steps.';
}

function updateMetrics() {
  const activeLinks = links.length - linkFailures.size;
  const loss = packetsDelivered + packetsDropped === 0
    ? 0
    : (packetsDropped / (packetsDelivered + packetsDropped)) * 100;

  metricsEl.innerHTML = [
    `<div><span>Topology</span><strong>${presets[currentPreset].name}</strong></div>`,
    `<div><span>Active Links</span><strong>${activeLinks}/${links.length}</strong></div>`,
    `<div><span>Last Path</span><strong>${lastPath.length ? lastPath.join(' -> ') : '-'}</strong></div>`,
    `<div><span>Last Cost</span><strong>${lastCost || '-'}</strong></div>`,
    `<div><span>Delivered</span><strong>${packetsDelivered}</strong></div>`,
    `<div><span>Dropped</span><strong>${packetsDropped}</strong></div>`,
    `<div><span>Loss %</span><strong>${loss.toFixed(1)}%</strong></div>`
  ].join('');
}

function rebuildInsights() {
  buildRoutingTable();
  updateMetrics();
}

function logEvent(message) {
  const time = new Date().toLocaleTimeString();
  const item = document.createElement('li');
  item.textContent = `[${time}] ${message}`;
  eventLogEl.prepend(item);
  while (eventLogEl.children.length > 12) {
    eventLogEl.removeChild(eventLogEl.lastChild);
  }
}

function refillSelectors() {
  const keys = Object.keys(nodes);
  const options = keys.map((n) => `<option value="${n}">${n}</option>`).join('');
  sourceEl.innerHTML = options;
  destinationEl.innerHTML = options;
  sourceEl.value = keys[0];
  destinationEl.value = keys[Math.min(1, keys.length - 1)];
}

function launchPacket() {
  const src = sourceEl.value;
  const dst = destinationEl.value;

  if (src === dst) {
    return;
  }

  const result = shortestPath(src, dst);
  if (!result.path.length) {
    packetsDropped += 1;
    logEvent(`No route available from ${src} to ${dst}`);
    rebuildInsights();
    return;
  }

  const startNode = nodes[src];
  packetQueue.push({
    path: result.path,
    segment: 0,
    t: 0,
    x: startNode.x,
    y: startNode.y
  });

  lastPath = result.path;
  lastCost = result.cost;
  renderDijkstraSteps(result.steps);
  logEvent(`Packet sent ${src} -> ${dst} | cost ${result.cost}`);
  rebuildInsights();
}

function setTraffic(enabled) {
  if (enabled) {
    const ratePerMin = Number(trafficRateEl.value);
    const intervalMs = Math.max(250, Math.floor(60000 / ratePerMin));
    trafficTimer = setInterval(() => {
      const keys = Object.keys(nodes);
      const src = keys[Math.floor(Math.random() * keys.length)];
      let dst = src;
      while (dst === src) {
        dst = keys[Math.floor(Math.random() * keys.length)];
      }
      sourceEl.value = src;
      destinationEl.value = dst;
      launchPacket();
    }, intervalMs);
    toggleTrafficBtn.textContent = 'Stop Auto Traffic';
    logEvent(`Auto traffic started (${ratePerMin} packets/min)`);
    return;
  }

  clearInterval(trafficTimer);
  trafficTimer = null;
  toggleTrafficBtn.textContent = 'Start Auto Traffic';
  logEvent('Auto traffic stopped');
}

function failRandomLink() {
  const active = links.filter(([u, v]) => !linkFailures.has(keyFor(u, v)));
  if (!active.length) {
    logEvent('All links are already failed');
    return;
  }
  const [u, v] = active[Math.floor(Math.random() * active.length)];
  linkFailures.add(keyFor(u, v));
  logEvent(`Failure injected on link ${u}-${v}`);
  rebuildInsights();
}

function restoreAllLinks() {
  if (!linkFailures.size) {
    return;
  }
  linkFailures = new Set();
  logEvent('All links restored');
  rebuildInsights();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawLinks();
  Object.entries(nodes).forEach(([name, pos]) => drawNode(name, pos));
  advancePackets();
  drawPackets();
  updateMetrics();
  requestAnimationFrame(render);
}

function init() {
  topologyPresetEl.innerHTML = Object.entries(presets)
    .map(([key, value]) => `<option value="${key}">${value.name}</option>`)
    .join('');
  topologyPresetEl.value = currentPreset;

  setPreset(currentPreset);
  renderDijkstraSteps([]);

  sendPacketBtn.addEventListener('click', launchPacket);

  toggleTrafficBtn.addEventListener('click', () => {
    setTraffic(!trafficTimer);
  });

  trafficRateEl.addEventListener('change', () => {
    if (trafficTimer) {
      setTraffic(false);
      setTraffic(true);
    }
  });

  toggleRandomFailureBtn.addEventListener('click', failRandomLink);
  restoreLinksBtn.addEventListener('click', restoreAllLinks);

  topologyPresetEl.addEventListener('change', (event) => {
    if (trafficTimer) {
      setTraffic(false);
    }
    setPreset(event.target.value);
  });

  render();
}

init();
