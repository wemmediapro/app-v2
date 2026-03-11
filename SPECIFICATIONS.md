# 📋 Spécifications Serveur - GNV OnBoard App
## 2000 Connexions Simultanées - Architecture Serveur Unique

---

## 🖥️ HARDWARE

### Configuration Minimale

| Composant | Spécification |
|-----------|---------------|
| **CPU** | 12-16 cœurs (3.0+ GHz) |
| **RAM** | 32-48 GB DDR4 |
| **Disque** | 1 TB SSD (NVMe recommandé) |
| **Réseau** | 1 Gbps |
| **Connexions TCP** | 10,000+ simultanées |

### Répartition Mémoire (Minimale)

- **MongoDB**: 16 GB (cache)
- **Redis**: 8 GB (mémoire)
- **Node.js/PM2**: 8 GB (clustering)
- **Système OS**: 4-8 GB
- **Buffer**: 4 GB

### Configuration Optimale

| Composant | Spécification |
|-----------|---------------|
| **CPU** | 16-24 cœurs (3.5+ GHz) AMD EPYC/Intel Xeon |
| **RAM** | 64-96 GB DDR4/DDR5 ECC |
| **Disque** | 2 TB NVMe SSD (RAID 1) |
| **Réseau** | 10 Gbps |

### Répartition Mémoire (Optimale)

- **MongoDB**: 32 GB (cache)
- **Redis**: 16 GB (mémoire)
- **Node.js/PM2**: 16 GB (clustering)
- **Système OS**: 8 GB
- **Buffer**: 8 GB

---

## 💻 SOFTWARE

### Système d'Exploitation

| Composant | Version |
|-----------|---------|
| **OS** | Ubuntu Server 24.04 LTS (recommandé) |
| **Kernel** | Linux 5.15+ ou 6.2+ |
| **Architecture** | x86_64 (64-bit) |

### Stack Logicielle

| Logiciel | Version Minimale | Version Recommandée |
|----------|------------------|---------------------|
| **Node.js** | 18.x | 20.x LTS |
| **npm** | 9.x | 10.x+ |
| **PM2** | 5.0 | 5.3+ |
| **MongoDB** | 6.0 | 8.0+ |
| **Redis** | 6.0 | 7.2+ |
| **Nginx** | 1.20 | 1.24+ |

### Dépendances Principales

**Backend:**
- express ^4.18.2
- socket.io ^4.7.4
- @socket.io/redis-adapter ^8.2.1
- mongoose ^8.0.3
- redis ^4.6.12
- jsonwebtoken ^9.0.2
- bcryptjs ^2.4.3

**Frontend:**
- react ^18.2.0
- vite ^5.0.0
- socket.io-client ^4.7.4
- framer-motion ^10.x

---

## 🔧 CONFIGURATION

### MongoDB

| Paramètre | Valeur |
|-----------|--------|
| **Port** | 27017 |
| **Cache Size** | 16 GB (min) / 32 GB (opt) |
| **Max Connections** | 2000 |
| **Bind IP** | 127.0.0.1 |

### Redis

| Paramètre | Valeur |
|-----------|--------|
| **Port** | 6379 |
| **Max Memory** | 8 GB (min) / 16 GB (opt) |
| **Memory Policy** | allkeys-lru |
| **Max Clients** | 10,000 |
| **Bind IP** | 127.0.0.1 |

### Node.js / PM2

| Paramètre | Valeur |
|-----------|--------|
| **Port Backend** | 3000 |
| **Port Frontend** | 5173 |
| **Instances** | max (tous les cœurs) |
| **Mode** | cluster |
| **Max Memory/Instance** | 1 GB |

### Nginx

| Paramètre | Valeur |
|-----------|--------|
| **Worker Processes** | auto |
| **Worker Connections** | 4096 |
| **Client Max Body** | 50 MB |
| **Gzip** | Activé |

---

## 🔒 SÉCURITÉ

### Ports

| Port | Service | Accès |
|------|---------|-------|
| **22** | SSH | Restreint |
| **80** | HTTP | Public |
| **443** | HTTPS | Public |
| **27017** | MongoDB | Localhost |
| **6379** | Redis | Localhost |
| **3000** | Backend | Localhost |
| **5173** | Frontend | Localhost |

### SSL/TLS
- **Type**: Let's Encrypt
- **Outil**: Certbot
- **Renouvellement**: Automatique (90 jours)

---

## 📊 PERFORMANCES

### Capacités

| Type | Capacité Minimale | Capacité Optimale |
|------|-------------------|-------------------|
| **Socket.io** | 2000 connexions | 5000+ connexions |
| **HTTP API** | 10,000 req/s | 20,000+ req/s |
| **MongoDB** | 2000 connexions | 2000 connexions |
| **Redis** | 10,000 clients | 10,000 clients |

### Latence

| Opération | Cible | Maximum |
|-----------|-------|---------|
| **API REST** | < 100ms | < 500ms |
| **Socket.io** | < 50ms | < 200ms |
| **MongoDB** | < 50ms | < 200ms |
| **Redis** | < 5ms | < 20ms |

### Disponibilité
- **Uptime**: 99.9%
- **Backup**: Quotidien

---

## 📝 NOTES

- **Architecture**: Serveur unique (Backend + MongoDB + Redis + Frontend + Nginx)
- **Redis**: Obligatoire lorsque le backend tourne en mode cluster PM2 (Socket.IO) ; sans Redis, les WebSockets ne sont pas synchronisés entre instances.
- **Scalabilité**: Pour dépasser 2000 connexions, améliorer hardware ou architecture distribuée
- **Backups**: Configurer backups automatiques quotidiens
- **Monitoring**: Surveiller CPU, RAM, disque et réseau

---

**Version**: 1.0  
**Date**: 2024
