# SoutheastCubing

This project is for the organization website SoutheastCubing.org.
FE: Angular 22.1.5 (`frontend/`)
BE: NodeJs v24 LTS (`backend/`)
Content: Contentful CMS
Deployment: AWS
Package manager: pnpm (workspace linking `frontend/` and `backend/`)

See [ARCHITECTURE.md](ARCHITECTURE.md) for a diagram of the system.

## Local development setup

Install [pnpm](https://pnpm.io/installation), then from the repo root run
`pnpm install` once to install both `frontend/` and `backend/` dependencies.

Run `pnpm dev` from the repo root to start the frontend dev server (`ng serve`) and
the backend (`node --env-file=.env/.env server.js`) together. See "BE Development setup"
below for the backend's required secret/config files before running this.

## Linting & formatting

Prettier and ESLint are configured at the repo root and cover both `frontend/src/`
and `backend/` (there's no separate config for either) — see `.prettierrc` and
`eslint.config.js`.

- `pnpm run format` — formats the whole repo (`.ts`, `.html`, `.scss`, `.json`,
  `.md`) with Prettier.
- `pnpm run format:check` — checks formatting without writing; useful in CI or to
  verify before committing.
- `pnpm run lint` — lints `frontend/src/` (`@angular-eslint`) and `backend/` with
  ESLint.
- `pnpm run lint:fix` — same as above, auto-fixing what it can.

A `husky` + `lint-staged` pre-commit hook runs both automatically against staged
files on every `git commit` and blocks the commit if either fails, so these scripts
mainly matter for running them manually ahead of time.

## FE Development server

Run `pnpm --filter frontend dev` (or `cd frontend && pnpm dev`) for just the dev
server. Navigate to `http://localhost:4200/`. The application will automatically
reload if you change any of the source files.

## FE Deployment

The frontend is served from a private S3 bucket (`southeast-cubing.org`) behind
CloudFront, accessed only via Origin Access Control. Deploying is a build, a sync, and a cache invalidation:

- Run `cd frontend && pnpm build` (equivalent to `ng build --configuration production`)
  to build the project. The build artifacts land in
  `frontend/dist/southeast-cubing/browser/`.
- Sync the build to the bucket, using the dedicated `sec-frontend-deploy` AWS CLI
  profile (scoped to just this bucket and this CloudFront distribution):
  ```bash
  aws s3 sync frontend/dist/southeast-cubing/browser/ s3://southeast-cubing.org/ --delete --profile sec-frontend-deploy
  ```
- Invalidate CloudFront's edge cache so the new build is actually served - a sync
  alone doesn't bust already-cached files at the edge:
  ```bash
  aws cloudfront create-invalidation --distribution-id E129O9IT0X7NP2 --paths "/*" --profile sec-frontend-deploy
  ```

## BE Development setup

The backend's local configuration lives under `backend/.env/`. The `.env` file is
never committed; the checked-in `.env.template` is the reference for its variables.
Copy `backend/.env/.env.template` to `backend/.env/.env` and fill in the values needed
for the features you plan to use. The template uses safe local-development values;
keep production configuration and Drive folder IDs in the production environment.

- `southeastcubing-org-api.json` — the shared Google service-account credentials file
  used by both Google Forms (reading volunteer sign-ups) and Google Drive (Competition
  Planner folders). Create a Google Cloud API Key and give it access to relevant files or request
  access to the file from Jacob and place it at `backend/.env/southeastcubing-org-api.json`.
  The app starts without it: volunteer-form data is treated as empty, and Drive
  operations are unavailable (incidental Drive work is skipped).

For local Google Drive use, set the five optional `WCA_DRIVE_*_FOLDER_ID` variables in
`backend/.env/.env` to the local Mock WCA Drive tree's root and category folder IDs.
The service account must have access to those folders. Production uses the same
credentials file but its own production WCA Drive folder IDs in the production
environment.. If the folder IDs or credentials are missing, the backend still starts,
but direct Drive actions return an error and background/refresh Drive work is skipped.

The credentials file and `.env` are gitignored and never committed. There is no
secrets manager for this project; request the Google credentials, local Mock Drive
folder IDs/access, and any shared development configuration from Jacob (org admin).

### Dev Aurora DSQL cluster

The backend also connects to a dev Aurora DSQL cluster (`backend/app/database/pool.js`)
using IAM token authentication — no database password to request. `backend/.env/.env`
needs:

- `DSQL_ENDPOINT` — the dev cluster's endpoint (ask Jacob).
- `DSQL_GRANT_IAM_ARN` — your own IAM user's ARN, only needed once to run the
  one-time role bootstrap below.

Ask Jacob to create you an IAM user granted `dsql:DbConnect` (used by the running
backend) and `dsql:DbConnectAdmin` (used only by the bootstrap script below) on the
cluster, and set its access key/secret as your own `DSQL_ACCESS_KEY_ID`/
`DSQL_SECRET_ACCESS_KEY` (see above). With those in place, run the one-time role
bootstrap — it links your IAM user to the non-admin `app_dev` database role the
backend authenticates as (`backend/scripts/bootstrap-dsql-role.js`):

```bash
pnpm --filter southeastcubing-org-api bootstrap-dsql-role
```

## BE Development server

Run `pnpm --filter southeastcubing-org-api dev` (or `cd backend && pnpm dev`), equivalent to
`node --env-file=.env/.env server.js`.

Once running, interactive Swagger/OpenAPI docs for the backend's endpoints are
available at `http://localhost:8080/api-docs`.

## Database migrations

The competitions schema (tables/grants/seed data) is defined as one-statement-per-
file migrations under `backend/app/database/migrations/`, since DSQL only allows one DDL
statement per transaction and never allows DDL/DML mixed in one transaction. Apply
any pending migrations — safe to re-run any time, it only applies files it hasn't
recorded as already applied (`backend/scripts/migrate.js`):

```bash
pnpm --filter southeastcubing-org-api migrate
```

After applying a new migration, regenerate the read-only schema snapshot
(`backend/app/database/schema-snapshot.sql`) — it queries the live schema on the dev
cluster and formats it as one table per block, so it always reflects the
current columns/constraints even across multiple migrations touching the same
table. This file is generated and never hand-edited or applied directly
(`backend/scripts/generate-schema-snapshot.js`):

```bash
pnpm --filter southeastcubing-org-api schema-snapshot
```

## Backend backfill process

After confirming `backend/.env/.env` points to the intended dev DSQL cluster, run
pending database migrations, then run these backfills in order:

```bash
pnpm --filter southeastcubing-org-api migrate
pnpm --filter southeastcubing-org-api backfill-people-pictures
pnpm --filter southeastcubing-org-api backfill-delegate-bios
pnpm --filter southeastcubing-org-api import-competition-history
pnpm --filter southeastcubing-org-api import-multi-city-competition-history
```

The photo backfill mirrors WCA avatars for managed-photo people whose local
`picture_url` is missing. The Delegate-bio backfill copies Contentful descriptions
only into blank `delegates.bio` fields. The competition-history importers populate
past Southeast competitions from WCA and the manifests in `backend/scripts/`; the
standard importer runs before the separate multi-city importer. They reconcile
matching rows and can be rerun. The history importers write competition, event,
Delegate, and organizer data; resolving assignments may create missing WCA person
records. They do not post to Discord or fetch registration or waiting-list counts.

## BE Deployment

- cd SoutheastCubing.org
- git pull
- pnpm install --filter backend
- systemctl restart api.service

## BE Status

- systemctl status api.service
- systemctl status nginx

# BE Fetch a new SSL certificate

- sudo certbot --nginx -d api.southeastcubing.org
