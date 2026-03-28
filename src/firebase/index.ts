'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export function initializeFirebase() {
  if (!firebaseConfig.apiKey) {
    console.warn('Firebase config is missing. Check your environment variables.');
    return null as any;
  }
  if (!getApps().length) {
    const firebaseApp = initializeApp(firebaseConfig);
    return getSdks(firebaseApp);
  }
  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp),
  };
}

export async function initiateAnonymousSignIn(auth: ReturnType<typeof getAuth>, toast?: (props: any) => void) {
  try {
    await signInAnonymously(auth);
  } catch (error) {
    console.error('Anonymous sign-in failed:', error);
    if (toast) {
      toast({
        variant: "destructive",
        title: "Falha na Autenticação Anônima",
        description: "Não foi possível conectar ao servidor. Verifique se o método de login anônimo está ativado no painel do Firebase.",
        duration: 15000,
      });
    }
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
