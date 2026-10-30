import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  auth,
  googleProvider,
  db,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  User,
} from '../lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';

export interface Tenant {
  id: string;
  name: string;
  ownerId: string;
  members: Record<string, 'owner' | 'admin' | 'member'>;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  currentTenantId: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  currentTenant: Tenant | null;
  tenants: Tenant[];
  loading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  loginManual: (email: string, pass: string) => Promise<void>;
  registerManual: (email: string, pass: string, name: string, workspaceName?: string) => Promise<void>;
  createTenant: (workspaceName: string) => Promise<Tenant>;
  switchTenant: (tenantId: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  // Helper to ensure tenant and initial projects exist
  const ensureUserAndTenant = async (currentUser: User, customWorkspaceName?: string) => {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);

      let activeTenantId = '';

      if (userSnap.exists()) {
        const uData = userSnap.data() as UserProfile;
        setUserProfile(uData);
        activeTenantId = uData.currentTenantId;
      } else {
        // Create initial tenant
        const tenantId = `tenant-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const workspaceName =
          customWorkspaceName?.trim() ||
          (currentUser.displayName ? `${currentUser.displayName}'s Organization` : 'Primary Workspace');

        const tenantData: Tenant = {
          id: tenantId,
          name: workspaceName,
          ownerId: currentUser.uid,
          members: {
            [currentUser.uid]: 'owner',
          },
          createdAt: new Date().toISOString(),
        };

        // Write tenant doc
        await setDoc(doc(db, 'tenants', tenantId), tenantData);

        // Write user profile doc
        const profileData: UserProfile = {
          id: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
          photoURL: currentUser.photoURL || undefined,
          currentTenantId: tenantId,
          createdAt: new Date().toISOString(),
        };
        await setDoc(userRef, profileData);
        setUserProfile(profileData);
        activeTenantId = tenantId;
      }

      // Fetch all tenants where user is owner or member
      const tenantsList: Tenant[] = [];

      // Query owned
      const ownedQ = query(collection(db, 'tenants'), where('ownerId', '==', currentUser.uid));
      const ownedSnaps = await getDocs(ownedQ);
      ownedSnaps.forEach((d) => tenantsList.push(d.data() as Tenant));

      // Query member
      const memberQ = query(
        collection(db, 'tenants'),
        where(`members.${currentUser.uid}`, 'in', ['owner', 'admin', 'member'])
      );
      try {
        const memberSnaps = await getDocs(memberQ);
        memberSnaps.forEach((d) => {
          if (!tenantsList.some((t) => t.id === d.id)) {
            tenantsList.push(d.data() as Tenant);
          }
        });
      } catch {
        // Index or sub-query note
      }

      setTenants(tenantsList);

      const active = tenantsList.find((t) => t.id === activeTenantId) || tenantsList[0] || null;
      setCurrentTenant(active);
    } catch (err: any) {
      console.warn('Notice synchronizing user tenant data (operating with offline fallback):', err?.message || err);
      // Fallback local memory tenant if firestore offline
      const fallbackTenant: Tenant = {
        id: `tenant-${currentUser.uid}`,
        name: currentUser.displayName ? `${currentUser.displayName}'s Organization` : 'Default Workspace',
        ownerId: currentUser.uid,
        members: { [currentUser.uid]: 'owner' },
        createdAt: new Date().toISOString(),
      };
      setTenants([fallbackTenant]);
      setCurrentTenant(fallbackTenant);
    }
  };

  // Auth state listener
  useEffect(() => {
    let mounted = true;
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 1200);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      clearTimeout(safetyTimer);
      if (!mounted) return;
      setUser(currentUser);
      if (currentUser) {
        try {
          await ensureUserAndTenant(currentUser);
        } catch (err) {
          console.warn('Notice synchronizing user tenant data:', err);
        }
      } else {
        setUserProfile(null);
        setCurrentTenant(null);
        setTenants([]);
      }
      if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  // 1. Google Sign-In
  const loginWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        await ensureUserAndTenant(res.user);
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      let msg = err.message || 'Failed to sign in with Google.';
      if (err.code === 'auth/popup-blocked') {
        msg = 'Popup was blocked by your browser. Please allow popups for this site or use manual email login.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        msg = 'Sign-in cancelled. Please try again.';
      }
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 2. Manual Login with Email & Password
  const loginManual = async (email: string, pass: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await signInWithEmailAndPassword(auth, email.trim(), pass);
      if (res.user) {
        await ensureUserAndTenant(res.user);
      }
    } catch (err: any) {
      console.error('Manual login error:', err);
      let msg = err.message || 'Invalid email or password.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Incorrect email or password. Please verify your credentials or create a new account.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many failed login attempts. Please reset your password or try again later.';
      }
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  // 3. Manual Registration with Email & Password
  const registerManual = async (
    email: string,
    pass: string,
    displayName: string,
    workspaceName?: string
  ) => {
    setError(null);
    setLoading(true);
    try {
      const res = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      if (res.user) {
        if (displayName.trim()) {
          await updateProfile(res.user, { displayName: displayName.trim() });
        }
        await ensureUserAndTenant(res.user, workspaceName);
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      let msg = err.message || 'Failed to create account.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'This email is already registered. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please choose at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  // 4. Create New Tenant Workspace
  const createTenant = async (workspaceName: string): Promise<Tenant> => {
    if (!user) throw new Error('You must be signed in to create a workspace.');
    setError(null);

    const tenantId = `tenant-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newTenant: Tenant = {
      id: tenantId,
      name: workspaceName.trim() || 'New Clinic Workspace',
      ownerId: user.uid,
      members: {
        [user.uid]: 'owner',
      },
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'tenants', tenantId), newTenant);

      // Update user current tenant
      await updateDoc(doc(db, 'users', user.uid), {
        currentTenantId: tenantId,
      });

      setTenants((prev) => [newTenant, ...prev]);
      setCurrentTenant(newTenant);
      setUserProfile((prev) => (prev ? { ...prev, currentTenantId: tenantId } : null));

      return newTenant;
    } catch (err: any) {
      console.error('Create tenant error:', err);
      // Local state fallback
      setTenants((prev) => [newTenant, ...prev]);
      setCurrentTenant(newTenant);
      return newTenant;
    }
  };

  // 5. Switch Active Tenant
  const switchTenant = async (tenantId: string) => {
    const target = tenants.find((t) => t.id === tenantId);
    if (!target) return;

    setCurrentTenant(target);
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          currentTenantId: tenantId,
        });
        setUserProfile((prev) => (prev ? { ...prev, currentTenantId: tenantId } : null));
      } catch (err) {
        console.warn('Could not persist active tenant switch:', err);
      }
    }
  };

  // 6. Sign Out
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      setCurrentTenant(null);
      setTenants([]);
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        currentTenant,
        tenants,
        loading,
        error,
        loginWithGoogle,
        loginManual,
        registerManual,
        createTenant,
        switchTenant,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
