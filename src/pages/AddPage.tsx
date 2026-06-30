import { FileSpreadsheet, ImagePlus, PlusCircle, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatusMessage } from "../components/StatusMessage";
import { SplitEditor } from "../components/SplitEditor";
import { useAppData, makeTransaction } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { useImportSession } from "../context/ImportContext";
import { parseUccuWorkbook } from "../features/imports/excelParser";
import { parseUccuScreenshots } from "../features/imports/ocrParser";
import { prepareImportedTransactions } from "../features/imports/prepareImport";
import { dollarsToCents, formatCurrency } from "../lib/currency";
import { monthIdFromDate, todayIso } from "../lib/dates";
import { normalizeMerchant } from "../lib/merchant";
import { getCategorySuggestion } from "../lib/rules";
import { transactionIsValidSplit } from "../lib/budget";
import type { TransactionAllocation } from "../types/models";

export function AddPage() {
  const { user } = useAuth();
  const { buckets, rules, profiles, saveOneTransaction, fetchExistingTransactions } = useAppData();
  const { setImport } = useImportSession();
  const navigate = useNavigate();
  const [date, setDate] = useState(todayIso());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [bucketId, setBucketId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [split, setSplit] = useState(false);
  const [allocations, setAllocations] = useState<TransactionAllocation[]>([{ bucketId: null, amountCents: 0 }]);
  const [message, setMessage] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(null);
  const [working, setWorking] = useState(false);
  const [ocrProgress, setOcrProgress] = useState("");

  const amountCents = useMemo(() => { try { return amount ? Math.abs(dollarsToCents(amount)) : 0; } catch { return 0; } }, [amount]);
  const merchant = useMemo(() => normalizeMerchant(description), [description]);
  const suggestion = useMemo(() => description && amountCents > 0
    ? getCategorySuggestion({ merchantKey: merchant.normalizedMerchant, amountCents, rules, profiles })
    : null, [description, amountCents, merchant.normalizedMerchant, rules, profiles]);

  const applySuggestion = () => {
    if (suggestion?.bucketId) {
      setBucketId(suggestion.bucketId);
      setAllocations([{ bucketId: suggestion.bucketId, amountCents }]);
    }
  };

  const submitManual = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!description.trim() || amountCents <= 0) return setMessage({ tone: "error", text: "Enter a merchant and a positive amount." });
    const finalAllocations = split ? allocations : [{ bucketId, amountCents }];
    if (!transactionIsValidSplit(amountCents, finalAllocations)) return setMessage({ tone: "error", text: "The allocation amounts must exactly match the transaction amount." });
    setWorking(true);
    try {
      const transaction = makeTransaction({
        postDate: date,
        rawDescription: description.trim(),
        ...merchant,
        amountCents,
        allocations: finalAllocations,
        source: "manual",
        note,
        user
      });
      const wasSuggested = Boolean(suggestion?.bucketId && finalAllocations.length === 1 && finalAllocations[0].bucketId === suggestion.bucketId);
      await saveOneTransaction(transaction, { feedbackKind: wasSuggested ? "accepted" : suggestion?.bucketId ? "corrected" : "manual", suggestedBucketId: suggestion?.bucketId });
      setDescription(""); setAmount(""); setBucketId(null); setNote(""); setSplit(false); setAllocations([{ bucketId: null, amountCents: 0 }]);
      setMessage({ tone: "success", text: "Transaction saved. North Budget learned from this assignment." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The transaction could not be saved." });
    } finally { setWorking(false); }
  };

  const processImport = async (files: File[], kind: "excel" | "screenshots") => {
    setWorking(true); setMessage(null); setOcrProgress("");
    try {
      const result = kind === "excel"
        ? await parseUccuWorkbook(files[0])
        : await parseUccuScreenshots(files, (text, progress) => setOcrProgress(`${text} ${Math.round(progress * 100)}%`));
      const monthIds = [...new Set(result.transactions.map((transaction) => monthIdFromDate(transaction.postDate)))];
      const existing = await fetchExistingTransactions(monthIds);
      const prepared = prepareImportedTransactions({ parsed: result.transactions, existing, rules, profiles });
      const duplicates = prepared.filter((item) => item.duplicateState === "duplicate").length;
      const possible = prepared.filter((item) => item.duplicateState === "possible").length;
      setImport(prepared, {
        ...result.summary,
        duplicatesSkipped: result.summary.duplicatesSkipped + duplicates,
        possibleDuplicates: possible,
        newDebits: prepared.filter((item) => item.duplicateState !== "duplicate").length
      });
      navigate("/import/review");
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The import failed." });
    } finally { setWorking(false); setOcrProgress(""); }
  };

  return (
    <div className="page add-page">
      <section className="page-heading"><h1>Add spending</h1><p>Record one transaction or import from UCCU.</p></section>
      {message && <StatusMessage tone={message.tone}>{message.text}</StatusMessage>}
      <section className="form-card">
        <div className="section-title"><PlusCircle /><div><h2>Manual transaction</h2><p>North Budget learns every time you confirm a category.</p></div></div>
        <form onSubmit={submitManual}>
          <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
          <label>Merchant or description<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Chick-fil-A" required /></label>
          <label>Amount<input type="number" inputMode="decimal" step="0.01" min="0.01" value={amount} onChange={(e) => {
            setAmount(e.target.value);
            const cents = (() => { try { return Math.abs(dollarsToCents(e.target.value)); } catch { return 0; } })();
            if (split) setAllocations((items) => items.length === 1 ? [{ ...items[0], amountCents: cents }] : items);
          }} placeholder="0.00" required /></label>
          {suggestion?.bucketId && (
            <button type="button" className="learning-suggestion" onClick={applySuggestion}>
              <Sparkles /><span><strong>Suggested: {buckets.find((b) => b.id === suggestion.bucketId)?.emoji} {buckets.find((b) => b.id === suggestion.bucketId)?.name}</strong><small>{suggestion.reason} · {Math.round(suggestion.confidence * 100)}% confidence</small></span>
            </button>
          )}
          {!split ? (
            <label>Bucket<select value={bucketId ?? ""} onChange={(e) => setBucketId(e.target.value || null)}><option value="">Unassigned</option>{buckets.map((bucket) => <option key={bucket.id} value={bucket.id}>{bucket.emoji} {bucket.name}</option>)}</select></label>
          ) : <SplitEditor amountCents={amountCents} allocations={allocations} buckets={buckets} onChange={setAllocations} />}
          <button type="button" className="text-button" onClick={() => {
            const next = !split; setSplit(next);
            setAllocations(next ? [{ bucketId, amountCents }] : [{ bucketId: null, amountCents: 0 }]);
          }}>{split ? "Use one bucket" : "Split across buckets"}</button>
          <label>Note <span className="optional">optional</span><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></label>
          <button className="primary-button wide" disabled={working}>{working ? "Saving…" : `Save ${amountCents ? formatCurrency(amountCents) : "transaction"}`}</button>
        </form>
      </section>

      <section className="import-grid">
        <label className="import-card">
          <FileSpreadsheet />
          <strong>Import UCCU Excel</strong>
          <span>Use the original .xls export from your computer.</span>
          <input type="file" accept=".xls,.xlsx" disabled={working} onChange={(e) => e.target.files?.[0] && processImport([e.target.files[0]], "excel")} />
        </label>
        <label className="import-card">
          <ImagePlus />
          <strong>Import screenshots</strong>
          <span>Upload up to five UCCU mobile screenshots.</span>
          <input type="file" accept="image/*" multiple disabled={working} onChange={(e) => e.target.files && processImport([...e.target.files].slice(0, 5), "screenshots")} />
        </label>
      </section>
      {ocrProgress && <StatusMessage tone="info">{ocrProgress}</StatusMessage>}
    </div>
  );
}
