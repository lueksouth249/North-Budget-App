import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MonthSwitcher } from "../components/MonthSwitcher";
import { useAppData } from "../context/AppDataContext";
import { formatCurrency } from "../lib/currency";
import { formatShortDate } from "../lib/dates";

export function TransactionsPage() {
  const { monthId, setMonthId, transactions, buckets } = useAppData();
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [bucketFilter, setBucketFilter] = useState(params.get("bucket") ?? (params.get("unassigned") ? "unassigned" : ""));
  const [source, setSource] = useState("");
  const navigate = useNavigate();
  const bucketMap = new Map(buckets.map((bucket) => [bucket.id, bucket]));
  const filtered = useMemo(() => transactions.filter((transaction) => {
    const matchesSearch = !search || `${transaction.displayMerchant} ${transaction.rawDescription}`.toLowerCase().includes(search.toLowerCase());
    const matchesBucket = !bucketFilter || transaction.allocations.some((allocation) => (allocation.bucketId ?? "unassigned") === bucketFilter);
    const matchesSource = !source || transaction.source === source;
    return matchesSearch && matchesBucket && matchesSource;
  }), [transactions, search, bucketFilter, source]);
  const grouped = filtered.reduce<Record<string, typeof filtered>>((groups, transaction) => {
    (groups[transaction.postDate] ??= []).push(transaction);
    return groups;
  }, {});

  return (
    <div className="page transactions-page">
      <MonthSwitcher monthId={monthId} onChange={setMonthId} />
      <div className="search-field"><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search merchants" /></div>
      <details className="filter-panel">
        <summary><SlidersHorizontal /> Filters</summary>
        <div className="filter-grid">
          <label>Bucket<select value={bucketFilter} onChange={(e) => setBucketFilter(e.target.value)}><option value="">All buckets</option><option value="unassigned">Unassigned</option>{buckets.map((bucket) => <option key={bucket.id} value={bucket.id}>{bucket.emoji} {bucket.name}</option>)}</select></label>
          <label>Source<select value={source} onChange={(e) => setSource(e.target.value)}><option value="">All sources</option><option value="manual">Manual</option><option value="uccu-xls">UCCU Excel</option><option value="uccu-screenshot">UCCU screenshot</option></select></label>
          <button className="text-button" onClick={() => { setSearch(""); setBucketFilter(""); setSource(""); }}>Clear filters</button>
        </div>
      </details>
      {!filtered.length ? <section className="empty-card"><h2>No transactions found</h2><p>Try another filter or add a transaction.</p></section> : Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([date, items]) => (
        <section className="transaction-day" key={date}>
          <h2>{formatShortDate(date)}</h2>
          <div className="transaction-list">
            {items.map((transaction) => {
              const allocationLabels = transaction.allocations.map((allocation) => allocation.bucketId ? `${bucketMap.get(allocation.bucketId)?.emoji ?? ""} ${bucketMap.get(allocation.bucketId)?.name ?? "Deleted bucket"}` : "Unassigned");
              return (
                <button className="transaction-row" key={transaction.id} onClick={() => navigate(`/transactions/${transaction.id}`)}>
                  <div><strong>{transaction.displayMerchant}</strong><small>{transaction.allocations.length > 1 ? `Split · ${allocationLabels.join(", ")}` : allocationLabels[0]}</small></div>
                  <div className="transaction-amount"><strong>{formatCurrency(transaction.amountCents)}</strong><small>{transaction.source.replace("uccu-", "")}</small></div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
