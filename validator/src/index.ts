import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import jwt from 'jsonwebtoken';
import schema from '../spec/schema.json';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationResult {
  url: string;
  validated_at: string;
  passed: boolean;
  spec_version: string | null;
  checks: ValidationCheck[];
  verification_token: string | null;
}

interface ManifestData {
  spec_version?: string;
  name?: string;
  version?: string;
  description?: string;
  categories?: string[];
  primary_category?: string;
  endpoints?: Array<{
    path: string;
    method: string;
    description: string;
    parameters: any[];
    response_description: string;
  }>;
  pricing?: {
    model: string;
    free_tier?: any;
    paid_tier?: any;
    support_url?: string;
  };
  authentication?: {
    required: boolean;
    type?: string | null;
    instructions?: string | null;
  };
  reliability?: {
    maintained_by: string;
    status_url?: string | null;
    expected_uptime_pct?: number | null;
  };
  agent_notes?: string;
  contact?: string;
  listing_requested?: boolean;
  last_updated?: string;
}

const BOILERPLATE_PATTERNS = [
  /this api provides/i,
  /lorem ipsum/i,
  /todo:/i,
  /replace this/i,
  /example description/i,
  /\[insert.*?\]/i,
];

const VALID_CATEGORIES = [
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
];

const VALID_PRIMARY_CATEGORIES = [
  'reference',
  'live',
  'computational',
  'transactional',
  'enrichment',
  'personal',
  'discovery',
];

function isBoilerplate(text: string): boolean {
  return BOILERPLATE_PATTERNS.some((pattern) => pattern.test(text));
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 10000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function checkManifestReachability(
  baseUrl: string
): Promise<{ check: ValidationCheck; manifest: ManifestData | null }> {
  const manifestUrl = new URL('/.well-known/agent-manifest.json', baseUrl).toString();

  try {
    const response = await fetchWithTimeout(manifestUrl);

    if (response.status !== 200) {
      return {
        check: {
          name: 'manifest_reachability',
          passed: false,
          message: `Manifest returned status ${response.status}, expected 200`,
          severity: 'error',
        },
        manifest: null,
      };
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return {
        check: {
          name: 'manifest_reachability',
          passed: false,
          message: `Invalid Content-Type: ${contentType}, expected application/json`,
          severity: 'error',
        },
        manifest: null,
      };
    }

    const manifest = (await response.json()) as ManifestData;

    return {
      check: {
        name: 'manifest_reachability',
        passed: true,
        message: 'Manifest successfully fetched',
        severity: 'info',
      },
      manifest,
    };
  } catch (error) {
    return {
      check: {
        name: 'manifest_reachability',
        passed: false,
        message: `Failed to fetch manifest: ${(error as Error).message}`,
        severity: 'error',
      },
      manifest: null,
    };
  }
}

function checkSchemaValidity(manifest: ManifestData): ValidationCheck {
  const validate = ajv.compile(schema);
  const valid = validate(manifest);

  if (!valid) {
    const errors = validate.errors
      ?.map((err) => `${err.instancePath} ${err.message}`)
      .join('; ');
    return {
      name: 'schema_validity',
      passed: false,
      message: `Schema validation failed: ${errors}`,
      severity: 'error',
    };
  }

  return {
    name: 'schema_validity',
    passed: true,
    message: 'Manifest passes JSON Schema validation',
    severity: 'info',
  };
}

function checkSpecVersion(manifest: ManifestData): ValidationCheck {
  if (manifest.spec_version !== 'agentmanifest-0.1') {
    return {
      name: 'spec_version',
      passed: false,
      message: `Unknown spec version: ${manifest.spec_version}`,
      severity: 'error',
    };
  }

  return {
    name: 'spec_version',
    passed: true,
    message: 'Valid spec version declared',
    severity: 'info',
  };
}

function checkDescriptionQuality(manifest: ManifestData): ValidationCheck[] {
  const checks: ValidationCheck[] = [];

  // Description length
  if (!manifest.description || manifest.description.length < 100) {
    checks.push({
      name: 'description_length',
      passed: false,
      message: `Description too short (${manifest.description?.length || 0} chars, minimum 100)`,
      severity: 'error',
    });
  } else if (isBoilerplate(manifest.description)) {
    checks.push({
      name: 'description_quality',
      passed: false,
      message: 'Description appears to be auto-generated boilerplate',
      severity: 'warning',
    });
  } else {
    checks.push({
      name: 'description_length',
      passed: true,
      message: 'Description meets minimum length requirement',
      severity: 'info',
    });
  }

  // Agent notes length
  if (!manifest.agent_notes || manifest.agent_notes.length < 50) {
    checks.push({
      name: 'agent_notes_length',
      passed: false,
      message: `Agent notes too short (${manifest.agent_notes?.length || 0} chars, minimum 50)`,
      severity: 'error',
    });
  } else if (isBoilerplate(manifest.agent_notes)) {
    checks.push({
      name: 'agent_notes_quality',
      passed: false,
      message: 'Agent notes appear to be auto-generated boilerplate',
      severity: 'warning',
    });
  } else {
    checks.push({
      name: 'agent_notes_length',
      passed: true,
      message: 'Agent notes meet minimum length requirement',
      severity: 'info',
    });
  }

  return checks;
}

async function checkEndpointReachability(
  baseUrl: string,
  manifest: ManifestData
): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];

  if (!manifest.endpoints || manifest.endpoints.length === 0) {
    checks.push({
      name: 'endpoint_reachability',
      passed: false,
      message: 'No endpoints declared',
      severity: 'error',
    });
    return checks;
  }

  // Only test GET endpoints with no required parameters
  const testableEndpoints = manifest.endpoints.filter(
    (ep) =>
      ep.method === 'GET' &&
      (!ep.parameters || ep.parameters.every((p) => !p.required))
  );

  if (testableEndpoints.length === 0) {
    checks.push({
      name: 'endpoint_reachability',
      passed: true,
      message: 'No testable GET endpoints (all require parameters or are non-GET)',
      severity: 'info',
    });
    return checks;
  }

  for (const endpoint of testableEndpoints.slice(0, 3)) {
    // Test max 3 endpoints
    const endpointUrl = new URL(endpoint.path, baseUrl).toString();

    try {
      const start = Date.now();
      const response = await fetchWithTimeout(endpointUrl, {}, 8000);
      const duration = Date.now() - start;

      if (response.status >= 500) {
        checks.push({
          name: `endpoint_${endpoint.path}`,
          passed: false,
          message: `Endpoint returned ${response.status} (server error)`,
          severity: 'error',
        });
      } else {
        checks.push({
          name: `endpoint_${endpoint.path}`,
          passed: true,
          message: `Endpoint reachable (${response.status}, ${duration}ms)`,
          severity: 'info',
        });
      }
    } catch (error) {
      checks.push({
        name: `endpoint_${endpoint.path}`,
        passed: false,
        message: `Endpoint unreachable: ${(error as Error).message}`,
        severity: 'warning',
      });
    }
  }

  return checks;
}

function checkPricingConsistency(manifest: ManifestData): ValidationCheck[] {
  const checks: ValidationCheck[] = [];

  if (!manifest.pricing) {
    checks.push({
      name: 'pricing_consistency',
      passed: false,
      message: 'Pricing object missing',
      severity: 'error',
    });
    return checks;
  }

  const { model, free_tier, paid_tier, support_url } = manifest.pricing;

  // Check model-specific requirements
  if (
    ['per-query', 'subscription', 'tiered'].includes(model) &&
    !paid_tier
  ) {
    checks.push({
      name: 'pricing_paid_tier',
      passed: false,
      message: `Pricing model "${model}" requires paid_tier to be defined`,
      severity: 'error',
    });
  }

  if (model === 'free' && !free_tier) {
    checks.push({
      name: 'pricing_free_tier',
      passed: false,
      message: 'Pricing model "free" requires free_tier to be defined',
      severity: 'error',
    });
  }

  // Check support URL if present
  if (support_url) {
    try {
      new URL(support_url);
      checks.push({
        name: 'pricing_support_url',
        passed: true,
        message: 'Support URL is valid',
        severity: 'info',
      });
    } catch {
      checks.push({
        name: 'pricing_support_url',
        passed: false,
        message: 'Support URL is not a valid URL',
        severity: 'error',
      });
    }
  }

  if (checks.length === 0 || checks.every((c) => c.passed)) {
    checks.push({
      name: 'pricing_consistency',
      passed: true,
      message: 'Pricing configuration is consistent',
      severity: 'info',
    });
  }

  return checks;
}

function checkCategoryValidity(manifest: ManifestData): ValidationCheck[] {
  const checks: ValidationCheck[] = [];

  // Check primary category
  if (
    !manifest.primary_category ||
    !VALID_PRIMARY_CATEGORIES.includes(manifest.primary_category)
  ) {
    checks.push({
      name: 'primary_category',
      passed: false,
      message: `Invalid primary_category: ${manifest.primary_category}`,
      severity: 'error',
    });
  } else {
    checks.push({
      name: 'primary_category',
      passed: true,
      message: 'Primary category is valid',
      severity: 'info',
    });
  }

  // Check categories
  if (!manifest.categories || manifest.categories.length === 0) {
    checks.push({
      name: 'categories',
      passed: false,
      message: 'No categories declared',
      severity: 'error',
    });
  } else {
    const invalidCategories = manifest.categories.filter(
      (cat) => !VALID_CATEGORIES.includes(cat)
    );

    if (invalidCategories.length > 0) {
      checks.push({
        name: 'categories',
        passed: false,
        message: `Invalid categories: ${invalidCategories.join(', ')}`,
        severity: 'error',
      });
    } else {
      checks.push({
        name: 'categories',
        passed: true,
        message: 'All categories are valid',
        severity: 'info',
      });
    }
  }

  return checks;
}

function checkAuthenticationConsistency(manifest: ManifestData): ValidationCheck {
  if (!manifest.authentication) {
    return {
      name: 'authentication_consistency',
      passed: false,
      message: 'Authentication object missing',
      severity: 'error',
    };
  }

  const { required, type, instructions } = manifest.authentication;

  if (required) {
    if (!type || type === 'none') {
      return {
        name: 'authentication_consistency',
        passed: false,
        message: 'Authentication required but type is null or "none"',
        severity: 'error',
      };
    }

    if (!instructions) {
      return {
        name: 'authentication_consistency',
        passed: false,
        message: 'Authentication required but instructions are missing',
        severity: 'error',
      };
    }
  }

  return {
    name: 'authentication_consistency',
    passed: true,
    message: 'Authentication configuration is consistent',
    severity: 'info',
  };
}

function generateVerificationToken(
  url: string,
  validatedAt: string,
  specVersion: string
): string {
  const secret = process.env.JWT_SECRET || 'agentmanifest-default-secret-change-in-production';

  return jwt.sign(
    {
      url,
      validated_at: validatedAt,
      spec_version: specVersion,
      iss: 'agentmanifest-validator',
    },
    secret,
    { expiresIn: '90d' }
  );
}

export async function validateManifest(url: string): Promise<ValidationResult> {
  const validatedAt = new Date().toISOString();
  const checks: ValidationCheck[] = [];

  // Normalize URL
  let baseUrl = url;
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash

  // 1. Manifest reachability
  const { check: reachabilityCheck, manifest } =
    await checkManifestReachability(baseUrl);
  checks.push(reachabilityCheck);

  if (!manifest) {
    return {
      url: baseUrl,
      validated_at: validatedAt,
      passed: false,
      spec_version: null,
      checks,
      verification_token: null,
    };
  }

  // 2. Schema validity
  checks.push(checkSchemaValidity(manifest));

  // 3. Spec version check
  checks.push(checkSpecVersion(manifest));

  // 4. Description quality
  checks.push(...checkDescriptionQuality(manifest));

  // 5. Endpoint reachability
  checks.push(...(await checkEndpointReachability(baseUrl, manifest)));

  // 6. Pricing consistency
  checks.push(...checkPricingConsistency(manifest));

  // 7. Category validity
  checks.push(...checkCategoryValidity(manifest));

  // 8. Authentication consistency
  checks.push(checkAuthenticationConsistency(manifest));

  // Determine if validation passed (all error-severity checks must pass)
  const passed = checks.every(
    (check) => check.passed || check.severity !== 'error'
  );

  // Generate verification token if passed
  const verificationToken = passed
    ? generateVerificationToken(
        baseUrl,
        validatedAt,
        manifest.spec_version || 'unknown'
      )
    : null;

  return {
    url: baseUrl,
    validated_at: validatedAt,
    passed,
    spec_version: manifest.spec_version || null,
    checks,
    verification_token: verificationToken,
  };
}
