import React from "react";
import { ChevronDown } from "lucide-react";

export interface InspectorSectionProps {
  title: string;
  defaultOpen?: boolean;
  sectionId?: string;
  children: React.ReactNode;
}

export const InspectorSection: React.FC<InspectorSectionProps> = ({
  title,
  defaultOpen = false,
  sectionId,
  children,
}) => {
  const storageKey = sectionId
    ? `openreel.inspector.section.${sectionId}.open`
    : null;
  const [isOpen, setIsOpen] = React.useState(() => {
    if (!storageKey || typeof window === "undefined") return defaultOpen;
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved === null ? defaultOpen : saved === "true";
    } catch {
      return defaultOpen;
    }
  });

  const toggleOpen = () => {
    setIsOpen((current) => {
      const next = !current;
      if (storageKey && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(storageKey, String(next));
        } catch {
          // Non-critical preference; keep the UI responsive if storage is blocked.
        }
      }
      return next;
    });
  };

  return (
    <div className="mb-6 transition-all" data-section-id={sectionId}>
      <button
        onClick={toggleOpen}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-3 w-full group"
      >
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 ${
            isOpen ? "" : "-rotate-90"
          } text-text-muted group-hover:text-text-primary`}
        />
        <span className="text-xs font-medium">{title}</span>
      </button>
      {isOpen && (
        <div className="animate-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
};
