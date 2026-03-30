import { NextResponse } from 'next/server';

export async function GET() {
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

  for (const key in configMapping) {
    const varNames = configMapping[key as keyof typeof configMapping];

    const value = varNames
      .map((name) => process.env[name])
      .find((v) => v && v !== '');

    if (value) {
      firebaseConfig[key] = value;
    } else {
      if (key !== 'storageBucket') {
        missingKeys.push(varNames[0]);
      }
      firebaseConfig[key] = '';
    }
  }

  const debugInfo = {
    apiKeyPartial: firebaseConfig.apiKey 
      ? `${firebaseConfig.apiKey.substring(0, 5)}...${firebaseConfig.apiKey.slice(-5)}` 
      : 'N/A',
  };

  if (missingKeys.length > 0) {
    console.error('❌ Variáveis faltando:', missingKeys);
  }

  return NextResponse.json({
    success: missingKeys.length === 0,
    missingKeys,
    config: firebaseConfig,
    debug: debugInfo,
  });
}
