import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import { NumberControl } from "../../components/controls/NumberControl";
import { ToggleControl } from "../../components/controls/ToggleControl";
import type { IslandSettings } from "./types";

export function TodoSettingsSection({ settings, onSettingsChange }: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const t = useTranslation();
  // 音频来源图标的拖动开关：岛与设置页共用同一个 localStorage key
  const [audioBadgeDrag, setAudioBadgeDrag] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem("island-audio-badge-drag") !== "0";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "island-audio-badge-drag") {
        setAudioBadgeDrag(event.newValue !== "0");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const changeAudioBadgeDrag = (next: boolean) => {
    setAudioBadgeDrag(next);
    try {
      window.localStorage.setItem("island-audio-badge-drag", next ? "1" : "0");
    } catch {
      /* 忽略 */
    }
  };

  return (
    <section className="settings-section settings-section--todo">
      <div className="settings-section__header">
        <span>{t.settings.todo.title}</span>
      </div>
      <ToggleControl
        label={t.settings.todo.carryOverIncomplete}
        checked={settings.carryOverIncompleteTodos}
        onChange={(carryOverIncompleteTodos) =>
          onSettingsChange({ ...settings, carryOverIncompleteTodos })
        }
      />
      <ToggleControl
        label={t.settings.todo.enableReorder}
        checked={settings.enableTodoReorder}
        onChange={(enableTodoReorder) =>
          onSettingsChange({ ...settings, enableTodoReorder })
        }
      />
      <ToggleControl
        label={t.settings.todo.audioBadgeDrag}
        checked={audioBadgeDrag}
        onChange={changeAudioBadgeDrag}
        accent
      />
      <ToggleControl
        label={t.settings.todo.rotateTodos}
        checked={settings.rotateTodos}
        onChange={(rotateTodos) => onSettingsChange({ ...settings, rotateTodos })}
      />
      {settings.rotateTodos && (
        <NumberControl
          label={t.settings.todo.rotationSeconds}
          value={settings.todoRotationSeconds}
          min={1}
          max={3_600}
          onChange={(todoRotationSeconds) => onSettingsChange({ ...settings, todoRotationSeconds })}
        />
      )}
    </section>
  );
}
