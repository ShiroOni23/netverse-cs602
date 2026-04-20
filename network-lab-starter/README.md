# Network Lab Starter

Browser-based interactive simulator for CS602 hands-on networking labs.

## Run
Open `index.html` in browser (or use VS Code Live Server).

## What Students Can Learn
- Compare routing behavior across 3 topology presets (Campus, ISP Core Ring, Enterprise WAN)
- Watch Dijkstra shortest-path updates step-by-step
- Inject random link failures and observe convergence impact
- Generate manual + automatic packet traffic to measure packet loss
- Inspect per-node routing tables with next-hop and total cost

## Suggested Lab Activities
1. Switch topology and compare route cost from source to destination.
2. Start auto traffic, fail 2-3 links, and record delivery/loss trends.
3. Analyze Dijkstra steps and explain why a new path is selected.
4. Restore links and verify routing table convergence.

## Extension Tasks
1. Add support for directed links and asymmetric costs.
2. Visualize distance-vector updates over time.
3. Export event log and routing table snapshots as JSON.
4. Add ECMP (equal-cost multipath) visualization.
