import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateAuthAndPayment } from '../validateAuthAndPayment';

describe('validateAuthAndPayment', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('v0.2 path: prepay_required triggers verifyPaymentFlow', async () => {
    const manifest = {
      spec_version: 'agentmanifest-0.2',
      authentication: { required: false, type: null },
      payment: {
        prepay_required: true,
        checkout_url: 'https://example.com/checkout',
        key_provisioning_url: 'https://example.com/keys',
      },
      pricing: { model: 'usage_based' },
      endpoints: [],
    };

    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ status: 200 })
      .mockResolvedValueOnce({ status: 200 });

    const result = await validateAuthAndPayment(manifest, 'https://example.com');
    expect(result.checks.some((c) => c.name === 'payment_checkout_reachable')).toBe(true);
    expect(result.checks.some((c) => c.name === 'payment_key_provisioning_reachable')).toBe(true);
  });

  it('v0.3 path: spec_version 0.3 and payment.model triggers verifyV03PaymentFlow', async () => {
    const manifest = {
      spec_version: 'agentmanifest-0.3',
      authentication: { required: false, type: null },
      payment: {
        model: 'per_request',
        onboarding: { url: 'https://example.com/amp/onboard', method: 'POST', accepts: ['signed_jwt'], returns: { credential_type: 'api_key', credential_field: 'api_key', instructions: 'Use header' } },
      },
      endpoints: [],
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 200 });

    const result = await validateAuthAndPayment(manifest, 'https://example.com');
    expect(result.checks.some((c) => c.name === 'v03_payment_onboarding_reachable')).toBe(true);
  });

  it('baseUrl null skips network checks for v0.3 payment', async () => {
    const manifest = {
      spec_version: 'agentmanifest-0.3',
      authentication: { required: false, type: null },
      payment: {
        model: 'per_request',
        onboarding: { url: 'https://example.com/amp/onboard', method: 'POST', accepts: ['signed_jwt'], returns: { credential_type: 'api_key', credential_field: 'api_key', instructions: 'Use header' } },
      },
      endpoints: [],
    };

    const result = await validateAuthAndPayment(manifest, null);
    expect(fetch).not.toHaveBeenCalled();
    expect(result.checks.some((c) => c.name === 'v03_payment_onboarding_reachable' && !c.passed)).toBe(true);
  });

  it('v0.3 payment with usage_endpoint checks usage reachability', async () => {
    const manifest = {
      spec_version: 'agentmanifest-0.3',
      authentication: { required: false, type: null },
      payment: {
        model: 'per_request',
        onboarding: { url: 'https://example.com/amp/onboard', method: 'POST', accepts: ['signed_jwt'], returns: { credential_type: 'api_key', credential_field: 'api_key', instructions: 'Use header' } },
        usage_endpoint: { url: 'https://example.com/amp/usage', method: 'GET', authentication: 'same_as_api' },
      },
      endpoints: [],
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 200 });

    const result = await validateAuthAndPayment(manifest, 'https://example.com');
    expect(result.checks.some((c) => c.name === 'v03_payment_usage_reachable')).toBe(true);
  });
});
