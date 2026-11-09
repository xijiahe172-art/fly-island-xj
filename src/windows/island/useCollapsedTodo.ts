import { isUpdateTodo } from "../../features/todos/updateTodo";
import { useEffect, useMemo, useState } from "react";
import { formatElapsed } from "../../utils/duration";
import type { IslandSettings } from "../../features/appearance/types";
import type { TodoItem } from "../../features/todos/types";
import { useTranslation } from "../../i18n";
import { getCollapsedIslandWidth } from "./layout";

const MAX_TASK_TITLE_CHARS = 22;
/**
 * What the collapsed island shows for todos: the active (or rotating) todo
 * title, otherwise the pending count, and the width that text needs.
 */
export function useCollapsedTodo(
  todos: TodoItem[],
  activeTodoId: string | null,
  settings: IslandSettings,
  _isRotationPaused: boolean,
) {
  const t = useTranslation();
  const pendingTodoIds = useMemo(
    () => todos.filter((todo) => !todo.completed && !isUpdateTodo(todo)).map((todo) => todo.id),
    [todos],
  );
  // 置顶任务优先级最高：灵动岛先读它，其次是正在计时的任务，最后才是队首
  const pinnedTodoId = useMemo(() => {
    const pinned = todos.find((todo) => todo.pinned && !todo.completed && !isUpdateTodo(todo));
    return pinned?.id ?? null;
  }, [todos]);
  const displayedTodoId =
    pinnedTodoId ??
    (activeTodoId && pendingTodoIds.includes(activeTodoId)
      ? activeTodoId
      : pendingTodoIds[0] ?? null);
  // 有任务在计时时每秒刷新一次，让"解决中 mm:ss"跟着走
  const runningTodo = useMemo(
    () => todos.find((todo) => typeof todo.startedAt === "number" && !todo.completed && !isUpdateTodo(todo)) ?? null,
    [todos],
  );
  const [runningTick, setRunningTick] = useState(() => Date.now());
  useEffect(() => {
    if (!runningTodo) {
      return;
    }

    setRunningTick(Date.now());
    const timer = window.setInterval(() => setRunningTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [runningTodo]);
  const collapsedRunningText = runningTodo
    ? t.island.solving(formatElapsed(runningTick - (runningTodo.startedAt ?? 0) + (runningTodo.spentMs ?? 0)))
    : null;
  const collapsedTaskTitle = useMemo(() => {
    const activeTodo = todos.find(
      (todo) => todo.id === displayedTodoId && !todo.completed,
    );
    const title = activeTodo?.title?.trim();
    if (!title) return null;
    // 固定字符上限，超出用三个点收尾；宽度估算也用截断后的文本
    return title.length > MAX_TASK_TITLE_CHARS
      ? `${title.slice(0, MAX_TASK_TITLE_CHARS)}...`
      : title;
  }, [displayedTodoId, todos]);
  const collapsedTodoCount = settings.showIdleTodoCount
    ? todos.filter((todo) => !todo.completed).length
    : null;
  const collapsedIslandWidth = useMemo(() => {
    const countText = collapsedTodoCount !== null
      ? t.island.pendingTodos(collapsedTodoCount)
      : "";
    const taskText = collapsedRunningText ?? collapsedTaskTitle ?? "";
    const text = settings.showCollapsedText
      ? [countText, taskText].filter(Boolean).join(" ")
      : "";
    // 折叠态品牌名单独渲染，宽度估算需一并计入，否则岛会右溢出被屏幕裁掉。
    const label = settings.showCollapsedText && settings.showTitle
      ? text ? `习嘉禾 · ${text}` : "习嘉禾"
      : text;
    // 品牌名实际渲染宽度略大于 units 估算值，补一点余量避免文字被窗口右缘裁掉。
    return getCollapsedIslandWidth(label) + (settings.showTitle ? 28 : 0);
  }, [collapsedRunningText, collapsedTaskTitle, collapsedTodoCount, settings.showCollapsedText, settings.showTitle, t]);

  return { collapsedTaskTitle, collapsedTodoCount, collapsedRunningText, collapsedIslandWidth };
}
