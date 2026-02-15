import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Seed BakeBase as the first verified listing
  const bakebase = await prisma.listing.upsert({
    where: { url: 'https://bakebase-production.up.railway.app' },
    update: {},
    create: {
      name: 'BakeBase',
      url: 'https://bakebase-production.up.railway.app',
      description:
        'AI-first food science reference API covering the functional properties of baking ingredients. Returns hydration ratios, protein interactions, leavening chemistry, pH profiles, substitution logic, and ingredient combination analysis. Designed for AI agents building food, recipe, and culinary applications.',
      primary_category: 'reference',
      categories: ['food-science', 'chemistry'],
      pricing_model: 'free',
      auth_required: false,
      maintained_by: 'individual',
      contact: 'https://github.com/BrandonWeber-Nymbl/BakeBase',
      manifest: {
        // This will be populated during actual validation
        // For seed purposes, we're using a placeholder
        spec_version: 'agentmanifest-0.1',
        name: 'BakeBase',
        version: '1.0.0',
        description:
          'AI-first food science reference API covering the functional properties of baking ingredients.',
        categories: ['food-science', 'chemistry'],
        primary_category: 'reference',
      },
      check_status: 'verified',
      verified_at: new Date(),
      last_checked_at: new Date(),
    },
  });

  console.log('✓ Seeded BakeBase:', bakebase.id);
  console.log('\nDatabase seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
