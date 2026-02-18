/**
 * Auth and Payment verification for AMP validator.
 * Verifies that declared auth flows work and payment endpoints exist.
 * Does NOT process payments, store credentials, or handle money.
 */

interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ManifestForAuthPayment {
  authentication?: {
    required: boolean;
    type?: string | null;
    instructions?: string | null;
  };
  payment?: {
    checkout_url?: string;
    key_provisioning_url?: string;
    prepay_required?: boolean;
  };
  pricing?: {
    model?: string;
  };
  endpoints?: Array<{
    path: string;
    method: string;
  }>;
  agent_notes?: string;
}

export interface AuthPaymentResult {
  auth_verified: boolean;
  payment_flow_verified: boolean;
  checks: ValidationCheck[];
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 8000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

function isReachableUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Verify authentication flow based on manifest declaration.
 * Uses simple HTTP HEAD/GET checks only. Does not issue credentials.
 */
async function verifyAuthApiKey(
  manifest: ManifestForAuthPayment,
  baseUrl: string | null
): Promise<{ verified: boolean; checks: ValidationCheck[] }> {
  const checks: ValidationCheck[] = [];
  const keyUrl = manifest.payment?.key_provisioning_url;

  if (!keyUrl) {
    checks.push({
      name: 'auth_api_key_provisioning',
      passed: false,
      message: 'API key auth declared but key_provisioning_url not in payment',
      severity: 'warning',
    });
    return { verified: false, checks };
  }

  if (!baseUrl || !isReachableUrl(keyUrl)) {
    checks.push({
      name: 'auth_api_key_provisioning',
      passed: false,
      message: 'Cannot verify key_provisioning_url (no base URL or invalid URL)',
      severity: 'info',
    });
    return { verified: false, checks };
  }

  try {
    const response = await fetchWithTimeout(keyUrl, { method: 'GET' });
    if (response.status === 200 || response.status === 401) {
      checks.push({
        name: 'auth_api_key_provisioning',
        passed: true,
        message: `key_provisioning_url responds (${response.status})`,
        severity: 'info',
      });
      return { verified: true, checks };
    }
    checks.push({
      name: 'auth_api_key_provisioning',
      passed: false,
      message: `key_provisioning_url returned ${response.status}, expected 200 or 401`,
      severity: 'warning',
    });
    return { verified: false, checks };
  } catch (error) {
    checks.push({
      name: 'auth_api_key_provisioning',
      passed: false,
      message: `key_provisioning_url unreachable: ${(error as Error).message}`,
      severity: 'warning',
    });
    return { verified: false, checks };
  }
}

/**
 * Extract OAuth token endpoint from instructions or endpoints.
 * Looks for common patterns: token_url, token endpoint, /oauth/token, etc.
 */
function findOAuthTokenEndpoint(
  manifest: ManifestForAuthPayment
): string | null {
  const instructions = manifest.authentication?.instructions || '';
  const endpoints = manifest.endpoints || [];

  // Common patterns in instructions
  const urlPattern = /https?:\/\/[^\s"'<>]+(?:token|oauth)[^\s"'<>]*/i;
  const match = instructions.match(urlPattern);
  if (match) {
    try {
      new URL(match[0]);
      return match[0];
    } catch {
      /* ignore */
    }
  }

  // Check for relative token paths in endpoints
  const tokenPaths = ['/oauth/token', '/token', '/auth/token', '/v1/token'];
  for (const ep of endpoints) {
    const path = (ep.path || '').toLowerCase();
    if (tokenPaths.some((p) => path.includes(p)) || path.includes('token')) {
      return ep.path; // Relative - caller must resolve with baseUrl
    }
  }

  return null;
}

async function verifyAuthOAuth2(
  manifest: ManifestForAuthPayment,
  baseUrl: string | null
): Promise<{ verified: boolean; checks: ValidationCheck[] }> {
  const checks: ValidationCheck[] = [];
  const tokenEndpoint = findOAuthTokenEndpoint(manifest);

  if (!tokenEndpoint) {
    checks.push({
      name: 'auth_oauth2_token_endpoint',
      passed: false,
      message: 'OAuth2 declared but token endpoint not found in instructions or endpoints',
      severity: 'warning',
    });
    return { verified: false, checks };
  }

  let fullUrl: string;
  try {
    fullUrl = new URL(tokenEndpoint).toString();
  } catch {
    if (baseUrl) {
      fullUrl = new URL(tokenEndpoint, baseUrl).toString();
    } else {
      checks.push({
        name: 'auth_oauth2_token_endpoint',
        passed: false,
        message: 'Cannot resolve OAuth token URL without base URL',
        severity: 'info',
      });
      return { verified: false, checks };
    }
  }

  try {
    const response = await fetchWithTimeout(fullUrl, { method: 'GET' });
    const status = response.status;
    if (status === 200) {
      checks.push({
        name: 'auth_oauth2_token_endpoint',
        passed: true,
        message: 'OAuth token endpoint responds (200)',
        severity: 'info',
      });
      return { verified: true, checks };
    }
    if (status === 400) {
      const text = await response.text();
      if (
        text.includes('error') ||
        text.includes('invalid') ||
        text.includes('grant')
      ) {
        checks.push({
          name: 'auth_oauth2_token_endpoint',
          passed: true,
          message: 'OAuth token endpoint returns 400 with OAuth structure',
          severity: 'info',
        });
        return { verified: true, checks };
      }
    }
    if (status === 401 || status === 405) {
      checks.push({
        name: 'auth_oauth2_token_endpoint',
        passed: true,
        message: `OAuth token endpoint exists (${status})`,
        severity: 'info',
      });
      return { verified: true, checks };
    }
    checks.push({
      name: 'auth_oauth2_token_endpoint',
      passed: false,
      message: `OAuth token endpoint returned ${status}, expected 200 or 400`,
      severity: 'warning',
    });
    return { verified: false, checks };
  } catch (error) {
    checks.push({
      name: 'auth_oauth2_token_endpoint',
      passed: false,
      message: `OAuth token endpoint unreachable: ${(error as Error).message}`,
      severity: 'warning',
    });
    return { verified: false, checks };
  }
}

async function verifyAuthBearer(
  manifest: ManifestForAuthPayment,
  baseUrl: string | null
): Promise<{ verified: boolean; checks: ValidationCheck[] }> {
  const checks: ValidationCheck[] = [];
  const instructions = manifest.authentication?.instructions || '';

  if (!instructions.toLowerCase().includes('token') && !instructions.toLowerCase().includes('bearer')) {
    checks.push({
      name: 'auth_bearer_docs',
      passed: false,
      message: 'Bearer auth requires instructions on how to obtain token',
      severity: 'warning',
    });
    return { verified: false, checks };
  }

  if (!baseUrl || !manifest.endpoints?.length) {
    checks.push({
      name: 'auth_bearer_endpoint',
      passed: false,
      message: 'Cannot verify 401 without base URL or endpoints',
      severity: 'info',
    });
    return { verified: false, checks };
  }

  const testable = manifest.endpoints.filter(
    (ep) => ep.method === 'GET' && ep.path
  );
  if (testable.length === 0) {
    checks.push({
      name: 'auth_bearer_endpoint',
      passed: false,
      message: 'No GET endpoints to verify 401 response',
      severity: 'info',
    });
    return { verified: false, checks };
  }

  for (const ep of testable.slice(0, 2)) {
    const url = new URL(ep.path, baseUrl).toString();
    try {
      const response = await fetchWithTimeout(url, {
        headers: { Authorization: 'Bearer invalid-test-token' },
      });
      if (response.status === 401) {
        checks.push({
          name: 'auth_bearer_endpoint',
          passed: true,
          message: `Endpoint returns 401 when unauthenticated`,
          severity: 'info',
        });
        return { verified: true, checks };
      }
    } catch {
      /* try next */
    }
  }

  checks.push({
    name: 'auth_bearer_endpoint',
    passed: false,
    message: 'No tested endpoint returned 401 for unauthenticated request',
    severity: 'warning',
  });
  return { verified: false, checks };
}

/**
 * Main auth verification. Runs when authentication.required === true.
 */
async function verifyAuthentication(
  manifest: ManifestForAuthPayment,
  baseUrl: string | null
): Promise<{ auth_verified: boolean; checks: ValidationCheck[] }> {
  const checks: ValidationCheck[] = [];
  const auth = manifest.authentication;

  if (!auth?.required) {
    return { auth_verified: false, checks };
  }

  if (!auth.type || auth.type === 'none') {
    checks.push({
      name: 'auth_type',
      passed: false,
      message: 'Authentication required but type is missing or "none"',
      severity: 'error',
    });
    return { auth_verified: false, checks };
  }

  if (!auth.instructions || String(auth.instructions).trim().length === 0) {
    checks.push({
      name: 'auth_instructions',
      passed: false,
      message: 'Authentication required but instructions are empty',
      severity: 'error',
    });
    return { auth_verified: false, checks };
  }

  let result: { verified: boolean; checks: ValidationCheck[] };
  switch (auth.type) {
    case 'api_key':
      result = await verifyAuthApiKey(manifest, baseUrl);
      break;
    case 'oauth2':
      result = await verifyAuthOAuth2(manifest, baseUrl);
      break;
    case 'bearer':
      result = await verifyAuthBearer(manifest, baseUrl);
      break;
    default:
      checks.push({
        name: 'auth_type',
        passed: false,
        message: `Unsupported auth type for verification: ${auth.type}`,
        severity: 'warning',
      });
      return { auth_verified: false, checks };
  }

  checks.push(...result.checks);
  return { auth_verified: result.verified, checks };
}

/**
 * Payment readiness verification. Only when payment.prepay_required === true.
 * Verifies endpoints exist and respond. Does NOT process payment.
 */
async function verifyPaymentFlow(
  manifest: ManifestForAuthPayment,
  baseUrl: string | null
): Promise<{ payment_flow_verified: boolean; checks: ValidationCheck[] }> {
  const checks: ValidationCheck[] = [];
  const payment = manifest.payment;
  const pricing = manifest.pricing;

  if (!payment?.prepay_required) {
    return { payment_flow_verified: false, checks };
  }

  if (!payment.checkout_url) {
    checks.push({
      name: 'payment_checkout_url',
      passed: false,
      message: 'prepay_required but checkout_url missing',
      severity: 'error',
    });
    return { payment_flow_verified: false, checks };
  }

  if (!payment.key_provisioning_url) {
    checks.push({
      name: 'payment_key_provisioning_url',
      passed: false,
      message: 'prepay_required but key_provisioning_url missing',
      severity: 'error',
    });
    return { payment_flow_verified: false, checks };
  }

  if (pricing?.model === 'free') {
    checks.push({
      name: 'payment_pricing_model',
      passed: false,
      message: 'prepay_required but pricing.model is "free"',
      severity: 'error',
    });
    return { payment_flow_verified: false, checks };
  }

  if (!baseUrl) {
    checks.push({
      name: 'payment_endpoints',
      passed: false,
      message: 'Cannot verify payment endpoints without base URL',
      severity: 'info',
    });
    return { payment_flow_verified: false, checks };
  }

  let checkoutOk = false;
  let keyProvOk = false;

  try {
    const checkoutRes = await fetchWithTimeout(payment.checkout_url, {
      method: 'HEAD',
    });
    if (checkoutRes.status === 405) {
      const getRes = await fetchWithTimeout(payment.checkout_url, {
        method: 'GET',
      });
      checkoutOk = getRes.status === 200;
    } else {
      checkoutOk = checkoutRes.status === 200;
    }
  } catch (error) {
    checks.push({
      name: 'payment_checkout_reachable',
      passed: false,
      message: `checkout_url unreachable: ${(error as Error).message}`,
      severity: 'error',
    });
  }

  if (checkoutOk) {
    checks.push({
      name: 'payment_checkout_reachable',
      passed: true,
      message: 'checkout_url responds with HTTP 200',
      severity: 'info',
    });
  }

  try {
    const keyRes = await fetchWithTimeout(payment.key_provisioning_url!, {
      method: 'GET',
    });
    keyProvOk = keyRes.status === 200 || keyRes.status === 401;
  } catch (error) {
    checks.push({
      name: 'payment_key_provisioning_reachable',
      passed: false,
      message: `key_provisioning_url unreachable: ${(error as Error).message}`,
      severity: 'error',
    });
  }

  if (keyProvOk) {
    checks.push({
      name: 'payment_key_provisioning_reachable',
      passed: true,
      message: 'key_provisioning_url responds with HTTP 200 or 401',
      severity: 'info',
    });
  }

  const payment_flow_verified =
    checkoutOk && keyProvOk && pricing?.model !== 'free';

  return { payment_flow_verified, checks };
}

/**
 * Validate auth and payment.
 */
export async function validateAuthAndPayment(
  manifest: ManifestForAuthPayment,
  baseUrl: string | null
): Promise<AuthPaymentResult> {
  const authResult = await verifyAuthentication(manifest, baseUrl);
  const paymentResult = await verifyPaymentFlow(manifest, baseUrl);

  return {
    auth_verified: authResult.auth_verified,
    payment_flow_verified: paymentResult.payment_flow_verified,
    checks: [...authResult.checks, ...paymentResult.checks],
  };
}
