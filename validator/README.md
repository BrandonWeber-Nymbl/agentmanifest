# AgentManifest Validator

Validator for the AgentManifest specification. Can be used as a library, CLI tool, or web API.

## Installation

```bash
npm install @agentmanifest/validator
```

## Usage

### As a CLI Tool

```bash
# Using npx (no installation needed)
npx amp validate https://bakebase.agent-manifest.com

# Or install globally
npm install -g @agentmanifest/cli
amp validate https://bakebase.agent-manifest.com
```

### As a Library

```typescript
import { validateManifest } from '@agentmanifest/validator';

const result = await validateManifest('https://bakebase.agent-manifest.com');

if (result.passed) {
  console.log('Validation passed!');
  console.log('Verification token:', result.verification_token);
} else {
  console.log('Validation failed');
  result.checks.forEach(check => {
    if (!check.passed && check.severity === 'error') {
      console.error(`Error: ${check.message}`);
    }
  });
}
```

### As a Web API

```bash
# Start the validator API server
npm run dev

# Or in production
npm run build
npm run start:web
```

**Endpoints:**

- `GET /health` - Health check
- `GET /spec` - Get the AgentManifest JSON Schema
- `POST /validate` - Validate a manifest

**Example request:**

```bash
curl -X POST http://localhost:3001/validate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://bakebase.agent-manifest.com"}'
```

## Validation Checks

The validator performs the following checks:

1. **Manifest Reachability** - Fetches `/.well-known/agent-manifest.json`
2. **Schema Validity** - Validates against JSON Schema
3. **Spec Version** - Checks for supported spec version
4. **Description Quality** - Verifies minimum lengths and content quality
5. **Endpoint Reachability** - Tests declared GET endpoints
6. **Pricing Consistency** - Validates pricing configuration
7. **Category Validity** - Checks categories against controlled vocabulary
8. **Authentication Consistency** - Validates authentication configuration

## Environment Variables

- `JWT_SECRET` - Secret for signing verification tokens (required in production)
- `PORT` - Port for web API (default: 3001)

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Run CLI locally
npm run cli -- validate https://api.example.com
```
