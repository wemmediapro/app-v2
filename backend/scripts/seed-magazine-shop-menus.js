/**
 * Seed : articles (magazine), produits (shop), restaurants avec menus.
 * Usage: depuis backend/ : node scripts/seed-magazine-shop-menus.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
const mongoose = require('mongoose');
const Article = require('../src/models/Article');
const Product = require('../src/models/Product');
const Restaurant = require('../src/models/Restaurant');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gnv_onboard';
const IMG = 'https://picsum.photos/800/400';

const articles = [
  {
    title: 'Escales en Méditerranée : les incontournables',
    excerpt: 'Découvrez les plus belles escales de nos traversées entre l\'Italie, la France et l\'Espagne.',
    content: 'La Méditerranée offre une multitude de destinations magnifiques. De Barcelone à Tunis en passant par Palerme, chaque escale a son charme. Nous vous guidons à travers les must-see de la saison.',
    category: 'Voyage',
    author: 'Marie Dupont',
    imageUrl: IMG,
    isPublished: true,
    status: 'published',
    publishedAt: new Date(),
    featured: true,
    readingTime: 5,
    isActive: true,
    tags: ['Méditerranée', 'escales', 'croisière']
  },
  {
    title: 'Cuisine à bord : les secrets de nos chefs',
    excerpt: 'Rencontre avec les chefs des restaurants du bord et leurs recettes signature.',
    content: 'Nos chefs travaillent avec des produits frais et des recettes inspirées des régions traversées. Découvrez comment ils composent les menus et quels plats ne pas manquer.',
    category: 'Gastronomie',
    author: 'Jean Martin',
    imageUrl: IMG,
    isPublished: true,
    status: 'published',
    publishedAt: new Date(),
    featured: true,
    readingTime: 6,
    isActive: true,
    tags: ['restaurant', 'chef', 'cuisine']
  },
  {
    title: 'Activités à bord : sport et bien-être',
    excerpt: 'Tout ce que vous pouvez faire pendant la traversée pour rester actif.',
    content: 'Piscine, salle de sport, spa, animations pour enfants… Le navire regorge d\'activités pour tous les âges. Voici le programme type d\'une journée à bord.',
    category: 'Lifestyle',
    author: 'Sophie Leroy',
    imageUrl: IMG,
    isPublished: true,
    status: 'published',
    publishedAt: new Date(),
    featured: false,
    readingTime: 4,
    isActive: true,
    tags: ['sport', 'bien-être', 'activités']
  },
  {
    title: 'Actualités de la compagnie : nouvelles destinations',
    excerpt: 'Prochaines ouvertures et nouveautés pour la saison à venir.',
    content: 'La compagnie annonce de nouvelles liaisons et des améliorations à bord. Résumé des annonces et des dates à retenir.',
    category: 'Actualités',
    author: 'Rédaction GNV',
    imageUrl: IMG,
    isPublished: true,
    status: 'published',
    publishedAt: new Date(),
    featured: false,
    readingTime: 3,
    isActive: true,
    tags: ['actualités', 'destinations']
  },
  {
    title: 'Culture et patrimoine des villes portuaires',
    excerpt: 'Palerme, Tunis, Barcelone : un aperçu culturel de nos escales.',
    content: 'Chaque port d\'escale recèle un patrimoine unique. Monuments, musées et traditions à ne pas manquer lors de vos escales.',
    category: 'Culture',
    author: 'Pierre Bernard',
    imageUrl: IMG,
    isPublished: true,
    status: 'published',
    publishedAt: new Date(),
    featured: false,
    readingTime: 7,
    isActive: true,
    tags: ['culture', 'patrimoine', 'escales']
  }
];

const products = [
  {
    name: 'Polo GNV Officiel',
    description: 'Polo à manches courtes aux couleurs de la compagnie, coupe moderne.',
    category: 'fashion',
    price: 29.99,
    originalPrice: 39.99,
    stock: 50,
    sku: 'POLO-GNV-001',
    type: 'physical',
    rating: 4.5,
    tags: ['vêtement', 'souvenir'],
    images: [{ url: IMG, alt: 'Polo GNV', isPrimary: true }],
    isActive: true,
    isFeatured: true
  },
  {
    name: 'Tasse souvenir traversée',
    description: 'Tasse en céramique avec carte des traversées Méditerranée.',
    category: 'souvenirs',
    price: 12.99,
    stock: 100,
    sku: 'MUG-001',
    type: 'physical',
    rating: 4.8,
    tags: ['souvenir', 'tasse'],
    images: [{ url: IMG, alt: 'Tasse', isPrimary: true }],
    isActive: true,
    isFeatured: true
  },
  {
    name: 'Chocolats de luxe',
    description: 'Assortiment de chocolats belges, boîte cadeau.',
    category: 'food',
    price: 24.99,
    stock: 30,
    sku: 'CHOCO-001',
    type: 'physical',
    rating: 5,
    tags: ['gastronomie', 'cadeau'],
    images: [{ url: IMG, alt: 'Chocolats', isPrimary: true }],
    isActive: true,
    isFeatured: false
  },
  {
    name: 'Sac à dos voyage',
    description: 'Sac à dos léger et résistant, idéal pour les escales.',
    category: 'accessories',
    price: 45.99,
    stock: 25,
    sku: 'BAG-001',
    type: 'physical',
    rating: 4.2,
    tags: ['accessoire', 'voyage'],
    images: [{ url: IMG, alt: 'Sac', isPrimary: true }],
    isActive: true,
    isFeatured: false
  }
];

const restaurantsWithMenus = [
  {
    name: 'The Swordfish & Steakhouse',
    type: 'Steakhouse',
    category: 'french',
    location: 'Pont 7 - Babor',
    description: 'Restaurant à la carte, viandes et poissons grillés, ambiance raffinée.',
    rating: 4.6,
    priceRange: '€€€',
    image: IMG,
    isOpen: true,
    openingHours: '19h00 - 23h00',
    specialties: ['Entrecôte', 'Saumon', 'Fruits de mer'],
    menu: [
      { id: 1, name: 'Entrecôte grillée 300g', description: 'Servie avec frites maison et sauce au poivre', price: 24.9, category: 'Plats', isPopular: true, allergens: ['gluten'], image: IMG },
      { id: 2, name: 'Saumon atlantique', description: 'Pavé de saumon, légumes de saison', price: 22.5, category: 'Plats', isPopular: true, allergens: [], image: IMG },
      { id: 3, name: 'Salade César', description: 'Poulet grillé, parmesan, croûtons', price: 14.9, category: 'Entrées', isPopular: false, allergens: ['gluten', 'lactose'], image: IMG },
      { id: 4, name: 'Tiramisu maison', description: 'Recette traditionnelle italienne', price: 8.5, category: 'Desserts', isPopular: true, allergens: ['lactose', 'œuf'], image: IMG }
    ],
    isActive: true
  },
  {
    name: 'The Transatlantic',
    type: 'Restaurant Self-Service',
    category: 'fastfood',
    location: 'Pont 8',
    description: 'Buffet varié, cuisine internationale, service rapide.',
    rating: 4.2,
    priceRange: '€€',
    image: IMG,
    isOpen: true,
    openingHours: '07h00 - 22h00',
    specialties: ['Buffet', 'Pâtes', 'Grill'],
    menu: [
      { id: 1, name: 'Formule déjeuner', description: 'Plat du jour + dessert + boisson', price: 15.9, category: 'Formules', isPopular: true, allergens: [], image: IMG },
      { id: 2, name: 'Pâtes fraîches', description: 'Au choix : bolognaise, carbonara ou pesto', price: 11.9, category: 'Plats', isPopular: true, allergens: ['gluten'], image: IMG },
      { id: 3, name: 'Burger classique', description: 'Steak, salade, tomate, oignons', price: 12.5, category: 'Plats', isPopular: true, allergens: ['gluten'], image: IMG },
      { id: 4, name: 'Café + viennoiserie', description: 'Café ou thé + croissant ou pain au chocolat', price: 5.9, category: 'Snacks', isPopular: false, allergens: ['gluten'], image: IMG }
    ],
    isActive: true
  },
  {
    name: 'Snack Bar / Café',
    type: 'Café & Snacks',
    category: 'dessert',
    location: 'Pont 7 - Café',
    description: 'Boissons chaudes, pâtisseries, sandwiches et snacks 24h/24.',
    rating: 4.0,
    priceRange: '€',
    image: IMG,
    isOpen: true,
    openingHours: '24h/24',
    specialties: ['Café', 'Pâtisseries', 'Sandwiches'],
    menu: [
      { id: 1, name: 'Cappuccino', description: 'Café italien avec mousse de lait', price: 3.5, category: 'Boissons', isPopular: true, allergens: ['lactose'], image: IMG },
      { id: 2, name: 'Sandwich club', description: 'Poulet, bacon, salade, tomate', price: 7.9, category: 'Snacks', isPopular: true, allergens: ['gluten'], image: IMG },
      { id: 3, name: 'Croissant beurre', description: 'Viennoiserie fraîche', price: 2.9, category: 'Pâtisseries', isPopular: false, allergens: ['gluten'], image: IMG },
      { id: 4, name: 'Salade fraîcheur', description: 'Quinoa, avocat, tomates cerises', price: 9.5, category: 'Snacks', isPopular: false, allergens: [], image: IMG }
    ],
    isActive: true
  }
];

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB:', mongoose.connection.name);

    const artInsert = await Article.insertMany(articles);
    console.log('✅ Articles (magazine) insérés:', artInsert.length);

    const prodInsert = await Product.insertMany(products);
    console.log('✅ Produits (shop) insérés:', prodInsert.length);

    const restInsert = await Restaurant.insertMany(restaurantsWithMenus);
    console.log('✅ Restaurants avec menus insérés:', restInsert.length);

    console.log('\n🎉 Seed terminé : magazine, shop et menus en base.');
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    if (err.code === 11000) console.error('   (Doublon possible : SKU ou données déjà présentes. Supprimez les anciennes données ou changez les SKU.)');
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
