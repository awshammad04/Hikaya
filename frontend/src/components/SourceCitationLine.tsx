import React from "react";
import { BookOpen, ExternalLink } from "lucide-react";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { primarySourceTitle, sourceCitations } from "../sourceMetadata";

interface SourceCitationLineProps {
  sourceId?: string | null;
  locationId?: string | null;
  className?: string;
  compact?: boolean;
}

export const SourceCitationLine: React.FC<SourceCitationLineProps> = ({
  sourceId,
  locationId,
  className = "",
  compact = false,
}) => {
  const { isArabic } = useInterfaceLanguage();
  const citations = sourceCitations(sourceId, locationId);

  return (
    <div className={`text-[10px] text-brand-muted flex items-start gap-1.5 ${className}`}>
      <BookOpen className="w-3 h-3 shrink-0 mt-0.5 text-brand-amber" />
      <div className="leading-relaxed">
        <span className="font-mono uppercase tracking-wide">
          {isArabic ? "المراجع الموثقة: " : "Reviewed sources: "}
        </span>
        {citations.length ? citations.slice(0, compact ? 1 : 3).map((citation, index) => (
          <React.Fragment key={citation.url}>
            {index > 0 && <span> · </span>}
            <a href={citation.url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-brand-olive">
              {isArabic ? citation.arabicTitle : citation.title}
              <span className="text-brand-muted"> — {isArabic ? citation.arabicPublisher : citation.publisher}</span>
              <ExternalLink className="inline w-2.5 h-2.5 ms-1" />
            </a>
          </React.Fragment>
        )) : (
          <span>{primarySourceTitle(sourceId, locationId, isArabic)}</span>
        )}
      </div>
    </div>
  );
};
