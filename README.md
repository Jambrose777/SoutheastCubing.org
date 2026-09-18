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

- Run `cd frontend && pnpm build` (equivalent to `ng build --configuration production`)
  to build the project. The build artifacts will be stored in the `frontend/dist/`
  directory.
- Compress `frontend/dist/`
- Upload dist.zip file onto AWS S3
- Make the dist.zip public using acl
- Copy the URL for dist.zip
- SSH into AWS EC2 instance
- navigate to relevant folder `cd /var/www/html`
- remove current contents `rm -rf *`
- import dist file into EC2 instance `wget {S3 Object URL}` Replace {} with URL from S3 Object
- unzip the compressed folder `unzip dist.zip`
- move files into correct folder `mv dist/southeast-cubing/browser/* .`
- restart server `service httpd restart` or start server `service httpd start`

## BE Development setup

The backend needs two secret/config files that are never committed to the repo, both
living under `backend/.env/`:

- `.env` — environment variables consumed via Node's built-in `--env-file` flag
  (email credentials, AWS keys, Contentful API keys, Discord webhook URL). `.env` is
  gitignored and never committed - `backend/.env/.env.template` is the only checked-in
  reference for which variables exist and how to obtain each one. Copy
  `backend/.env/.env.template` to `backend/.env/.env` and fill in the blanks - the
  template only lists safe "Local Development" values (values that never touch real
  org inboxes or the real Southeast Cubing Discord server).
- `southeastcubing-org-api.json` — a Google service account credentials file used to
  authenticate against the Google Forms API (reading the volunteer sign-up form). If
  this file is missing, the competitions update flow degrades gracefully (volunteer
  form data is simply treated as empty) instead of breaking.

Neither file is checked into source control, and there's no secrets manager for this
project — request both files directly from Jacob (org admin) and share/receive them,
then place them in `backend/.env/`.

### Dev Aurora DSQL cluster

The backend also connects to a dev Aurora DSQL cluster (`backend/app/database/pool.js`)
using IAM token authentication — no database password to request. `backend/.env/.env`
needs:

- `DSQL_ENDPOINT` — the dev cluster's endpoint (ask Jacob).
- `DSQL_GRANT_IAM_ARN` — your own IAM user's ARN, only needed once to run the
  one-time role bootstrap below.

Ask Jacob to create you an IAM user granted `dsql:DbConnect` (used by the running
backend) and `dsql:DbConnectAdmin` (used only by the bootstrap script below) on the
cluster, and set its access key/secret as your own `AWS_ACCESS_KEY_ID`/
`AWS_SECRET_ACCESS_KEY` (see above). With those in place, run the one-time role
bootstrap — it links your IAM user to the non-admin `app_dev` database role the
backend authenticates as (`backend/scripts/bootstrap-dsql-role.js`):

```bash
pnpm --filter backend bootstrap-dsql-role
```

## BE Development server

Run `pnpm --filter backend dev` (or `cd backend && pnpm dev`), equivalent to
`node --env-file=.env/.env server.js`.

## Database migrations

The competitions schema (tables/grants/seed data) is defined as one-statement-per-
file migrations under `backend/app/database/migrations/`, since DSQL only allows one DDL
statement per transaction and never allows DDL/DML mixed in one transaction. Apply
any pending migrations — safe to re-run any time, it only applies files it hasn't
recorded as already applied (`backend/scripts/migrate.js`):

```bash
pnpm --filter backend migrate
```

After applying a new migration, regenerate the read-only schema snapshot
(`backend/app/database/schema-snapshot.sql`) — it queries the live schema on the dev
cluster and formats it as one table per block, so it always reflects the
current columns/constraints even across multiple migrations touching the same
table. This file is generated and never hand-edited or applied directly
(`backend/scripts/generate-schema-snapshot.js`):

```bash
pnpm --filter backend schema-snapshot
```

## BE Deployment

- cd SoutheastCubing.org
- git pull
- pnpm install --filter backend
- systemctl restart api.service

## BE Status

- systemctl status api.service
- systemctl status nginx

# FE Fetch a new SSL certificate

- sudo certbot --apache

# BE Fetch a new SSL certificate

- sudo certbot --nginx
