/**
 * @type {import('next').NextConfig}
 */

// Check for Firebase environment variables during the build process on Vercel
if (process.env.VERCEL) {
  const requiredFirebaseEnvVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  ];

  const missingEnvVars = requiredFirebaseEnvVars.filter(envVar => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    throw new Error(
      `Build failed: Firebase environment variables are missing.\n` +
      `Please add the following variables to your Vercel project's "Environment Variables" settings:\n` +
      missingEnvVars.join('\n') + '\n\n' +
      `You can find these values in the .env file in your local project repository.`
    );
  }
}


import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
