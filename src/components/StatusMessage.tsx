export function StatusMessage({ tone = "info", children }: { tone?: "info" | "warning" | "error" | "success"; children: React.ReactNode }) {
  return <div className={`status-message ${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}
