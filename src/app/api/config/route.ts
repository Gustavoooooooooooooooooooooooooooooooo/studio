import { NextResponse } from 'next/server';

export async function GET() {
  // Ajustado para buscar apenas os nomes exatos que estão no seu .env e Vercel
  const configMapping = {
    apiKey: ['NEXT_PUBLIC_FIREBASE_API_KEY'],
    authDomain: ['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'],
    projectId: ['NEXT_PUBLIC_FIREBASE_PROJECT_ID'],
    messagingSenderId: ['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'],
    appId: ['NEXT_PUBLIC_FIREBASE_APP_ID'],
    storageBucket: ['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'],
  };

  const firebaseConfig: { [key: string]: string } = {};
  const missingKeys: string[] = [];

  for (const key in configMapping) {
    const varNames = configMapping[key as keyof typeof configMapping];

    // Tenta encontrar o valor no ambiente do servidor
    const value = varNames
      .map((name) => process.env[name])
      .find((v) => v && v !== '');

    if (value) {
      firebaseConfig[key] = value;
    } else {
      // O storageBucket é opcional em algumas configs, mas os outros são obrigatórios
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
    envKeysDetected: Object.keys(process.env).filter(k => k.includes('FIREBASE')).length
  };

  if (missingKeys.length > 0) {
    console.error('❌ Variáveis faltando no servidor:', missingKeys);
  }

  return NextResponse.json({
    success: missingKeys.length === 0,
    missingKeys,
    config: firebaseConfig,
    debug: debugInfo,
  });
}