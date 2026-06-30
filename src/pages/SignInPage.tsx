import { WalletCards } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { StatusMessage } from "../components/StatusMessage";

export function SignInPage() {
  const { signIn, accessError, isDemo } = useAuth();
  return (
    <main className="signin-page">
      <section className="signin-card">
        <div className="signin-icon"><WalletCards /></div>
        <h1>North Budget</h1>
        <p>A simple shared spending budget for Luke and Kimmi.</p>
        {accessError && <StatusMessage tone="error">{accessError}</StatusMessage>}
        {isDemo && <StatusMessage tone="warning">Firebase is not configured. Sign in below to use a local demo on this device.</StatusMessage>}
        <button className="primary-button wide" onClick={signIn}>{isDemo ? "Open local demo" : "Continue with Google"}</button>
        <small>Only the two approved Google accounts can access the shared household.</small>
      </section>
    </main>
  );
}
