import { describe, it, expect } from 'vitest';
import { checkAgentOperationalCompleteness } from '../checkAgentCompleteness';

describe('checkAgentOperationalCompleteness', () => {
  describe('v0.2 agent_notes (50 char min)', () => {
    it('passes with 50 chars', () => {
      const notes = 'Account: yes. Authentication: api key. Pricing: free. 50 chars.';
      const result = checkAgentOperationalCompleteness(notes, false, false);
      expect(result.operationally_complete).toBe(true);
      expect(result.check.passed).toBe(true);
    });

    it('fails with 49 chars', () => {
      const notes = 'Account: yes. Auth: api key. Pricing: free. 49chx';
      expect(notes.length).toBe(49);
      const result = checkAgentOperationalCompleteness(notes, false, false);
      expect(result.operationally_complete).toBe(false);
      expect(result.check.passed).toBe(false);
      expect(result.check.message).toContain('49');
    });
  });

  describe('v0.3 agent_notes (150 char min)', () => {
    it('passes with 150 chars', () => {
      const notes =
        'Account: none. Authentication: api key. Pricing: free. This manifest meets the v0.3 minimum of 150 characters for agent_notes. It includes account, authentication, and pricing terms.';
      expect(notes.length).toBeGreaterThanOrEqual(150);
      const result = checkAgentOperationalCompleteness(notes, false, true);
      expect(result.operationally_complete).toBe(true);
      expect(result.check.passed).toBe(true);
    });

    it('fails with 149 chars', () => {
      const notes =
        'Account: none. Authentication: api key. Pricing: free. This is 149 characters to fail v0.3 min. Account: none. Authentication: api key. Pricing: fre.';
      expect(notes.length).toBe(149);
      const result = checkAgentOperationalCompleteness(notes, false, true);
      expect(result.operationally_complete).toBe(false);
      expect(result.check.passed).toBe(false);
      expect(result.check.message).toContain('150');
    });
  });

  describe('required terms', () => {
    it('requires account term', () => {
      const notes =
        'Authentication: api key. Pricing: free. Registration not required. Must be 150 chars for v0.3. Authentication: api key. Pricing: free. Registration not required. Must be 150 chars.';
      const result = checkAgentOperationalCompleteness(notes, false, true);
      expect(result.operationally_complete).toBe(false);
      expect(result.check.message).toContain('account');
    });

    it('requires authentication or api key', () => {
      const notes =
        'Account: none. Pricing: free. Token in header. Must be 150 chars. Account: none. Pricing: free. Token in header. Must be 150 chars. XXXYYYYYYYYYYYYYYY';
      expect(notes.length).toBeGreaterThanOrEqual(150);
      const result = checkAgentOperationalCompleteness(notes, false, true);
      expect(result.operationally_complete).toBe(false);
      expect(result.check.message).toMatch(/authentication|api key|api_key|credentials/);
    });

    it('requires pricing or cost or free', () => {
      const notes =
        'Account: none. Authentication: api key. Billing details elsewhere. Must be 150 chars. Account: none. Authentication: api key. Billing elsewhere. XXXXXX';
      expect(notes.length).toBeGreaterThanOrEqual(150);
      const result = checkAgentOperationalCompleteness(notes, false, true);
      expect(result.operationally_complete).toBe(false);
      expect(result.check.message).toMatch(/pricing|cost|free/);
    });

    it('accepts API Key (case insensitive)', () => {
      const notes =
        'Account: none. API Key required. Pricing: free. Case insensitive test. Account: none. API Key required. Pricing: free. Extended to 150 chars minimum for v0.3 test. XXXX';
      expect(notes.length).toBeGreaterThanOrEqual(150);
      const result = checkAgentOperationalCompleteness(notes, false, true);
      expect(result.operationally_complete).toBe(true);
    });
  });

  describe('v0.3 payment terms (when payment block present)', () => {
    it('yields warning when payment block present but no payment/onboarding/budget terms', () => {
      const notes =
        'Account required. Authentication via api key. Pricing is $0.01 per request. This has account, auth, pricing. Terms and conditions apply. Must be 150 chars for v0.3 test.';
      const result = checkAgentOperationalCompleteness(notes, true, true);
      expect(result.operationally_complete).toBe(true);
      expect(result.check.passed).toBe(true);
      expect(result.check.severity).toBe('warning');
      expect(result.check.message).toContain('payment');
    });

    it('passes with payment term when payment block present', () => {
      const notes =
        'Account required. Authentication via api key. Pricing per request. Complete payment onboarding at /amp/onboard. Budget controls supported. Extended to 150 chars for v0.3.';
      const result = checkAgentOperationalCompleteness(notes, true, true);
      expect(result.operationally_complete).toBe(true);
      expect(result.check.severity).toBe('info');
    });
  });
});
