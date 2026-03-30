'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Define a type for the successful return
type FirebaseServices = {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
};

// Define a type for the return value of initializeFirebase
type InitResult = {
  services: FirebaseServices | null;
  error: string | null;
};


export async function initializeFirebase(): Promise<InitResult> {
  try {
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    const missingKeys: string[] = [];
    for (const [key, value] of Object.entries(firebaseConfig)) {
        if (key !== 'storageBucket' && !value) {
            const envVarName = `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
            missingKeys.push(envVarName);
        }
    }

    if (missingKeys.length > 0) {
        const error = `Firebase configuration is incomplete. The following environment variables are missing from your Vercel project's "Production" environment: ${missingKeys.join(', ')}. Please ensure they are added and trigger a new deployment.`;
        console.error(error);
        return { services: null, error };
    }
    
    // Ensure storageBucket is present, even if empty, as the SDK expects it.
    if (!firebaseConfig.storageBucket) {
      (firebaseConfig as any).storageBucket = "";
    }

    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const services = getSdks(app);
    return { services, error: null };

  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during Firebase initialization.";
      console.error("Error during Firebase initialization:", error);
      return { services: null, error: errorMessage };
  }
}

export function getSdks(firebaseApp: FirebaseApp): FirebaseServices {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp),
  };
}

export async function initiateAnonymousSignIn(auth: ReturnType<typeof getAuth>, toast: any) {
  try {
    await signInAnonymously(auth);
  } catch (error: any) {
    console.error('Anonymous sign-in failed:', error);
    const errorMessage = error.code === 'auth/operation-not-allowed'
      ? 'Login anônimo precisa ser habilitado no seu painel do Firebase (Authentication > Sign-in method).'
      : `Falha na autenticação: ${error.code}`;
    
    toast({
        variant: "destructive",
        title: "Erro de Autenticação",
        description: errorMessage,
        duration: 999999, // Make the toast persistent
    });
  }
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
