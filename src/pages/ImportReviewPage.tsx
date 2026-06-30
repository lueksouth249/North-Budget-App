import { AlertTriangle, CheckCircle2, ChevronDown, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatusMessage } from "../components/StatusMessage";
import { SplitEditor } from "../components/SplitEditor";
import { useAppData, makeTransaction } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { useImportSession } from "../context/ImportContext";
import { formatCurrency } from "../lib/currency";
import { transactionIsValidSplit } from "../lib/budget";
import type { ParsedTransaction, TransactionAllocation } from "../types/models";

export function ImportReviewPage() {
  const { transactions, summary, updateTransactions, clear } = useImportSession();
  const { buckets, saveManyTransactions } = useAppData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openSplit, setOpenSplit] = useState<string | null>(null);
  const reviewable = transactions.filter((item) => item.duplicateState !== "duplicate");
  const included = reviewable.filter((item) => !item.excluded);
  const total = included.reduce((sum, item) => sum + item.amountCents, 0);
  const categorized = included.filter((item) => item.allocations.every((allocation) => allocation.bucketId)).length;
  const unassigned = included.length - categorized;
  const invalid = included.filter((item) => !transactionIsValidSplit(item.amountCents, item.allocations));

  const update = (tempId: string, patch: Partial<ParsedTransaction>) => updateTransactions(transactions.map((item) => item.tempId === tempId ? { ...item, ...patch } : item));
  const setBucket = (item: ParsedTransaction, bucketId: string | null) => update(item.tempId, { allocations: [{ bucketId, amountCents: item.amountCents }] });
  const highConfidence = useMemo(() => reviewable.filter((item) => item.suggestion?.bucketId && (item.suggestion.confidence ?? 0) >= 0.8), [reviewable]);

  const applyToSelected = (bucketId: string | null) => {
    updateTransactions(transactions.map((item) => selected.has(item.tempId)
      ? { ...item, allocations: [{ bucketId, amountCents: item.amountCents }], excluded: false }
      : item));
  };

  const save = async () => {
    if (!user) return;
    if (invalid.length) return setError("Fix the split totals before saving.");
    setSaving(true); setError(null);
    try {
      const items = included.map((item) => makeTransaction({
        postDate: item.postDate,
        rawDescription: item.rawDescription,
        normalizedMerchant: item.normalizedMerchant,
        displayMerchant: item.displayMerchant,
        amountCents: item.amountCents,
        runningBalanceCents: item.runningBalanceCents,
        source: item.source,
        sourceFingerprint: item.sourceFingerprint,
        allocations: item.allocations,
        user
      }));
      await saveManyTransactions(items, { feedbackKind: "accepted" });
      clear();
      navigate("/transactions");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The transactions could not be saved.");
    } finally { setSaving(false); }
  };

  if (!transactions.length) return <div className="page"><section className="empty-card"><h2>No import waiting for review</h2><button className="primary-button" onClick={() => navigate("/add")}>Return to Add</button></section></div>;

  return (
    <div className="page import-review-page">
      <section className="page-heading"><h1>Review import</h1><p>North Budget assigned as much as it could from your rules and past choices. Confirm before saving.</p></section>
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      <section className="import-summary-card">
        <div><strong>{summary.rowsRead}</strong><span>rows read</span></div>
        <div><strong>{summary.duplicatesSkipped}</strong><span>duplicates skipped</span></div>
        <div><strong>{summary.positiveIgnored}</strong><span>positive ignored</span></div>
        <div><strong>{summary.incompleteSkipped}</strong><span>incomplete skipped</span></div>
      </section>
      {summary.possibleDuplicates > 0 && <StatusMessage tone="warning">{summary.possibleDuplicates} possible duplicates need extra attention.</StatusMessage>}
      <div className="review-tools">
        <button className="secondary-button" onClick={() => updateTransactions(transactions.map((item) => item.suggestion?.bucketId && (item.suggestion.confidence ?? 0) >= 0.8 ? { ...item, allocations: [{ bucketId: item.suggestion.bucketId, amountCents: item.amountCents }] } : item))}><Sparkles /> Accept {highConfidence.length} high-confidence matches</button>
        <button className="text-button" onClick={() => setSelected(new Set(reviewable.map((item) => item.tempId)))}>Select all</button>
        <button className="text-button" onClick={() => setSelected(new Set())}>Clear</button>
      </div>
      {selected.size > 0 && <div className="batch-bar"><span>{selected.size} selected</span><select defaultValue="" onChange={(event) => { if (event.target.value === "exclude") updateTransactions(transactions.map((item) => selected.has(item.tempId) ? { ...item, excluded: true } : item)); else applyToSelected(event.target.value || null); event.currentTarget.value = ""; }}><option value="">Apply action…</option><option value="">Set Unassigned</option>{buckets.map((bucket) => <option value={bucket.id} key={bucket.id}>{bucket.emoji} {bucket.name}</option>)}<option value="exclude">Exclude</option></select></div>}

      <div className="review-list">
        {reviewable.map((item) => {
          const suggestedBucket = buckets.find((bucket) => bucket.id === item.suggestion?.bucketId);
          return (
            <article className={`review-card ${item.excluded ? "excluded" : ""} ${item.duplicateState === "possible" ? "possible-duplicate" : ""}`} key={item.tempId}>
              <div className="review-card-head">
                <input type="checkbox" checked={selected.has(item.tempId)} onChange={(event) => setSelected((current) => { const next = new Set(current); event.target.checked ? next.add(item.tempId) : next.delete(item.tempId); return next; })} aria-label={`Select ${item.displayMerchant}`} />
                <div><strong>{item.displayMerchant}</strong><small>{item.postDate} · {item.source.replace("uccu-", "")}</small></div>
                <strong>{formatCurrency(item.amountCents)}</strong>
              </div>
              {item.duplicateState === "possible" && <div className="inline-warning"><AlertTriangle /> Possible duplicate—review before saving.</div>}
              <details><summary>Raw description <ChevronDown /></summary><p className="raw-description">{item.rawDescription}</p></details>
              {item.suggestion?.bucketId && (
                <div className="suggestion-note"><Sparkles /><span><strong>{suggestedBucket?.emoji} {suggestedBucket?.name}</strong><small>{item.suggestion.reason} · {Math.round(item.suggestion.confidence * 100)}%</small></span></div>
              )}
              {openSplit === item.tempId ? (
                <SplitEditor amountCents={item.amountCents} allocations={item.allocations} buckets={buckets} onChange={(allocations) => update(item.tempId, { allocations })} />
              ) : (
                <label>Bucket<select value={item.allocations[0]?.bucketId ?? ""} disabled={item.excluded} onChange={(event) => setBucket(item, event.target.value || null)}><option value="">Unassigned</option>{buckets.map((bucket) => <option key={bucket.id} value={bucket.id}>{bucket.emoji} {bucket.name}</option>)}</select></label>
              )}
              <div className="review-actions">
                <button className="text-button" disabled={item.excluded} onClick={() => setOpenSplit(openSplit === item.tempId ? null : item.tempId)}>{openSplit === item.tempId ? "Use one bucket" : "Split"}</button>
                <button className="text-button" onClick={() => update(item.tempId, { excluded: !item.excluded })}>{item.excluded ? "Include" : "Exclude"}</button>
              </div>
            </article>
          );
        })}
      </div>
      <section className="sticky-save-panel">
        <div><strong>{included.length} transactions · {formatCurrency(total)}</strong><span>{categorized} categorized · {unassigned} unassigned</span></div>
        <button className="primary-button" disabled={saving || !included.length || invalid.length > 0} onClick={save}>{saving ? "Saving…" : "Save import"}</button>
      </section>
      {included.length > 0 && unassigned === 0 && <div className="all-set"><CheckCircle2 /> Everything is categorized.</div>}
    </div>
  );
}
