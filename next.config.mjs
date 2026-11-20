/** @type {import('next').NextConfig} */
const nextConfig = {
  // Make sure the optional embeddings file ships with the API route on Vercel.
  outputFileTracingIncludes: { "/api/search": ["./data/**"] },
};
export default nextConfig;
