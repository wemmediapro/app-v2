/**
 * Script de chargement initial (exécuté avant le bundle React).
 * Conservé en fichier externe pour permettre une CSP stricte sans 'unsafe-inline'.
 */
(function () {
  console.log("🚀 Démarrage de l'application GNV");
  console.log('📍 URL:', window.location.href);
  console.log('🌐 User Agent:', navigator.userAgent);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      console.log('✅ DOM chargé');
    });
  } else {
    console.log('✅ DOM déjà chargé');
  }

  window.addEventListener('error', function (e) {
    console.error('❌ Erreur:', e.message, e.filename, e.lineno);
  });

  window.addEventListener('load', function () {
    setTimeout(function () {
      var loading = document.getElementById('loading');
      if (loading && loading.parentElement) {
        loading.style.display = 'none';
      }
    }, 500);
  });
})();
