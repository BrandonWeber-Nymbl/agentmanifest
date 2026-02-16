# Integrating AgentManifest with BakeBase

This document explains how to add AgentManifest compliance to the BakeBase API.

## Overview

To make BakeBase discoverable in the AgentManifest registry, you need to:
1. Serve the manifest at `/.well-known/agent-manifest.json`
2. Ensure it passes validation
3. Submit to the registry

## Step 1: Add the Manifest Endpoint

### Option A: Static File (Simplest)

If BakeBase uses Express or a similar framework:

```javascript
// In your server setup file (e.g., server.js, app.js, index.js)

app.use('/.well-known', express.static('public/.well-known'));
```

Then place the manifest file at:
```
public/.well-known/agent-manifest.json
```

### Option B: Dynamic Route

```javascript
const agentManifest = require('./agent-manifest.json');

app.get('/.well-known/agent-manifest.json', (req, res) => {
  res.json(agentManifest);
});
```

### Option C: Standalone Endpoint (for any framework)

Add this route to your API:

```javascript
app.get('/.well-known/agent-manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    spec_version: "agentmanifest-0.1",
    name: "BakeBase",
    version: "1.0.0",
    description: "AI-first food science reference API covering the functional properties of baking ingredients. Returns hydration ratios, protein interactions, leavening chemistry, pH profiles, substitution logic, and ingredient combination analysis. Designed for AI agents building food, recipe, and culinary applications. Use this when you need scientifically accurate information about how baking ingredients behave and interact.",
    // ... rest of manifest (see BAKEBASE_MANIFEST.json)
  });
});
```

## Step 2: Update the Manifest for Your Actual Endpoints

The manifest in `BAKEBASE_MANIFEST.json` makes assumptions about your API structure. Update it to match your actual endpoints:

1. **Verify endpoint paths** - Check that `/ingredient/:name`, `/category/:category`, `/combine`, and `/search` match your actual routes
2. **Update parameter names** - Ensure parameter names and types match your API
3. **Adjust descriptions** - Make descriptions accurately reflect what your endpoints actually do
4. **Set realistic rate limits** - Update `queries_per_day` if you have different limits
5. **Update version** - Set the version to match your API's actual version

## Step 3: Test Locally

Before deploying, test that your manifest is accessible:

```bash
# Start BakeBase locally
npm start

# In another terminal, fetch the manifest
curl http://localhost:YOUR_PORT/.well-known/agent-manifest.json

# Should return valid JSON
```

## Step 4: Validate

After deploying to Railway:

```bash
# From the agentmanifest directory
cd validator
npm run cli -- validate https://bakebase-production.up.railway.app

# Should see all checks passing
```

## Step 5: Submit to Registry (After Deployment)

Once BakeBase is deployed with the manifest:

```bash
curl -X POST https://your-registry-url/listings/submit \
  -H "Content-Type: application/json" \
  -d '{"url": "https://bakebase-production.up.railway.app"}'
```

Or test locally with the registry:

```bash
# Start the local registry first (see main README)
curl -X POST http://localhost:3002/listings/submit \
  -H "Content-Type: application/json" \
  -d '{"url": "https://bakebase-production.up.railway.app"}'
```

## Important Notes

### Endpoint Discovery

The validator will attempt to test your GET endpoints. Make sure:
- GET endpoints return 200 or 404 (not 500)
- GET endpoints that require parameters return appropriate error messages
- POST endpoints are documented but won't be tested automatically

### CORS

If you want the registry validator to access your manifest, ensure CORS is enabled:

```javascript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
```

### Content-Type

The manifest endpoint **must** return `Content-Type: application/json`. Express does this automatically when you use `res.json()`, but if you're using a different framework, set it explicitly.

### Well-Known Directory

The `/.well-known/` path is a standard for service metadata. By serving your manifest here, you're following the same convention as:
- `/.well-known/security.txt` (security disclosures)
- `/.well-known/change-password` (password reset)
- `/.well-known/webfinger` (identity discovery)

## Troubleshooting

**403 or 404 on manifest URL**
- Check that the route is registered
- Verify the path is exactly `/.well-known/agent-manifest.json`
- Ensure no middleware is blocking the route

**Validation fails on schema**
- Verify all required fields are present
- Check that arrays and objects match the schema
- Ensure categories are from the controlled vocabulary

**Validation fails on endpoints**
- Make sure GET endpoints return non-500 status
- Check that endpoint paths are correct
- Verify parameters match your actual API

**Can't submit to registry**
- Ensure manifest passes validation first
- Check that `listing_requested: true`
- Verify the URL is accessible from the internet

## Example Implementation for Express

Here's a complete example:

```javascript
const express = require('express');
const app = express();

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// Serve manifest
app.get('/.well-known/agent-manifest.json', (req, res) => {
  res.json({
    spec_version: "agentmanifest-0.1",
    name: "BakeBase",
    version: "1.0.0",
    // ... rest of manifest
  });
});

// Your existing API routes
app.get('/ingredient/:name', (req, res) => {
  // Your ingredient logic
});

// ... other routes

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BakeBase API running on port ${PORT}`);
  console.log(`Manifest available at: http://localhost:${PORT}/.well-known/agent-manifest.json`);
});
```

## Next Steps

1. Add the manifest endpoint to BakeBase
2. Deploy to Railway
3. Validate with `npx amp validate https://bakebase-production.up.railway.app`
4. Submit to the registry
5. Your API is now discoverable by AI agents!
