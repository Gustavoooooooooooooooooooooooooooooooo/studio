
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const getMissingConfigKeys = (): string[] => {
    const requiredKeys: (keyof typeof firebaseConfig)[] = [
        'apiKey', 
        'authDomain', 
        'projectId', 
        'storageBucket', 
        'messagingSenderId', 
        'appId'
    ];
    const missing = requiredKeys.filter(key => !firebaseConfig[key]);

    // Map to the env var name for better user feedback
    const keyToEnvVar: Record<string, string> = {
        apiKey: 'NEXT_PUBLIC_FIREBASE_API_KEY',
        authDomain: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
        projectId: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
        storageBucket: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
        messagingSenderId: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
        appId: 'NEXT_PUBLIC_FIREBASE_APP_ID',
    };

    return missing.map(key => keyToEnvVar[key] || key);
};
