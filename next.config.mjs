/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  typescript: {
    ignoreBuildErrors: false,
  },

  images: {
    unoptimized: true,
  },

  async headers() {
    return [
      // ============================
      // MANIFESTS PWA
      // ============================
      {
        source: '/manifest.json',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },
      {
        source: '/manifest-pedidos.json',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },
      {
        source: '/manifest-fabrica.json',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },
      {
        source: '/manifest-horario.json',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },

      // ============================
      // SERVICE WORKERS
      // ============================
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/sw-pedidos.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/sw-fabrica.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/pwa/horario/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript' },
          { key: 'Service-Worker-Allowed', value: '/pwa/horario' },
        ],
      },

      // ============================
      // CSP GLOBAL (FINAL)
      // ============================
      {
        source: '/(.*)',
  headers: [
    {
      key: 'Content-Security-Policy',
      value:
        "default-src 'self'; " +
        "img-src 'self' data: blob: " +
          "https://controlfile.onrender.com " +
          "https://lh3.googleusercontent.com; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://cdn.jsdelivr.net https://apis.google.com blob:; " +
        "style-src 'self' 'unsafe-inline'; " +
        "connect-src 'self' data: blob: " +
          "https://controlfile.onrender.com " +
          "https://firestore.googleapis.com " +
          "https://identitytoolkit.googleapis.com " +
          "https://securetoken.googleapis.com " +
          "https://*.googleapis.com " +
          "https://cdn.jsdelivr.net; " +
        "frame-src 'self' https://vercel.live https://accounts.google.com https://*.firebaseapp.com https://*.googleapis.com; " +
        "worker-src 'self' blob:;"
          },
    {
      key: 'Cross-Origin-Opener-Policy',
      value: 'same-origin-allow-popups',
    },
        ],
      },
    ]
  },
}

export default nextConfig
