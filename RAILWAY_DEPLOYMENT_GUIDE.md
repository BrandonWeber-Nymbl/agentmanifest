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
cmd = "npm run prisma:push && npm run prisma:seed && npm start"
```

The start commands are already defined - Railway will use them automatically once the root directories are set correctly.

## Step 5: Verify Deployment

Once deployed, test both services:

```bash
# Validator health check
curl https://agentmanifestvalidator-production.up.railway.app/health

# Expected response:
{"status":"ok","service":"agentmanifest-validator","timestamp":"..."}

# Registry health check
curl https://agentmanifestregistry-production.up.railway.app/health

# Expected response:
{"status":"ok","service":"agentmanifest-registry","timestamp":"...","database":"connected"}

# List categories
curl https://agentmanifestregistry-production.up.railway.app/categories

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
- `VALIDATOR_URL`: http://agentmanifestvalidator-production.up.railway.app
- `REGISTRY_URL`: https://agentmanifestregistry-production.up.railway.app
- `NODE_ENV`: production

## Next Steps After Deployment

1. **Test the validator**:
   ```bash
   curl -X POST https://agentmanifestvalidator-production.up.railway.app/validate \
     -H "Content-Type: application/json" \
     -d '{"url": "https://bakebase-production.up.railway.app/.well-known/agent-manifest.json"}'
   ```

2. **Add manifest to BakeBase** (follow `BAKEBASE_INTEGRATION.md`)

3. **Submit BakeBase to registry**:
   ```bash
   curl -X POST https://agentmanifestregistry-production.up.railway.app/listings/submit \
     -H "Content-Type: application/json" \
     -d '{"manifestUrl": "https://bakebase-production.up.railway.app/.well-known/agent-manifest.json"}'
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
