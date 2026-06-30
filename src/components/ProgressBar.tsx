export function ProgressBar({ spent, planned }: { spent: number; planned: number }) {
  const ratio = planned > 0 ? spent / planned : spent > 0 ? 1 : 0;
  const state = ratio >= 1 ? "over" : ratio >= 0.75 ? "warning" : "healthy";
  return (
    <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={Math.max(planned, spent)} aria-valuenow={spent}>
      <div className={`progress-fill ${state}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
    </div>
  );
}
