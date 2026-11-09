import "./ToggleControl.css";

export function ToggleControl({
  label,
  checked,
  onChange,
  accent = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** 用强调色显示标签，便于在一堆设置里一眼看到。 */
  accent?: boolean;
}) {
  return (
    <label className="toggle-control">
      <span className={accent ? "toggle-control__label toggle-control__label--accent" : undefined}>
        {label}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span className="toggle-control__switch" aria-hidden="true" />
    </label>
  );
}
