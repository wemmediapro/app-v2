/**
 * k6 — charge type « 1500 connexions » GNV OnBoard
 *
 * Profils :
 *   - défaut : 0→1500 VUs en 2 min, palier 5 min, descente 1 min (~8 min)
 *   - CI     : LOAD_PROFILE=ci (ou GITHUB_ACTIONS) → 100 VUs, durées courtes
 *
 * Variables d’environnement :
 *   API_URL       Backend (défaut http://localhost:3000)
 *   GNV_JWT       JWT valide — active Socket.io (k6/ws + protocole Engine.IO / Socket.io v4)
 *   GNV_USER_ID   ObjectId du user (cohérent avec le JWT) — room notifications:<id>
 *
 * Prérequis 1500 WebSockets depuis une IP :
 *   MAX_CONNECTIONS_PER_IP élevé côté backend ; RATE_LIMIT_LOAD_TEST=1 en non-prod pour l’API.
 *
 * k6 : https://k6.io/docs/get-started/installation/
 *
 * Exemple :
 *   k6 run tests/load/gnv-1500-connections.js
 *   LOAD_PROFILE=ci k6 run tests/load/gnv-1500-connections.js
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const wsConnectFailures = new Counter('gnv_ws_connect_failures');
const wsMessageOk = new Counter('gnv_ws_messages_ok');

const API_URL = (__ENV.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const WS_ORIGIN = API_URL;
const WS_URL = API_URL.replace(/^http/, 'ws') + '/socket.io/?EIO=4&transport=websocket';

const JWT = __ENV.GNV_JWT || '';
const USER_ID = __ENV.GNV_USER_ID || '';

const IS_CI =
  __ENV.LOAD_PROFILE === 'ci' ||
  __ENV.CI === 'true' ||
  __ENV.GITHUB_ACTIONS === 'true';

const TARGET_VUS = IS_CI ? 100 : 1500;
const STAGES = IS_CI
  ? [
      { duration: '30s', target: TARGET_VUS },
      { duration: '1m', target: TARGET_VUS },
      { duration: '15s', target: 0 },
    ]
  : [
      { duration: '2m', target: TARGET_VUS },
      { duration: '5m', target: TARGET_VUS },
      { duration: '1m', target: 0 },
    ];

export const options = {
  scenarios: {
    gnv_connections: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: STAGES,
      gracefulRampDown: IS_CI ? '10s' : '60s',
      exec: 'gnvUserJourney',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

function httpListContent() {
  const r1 = http.get(`${API_URL}/api/movies?limit=20&page=1`, {
    tags: { name: 'GET /api/movies' },
  });
  check(r1, { 'movies 2xx': (r) => r.status >= 200 && r.status < 300 });

  const r2 = http.get(`${API_URL}/api/restaurants?lang=fr`, {
    tags: { name: 'GET /api/restaurants' },
  });
  check(r2, { 'restaurants 2xx': (r) => r.status >= 200 && r.status < 300 });

  if (JWT) {
    const r3 = http.get(`${API_URL}/api/messages`, {
      headers: { Authorization: `Bearer ${JWT}` },
      tags: { name: 'GET /api/messages' },
    });
    check(r3, { 'messages 2xx': (r) => r.status >= 200 && r.status < 300 });
  }
}

/**
 * Une session WebSocket : handshake Engine.IO + auth Socket.io + join-room + messages espacés.
 */
function runSocketSession(durationSec) {
  const room = `notifications:${USER_ID}`;
  const connectNs = `40${JSON.stringify({ auth: { token: JWT } })}`;
  const joinPacket = `42${JSON.stringify(['join-room', room])}`;

  const deadline = Date.now() + durationSec * 1000;
  let joinSent = false;
  let canSend = false;

  const res = ws.connect(
    WS_URL,
    { headers: { Origin: WS_ORIGIN } },
    (socket) => {
      socket.on('open', () => {});

      socket.on('message', (raw) => {
        const msg = String(raw);
        const h = msg[0];
        if (h === '0') {
          socket.send(connectNs);
          return;
        }
        if (msg.startsWith('40')) {
          if (!joinSent) {
            joinSent = true;
            socket.send(joinPacket);
            socket.setTimeout(() => {
              canSend = true;
            }, 400);
          }
          return;
        }
        if (h === '2') {
          socket.send('3');
        }
      });

      socket.on('error', () => {
        wsConnectFailures.add(1);
      });

      function scheduleSend() {
        if (Date.now() >= deadline) {
          socket.close();
          return;
        }
        if (canSend) {
          socket.send(
            `42${JSON.stringify([
              'send-message',
              {
                room,
                content: `k6-${__VU}-${Date.now()}`,
                text: 'load',
              },
            ])}`
          );
          wsMessageOk.add(1);
        }
        const delay = 3000 + Math.random() * 2000;
        socket.setTimeout(scheduleSend, delay);
      }

      socket.setTimeout(scheduleSend, 1500);
    }
  );

  if (res && res.status !== 101) {
    wsConnectFailures.add(1);
  }
}

export function gnvUserJourney() {
  if (__ITER !== 0) {
    sleep(1);
    return;
  }

  httpListContent();

  const socketMinutes = IS_CI ? 1 : 5;
  const socketSec = socketMinutes * 60;

  if (JWT && USER_ID) {
    runSocketSession(socketSec);
  } else {
    sleep(socketSec);
  }
}
