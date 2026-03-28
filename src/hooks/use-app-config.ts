'use client';

import { useState, useEffect, useMemo } from 'react';
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

export function useAppConfig() {
  const { firestore, areServicesAvailable } = useFirebase();

  const [urls, setUrls] = useState<AppUrls>({
    inventory: '', leads: '', sales: '', rentals: '', logo: ''
  });
  const [brokers, setBrokers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Listen to URLs from Firestore
  useEffect(() => {
    if (!firestore || !areServicesAvailable) return;

    const configRef = doc(firestore, 'config', 'sheet-urls');
    const unsub = onSnapshot(configRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as AppUrls;
        setUrls(data);
      }
      setLoading(false);
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
      // Store IDs for deletion
      setBrokerDocs(list);
    });

    return () => unsub();
  }, [firestore, areServicesAvailable]);

  const [brokerDocs, setBrokerDocs] = useState<{ id: string; name: string }[]>([]);

  const saveUrls = async (newUrls: AppUrls) => {
    if (!firestore) return;
    setUrls(newUrls); // optimistic update
    await setDoc(doc(firestore, 'config', 'sheet-urls'), newUrls);
  };

  const addBroker = async (name: string) => {
    if (!firestore) return;
    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const exists = brokerDocs.some(b => normalize(b.name) === normalize(name));
    if (exists) return { error: 'already-exists' };
    await addDoc(collection(firestore, 'brokers'), { name: name.trim() });
    return { error: null };
  };

  const deleteBroker = async (name: string) => {
    if (!firestore) return;
    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const brokerDoc = brokerDocs.find(b => normalize(b.name) === normalize(name));
    if (brokerDoc) {
      await deleteDoc(doc(firestore, 'brokers', brokerDoc.id));
    }
  };

  return { urls, brokers, loading, saveUrls, addBroker, deleteBroker, areServicesAvailable };
}