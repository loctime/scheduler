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
              "img-src 'self' data: https://controlfile.onrender.com; " +
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live; " +
              "style-src 'self' 'unsafe-inline'; " +
              "connect-src 'self' " +
                "https://controlfile.onrender.com " +
                "https://firestore.googleapis.com " +
                "https://identitytoolkit.googleapis.com " +
                "https://securetoken.googleapis.com " +
                "https://*.googleapis.com; " +
              "frame-src https://vercel.live;",
          },
        ],
      },
    ]
  },
}

export default nextConfig
