import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateManifestObject } from '../index';
import { readFileSync } from 'fs';
import { join } from 'path';

const fixturesDir = join(__dirname, '../../fixtures');

function loadFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(join(fixturesDir, name), 'utf-8')
  );
}

describe('validateManifestObject integration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('v0.2 manifest passes validation', async () => {
    const manifest = loadFixture('v02-valid.json');
    const result = await validateManifestObject(manifest as Record<string, unknown>, 'local-file');
    expect(result.passed).toBe(true);
    expect(result.spec_version).toBe('agentmanifest-0.2');
    expect(result.schema_valid).toBe(true);
    expect(result.checks.every((c) => c.passed || c.severity !== 'error')).toBe(true);
  });

  it('v0.3 free manifest passes validation', async () => {
    const manifest = loadFixture('v03-free-valid.json');
    const result = await validateManifestObject(manifest as Record<string, unknown>, 'local-file');
    expect(result.passed).toBe(true);
    expect(result.spec_version).toBe('agentmanifest-0.3');
    expect(result.schema_valid).toBe(true);
  });

  it('v0.3 paid manifest runs payment checks (local validation skips network)', async () => {
    const manifest = loadFixture('v03-paid-valid.json');
    const result = await validateManifestObject(manifest as Record<string, unknown>, 'local-file');
    expect(result.spec_version).toBe('agentmanifest-0.3');
    expect(result.checks.some((c) => c.name.includes('payment'))).toBe(true);
  });

  it('v0.3 agent_notes short (149 chars) fails validation', async () => {
    const manifest = loadFixture('v03-agent-notes-short.json');
    const result = await validateManifestObject(manifest as Record<string, unknown>, 'local-file');
    expect(result.passed).toBe(false);
    const agentNotesCheck = result.checks.find((c) => c.name === 'agent_notes_length' || c.name === 'operationally_complete');
    expect(agentNotesCheck).toBeDefined();
    expect(agentNotesCheck?.passed).toBe(false);
  });

  it('v0.3 payment no terms yields warning in operational completeness', async () => {
    const manifest = loadFixture('v03-payment-no-terms.json');
    const result = await validateManifestObject(manifest as Record<string, unknown>, 'local-file');
    const opCompleteCheck = result.checks.find((c) => c.name === 'operationally_complete');
    expect(opCompleteCheck).toBeDefined();
    expect(opCompleteCheck?.passed).toBe(true);
    expect(opCompleteCheck?.severity).toBe('warning');
    expect(opCompleteCheck?.message).toContain('payment');
  });

  it('budget-aware badge when budget_controls supports spend_cap', async () => {
    const manifest = loadFixture('v03-paid-valid.json');
    const result = await validateManifestObject(manifest as Record<string, unknown>, 'local-file');
    expect(result.badges).toContain('budget-aware');
  });

  it('v0.3 paid invalid (missing onboarding) fails schema validation', async () => {
    const manifest = loadFixture('v03-paid-invalid.json');
    const result = await validateManifestObject(manifest as Record<string, unknown>, 'local-file');
    expect(result.passed).toBe(false);
    expect(result.schema_valid).toBe(false);
  });
});
