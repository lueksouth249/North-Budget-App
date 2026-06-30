import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useAuth } from "./context/AuthContext";
import { AppDataProvider } from "./context/AppDataContext";
import { ImportProvider } from "./context/ImportContext";
import { SignInPage } from "./pages/SignInPage";

const AddPage = lazy(() => import("./pages/AddPage").then((module) => ({ default: module.AddPage })));
const BudgetEditorPage = lazy(() => import("./pages/BudgetEditorPage").then((module) => ({ default: module.BudgetEditorPage })));
const BudgetPage = lazy(() => import("./pages/BudgetPage").then((module) => ({ default: module.BudgetPage })));
const ImportReviewPage = lazy(() => import("./pages/ImportReviewPage").then((module) => ({ default: module.ImportReviewPage })));
const ReportsPage = lazy(() => import("./pages/ReportsPage").then((module) => ({ default: module.ReportsPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const TransactionEditorPage = lazy(() => import("./pages/TransactionEditorPage").then((module) => ({ default: module.TransactionEditorPage })));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage").then((module) => ({ default: module.TransactionsPage })));

function RouteLoading() {
  return <div className="page"><div className="skeleton hero-skeleton" /><div className="skeleton list-skeleton" /></div>;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading"><div className="brand-mark large">N</div><p>Loading North Budget…</p></div>;
  if (!user) return <SignInPage />;
  return (
    <AppDataProvider>
      <ImportProvider>
        <HashRouter>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<BudgetPage />} />
                <Route path="budget/edit" element={<BudgetEditorPage />} />
                <Route path="transactions" element={<TransactionsPage />} />
                <Route path="transactions/:id" element={<TransactionEditorPage />} />
                <Route path="add" element={<AddPage />} />
                <Route path="import/review" element={<ImportReviewPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </HashRouter>
      </ImportProvider>
    </AppDataProvider>
  );
}
