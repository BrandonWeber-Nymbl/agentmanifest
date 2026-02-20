/**
 * Agent operational completeness check.
 * Ensures manifest describes how an agent would: create account, obtain credentials,
 * understand pricing, and make authenticated requests.
 *
 * v0.3 extension: For manifests with a non-null payment block, agent_notes
 * SHOULD also reference payment onboarding (the terms "payment", "onboarding", or "budget").
 */

interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

const MIN_LENGTH_V03 = 150;
const MIN_LENGTH_V02 = 50;
const REQUIRED_TERMS = [
  ['account'],
  ['authentication', 'api key', 'api_key', 'credentials'],
  ['pricing', 'cost', 'free'],
];

// v0.3: additional recommended terms when payment block is present
const PAYMENT_TERMS = ['payment', 'onboarding', 'budget'];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Check that agent_notes contains procedural guidance for agents.
 * Must be ≥150 chars and include: "account", ("authentication" or "api key"), ("pricing" or "cost" or "free").
 *
 * @param agentNotes - The agent_notes field value
 * @param hasV03Payment - Whether the manifest has a non-null v0.3 payment block
 * @param isV03 - Whether the manifest declares spec version 0.3
 */
export function checkAgentOperationalCompleteness(
  agentNotes: string | undefined,
  hasV03Payment: boolean = false,
  isV03: boolean = false
): { operationally_complete: boolean; check: ValidationCheck } {
  const notes = agentNotes || '';
  const normalized = normalize(notes);
  const minLength = isV03 ? MIN_LENGTH_V03 : MIN_LENGTH_V02;

  if (notes.length < minLength) {
    return {
      operationally_complete: false,
      check: {
        name: 'operationally_complete',
        passed: false,
        message: `Manifest lacks agent-operational completeness. agent_notes must be at least ${minLength} characters (currently ${notes.length}).`,
        severity: 'error',
      },
    };
  }

  for (const alternatives of REQUIRED_TERMS) {
    const found = alternatives.some((term) => normalized.includes(term));
    if (!found) {
      return {
        operationally_complete: false,
        check: {
          name: 'operationally_complete',
          passed: false,
          message: `Manifest lacks agent-operational completeness. agent_notes must reference: ${alternatives.join(' or ')}.`,
          severity: 'error',
        },
      };
    }
  }

  // v0.3: warn (not error) if payment block present but agent_notes doesn't mention payment/onboarding
  if (hasV03Payment) {
    const hasPaymentTerms = PAYMENT_TERMS.some((term) => normalized.includes(term));
    if (!hasPaymentTerms) {
      return {
        operationally_complete: true,
        check: {
          name: 'operationally_complete',
          passed: true,
          message: 'Manifest contains agent-operational completeness, but agent_notes should reference payment onboarding for v0.3 manifests (mention "payment", "onboarding", or "budget").',
          severity: 'warning',
        },
      };
    }
  }

  return {
    operationally_complete: true,
    check: {
      name: 'operationally_complete',
      passed: true,
      message: 'Manifest contains agent-operational completeness',
      severity: 'info',
    },
  };
}
