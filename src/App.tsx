import { ThemeToggle } from "./theme/ThemeToggle";
import { useTheme } from "./theme/useTheme";

export function App() {
  const { resolved, toggle } = useTheme();
  return (
    <div className="app-shell">
      <ThemeToggle resolved={resolved} onToggle={toggle} />
      <h1>Iceberg Explorer</h1>
      <p>
        Theme system online (current: <strong>{resolved}</strong>). The interactive table view is
        being built step by step.
      </p>
    </div>
  );
}
