# Architecture de l'Application GNV OnBoard

## Vue d'ensemble

L'application GNV OnBoard est une application web complète pour les passagers de ferry, composée de trois applications principales :

1. **Frontend Principal** (Port 5173) - Application pour les passagers
2. **Backend API** (Port 3000) - API REST avec WebSocket
3. **Dashboard Admin** (Port 5174) - Interface d'administration

---

## Architecture Générale

```mermaid
graph TB
    subgraph "Clients"
        A[Frontend Principal<br/>React + Vite<br/>Port 5173]
        B[Dashboard Admin<br/>React + Vite<br/>Port 5174]
        C[Mobile/Web Browsers]
    end
    
    subgraph "Backend API"
        D[Express Server<br/>Port 3000]
        E[Socket.io<br/>WebSocket]
        F[Middleware Layer]
        G[Routes Layer]
        H[Services Layer]
    end
    
    subgraph "Base de Données"
        I[(MongoDB<br/>Mongoose)]
        J[(SQLite<br/>Optionnel)]
    end
    
    subgraph "Services Externes"
        K[Redis<br/>Cache & Socket.IO]
        L[GNV Scraper<br/>Données Ferry]
    end
    
    A -->|HTTP/REST| D
    B -->|HTTP/REST| D
    C -->|HTTP/REST| D
    A -->|WebSocket| E
    B -->|WebSocket| E
    C -->|WebSocket| E
    
    D --> F
    F --> G
    G --> H
    H --> I
    H --> J
    H --> K
    H --> L
    
    style A fill:#4CAF50
    style B fill:#2196F3
    style D fill:#FF9800
    style I fill:#9C27B0
```

---

## Structure des Dossiers

```
appli-final-copie/
│
├── 📁 backend/                    # API Backend Node.js/Express
│   ├── 📁 src/
│   │   ├── 📁 lib/                # Bibliothèques utilitaires
│   │   │   ├── database.js        # Connexion MongoDB (Mongoose)
│   │   │   ├── database-optimized.js
│   │   │   ├── cache-manager.js   # Gestion du cache
│   │   │   ├── connection-manager.js
│   │   │   └── prisma.js          # Client Prisma (scripts uniquement, non utilisé par les routes)
│   │   │
│   │   ├── 📁 middleware/         # Middlewares Express
│   │   │   ├── auth.js            # Authentification JWT
│   │   │   ├── validation.js      # Validation des données
│   │   │   ├── language.js        # Gestion multilingue
│   │   │   └── demo.js            # Mode démo
│   │   │
│   │   ├── 📁 models/              # Modèles de données
│   │   │   ├── User.js
│   │   │   ├── Restaurant.js
│   │   │   ├── Product.js
│   │   │   ├── Article.js
│   │   │   ├── Banner.js
│   │   │   ├── Ship.js
│   │   │   ├── Shipmap.js
│   │   │   ├── WebTVChannel.js
│   │   │   ├── EnfantActivity.js
│   │   │   ├── Destination.js
│   │   │   ├── Message.js
│   │   │   └── Feedback.js
│   │   │
│   │   ├── 📁 routes/              # Routes API
│   │   │   ├── auth.js            # /api/auth
│   │   │   ├── users.js           # /api/users
│   │   │   ├── restaurants.js    # /api/restaurants
│   │   │   ├── movies.js          # /api/movies
│   │   │   ├── radio.js           # /api/radio
│   │   │   ├── magazine.js        # /api/magazine
│   │   │   ├── shop.js            # /api/shop
│   │   │   ├── messages.js        # /api/messages
│   │   │   ├── feedback.js        # /api/feedback
│   │   │   ├── admin.js           # /api/admin
│   │   │   ├── analytics.js       # /api/analytics
│   │   │   ├── gnv.js             # /api/gnv
│   │   │   └── demo.js            # /api/demo
│   │   │
│   │   ├── 📁 services/            # Services métier
│   │   │   └── gnvScraper.js      # Scraping données GNV
│   │   │
│   │   └── 📁 modules/             # Modules modulaires
│   │       ├── auth/
│   │       ├── users/
│   │       └── restaurants/
│   │
│   ├── 📁 prisma/                 # Schémas Prisma
│   │   ├── schema.prisma          # Schéma MongoDB
│   │   └── schema-sqlite.prisma   # Schéma SQLite (optionnel)
│   │
│   ├── 📁 scripts/                # Scripts utilitaires
│   │   ├── init-database.js
│   │   └── init-database-prisma.js
│   │
│   ├── server.js                  # Point d'entrée principal
│   ├── server.optimized.js        # Version optimisée
│   └── server.production.js       # Version production
│
├── 📁 src/                        # Frontend Principal (Passagers)
│   ├── 📁 components/             # Composants React
│   │   └── LanguageSelector.jsx
│   │
│   ├── 📁 contexts/               # Contextes React
│   │   └── LanguageContext.jsx    # Gestion multilingue
│   │
│   ├── 📁 services/               # Services API
│   │   └── apiService.js          # Client API
│   │
│   ├── 📁 locales/                # Fichiers de traduction
│   │   ├── fr.json
│   │   ├── en.json
│   │   ├── es.json
│   │   ├── it.json
│   │   ├── ar.json
│   │   └── de.json
│   │
│   ├── 📁 data/                   # Données statiques
│   │   └── ships.js
│   │
│   ├── App.jsx                    # Composant principal
│   ├── main.jsx                   # Point d'entrée
│   └── index.css                  # Styles globaux
│
├── 📁 dashboard/                  # Dashboard Admin
│   └── 📁 src/
│       ├── 📁 components/         # Composants réutilisables
│       │   ├── Sidebar.jsx
│       │   ├── Header.jsx
│       │   ├── FilterBar.jsx
│       │   └── LanguageSelector.jsx
│       │
│       ├── 📁 pages/              # Pages du dashboard
│       │   ├── Dashboard.jsx     # Vue d'ensemble
│       │   ├── Login.jsx         # Authentification
│       │   ├── Analytics.jsx     # Statistiques
│       │   ├── Users.jsx         # Gestion utilisateurs
│       │   ├── Restaurants.jsx   # Gestion restaurants
│       │   ├── Movies.jsx        # Gestion films
│       │   ├── Radio.jsx         # Gestion radio
│       │   ├── Magazine.jsx      # Gestion magazine
│       │   ├── Shop.jsx          # Gestion boutique
│       │   ├── Messages.jsx      # Gestion messages
│       │   ├── Feedback.jsx      # Gestion feedback
│       │   ├── Banners.jsx       # Gestion bannières
│       │   ├── Bateaux.jsx       # Gestion bateaux
│       │   ├── Destinations.jsx  # Gestion destinations
│       │   ├── Shipmap.jsx       # Carte du navire
│       │   ├── Enfant.jsx        # Activités enfants
│       │   ├── WebTV.jsx         # WebTV
│       │   └── Library.jsx       # Bibliothèque
│       │
│       ├── 📁 services/           # Services API
│       │   ├── apiService.js
│       │   ├── authService.js
│       │   └── mockData.js
│       │
│       ├── 📁 contexts/           # Contextes React
│       │   └── LanguageContext.jsx
│       │
│       ├── 📁 locales/            # Traductions
│       │   ├── fr.json
│       │   ├── en.json
│       │   ├── es.json
│       │   ├── it.json
│       │   └── ar.json
│       │
│       ├── App.jsx                # Composant principal
│       └── main.jsx               # Point d'entrée
│
├── package.json                   # Dépendances frontend
├── vite.config.js                # Configuration Vite
├── tailwind.config.js            # Configuration Tailwind
└── start-all.sh                  # Script de démarrage
```

---

## Architecture Backend

### Flux de Requête API

```mermaid
sequenceDiagram
    participant Client
    participant Middleware
    participant Route
    participant Service
    participant Database
    
    Client->>Middleware: Requête HTTP
    Middleware->>Middleware: Auth Check
    Middleware->>Middleware: Validation
    Middleware->>Middleware: Language Detection
    Middleware->>Route: Requête validée
    Route->>Service: Appel service métier
    Service->>Database: Query Mongoose
    Database-->>Service: Résultats
    Service-->>Route: Données traitées
    Route-->>Client: Réponse JSON
```

### Structure des Routes API

```mermaid
graph LR
    A[Express App] --> B[/api/auth]
    A --> C[/api/users]
    A --> D[/api/restaurants]
    A --> E[/api/movies]
    A --> F[/api/radio]
    A --> G[/api/magazine]
    A --> H[/api/shop]
    A --> I[/api/messages]
    A --> J[/api/feedback]
    A --> K[/api/admin]
    A --> L[/api/analytics]
    A --> M[/api/gnv]
    A --> N[/api/demo]
    A --> O[/api/health]
    
    style A fill:#FF9800
    style B fill:#4CAF50
    style K fill:#F44336
```

### Modèles de Données (Mongoose — API ; schéma Prisma pour scripts)

```mermaid
erDiagram
    User ||--o{ Feedback : "a"
    User ||--o{ Message : "envoie"
    User ||--o{ Message : "reçoit"
    User ||--|| UserPreferences : "a"
    UserPreferences ||--|| NotificationPreferences : "a"
    
    Restaurant ||--o{ MenuItem : "contient"
    Restaurant ||--o{ Promotion : "a"
    
    Product ||--o{ Order : "dans"
    Order ||--|| User : "appartient"
    
    Article ||--o{ Magazine : "dans"
    
    Ship ||--o{ Shipmap : "a"
    Ship ||--o{ Destination : "dessert"
    
    WebTVChannel ||--o{ Program : "diffuse"
    
    EnfantActivity ||--|| Ship : "sur"
    
    Banner ||--|| Ship : "sur"
    
    User {
        string id
        string firstName
        string lastName
        string email
        string password
        string role
        boolean isActive
    }
    
    Restaurant {
        string id
        string name
        string type
        string category
        string location
        float rating
        boolean isOpen
    }
    
    Product {
        string id
        string name
        float price
        string category
        int stock
    }
    
    Article {
        string id
        string title
        string content
        string category
        string image
    }
```

---

## Architecture Frontend

### Frontend Principal (Passagers)

```mermaid
graph TB
    A[main.jsx] --> B[App.jsx]
    B --> C[LanguageProvider]
    C --> D[Routes]
    D --> E[Pages/Components]
    E --> F[apiService]
    F --> G[Backend API]
    
    E --> H[LanguageContext]
    H --> I[locales/*.json]
    
    style A fill:#61DAFB
    style B fill:#61DAFB
    style G fill:#FF9800
```

### Dashboard Admin

```mermaid
graph TB
    A[main.jsx] --> B[App.jsx]
    B --> C[Router]
    C --> D[LanguageProvider]
    D --> E[Sidebar + Header]
    E --> F[Pages]
    F --> G[apiService]
    G --> H[Backend API]
    
    F --> I[Components]
    I --> J[FilterBar]
    I --> K[LanguageSelector]
    
    style A fill:#61DAFB
    style B fill:#61DAFB
    style H fill:#FF9800
```

### Flux de Données Frontend

```mermaid
sequenceDiagram
    participant Component
    participant Context
    participant Service
    participant API
    
    Component->>Context: useLanguage()
    Context-->>Component: Traductions
    
    Component->>Service: apiService.get()
    Service->>API: HTTP Request
    API-->>Service: JSON Response
    Service-->>Component: Données formatées
    Component->>Component: Render UI
```

---

## Technologies Utilisées

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **ORM**: Mongoose (API) ; Prisma présent pour schéma et scripts (init-database-prisma), non utilisé par les routes
- **Base de données**: MongoDB (principal), SQLite (optionnel)
- **WebSocket**: Socket.io
- **Cache**: Redis (optionnel)
- **Authentification**: JWT (jsonwebtoken)
- **Validation**: express-validator
- **Sécurité**: Helmet, CORS, Rate Limiting
- **Logging**: Morgan

### Frontend Principal
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **HTTP Client**: Axios
- **WebSocket**: Socket.io-client
- **Routing**: React Router (si nécessaire)

### Dashboard Admin
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Notifications**: React Hot Toast
- **Routing**: React Router DOM
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **Date**: date-fns

---

## Communication Inter-Services

### REST API Endpoints

| Endpoint | Méthode | Description | Auth |
|----------|---------|-------------|------|
| `/api/health` | GET | Health check | ❌ |
| `/api/auth/login` | POST | Connexion | ❌ |
| `/api/auth/register` | POST | Inscription | ❌ |
| `/api/users` | GET | Liste utilisateurs | ✅ |
| `/api/users/:id` | GET | Détails utilisateur | ✅ |
| `/api/restaurants` | GET | Liste restaurants | ❌ |
| `/api/restaurants/:id` | GET | Détails restaurant | ❌ |
| `/api/movies` | GET | Liste films | ❌ |
| `/api/radio` | GET | Stations radio | ❌ |
| `/api/magazine` | GET | Articles magazine | ❌ |
| `/api/shop/products` | GET | Produits boutique | ❌ |
| `/api/messages` | GET/POST | Messages | ✅ |
| `/api/feedback` | GET/POST | Feedback | ✅ |
| `/api/admin/*` | * | Routes admin | ✅ Admin |
| `/api/analytics` | GET | Statistiques | ✅ Admin |
| `/api/demo/*` | * | Données démo | ❌ |

### WebSocket Events

```mermaid
graph LR
    A[Client] -->|connect| B[Server]
    A -->|join-room| B
    A -->|send-message| B
    A -->|typing| B
    B -->|message| A
    B -->|notification| A
    B -->|update| A
    
    style A fill:#4CAF50
    style B fill:#FF9800
```

**Événements Socket.io**:
- `connection` - Connexion client
- `join-room` - Rejoindre une salle (ferry, restaurant, etc.)
- `send-message` - Envoyer un message
- `typing` - Indicateur de frappe
- `message` - Nouveau message reçu
- `notification` - Notification push
- `update` - Mise à jour en temps réel

---

## Sécurité

### Middleware de Sécurité

```mermaid
graph TB
    A[Requête HTTP] --> B[Helmet]
    B --> C[CORS]
    C --> D[Rate Limiting]
    D --> E[Auth Middleware]
    E --> F[Validation]
    F --> G[Route Handler]
    
    style B fill:#F44336
    style C fill:#F44336
    style D fill:#F44336
    style E fill:#FF9800
```

**Mesures de sécurité**:
- ✅ Helmet.js - Headers de sécurité HTTP
- ✅ CORS - Contrôle d'accès cross-origin
- ✅ Rate Limiting - Limitation du taux de requêtes
- ✅ JWT Authentication - Authentification par token
- ✅ Input Validation - Validation des données d'entrée
- ✅ Password Hashing - Hashage bcrypt
- ✅ SQL Injection Protection - Mongoose ORM

---

## Gestion Multilingue

### Architecture i18n

```mermaid
graph TB
    A[LanguageContext] --> B[Detect Language]
    B --> C{Language}
    C -->|fr| D[fr.json]
    C -->|en| E[en.json]
    C -->|es| F[es.json]
    C -->|it| G[it.json]
    C -->|ar| H[ar.json]
    C -->|de| I[de.json]
    
    D --> J[Component]
    E --> J
    F --> J
    G --> J
    H --> J
    I --> J
    
    style A fill:#9C27B0
    style J fill:#4CAF50
```

**Langues supportées**:
- 🇫🇷 Français (fr) - Par défaut
- 🇬🇧 Anglais (en)
- 🇪🇸 Espagnol (es)
- 🇮🇹 Italien (it)
- 🇸🇦 Arabe (ar)
- 🇩🇪 Allemand (de)

---

## Modes de Fonctionnement

### Mode Démo

L'application peut fonctionner en mode démo sans base de données :

```mermaid
graph LR
    A[DEMO_MODE=true] --> B[Backend]
    B --> C[Mock Data]
    C --> D[API Responses]
    
    style A fill:#FFC107
    style C fill:#FFC107
```

**Caractéristiques**:
- ✅ Fonctionne sans MongoDB
- ✅ Utilise des données de démonstration
- ✅ Parfait pour le développement et les démos
- ✅ Toutes les fonctionnalités disponibles

### Mode Production

```mermaid
graph LR
    A[Production] --> B[MongoDB]
    A --> C[Redis Cache]
    A --> D[PM2 Cluster]
    D --> E[Load Balancing]
    
    style A fill:#4CAF50
    style B fill:#9C27B0
    style C fill:#F44336
```

**Optimisations**:
- ✅ PM2 pour la gestion des processus
- ✅ Redis pour le cache et les sessions
- ✅ Clustering Socket.io avec Redis Adapter
- ✅ Rate limiting avancé
- ✅ Logging structuré
- ✅ Monitoring et health checks

---

## Déploiement

### Architecture de Déploiement

```mermaid
graph TB
    A[Git Repository] --> B[CI/CD]
    B --> C{Environment}
    C -->|Development| D[Local Dev]
    C -->|Staging| E[Staging Server]
    C -->|Production| F[Production Server]
    
    D --> G[MongoDB Local]
    E --> H[MongoDB Atlas]
    F --> H
    
    F --> I[CDN]
    F --> J[Load Balancer]
    
    style A fill:#2196F3
    style F fill:#4CAF50
    style H fill:#9C27B0
```

### Plateformes Supportées

- ✅ **Local Development** - npm scripts
- ✅ **Railway** - railway.json
- ✅ **Render** - render.yaml
- ✅ **Fly.io** - fly.toml
- ✅ **Koyeb** - koyeb.yaml
- ✅ **Cyclic** - cyclic.json
- ✅ **Vercel** - vercel.json
- ✅ **Docker** - Docker Compose pour MongoDB et Redis uniquement (pas de conteneur app) ; déploiement app = PM2 sur l’OS
- ✅ **PM2** - ecosystem.production.cjs

---

## Scripts de Démarrage

### Scripts Disponibles

| Script | Description |
|--------|-------------|
| `start-all.sh` | Lance tous les services (backend, frontend, dashboard) |
| `start-optimized.sh` | Démarrage optimisé avec PM2 |
| `npm run dev` | Démarrage frontend en mode dev |
| `npm run dev` (backend) | Démarrage backend avec nodemon |
| `npm run build` | Build production frontend |
| `npm run preview` | Preview build production |

---

## Ports et URLs

| Service | Port | URL |
|---------|------|-----|
| Backend API | 3000 | http://localhost:3000 |
| Frontend Principal | 5173 | http://localhost:5173 |
| Dashboard Admin | 5174 | http://localhost:5174 |
| MongoDB | 27017 | mongodb://localhost:27017 |
| Redis | 6379 | redis://localhost:6379 |

---

## Flux de Données Complet

```mermaid
graph TB
    subgraph "Client Layer"
        A[Browser]
        B[Mobile App]
    end
    
    subgraph "Frontend Layer"
        C[React Frontend]
        D[React Dashboard]
    end
    
    subgraph "API Layer"
        E[Express Server]
        F[Socket.io]
    end
    
    subgraph "Business Layer"
        G[Routes]
        H[Services]
        I[Middleware]
    end
    
    subgraph "Data Layer"
        J[(MongoDB)]
        K[(Redis Cache)]
    end
    
    A --> C
    B --> C
    C --> E
    C --> F
    D --> E
    D --> F
    E --> I
    I --> G
    G --> H
    H --> J
    H --> K
    
    style A fill:#4CAF50
    style C fill:#61DAFB
    style E fill:#FF9800
    style J fill:#9C27B0
```

---

## Performance et Optimisations

### Optimisations Implémentées

1. **Caching**
   - Redis pour le cache des requêtes fréquentes
   - Cache-manager pour la gestion du cache

2. **Database**
   - Index MongoDB optimisés
   - Connection pooling
   - Requêtes optimisées avec Mongoose

3. **Frontend**
   - Code splitting avec Vite
   - Lazy loading des composants
   - Optimisation des images

4. **Backend**
   - Rate limiting
   - Compression des réponses
   - Pagination des résultats

---

## Monitoring et Logging

### Health Checks

- `/api/health` - Statut de l'API
- Monitoring PM2 (si utilisé)
- Logs structurés avec Morgan

### Métriques

- Uptime
- Nombre de connexions
- Taux de requêtes
- Erreurs et exceptions

---

## Conclusion

Cette architecture modulaire et scalable permet :

✅ **Séparation des responsabilités** - Frontend, Backend, Dashboard séparés  
✅ **Scalabilité** - Support de 2000+ connexions simultanées  
✅ **Maintenabilité** - Code organisé et documenté  
✅ **Flexibilité** - Mode démo et production  
✅ **Sécurité** - Multiples couches de sécurité  
✅ **Internationalisation** - Support multilingue  
✅ **Temps réel** - WebSocket pour les mises à jour instantanées  

---

*Document généré le 6 février 2026*
