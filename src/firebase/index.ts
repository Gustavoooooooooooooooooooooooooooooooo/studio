
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
    const response = await fetch('/api/config');
    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error || "Falha ao buscar a configuração do servidor.";
      console.error("Failed to fetch Firebase config:", response.status, errorMessage);
      return { services: null, error: errorMessage };
    }
    
    const firebaseConfig = await response.json();
    
    if (!firebaseConfig.apiKey) {
      const errorMessage = "Configuração do Firebase incompleta recebida da API. Verifique os logs do servidor.";
      console.error(errorMessage);
      return { services: null, error: errorMessage };
    }

    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const services = getSdks(app);
    return { services, error: null };

  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido durante a inicialização.";
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
