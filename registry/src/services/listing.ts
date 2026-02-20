import { PrismaClient, Listing, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface ListingFilters {
  category?: string;
  primary_category?: string;
  pricing_model?: string;
  payment_model?: string; // v0.3
  payment_currency?: string; // v0.3
  settlement_type?: string; // v0.3: real_time, postpaid_cycle, prepaid_debit
  supports_spend_cap?: boolean; // v0.3: filter for APIs with spend cap
  auth_required?: boolean;
  maintained_by?: string; // individual, organization, community
  free_only?: boolean; // pricing_model free or payment null
  badges?: string; // comma-separated: auth-verified, payment-ready, budget-aware
  q?: string; // Search query (name, description)
  sort?: string; // name, created_at, verified_at
  limit?: number;
  offset?: number;
}

export async function getAllListings(
  filters: ListingFilters = {}
): Promise<Listing[]> {
  const where: any = {
    check_status: 'verified', // Only return verified listings
  };

  if (filters.category) {
    where.categories = {
      has: filters.category,
    };
  }

  if (filters.primary_category) {
    where.primary_category = filters.primary_category;
  }

  if (filters.pricing_model) {
    where.pricing_model = filters.pricing_model;
  }

  if (filters.payment_model) {
    where.payment_model = filters.payment_model;
  }

  if (filters.payment_currency) {
    where.payment_currency = filters.payment_currency;
  }

  if (filters.settlement_type) {
    where.settlement_type = filters.settlement_type;
  }

  if (filters.supports_spend_cap !== undefined) {
    where.supports_spend_cap = filters.supports_spend_cap;
  }

  if (filters.auth_required !== undefined) {
    where.auth_required = filters.auth_required;
  }

  if (filters.maintained_by) {
    where.maintained_by = filters.maintained_by;
  }

  if (filters.free_only) {
    // pricing_model is source of truth; payment_model: 'free' covers v0.3 explicit free
    // Do NOT use payment_model: null - it would incorrectly match v0.2 paid APIs
    where.OR = [
      { pricing_model: 'free' },
      { payment_model: 'free' },
    ];
  }

  if (filters.q) {
    // Fuzzy search on name and description
    const searchClause = [
      { name: { contains: filters.q, mode: 'insensitive' } },
      { description: { contains: filters.q, mode: 'insensitive' } },
    ];
    where.AND = where.AND || [];
    (where.AND as object[]).push({ OR: searchClause });
  }

  if (filters.badges) {
    const badgeList = filters.badges.split(',').map((b) => b.trim());
    where.badges = { hasSome: badgeList };
  }

  const orderBy =
    filters.sort === 'name'
      ? { name: 'asc' as const }
      : filters.sort === 'verified_at'
        ? { verified_at: 'desc' as const }
        : { created_at: 'desc' as const };

  const skip = filters.offset ?? 0;
  const take = Math.min(filters.limit ?? 100, 500);

  return prisma.listing.findMany({
    where,
    orderBy,
    skip,
    take,
  });
}

export async function getListingById(id: string): Promise<Listing | null> {
  return prisma.listing.findUnique({
    where: { id },
  });
}

export async function getListingByUrl(url: string): Promise<Listing | null> {
  return prisma.listing.findUnique({
    where: { url },
  });
}

/** Validation result shape from validator (stateless compute layer) */
export interface StoredValidationResult {
  schema_valid?: boolean;
  endpoints_reachable?: boolean;
  auth_verified?: boolean;
  payment_flow_verified?: boolean;
  operationally_complete?: boolean;
  badges?: string[];
  [key: string]: unknown;
}

export async function createListing(data: {
  name: string;
  url: string;
  description: string;
  primary_category: string;
  categories: string[];
  pricing_model: string;
  payment_model?: string;
  payment_currency?: string;
  settlement_type?: string;
  supports_spend_cap?: boolean;
  auth_required: boolean;
  maintained_by: string;
  contact: string;
  manifest: any;
  badges?: string[];
  validation_result?: StoredValidationResult | null;
  verification_token?: string;
  check_status?: string;
  failure_reason?: string;
}): Promise<Listing> {
  const { validation_result, ...rest } = data;
  return prisma.listing.create({
    data: {
      ...rest,
      badges: data.badges ?? [],
      validation_result: (validation_result ?? undefined) as Prisma.InputJsonValue | undefined,
      verified_at: data.check_status === 'verified' ? new Date() : null,
      last_checked_at: new Date(),
    },
  });
}

export async function updateListing(
  id: string,
  data: any
): Promise<Listing> {
  return prisma.listing.update({
    where: { id },
    data: {
      ...data,
      updated_at: new Date(),
    },
  });
}

export async function getCategoryCounts(): Promise<
  Array<{ category: string; count: number }>
> {
  const listings = await prisma.listing.findMany({
    where: {
      check_status: 'verified',
    },
    select: {
      categories: true,
    },
  });

  const categoryMap = new Map<string, number>();

  for (const listing of listings) {
    for (const category of listing.categories) {
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    }
  }

  return Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export { prisma };
