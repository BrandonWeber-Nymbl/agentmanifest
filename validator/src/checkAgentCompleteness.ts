/**
 * Agent operational completeness check.
 * Ensures manifest describes how an agent would: create account, obtain credentials,
 * understand pricing, and make authenticated requests.
 */

interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

const MIN_LENGTH = 150;
const REQUIRED_TERMS = [
  ['account'],
  ['authentication', 'api key', 'api_key', 'credentials'],
  ['pricing'],
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Check that agent_notes contains procedural guidance for agents.
 * Must be ≥150 chars and include: "account", ("authentication" or "api key"), "pricing".
 */
export function checkAgentOperationalCompleteness(
  agentNotes: string | undefined
): { operationally_complete: boolean; check: ValidationCheck } {
  const notes = agentNotes || '';
  const normalized = normalize(notes);

  if (notes.length < MIN_LENGTH) {
    return {
      operationally_complete: false,
      check: {
        name: 'operationally_complete',
        passed: false,
        message: 'Manifest lacks agent-operational completeness.',
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
          message: 'Manifest lacks agent-operational completeness.',
          severity: 'error',
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
