import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index';

vi.mock('../services/listing', () => ({
  getAllListings: vi.fn(),
  getListingById: vi.fn(),
  getListingByUrl: vi.fn(),
  createListing: vi.fn(),
  updateListing: vi.fn(),
  getCategoryCounts: vi.fn(),
}));

import * as listingService from '../services/listing';

describe('GET /listings', () => {
  beforeEach(() => {
    vi.mocked(listingService.getAllListings).mockResolvedValue([
      {
        id: 'test-1',
        name: 'Test API',
        url: 'https://api.example.com',
        description: 'A test API',
        primary_category: 'reference',
        categories: ['other'],
        pricing_model: 'free',
        payment_model: null,
        payment_currency: null,
        settlement_type: null,
        supports_spend_cap: null,
        auth_required: false,
        maintained_by: 'individual',
        contact: 'test@example.com',
        manifest: {},
        badges: ['auth-verified'],
        validation_result: null,
        verification_token: null,
        verified_at: new Date(),
        last_checked_at: new Date(),
        check_status: 'verified',
        failure_reason: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  });

  it('returns listings with meta', async () => {
    const res = await request(app).get('/listings');
    expect(res.status).toBe(200);
    expect(res.body.meta.spec_version).toBe('agentmanifest-0.3');
    expect(res.body.meta.query_params).toBeDefined();
    expect(res.body.data.count).toBe(1);
    expect(res.body.data.listings).toHaveLength(1);
    expect(res.body.data.listings[0].name).toBe('Test API');
  });

  it('passes filter params to getAllListings', async () => {
    await request(app).get('/listings?category=chemistry&payment_model=per_request');
    expect(listingService.getAllListings).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'chemistry',
        payment_model: 'per_request',
      })
    );
  });

  it('parses free_only and supports_spend_cap', async () => {
    await request(app).get('/listings?free_only=true&supports_spend_cap=true');
    expect(listingService.getAllListings).toHaveBeenCalledWith(
      expect.objectContaining({
        free_only: true,
        supports_spend_cap: true,
      })
    );
  });

  it('parses sort, limit, offset', async () => {
    await request(app).get('/listings?sort=name&limit=5&offset=10');
    expect(listingService.getAllListings).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: 'name',
        limit: 5,
        offset: 10,
      })
    );
  });
});

describe('GET /listings/:id', () => {
  beforeEach(() => {
    vi.mocked(listingService.getListingById).mockResolvedValue(null);
  });

  it('returns 404 when listing not found', async () => {
    const res = await request(app).get('/listings/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it('returns v0.3 payment fields when listing has payment metadata', async () => {
    vi.mocked(listingService.getListingById).mockResolvedValue({
      id: 'test-v03',
      name: 'Paid API',
      url: 'https://api.example.com',
      description: 'A paid API',
      primary_category: 'reference',
      categories: ['other'],
      pricing_model: 'usage_based',
      payment_model: 'per_request',
      payment_currency: 'USD',
      settlement_type: 'real_time',
      supports_spend_cap: true,
      auth_required: true,
      maintained_by: 'individual',
      contact: 'test@example.com',
      manifest: {},
      badges: ['payment-ready', 'budget-aware'],
      validation_result: null,
      verification_token: null,
      verified_at: new Date(),
      last_checked_at: new Date(),
      check_status: 'verified',
      failure_reason: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    const res = await request(app).get('/listings/test-v03');
    expect(res.status).toBe(200);
    expect(res.body.data.payment_model).toBe('per_request');
    expect(res.body.data.payment_currency).toBe('USD');
    expect(res.body.data.settlement_type).toBe('real_time');
    expect(res.body.data.supports_spend_cap).toBe(true);
    expect(res.body.data.badges).toEqual(['payment-ready', 'budget-aware']);
  });
});

describe('GET /health', () => {
  it('returns healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });
});
