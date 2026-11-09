import type { AgentVisualState } from "../../features/agent-status/status";
import type { MediaState } from "../../features/media/api";
import { CollapsedMessageContent } from "../../features/messages/CollapsedMessageContent";
import { MessageSourceIcon } from "../../features/messages/MessageSourceIcon";
// After CollapsedMessageContent, matching the original stylesheet order.
import { AudioSourceBadge } from "../../features/media/AudioSourceBadge";
import { MusicWaveButton } from "../../features/media/MusicWaveButton";
import { messagePreviewText, type MessagePreview, type MessageSource } from "../../features/messages/messagePreview";
import type { QQMailController } from "../../features/messages/qq-mail/QQMail";
import type { QQNotificationsController } from "../../features/messages/qq-notifications/QQNotifications";
import type { WeChatRemindersController } from "../../features/messages/wechat/WeChatReminders";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import type { IslandPage } from "./types";
import { useWindowDragGesture } from "./useWindowDragGesture";
import "./IslandCollapsedBar.css";

type IslandCollapsedBarProps = {
  qqMail: QQMailController;
  qqNotifications: QQNotificationsController;
  wechatReminders: WeChatRemindersController;
  preview: MessagePreview | null;
  page: IslandPage;
  isExpanded: boolean;
  isTucked: boolean;
  showTitle: boolean;
  showCollapsedText: boolean;
  collapsedLabel: string;
  collapsedTaskTitle: string | null;
  collapsedRunningText: string | null;
  collapsedTodoCount: number | null;
  mediaState: MediaState;
  agentVisualState: AgentVisualState;
  agentStatusLabel: string;
  onOpenPage: (page: IslandPage) => void;
  onOpenMessages: (source: MessageSource) => void;
  onWindowDragStart: () => void;
};

/** The collapsed island: agent pulse, todo or message summary, mail badge, music button and tuck handle. */
export function IslandCollapsedBar({
  qqMail,
  qqNotifications,
  wechatReminders,
  preview,
  page,
  isExpanded,
  isTucked,
  showTitle,
  showCollapsedText,
  collapsedLabel,
  collapsedTaskTitle,
  collapsedTodoCount,
  collapsedRunningText,
  mediaState,
  agentVisualState,
  agentStatusLabel,
  onOpenPage,
  onOpenMessages,
  onWindowDragStart,
}: IslandCollapsedBarProps) {
  const t = useTranslation();
  const { didDragRef, prepareWindowDrag, handleWindowDragMove, cancelWindowDrag } =
    useWindowDragGesture(isTucked, onWindowDragStart);
  const collapsedRef = useRef<HTMLDivElement>(null);
  const [badgeLeft, setBadgeLeft] = useState<number | null>(null);
  const [badgeDragEnabled, setBadgeDragEnabled] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem("island-audio-badge-drag") !== "0";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    // 设置页在同一 origin，改完会触发 storage 事件，这里跟着切
    const onStorage = (event: StorageEvent) => {
      if (event.key === "island-audio-badge-drag") {
        setBadgeDragEnabled(event.newValue !== "0");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const [badgeNudge, setBadgeNudge] = useState<number>(() => {
    const MIN = -12;
    const MAX = 12;
    try {
      const raw = window.localStorage.getItem("island-audio-badge-nudge");
      const value = raw === null ? 0 : Number(raw);
      if (!Number.isFinite(value) || value < MIN || value > MAX) {
        window.localStorage.setItem("island-audio-badge-nudge", "0");
        return 0;
      }
      return value;
    } catch {
      return 0;
    }
  });
  const isMusicPlaying = mediaState.playbackStatus === "playing";
  // 有消息时音频让位，消息动画优先
  // 没有音频设备时峰值恒为 0，用媒体会话的播放状态兜底，保证有声音就有波形
  const showWave = (mediaState.audioActive || isMusicPlaying) && !preview;
  const baseLeftRef = useRef(0);
  const nudgeRef = useRef(badgeNudge);
  nudgeRef.current = badgeNudge;
  const badgeDragEnabledRef = useRef(badgeDragEnabled);
  badgeDragEnabledRef.current = badgeDragEnabled;
  const badgeDragRef = useRef<{ startX: number; startNudge: number } | null>(null);
  const lastNudgeRef = useRef(badgeNudge);

  useLayoutEffect(() => {
    const el = collapsedRef.current;
    if (!el || !showWave) {
      return;
    }

    const BADGE_SIZE = 26;
    const measure = () => {
      const wave = el.querySelector<HTMLElement>(".music-wave-button");
      if (!wave) {
        return;
      }

      const box = el.getBoundingClientRect();
      const waveRect = wave.getBoundingClientRect();
      // 遮罩吃掉盒子左边 25%，柱子内容比盒子宽且居中，实测第一根可见柱子约在盒子 42% 处
      const barsStart = waveRect.left + waveRect.width * 0.42;
      let textRight = box.left;
      el.querySelectorAll<HTMLElement>(
        ".island__brand, .island__todo-count, .island__running, .island__active-task",
      ).forEach((node) => {
        textRight = Math.max(textRight, node.getBoundingClientRect().right);
      });

      const gap = barsStart - textRight;
      const centered = (textRight + barsStart) / 2 - box.left - BADGE_SIZE / 2;
      const base = gap >= BADGE_SIZE
        ? centered
        : Math.max(0, barsStart - box.left - BADGE_SIZE);
      baseLeftRef.current = Math.round(base);
      setBadgeLeft(Math.round(base) + nudgeRef.current);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const waveEl = el.querySelector(".music-wave-button");
    if (waveEl) {
      observer.observe(waveEl);
    }
    return () => observer.disconnect();
  }, [showWave, showTitle, collapsedTaskTitle, collapsedRunningText, collapsedTodoCount, badgeDragEnabled]);

  const startBadgeDrag = (event: React.PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    badgeDragRef.current = { startX: event.clientX, startNudge: badgeNudge };
  };
  const moveBadgeDrag = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (!badgeDragRef.current) {
      return;
    }
    event.preventDefault();
    const rawDelta = event.clientX - badgeDragRef.current.startX;
    const delta = event.shiftKey ? rawDelta * 0.25 : rawDelta;
    const next = Math.max(
      -12,
      Math.min(12, Math.round(badgeDragRef.current.startNudge + delta)),
    );
    lastNudgeRef.current = next;
    setBadgeNudge(next);
    setBadgeLeft(baseLeftRef.current + next);
  };
  const endBadgeDrag = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (!badgeDragRef.current) {
      return;
    }
    badgeDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    try {
      window.localStorage.setItem("island-audio-badge-nudge", String(lastNudgeRef.current));
    } catch {
      /* 忽略存储失败 */
    }
  };

  // 临时：播放中按 [ / ] 各挪 1px，值存 localStorage
  useEffect(() => {
    if (!showWave) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "[" && event.key !== "]") {
        return;
      }
      event.preventDefault();
      setBadgeNudge((current) => {
        const next = current + (event.key === "[" ? -1 : 1);
        try {
          window.localStorage.setItem("island-audio-badge-nudge", String(next));
        } catch {
          /* 忽略存储失败 */
        }
        return next;
      });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showWave]);

  const pulseClassName = [
    "island__pulse",
    `island__pulse--agent-${agentVisualState}`,
  ].join(" ");
  return (
    <div
      ref={collapsedRef}
      className="island__collapsed"
      data-audio={showWave ? "on" : "off"}
      data-src={mediaState.sourceApp ?? "null"}
      data-sessions={mediaState.sessions.length}
      aria-hidden={isExpanded}
      inert={isExpanded}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onOpenPage(page);
        }
      }}
    >
      <button
        className="island__open-button"
        type="button"
        aria-label={preview ? t.messages.openPreview(messagePreviewText(preview, t.messages), t.messages.sourceLabels[preview.source]) : t.messages.expand(collapsedLabel)}
        aria-expanded={preview ? undefined : isExpanded}
        aria-controls={preview ? undefined : "island-panel"}
        onPointerDown={prepareWindowDrag}
        onPointerMove={handleWindowDragMove}
        onPointerUp={cancelWindowDrag}
        onPointerCancel={cancelWindowDrag}
        onClick={(event) => {
          if (event.detail === 0 || !didDragRef.current) {
            if (preview) {
              if (preview.source === "qqMail" && qqMail.preview) {
                onOpenMessages("qqMail");
                void qqMail.readMail(qqMail.preview);
                return;
              }
              const open = preview.source === "qq" ? qqNotifications.openQQ : wechatReminders.openWeChat;
              void open().then((opened) => {
                if (opened === false) onOpenMessages(preview.source);
              });
            } else {
              onOpenPage(page);
            }
          }
        }}
      >
        <span className={pulseClassName} title={agentStatusLabel} />
        <CollapsedMessageContent preview={preview} enabled={!isExpanded && !isTucked}>
          {showCollapsedText && showTitle && (
            <span className="island__brand">习嘉禾</span>
          )}
          {showCollapsedText && collapsedTodoCount !== null && (
            <span className="island__todo-count">
              {showTitle ? "· " : ""}
              {t.island.pendingTodos(collapsedTodoCount)}
            </span>
          )}
          {showCollapsedText && collapsedRunningText && (
            <span className="island__running">{collapsedRunningText}</span>
          )}
          {showCollapsedText && !collapsedRunningText && collapsedTaskTitle && (
            <span className="island__active-task" key={collapsedTaskTitle}>
              {collapsedTaskTitle}
            </span>
          )}
        </CollapsedMessageContent>
      </button>
      {qqMail.preview !== null && (
        <button className="island-message-button island-message-button--compact qq-mail-badge" type="button" aria-label={t.messages.newMailLabel} title={t.messages.openNewMail} onClick={() => onOpenMessages("qqMail")}>
          <MessageSourceIcon source="qqMail" size={16} />
          <span className="island-message-button__dot" aria-hidden="true" />
        </button>
      )}
      {/* 音频来源角标：落在待办文字与波形之间的空白里，与波形同进同退 */}
      <AudioSourceBadge
        sourceApp={mediaState.sourceApp}
        visible={showWave}
        size={26}
        left={badgeLeft}
        locked={!badgeDragEnabled}
        onPointerDown={showWave && badgeDragEnabled ? startBadgeDrag : undefined}
        onPointerMove={showWave && badgeDragEnabled ? moveBadgeDrag : undefined}
        onPointerUp={showWave && badgeDragEnabled ? endBadgeDrag : undefined}
        onPointerCancel={showWave && badgeDragEnabled ? endBadgeDrag : undefined}
      />
      {/* 没有声音时整块留白，只有确实检测到音频才出现波形 */}
      <MusicWaveButton
        visible={showWave}
        isPlaying={isMusicPlaying}
        audioPeak={mediaState.audioPeak}
        label={t.island.openMusic}
        onClick={() => onOpenPage("music")}
      />
    </div>
  );
}