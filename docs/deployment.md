# Deploying Sugacoco on Webuzo

One Node.js app serves both the API (`/api/...`) and the React app. MySQL/MariaDB holds the data; uploaded files live on disk.

## 1. Requirements
- Node.js 20 or newer (Webuzo → Application Manager / Node.js)
- MySQL 5.7+ or MariaDB 10.4+ (Webuzo → Databases)
- SSH access (recommended) for `npm` and migrations
- HTTPS on the domain (the login cookie is `Secure` in production)

## 2. Database
1. Create a database (e.g. `sugacoco_db`) and a user with full rights on it.
2. Note the host, port, user and password for `.env`.

## 3. Upload the code
Upload the project **without** `node_modules`, `client/dist`, `server/dist` and `server/.env`.
Keep uploads outside the app folder so redeploys never delete them, e.g. `/home/<user>/sugacoco-uploads`.

## 4. Configure `server/.env`
Copy `server/.env.example` to `server/.env` and set:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Port Webuzo gives the app |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | From step 2 |
| `JWT_SECRET` | Long random string (32+ chars). `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `TRACKING_LINK_KEY` | 64 hex chars. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. **Never change it** after links are shared, or "Copy link" stops working for old links (customers' links keep working). |
| `UPLOAD_DIR` | Absolute path from step 3 |
| `CLIENT_ORIGIN` / `PUBLIC_APP_URL` | `https://your-domain` |
| `COMPANY_NAME` / `COMPANY_SUPPORT_EMAIL` / `COMPANY_SUPPORT_PHONE` | Shown on the customer tracking page |

The server refuses to start in production without a proper `JWT_SECRET` and `TRACKING_LINK_KEY`.

## 5. Build and migrate (SSH, in the project folder)
```bash
npm run install:all
npm run build                         # builds server/dist and client/dist
npm run migrate:prod --prefix server  # creates / updates tables
```

## 6. First admin user
```bash
npm run user:create:prod --prefix server -- --name "MD" --email md@company.com --role ADMIN --password "ChangeMe123"
```
Then sign in as MD/Admin and add the other staff from **Users**.

## 7. Start the app in Webuzo
- Application root: `<project>/server`
- Start command: `node dist/index.js`
- Environment: `NODE_ENV=production` (also read from `.env`)
- Map the domain to the app port. Webuzo's proxy forwards HTTPS to Node (the app trusts one proxy hop).

Check: `https://your-domain/api/health` → `{"status":"ok","db":"connected"}`.

## 8. Updating
```bash
git pull   # or upload the new files
npm run install:all && npm run build && npm run migrate:prod --prefix server
```
Restart the app in Webuzo. Migrations only add changes; they never drop data.

## 9. Backups (document Section 9)
- **Database**: daily `mysqldump --single-transaction sugacoco_db > sugacoco-$(date +%F).sql` (Webuzo → Backups or a cron job). Keep 30 days, one copy off the server.
- **Files**: back up `UPLOAD_DIR` daily (incremental is fine).
- **Restore test**: once a month restore the latest dump into a test database and open a few orders.

## 10. Do not use dev data in production
`npm run seed:dev` (test logins) is blocked when `NODE_ENV=production`. Never copy the dev database to production.
