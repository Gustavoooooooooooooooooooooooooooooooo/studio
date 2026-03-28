import { NextResponse } from 'next/server';

export async function GET() {
  // Define only the keys that are strictly required for the app to function.
  const requiredConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const missingKeys = Object.entries(requiredConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    const error = `Server configuration for Firebase is incomplete. Missing env variables: ${missingKeys.join(', ')}`;
    console.error(error);
    return NextResponse.json(
        { error }, 
        { status: 500 }
    );
  }

  // Construct the full config, now treating storageBucket as optional.
  const firebaseConfig = {
    ...requiredConfig,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  };

  return NextResponse.json(firebaseConfig);
}
