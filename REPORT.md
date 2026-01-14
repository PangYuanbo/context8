# Context8 — Research Track Report

**Repository (public)**: https://github.com/PangYuanbo/context8  
**Branch**: `main`  
**MCP package**: `context8-mcp@1.0.3` (npm, `latest`)

## 1) Abstract

Vibe Coding is fast at generating code, but slow and unstable at debugging: the same categories of failures repeat across iterations, fixes get lost in chat history, and “what worked” often depends on hidden context like dependency versions or environment details. Context8 is a research project that adds a **persistent debugging memory layer** via **Model Context Protocol (MCP)**. When an error is resolved, the solution is saved as a structured, privacy-preserving record (context, root cause, fix steps, tags, and environment snapshot). When a new error appears, Context8 enables the agent to search past solutions using hybrid retrieval and reuse proven fixes. Over repeated iterations in the same project, this memory accumulates, improving both **debugging speed** and **accuracy**. In SWE-bench-style repeated evaluation settings, the same mechanism supports iterative performance improvements by increasing solution recall and reducing repeated investigation.

## 2) Problem Statement

Debugging in real software projects suffers from:

- **Non-persistent reasoning**: fixes are buried in logs or chats and are not reusable.
- **Repeated failure patterns**: similar issues recur across dependency upgrades, refactors, and regressions.
- **Missing applicability context**: a fix may only apply to certain versions or runtime constraints.
- **High rework cost**: each recurrence forces rediscovery from scratch.

The research hypothesis is that a **structured, searchable memory** of past debugging trajectories can reduce rework and improve stability across iterations.

## 3) Core Idea

Context8 treats debugging knowledge as data:

1. **Capture**: store each resolved error as an abstracted technical pattern (not project-specific business logic).
2. **Retrieve**: use hybrid retrieval (semantic + keyword-style matching) to find similar solutions quickly.
3. **Reuse**: apply the retrieved solution as a starting point for the next fix.
4. **Accumulate**: each successful fix increases future recall and reduces repeated reasoning.

## 4) System Architecture (Local + Cloud)

Context8 is designed to be modular and deployable in multiple environments.

### 4.1 MCP Server (Local-first, Cloud-optional)

Directory: `context8/`  
Runtime: Node.js + TypeScript, MCP stdio server.

Two modes:

- **Local mode (default when no remote config is resolved)**
  - Stores data in `~/.context8/solutions.db` (SQLite).
  - Optional dependencies for local embeddings and SQLite access are installed only when needed.
- **Remote mode (cloud)**
  - Uses a cloud backend via `CONTEXT8_REMOTE_URL` + `CONTEXT8_REMOTE_API_KEY`.
  - Keeps installation lightweight for ephemeral environments and multi-device use.

### 4.2 Cloud Backend (Optional)

Directory: `context8-CLI/`  
Runtime: FastAPI + Postgres (multi-tenant isolation; API Key + JWT).

Purpose:

- Remote storage/search for solutions
- Account + API key management
- Cloud-friendly deployment (e.g., Modal)

### 4.3 Frontend (Optional UI)

Directory: `context8-CLI/frontend/` (and `context8-cloud/frontend/` as an alternative UI entry)  
Purpose:

- Login/dashboard
- API key management
- Basic solution browsing

## 5) Data Model (Interpretability)

Each stored solution is structured to be interpretable and reusable:

- `title`, `errorMessage`, `errorType`
- `context`, `rootCause`, `solution`
- `tags`, `labels`
- `environment` snapshot (runtime + dependency versions, when provided)
- optional: `codeChanges`, `projectPath`

This structure makes “why a result matched” more traceable than unstructured chat logs and improves retrieval quality over time.

## 6) Installation & Usage (Reproducible)

### 6.1 MCP Installation (npx)

```bash
npx -y context8-mcp@1.0.3
```

### 6.2 Add to Claude Code (example)

```bash
claude mcp add context8 -- npx -y context8-mcp@1.0.3
```

### 6.3 Remote Mode (lightweight)

```bash
claude mcp add context8 \
  --env CONTEXT8_REMOTE_URL=https://api.context8.org \
  --env CONTEXT8_REMOTE_API_KEY=<your-api-key> \
  -- npx -y context8-mcp@1.0.3
```

### 6.4 Local Mode (optional deps)

Local mode supports richer local workflows (SQLite + embeddings) but requires optional dependencies:

```bash
npx -y context8-mcp@1.0.3 setup-local
```

### 6.5 Quick Diagnostics

```bash
npx -y context8-mcp@1.0.3 diagnose
```

### 6.6 User Workflow (conceptual)

1. When an error occurs, search similar solutions first.
2. Apply/adjust the best-matching fix.
3. After resolving, save the abstracted solution for future reuse.

## 7) Research Protocol (Iterative Improvement)

This project provides the memory layer; it can be integrated into many agent loops or benchmarks. A recommended evaluation protocol is:

- **Baseline**: run a coding/debug workflow without Context8 memory; record time-to-fix and success rate.
- **Memory-enabled**: before proposing a fix, search Context8; after resolving, save the solution.
- **Iterate**: repeat across project iterations or repeated task distributions.

Suggested metrics:

- Time-to-fix per task (median/mean)
- First-hit rate (how often retrieval finds a directly usable solution)
- Rework reduction (number of repeated investigations for similar failures)
- Stability across iterations (variance in solution quality over repeated runs)

The expected outcome is that the solution vault grows and improves recall, yielding faster and more consistent debugging over time—both in real projects and in SWE-bench-style repeated runs.

## 8) Privacy & Safety

Context8 enforces abstraction guidelines for stored solutions:

- Avoid project-specific identifiers (paths, internal URLs, proprietary names)
- Avoid secrets (API keys, credentials)
- Focus on technical patterns applicable across projects

Local mode keeps data on-device by default; remote mode requires explicit configuration and uses per-user isolation on the backend.

## 9) Limitations & Future Work

Limitations:

- Quantitative benchmark results depend on the external agent runner and task distribution.
- Remote mode depends on network stability and correct credential configuration.

Future work:

- Standardized evaluation harness + datasets for longitudinal debugging improvement
- Better tooling for measuring hit rates and time-to-fix automatically
- Broader integrations with additional MCP clients and CI workflows

## 10) Contribution / Division of Labor

This project was developed by a single author end-to-end: MCP server + CLI, local/remote modes, cloud backend, frontend UI, dataset tooling, and documentation.
