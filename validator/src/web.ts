import express, { Request, Response } from 'express';
import { validateManifest, validateManifestObject } from './index';
import schema from '../spec/schema.json';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'agentmanifest-validator',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// Get spec schema
app.get('/spec', (req: Request, res: Response) => {
  res.json(schema);
});

// Validate manifest
app.post('/validate', async (req: Request, res: Response) => {
  try {
    const { url, manifest } = req.body;

    // Support both URL and direct manifest object
    if (!url && !manifest) {
      return res.status(400).json({
        error: 'URL or manifest is required',
        message: 'Request body must include either "url" or "manifest" field',
      });
    }

    let result;
    if (manifest) {
      // Validate manifest object directly
      result = await validateManifestObject(manifest, url || 'local-manifest');
    } else {
      // Validate by URL
      if (typeof url !== 'string') {
        return res.status(400).json({
          error: 'Invalid URL',
          message: 'URL must be a string',
        });
      }
      result = await validateManifest(url);
    }

    res.json(result);
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: (error as Error).message,
    });
  }
});

// Root route - API info
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'AgentManifest Validator',
    description: 'Validation service for agent-manifest.json files. Ensures compliance with AMP specification.',
    version: '0.1.0',
    status: 'healthy',
    endpoints: {
      'GET /health': 'Health check',
      'GET /spec': 'Get JSON Schema specification',
      'POST /validate': 'Validate a manifest by URL',
    },
    usage: {
      cli: 'npm install -g @agentmanifest/cli && amp validate https://bakebase.agent-manifest.com',
      api: 'POST /validate with body: {"url": "https://bakebase.agent-manifest.com"}',
    },
    links: {
      protocol: 'https://agent-manifest.com',
      validator: 'https://validator.agent-manifest.com',
      registry: 'https://api.agent-manifest.com',
      github: 'https://github.com/AMProtocol/AMP',
      example: 'https://bakebase.agent-manifest.com',
    },
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    message: 'Endpoint not found',
    available_endpoints: {
      'GET /health': 'Health check',
      'GET /spec': 'Get JSON Schema',
      'POST /validate': 'Validate a manifest',
    },
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: Function) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

app.listen(PORT, () => {
  console.log(`AgentManifest Validator API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Spec schema: http://localhost:${PORT}/spec`);
  console.log(`Validate: POST http://localhost:${PORT}/validate`);
});

export default app;
