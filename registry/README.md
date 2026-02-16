# AgentManifest Registry

Public registry for AI-agent-ready APIs that comply with the AgentManifest specification.

## Purpose

The registry is a queryable index of verified APIs that AI agents can use to discover data sources at runtime. Every listed API has passed validation and serves a compliant manifest.

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Set up database
createdb agentmanifest_registry  # PostgreSQL
echo "DATABASE_URL=postgresql://user:password@localhost:5432/agentmanifest_registry" > .env

# Generate Prisma client and run migrations
npm run prisma:generate
npm run prisma:push

# Seed database
npm run prisma:seed

# Start the registry
npm run dev
```

The registry will be available at `http://localhost:3002`.

### Docker Compose (Recommended)

See the root `docker-compose.yml` for running the entire stack (validator + registry) locally.

## API Endpoints

### For AI Agents

- `GET /agents` - Complete guide on how to use the registry
- `GET /listings` - Discover all verified APIs
  - Query params: `?category=food-science`, `?primary_category=reference`, `?pricing_model=free`, `?auth_required=false`, `?q=search`
- `GET /listings/:id` - Get full details for a specific API

### For Humans

- `GET /categories` - Browse available categories with counts
- `GET /health` - Health check

### For API Publishers

- `POST /listings/submit` - Submit your API for validation
- `GET /listings/submit/:id/status` - Check submission status

## Submitting Your API

1. Ensure your API serves a valid manifest at `/.well-known/agent-manifest.json`
2. Submit for validation:

```bash
curl -X POST http://localhost:3002/listings/submit \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-api.com"}'
```

3. Check status:

```bash
curl http://localhost:3002/listings/submit/{submission_id}/status
```

4. If validation passes, your API is now publicly listed

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (required)
- `VALIDATOR_URL` - URL of the validator service (default: `http://localhost:3001`)
- `PORT` - Server port (default: 3002)
- `REGISTRY_URL` - Public URL of the registry (for headers)

## Database Schema

See `prisma/schema.prisma` for the full schema. Key fields:

- Listings are created with `check_status: "pending"`
- After successful validation, status becomes `"verified"`
- Failed validations are marked `"failed"` with a `failure_reason`
- Stale listings (not re-validated recently) are marked `"stale"`

## Development

```bash
# Watch mode
npm run dev

# Build
npm run build

# Production
npm start

# Prisma Studio (database GUI)
npm run prisma:studio
```

## Deployment

This registry is designed to deploy on Railway with the included `railway.json` configuration. It requires a PostgreSQL database.

### Railway Deployment

1. Create a new Railway project
2. Add a PostgreSQL database service
3. Add a web service pointing to this repository
4. Set environment variables (Railway auto-configures `DATABASE_URL`)
5. Deploy

The registry will automatically run migrations and seed data on first deploy.
