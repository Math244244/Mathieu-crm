// NOTE : Ce fichier est essentiel pour le mode hors-ligne de votre PWA.

// Nom du cache. Changez-le si vous faites de grosses modifications pour forcer la mise à jour.
const CACHE_NAME = 'crm-concessionnaires-v1';

// Liste des fichiers de base de votre application à mettre en cache.
const APP_SHELL_URLS = [
  // NOTE : Le chemin '.' pointe vers le dossier actuel. C'est la correction
  // la plus importante pour que cela fonctionne sur GitHub Pages.
  '.',
  'index.html',
  'style.css',
  'app.js',
  'images/icon-192x192.png',
  'images/icon-512x512.png',
  'https://cdn.jsdelivr.net/npm/choices.js/public/assets/styles/choices.min.css',
  'https://cdn.jsdelivr.net/npm/choices.js/public/assets/scripts/choices.min.js',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Événement d'installation : le navigateur installe le Service Worker.
// On en profite pour ouvrir le cache et y ajouter tous nos fichiers de base.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Cache ouvert et fichiers de l\'application ajoutés.');
      return cache.addAll(APP_SHELL_URLS);
    })
  );
});

// Événement d'activation : le Service Worker prend le contrôle de la page.
// On en profite pour supprimer les anciens caches qui ne sont plus utilisés.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Ancien cache supprimé.', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Événement de fetch : se déclenche chaque fois que la page demande une ressource (fichier, image, etc.).
self.addEventListener('fetch', (event) => {
  // On ignore les requêtes vers Firebase, car il gère son propre système hors-ligne.
  if (event.request.url.includes('firestore.googleapis.com')) {
    return;
  }
  
  // Stratégie "Cache d'abord" :
  // On répond avec la version du cache si elle existe.
  // Sinon, on fait une requête réseau pour obtenir la ressource.
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});