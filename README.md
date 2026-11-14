# Sugacoco Order Management

Web app for the full export order flow: **PI → advance payment → QC / production → packaging → container & loading → balance payment → gate-in & document release → final closure**, with a read-only tracking link for customers.

React + TypeScript + MUI (client) · Node + Express + TypeScript (server) · MySQL/MariaDB with raw SQL (mysql2)

## Roles
These are the six built-in roles and what they can do at the start. MD/Admin can change this (see **Roles & permissions** below).

| Role | Main screens |
|---|---|
| Sales | Dashboard, orders, create/edit PI, customers, advance & balance payments, customer credit use, tracking link |
| Accounts | Verification queue (advance/balance), final verification & closure, refunds & withheld, closed orders, reports |
| QC / Production | QC work queue: sourcing, ready date (reason on change), quality check, images, mark ready for packaging |
| Packaging | Packaging queue: status, dates, quantity, issues/rework, photos, mark completed |
| Documentation | Containers, loading, gate-in (only after balance approved), bill release, complete documentation |
| MD / Admin | Overview, all orders, pending actions, customers, cancel order, cancellations, reports, audit log, products, users |
| Customer | `/track/<token>` read-only status page, no login |

QC and Packaging never see prices or payment documents (unless MD/Admin allows it per user).

### Roles & permissions
MD/Admin opens **Administration → Roles & Permissions** to:
- tick or untick what each role can do (20 permissions in 5 groups: Sales, Accounts, Operations, Management, Administration),
- create a new role (empty, or copied from another role), e.g. "Sales Manager", then give it to users on the Users screen,
- compare all roles side by side, rename roles, and delete custom roles nobody uses.

Rules:
- Menus, pages, buttons and every API route check the user's permissions, never the role name. Permission keys live in `server/src/auth/permissions.ts` (client mirror in `client/src/auth/roles.ts`).
- Changes apply on the user's next click; nobody has to log in again.
- Some permissions need another one (e.g. *Verify payments* needs *See prices and payments*); it is ticked automatically.
- The built-in MD/Admin role always keeps *Users* and *Roles and permissions*, and nobody can remove *Roles and permissions* from their own role, so access can't be locked out.
- Built-in roles can't be deleted. A custom role can be deleted only when no user (active or not) has it.
- The six departments still decide who acts next on an order ("Waiting for Accounts"); a custom role acts at a stage if it has that stage's permission.
- Every role change is in the audit log (`ROLE_CREATED`, `ROLE_UPDATED`, `ROLE_DELETED`).

Products: MD/Admin adds, edits and hides products under **Inventory → Products**. Sales can only pick active products on an order. Hiding a product never changes old orders.

Reports (sidebar **Analytics → Reports**, a dropdown): **Sales-wise Report** (orders, customers, value, received and outstanding per sales person), **Product-wise Report** (orders, quantity, value and average price per product), and **Orders & Balances** (order list and customer balances). All have PI-date and open/closed filters and download as Excel, PDF or CSV. Cancelled orders are not counted in the sales-wise and product-wise reports.

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
Runs 81 API checks over the whole lifecycle (both rejections, gate-in rule, pricing hidden from QC, bad dates/amounts, refunds, zero-advance orders, tracking link, credit, cancel, reports incl. sales-wise and product-wise, custom roles and permissions).

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
