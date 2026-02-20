/**
 * Extract metadata from manifest for registry listing creation.
 * Handles v0.2 and v0.3 manifests, including optional fields.
 */

export interface ManifestLike {
  contact?: string | { email?: string; support_url?: string; github?: string };
  reliability?: { maintained_by?: string };
  pricing?: { model?: string };
  payment?: {
    model?: string;
    currency?: string;
    settlement?: { type?: string };
    budget_controls?: { supports_spend_cap?: boolean };
  };
}

/** Normalize contact to string (v0.3 allows object) */
export function normalizeContact(contact: ManifestLike['contact']): string {
  if (typeof contact === 'string') return contact;
  if (contact && typeof contact === 'object') {
    return (
      (contact as { email?: string }).email ??
      (contact as { support_url?: string }).support_url ??
      JSON.stringify(contact)
    );
  }
  return '';
}

/** Extract maintained_by with fallback (v0.3 makes reliability optional) */
export function extractMaintainedBy(manifest: ManifestLike): string {
  return manifest.reliability?.maintained_by ?? 'individual';
}

/** Extract v0.3 payment metadata for discovery filtering */
export function extractPaymentMetadata(manifest: ManifestLike): {
  payment_model: string | null;
  payment_currency: string | null;
  settlement_type: string | null;
  supports_spend_cap: boolean | null;
} {
  const payment = manifest.payment;
  if (!payment) {
    return {
      payment_model: null,
      payment_currency: null,
      settlement_type: null,
      supports_spend_cap: null,
    };
  }
  return {
    payment_model: payment.model ?? null,
    payment_currency: payment.currency ?? null,
    settlement_type: payment.settlement?.type ?? null,
    supports_spend_cap: payment.budget_controls?.supports_spend_cap ?? null,
  };
}
