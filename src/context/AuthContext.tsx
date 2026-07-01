import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User
} from "firebase/auth";
import {
  env,
  firebaseConfigured
} from "../config/env";
import {
  auth,
  googleProvider
} from "../lib/firebase";

interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  demo?: boolean;
}

interface AuthValue {
  user: AppUser | null;
  loading: boolean;
  accessError: string | null;
  isDemo: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext =
  createContext<AuthValue | null>(null);

function mapUser(
  user: User
): AppUser {
  return {
    uid: user.uid,
    email:
      user.email?.toLowerCase() ?? "",
    displayName:
      user.displayName ??
      user.email ??
      "North's Budget App User",
    photoURL: user.photoURL
  };
}

export function AuthProvider({
  children
}: {
  children: ReactNode;
}) {
  const [
    user,
    setUser
  ] = useState<AppUser | null>(null);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    accessError,
    setAccessError
  ] = useState<string | null>(null);

  useEffect(() => {
    if (
      !firebaseConfigured ||
      !auth
    ) {
      setLoading(false);
      return;
    }

    const firebaseAuth = auth;

    getRedirectResult(
      firebaseAuth
    ).catch((error: unknown) => {
      setAccessError(
        error instanceof Error
          ? error.message
          : "Google sign-in failed."
      );
    });

    return onAuthStateChanged(
      firebaseAuth,
      async (firebaseUser) => {
        setAccessError(null);

        if (!firebaseUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        const mapped =
          mapUser(firebaseUser);

        const approved =
          firebaseUser.emailVerified &&
          env.approvedEmails.includes(
            mapped.email
          );

        if (!approved) {
          await firebaseSignOut(
            firebaseAuth
          );

          setUser(null);

          setAccessError(
            "This Google account is not approved for North's Budget App."
          );

          setLoading(false);
          return;
        }

        setUser(mapped);
        setLoading(false);
      }
    );
  }, []);

  const value =
    useMemo<AuthValue>(
      () => ({
        user,
        loading,
        accessError,
        isDemo:
          !firebaseConfigured,

        signIn: async () => {
          setAccessError(null);

          if (
            !firebaseConfigured ||
            !auth
          ) {
            setUser({
              uid: "demo-user",
              email:
                "demo@northbudget.local",
              displayName:
                "Demo User",
              demo: true
            });

            return;
          }

          try {
            await signInWithPopup(
              auth,
              googleProvider
            );
          } catch (
            error: unknown
          ) {
            setAccessError(
              error instanceof Error
                ? error.message
                : "Google sign-in failed."
            );
          }
        },

        signOut: async () => {
          if (auth) {
            await firebaseSignOut(auth);
          }

          setUser(null);
        }
      }),
      [
        user,
        loading,
        accessError
      ]
    );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const value =
    useContext(AuthContext);

  if (!value) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return value;
}