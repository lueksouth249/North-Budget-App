import type { Bucket, TransactionAllocation } from "../types/models";
import { centsToInput, dollarsToCents, formatCurrency } from "../lib/currency";
import { Plus, Trash2 } from "lucide-react";

export function SplitEditor({ amountCents, allocations, buckets, onChange }: {
  amountCents: number;
  allocations: TransactionAllocation[];
  buckets: Bucket[];
  onChange: (allocations: TransactionAllocation[]) => void;
}) {
  const allocated = allocations.reduce((sum, item) => sum + item.amountCents, 0);
  const remaining = amountCents - allocated;
  const update = (index: number, patch: Partial<TransactionAllocation>) => {
    onChange(allocations.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };
  return (
    <div className="split-editor">
      {allocations.map((allocation, index) => (
        <div className="split-row" key={`${index}-${allocation.bucketId}`}>
          <select value={allocation.bucketId ?? ""} onChange={(event) => update(index, { bucketId: event.target.value || null })}>
            <option value="">Unassigned</option>
            {buckets.map((bucket) => <option key={bucket.id} value={bucket.id}>{bucket.emoji} {bucket.name}</option>)}
          </select>
          <input type="number" inputMode="decimal" step="0.01" min="0" value={centsToInput(allocation.amountCents)} onChange={(event) => {
            try { update(index, { amountCents: dollarsToCents(event.target.value) }); } catch { update(index, { amountCents: 0 }); }
          }} aria-label={`Split amount ${index + 1}`} />
          {allocations.length > 1 && <button className="icon-button danger" onClick={() => onChange(allocations.filter((_, i) => i !== index))} aria-label="Remove split"><Trash2 /></button>}
        </div>
      ))}
      <button type="button" className="secondary-button" onClick={() => onChange([...allocations, { bucketId: null, amountCents: Math.max(0, remaining) }])}><Plus /> Add split</button>
      <div className={remaining === 0 ? "allocation-total valid" : "allocation-total invalid"}>
        {remaining === 0 ? "Fully allocated" : `${formatCurrency(Math.abs(remaining))} ${remaining > 0 ? "left to allocate" : "over-allocated"}`}
      </div>
    </div>
  );
}
