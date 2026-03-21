# Tunnels (exposition publique du frontend/backend)

Scripts pour exposer l’app en local vers une URL publique (tests mobiles, démo, webhooks).

| Script                       | Commande npm                | Description                                                          |
| ---------------------------- | --------------------------- | -------------------------------------------------------------------- |
| `start-tunnel.js`            | `npm run tunnel`            | **ngrok** – tunnel avec auth optionnelle (NGROK_AUTH_TOKEN)          |
| `start-tunnel-secure.js`     | `npm run tunnel:secure`     | ngrok avec options de sécurité                                       |
| `start-tunnel-lt.js`         | `npm run tunnel:lt`         | **Localtunnel** – tunnel sans compte, sous-domaine possible          |
| `start-tunnel-lt-capture.js` | `npm run tunnel:lt-capture` | Localtunnel avec capture                                             |
| `start-tunnel-cf.js`         | `npm run tunnel:cf`         | **Cloudflare Quick Tunnel** (cloudflared) – URL \*.trycloudflare.com |

**Prérequis**

- ngrok : compte sur ngrok.com + `NGROK_AUTH_TOKEN`
- cloudflared : `brew install cloudflared` (macOS)
- localtunnel : `npx localtunnel --port 5173` (aucune install globale)

**Nettoyage** : supprimer les scripts non utilisés (ex. si vous n’utilisez que ngrok ou que Cloudflare).
