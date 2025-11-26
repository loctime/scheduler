/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false, // En producción queremos ver los errores de TypeScript
  },
  images: {
    unoptimized: true, // Necesario para algunos entornos de deploy
  },
  // Optimizaciones para producción
  reactStrictMode: true,
}

export default nextConfig
