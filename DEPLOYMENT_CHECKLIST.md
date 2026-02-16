# Railway Deployment Checklist

Complete these steps in order:

## ✅ Step 1: Configure Validator Service
1. Go to Railway → `@agentmanifest/validator` → Settings → General
2. Set **Root Directory** to: `validator`
3. Save

## ✅ Step 2: Configure Registry Service
1. Go to Railway → `@agentmanifest/registry` → Settings → General
2. Set **Root Directory** to: `registry`
3. Save

## ✅ Step 3: Add PostgreSQL Database
1. In Railway project, click **+ New**
2. Select **Database** → **PostgreSQL**
3. Wait for it to provision

## ✅ Step 4: Link Database to Registry
1. Go to `@agentmanifest/registry` → **Variables**
2. Click **+ New Variable** → **Reference**
3. Select your PostgreSQL database
4. Choose variable: `DATABASE_URL`
5. Save

## ✅ Step 5: Add Registry Environment Variables
In `@agentmanifest/registry` → **Variables**, add:
- `VALIDATOR_URL`: `https://validator.agent-manifest.com`
- `REGISTRY_URL`: `https://api.agent-manifest.com`
- `NODE_ENV`: `production`

## ✅ Step 6: Wait for Deployment
Both services will automatically redeploy. Watch the **Deployments** tab for each service.

## ✅ Step 7: Test Endpoints

```bash
# Test validator
curl https://validator.agent-manifest.com/health

# Test registry
curl https://api.agent-manifest.com/health

# List categories
curl https://api.agent-manifest.com/categories
```

---

**Note**: The start commands are already configured in `nixpacks.toml` files - Railway will use them automatically once root directories are set!
