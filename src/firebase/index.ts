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

// This function now fetches config from an API route
async function getFirebaseConfig(): Promise<{ config: any; error: string | null }> {
  try {
    // Fetch from the API route
    const response = await fetch('/api/config');

    if (!response.ok) {
      const errorData = await response.json();
      // The API route provides a full, descriptive error. No need to add a prefix.
      return { config: null, error: errorData.error || `Failed to fetch Firebase config with status: ${response.status}` };
    }

    const config = await response.json();
    return { config, error: null };
  } catch (e: any) {
    const errorMessage = `Network error while fetching Firebase config: ${e.message}`;
    return { config: null, error: errorMessage };
  }
}

export async function initializeFirebase(): Promise<InitResult> {
  try {
    const { config: firebaseConfig, error: configError } = await getFirebaseConfig();

    if (configError) {
      console.error("Error getting Firebase config:", configError);
      return { services: null, error: configError };
    }

    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const services = getSdks(app);

    // Automatically sign in anonymously if no user is present
    if (!services.auth.currentUser) {
      await signInAnonymously(services.auth);
    }
    
    return { services, error: null };

  } catch (error: any) {
      let errorMessage = error instanceof Error ? error.message : "An unknown error occurred during Firebase initialization.";
      // Provide a specific, helpful error message if anonymous sign-in is not enabled
      if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'A autenticação anônima precisa ser habilitada no seu painel do Firebase. Vá em Authentication > Sign-in method e ative a opção "Anônimo". Depois disso, faça um novo deploy na Vercel.';
      }
      console.error("Error during Firebase initialization or sign-in:", errorMessage);
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
