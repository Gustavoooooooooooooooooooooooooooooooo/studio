'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  // Production build check for environment variables
  if (process.env.NODE_ENV === 'production') {
    const requiredKeys: (keyof typeof firebaseConfig)[] = ['apiKey', 'authDomain', 'projectId', 'appId'];
    const missingKeys = requiredKeys.filter(key => !firebaseConfig[key]);
    
    if (missingKeys.length > 0) {
      throw new Error(
        `Firebase configuration is incomplete. The following keys are missing: ${missingKeys.join(', ')}. ` +
        'This is likely because the NEXT_PUBLIC_FIREBASE_* environment variables are not set in your Vercel project. ' +
        'Please add them to your Vercel project settings and redeploy.'
      );
    }
  }

  if (!getApps().length) {
    // Initialize with the config object.
    // For Vercel, environment variables must be set in the Vercel project settings.
    const firebaseApp = initializeApp(firebaseConfig);
    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App
  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
