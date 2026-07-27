# Ideas — making tickets a self-contained build platform

Goal: a personal hub where projects, tickets, agents, code, and errors all live in
one place — build features without leaving the app.

Difficulty ◆ (easy) → ◆◆◆◆◆ (hard) · Importance ★☆☆☆☆ → ★★★★★

## 🌐 Infrastructure / hosting

| # | Idea | Diff | Imp | Depends |
|---|------|:---:|:---:|---|
| 1 | Domain + TLS — Caddy + Cloudflare wildcard `*.dev.bendelhome.cc` | ◆◆ | ★★★★★ | — |
| 2 | Project domains — `items-app.dev.bendelhome.cc` routing | ◆◆ | ★★★★☆ | 1 |
| 8 | Per-branch databases | ◆◆◆ | ★★★☆☆ | — |
| 9 | Preview env per worktree | ◆◆◆◆◆ | ★★★★★ | 1,2,6,8 |
| 10 | Ephemeral env GC | ◆◆ | ★★★★☆ | 9 |

## 🔀 Git & code

| # | Idea | Diff | Imp | Depends |
|---|------|:---:|:---:|---|
| 6 | Git / PR state on ticket | ◆◆◆ | ★★★★★ | — |
| 7 | Inline diff viewer | ◆◆ | ★★★★☆ | 6 |
| 11 | Preview URL on ticket | ◆ | ★★★★☆ | 9 |
| 23 | Visual / screenshot diff | ◆◆◆ | ★★☆☆☆ | 7 |

## 🏠 Daily-driver surface

| # | Idea | Diff | Imp | Depends |
|---|------|:---:|:---:|---|
| 3 | Home / inbox screen | ◆◆ | ★★★★★ | — |
| 5 | Notifications | ◆◆ | ★★★★☆ | 1,3 |
| 13 | Permission inbox | ◆◆ | ★★★★☆ | 3 |
| 19 | Quick capture | ◆◆ | ★★★☆☆ | 3 |
| 21 | Command palette (⌘K) | ◆◆ | ★★★☆☆ | — |

## 🤖 Agents & automation

| # | Idea | Diff | Imp | Depends |
|---|------|:---:|:---:|---|
| 12 | Dispatch board | ◆◆ | ★★★★☆ | — |
| 14 | Event bus (TIX-109) | ◆◆◆ | ★★★★☆ | — |
| 18 | Scheduled dispatch | ◆◆ | ★★★☆☆ | 14 |
| 20 | AI ticket drafting | ◆◆ | ★★★☆☆ | — |
| 24 | Voice capture | ◆◆◆ | ★★☆☆☆ | 1 |

## 🐛 Error tracking

| # | Idea | Diff | Imp | Depends |
|---|------|:---:|:---:|---|
| 15 | Error ingest (self-hosted, no Sentry) | ◆◆◆ | ★★★★☆ | — |
| 16 | Triage agent (error → diagnosed ticket → fix) | ◆◆◆ | ★★★★★ | 12,15 |

## 📋 Tracker hygiene / meta

| # | Idea | Diff | Imp | Depends |
|---|------|:---:|:---:|---|
| 4 | Auto-close + epic rollup | ◆ | ★★★☆☆ | — |
| 17 | Docs-as-ticket-type | ◆ | ★★★☆☆ | — |
| 22 | Metrics (cycle time, agent cost) | ◆◆ | ★★☆☆☆ | — |

## Milestones

- **M1 — Daily driver:** 1, 2, 3, 4, 5
- **M2 — Verify loop:** 6, 7, 8, 9, 10, 11, 12, 13
- **M3 — Automation:** 14, 15, 16, 18, 20, 21, 22, 23, 24

## Keystones (unblock the most)

- **#1 Domain** → hosting, preview envs, voice, notifications
- **#6 Git** → diff, preview, review
- **#3 Home** → notifications, permission inbox, capture
- **#14 Event bus** → triage, scheduling, notifications

---

## First up: Error tracking (self-hosted)

See the "what we need to do" breakdown being drafted below / in the spec.
