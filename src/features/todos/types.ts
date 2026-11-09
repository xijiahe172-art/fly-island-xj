export type TodoPageMode = "today" | "daily" | "archive" | "review";
export type ArchiveLayout = "cards" | "timeline";

export type TodoItem = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  kind?: "update";
  /** 置顶槽只有一个：置顶任务排最前，灵动岛优先读取。 */
  pinned?: boolean;
  /** 计时开始时间；为空表示当前没有在计时。 */
  startedAt?: number;
  /** 已累计用时（毫秒），结束或完成时结算。 */
  spentMs?: number;
};

export type TodoArchive = {
  date: string;
  todos: TodoItem[];
  dailyNote: string;
  savedAt: number;
  savedToDisk: boolean;
  filePath?: string;
};

export type SaveState = "idle" | "saving" | "saved" | "needs-path" | "error";
export type SavePathState = "idle" | "saved";
