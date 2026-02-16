import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Seed a placeholder for local development (replace with real APIs via submission)
  const example = await prisma.listing.upsert({
    where: { url: 'https://api.example.com' },
    update: {},
    create: {
      name: 'Example API',
      url: 'https://api.example.com',
      description:
        'Placeholder for local development. Submit real APIs via POST /listings/submit to populate the registry.',
      primary_category: 'reference',
      categories: ['other'],
      pricing_model: 'free',
      auth_required: false,
      maintained_by: 'individual',
      contact: 'https://github.com/AMProtocol/AMP',
      manifest: {
        spec_version: 'agentmanifest-0.1',
        name: 'Example API',
        version: '1.0.0',
        description: 'Placeholder manifest for local development.',
        categories: ['other'],
        primary_category: 'reference',
      },
      check_status: 'verified',
      verified_at: new Date(),
      last_checked_at: new Date(),
    },
  });

  console.log('✓ Seeded example listing:', example.id);
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
