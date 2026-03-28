'use client';

export function EnvChecker() {
    const keys = [
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
        'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
        'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
        'NEXT_PUBLIC_FIREBASE_APP_ID',
    ];

    const envVars = {
        NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    return (
        <div className="fixed bottom-4 left-4 bg-neutral-800 text-white p-4 rounded-lg shadow-lg z-50 text-xs font-mono opacity-95 max-w-sm">
            <h4 className="mb-2 pb-2 border-b border-neutral-600 font-bold">
                Firebase Env Vars (Debug)
            </h4>
            <ul className="space-y-1">
                {keys.map(key => (
                    <li key={key} className="flex justify-between items-center gap-4">
                        <span className="truncate">{key.replace('NEXT_PUBLIC_FIREBASE_', '')}</span>
                        {envVars[key as keyof typeof envVars] ? (
                            <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Present</span>
                        ) : (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Missing</span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
