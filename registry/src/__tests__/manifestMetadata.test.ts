import { describe, it, expect } from 'vitest';
import {
  normalizeContact,
  extractMaintainedBy,
  extractPaymentMetadata,
} from '../lib/manifestMetadata';

describe('manifestMetadata', () => {
  describe('normalizeContact', () => {
    it('returns string contact as-is', () => {
      expect(normalizeContact('support@example.com')).toBe('support@example.com');
      expect(normalizeContact('https://example.com/support')).toBe('https://example.com/support');
    });

    it('extracts email from object', () => {
      expect(normalizeContact({ email: 'api@example.com' })).toBe('api@example.com');
    });

    it('falls back to support_url when no email', () => {
      expect(normalizeContact({ support_url: 'https://example.com/help' })).toBe(
        'https://example.com/help'
      );
    });

    it('falls back to JSON when no email or support_url', () => {
      const obj = { github: 'https://github.com/org' };
      expect(normalizeContact(obj)).toBe(JSON.stringify(obj));
    });

    it('returns empty string for undefined', () => {
      expect(normalizeContact(undefined)).toBe('');
    });
  });

  describe('extractMaintainedBy', () => {
    it('returns maintained_by when present', () => {
      expect(extractMaintainedBy({ reliability: { maintained_by: 'organization' } })).toBe(
        'organization'
      );
    });

    it('returns individual when reliability missing (v0.3)', () => {
      expect(extractMaintainedBy({})).toBe('individual');
    });

    it('returns individual when maintained_by missing', () => {
      expect(extractMaintainedBy({ reliability: {} })).toBe('individual');
    });
  });

  describe('extractPaymentMetadata', () => {
    it('returns nulls when no payment block', () => {
      expect(extractPaymentMetadata({})).toEqual({
        payment_model: null,
        payment_currency: null,
        settlement_type: null,
        supports_spend_cap: null,
      });
    });

    it('extracts full v0.3 payment metadata', () => {
      const manifest = {
        payment: {
          model: 'per_request',
          currency: 'USD',
          settlement: { type: 'real_time' },
          budget_controls: { supports_spend_cap: true },
        },
      };
      expect(extractPaymentMetadata(manifest)).toEqual({
        payment_model: 'per_request',
        payment_currency: 'USD',
        settlement_type: 'real_time',
        supports_spend_cap: true,
      });
    });

    it('handles partial payment block', () => {
      expect(extractPaymentMetadata({ payment: { model: 'free' } })).toEqual({
        payment_model: 'free',
        payment_currency: null,
        settlement_type: null,
        supports_spend_cap: null,
      });
    });
  });
});
