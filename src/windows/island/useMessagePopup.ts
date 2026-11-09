import { useCallback, useEffect, useRef, useState } from "react";

export type MessagePopupSource = "wechat" | "qq";

export type MessagePopupState = {
  source: MessagePopupSource;
  key: number;
};

type Options = {
  qqCount: number;
  wechatPending: boolean;
  enabled: boolean;
  seconds: number;
  isExpanded: boolean;
};

/**
 * 收到新消息时主动弹出一张短提示卡，只做提示，不读取聊天内容。
 * 同一时刻只显示一个来源；后来的消息会打断并替换当前提示。
 */
export function useMessagePopup({
  qqCount,
  wechatPending,
  enabled,
  seconds,
  isExpanded,
}: Options) {
  const [popup, setPopup] = useState<MessagePopupState | null>(null);
  const [closing, setClosing] = useState(false);
  const previous = useRef({ qq: qqCount, wechat: wechatPending });
  const popupRef = useRef<MessagePopupState | null>(null);
  const timer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const remaining = useRef(0);
  const startedAt = useRef(0);

  popupRef.current = popup;

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const schedule = useCallback((ms: number) => {
    clearTimer();
    startedAt.current = Date.now();
    remaining.current = ms;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      // 先播放收起动画，再卸载，避免方块瞬间消失
      setClosing(true);
      closeTimer.current = window.setTimeout(() => {
        closeTimer.current = null;
        setPopup(null);
        setClosing(false);
      }, 200);
    }, ms);
  }, [clearTimer]);

  const show = useCallback((source: MessagePopupSource) => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setClosing(false);
    setPopup({ source, key: Date.now() });
    schedule(seconds * 1_000);
  }, [schedule, seconds]);

  useEffect(() => {
    const qqIncreased = qqCount > previous.current.qq;
    const wechatStarted = wechatPending && !previous.current.wechat;
    previous.current = { qq: qqCount, wechat: wechatPending };
    if (!enabled || isExpanded || (!qqIncreased && !wechatStarted)) return;

    // 同时到达时以微信为准，其余情况后到的消息打断前一条。
    show(wechatStarted ? "wechat" : "qq");
  }, [qqCount, wechatPending, enabled, isExpanded, show]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const pause = () => {
    if (!popupRef.current || timer.current === null) return;
    clearTimer();
    const elapsed = Date.now() - startedAt.current;
    remaining.current = Math.max(600, remaining.current - elapsed);
  };

  const resume = () => {
    if (!popupRef.current || timer.current !== null || remaining.current <= 0) return;
    schedule(remaining.current);
  };

  return { popup, closing, pause, resume };
}
