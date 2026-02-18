const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkItems() {
  const markets = await prisma.market.findMany({
    select: {
      marketId: true,
      items: true,
      itemCount: true,
    },
    take: 5,
  });
  console.log('Markets with items:');
  markets.forEach(m => {
    console.log(`Market ${m.marketId}: items=${JSON.stringify(m.items)}, count=${m.itemCount}`);
  });
  await prisma.$disconnect();
}

checkItems();
