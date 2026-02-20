import { Router, Request, Response } from 'express';
import * as listingService from '../services/listing';
import * as validatorService from '../services/validator';
import {
  normalizeContact,
  extractMaintainedBy,
  extractPaymentMetadata,
} from '../lib/manifestMetadata';

/** Extract badges from stored validation result. Registry computes display values from raw result. */
function badgesFromValidationResult(vr: unknown): string[] {
  if (vr && typeof vr === 'object' && 'badges' in vr && Array.isArray((vr as any).badges)) {
    return (vr as any).badges;
  }
  return [];
}

const router = Router();

// Store submission statuses in memory (in production, use database or Redis)
const submissionStatuses = new Map<
  string,
  {
    id: string;
    url: string;
    status: 'pending' | 'validating' | 'completed' | 'failed';
    listing_id?: string;
    error?: string;
    created_at: string;
  }
>();

// GET /listings - Get all verified listings with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters = {
      category: req.query.category as string | undefined,
      primary_category: req.query.primary_category as string | undefined,
      pricing_model: req.query.pricing_model as string | undefined,
      payment_model: req.query.payment_model as string | undefined,
      payment_currency: req.query.payment_currency as string | undefined,
      settlement_type: req.query.settlement_type as string | undefined,
      supports_spend_cap:
        req.query.supports_spend_cap === 'true'
          ? true
          : req.query.supports_spend_cap === 'false'
            ? false
            : undefined,
      auth_required:
        req.query.auth_required === 'true'
          ? true
          : req.query.auth_required === 'false'
            ? false
            : undefined,
      maintained_by: req.query.maintained_by as string | undefined,
      free_only: req.query.free_only === 'true',
      badges: req.query.badges as string | undefined,
      q: req.query.q as string | undefined,
      sort: req.query.sort as string | undefined,
      limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
      offset: req.query.offset ? parseInt(String(req.query.offset), 10) : undefined,
    };

    const listings = await listingService.getAllListings(filters);

    res.json({
      meta: {
        spec_version: 'agentmanifest-0.3',
        endpoint_description:
          'Returns all verified APIs in the AgentManifest registry. Filter by category, pricing, payment model, auth, badges, and more.',
        query_params: {
          category: 'Filter by category (e.g. chemistry, finance)',
          primary_category: 'reference, live, computational, transactional, enrichment, personal, discovery',
          pricing_model: 'free, per-query, subscription, tiered, usage_based',
          payment_model: 'v0.3: per_request, metered_usage, prepaid_credits, subscription',
          payment_currency: 'v0.3: USD, EUR, or x- prefixed',
          settlement_type: 'v0.3: real_time, postpaid_cycle, prepaid_debit',
          supports_spend_cap: 'v0.3: true to filter APIs with spend cap support',
          auth_required: 'true or false',
          maintained_by: 'individual, organization, community',
          free_only: 'true for free APIs only',
          badges: 'comma-separated: auth-verified, payment-ready, budget-aware',
          q: 'Search name and description',
          sort: 'name, created_at, verified_at',
          limit: 'Max results (default 100, max 500)',
          offset: 'Pagination offset',
        },
        registry_notes:
          'This registry indexes AI-agent-ready APIs that have passed AgentManifest spec validation. All listings are verified against live endpoints.',
      },
      data: {
        count: listings.length,
        listings: listings.map((listing) => ({
          id: listing.id,
          name: listing.name,
          url: listing.url,
          description: listing.description,
          primary_category: listing.primary_category,
          categories: listing.categories,
          pricing_model: listing.pricing_model,
          payment_model: listing.payment_model,
          payment_currency: listing.payment_currency,
          settlement_type: listing.settlement_type,
          supports_spend_cap: listing.supports_spend_cap,
          auth_required: listing.auth_required,
          maintained_by: listing.maintained_by,
          badges: listing.badges?.length ? listing.badges : badgesFromValidationResult(listing.validation_result),
          verified_at: listing.verified_at,
          last_checked_at: listing.last_checked_at,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({
      meta: {
        spec_version: 'agentmanifest-0.3',
        endpoint_description: 'Error occurred',
      },
      error: 'Internal server error',
      message: (error as Error).message,
    });
  }
});

// GET /listings/:id - Get single listing with full manifest
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const listing = await listingService.getListingById(id);

    if (!listing) {
      return res.status(404).json({
        meta: {
        spec_version: 'agentmanifest-0.3',
        endpoint_description: 'Listing not found',
        },
        error: 'Not found',
        message: 'Listing with specified ID does not exist',
      });
    }

    res.json({
      meta: {
        spec_version: 'agentmanifest-0.3',
        endpoint_description:
          'Returns full details for a specific API listing including the complete stored manifest.',
      },
      data: {
        id: listing.id,
        name: listing.name,
        url: listing.url,
        description: listing.description,
        primary_category: listing.primary_category,
        categories: listing.categories,
        pricing_model: listing.pricing_model,
        payment_model: listing.payment_model,
        payment_currency: listing.payment_currency,
        settlement_type: listing.settlement_type,
        supports_spend_cap: listing.supports_spend_cap,
        auth_required: listing.auth_required,
        maintained_by: listing.maintained_by,
        contact: listing.contact,
        manifest: listing.manifest,
        badges: listing.badges?.length ? listing.badges : badgesFromValidationResult(listing.validation_result),
        check_status: listing.check_status,
        verified_at: listing.verified_at,
        last_checked_at: listing.last_checked_at,
        created_at: listing.created_at,
        updated_at: listing.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching listing:', error);
    res.status(500).json({
      meta: {
        spec_version: 'agentmanifest-0.3',
        endpoint_description: 'Error occurred',
      },
      error: 'Internal server error',
      message: (error as Error).message,
    });
  }
});

// POST /listings/submit - Submit API for validation and listing
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        message: 'Request body must include "url" field',
      });
    }

    // Check if already listed
    const existing = await listingService.getListingByUrl(url);
    if (existing) {
      return res.status(409).json({
        error: 'Already listed',
        message: 'This API is already in the registry',
        listing_id: existing.id,
      });
    }

    // Create submission record
    const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const submission = {
      id: submissionId,
      url,
      status: 'pending' as const,
      created_at: new Date().toISOString(),
    };

    submissionStatuses.set(submissionId, submission);

    // Start validation asynchronously
    processSubmission(submissionId, url).catch((error) => {
      console.error('Submission processing error:', error);
    });

    res.status(202).json({
      meta: {
        spec_version: 'agentmanifest-0.3',
        endpoint_description:
          'Submission accepted. Validation is running asynchronously.',
      },
      data: {
        submission_id: submissionId,
        status: 'pending',
        status_url: `/listings/submit/${submissionId}/status`,
        message:
          'Submission accepted. Check status_url for validation progress.',
      },
    });
  } catch (error) {
    console.error('Error submitting listing:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: (error as Error).message,
    });
  }
});

// GET /listings/submit/:id/status - Check submission status
router.get('/submit/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const submission = submissionStatuses.get(id);

    if (!submission) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Submission not found',
      });
    }

    const response: any = {
      meta: {
        spec_version: 'agentmanifest-0.3',
        endpoint_description: 'Returns the current status of a submission',
      },
      data: {
        submission_id: submission.id,
        url: submission.url,
        status: submission.status,
        created_at: submission.created_at,
      },
    };

    if (submission.listing_id) {
      response.data.listing_id = submission.listing_id;
      response.data.listing_url = `/listings/${submission.listing_id}`;
    }

    if (submission.error) {
      response.data.error = submission.error;
    }

    res.json(response);
  } catch (error) {
    console.error('Error checking submission status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: (error as Error).message,
    });
  }
});

// Process submission asynchronously
async function processSubmission(submissionId: string, url: string) {
  const submission = submissionStatuses.get(submissionId);
  if (!submission) return;

  try {
    // Update status to validating
    submission.status = 'validating';

    // Run validation
    const validationResult = await validatorService.validateAPI(url);

    if (!validationResult.passed) {
      submission.status = 'failed';
      submission.error = 'Validation failed: ' + validationResult.checks
        .filter((c) => !c.passed && c.severity === 'error')
        .map((c) => c.message)
        .join('; ');
      return;
    }

    // Fetch manifest
    const manifest = await validatorService.fetchManifest(url);
    const paymentMeta = extractPaymentMetadata(manifest);

    // Create listing
    const listing = await listingService.createListing({
      name: manifest.name,
      url: url.startsWith('http') ? url : `https://${url}`,
      description: manifest.description,
      primary_category: manifest.primary_category,
      categories: manifest.categories,
      pricing_model: manifest.pricing.model,
      payment_model: paymentMeta.payment_model ?? undefined,
      payment_currency: paymentMeta.payment_currency ?? undefined,
      settlement_type: paymentMeta.settlement_type ?? undefined,
      supports_spend_cap: paymentMeta.supports_spend_cap ?? undefined,
      auth_required: manifest.authentication.required,
      maintained_by: extractMaintainedBy(manifest),
      contact: normalizeContact(manifest.contact),
      manifest,
      badges: (validationResult as { badges?: string[] }).badges ?? [],
      validation_result: validationResult as any,
      verification_token: validationResult.verification_token || undefined,
      check_status: 'verified',
    });

    submission.status = 'completed';
    submission.listing_id = listing.id;
  } catch (error) {
    submission.status = 'failed';
    submission.error = (error as Error).message;
  }
}

export default router;
