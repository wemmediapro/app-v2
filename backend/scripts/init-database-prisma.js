/**
 * Script d'initialisation de la base de données avec Prisma (hors API).
 * Prisma n'est pas utilisé par les routes Express : l'API repose sur Mongoose (MongoDB).
 * Ce script est le seul point d'usage de Prisma dans le projet (seed/init).
 *
 * Usage: node scripts/init-database-prisma.js
 * ou: npm run init-db-prisma
 */

require('dotenv').config({ path: './config.env' });
const bcrypt = require('bcryptjs');

// S'assurer que MONGODB_URI est défini
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://localhost:27017/gnv_onboard';
}

// Initialiser Prisma Client après avoir défini les variables d'environnement
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(undefined);

// Connexion à MongoDB
async function connectDB() {
  try {
    await prisma.$connect();
    console.log('✅ Connecté à MongoDB via Prisma');
  } catch (error) {
    console.error('❌ Erreur de connexion MongoDB:', error.message);
    process.exit(1);
  }
}

// Fonction pour créer l'utilisateur admin
async function createAdminUser() {
  try {
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@gnv.com' }
    });

    if (existingAdmin) {
      console.log('ℹ️  Utilisateur admin existe déjà');
      return existingAdmin;
    }

    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 12);

    const admin = await prisma.user.create({
      data: {
        firstName: 'Admin',
        lastName: 'GNV',
        email: 'admin@gnv.com',
        password: hashedPassword,
        role: 'admin',
        phone: '+33 1 23 45 67 89',
        cabinNumber: 'ADMIN-001',
        preferences: {
          create: {
            language: 'fr',
            notifications: {
              create: {
                email: true,
                push: true,
                sms: false
              }
            }
          }
        },
        isActive: true
      }
    });

    console.log('✅ Utilisateur admin créé (email / mot de passe : config.env — ne pas logger).');
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
        password: await bcrypt.hash('user123', 12),
        role: 'passenger',
        phone: '+33 6 12 34 56 78',
        cabinNumber: 'A-101',
        preferences: {
          create: {
            language: 'fr',
            notifications: {
              create: {
                email: true,
                push: true,
                sms: false
              }
            }
          }
        }
      },
      {
        firstName: 'Maria',
        lastName: 'Rossi',
        email: 'maria.rossi@example.com',
        password: await bcrypt.hash('user123', 12),
        role: 'passenger',
        phone: '+39 3 45 67 89 01',
        cabinNumber: 'B-205',
        preferences: {
          create: {
            language: 'it',
            notifications: {
              create: {
                email: true,
                push: true,
                sms: false
              }
            }
          }
        }
      },
      {
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@example.com',
        password: await bcrypt.hash('user123', 12),
        role: 'passenger',
        phone: '+44 7 89 01 23 45',
        cabinNumber: 'C-310',
        preferences: {
          create: {
            language: 'en',
            notifications: {
              create: {
                email: true,
                push: true,
                sms: false
              }
            }
          }
        }
      },
      {
        firstName: 'Sophie',
        lastName: 'Martin',
        email: 'sophie.martin@example.com',
        password: await bcrypt.hash('user123', 12),
        role: 'crew',
        phone: '+33 6 98 76 54 32',
        cabinNumber: 'CREW-001',
        preferences: {
          create: {
            language: 'fr',
            notifications: {
              create: {
                email: true,
                push: true,
                sms: false
              }
            }
          }
        }
      }
    ];

    const createdUsers = [];
    for (const userData of users) {
      const existing = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (!existing) {
        const user = await prisma.user.create({
          data: userData
        });
        createdUsers.push(user);
        console.log(`✅ Utilisateur créé: ${user.email}`);
      } else {
        console.log(`ℹ️  Utilisateur existe déjà: ${userData.email}`);
        createdUsers.push(existing);
      }
    }

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
        menu: {
          create: [
            {
              menuId: 1,
              name: 'Saumon fumé',
              description: 'Saumon fumé maison, blinis et crème fraîche',
              price: 18,
              category: 'Entrées',
              isPopular: true,
              allergens: ['Poisson']
            },
            {
              menuId: 2,
              name: 'Entrecôte grillée',
              description: 'Entrecôte de bœuf, frites maison, sauce au poivre',
              price: 32,
              category: 'Plats',
              isPopular: true,
              allergens: []
            }
          ]
        },
        promotions: {
          create: [
            {
              promoId: 1,
              title: 'Menu du soir',
              description: 'Entrée + Plat + Dessert',
              price: 45,
              originalPrice: 62,
              discount: 27,
              validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
          ]
        }
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
        menu: {
          create: [
            {
              menuId: 1,
              name: 'Plateau buffet',
              description: 'Accès illimité au buffet',
              price: 25,
              category: 'Plats',
              isPopular: true,
              allergens: []
            }
          ]
        }
      }
    ];

    const createdRestaurants = [];
    for (const restaurantData of restaurants) {
      const existing = await prisma.restaurant.findFirst({
        where: { name: restaurantData.name }
      });

      if (!existing) {
        const restaurant = await prisma.restaurant.create({
          data: restaurantData
        });
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

// Fonction principale
async function initDatabase() {
  try {
    console.log('🚀 Initialisation de la base de données avec Prisma...\n');

    await connectDB();

    console.log('\n📝 Création des données...\n');

    const admin = await createAdminUser();
    const users = await createTestUsers();
    const restaurants = await createRestaurants();

    // Résumé
    console.log('\n✅ Initialisation terminée !\n');
    console.log('📊 Résumé:');
    console.log(`   - ${await prisma.user.count()} utilisateur(s)`);
    console.log(`   - ${await prisma.restaurant.count()} restaurant(s)`);

    console.log('\n🔑 Connexion : définissez ADMIN_EMAIL / ADMIN_PASSWORD dans config.env (aucun secret affiché ici).');
    console.log('   Compte admin seed : email fixe en base selon le script — changez le mot de passe après premier login.');

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'initialisation:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };

