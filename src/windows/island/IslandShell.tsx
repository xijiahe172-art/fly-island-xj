import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AgentVisualState } from "../../features/agent-status/status";
import type { AppearanceMode } from "../../features/appearance/types";
import { getEffectiveAppearanceMode } from "../../features/appearance/settings";
import type { MediaState } from "../../features/media/api";
import { latestMessagePreview, type MessageSource } from "../../features/messages/messagePreview";
import { MessageSourceIcon } from "../../features/messages/MessageSourceIcon";
import type { QQMailController } from "../../features/messages/qq-mail/QQMail";
import type { QQNotificationsController } from "../../features/messages/qq-notifications/QQNotifications";
import type { WeChatRemindersController } from "../../features/messages/wechat/WeChatReminders";
import { useTranslation } from "../../i18n";
import { IslandCollapsedBar } from "./IslandCollapsedBar";
import { IslandHeader } from "./IslandHeader";
import type { IslandMode, IslandPage, NativeGlassState } from "./types";
import { useGlassPointer } from "./useGlassPointer";
import { useIslandPreparing } from "./useIslandPreparing";
import { useMessagePopup } from "./useMessagePopup";
import "./IslandShell.css";

type IslandShellProps = {
  qqMail: QQMailController;
  qqNotifications: QQNotificationsController;
  wechatReminders: WeChatRemindersController;
  onOpenMessages: (source: MessageSource) => void;
  mode: IslandMode;
  page: IslandPage;
  appearanceMode: AppearanceMode;
  nativeGlassState: NativeGlassState;
  isTucked: boolean;
  isDetached: boolean;
  showTitle: boolean;
  showCollapsedText: boolean;
  messagePopup: boolean;
  messagePopupSeconds: number;
  collapsedTaskTitle: string | null;
  collapsedTodoCount: number | null;
  collapsedRunningText: string | null;
  mediaState: MediaState;
  agentVisualState: AgentVisualState;
  agentStatusLabel: string;
  onOpenPage: (page: IslandPage) => void;
  onWindowDragStart: () => void;
  onCollapse: () => void;
  onResetPosition: () => void;
  onMinimize: () => void;
  onOpenTranslator: () => void;
  onOpenSettings: () => void;
  onReveal: () => void;
  onPageChange: (page: IslandPage) => void;
  children: ReactNode;
};

export function IslandShell({
  qqMail,
  qqNotifications,
  wechatReminders,
  onOpenMessages,
  mode,
  page,
  appearanceMode,
  nativeGlassState,
  isTucked,
  isDetached,
  showTitle,
  showCollapsedText,
  messagePopup,
  messagePopupSeconds,
  collapsedTaskTitle,
  collapsedTodoCount,
  collapsedRunningText,
  mediaState,
  agentVisualState,
  agentStatusLabel,
  onOpenPage,
  onWindowDragStart,
  onCollapse,
  onResetPosition,
  onMinimize,
  onOpenTranslator,
  onOpenSettings,
  onReveal,
  onPageChange,
  children,
}: IslandShellProps) {
  const t = useTranslation();
  const isExpanded = mode === "expanded";
  const effectiveAppearanceMode = getEffectiveAppearanceMode(appearanceMode);
  const isLiquidGlass = effectiveAppearanceMode === "liquidGlass";
  const { handleGlassPointerMove, resetGlassPointer } = useGlassPointer(isLiquidGlass);
  const isPreparing = useIslandPreparing(isExpanded);
  const qqPreview = qqNotifications.preview;
  const qqNotificationCount = qqNotifications.snapshot.items.length;
  const wechatPending = wechatReminders.snapshot.pending;
  const popupRef = useRef<HTMLDivElement | null>(null);
  const { popup, closing, pause: pausePopup, resume: resumePopup } = useMessagePopup({
    qqCount: qqNotificationCount,
    wechatPending,
    enabled: messagePopup,
    seconds: messagePopupSeconds,
    isExpanded,
  });
  // 收起：方块自己缩成长条的形状，不淡出、不重开，和弹出用同一条弹性曲线
  useEffect(() => {
    const card = popupRef.current;
    const islandElement = card?.parentElement;
    if (!closing || !card || !islandElement) return;
    const from = card.getBoundingClientRect();
    const to = islandElement.getBoundingClientRect();
    if (!from.width || !from.height) return;
    const scaleX = to.width / from.width;
    const scaleY = to.height / from.height;
    const shiftX = to.left + to.width / 2 - (from.left + from.width / 2);
    const shiftY = to.top + to.height / 2 - (from.top + from.height / 2);
    card.animate(
      [
        { transform: "translate(0px, 0px) scale(1, 1)", opacity: 1, offset: 0 },
        { opacity: 1, offset: 0.62 },
        {
          transform: `translate(${shiftX}px, ${shiftY}px) scale(${scaleX}, ${scaleY})`,
          opacity: 0,
          offset: 1,
        },
      ],
      { duration: 320, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", fill: "forwards" },
    );
  }, [closing]);

  const wechatPreviewAt = wechatReminders.previewReceivedAt;
  const [latestPreviewAt, setLatestPreviewAt] = useState(0);
  const preview = latestMessagePreview([
    qqPreview ? { ...qqPreview, source: "qq", receivedAt: qqNotifications.previewReceivedAt ?? 0 } : null,
    wechatPreviewAt !== null ? { source: "wechat", title: t.messages.wechat, body: t.messages.newReminder, receivedAt: wechatPreviewAt } : null,
    qqMail.preview ? { source: "qqMail", title: qqMail.preview.sender, body: qqMail.preview.subject, receivedAt: qqMail.previewReceivedAt ?? 0 } : null,
  ], latestPreviewAt);
  if (preview && preview.receivedAt > latestPreviewAt) setLatestPreviewAt(preview.receivedAt);
  const className = [
    "island",
    `island--${mode}`,
    `island--${page}`,
    `island--appearance-${effectiveAppearanceMode}`,
    isPreparing && !isExpanded ? "island--preparing" : "",
    isDetached ? "island--detached" : "island--docked",
    isLiquidGlass ? `island--glass-${nativeGlassState}` : "",
    showTitle ? "" : "island--title-hidden",
    popup && !isExpanded ? "island--popup" : "",
    closing ? "island--closing" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const collapsedLabel = showCollapsedText
    ? collapsedTaskTitle
      ? t.messages.collapsedTask(collapsedTaskTitle)
      : collapsedTodoCount !== null
        ? t.island.pendingTodos(collapsedTodoCount)
        : "习嘉禾"
    : "习嘉禾";

  return (
    <section
      className={className}
      aria-label={collapsedLabel}
      onClick={(event) => {
        if (!isExpanded && event.target === event.currentTarget) {
          onOpenPage(page);
        }
      }}
      onPointerMove={handleGlassPointerMove}
      onPointerLeave={resetGlassPointer}
      onMouseEnter={() => {
        if (isTucked) {
          onReveal();
        }
      }}
    >
      <div className="island__surface">
        {isLiquidGlass && (
          <div className="island__glass" aria-hidden="true">
            <span className="island__glass-refraction" />
            <span className="island__glass-highlight" />
          </div>
        )}
        <IslandCollapsedBar
          qqMail={qqMail}
          qqNotifications={qqNotifications}
          wechatReminders={wechatReminders}
          preview={preview}
          page={page}
          isExpanded={isExpanded}
          isTucked={isTucked}
          showTitle={showTitle}
          showCollapsedText={showCollapsedText}
          collapsedLabel={collapsedLabel}
          collapsedTaskTitle={collapsedTaskTitle}
          collapsedTodoCount={collapsedTodoCount}
          collapsedRunningText={collapsedRunningText}
          mediaState={mediaState}
          agentVisualState={agentVisualState}
          agentStatusLabel={agentStatusLabel}
          onOpenPage={onOpenPage}
          onOpenMessages={onOpenMessages}
          onWindowDragStart={onWindowDragStart}
        />

        <div
          id="island-panel"
          className="island__expanded"
          aria-hidden={!isExpanded}
          inert={!isExpanded}
        >
          <IslandHeader
            page={page}
            showTitle={showTitle}
            isDetached={isDetached}
            agentVisualState={agentVisualState}
            agentStatusLabel={agentStatusLabel}
            qqNotificationCount={qqNotificationCount}
            wechatPending={wechatPending}
            onPageChange={onPageChange}
            onCollapse={onCollapse}
            onOpenSettings={onOpenSettings}
            onOpenMessages={onOpenMessages}
            onOpenTranslator={onOpenTranslator}
            onResetPosition={onResetPosition}
            onMinimize={onMinimize}
          />
          <div className="island__content">{children}</div>
        </div>
      </div>
                {popup && !isExpanded && (
          <div
            key={popup.key}
            ref={popupRef}
            className={`island__popup${closing ? " island__popup--closing" : ""}`}
            role="status"
            aria-live="polite"
            onMouseEnter={pausePopup}
            onMouseLeave={resumePopup}
          >
            <button
              className="island__popup-row"
              type="button"
              onClick={() => onOpenMessages(popup.source)}
            >
              <MessageSourceIcon source={popup.source} size={28} />
              <span className="island__popup-name">{t.messages.sourceLabels[popup.source]}</span>
              <span className="island__popup-text">{t.messages.popupNewMessage}</span>
            </button>
          </div>
        )}
    </section>
  );
}

