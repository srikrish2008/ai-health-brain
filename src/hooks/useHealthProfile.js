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
import { normalizeEmergencyContact, DEFAULT_EMERGENCY_CONTACT } from '../utils/emergencyContact';

// Default blank profile structure — used when user logs in for the first time
const DEFAULT_PROFILE = {
  // Basic Info
  name: '',
  dateOfBirth: '',
  gender: '',
  bloodType: '',
  height: '',
  weight: '',
  emergencyContact: { ...DEFAULT_EMERGENCY_CONTACT },

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
          const data = snap.data();
          setProfile({
            ...data,
            emergencyContact: normalizeEmergencyContact(data.emergencyContact)
          });
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
      const sanitizedUpdates = { ...updates };
      if (sanitizedUpdates.emergencyContact !== undefined) {
        sanitizedUpdates.emergencyContact = normalizeEmergencyContact(sanitizedUpdates.emergencyContact);
      }
      const updatedData = { ...sanitizedUpdates, updatedAt: serverTimestamp() };
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

  // Delete document from Vault (verified server-side Cloudinary asset cleanup + Firestore metadata)
  const deleteVaultFile = useCallback(async (fileOrId) => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      let fileId = fileOrId;
      let cloudinaryId = null;

      if (typeof fileOrId === 'object' && fileOrId !== null) {
        fileId = fileOrId.id;
        cloudinaryId = fileOrId.cloudinaryId;
      } else {
        // Fallback: look up in currently loaded vaultFiles if only an ID was passed
        const found = vaultFiles.find(f => f.id === fileOrId);
        if (found) {
          cloudinaryId = found.cloudinaryId;
        }
      }

      if (!fileId) {
        throw new Error('No valid vault file identifier provided.');
      }

      const idToken = await user.getIdToken();
      const res = await fetch('/api/vault/delete-file', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileId: fileId,
          publicId: cloudinaryId || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete vault file.');
      }

      // Also ensure client-side Firestore doc is cleared if needed (idempotent no-op if already deleted)
      await deleteDoc(doc(db, 'users', user.uid, 'vault', fileId)).catch(() => {});
    } catch (err) {
      console.error('Error deleting vault file:', err);
      setError(err.message || 'Failed to delete vault document.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [user, vaultFiles]);

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
