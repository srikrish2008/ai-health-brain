import { useState, useEffect, useCallback } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';

// Default blank profile structure — used when user logs in for the first time
const DEFAULT_PROFILE = {
  // Basic Info
  name: '',
  dateOfBirth: '',
  gender: '',
  bloodType: '',
  height: '',
  weight: '',
  emergencyContact: '',

  // Medical History
  conditions: [],       // e.g. ["Type 2 Diabetes", "Hypertension"]
  allergies: [],        // e.g. ["Penicillin", "Peanuts"]
  surgeries: [],        // e.g. [{name, year, notes}]
  vaccinations: [],     // e.g. [{name, date, nextDue}]
  familyHistory: [],    // e.g. ["Heart Disease (Father)", "Diabetes (Mother)"]

  // Medications
  currentMedications: [],  // e.g. [{name, dose, frequency, since}]
  pastMedications: [],     // e.g. [{name, dose, reason, from, to}]

  // Lifestyle
  averageSleepHours: '',
  smokingStatus: '',
  alcoholConsumption: '',
  exerciseFrequency: '',

  createdAt: null,
  updatedAt: null,
};

export function useHealthProfile(user) {
  const [profile, setProfile] = useState(null);
  const [symptoms, setSymptoms] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [vaultFiles, setVaultFiles] = useState([]);
  const [vitals, setVitals] = useState([]);

  // Load profile + subscribe to symptoms, visits, vault & vitals on login
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setSymptoms([]);
      setVisits([]);
      setVaultFiles([]);
      setVitals([]);
      setLoading(false);
      return;
    }

    const userRef = doc(db, 'users', user.uid);

    // One-time profile fetch
    const fetchProfile = async () => {
      try {
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          setProfile(snap.data());
        } else {
          // First login — create default profile
          const newProfile = { ...DEFAULT_PROFILE, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
          await setDoc(userRef, newProfile);
          setProfile(newProfile);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
        setError('Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    // Real-time symptom listener
    const symptomsQuery = query(
      collection(db, 'users', user.uid, 'symptoms'),
      orderBy('loggedAt', 'desc')
    );
    const unsubSymptoms = onSnapshot(symptomsQuery, (snap) => {
      setSymptoms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('Symptoms listener error:', err));

    // Real-time visits listener
    const visitsQuery = query(
      collection(db, 'users', user.uid, 'visits'),
      orderBy('visitDate', 'desc')
    );
    const unsubVisits = onSnapshot(visitsQuery, (snap) => {
      setVisits(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('Visits listener error:', err));

    // Real-time vault listener
    const vaultQuery = query(
      collection(db, 'users', user.uid, 'vault'),
      orderBy('uploadedAt', 'desc')
    );
    const unsubVault = onSnapshot(vaultQuery, (snap) => {
      setVaultFiles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('Vault listener error:', err));

    // Real-time vitals listener
    const vitalsQuery = query(
      collection(db, 'users', user.uid, 'vitals'),
      orderBy('timestamp', 'desc')
    );
    const unsubVitals = onSnapshot(vitalsQuery, (snap) => {
      setVitals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('Vitals listener error:', err));

    return () => {
      unsubSymptoms();
      unsubVisits();
      unsubVault();
      unsubVitals();
    };
  }, [user]);

  // Save/update the main profile document
  const saveProfile = useCallback(async (updates) => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const userRef = doc(db, 'users', user.uid);
      const updatedData = { ...updates, updatedAt: serverTimestamp() };
      await updateDoc(userRef, updatedData);
      setProfile(prev => ({ ...prev, ...updatedData }));
    } catch (err) {
      console.error('Error saving profile:', err);
      setError('Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }, [user]);

  // Log a new symptom entry
  const logSymptom = useCallback(async (symptomData) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'symptoms'), {
        ...symptomData,
        loggedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error logging symptom:', err);
      setError('Failed to log symptom.');
    }
  }, [user]);

  // Delete a symptom entry
  const deleteSymptom = useCallback(async (symptomId) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'symptoms', symptomId));
    } catch (err) {
      console.error('Error deleting symptom:', err);
    }
  }, [user]);

  // Log a new doctor visit
  const logVisit = useCallback(async (visitData) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'visits'), {
        ...visitData,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error logging visit:', err);
      setError('Failed to log visit.');
    }
  }, [user]);

  // Delete a doctor visit
  const deleteVisit = useCallback(async (visitId) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'visits', visitId));
    } catch (err) {
      console.error('Error deleting visit:', err);
    }
  }, [user]);

  // Add document to Vault
  const addVaultFile = useCallback(async (fileData) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'vault'), {
        ...fileData,
        uploadedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error adding vault file:', err);
      setError('Failed to save vault file.');
      throw err;
    }
  }, [user]);

  // Delete document from Vault
  const deleteVaultFile = useCallback(async (fileId) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'vault', fileId));
    } catch (err) {
      console.error('Error deleting vault file:', err);
    }
  }, [user]);

  // Log a new vital check-in
  const logVital = useCallback(async (vitalData) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'vitals'), {
        ...vitalData,
        timestamp: serverTimestamp(),
      });
      // Sync latest vital readings directly to core profile
      const userRef = doc(db, 'users', user.uid);
      const updates = { latestVitals: vitalData, updatedAt: serverTimestamp() };
      if (vitalData.weight && Number(vitalData.weight) > 0) {
        updates.weight = vitalData.weight;
      }
      await updateDoc(userRef, updates);
      setProfile(prev => ({ ...prev, ...updates }));
    } catch (err) {
      console.error('Error logging vital:', err);
      setError('Failed to log vitals.');
    }
  }, [user]);

  // Delete a vital entry
  const deleteVital = useCallback(async (vitalId) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'vitals', vitalId));
    } catch (err) {
      console.error('Error deleting vital:', err);
    }
  }, [user]);

  return {
    profile,
    symptoms,
    visits,
    vaultFiles,
    vitals,
    loading,
    saving,
    error,
    saveProfile,
    logSymptom,
    deleteSymptom,
    logVisit,
    deleteVisit,
    addVaultFile,
    deleteVaultFile,
    logVital,
    deleteVital,
  };
}
