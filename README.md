# CS602 Network Lab (Individual)

Interactive, animation-rich Computer Networks lab for **138 individual students**.

## Repo Model
- Main branch: `main`
- Student branches: `student-001` to `student-138`
- Work mode: **individual only** (one student per branch)

## Learning Goals
- Understand packet forwarding and route selection
- Visualize shortest-path routing (Dijkstra)
- Explore routing table updates and path changes under failures
- Build intuition through interactive network animations

## Starter Project
See [`network-lab-starter`](./network-lab-starter) for the browser-based routing simulator.

## Instructor Workflow
1. Push updates to `main`.
2. Generate student branches once: `python scripts/create_student_branches.py`.
3. (Later) Apply per-student push restrictions with mapping file:
   `python scripts/apply_individual_branch_protection.py --mapping student_map.csv`

## Mapping File Format
`student_map.csv`

```csv
branch,github_username
student-001,alice123
student-002,bob456
```

## Notes
- This repo structure is for **CS602 current cohort**.
- Future cohorts can use a different branch/team strategy.
