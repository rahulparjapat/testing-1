// ============================================
// SOLO LEVELING SYSTEM - SERVICE WORKER
// Offline-First PWA Support
// ============================================

const CACHE_NAME = 'solo-leveling-v1.0.0';

// Assets to cache for offline use
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching essential assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('[Service Worker] Installation complete');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[Service Worker] Installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((cacheName) => cacheName !== CACHE_NAME)
                        .map((cacheName) => {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activation complete');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other non-http(s) requests
    if (!event.request.url.startsWith('http')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Return cached version if available
                if (cachedResponse) {
                    // Fetch in background to update cache
                    fetchAndCache(event.request);
                    return cachedResponse;
                }
                
                // Otherwise fetch from network
                return fetchAndCache(event.request);
            })
            .catch((error) => {
                console.error('[Service Worker] Fetch failed:', error);
                
                // Return offline page for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
                
                // Return empty response for other requests
                return new Response('', {
                    status: 408,
                    statusText: 'Offline'
                });
            })
    );
});

// Helper function to fetch and cache
async function fetchAndCache(request) {
    try {
        const response = await fetch(request);
        
        // Only cache successful responses
        if (response.status === 200) {
            const responseClone = response.clone();
            const cache = await caches.open(CACHE_NAME);
            
            // Don't cache non-essential external resources
            if (request.url.startsWith(self.location.origin) || 
                request.url.includes('fonts.googleapis.com') ||
                request.url.includes('fonts.gstatic.com') ||
                request.url.includes('cdnjs.cloudflare.com')) {
                cache.put(request, responseClone);
            }
        }
        
        return response;
    } catch (error) {
        // If network fails, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        throw error;
    }
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            console.log('[Service Worker] Cache cleared');
        });
    }
});

// Background sync for offline study sessions (if supported)
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Background sync triggered');
    
    if (event.tag === 'sync-study-data') {
        event.waitUntil(
            // In a real app, this would sync data with a server
            // For this offline-only app, we just log the event
            Promise.resolve().then(() => {
                console.log('[Service Worker] Study data synced');
            })
        );
    }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'daily-check') {
        event.waitUntil(
            // Perform daily checks
            Promise.resolve().then(() => {
                console.log('[Service Worker] Daily check performed');
            })
        );
    }
});

// Push notification handler (for future use)
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    const data = event.data.json();
    const options = {
        body: data.body || 'Time to study!',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        },
        actions: [
            {
                action: 'open',
                title: 'Open App'
            },
            {
                action: 'dismiss',
                title: 'Dismiss'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'Solo Leveling System', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then((clientList) => {
                    // Focus existing window if available
                    for (const client of clientList) {
                        if (client.url.includes(self.location.origin) && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    // Otherwise open new window
                    if (clients.openWindow) {
                        return clients.openWindow(event.notification.data.url || '/');
                    }
                })
        );
    }
});

console.log('[Service Worker] Script loaded');
