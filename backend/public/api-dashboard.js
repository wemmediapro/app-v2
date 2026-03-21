(function () {
  const endpoints = [
    { method: 'GET', path: '/api/v1/health', desc: 'Santé détaillée (Mongo, Redis, disque, versions)' },
    { method: 'GET', path: '/api/v1/health/live', desc: 'Liveness K8s (processus vivant)' },
    { method: 'GET', path: '/api/v1/health/ready', desc: 'Readiness K8s (Mongo + Redis prod)' },
    { method: 'GET', path: '/api/admin/dashboard', desc: 'Statistiques du dashboard' },
    { method: 'GET', path: '/api/admin/users', desc: 'Liste des utilisateurs' },
    { method: 'GET', path: '/api/restaurants', desc: 'Liste des restaurants' },
    { method: 'GET', path: '/api/feedback', desc: 'Liste des feedbacks' },
    { method: 'GET', path: '/api/messages', desc: 'Conversations' },
    { method: 'GET', path: '/api/analytics/overview', desc: "Vue d'ensemble analytics" },
    { method: 'GET', path: '/api/analytics/connections', desc: 'Statistiques connexions' },
    { method: 'GET', path: '/api/analytics/content', desc: 'Statistiques contenu' },
    { method: 'GET', path: '/api/analytics/performance', desc: 'Statistiques performance' },
    { method: 'GET', path: '/api/demo/users', desc: 'Utilisateurs (démo)' },
    { method: 'GET', path: '/api/demo/restaurants', desc: 'Restaurants (démo)' },
    { method: 'GET', path: '/api/demo/feedback', desc: 'Feedback (démo)' },
    { method: 'GET', path: '/api/demo/messages', desc: 'Messages (démo)' },
    { method: 'GET', path: '/api/demo/statistics', desc: 'Statistiques (démo)' },
  ];

  function pathToDomId(path) {
    return path.replace(/\//g, '-');
  }

  function initCards() {
    const endpointsContainer = document.getElementById('endpoints');
    if (!endpointsContainer) {
      return;
    }

    endpoints.forEach((endpoint) => {
      const card = document.createElement('div');
      card.className = 'endpoint-card';

      const methodClass = endpoint.method.toLowerCase();
      const pid = pathToDomId(endpoint.path);
      card.innerHTML =
        '<span class="method ' +
        methodClass +
        '">' +
        endpoint.method +
        '</span>' +
        '<div class="path"></div>' +
        '<div class="description"></div>' +
        '<button type="button" class="test-btn">Tester</button>' +
        '<div class="response" id="response-' +
        pid +
        '"></div>';

      card.querySelector('.path').textContent = endpoint.path;
      card.querySelector('.description').textContent = endpoint.desc;

      const btn = card.querySelector('.test-btn');
      btn.addEventListener('click', () => testEndpoint(endpoint.path));

      endpointsContainer.appendChild(card);
    });
  }

  async function testEndpoint(path) {
    const responseDiv = document.getElementById('response-' + pathToDomId(path));
    if (!responseDiv) {
      return;
    }
    responseDiv.textContent = 'Chargement...';
    responseDiv.classList.add('show');

    try {
      const response = await fetch(path);
      const data = await response.json();
      responseDiv.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
      responseDiv.textContent = 'Erreur: ' + error.message;
    }
  }

  async function checkStatus() {
    const el = document.getElementById('status');
    if (!el) {
      return;
    }
    try {
      const response = await fetch('/api/v1/health');
      await response.json();
      el.textContent = '● En ligne';
      el.className = 'status online';
    } catch (error) {
      el.textContent = '● Hors ligne';
      el.className = 'status offline';
    }
  }

  const originEl = document.getElementById('origin');
  if (originEl) {
    originEl.textContent = window.location.origin;
  }

  initCards();
  checkStatus();
  setInterval(checkStatus, 5000);
})();
