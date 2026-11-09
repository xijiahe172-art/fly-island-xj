import type { WheelEvent } from "react";
import { useTranslation } from "../../i18n";
import { getDisplayDateParts } from "../../utils/date";
import { formatElapsed } from "../../utils/duration";
import type { ArchiveLayout, TodoArchive, TodoItem } from "./types";
import "./ArchiveBrowser.css";

function summarize(todos: TodoItem[]) {
  let done = 0;
  let spent = 0;
  for (const todo of todos) {
    if (todo.completed) {
      done += 1;
    }
    if (typeof todo.spentMs === "number") {
      spent += todo.spentMs;
    } else if (!todo.completed && typeof todo.startedAt === "number") {
      spent += Date.now() - todo.startedAt;
    }
  }
  return { created: todos.length, done, spent };
}

export function ArchiveBrowser({
  archives,
  layout,
  onSelectArchive,
}: {
  archives: TodoArchive[];
  layout: ArchiveLayout;
  onSelectArchive: (date: string) => void;
}) {
  const t = useTranslation();
  const handleHorizontalWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (layout !== "cards") {
      return;
    }

    event.preventDefault();
    event.currentTarget.scrollLeft += event.deltaY + event.deltaX;
  };

  if (archives.length === 0) {
    return <div className="todo-empty">{t.archive.noSavedLists}</div>;
  }

  const totals = archives.reduce(
    (acc, archive) => {
      const stats = summarize(archive.todos);
      return {
        days: acc.days + 1,
        created: acc.created + stats.created,
        done: acc.done + stats.done,
        spent: acc.spent + stats.spent,
      };
    },
    { days: 0, created: 0, done: 0, spent: 0 },
  );

  const summary = (
    <div className="archive-summary" role="status">
      <span className="archive-summary__item">
        {t.archive.summaryDays(totals.days)}
      </span>
      <span className="archive-summary__item">
        {t.archive.summaryDone(totals.done, totals.created)}
      </span>
      <span className="archive-summary__item">
        {t.archive.summaryTime(formatElapsed(totals.spent))}
      </span>
    </div>
  );

  if (layout === "timeline") {
    return (
      <>
        {summary}
        <div className="archive-timeline" role="list">
          {archives.map((archive) => {
            const stats = summarize(archive.todos);
            return (
              <button
                className="archive-timeline__item"
                key={archive.date}
                type="button"
                role="listitem"
                onClick={() => onSelectArchive(archive.date)}
              >
                <span className="archive-timeline__dot" />
                <span>{archive.date}</span>
                <em className="archive-timeline__stats">
                  {t.archive.cardStats(stats.done, stats.created, formatElapsed(stats.spent))}
                </em>
              </button>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <>
      {summary}
      <div className="archive-cards" role="list" onWheel={handleHorizontalWheel}>
        {archives.map((archive) => {
          const previewTodos = archive.todos.slice(0, 3);
          const dateParts = getDisplayDateParts(archive.date, t);
          const stats = summarize(archive.todos);

          return (
            <button
              className="archive-card"
              key={archive.date}
              type="button"
              role="listitem"
              onClick={() => onSelectArchive(archive.date)}
            >
              <span className="archive-card__eyebrow">{t.archive.eyebrow}</span>
              <strong className="archive-card__date">
                <span>{dateParts.year}</span>
                <span>
                  {dateParts.month}
                  <em>/</em>
                  {dateParts.day}
                </span>
              </strong>
              <span className="archive-card__stats">
                {t.archive.cardStats(stats.done, stats.created, formatElapsed(stats.spent))}
              </span>
              <span className="archive-card__preview">
                {previewTodos.length > 0 ? (
                  previewTodos.map((todo) => (
                    <span className="archive-card__todo" key={todo.id}>
                      <span
                        className={[
                          "archive-card__todo-mark",
                          todo.completed ? "archive-card__todo-mark--done" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      />
                      <span>{todo.title}</span>
                    </span>
                  ))
                ) : (
                  <span className="archive-card__empty">{t.archive.noTasks}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
