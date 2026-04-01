'use client';

import { useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import {
  doc, collection, onSnapshot,
  setDoc, addDoc, deleteDoc, query
} from 'firebase/firestore';

export type AppUrls = {
  inventory: string;
  leads: string;
  sales: string;
  rentals: string;
  logo: string;
};

export type AppTargets = {
  [key: string]: {
    capturesSale: { annual: number; quarterly: number; semiannual: number; };
    capturesRent: { annual: number; quarterly: number; semiannual: number; };
  }
};

export function useAppConfig() {
  const { firestore, areServicesAvailable, initError } = useFirebase();

  const [urls, setUrls] = useState<AppUrls>({
    inventory: '', leads: '', sales: '', rentals: '', logo: ''
  });
  const [brokers, setBrokers] = useState<string[]>([]);
  const [targets, setTargets] = useState<AppTargets>({
    global: {
      capturesSale: { annual: 250, quarterly: 65, semiannual: 125 },
      capturesRent: { annual: 150, quarterly: 40, semiannual: 75 },
    }
  });
  const [loading, setLoading] = useState(true);
  const [brokerDocs, setBrokerDocs] = useState<{ id: string; name: string }[]>([]);

  // Listen to URLs from Firestore
  useEffect(() => {
    if (!firestore || !areServicesAvailable) {
        setLoading(false);
        return;
    }

    const configRef = doc(firestore, 'config', 'sheet-urls');
    const unsub = onSnapshot(configRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as AppUrls;
        setUrls(data);
      }
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [firestore, areServicesAvailable]);

  // Listen to targets from Firestore
  useEffect(() => {
    if (!firestore || !areServicesAvailable) return;

    const targetsRef = doc(firestore, 'config', 'targets');
    const unsub = onSnapshot(targetsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as AppTargets;
        // Basic validation
        if (data.global && data.global.capturesSale) {
            setTargets(data);
        }
      }
    });
    return () => unsub();
  }, [firestore, areServicesAvailable]);


  // Listen to brokers from Firestore
  useEffect(() => {
    if (!firestore || !areServicesAvailable) return;

    const brokersRef = collection(firestore, 'brokers');
    const q = query(brokersRef);
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, name: d.data().name as string }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setBrokers(list.map(b => b.name));
      setBrokerDocs(list);
    });

    return () => unsub();
  }, [firestore, areServicesAvailable]);

  const saveUrls = async (newUrls: AppUrls) => {
    if (!firestore) return;
    setUrls(newUrls); // Optimistic update
    await setDoc(doc(firestore, 'config', 'sheet-urls'), newUrls);
  };
  
  const saveTargets = async (newTargets: AppTargets) => {
    if (!firestore) return;
    setTargets(newTargets); // Optimistic update
    await setDoc(doc(firestore, 'config', 'targets'), newTargets);
  };

  const addBroker = async (name: string) => {
    if (!firestore) return { error: 'no-firestore' };
    const normalizedName = name.trim();
    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    
    if (brokers.some(b => normalize(b) === normalize(normalizedName))) {
        return { error: 'already-exists' };
    }
  
    // Optimistic update
    const originalBrokers = [...brokers];
    const newBrokers = [...brokers, normalizedName].sort((a, b) => a.localeCompare(b));
    setBrokers(newBrokers);
    
    try {
        await addDoc(collection(firestore, 'brokers'), { name: normalizedName });
        return { error: null };
    } catch (e) {
        setBrokers(originalBrokers); // Revert on error
        return { error: 'firestore-error' };
    }
  };

  const deleteBroker = async (name: string) => {
    if (!firestore) return;
    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const brokerDoc = brokerDocs.find(b => normalize(b.name) === normalize(name));
    
    if (brokerDoc) {
      const originalBrokers = brokers;
      // Optimistic update
      setBrokers(prevBrokers => prevBrokers.filter(b => normalize(b) !== normalize(name)));
      try {
        await deleteDoc(doc(firestore, 'brokers', brokerDoc.id));
      } catch (e) {
        setBrokers(originalBrokers); // Revert on error
      }
    }
  };

  return { urls, brokers, targets, loading, saveUrls, addBroker, deleteBroker, saveTargets, areServicesAvailable, initError };
}
