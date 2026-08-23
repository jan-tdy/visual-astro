import { toast } from "sonner";

/**
 * Opens a URL in a new tab and reports whether the browser allowed it.
 * `window.open` returns null when a popup blocker swallows the window.
 */
export function tryOpenWindow(url: string): boolean {
  try {
    return window.open(url, "_blank", "noopener,noreferrer") !== null;
  } catch {
    return false;
  }
}

export interface PopupBlockedMessages {
  /** Short headline, e.g. t("editor.popupBlocked"). */
  blocked: string;
  /** Guidance on allowing popups / that the download itself succeeded. */
  hint: string;
  /** Label for the retry action button. */
  open: string;
}

/**
 * Opens a portal/submission URL in a new tab. If the browser blocks the popup,
 * the user gets a clear toast explaining what happened, plus an action button
 * that retries from a fresh user gesture (which popup blockers allow).
 */
export function openPortalWithFallback(url: string, messages: PopupBlockedMessages): void {
  if (tryOpenWindow(url)) return;
  toast.error(messages.blocked, {
    description: messages.hint,
    duration: 12000,
    action: {
      label: messages.open,
      // Clicking the toast action is a real user gesture, so this retry is not blocked.
      onClick: () => tryOpenWindow(url),
    },
  });
}
