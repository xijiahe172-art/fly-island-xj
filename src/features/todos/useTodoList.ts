import { useCallback, useEffect, useState } from "react";
import { createTodoId, loadActiveTodoId, loadTodos, saveActiveTodoId, saveTodos } from "./storage";
import { dismissUpdatePrompt } from "../updater/updaterController";
import { UPDATE_TODO_ID, withoutUpdateTodo } from "./updateTodo";
import { useUpdateTodo } from "./useUpdateTodo";
import type { TodoItem } from "./types";

/** Today's todo items, the input draft and the todo shown on the collapsed island. */
export function useTodoList(onStartTodo: () => void) {
  const [todos, setTodos] = useState<TodoItem[]>(loadTodos);
  useUpdateTodo(todos, setTodos);
  const [draftTodo, setDraftTodo] = useState("");
  const [activeTodoId, setActiveTodoId] = useState<string | null>(
    loadActiveTodoId,
  );

  const addTodo = useCallback(() => {
    const title = draftTodo.trim();

    if (!title) {
      return;
    }

    setTodos((currentTodos) => [
      {
        id: createTodoId(),
        title,
        completed: false,
        createdAt: Date.now(),
      },
      ...currentTodos,
    ]);
    setDraftTodo("");
  }, [draftTodo]);

  const toggleTodo = useCallback((id: string) => {
    setTodos((currentTodos) =>
      currentTodos.map((todo) => {
        if (todo.id !== id) {
          return todo;
        }

        const completed = !todo.completed;
        // 勾选完成即视为结束计时，用时并入累计值
        const spentMs = completed && typeof todo.startedAt === "number"
          ? (todo.spentMs ?? 0) + Math.max(0, Date.now() - todo.startedAt)
          : todo.spentMs;

        return {
          ...todo,
          completed,
          // 勾完就自动取消置顶：否则已完成的条目还带着金色置顶标记，
          // 与"岛只显示未完成"的行为不一致
          pinned: completed ? undefined : todo.pinned,
          startedAt: completed ? undefined : todo.startedAt,
          spentMs: spentMs || undefined,
        };
      }),
    );
    setActiveTodoId((currentId) => (currentId === id ? null : currentId));
  }, []);

  const updateTodoTitle = useCallback((id: string, title: string) => {
    const nextTitle = title.trim();

    if (!nextTitle) {
      return;
    }

    setTodos((currentTodos) =>
      currentTodos.map((todo) =>
        todo.id === id ? { ...todo, title: nextTitle } : todo,
      ),
    );
  }, []);

  const startTodo = useCallback(
    (id: string) => {
      const todo = todos.find((item) => item.id === id);

      if (!todo || todo.completed) {
        return;
      }

      const running = typeof todo.startedAt === "number";

      // 同一时间只允许一个计时：开始新的会结算并停掉旧的；
      // 再点正在计时的那条 = 结束它，累计时间不清零。
      setTodos((currentTodos) => {
        const now = Date.now();
        return currentTodos.map((item) => {
          const isRunning = typeof item.startedAt === "number";

          if (item.id === id) {
            if (isRunning) {
              return {
                ...item,
                startedAt: undefined,
                spentMs: (item.spentMs ?? 0) + Math.max(0, now - (item.startedAt ?? now)),
              };
            }
            return { ...item, startedAt: now };
          }

          if (isRunning && !item.completed) {
            return {
              ...item,
              startedAt: undefined,
              spentMs: (item.spentMs ?? 0) + Math.max(0, now - (item.startedAt ?? now)),
            };
          }

          return item;
        });
      });
      setActiveTodoId(running ? null : id);
      if (!running) {
        onStartTodo();
      }
    },
    [onStartTodo, todos],
  );

  /**
   * 置顶/取消置顶。置顶槽只有一个：
   * 置顶第二个任务时，第一个被顶替下来，并落到"第二个任务原来的位置"，
   * 而不是退回它自己原来的位置。
   */
  const pinTodo = useCallback((id: string) => {
    setTodos((currentTodos) => {
      const targetIndex = currentTodos.findIndex((todo) => todo.id === id);

      if (targetIndex < 0 || currentTodos[targetIndex].completed) {
        return currentTodos;
      }

      const target = currentTodos[targetIndex];

      if (target.pinned) {
        return currentTodos.map((todo) => (todo.id === id ? { ...todo, pinned: false } : todo));
      }

      const displaced = currentTodos.find((todo) => todo.pinned) ?? null;
      const rest = currentTodos.filter((todo) => todo.id !== id && !todo.pinned);
      const next: TodoItem[] = [{ ...target, pinned: true }, ...rest];

      if (displaced) {
        const insertAt = Math.min(Math.max(targetIndex, 1), next.length);
        next.splice(insertAt, 0, { ...displaced, pinned: false });
      }

      return next;
    });
  }, []);

  const deleteTodo = useCallback((id: string) => {
    if (id === UPDATE_TODO_ID) {
      dismissUpdatePrompt();
      return;
    }
    setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== id));
    setActiveTodoId((currentId) => (currentId === id ? null : currentId));
  }, []);

  const reorderTodo = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) {
      return;
    }

    setTodos((currentTodos) => {
      const sourceIndex = currentTodos.findIndex((todo) => todo.id === sourceId);
      const targetIndex = currentTodos.findIndex((todo) => todo.id === targetId);

      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return currentTodos;
      }

      const nextTodos = [...currentTodos];
      const [movedTodo] = nextTodos.splice(sourceIndex, 1);
      const insertIndex = targetIndex;
      nextTodos.splice(insertIndex, 0, movedTodo);

      return nextTodos;
    });
  }, []);

  useEffect(() => {
    saveTodos(withoutUpdateTodo(todos));
  }, [todos]);

  useEffect(() => {
    saveActiveTodoId(activeTodoId);
  }, [activeTodoId]);

  // 旧数据里可能残留多个"计时中"：只保留开始最晚的一个，其余结算成累计用时，
  // 否则界面上会出现多个倒计时同时在走。
  useEffect(() => {
    setTodos((current) => {
      const running = current.filter(
        (todo) => typeof todo.startedAt === "number" && !todo.completed,
      );
      if (running.length <= 1) {
        return current;
      }

      const now = Date.now();
      const keep = running.reduce((a, b) =>
        (a.startedAt ?? 0) >= (b.startedAt ?? 0) ? a : b,
      );

      return current.map((todo) => {
        if (
          typeof todo.startedAt !== "number" ||
          todo.completed ||
          todo.id === keep.id
        ) {
          return todo;
        }
        return {
          ...todo,
          startedAt: undefined,
          spentMs: (todo.spentMs ?? 0) + Math.max(0, now - todo.startedAt),
        };
      });
    });
  }, []);

  useEffect(() => {
    if (
      activeTodoId &&
      !todos.some((todo) => todo.id === activeTodoId && !todo.completed)
    ) {
      setActiveTodoId(null);
    }
  }, [activeTodoId, todos]);

  return {
    todos,
    setTodos,
    draftTodo,
    setDraftTodo,
    activeTodoId,
    setActiveTodoId,
    addTodo,
    toggleTodo,
    updateTodoTitle,
    startTodo,
    pinTodo,
    deleteTodo,
    reorderTodo,
  };
}
