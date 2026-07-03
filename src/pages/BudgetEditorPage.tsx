import { ArrowDown, ArrowLeft, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";
import { dollarsToCents, centsToInput, formatCurrency } from "../lib/currency";
import { monthlyBudgetTotal } from "../lib/budget";
import type { Bucket } from "../types/models";

const SECTION_ORDER = [
  "Spending",
  "Bills & Subscriptions"
];

export function BudgetEditorPage() {
  const { buckets, transactions, saveBuckets, saveAsTemplate, saveOneTransaction } = useAppData();
  const [draft, setDraft] = useState<Bucket[]>(structuredClone(buckets));
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const sections = [...new Set([...draft.map((bucket) => bucket.section), "Spending", "Bills & Subscriptions"])].sort((a, b) => sectionRank(a) - sectionRank(b) || a.localeCompare(b));

  const update = (id: string, patch: Partial<Bucket>) => setDraft((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const move = (bucket: Bucket, delta: number) => {
    const siblings = draft.filter((item) => item.section === bucket.section).sort((a, b) => a.order - b.order);
    const index = siblings.findIndex((item) => item.id === bucket.id);
    const target = siblings[index + delta];
    if (!target) return;
    setDraft((items) => items.map((item) => item.id === bucket.id ? { ...item, order: target.order } : item.id === target.id ? { ...item, order: bucket.order } : item));
  };
  const remove = async (bucket: Bucket) => {
    const affected = transactions.filter((tx) => tx.allocations.some((allocation) => allocation.bucketId === bucket.id));
    if (affected.length && !confirm(`${affected.length} transactions use ${bucket.name}. Move those allocations to Unassigned and delete the bucket?`)) return;
    if (affected.length) {
      for (const transaction of affected) {
        await saveOneTransaction({ ...transaction, allocations: transaction.allocations.map((allocation) => allocation.bucketId === bucket.id ? { ...allocation, bucketId: null } : allocation) }, { skipLearning: true });
      }
    } else if (!confirm(`Delete ${bucket.name}?`)) return;
    setDraft((items) => items.filter((item) => item.id !== bucket.id));
  };
  const add = (section: string) => setDraft((items) => [...items, {
    id: crypto.randomUUID(), name: "New bucket", emoji: "💵", section,
    order: items.filter((item) => item.section === section).length, plannedCents: 0
  }]);
  const save = async () => {
    setSaving(true);
    try { await saveBuckets(draft); navigate("/"); } finally { setSaving(false); }
  };

  return (
    <div className="page editor-page budget-editor">
      <button className="back-button" onClick={() => navigate(-1)}><ArrowLeft /> Back</button>
      <section className="page-heading"><h1>Edit monthly budget</h1><p>Total updates automatically. Each month remains independent.</p></section>
      <section className="budget-total-banner"><span>Monthly budget</span><strong>{formatCurrency(monthlyBudgetTotal(draft))}</strong></section>
      {sections.map((section) => (
        <section className="editable-section" key={section}>
          <div className="section-heading"><h2>{section}</h2><button className="secondary-button compact" onClick={() => add(section)}><Plus /> Add</button></div>
          {draft.filter((bucket) => bucket.section === section).sort((a, b) => a.order - b.order).map((bucket) => (
            <div className="editable-bucket" key={bucket.id}>
              <input className="emoji-input" value={bucket.emoji} onChange={(e) => update(bucket.id, { emoji: e.target.value })} aria-label="Bucket emoji" />
              <input value={bucket.name} onChange={(e) => update(bucket.id, { name: e.target.value })} aria-label="Bucket name" />
              <input className="money-input" type="number" inputMode="decimal" step="0.01" min="0" value={centsToInput(bucket.plannedCents)} onChange={(e) => { try { update(bucket.id, { plannedCents: Math.max(0, dollarsToCents(e.target.value)) }); } catch { /* keep last valid */ } }} aria-label="Planned amount" />
              <select value={bucket.section} onChange={(e) => update(bucket.id, { section: e.target.value, order: draft.filter((item) => item.section === e.target.value).length })}>{sections.map((name) => <option key={name}>{name}</option>)}</select>
              <div className="reorder-buttons"><button className="icon-button" onClick={() => move(bucket, -1)} aria-label="Move up"><ArrowUp /></button><button className="icon-button" onClick={() => move(bucket, 1)} aria-label="Move down"><ArrowDown /></button><button className="icon-button danger" onClick={() => remove(bucket)} aria-label="Delete bucket"><Trash2 /></button></div>
            </div>
          ))}
        </section>
      ))}
      <div className="editor-actions">
        <button className="secondary-button" onClick={async () => { await saveAsTemplate(); alert("The current month is now your default template."); }}><Save /> Save as default template</button>
        <button className="primary-button" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save budget"}</button>
      </div>
    </div>
  );
}

function sectionRank(section: string) {
  const index = SECTION_ORDER.indexOf(section);
  return index === -1 ? SECTION_ORDER.length : index;
}
