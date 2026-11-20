/** @type {import('next').NextConfig} */
const nextConfig = {
  // Make sure the optional embeddings file ships with the API route on Vercel.
  outputFileTracingIncludes: { "/api/search": ["./data/**"] },
  // Hide the Next.js "N" badge that the dev server draws in the corner.
  devIndicators: false,
};
export default nextConfig;
