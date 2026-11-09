import { invoke } from "@tauri-apps/api/core";

export type DshTurn = {
  time: number;
  user: string;
  assistant: string;
};

export function readDshTurns(limit = 8) {
  return invoke<DshTurn[]>("read_dsh_turns", { limit });
}
