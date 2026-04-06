# Banking Transfer Demo — Temporal Money Transfer

A live, interactive demo showing how [Temporal](https://temporal.io) handles money transfers with durable execution. Send money through an iPhone-style banking app, watch the behind-the-scenes workflow execute in real time, and explore six different scenarios — from happy path to API downtime to human-in-the-loop approval.

## Quick Start

**Prerequisites:** [Temporal CLI](https://docs.temporal.io/cli) + either Docker or ([uv](https://docs.astral.sh/uv/) + [Node.js](https://nodejs.org/))

```bash
./scripts/start.sh
```

The script auto-detects your environment:

| Has Docker? | What happens |
|---|---|
| Yes | Temporal CLI on host, backend/worker/frontend in containers |
| No | Everything runs locally as background processes |

Open http://localhost:5173 once it's running. Temporal UI at http://localhost:8233.

## The Demo

### 1. Send a transfer (Happy Path)

Browse your accounts, pick a sender and recipient, enter an amount, and confirm. The behind-the-scenes panel shows each workflow activity executing. The code panel on the right shows the actual workflow code lighting up in real time.

### 2. Explore the six scenarios

Click the gear icon to switch scenarios:

| Scenario | What Happens | Key Temporal Feature |
|---|---|---|
| **Happy Path** | Validate, Withdraw, Deposit, Notify — all succeed | Basic workflow orchestration |
| **Advanced Visibility** | Same as happy path + search attribute updates at each step | Search attributes, observability |
| **Human-in-the-Loop** | Pauses for bank employee approval (30s timeout) | Signals, wait_condition, timeout |
| **API Downtime** | Deposit fails ~5 times, retries with backoff, then recovers | Retry policies, exponential backoff |
| **Bug in Workflow** | Intentional error after withdraw — compensation runs | Saga compensation, versioning concept |
| **Invalid Account** | Validation fails immediately, non-retryable | Non-retryable errors |

### 3. Bank Operations tab

Switch to the **Bank Operations** tab to act as a bank employee. When running the Human-in-the-Loop scenario, pending transfers appear here for approval or denial. If you don't act within 30 seconds, the transfer times out and compensation runs automatically.

### 4. Inspect real workflows

The Temporal UI at http://localhost:8233 shows actual workflow executions with full event history.

## Architecture

```
Browser (React + Vite + Tailwind)
    | REST + SSE
FastAPI Backend (Python)
    |-- Mock Bank Services (validate, withdraw, deposit)
    |-- Internal API (failure state, SSE events, approvals)
    +-- Temporal client (starts workflows, sends signals)
           |
Temporal Dev Server (CLI, on host)
           |
Python Worker
    |-- AccountTransferWorkflow (happy path)
    |-- AccountTransferWorkflowScenarios (dynamic, 5 other scenarios)
    +-- Activities -> Backend internal API
```

Two workflow classes mirror the [money-transfer-demo](https://github.com/temporal-sa/money-transfer-demo) pattern:
- **`AccountTransferWorkflow`** — clean happy path
- **`AccountTransferWorkflowScenarios`** — `@workflow.defn(dynamic=True)`, branches on workflow type name for the other 5 scenarios

## Transfer Flow

1. **Validate** — check accounts exist and amount is valid
2. **Withdraw** — remove funds from source account (register compensation first)
3. **[Approval]** — wait for bank employee signal (Human-in-the-Loop only)
4. **Deposit** — add funds to destination account (retries on API Downtime)
5. **Notify** — send success notification

**Compensation (saga pattern):** If any step after withdrawal fails, the workflow reverses the withdrawal automatically and notifies the customer. No manual intervention needed.

## Project Structure

```
├── frontend/              # React 19 + Vite + TypeScript + Tailwind 4
│   └── src/components/    # PhoneFrame, TransferTracker, BankOperations, etc.
├── backend/               # FastAPI + mock bank services (Python)
├── workflows/python/      # Python worker — two workflow classes + activities
├── docker/                # Dockerfiles + nginx config
├── docker-compose.yml     # Backend, worker, frontend containers
└── scripts/start.sh       # One-command launcher
```

## Development

```bash
# Install dependencies
uv sync --all-packages && cd frontend && npm install

# Run individual services
temporal server start-dev                                                             # Temporal on :7233
uv run --package banking-demo-backend server                                          # FastAPI on :8000
BANKING_BACKEND_URL=http://localhost:8000 uv run --package banking-demo-workflows worker  # Python worker
cd frontend && npm run dev                                                            # Vite on :5173
```

## Settings

Click the gear icon to configure:
- **Transfer Scenario**: Happy Path, Advanced Visibility, Human-in-the-Loop, API Downtime, Bug in Workflow, Invalid Account
- **Presentation Mode**: Simple (high-level) vs Detailed (retries, error messages, payloads)
