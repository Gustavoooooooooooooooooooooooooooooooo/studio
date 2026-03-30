import { NextResponse } from 'next/server';

export async function GET() {
  // Define only the keys that are strictly required for the app to function.
  // Next.js requires the NEXT_PUBLIC_ prefix for variables exposed to the browser.
  const requiredConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const keyMap: { [key: string]: string } = {
    apiKey: 'NEXT_PUBLIC_FIREBASE_API_KEY',
    authDomain: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    projectId: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    messagingSenderId: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    appId: 'NEXT_PUBLIC_FIREBASE_APP_ID',
  };

  const missingKeys = Object.entries(requiredConfig)
    .filter(([, value]) => !value)
    .map(([key]) => keyMap[key] || key);

  if (missingKeys.length > 0) {
    const error = `Vercel server configuration is incomplete. The following environment variables are missing from your Vercel Project's "Production" environment settings: ${missingKeys.join(', ')}. Please add them and trigger a new deployment.`;
    console.error(error);
    return NextResponse.json(
        { error }, 
        { status: 500 }
    );
  }

  // Construct the full config, providing a fallback for storageBucket.
  const firebaseConfig = {
    ...requiredConfig,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "", 
  };

  return NextResponse.json(firebaseConfig);
}
