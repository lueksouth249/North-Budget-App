import { AlertCircle, Pencil, ReceiptText } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { MonthSwitcher } from "../components/MonthSwitcher";
import { ProgressBar } from "../components/ProgressBar";
import { useAppData } from "../context/AppDataContext";
import { budgetSnapshot } from "../lib/budget";
import { formatCurrency } from "../lib/currency";

export function BudgetPage() {
  const { monthId, setMonthId, buckets, transactions, loading, initializeMonth } = useAppData();
  const navigate = useNavigate();
  const snapshot = budgetSnapshot(buckets, transactions);
  const sections = [...new Set(buckets.map((bucket) => bucket.section))];

  if (loading) return <div className="page"><div className="skeleton hero-skeleton" /><div className="skeleton list-skeleton" /></div>;

  return (
    <div className="page budget-page">
      <MonthSwitcher monthId={monthId} onChange={setMonthId} />
      {!buckets.length ? (
        <section className="empty-card">
          <h2>No budget set for this month</h2>
          <p>Start fresh, copy the previous month, or use the North Budget template.</p>
          <div className="button-stack">
            <button className="primary-button" onClick={() => initializeMonth("previous")}>Copy previous month</button>
            <button className="secondary-button" onClick={() => initializeMonth("template")}>Use default template</button>
            <button className="text-button" onClick={() => initializeMonth("blank")}>Start blank</button>
          </div>
        </section>
      ) : (
        <>
          <section className={`summary-card ${snapshot.remainingCents < 0 ? "over" : ""}`}>
            <div className="summary-heading">
              <span>Monthly budget</span>
              <Link to="/budget/edit" className="icon-button" aria-label="Edit budget"><Pencil /></Link>
            </div>
            <strong className="remaining-number">
              {formatCurrency(Math.abs(snapshot.remainingCents))} {snapshot.remainingCents >= 0 ? "remaining" : "over"}
            </strong>
            <p>{formatCurrency(snapshot.spentCents)} spent of {formatCurrency(snapshot.budgetCents)}</p>
            <ProgressBar spent={snapshot.spentCents} planned={snapshot.budgetCents} />
            <div className="summary-meta"><span>{Math.round(snapshot.percentUsed * 100)}% used</span><span>{snapshot.overBudgetBucketCount} buckets over</span></div>
          </section>

          {snapshot.unassignedCount > 0 && (
            <button className="unassigned-alert" onClick={() => navigate("/transactions?unassigned=1")}>
              <AlertCircle />
              <span><strong>{snapshot.unassignedCount} transactions need review</strong><small>{formatCurrency(snapshot.unassignedCents)} is currently unassigned</small></span>
            </button>
          )}

          {sections.map((section) => (
            <section className="bucket-section" key={section}>
              <h2>{section}</h2>
              <div className="bucket-list">
                {buckets.filter((bucket) => bucket.section === section).sort((a, b) => a.order - b.order).map((bucket) => {
                  const spent = snapshot.byBucket[bucket.id] ?? 0;
                  const remaining = bucket.plannedCents - spent;
                  return (
                    <button key={bucket.id} className="bucket-row" onClick={() => navigate(`/transactions?bucket=${bucket.id}`)}>
                      <div className="bucket-row-top">
                        <span className="bucket-title"><span>{bucket.emoji}</span>{bucket.name}</span>
                        <strong className={remaining < 0 ? "negative" : ""}>{formatCurrency(Math.abs(remaining))} {remaining >= 0 ? "left" : "over"}</strong>
                      </div>
                      <div className="bucket-detail">{formatCurrency(spent)} spent of {formatCurrency(bucket.plannedCents)}</div>
                      <ProgressBar spent={spent} planned={bucket.plannedCents} />
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {!transactions.length && <div className="quiet-empty"><ReceiptText /><span>No spending recorded yet.</span></div>}
        </>
      )}
    </div>
  );
}
