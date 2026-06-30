import { ArrowLeft, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SplitEditor } from "../components/SplitEditor";
import { StatusMessage } from "../components/StatusMessage";
import { useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { transactionIsValidSplit } from "../lib/budget";
import { centsToInput, dollarsToCents, formatCurrency } from "../lib/currency";
import { normalizeMerchant } from "../lib/merchant";
import type { TransactionAllocation } from "../types/models";

export function TransactionEditorPage() {
  const { id } = useParams();
  const { transactions, buckets, saveOneTransaction, removeTransaction } = useAppData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const transaction = transactions.find((item) => item.id === id);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [allocations, setAllocations] = useState<TransactionAllocation[]>([]);
  const [split, setSplit] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!transaction) return;
    setDescription(transaction.rawDescription);
    setDate(transaction.postDate);
    setAmount(centsToInput(transaction.amountCents));
    setNote(transaction.note ?? "");
    setAllocations(structuredClone(transaction.allocations));
    setSplit(transaction.allocations.length > 1);
  }, [transaction]);
  const amountCents = useMemo(() => { try { return Math.abs(dollarsToCents(amount)); } catch { return 0; } }, [amount]);

  if (!transaction) return <div className="page"><section className="empty-card"><h2>Transaction not found</h2><button className="primary-button" onClick={() => navigate("/transactions")}>Back to transactions</button></section></div>;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const finalAllocations = split ? allocations : [{ bucketId: allocations[0]?.bucketId ?? null, amountCents }];
    if (!transactionIsValidSplit(amountCents, finalAllocations)) return setMessage("The bucket allocations must exactly equal the transaction amount.");
    const merchant = normalizeMerchant(description);
    await saveOneTransaction({
      ...transaction,
      postDate: date,
      rawDescription: description,
      ...merchant,
      amountCents,
      allocations: finalAllocations,
      note,
      updatedByUid: user.uid
    }, { feedbackKind: "corrected" });
    navigate("/transactions");
  };

  const remove = async () => {
    if (!confirm(`Delete ${transaction.displayMerchant} for ${formatCurrency(transaction.amountCents)}?`)) return;
    await removeTransaction(transaction.id);
    navigate("/transactions");
  };

  return (
    <div className="page editor-page">
      <button className="back-button" onClick={() => navigate(-1)}><ArrowLeft /> Back</button>
      <section className="page-heading"><h1>Edit transaction</h1><p>{transaction.source.replace("uccu-", "")} · {transaction.rawDescription}</p></section>
      {message && <StatusMessage tone="error">{message}</StatusMessage>}
      <form className="form-card" onSubmit={save}>
        <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>Merchant or description<input value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <label>Amount<input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        {split ? <SplitEditor amountCents={amountCents} allocations={allocations} buckets={buckets} onChange={setAllocations} /> : (
          <label>Bucket<select value={allocations[0]?.bucketId ?? ""} onChange={(e) => setAllocations([{ bucketId: e.target.value || null, amountCents }])}><option value="">Unassigned</option>{buckets.map((bucket) => <option key={bucket.id} value={bucket.id}>{bucket.emoji} {bucket.name}</option>)}</select></label>
        )}
        <button type="button" className="text-button" onClick={() => {
          const next = !split; setSplit(next);
          setAllocations(next ? [{ bucketId: allocations[0]?.bucketId ?? null, amountCents }] : [{ bucketId: allocations[0]?.bucketId ?? null, amountCents }]);
        }}>{split ? "Use one bucket" : "Split across buckets"}</button>
        <label>Note<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <button className="primary-button wide">Save changes</button>
        <button type="button" className="danger-button wide" onClick={remove}><Trash2 /> Delete transaction</button>
      </form>
    </div>
  );
}
