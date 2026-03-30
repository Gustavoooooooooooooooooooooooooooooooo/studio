import { NextResponse } from 'next/server';

export async function GET() {
  // Define the keys we need and the possible env var names
  const configMapping = {
    apiKey: ['NEXT_PUBLIC_FIREBASE_API_KEY', 'FIREBASE_API_KEY'],
    authDomain: ['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'FIREBASE_AUTH_DOMAIN'],
    projectId: ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID'],
    messagingSenderId: ['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_MESSAGING_SENDER_ID'],
    appId: ['NEXT_PUBLIC_FIREBASE_APP_ID', 'FIREBASE_APP_ID'],
    storageBucket: ['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'FIREBASE_STORAGE_BUCKET'],
  };

  const firebaseConfig: { [key: string]: string } = {};
  const missingKeys: string[] = [];

  // Find the first available env var for each config key
  for (const key in configMapping) {
    const varNames = configMapping[key as keyof typeof configMapping];
    const value = varNames.map(name => process.env[name]).find(v => v);

    if (value) {
      firebaseConfig[key] = value;
    } else {
      // Don't fail for storageBucket, it's optional
      if (key !== 'storageBucket') {
        missingKeys.push(varNames[0]); // Report the recommended name
      }
    }
  }

  if (missingKeys.length > 0) {
    const error = `Vercel server configuration is incomplete. The following environment variables are missing from your Vercel Project's "Production" environment settings: ${missingKeys.join(', ')}. Please ensure they are added and trigger a new deployment.`;
    console.error(error);
    return NextResponse.json({ error }, { status: 500 });
  }
  
  // Ensure storageBucket is present, even if empty
  if (!firebaseConfig.storageBucket) {
    firebaseConfig.storageBucket = "";
  }

  return NextResponse.json(firebaseConfig);
}
