import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonth, shiftMonth } from "../lib/dates";

export function MonthSwitcher({ monthId, onChange }: { monthId: string; onChange: (monthId: string) => void }) {
  return (
    <div className="month-switcher">
      <button className="icon-button" aria-label="Previous month" onClick={() => onChange(shiftMonth(monthId, -1))}><ChevronLeft /></button>
      <label className="month-label">
        <span>{formatMonth(monthId)}</span>
        <input type="month" value={monthId} onChange={(event) => onChange(event.target.value)} aria-label="Choose month" />
      </label>
      <button className="icon-button" aria-label="Next month" onClick={() => onChange(shiftMonth(monthId, 1))}><ChevronRight /></button>
    </div>
  );
}
