import { PrismaClient, Listing } from '@prisma/client';

const prisma = new PrismaClient();

export interface ListingFilters {
  category?: string;
  primary_category?: string;
  pricing_model?: string;
  auth_required?: boolean;
  q?: string; // Search query
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

  if (filters.auth_required !== undefined) {
    where.auth_required = filters.auth_required;
  }

  if (filters.q) {
    // Fuzzy search on name and description
    where.OR = [
      { name: { contains: filters.q, mode: 'insensitive' } },
      { description: { contains: filters.q, mode: 'insensitive' } },
    ];
  }

  return prisma.listing.findMany({
    where,
    orderBy: {
      created_at: 'desc',
    },
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

export async function createListing(data: {
  name: string;
  url: string;
  description: string;
  primary_category: string;
  categories: string[];
  pricing_model: string;
  auth_required: boolean;
  maintained_by: string;
  contact: string;
  manifest: any;
  verification_token?: string;
  check_status?: string;
  failure_reason?: string;
}): Promise<Listing> {
  return prisma.listing.create({
    data: {
      ...data,
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
