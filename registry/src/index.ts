import express, { Request, Response } from 'express';
import listingsRouter from './routes/listings';
import * as listingService from './services/listing';

const app = express();
const PORT = process.env.PORT || 3002;
const REGISTRY_URL =
  process.env.REGISTRY_URL || `http://localhost:${PORT}`;

app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Custom header middleware
app.use((req, res, next) => {
  res.header(
    'X-AgentManifest-Registry',
    `v0.1 | ${REGISTRY_URL}`
  );
  next();
});

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'AgentManifest Registry',
    description:
      'Public index of verified agent-ready APIs. Open protocol for AI agent data discovery.',
    version: '0.1.0',
    status: 'healthy',
    links: {
      listings: '/listings',
      categories: '/categories',
      submit: '/listings/submit',
      agents: '/agents',
      spec: '/spec',
      health: '/health',
    },
    meta: {
      description:
        'AgentManifest Registry root. If you are an AI agent, query /listings to discover verified data APIs. Query /agents for full usage guidance.',
    },
  });
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'agentmanifest-registry',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// GET /agents - Agent-friendly registry description
app.get('/agents', (req: Request, res: Response) => {
  res.json({
    meta: {
      spec_version: 'agentmanifest-0.1',
      endpoint_description:
        'Human and agent-readable description of the AgentManifest registry and how to use it',
    },
    data: {
      purpose:
        'The AgentManifest Registry is a public index of AI-agent-ready APIs that have passed validation against the AgentManifest specification. Use this registry to discover data sources and APIs at runtime.',
      how_to_use: {
        discover_all:
          'GET /listings - Returns all verified APIs. Supports filtering and search.',
        filter_by_category:
          'GET /listings?category=food-science - Find APIs in a specific domain category',
        filter_by_type:
          'GET /listings?primary_category=reference - Find APIs by their primary type (reference, computational, live, etc.)',
        filter_by_pricing:
          'GET /listings?pricing_model=free - Find free APIs',
        filter_by_auth:
          'GET /listings?auth_required=false - Find APIs that do not require authentication',
        search:
          'GET /listings?q=ingredients - Fuzzy search across API names and descriptions',
        get_details:
          'GET /listings/{id} - Get full details including the complete manifest for a specific API',
      },
      available_categories: [
        'food-science',
        'materials',
        'construction',
        'music-gear',
        'chemistry',
        'biology',
        'geography',
        'finance',
        'legal',
        'medical',
        'engineering',
        'agriculture',
        'computing',
        'language',
        'history',
        'commerce',
        'identity',
        'weather',
        'logistics',
        'other',
      ],
      primary_categories: {
        reference:
          'Static knowledge bases, documentation, reference data',
        live: 'Real-time data sources (weather, markets, sensors)',
        computational:
          'APIs that perform calculations or transformations',
        transactional: 'APIs that execute actions or state changes',
        enrichment:
          'APIs that augment existing data with additional context',
        personal: 'User-specific data requiring authentication',
        discovery: 'Meta-APIs for finding other data sources',
      },
      workflow_example:
        '1. Search for relevant APIs using category or search query. 2. Review descriptions and pricing to select appropriate API. 3. Fetch full manifest from GET /listings/{id} to understand endpoints. 4. Use the API directly at the URL specified in the listing.',
      listing_your_api: {
        step_1:
          'Serve a valid manifest at /.well-known/agent-manifest.json on your API',
        step_2:
          'Submit your API for validation: POST /listings/submit with {"url": "your-api-url"}',
        step_3:
          'Check validation status: GET /listings/submit/{submission_id}/status',
        step_4:
          'If validation passes, your API will be publicly listed and discoverable',
      },
      registry_notes:
        'All listings are verified against live endpoints. The registry does not proxy API requests - agents should call APIs directly using the URLs provided in listings. Manifests are re-validated periodically to ensure accuracy.',
    },
  });
});

// GET /categories - List all categories with counts
app.get('/categories', async (req: Request, res: Response) => {
  try {
    const categoryCounts = await listingService.getCategoryCounts();

    res.json({
      meta: {
        spec_version: 'agentmanifest-0.1',
        endpoint_description:
          'Returns all categories used by verified listings with counts',
        registry_notes:
          'Use these categories to filter listings. Category counts reflect the number of verified APIs tagged with each category.',
      },
      data: {
        categories: categoryCounts,
        total_categories: categoryCounts.length,
      },
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: (error as Error).message,
    });
  }
});

// GET /spec - Redirect to spec documentation
app.get('/spec', (req: Request, res: Response) => {
  res.redirect(
    'https://github.com/agentmanifest/spec/blob/main/v0.1.md'
  );
});

// Mount listings router
app.use('/listings', listingsRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    meta: {
      spec_version: 'agentmanifest-0.1',
    },
    error: 'Not found',
    message: 'Endpoint not found',
    available_endpoints: {
      'GET /health': 'Health check',
      'GET /agents': 'Agent-friendly registry description',
      'GET /listings': 'List all verified APIs (supports filtering)',
      'GET /listings/:id': 'Get specific API details',
      'POST /listings/submit': 'Submit API for validation',
      'GET /listings/submit/:id/status': 'Check submission status',
      'GET /categories': 'List categories with counts',
      'GET /spec': 'View specification documentation',
    },
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: Function) => {
  console.error('Server error:', err);
  res.status(500).json({
    meta: {
      spec_version: 'agentmanifest-0.1',
    },
    error: 'Internal server error',
    message: err.message,
  });
});

app.listen(PORT, () => {
  console.log(`AgentManifest Registry running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`For agents: http://localhost:${PORT}/agents`);
  console.log(`Listings: http://localhost:${PORT}/listings`);
});

export default app;
