/**
 * Script d'initialisation de la base de données MongoDB
 * Crée toutes les collections et insère des données de test
 * Utilise la MÊME config que le backend (config.env + .env, DATABASE_URL prioritaire).
 *
 * Usage: node scripts/init-database.js
 * ou: npm run init-db
 */

const path = require('path');
const backendRoot = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(backendRoot, 'config.env') });
require('dotenv').config({ path: path.join(backendRoot, '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import des modèles
const User = require('../src/models/User');
const Restaurant = require('../src/models/Restaurant');
const Feedback = require('../src/models/Feedback');
const Message = require('../src/models/Message');
const Movie = require('../models/Movie');
const RadioStation = require('../models/RadioStation');
const Article = require('../models/Magazine');
const Product = require('../models/Product');
const WebTVChannel = require('../models/WebTV');
const EnfantActivity = require('../models/Enfant');
const Banner = require('../models/Banner');
const Deck = require('../models/Shipmap');

// Même URI que le backend : DATABASE_URL (ancienne base) ou MONGODB_URI (local)
const MONGODB_URI = process.env.DATABASE_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/gnv_onboard?directConnection=true';

async function connectDB() {
  try {
    const dbLabel = process.env.DATABASE_URL ? 'DATABASE_URL (ancienne base)' : 'MONGODB_URI (local)';
    console.log('📌 Base utilisée:', dbLabel);
    // Ne jamais logger l’URI complète en CI / prod — même masquée, éviter fuite de host (INIT_DB_VERBOSE=1 pour debug local)
    if (process.env.INIT_DB_VERBOSE === '1') {
      console.log('   URI (verbose):', MONGODB_URI.replace(/:[^:@]+@/, ':***@'));
    }
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');
  } catch (error) {
    console.error('❌ Erreur de connexion MongoDB:', error.message);
    process.exit(1);
  }
}

// Fonction pour créer l'utilisateur admin (ADMIN_EMAIL et ADMIN_PASSWORD requis dans config.env)
async function createAdminUser() {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim();
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error('CRITICAL: ADMIN_PASSWORD must be set in config.env to create admin user. No default password.');
      if (process.env.NODE_ENV === 'production') throw new Error('ADMIN_PASSWORD required');
      return null;
    }
    if (!adminEmail) {
      console.error('CRITICAL: ADMIN_EMAIL must be set in config.env for admin user.');
      if (process.env.NODE_ENV === 'production') throw new Error('ADMIN_EMAIL required');
      return null;
    }

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('ℹ️  Utilisateur admin existe déjà');
      return existingAdmin;
    }
    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'GNV',
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      phone: '+33 1 23 45 67 89',
      cabinNumber: 'ADMIN-001',
      preferences: {
        language: 'fr',
        notifications: {
          email: true,
          push: true,
          sms: false
        }
      },
      isActive: true
    });

    console.log('✅ Compte admin créé. Définissez ADMIN_EMAIL et ADMIN_PASSWORD dans config.env pour la connexion en production.');
    return admin;
  } catch (error) {
    console.error('❌ Erreur création admin:', error.message);
    throw error;
  }
}

// Fonction pour créer des utilisateurs de test
async function createTestUsers() {
  try {
    const users = [
      {
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@example.com',
        password: 'user1234',
        role: 'passenger',
        phone: '+33 6 12 34 56 78',
        cabinNumber: 'A-101',
        preferences: { language: 'fr' }
      },
      {
        firstName: 'Maria',
        lastName: 'Rossi',
        email: 'maria.rossi@example.com',
        password: 'user1234',
        role: 'passenger',
        phone: '+39 3 45 67 89 01',
        cabinNumber: 'B-205',
        preferences: { language: 'it' }
      },
      {
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@example.com',
        password: 'user1234',
        role: 'passenger',
        phone: '+44 7 89 01 23 45',
        cabinNumber: 'C-310',
        preferences: { language: 'en' }
      },
      {
        firstName: 'Sophie',
        lastName: 'Martin',
        email: 'sophie.martin@example.com',
        password: 'user1234',
        role: 'crew',
        phone: '+33 6 98 76 54 32',
        cabinNumber: 'CREW-001',
        preferences: { language: 'fr' }
      }
    ];

    const createdUsers = [];
    let createdCount = 0;
    let skippedCount = 0;
    for (const userData of users) {
      const existing = await User.findOne({ email: userData.email });
      if (!existing) {
        const user = await User.create(userData);
        createdUsers.push(user);
        createdCount += 1;
      } else {
        createdUsers.push(existing);
        skippedCount += 1;
      }
    }
    console.log(`✅ Utilisateurs de test : ${createdCount} créé(s), ${skippedCount} déjà présent(s).`);

    return createdUsers;
  } catch (error) {
    console.error('❌ Erreur création utilisateurs:', error.message);
    throw error;
  }
}

// Fonction pour créer des restaurants
async function createRestaurants() {
  try {
    const restaurants = [
      {
        name: 'Le Bistrot',
        type: 'Restaurant à la carte',
        category: 'french',
        location: 'Pont 7 - Aft',
        description: 'Restaurant gastronomique avec vue sur la mer',
        rating: 4.5,
        priceRange: '€€€',
        image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
        isOpen: true,
        openingHours: '19:00 - 23:00',
        specialties: ['Cuisine française', 'Poissons', 'Vins de qualité'],
        menu: [
          {
            id: 1,
            name: 'Saumon fumé',
            description: 'Saumon fumé maison, blinis et crème fraîche',
            price: 18,
            category: 'Entrées',
            isPopular: true,
            allergens: ['Poisson']
          },
          {
            id: 2,
            name: 'Entrecôte grillée',
            description: 'Entrecôte de bœuf, frites maison, sauce au poivre',
            price: 32,
            category: 'Plats',
            isPopular: true,
            allergens: []
          },
          {
            id: 3,
            name: 'Tarte Tatin',
            description: 'Tarte aux pommes renversée, glace vanille',
            price: 12,
            category: 'Desserts',
            isPopular: false,
            allergens: ['Gluten', 'Lait', 'Œufs']
          }
        ],
        promotions: [
          {
            id: 1,
            title: 'Menu du soir',
            description: 'Entrée + Plat + Dessert',
            price: 45,
            originalPrice: 62,
            discount: 27,
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
          }
        ]
      },
      {
        name: 'Self-Service',
        type: 'Restaurant Self-Service',
        category: 'fastfood',
        location: 'Pont 8 - Midship',
        description: 'Buffet varié pour tous les goûts',
        rating: 4.0,
        priceRange: '€',
        image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
        isOpen: true,
        openingHours: '07:00 - 22:00',
        specialties: ['Buffet', 'Cuisine internationale'],
        menu: [
          {
            id: 1,
            name: 'Plateau buffet',
            description: 'Accès illimité au buffet',
            price: 25,
            category: 'Plats',
            isPopular: true,
            allergens: []
          }
        ],
        promotions: []
      },
      {
        name: 'Café des Arts',
        type: 'Café & Snacks',
        category: 'dessert',
        location: 'Pont 9 - Forward',
        description: 'Café, pâtisseries et snacks légers',
        rating: 4.2,
        priceRange: '€',
        image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800',
        isOpen: true,
        openingHours: '06:00 - 23:00',
        specialties: ['Café', 'Pâtisseries', 'Snacks'],
        menu: [
          {
            id: 1,
            name: 'Cappuccino',
            description: 'Café expresso avec mousse de lait',
            price: 4.5,
            category: 'Boissons',
            isPopular: true,
            allergens: ['Lait']
          },
          {
            id: 2,
            name: 'Croissant',
            description: 'Croissant au beurre',
            price: 2.5,
            category: 'Viennoiseries',
            isPopular: true,
            allergens: ['Gluten', 'Lait', 'Œufs']
          }
        ],
        promotions: []
      }
    ];

    const createdRestaurants = [];
    for (const restaurantData of restaurants) {
      const existing = await Restaurant.findOne({ name: restaurantData.name });
      if (!existing) {
        const restaurant = await Restaurant.create(restaurantData);
        createdRestaurants.push(restaurant);
        console.log(`✅ Restaurant créé: ${restaurant.name}`);
      } else {
        console.log(`ℹ️  Restaurant existe déjà: ${restaurantData.name}`);
        createdRestaurants.push(existing);
      }
    }

    return createdRestaurants;
  } catch (error) {
    console.error('❌ Erreur création restaurants:', error.message);
    throw error;
  }
}

// Fonction pour créer des stations radio
async function createRadioStations() {
  try {
    const stations = [
      {
        name: 'GNV Radio Pop',
        description: 'Les meilleurs hits du moment',
        genre: 'pop',
        streamUrl: 'https://stream.example.com/pop',
        imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800',
        isActive: true,
        isLive: true,
        language: 'fr',
        quality: 'high',
        metadata: {
          currentSong: 'Dernière chanson',
          artist: 'Artiste',
          lastUpdated: new Date()
        }
      },
      {
        name: 'GNV Radio Jazz',
        description: 'Jazz et musique classique',
        genre: 'jazz',
        streamUrl: 'https://stream.example.com/jazz',
        imageUrl: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800',
        isActive: true,
        isLive: true,
        language: 'fr',
        quality: 'high'
      },
      {
        name: 'GNV News',
        description: 'Actualités et informations',
        genre: 'news',
        streamUrl: 'https://stream.example.com/news',
        imageUrl: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800',
        isActive: true,
        isLive: true,
        language: 'fr',
        quality: 'medium'
      }
    ];

    const createdStations = [];
    for (const stationData of stations) {
      const existing = await RadioStation.findOne({ name: stationData.name });
      if (!existing) {
        const station = await RadioStation.create(stationData);
        createdStations.push(station);
        console.log(`✅ Station radio créée: ${station.name}`);
      } else {
        console.log(`ℹ️  Station existe déjà: ${stationData.name}`);
        createdStations.push(existing);
      }
    }

    return createdStations;
  } catch (error) {
    console.error('❌ Erreur création stations radio:', error.message);
    throw error;
  }
}

// Fonction pour créer des films
async function createMovies() {
  try {
    const movies = [
      {
        title: 'Le Voyage Extraordinaire',
        description: 'Une aventure épique à travers les océans',
        genre: ['action', 'drama'],
        year: 2023,
        duration: 120,
        rating: 8.5,
        imdbRating: 8.2,
        posterUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800',
        trailerUrl: 'https://www.youtube.com/watch?v=example',
        streamUrl: 'https://stream.example.com/movie1',
        language: 'fr',
        ageRating: 'PG-13',
        director: 'Jean Dupont',
        cast: [
          { name: 'Acteur 1', character: 'Héros' },
          { name: 'Actrice 1', character: 'Héroïne' }
        ],
        isActive: true,
        isFeatured: true,
        isNewRelease: true,
        categories: ['trending', 'new']
      },
      {
        title: 'Comédie Maritime',
        description: 'Une comédie hilarante sur un navire',
        genre: ['comedy'],
        year: 2022,
        duration: 95,
        rating: 7.8,
        imdbRating: 7.5,
        posterUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800',
        streamUrl: 'https://stream.example.com/movie2',
        language: 'fr',
        ageRating: 'PG',
        director: 'Marie Martin',
        isActive: true,
        isFeatured: false,
        categories: ['popular']
      }
    ];

    const createdMovies = [];
    for (const movieData of movies) {
      const existing = await Movie.findOne({ title: movieData.title });
      if (!existing) {
        const movie = await Movie.create(movieData);
        createdMovies.push(movie);
        console.log(`✅ Film créé: ${movie.title}`);
      } else {
        console.log(`ℹ️  Film existe déjà: ${movieData.title}`);
        createdMovies.push(existing);
      }
    }

    return createdMovies;
  } catch (error) {
    console.error('❌ Erreur création films:', error.message);
    throw error;
  }
}

// Fonction pour créer des feedbacks de test
async function createFeedbacks(users) {
  try {
    if (users.length < 2) {
      console.log('ℹ️  Pas assez d\'utilisateurs pour créer des feedbacks');
      return [];
    }

    const feedbacks = [
      {
        user: users[0]._id,
        type: 'complaint',
        category: 'restaurant',
        title: 'Service lent au restaurant',
        description: 'Le service était très lent lors du dîner hier soir',
        priority: 'medium',
        status: 'open'
      },
      {
        user: users[1]._id,
        type: 'suggestion',
        category: 'service',
        title: 'Suggestion pour améliorer le WiFi',
        description: 'Le WiFi pourrait être amélioré dans certaines zones',
        priority: 'low',
        status: 'open'
      },
      {
        user: users[0]._id,
        type: 'compliment',
        category: 'service',
        title: 'Excellent service',
        description: 'Le personnel était très professionnel et serviable',
        priority: 'low',
        status: 'resolved'
      }
    ];

    const createdFeedbacks = [];
    for (const feedbackData of feedbacks) {
      const feedback = await Feedback.create(feedbackData);
      createdFeedbacks.push(feedback);
      console.log(`✅ Feedback créé: ${feedback.title}`);
    }

    return createdFeedbacks;
  } catch (error) {
    console.error('❌ Erreur création feedbacks:', error.message);
    throw error;
  }
}

// Fonction pour créer des messages de test
async function createMessages(users) {
  try {
    if (users.length < 2) {
      console.log('ℹ️  Pas assez d\'utilisateurs pour créer des messages');
      return [];
    }

    const messages = [
      {
        sender: users[0]._id,
        receiver: users[1]._id,
        content: 'Bonjour ! Comment allez-vous ?',
        type: 'text',
        isRead: false
      },
      {
        sender: users[1]._id,
        receiver: users[0]._id,
        content: 'Très bien merci ! Et vous ?',
        type: 'text',
        isRead: true,
        readAt: new Date()
      },
      {
        sender: users[0]._id,
        receiver: users[1]._id,
        content: 'Parfait ! Avez-vous visité le restaurant ?',
        type: 'text',
        isRead: false
      }
    ];

    const createdMessages = [];
    for (const messageData of messages) {
      const message = await Message.create(messageData);
      createdMessages.push(message);
      console.log(`✅ Message créé`);
    }

    return createdMessages;
  } catch (error) {
    console.error('❌ Erreur création messages:', error.message);
    throw error;
  }
}

// Fonction pour créer des articles
async function createArticles() {
  try {
    const articles = [
      {
        title: 'Découvrez les merveilles de la Méditerranée',
        excerpt: 'Un voyage à travers les plus belles destinations méditerranéennes',
        content: 'La Méditerranée regorge de trésors cachés...',
        category: 'Voyage',
        author: 'Équipe GNV',
        imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200',
        isPublished: true,
        isFeatured: true,
        tags: ['voyage', 'méditerranée', 'découverte']
      },
      {
        title: 'Les spécialités culinaires à bord',
        excerpt: 'Découvrez notre sélection de plats authentiques',
        content: 'Notre chef vous propose une cuisine raffinée...',
        category: 'Gastronomie',
        author: 'Chef Marco',
        imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200',
        isPublished: true,
        isFeatured: false,
        tags: ['cuisine', 'restaurant', 'gastronomie']
      }
    ];

    const createdArticles = [];
    for (const articleData of articles) {
      const existing = await Article.findOne({ title: articleData.title });
      if (!existing) {
        const article = await Article.create(articleData);
        createdArticles.push(article);
        console.log(`✅ Article créé: ${article.title}`);
      } else {
        console.log(`ℹ️  Article existe déjà: ${articleData.title}`);
        createdArticles.push(existing);
      }
    }

    return createdArticles;
  } catch (error) {
    console.error('❌ Erreur création articles:', error.message);
    throw error;
  }
}

// Fonction pour créer des produits
async function createProducts() {
  try {
    const products = [
      {
        name: 'T-shirt GNV',
        description: 'T-shirt officiel GNV en coton bio',
        type: 'Vêtement officiel',
        category: 'fashion',
        price: 29.99,
        originalPrice: 35.99,
        discount: 17,
        stock: 50,
        sku: 'TSH-GNV-001',
        image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800',
        isAvailable: true
      },
      {
        name: 'Casquette GNV',
        description: 'Casquette officielle GNV',
        type: 'Accessoire',
        category: 'accessories',
        price: 19.99,
        stock: 30,
        sku: 'CAP-GNV-001',
        image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800',
        isAvailable: true
      },
      {
        name: 'Mug GNV Excelsior',
        description: 'Mug en céramique avec logo GNV Excelsior',
        type: 'Souvenir officiel',
        category: 'souvenirs',
        price: 12.90,
        originalPrice: 15.90,
        discount: 19,
        stock: 25,
        sku: 'MUG-GNV-001',
        image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcf93a?w=800',
        isAvailable: true
      }
    ];

    const createdProducts = [];
    for (const productData of products) {
      const existing = await Product.findOne({ sku: productData.sku });
      if (!existing) {
        const product = await Product.create(productData);
        createdProducts.push(product);
        console.log(`✅ Produit créé: ${product.name}`);
      } else {
        console.log(`ℹ️  Produit existe déjà: ${productData.name}`);
        createdProducts.push(existing);
      }
    }

    return createdProducts;
  } catch (error) {
    console.error('❌ Erreur création produits:', error.message);
    throw error;
  }
}

// Fonction pour créer des chaînes WebTV
async function createWebTVChannels() {
  try {
    const channels = [
      {
        name: 'GNV News',
        category: 'news',
        description: 'Actualités en direct de la traversée',
        streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        imageUrl: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800',
        isLive: true,
        isActive: true,
        quality: 'HD',
        language: 'fr',
        schedule: [{
          day: 'monday',
          programs: [
            { title: 'Matin Info', startTime: '08:00', endTime: '09:00', description: 'Actualités du matin' },
            { title: 'Midi Actualités', startTime: '12:00', endTime: '13:00', description: 'Actualités de midi' }
          ]
        }]
      },
      {
        name: 'GNV Sports',
        category: 'sports',
        description: 'Retransmissions sportives en direct',
        streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800',
        isLive: true,
        isActive: true,
        quality: 'HD',
        language: 'fr'
      }
    ];

    const createdChannels = [];
    for (const channelData of channels) {
      const existing = await WebTVChannel.findOne({ name: channelData.name });
      if (!existing) {
        const channel = await WebTVChannel.create(channelData);
        createdChannels.push(channel);
        console.log(`✅ Chaîne WebTV créée: ${channel.name}`);
      } else {
        console.log(`ℹ️  Chaîne existe déjà: ${channelData.name}`);
        createdChannels.push(existing);
      }
    }

    return createdChannels;
  } catch (error) {
    console.error('❌ Erreur création chaînes WebTV:', error.message);
    throw error;
  }
}

// Fonction pour créer des activités enfant
async function createEnfantActivities() {
  try {
    const activities = [
      {
        title: 'Atelier Peinture',
        category: 'creatif',
        description: 'Atelier de peinture pour enfants',
        ageRange: {
          min: 4,
          max: 10
        },
        duration: 90,
        location: 'Espace Enfant - Pont 6',
        capacity: 15,
        currentParticipants: 0,
        schedule: {
          day: 'monday',
          startTime: '14:00',
          endTime: '15:30'
        },
        supervisor: {
          name: 'Marie Dupont',
          contact: 'marie.dupont@gnv.com'
        },
        requirements: ['Matériel fourni'],
        materials: ['Pinceaux', 'Peintures', 'Toiles'],
        imageUrl: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800',
        isActive: true
      },
      {
        title: 'Jeux de Société',
        category: 'jeux',
        description: 'Jeux de société pour tous les âges',
        ageRange: {
          min: 6,
          max: 12
        },
        duration: 60,
        location: 'Espace Enfant - Pont 6',
        capacity: 20,
        currentParticipants: 0,
        schedule: {
          day: 'monday',
          startTime: '16:00',
          endTime: '17:00'
        },
        requirements: ['Grande variété de jeux'],
        imageUrl: 'https://images.unsplash.com/photo-1606166188517-11bbd375be0e?w=800',
        isActive: true
      }
    ];

    const createdActivities = [];
    for (const activityData of activities) {
      const existing = await EnfantActivity.findOne({ title: activityData.title });
      if (!existing) {
        const activity = await EnfantActivity.create(activityData);
        createdActivities.push(activity);
        console.log(`✅ Activité enfant créée: ${activity.title}`);
      } else {
        console.log(`ℹ️  Activité existe déjà: ${activityData.title}`);
        createdActivities.push(existing);
      }
    }

    return createdActivities;
  } catch (error) {
    console.error('❌ Erreur création activités enfant:', error.message);
    throw error;
  }
}

// Fonction pour créer des bannières
async function createBanners() {
  try {
    const banners = [
      {
        title: 'Promotion Été 2024',
        description: 'Profitez de nos offres spéciales',
        position: 'home',
        priority: 1,
        imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200',
        linkUrl: '/shop',
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        isActive: true
      },
      {
        title: 'Nouveau Restaurant',
        description: 'Découvrez notre nouveau restaurant',
        position: 'restaurant',
        priority: 2,
        imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200',
        linkUrl: '/restaurants',
        isActive: true
      }
    ];

    const createdBanners = [];
    for (const bannerData of banners) {
      const banner = await Banner.create(bannerData);
      createdBanners.push(banner);
      console.log(`✅ Bannière créée: ${banner.title}`);
    }

    return createdBanners;
  } catch (error) {
    console.error('❌ Erreur création bannières:', error.message);
    throw error;
  }
}

// Fonction pour créer des plans de bateau
async function createShipmaps() {
  try {
    const shipmaps = [
      {
        deckNumber: '7',
        name: 'Pont 7 - Pont supérieur',
        level: 7,
        facilities: [
          {
            type: 'bar',
            name: 'Bar panoramique',
            coordinates: { x: 50, y: 30 },
            description: 'Bar avec vue sur la mer'
          },
          {
            type: 'deck',
            name: 'Terrasse extérieure',
            coordinates: { x: 50, y: 70 },
            description: 'Terrasse pour profiter du soleil'
          }
        ],
        imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200',
        isActive: true
      },
      {
        deckNumber: '6',
        name: 'Pont 6 - Pont principal',
        level: 6,
        facilities: [
          {
            type: 'restaurant',
            name: 'Restaurant Self-Service',
            coordinates: { x: 40, y: 50 },
            description: 'Restaurant buffet'
          },
          {
            type: 'shop',
            name: 'Boutique',
            coordinates: { x: 60, y: 30 },
            description: 'Boutique souvenirs'
          }
        ],
        imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200',
        isActive: true
      }
    ];

    const createdShipmaps = [];
    for (const shipmapData of shipmaps) {
      const existing = await Deck.findOne({ deckNumber: shipmapData.deckNumber });
      if (!existing) {
        const deck = await Deck.create(shipmapData);
        createdShipmaps.push(deck);
        console.log(`✅ Pont créé: ${deck.name}`);
      } else {
        console.log(`ℹ️  Pont existe déjà: ${shipmapData.name}`);
        createdShipmaps.push(existing);
      }
    }

    return createdShipmaps;
  } catch (error) {
    console.error('❌ Erreur création plans de bateau:', error.message);
    throw error;
  }
}

// Fonction principale
async function initDatabase() {
  try {
    console.log('🚀 Initialisation de la base de données...\n');

    // Connexion
    await connectDB();

    // Nettoyer les collections existantes (optionnel - décommentez si nécessaire)
    // console.log('🗑️  Nettoyage des collections...');
    // await User.deleteMany({});
    // await Restaurant.deleteMany({});
    // await Feedback.deleteMany({});
    // await Message.deleteMany({});
    // await Movie.deleteMany({});
    // await RadioStation.deleteMany({});

    // Créer les données
    console.log('\n📝 Création des données...\n');

    const admin = await createAdminUser();
    const users = await createTestUsers();
    const restaurants = await createRestaurants();
    const radioStations = await createRadioStations();
    const movies = await createMovies();
    const feedbacks = await createFeedbacks(users);
    const messages = await createMessages(users);
    const articles = await createArticles();
    const products = await createProducts();
    const webTVChannels = await createWebTVChannels();
    const enfantActivities = await createEnfantActivities();
    const banners = await createBanners();
    const shipmaps = await createShipmaps();

    // Résumé
    console.log('\n✅ Initialisation terminée !\n');
    console.log('📊 Résumé:');
    console.log(`   - ${await User.countDocuments()} utilisateur(s)`);
    console.log(`   - ${await Restaurant.countDocuments()} restaurant(s)`);
    console.log(`   - ${await RadioStation.countDocuments()} station(s) radio`);
    console.log(`   - ${await Movie.countDocuments()} film(s)`);
    console.log(`   - ${await Feedback.countDocuments()} feedback(s)`);
    console.log(`   - ${await Message.countDocuments()} message(s)`);
    console.log(`   - ${await Article.countDocuments()} article(s)`);
    console.log(`   - ${await Product.countDocuments()} produit(s)`);
    console.log(`   - ${await WebTVChannel.countDocuments()} chaîne(s) WebTV`);
    console.log(`   - ${await EnfantActivity.countDocuments()} activité(s) enfant`);
    console.log(`   - ${await Banner.countDocuments()} bannière(s)`);
    console.log(`   - ${await Deck.countDocuments()} pont(s)`);

    console.log('\n✅ Base de données initialisée avec succès!');
    console.log('');
    console.log('🔐 Identifiants:');
    console.log('   - Définissez ADMIN_EMAIL et ADMIN_PASSWORD dans config.env');
    console.log('   - Les utilisateurs de test ont été créés');
    console.log('');
    console.log('📝 Prochaines étapes:');
    console.log('   1. Démarrez le backend: npm run dev');
    console.log('   2. Connectez-vous avec vos identifiants admin');
    console.log('   3. Consultez la documentation: docs/GETTING_STARTED.md');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'initialisation:', error);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };

