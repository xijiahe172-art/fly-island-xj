import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import { readDshTurns, type DshTurn } from "./api";
import "./DshPanel.css";

const POLL_MS = 2_000;

function timeAgo(timestamp: number, t: ReturnType<typeof useTranslation>) {
  if (!timestamp) return "";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return t.dsh.justNow;
  if (minutes < 60) return t.dsh.minutesAgo(minutes);
  return t.dsh.hoursAgo(Math.round(minutes / 60));
}

export function DshPanel() {
  const t = useTranslation();
  const [turns, setTurns] = useState<DshTurn[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await readDshTurns(8);
        if (!cancelled) setTurns(next);
      } catch {
        if (!cancelled) setTurns([]);
      }
    };
    void load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="dsh-panel">
      {turns.map((turn, index) => {
        const open = expanded === index;
        const reply = turn.assistant || (index === turns.length - 1 ? t.dsh.thinking : "");
        return (
          <button
            className="dsh-turn"
            type="button"
            key={`${turn.time}-${index}`}
            onClick={() => setExpanded(open ? null : index)}
          >
            <div className="dsh-turn__head">
              <span className="dsh-turn__time">{timeAgo(turn.time, t)}</span>
            </div>
            <div className="dsh-turn__row">
              <span className="dsh-turn__role">{t.dsh.you}</span>
              <span className="dsh-turn__user">{turn.user}</span>
            </div>
            {reply && (
              <div className={`dsh-turn__row dsh-turn__row--reply${open ? " dsh-turn__row--open" : ""}`}>
                <span className="dsh-turn__role dsh-turn__role--me">{t.dsh.pageTitle}</span>
                <span className="dsh-turn__assistant">{reply}</span>
              </div>
            )}
          </button>
        );
      })}
      {turns.length === 0 && <div className="dsh-panel__empty">{t.dsh.emptyMessages}</div>}
    </div>
  );
}
