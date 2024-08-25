const CACHE_NAME = 'tydids-wallet-cache-v1';
const urlsToCache = [	
	'/showcase.html',
	'/assets/bootstrap/css/bootstrap.min.css',
	'/assets/bootstrap/js/bootstrap.min.js',
	'/assets/css/styles.css',
	'/assets/css/datatables.min.css',
	'/assets/js/tydids-jquery-consent.js',
	'/assets/js/showcase.js',
	'/assets/js/jquery.min.js',
	'/assets/js/tydids.js',
	'/assets/js/external/qrcode.min.js',
	'/assets/js/external/datatables.min.js',
	'/assets/js/external/html5-qrcode.min.js',
	'/assets/js/external/crypto-js.min.js',
	'/assets/js/wallet.js',
	'/assets/js/bs-init.js',
	'/assets/img/cc-by-nc-sa.png',
	'/assets/img/ios_180_180.png',
	'/index.html'
];

// Install event - caching the application shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});


self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          response => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
      .catch(() => {
        // If both cache and network fail, show a generic fallback:
        return caches.match('/offline.html');
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

