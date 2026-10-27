import React, { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { useInterfaceLanguage } from "../context/LanguageContext";

interface ShareButtonProps {
  title: string;
  text?: string;
  /** Path on this site; the link carries the current language with `?lang=`. */
  path: string;
  className?: string;
}

/**
 * Shares a place through the phone's share sheet (WhatsApp, Messages…), or
 * copies the link where there is none. The link opens in the sharer's
 * language, and the server gives it a preview with the place's photo.
 */
export const ShareButton: React.FC<ShareButtonProps> = ({ title, text, path, className = "" }) => {
  const { language, isArabic } = useInterfaceLanguage();
  const [copied, setCopied] = useState(false);
  const [manualLink, setManualLink] = useState<string | null>(null);

  const share = async () => {
    const url = new URL(path, window.location.origin);
    url.searchParams.set("lang", language);
    const link = url.toString();
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: link });
        return;
      } catch (error) {
        // Closing the share sheet is not a failure; anything else falls back to copying.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // No clipboard access (an insecure address, a locked-down browser): show
      // the link selected, ready for the visitor to copy themselves.
      setManualLink(link);
    }
  };

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => void share()}
        className={`inline-flex items-center justify-center gap-2 rounded-full border border-brand-border px-4 py-2.5 font-bold text-brand-olive transition-colors hover:border-brand-amber ${className}`}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-brand-amber" /> : <Share2 className="h-3.5 w-3.5" />}
        <span aria-live="polite">{copied ? (isArabic ? "نُسخ الرابط" : "Link copied") : (isArabic ? "شارك" : "Share")}</span>
      </button>
      {manualLink && (
        <span className="popup-panel absolute start-0 top-full z-30 mt-2 block w-72 max-w-[80vw] rounded-2xl border border-brand-border bg-brand-surface p-3 shadow-xl shadow-black/10">
          <label htmlFor="share-link" className="mb-1.5 block text-xs text-brand-muted">
            {isArabic ? "انسخ الرابط:" : "Copy the link:"}
          </label>
          <input
            id="share-link"
            readOnly
            dir="ltr"
            autoFocus
            value={manualLink}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={() => setManualLink(null)}
            onKeyDown={(event) => event.key === "Escape" && setManualLink(null)}
            className="w-full rounded-lg border border-brand-border bg-brand-bg px-2.5 py-1.5 font-mono text-xs text-brand-text"
          />
        </span>
      )}
    </span>
  );
};
