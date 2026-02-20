import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join } from 'path';

const schema = JSON.parse(
  readFileSync(join(__dirname, '../../spec/schema.json'), 'utf-8')
);
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const fixturesDir = join(__dirname, '../../fixtures');

function loadFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(join(fixturesDir, name), 'utf-8')
  );
}

describe('Schema validation', () => {
  it('valid v0.2 manifest passes schema', () => {
    const manifest = loadFixture('v02-valid.json');
    const valid = validate(manifest);
    expect(valid).toBe(true);
  });

  it('valid v0.3 free manifest passes schema', () => {
    const manifest = loadFixture('v03-free-valid.json');
    const valid = validate(manifest);
    expect(valid).toBe(true);
  });

  it('valid v0.3 paid manifest passes schema', () => {
    const manifest = loadFixture('v03-paid-valid.json');
    const valid = validate(manifest);
    expect(valid).toBe(true);
  });

  it('v0.3 paid manifest without onboarding fails schema', () => {
    const manifest = loadFixture('v03-paid-invalid.json');
    const valid = validate(manifest);
    expect(valid).toBe(false);
    expect(validate.errors).toBeDefined();
    expect(validate.errors!.length).toBeGreaterThan(0);
  });

  it('v0.3 agent_notes short (149 chars) fails schema (v0.3 requires min 150)', () => {
    const manifest = loadFixture('v03-agent-notes-short.json');
    const valid = validate(manifest);
    expect(valid).toBe(false);
    expect(validate.errors?.some((e) => e.message?.includes('minLength') || e.instancePath?.includes('agent_notes'))).toBe(true);
  });

  it('v0.3 payment no terms passes schema', () => {
    const manifest = loadFixture('v03-payment-no-terms.json');
    const valid = validate(manifest);
    expect(valid).toBe(true);
  });

  it('invalid spec_version fails schema', () => {
    const manifest = loadFixture('v02-valid.json');
    (manifest as Record<string, unknown>).spec_version = 'agentmanifest-0.1';
    const valid = validate(manifest);
    expect(valid).toBe(false);
  });

  it('cost_hint with valid format passes', () => {
    const manifest = loadFixture('v03-paid-valid.json');
    const valid = validate(manifest);
    expect(valid).toBe(true);
  });

  it('v0.3 payment with invalid rates[].price format fails schema', () => {
    const manifest = loadFixture('v03-paid-valid.json') as Record<string, unknown>;
    (manifest.payment as { rates: Array<{ unit: string; price: string }> }).rates[0].price = 'abc';
    const valid = validate(manifest);
    expect(valid).toBe(false);
  });

  it('v0.3 payment with postpaid_cycle but missing cycle fails schema', () => {
    const manifest = loadFixture('v03-paid-valid.json') as Record<string, unknown>;
    (manifest.payment as { settlement: { type: string; cycle: string | null } }).settlement = {
      type: 'postpaid_cycle',
      cycle: null,
    };
    const valid = validate(manifest);
    expect(valid).toBe(false);
  });
});
