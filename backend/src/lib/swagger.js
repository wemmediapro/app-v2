const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const routesGlob = path.join(__dirname, '../routes/*.js');
const serverEntry = path.join(__dirname, '../../server.js');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GNV OnBoard API',
      version: '1.0.0',
      description:
        'API REST versionnée : préfixe canonique `/api/v1`. Les mêmes routes sont montées aussi sous `/api/*` (alias rétrocompatibilité) — dans OpenAPI, seul le préfixe `/api/v1` est documenté.\n\n' +
        '**Swagger UI** : `GET /api-docs` (dev par défaut ; prod si `SWAGGER_ENABLED=true`). **Spec JSON** : `GET /api-docs.json`.',
      contact: {
        name: 'GNV Team',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:3000',
        description: 'Serveur de développement',
      },
      {
        url: 'https://api.gnv-onboard.com',
        description: 'Serveur de production',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'authToken',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Erreur de validation',
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
              },
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string', enum: ['passenger', 'crew', 'admin'] },
            cabinNumber: { type: 'string' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Health: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'OK' },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number' },
            mongodb: { type: 'string', example: 'connected' },
            connections: { type: 'number' },
            memoryMB: { type: 'number' },
          },
        },
        Restaurant: {
          type: 'object',
          description: 'Restaurant (champs localisés si `lang` est fourni)',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            isActive: { type: 'boolean' },
            menu: { type: 'array', items: { type: 'object' } },
            promotions: { type: 'array', items: { type: 'object' } },
          },
        },
        Movie: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            type: { type: 'string', example: 'movie' },
            poster: { type: 'string' },
            isActive: { type: 'boolean' },
            episodes: { type: 'array', items: { type: 'object' } },
          },
        },
        PaginatedMovies: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: '#/components/schemas/Movie' } },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
          },
        },
        RadioStation: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            streamUrl: { type: 'string' },
            isActive: { type: 'boolean' },
            listeners: { type: 'integer' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentification et gestion des sessions' },
      { name: 'Users', description: 'Gestion des utilisateurs' },
      { name: 'Restaurants', description: 'Restaurants et menus' },
      { name: 'Movies', description: 'Films et séries' },
      { name: 'Radio', description: 'Stations radio' },
      { name: 'Magazine', description: 'Articles et actualités' },
      { name: 'Messages', description: 'Chat entre passagers' },
      { name: 'Shop', description: 'Boutique en ligne' },
      { name: 'Feedback', description: 'Réclamations et feedback' },
      { name: 'Admin', description: 'Administration (admin uniquement)' },
      { name: 'Analytics', description: 'Statistiques et analytics' },
      { name: 'Health', description: 'Santé du serveur et temps' },
    ],
  },
  apis: [routesGlob, serverEntry],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
