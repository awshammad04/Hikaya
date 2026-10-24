import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  accountApi,
  AccountError,
  AccountUser,
  clearAccountDataFromDevice,
  deviceOwner,
  flushProgress,
  guestIdentity,
  GuestIdentity,
  markDeviceOwner,
  MergeSummary,
  setSignedIn,
  syncAccount,
} from "../services/accountSync";

type AuthStatus = "loading" | "guest" | "signed-in";

interface AuthContextValue {
  status: AuthStatus;
  user: AccountUser | null;
  guest: GuestIdentity;
  /** False when the API is unreachable: the app runs in guest mode only. */
  accountsAvailable: boolean;
  syncing: boolean;
  /** What a sign-in brought over from the guest journey, until dismissed. */
  lastMerge: MergeSummary | null;
  dismissMerge: () => void;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AccountUser | null>(null);
  const [guest] = useState(guestIdentity);
  const [accountsAvailable, setAccountsAvailable] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastMerge, setLastMerge] = useState<MergeSummary | null>(null);

  const startSession = useCallback(async (signedInUser: AccountUser, announce: boolean) => {
    // Another account's leftover copy must not be merged into this one.
    const owner = deviceOwner();
    if (owner && owner !== signedInUser.id) clearAccountDataFromDevice();
    markDeviceOwner(signedInUser.id);
    setSignedIn(true);
    setUser(signedInUser);
    setStatus("signed-in");
    setSyncing(true);
    try {
      const summary = await syncAccount();
      if (announce) setLastMerge(summary);
    } catch {
      // The device copy stays usable; the next load retries the merge.
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    accountApi.me()
      .then(({ user: current }) => {
        if (cancelled) return;
        if (current) void startSession(current, false);
        else {
          // The session ended elsewhere (expired, signed out, deleted). Its data
          // is safe in the account, so the device goes back to a clean guest.
          if (deviceOwner()) clearAccountDataFromDevice();
          setStatus("guest");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setAccountsAvailable(false);
        setStatus("guest");
      });
    return () => { cancelled = true; };
  }, [startSession]);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { user: created } = await accountApi.signUp(name, email, password);
    await startSession(created, true);
  }, [startSession]);

  const logIn = useCallback(async (email: string, password: string) => {
    const { user: current } = await accountApi.logIn(email, password);
    await startSession(current, true);
  }, [startSession]);

  const endSession = useCallback(() => {
    setSignedIn(false);
    clearAccountDataFromDevice();
    setUser(null);
    setLastMerge(null);
    setStatus("guest");
  }, []);

  const logOut = useCallback(async () => {
    await flushProgress();
    await accountApi.logOut().catch(() => undefined);
    endSession();
  }, [endSession]);

  const deleteAccount = useCallback(async (password: string) => {
    await accountApi.deleteAccount(password);
    endSession();
  }, [endSession]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    guest,
    accountsAvailable,
    syncing,
    lastMerge,
    dismissMerge: () => setLastMerge(null),
    signUp,
    logIn,
    logOut,
    deleteAccount,
  }), [status, user, guest, accountsAvailable, syncing, lastMerge, signUp, logIn, logOut, deleteAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export { AccountError };
