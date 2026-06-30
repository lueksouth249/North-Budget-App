import { BrainCircuit, Download, LogOut, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { StatusMessage } from "../components/StatusMessage";
import { useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { centsToInput, dollarsToCents } from "../lib/currency";
import { normalizeMerchant } from "../lib/merchant";
import type { BackupPayload, CategoryRule } from "../types/models";

export function SettingsPage() {
  const { user, signOut, isDemo } = useAuth();
  const { buckets, rules, profiles, saveOneRule, removeRule, rebuildLearning, exportBackup, restoreBackup } = useAppData();
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info" | "warning"; text: string } | null>(null);
  const [merchant, setMerchant] = useState("");
  const [bucketId, setBucketId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addRule = async () => {
    if (!merchant.trim() || !bucketId) return setMessage({ tone: "error", text: "Enter a merchant and choose a bucket." });
    const normalized = normalizeMerchant(merchant).normalizedMerchant;
    let exactAmountCents: number | undefined;
    if (amount.trim()) {
      try { exactAmountCents = Math.abs(dollarsToCents(amount)); } catch { return setMessage({ tone: "error", text: "Enter a valid amount." }); }
    }
    const rule: CategoryRule = {
      id: crypto.randomUUID(),
      merchantKey: normalized,
      matchType: "exact",
      exactAmountCents,
      targetBucketId: bucketId,
      enabled: true,
      priority: exactAmountCents != null ? 100 : 50
    };
    await saveOneRule(rule);
    setMerchant(""); setBucketId(""); setAmount("");
    setMessage({ tone: "success", text: "Categorization rule saved." });
  };

  const downloadBackup = async () => {
    setBusy(true);
    try {
      const payload = await exportBackup();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `north-budget-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage({ tone: "success", text: "Backup downloaded." });
    } catch (error) { setMessage({ tone: "error", text: error instanceof Error ? error.message : "Backup failed." }); }
    finally { setBusy(false); }
  };

  const uploadBackup = async (file: File) => {
    setBusy(true);
    try {
      const payload = JSON.parse(await file.text()) as BackupPayload;
      if (!payload || payload.schemaVersion !== 1 || !payload.bucketsByMonth || !Array.isArray(payload.transactions)) throw new Error("This is not a valid North Budget backup.");
      const overwrite = confirm(`Backup from ${payload.exportedAt ?? "an unknown date"}. Press OK to replace current data, or Cancel to merge it.`);
      await restoreBackup(payload, overwrite);
      setMessage({ tone: "success", text: overwrite ? "Backup restored and current data replaced." : "Backup merged with current data." });
    } catch (error) { setMessage({ tone: "error", text: error instanceof Error ? error.message : "Restore failed." }); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <div className="page settings-page">
      <section className="page-heading"><h1>Settings</h1><p>Learning, rules, backup, and account access.</p></section>
      {message && <StatusMessage tone={message.tone}>{message.text}</StatusMessage>}
      {isDemo && <StatusMessage tone="warning">Local demo mode stores data only in this browser and does not sync. Add Firebase settings before real use.</StatusMessage>}

      <section className="settings-card learning-card">
        <div className="section-title"><BrainCircuit /><div><h2>Automatic categorization</h2><p>North Budget learns from every single-bucket assignment.</p></div></div>
        <p className="settings-copy">An exact merchant match can auto-fill after one manual assignment. When a merchant has been used for multiple buckets, amount patterns, frequency, corrections, and recency help choose the best bucket. Split transactions do not train the learner.</p>
        <div className="learning-stat-grid"><div><strong>{profiles.length}</strong><span>merchants learned</span></div><div><strong>{profiles.reduce((sum, profile) => sum + profile.observations, 0)}</strong><span>confirmed examples</span></div></div>
        <button className="secondary-button" disabled={busy} onClick={async () => { setBusy(true); const count = await rebuildLearning(); setBusy(false); setMessage({ tone: "success", text: `Rebuilt learning profiles for ${count} merchants.` }); }}><RefreshCw /> Rebuild from transaction history</button>
      </section>

      <section className="settings-card">
        <h2>Saved rules</h2>
        <p className="settings-copy">Rules override learned history. Add an amount for tricky merchants such as Venmo.</p>
        <div className="rule-form">
          <input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Merchant, e.g. Venmo" aria-label="Rule merchant" />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Exact amount (optional)" inputMode="decimal" aria-label="Rule amount" />
          <select value={bucketId} onChange={(e) => setBucketId(e.target.value)} aria-label="Rule bucket"><option value="">Choose bucket</option>{buckets.map((bucket) => <option key={bucket.id} value={bucket.id}>{bucket.emoji} {bucket.name}</option>)}</select>
          <button className="primary-button" onClick={addRule}><Plus /> Add rule</button>
        </div>
        <div className="rule-list">
          {rules.length === 0 && <p className="quiet-text">No explicit rules yet. Learned history will still work automatically.</p>}
          {rules.sort((a, b) => b.priority - a.priority).map((rule) => {
            const bucket = buckets.find((item) => item.id === rule.targetBucketId);
            return <div className="rule-row" key={rule.id}><div><strong>{rule.merchantKey}</strong><small>{rule.exactAmountCents != null ? `Exact amount ${centsToInput(rule.exactAmountCents)}` : "Any amount"} → {bucket?.emoji} {bucket?.name ?? rule.targetBucketId}</small></div><button className="icon-button danger" onClick={() => removeRule(rule.id)} aria-label="Delete rule"><Trash2 /></button></div>;
          })}
        </div>
      </section>

      <section className="settings-card">
        <h2>Backup and restore</h2>
        <p className="settings-copy">The backup includes budgets, transactions, rules, and learning profiles. It never includes bank files or screenshots.</p>
        <div className="button-row"><button className="secondary-button" disabled={busy} onClick={downloadBackup}><Download /> Download backup</button><button className="secondary-button" disabled={busy} onClick={() => fileRef.current?.click()}><Upload /> Restore backup</button></div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && uploadBackup(e.target.files[0])} />
      </section>

      <section className="settings-card account-card"><div><strong>{user?.displayName}</strong><small>{user?.email}</small></div><button className="secondary-button" onClick={signOut}><LogOut /> Sign out</button></section>
    </div>
  );
}
