# Railway Deployment Guide

## Current Status

✅ **nixpacks.toml files are correctly configured**
✅ **Code is ready for deployment**
❌ **Registry needs PostgreSQL database**
⚠️ **Services need correct root directory configuration**

## Architecture

You have a monorepo with two services:
- **Validator**: Standalone validation service (no database needed)
- **Registry**: API + database service (requires PostgreSQL)

## Step 1: Configure Service Root Directories

Railway needs to know which directory each service should build from.

### For Validator Service:
1. Go to Railway Dashboard → `@agentmanifest/validator`
2. Click **Settings** → **General**
3. Find **Root Directory** setting
4. Set to: `validator`
5. Click **Save**

### For Registry Service:
1. Go to Railway Dashboard → `@agentmanifest/registry`
2. Click **Settings** → **General**
3. Find **Root Directory** setting
4. Set to: `registry`
5. Click **Save**

## Step 2: Add PostgreSQL Database

The registry service needs a database to store listings.

1. In Railway Dashboard, click **+ New** (top right)
2. Select **Database** → **PostgreSQL**
3. The database will be created in your project
4. Railway will automatically create a `DATABASE_URL` environment variable

## Step 3: Connect Database to Registry

1. Go to `@agentmanifest/registry` service
2. Click **Variables** tab
3. Verify `DATABASE_URL` exists and points to your new PostgreSQL database
4. If not, click **+ New Variable** → **Reference**
5. Select the PostgreSQL database → `DATABASE_URL`

## Step 4: Deploy

Both services will automatically redeploy when you:
- Set the root directories
- Add the database connection

Or you can manually trigger deployment:
1. Go to each service
2. Click **Deployments** tab
3. Click **Deploy** (top right)

## How nixpacks.toml Works

Railway automatically uses `nixpacks.toml` when it exists in the service root directory.

**Validator** (`validator/nixpacks.toml`):
```toml
[phases.setup]
nixPkgs = ["nodejs-18_x"]

[phases.install]
cmds = ["npm install"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm run start:web"
```

**Registry** (`registry/nixpacks.toml`):
```toml
[phases.setup]
nixPkgs = ["nodejs-18_x"]

[phases.install]
cmds = ["npm install"]

[phases.build]
cmds = [
  "npm run prisma:generate",
  "npm run build"
]

[start]
cmd = "npm run prisma:push && npm start"
```

The start command runs `prisma db push` (applies schema changes) then starts the app. **No seed** — production registry is populated via `POST /listings/submit`.

## Step 5: Verify Deployment

Once deployed, test both services:

```bash
# Validator health check
curl https://validator.agent-manifest.com/health

# Expected response:
{"status":"ok","service":"agentmanifest-validator","timestamp":"..."}

# Registry health check
curl https://api.agent-manifest.com/health

# Expected response:
{"status":"ok","service":"agentmanifest-registry","timestamp":"...","database":"connected"}

# List categories
curl https://api.agent-manifest.com/categories

# Expected response:
{"categories":["data","automation","messaging","ai",...]}
```

## Troubleshooting

### Validator returns 502
- Check that root directory is set to `validator`
- Check deployment logs for build errors
- Verify PORT environment variable is set (default: 3001)

### Registry returns 502
- Check that root directory is set to `registry`
- Verify DATABASE_URL is configured
- Check deployment logs for Prisma errors

### Database connection errors
- Ensure PostgreSQL database is running
- Verify DATABASE_URL format: `postgresql://user:pass@host:port/db`
- Check that registry service references the correct database

## Environment Variables

### Validator
- `PORT`: 3001 (auto-set by Railway)
- `JWT_SECRET`: (optional for JWT verification)
- `NODE_ENV`: production

### Registry
- `PORT`: 3002 (auto-set by Railway)
- `DATABASE_URL`: (auto-set when database is linked)
- `VALIDATOR_URL`: https://validator.agent-manifest.com
- `REGISTRY_URL`: https://api.agent-manifest.com
- `NODE_ENV`: production

## Schema Changes on Deploy

`prisma db push` runs on every deploy and applies schema changes (e.g. `validation_result` replacing `badges`). No migration files needed. Existing listings keep working; new submissions get full validation results.

## Next Steps After Deployment

1. **Test the validator**:
   ```bash
   curl -X POST https://validator.agent-manifest.com/validate \
     -H "Content-Type: application/json" \
     -d '{"url": "https://bakebase.agent-manifest.com/.well-known/agent-manifest.json"}'
   ```

2. **Submit an API to the registry**:
   ```bash
   curl -X POST https://api.agent-manifest.com/listings/submit \
     -H "Content-Type: application/json" \
     -d '{"url": "https://bakebase.agent-manifest.com"}'
   ```

## File Structure

```
agentmanifest/
├── validator/
│   ├── nixpacks.toml          ← Railway uses this automatically
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
├── registry/
│   ├── nixpacks.toml          ← Railway uses this automatically
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   └── src/
├── railway.toml               ← Root config (mostly ignored)
└── railway.json               ← Root config (remove if causing issues)
```

## Optional: Remove Conflicting Configs

The root-level `railway.json` might be causing conflicts. Consider deleting it since each service has its own `nixpacks.toml`:

```bash
git rm railway.json
git commit -m "Remove conflicting railway.json, use nixpacks.toml per service"
git push
```
