
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export async function initializeFirebase() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Failed to fetch Firebase config:", response.status, errorData.error);
      return null;
    }
    
    const firebaseConfig = await response.json();
    
    if (!firebaseConfig.apiKey) {
      console.error("Incomplete Firebase config received from API. Check server logs.");
      return null;
    }

    if (!getApps().length) {
      const firebaseApp = initializeApp(firebaseConfig);
      return getSdks(firebaseApp);
    }
    return getSdks(getApp());
  } catch (error) {
      console.error("Error during Firebase initialization:", error);
      return null;
  }
}

export function getSdks(firebaseApp: FirebaseApp) {
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
