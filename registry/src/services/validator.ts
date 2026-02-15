// Validator service - integrates with the validator package
// In production, this would call the validator API or import the library
// For now, we'll make HTTP requests to the validator service

interface ValidationResult {
  url: string;
  validated_at: string;
  passed: boolean;
  spec_version: string | null;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
  verification_token: string | null;
}

export async function validateAPI(url: string): Promise<ValidationResult> {
  let validatorUrl =
    process.env.VALIDATOR_URL || 'http://localhost:3001';

  // Ensure validatorUrl has a protocol
  if (!validatorUrl.startsWith('http://') && !validatorUrl.startsWith('https://')) {
    validatorUrl = `https://${validatorUrl}`;
  }

  try {
    const response = await fetch(`${validatorUrl}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`Validator returned ${response.status}`);
    }

    const result = (await response.json()) as ValidationResult;
    return result;
  } catch (error) {
    // If validator service is not available, return a failed result
    console.error('Validator service error:', error);
    return {
      url,
      validated_at: new Date().toISOString(),
      passed: false,
      spec_version: null,
      checks: [
        {
          name: 'validator_service',
          passed: false,
          message: `Failed to connect to validator service: ${(error as Error).message}`,
          severity: 'error',
        },
      ],
      verification_token: null,
    };
  }
}

export async function fetchManifest(url: string): Promise<any> {
  let baseUrl = url;
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  baseUrl = baseUrl.replace(/\/$/, '');

  const manifestUrl = new URL('/.well-known/agent-manifest.json', baseUrl).toString();

  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.status}`);
  }

  return response.json();
}
