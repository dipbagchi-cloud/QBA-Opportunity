const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const map = {
  'India': 'India',
  'North America': 'United States, Canada, Mexico',
  'Europe': 'United Kingdom, Germany, France, Netherlands, Switzerland, Sweden, Norway, Denmark, Finland, Ireland, Belgium, Spain, Italy, Poland, Austria, Portugal, Czech Republic, Romania, Greece',
  'Asia Pacific': 'Japan, China, South Korea, Singapore, Hong Kong, Taiwan, Thailand, Malaysia, Indonesia, Philippines, Vietnam, New Zealand',
  'Australia': 'Australia',
  'Middle East': 'UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman, Israel, Turkey',
  'Latin America': 'Brazil, Argentina, Chile, Colombia, Peru',
  'Africa': 'South Africa, Nigeria, Kenya, Egypt, Ghana, Morocco'
};
(async () => {
  for (const [region, countries] of Object.entries(map)) {
    const r = await p.region.findFirst({ where: { name: region, isActive: true } });
    if (r) {
      await p.region.update({ where: { id: r.id }, data: { countries } });
      console.log('Updated:', region, '->', countries.split(',').length, 'countries');
    } else {
      console.log('NOT FOUND:', region);
    }
  }
  await p.$disconnect();
})();
