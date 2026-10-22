"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { APP_NAME } from "@/lib/brand";

// Chrome/Edge/Android fire this when the site can be installed.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "nam-install-dismissed";

// "installed" (already opened from the home screen), "ios" (Safari: install
// is manual, via Share → Add to Home Screen) or "other".
function platformSnapshot(): string {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return "ios";
  return "other";
}
const subscribe = () => () => {};

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

// A small card inviting people to add NAM to their home screen, so it opens
// full screen like an app (no app store). Hidden once installed or dismissed.
export function InstallAppPrompt() {
  const platform = useSyncExternalStore(subscribe, platformSnapshot, () => "server");
  const dismissedAtLoad = useSyncExternalStore(subscribe, readDismissed, () => true);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // show our own button instead of the browser's mini-bar
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // private mode: it just shows again next time
    }
  };

  if (hidden || dismissedAtLoad || platform === "installed" || platform === "server") return null;
  if (platform !== "ios" && !deferred) return null; // not installable in this browser (yet)

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm text-brand-800 print:hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/cmat-icon-192.png" alt="" className="h-9 w-9 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Add {APP_NAME} to your home screen</p>
        <p className="text-xs text-brand-700">
          {platform === "ios" ? (
            <>
              Tap <strong>Share</strong> <span aria-hidden="true">⬆︎</span> in Safari, then{" "}
              <strong>Add to Home Screen</strong>. It opens full screen, like an app.
            </>
          ) : (
            <>Opens full screen like an app, one tap away at the event. No app store needed.</>
          )}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {deferred && (
          <button
            onClick={async () => {
              await deferred.prompt();
              const { outcome } = await deferred.userChoice;
              setDeferred(null);
              if (outcome === "accepted") setHidden(true);
            }}
            className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800"
          >
            Install
          </button>
        )}
        <button onClick={dismiss} className="rounded-md px-2 py-1.5 text-xs text-brand-700 underline">
          Not now
        </button>
      </div>
    </div>
  );
}
