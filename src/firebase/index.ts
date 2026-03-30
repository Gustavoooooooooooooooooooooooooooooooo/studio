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
async function getFirebaseConfig(): Promise<{ config: any; error: string | null; debug?: any }> {
  try {
    // Fetch from the API route
    const response = await fetch('/api/config');
    const data = await response.json();

    if (!response.ok) {
        return { config: null, error: `Failed to fetch Firebase config with status: ${response.status}` };
    }
    
    if (!data.success) {
      const error = `A configuração do servidor Vercel está incompleta. As seguintes variáveis de ambiente estão faltando nas configurações de 'Production' do seu Projeto Vercel: ${data.missingKeys.join(', ')}. Por favor, adicione-as e faça um novo deploy.`;
      return { config: null, error };
    }
    
    return { config: data.config, error: null, debug: data.debug };
  } catch (e: any) {
    const errorMessage = `Network error while fetching Firebase config: ${e.message}`;
    console.error(errorMessage, e);
    return { config: null, error: errorMessage };
  }
}

export async function initializeFirebase(): Promise<InitResult> {
  try {
    const { config: firebaseConfig, error: configError, debug: debugInfo } = await getFirebaseConfig();

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
      if (error.code === 'auth/invalid-api-key') {
        const { debug: debugInfo } = await getFirebaseConfig(); // refetch to get debug info
        const apiKeyPartial = debugInfo?.apiKeyPartial || 'não foi possível ler';
        const start = apiKeyPartial.split('...')[0];
        const end = apiKeyPartial.split('...')[1];
        errorMessage = `A chave de API do Firebase (apiKey) é inválida. A aplicação está recebendo uma chave que começa com '${start}' e termina com '${end}'. Por favor, verifique se este é o começo e o fim corretos da sua chave no console do Firebase. Se não for, corrija o valor da variável NEXT_PUBLIC_FIREBASE_API_KEY nas configurações do seu projeto Vercel e faça um novo deploy.`;
      } else if (error.code === 'auth/operation-not-allowed') {
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
