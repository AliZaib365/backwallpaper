require('dotenv').config();
const mongoose = require('mongoose');
const MainCategory = require('./models/MainCategory');
const SubCategory = require('./models/SubCategory');

const categories = [
  { name: 'Nature', subs: ['Forest', 'Mountain', 'Ocean', 'Desert', 'Flowers'] },
  { name: 'Abstract', subs: ['Shapes', 'Colors', 'Patterns', 'Textures'] },
  { name: 'Animals', subs: ['Birds', 'Mammals', 'Reptiles', 'Marine Life'] },
  { name: 'Space', subs: ['Stars', 'Planets', 'Galaxies', 'Nebulae'] }
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  await MainCategory.deleteMany({});
  await SubCategory.deleteMany({});
  for (const cat of categories) {
    const mainCat = await MainCategory.create({ name: cat.name });
    for (const sub of cat.subs) {
      await SubCategory.create({ name: sub, mainCategory: mainCat._id });
    }
  }
  console.log('Main and subcategories seeded!');
  process.exit();
}

seed();