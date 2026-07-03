import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, type ChartOptions } from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { useEffect, useMemo, useState } from "react";
import { MonthSwitcher } from "../components/MonthSwitcher";
import { useAppData } from "../context/AppDataContext";
import { budgetSnapshot } from "../lib/budget";
import { formatCurrency } from "../lib/currency";
import { formatMonth, shiftMonth } from "../lib/dates";
import type { Bucket, BudgetTransaction } from "../types/models";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);

interface MonthReport { monthId: string; buckets: Bucket[]; transactions: BudgetTransaction[]; }

export function ReportsPage() {
  const { monthId, setMonthId, fetchExistingTransactions, fetchBucketsForMonth } = useAppData();
  const [reports, setReports] = useState<MonthReport[]>([]);
  const [loading, setLoading] = useState(true);
  const monthIds = useMemo(() => Array.from({ length: 6 }, (_, index) => shiftMonth(monthId, index - 5)), [monthId]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchExistingTransactions(monthIds),
      Promise.all(monthIds.map((id) => fetchBucketsForMonth(id)))
    ]).then(([transactions, buckets]) => {
      if (cancelled) return;
      setReports(monthIds.map((id, index) => ({ id, monthId: id, buckets: buckets[index], transactions: transactions.filter((tx) => tx.monthId === id) })));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [monthIds.join("|"), fetchExistingTransactions, fetchBucketsForMonth]);

  const current = reports.find((report) => report.monthId === monthId);
  const currentSnapshot = current ? budgetSnapshot(current.buckets, current.transactions) : null;
  const labels = reports.map((report) => formatMonth(report.monthId).replace(/ \d{4}$/, ""));
  const budgetData = reports.map((report) => budgetSnapshot(report.buckets, report.transactions).budgetCents / 100);
  const spentData = reports.map((report) => budgetSnapshot(report.buckets, report.transactions).spentCents / 100);
  const percentageData = reports.map((report) => {
    const snapshot = budgetSnapshot(report.buckets, report.transactions);
    return snapshot.budgetCents ? Math.round(snapshot.percentUsed * 100) : 0;
  });
  const chartOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    }
  };
  const lineOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: string | number) => `${value}%`
        }
      }
    }
  };

  return (
    <div className="page reports-page">
      <MonthSwitcher monthId={monthId} onChange={setMonthId} />
      <section className="page-heading"><h1>Spending reports</h1><p>Current month plus three- and six-month budget trends.</p></section>
      {loading ? <div className="skeleton chart-skeleton" /> : (
        <>
          <section className="report-stat-grid">
            <div><span>Budget</span><strong>{formatCurrency(currentSnapshot?.budgetCents ?? 0)}</strong></div>
            <div><span>Spent</span><strong>{formatCurrency(currentSnapshot?.spentCents ?? 0)}</strong></div>
            <div><span>{(currentSnapshot?.remainingCents ?? 0) >= 0 ? "Remaining" : "Over"}</span><strong className={(currentSnapshot?.remainingCents ?? 0) < 0 ? "negative" : ""}>{formatCurrency(Math.abs(currentSnapshot?.remainingCents ?? 0))}</strong></div>
            <div><span>Unassigned</span><strong>{formatCurrency(currentSnapshot?.unassignedCents ?? 0)}</strong></div>
          </section>
          <section className="chart-card"><h2>Budget vs. spending · 6 months</h2><div className="chart-plot"><Bar data={{ labels, datasets: [{ label: "Budget", data: budgetData, backgroundColor: "#0b5fb3", borderColor: "#0b5fb3" }, { label: "Spent", data: spentData, backgroundColor: "#16855b", borderColor: "#16855b" }] }} options={chartOptions} /></div><div className="chart-legend"><span><i style={{ background: "#0b5fb3" }} />Budget</span><span><i style={{ background: "#16855b" }} />Spent</span></div></section>
          <section className="chart-card"><h2>Budget used · 6 months</h2><div className="chart-plot"><Line data={{ labels, datasets: [{ label: "% used", data: percentageData, borderColor: "#074a8c", backgroundColor: "rgba(11, 95, 179, .16)", pointBackgroundColor: "#074a8c", pointBorderColor: "#074a8c", tension: 0.25 }] }} options={lineOptions} /></div><div className="chart-legend"><span><i style={{ background: "#074a8c" }} />% used</span></div></section>
          <section className="history-list"><h2>Month-by-month</h2>{[...reports].reverse().map((report) => {
            const snapshot = budgetSnapshot(report.buckets, report.transactions);
            const noBudget = snapshot.budgetCents === 0;
            return <div className="history-row" key={report.monthId}><div><strong>{formatMonth(report.monthId)}</strong><small>{noBudget ? "No budget set" : `${Math.round(snapshot.percentUsed * 100)}% used`}</small></div><div><strong>{formatCurrency(snapshot.spentCents)} spent</strong><small className={!noBudget && snapshot.remainingCents < 0 ? "negative" : ""}>{noBudget ? "" : `${formatCurrency(Math.abs(snapshot.remainingCents))} ${snapshot.remainingCents >= 0 ? "left" : "over"}`}</small></div></div>;
          })}</section>
        </>
      )}
    </div>
  );
}
