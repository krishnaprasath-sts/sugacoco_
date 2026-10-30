# Sugacoco Order Management

Web app for the full export order flow: **PI → advance payment → QC / production → packaging → container & loading → balance payment → gate-in & document release → final closure**, with a read-only tracking link for customers.

React + TypeScript + MUI (client) · Node + Express + TypeScript (server) · MySQL/MariaDB with raw SQL (mysql2)

## Roles
| Role | Main screens |
|---|---|
| Sales | Dashboard, orders, create/edit PI, customers, advance & balance payments, customer credit use, tracking link |
| Accounts | Verification queue (advance/balance), final verification & closure, refunds & withheld, closed orders, reports |
| QC / Production | QC work queue: sourcing, ready date (reason on change), quality check, images, mark ready for packaging |
| Packaging | Packaging queue: status, dates, quantity, issues/rework, photos, mark completed |
| Documentation | Containers, loading, gate-in (only after balance approved), bill release, complete documentation |
| MD / Admin | Overview, all orders, pending actions, customers, cancel order, cancellations, reports, audit log, users |
| Customer | `/track/<token>` read-only status page, no login |

QC and Packaging never see prices or payment documents (unless MD/Admin allows it per user).

## Setup (dev)
1. Start **MySQL** in XAMPP.
2. `npm run install:all`
3. Copy `server/.env.example` to `server/.env` (set `TRACKING_LINK_KEY`, see the comment in the file).
4. `npm run migrate` creates `sugacoco_db` and its tables.
5. `npm run seed:dev --prefix server` creates one test login per role (see **Test logins** below).
6. `npm run dev`
   - Client: http://localhost:5180
   - API: http://localhost:5050/api/health

## Test logins (dev only)
Created by `npm run seed:dev --prefix server`. Sign in at http://localhost:5180. Do not use these on production.

| Role | Login ID (email) | Password |
|---|---|---|
| Sales | `sales@sugacoco.test` | `Sugacoco@123` |
| Accounts | `accounts@sugacoco.test` | `Sugacoco@123` |
| QC / Production | `qc@sugacoco.test` | `Sugacoco@123` |
| Packaging | `packaging@sugacoco.test` | `Sugacoco@123` |
| Documentation | `docs@sugacoco.test` | `Sugacoco@123` |
| MD / Admin | `admin@sugacoco.test` | `Sugacoco@123` |
| Customer | No login. Opens the `/track/<token>` link that Sales shares. | |

## Tests
With the dev server running: `npm run test:e2e --prefix server`
Runs 60 API checks over the whole lifecycle (both rejections, gate-in rule, pricing hidden from QC, bad dates/amounts, refunds, zero-advance orders, tracking link, credit, cancel, reports).

## Folders
```
client/src/pages/      Screens per department (sales, accounts, qc, packaging, documentation, admin, reports)
client/src/theme.ts    Design tokens (Chola CRM style; rules in design-system/sugacoco/MASTER.md)
server/src/routes/     API per area; every route checks the role
server/src/workflow/   Status list, who may move an order where, file category rules
server/migrations/     Numbered .sql files. Add new files; never edit applied ones.
server/scripts/        End-to-end test
docs/                  database.md, deployment.md
```

## Production
See [docs/deployment.md](docs/deployment.md) for Webuzo: build, migrate, first admin user, start command, backups.
