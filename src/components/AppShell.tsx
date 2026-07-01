import {
  BarChart3,
  CircleDollarSign,
  List,
  Plus,
  Settings
} from "lucide-react";
import {
  NavLink,
  Outlet
} from "react-router-dom";
import { useAppData } from "../context/AppDataContext";

const links = [
  {
    to: "/",
    label: "Budget",
    icon: CircleDollarSign
  },
  {
    to: "/transactions",
    label: "Transactions",
    icon: List
  },
  {
    to: "/add",
    label: "Add",
    icon: Plus
  },
  {
    to: "/reports",
    label: "Reports",
    icon: BarChart3
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings
  }
];

export function AppShell() {
  const { syncing } = useAppData();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          N
        </div>

        <div>
          <strong>
            North&apos;s Budget App
          </strong>

          {syncing && (
            <small>Saving…</small>
          )}
        </div>
      </header>

      <main className="main-content">
        <Outlet />
      </main>

      <nav
        className="bottom-nav"
        aria-label="Primary"
      >
        {links.map(
          ({
            to,
            label,
            icon: Icon
          }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({
                isActive
              }) =>
                isActive
                  ? "active"
                  : ""
              }
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          )
        )}
      </nav>
    </div>
  );
}