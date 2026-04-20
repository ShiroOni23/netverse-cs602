const canvas = document.getElementById('networkCanvas');
const ctx = canvas.getContext('2d');

const sourceEl = document.getElementById('source');
const destinationEl = document.getElementById('destination');
const sendPacketBtn = document.getElementById('sendPacket');
const toggleLinkFailureBtn = document.getElementById('toggleLinkFailure');
const routingTableEl = document.getElementById('routingTable');

const nodes = {
  A: { x: 130, y: 110 },
  B: { x: 340, y: 70 },
  C: { x: 570, y: 130 },
  D: { x: 230, y: 300 },
  E: { x: 470, y: 320 },
  F: { x: 760, y: 240 }
};

let links = [
  ['A', 'B', 3], ['B', 'C', 4], ['A', 'D', 5], ['D', 'E', 2],
  ['E', 'C', 2], ['C', 'F', 3], ['E', 'F', 4], ['B', 'D', 4], ['A', 'E', 8]
];

let packet = null;
let failedAD = false;

function buildGraph() {
  const graph = {};
  Object.keys(nodes).forEach(n => graph[n] = []);
  for (const [u, v, w] of links) {
    graph[u].push([v, w]);
    graph[v].push([u, w]);
  }
  return graph;
}

function dijkstra(graph, start) {
  const dist = {}, prev = {}, unvisited = new Set(Object.keys(graph));
  for (const n of unvisited) dist[n] = Infinity;
  dist[start] = 0;

  while (unvisited.size) {
    let u = null;
    for (const n of unvisited) if (u === null || dist[n] < dist[u]) u = n;
    if (dist[u] === Infinity) break;
    unvisited.delete(u);

    for (const [v, w] of graph[u]) {
      const alt = dist[u] + w;
      if (alt < dist[v]) {
        dist[v] = alt;
        prev[v] = u;
      }
    }
  }
  return { dist, prev };
}

function shortestPath(start, end) {
  const graph = buildGraph();
  const { prev } = dijkstra(graph, start);
  const path = [];
  let cur = end;
  while (cur) {
    path.push(cur);
    if (cur === start) break;
    cur = prev[cur];
  }
  path.reverse();
  if (path[0] !== start) return [];
  return path;
}

function buildRoutingTable() {
  const graph = buildGraph();
  const table = {};
  for (const src of Object.keys(nodes)) {
    const { dist, prev } = dijkstra(graph, src);
    table[src] = {};
    for (const dst of Object.keys(nodes)) {
      if (src === dst) continue;
      let cur = dst;
      let hop = dst;
      while (prev[cur] && prev[cur] !== src) cur = prev[cur];
      if (prev[cur] === src) hop = cur;
      if (!prev[cur] && cur !== src && cur !== dst) hop = '-';
      table[src][dst] = { nextHop: dist[dst] < Infinity ? hop : '-', cost: dist[dst] };
    }
  }
  routingTableEl.textContent = JSON.stringify(table, null, 2);
}

function drawNode(name, { x, y }) {
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, Math.PI * 2);
  ctx.fillStyle = '#80ffdb';
  ctx.shadowColor = 'rgba(128,255,219,0.8)';
  ctx.shadowBlur = 20;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#05223f';
  ctx.font = 'bold 15px Poppins';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, x, y);
}

function drawLinks() {
  for (const [u, v, w] of links) {
    const a = nodes[u], b = nodes[v];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#4cc9f0';
    ctx.stroke();

    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 13px Poppins';
    ctx.fillText(String(w), mx, my - 8);
  }
}

function drawPacket() {
  if (!packet) return;
  const { x, y } = packet;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#ff6b6b';
  ctx.shadowColor = 'rgba(255,107,107,0.9)';
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function tickPacket() {
  if (!packet) return;
  const path = packet.path;
  if (packet.segment >= path.length - 1) {
    packet = null;
    return;
  }

  const from = nodes[path[packet.segment]];
  const to = nodes[path[packet.segment + 1]];
  packet.t += 0.02;
  if (packet.t >= 1) {
    packet.segment++;
    packet.t = 0;
    if (packet.segment >= path.length - 1) {
      packet = null;
      return;
    }
  }
  const f = nodes[path[packet.segment]];
  const t = nodes[path[packet.segment + 1]];
  packet.x = f.x + (t.x - f.x) * packet.t;
  packet.y = f.y + (t.y - f.y) * packet.t;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawLinks();
  for (const [name, pos] of Object.entries(nodes)) drawNode(name, pos);
  tickPacket();
  drawPacket();
  requestAnimationFrame(render);
}

function refillSelectors() {
  const options = Object.keys(nodes).map(n => `<option value="${n}">${n}</option>`).join('');
  sourceEl.innerHTML = options;
  destinationEl.innerHTML = options;
  sourceEl.value = 'A';
  destinationEl.value = 'F';
}

sendPacketBtn.addEventListener('click', () => {
  const src = sourceEl.value;
  const dst = destinationEl.value;
  if (src === dst) return;
  const path = shortestPath(src, dst);
  if (!path.length) {
    alert('No route found');
    return;
  }
  packet = { path, segment: 0, t: 0, x: nodes[src].x, y: nodes[src].y };
});

toggleLinkFailureBtn.addEventListener('click', () => {
  failedAD = !failedAD;
  if (failedAD) {
    links = links.filter(([u,v]) => !((u === 'A' && v === 'D') || (u === 'D' && v === 'A')));
    toggleLinkFailureBtn.textContent = 'Restore Link A-D';
  } else {
    links.push(['A', 'D', 5]);
    toggleLinkFailureBtn.textContent = 'Toggle Link A-D';
  }
  buildRoutingTable();
});

refillSelectors();
buildRoutingTable();
render();
