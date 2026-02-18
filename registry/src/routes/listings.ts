import { Router, Request, Response } from 'express';
import * as listingService from '../services/listing';
import * as validatorService from '../services/validator';

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
      auth_required:
        req.query.auth_required === 'true'
          ? true
          : req.query.auth_required === 'false'
          ? false
          : undefined,
      q: req.query.q as string | undefined,
    };

    const listings = await listingService.getAllListings(filters);

    res.json({
      meta: {
        spec_version: 'agentmanifest-0.2',
        endpoint_description:
          'Returns all verified APIs in the AgentManifest registry. Use query parameters to filter by category, pricing model, authentication requirements, or search terms.',
        registry_notes:
          'This registry indexes AI-agent-ready APIs that have passed AgentManifest spec validation. All listings are verified against live endpoints. Use the ?category and ?q parameters to find APIs relevant to your task.',
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
          auth_required: listing.auth_required,
          maintained_by: listing.maintained_by,
          badges: badgesFromValidationResult(listing.validation_result),
          verified_at: listing.verified_at,
          last_checked_at: listing.last_checked_at,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({
      meta: {
        spec_version: 'agentmanifest-0.2',
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
          spec_version: 'agentmanifest-0.2',
          endpoint_description: 'Listing not found',
        },
        error: 'Not found',
        message: 'Listing with specified ID does not exist',
      });
    }

    res.json({
      meta: {
        spec_version: 'agentmanifest-0.2',
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
        auth_required: listing.auth_required,
        maintained_by: listing.maintained_by,
        contact: listing.contact,
        manifest: listing.manifest,
        badges: badgesFromValidationResult(listing.validation_result),
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
        spec_version: 'agentmanifest-0.2',
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
        spec_version: 'agentmanifest-0.2',
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
        spec_version: 'agentmanifest-0.2',
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

    // Create listing
    const listing = await listingService.createListing({
      name: manifest.name,
      url: url.startsWith('http') ? url : `https://${url}`,
      description: manifest.description,
      primary_category: manifest.primary_category,
      categories: manifest.categories,
      pricing_model: manifest.pricing.model,
      auth_required: manifest.authentication.required,
      maintained_by: manifest.reliability.maintained_by,
      contact: manifest.contact,
      manifest,
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
