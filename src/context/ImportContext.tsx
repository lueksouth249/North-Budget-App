import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { ImportSummary, ParsedTransaction } from "../types/models";

interface ImportSession {
  transactions: ParsedTransaction[];
  summary: ImportSummary;
  setImport: (transactions: ParsedTransaction[], summary: ImportSummary) => void;
  updateTransactions: (transactions: ParsedTransaction[]) => void;
  clear: () => void;
}

const ImportContext = createContext<ImportSession | null>(null);
const emptySummary: ImportSummary = { rowsRead: 0, positiveIgnored: 0, incompleteSkipped: 0, duplicatesSkipped: 0, possibleDuplicates: 0, newDebits: 0 };

export function ImportProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [summary, setSummary] = useState<ImportSummary>(emptySummary);
  const value = useMemo<ImportSession>(() => ({
    transactions,
    summary,
    setImport: (items, nextSummary) => { setTransactions(items); setSummary(nextSummary); },
    updateTransactions: setTransactions,
    clear: () => { setTransactions([]); setSummary(emptySummary); }
  }), [transactions, summary]);
  return <ImportContext.Provider value={value}>{children}</ImportContext.Provider>;
}

export function useImportSession(): ImportSession {
  const value = useContext(ImportContext);
  if (!value) throw new Error("useImportSession must be used inside ImportProvider");
  return value;
}
