"use client";

import styles from "@/components/FormattedContent.module.css";
import { handleKeyActivate } from "@/lib/utils/a11y";

interface FormattedContentProps {
  content: string | null | undefined;
  className?: string;
}

export default function FormattedContent({
  content,
  className,
}: FormattedContentProps) {
  if (!content) return null;

  const combinedClassName =
    `${styles.formattedContent} ${className || ""}`.trim();

  // Simple check for HTML tags
  const isHtml = /<[a-z][\s\S]*>/i.test(content);

  if (isHtml) {
    // Process links to open in new tab and handle some basic Pixiv-specific HTML cleanup if needed
    // Pixiv often uses <br /> or <br>
    // We also want to ensure links open in new tabs
    const processedHtml = content.replace(
      /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi,
      (match) => {
        if (!match.includes("target=")) {
          return `${match} target="_blank" rel="noopener noreferrer"`;
        }
        return match;
      },
    );

    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: Only used for stopping propagation on links
      <div
        className={combinedClassName}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Intentional rendering of processed HTML
        dangerouslySetInnerHTML={{ __html: processedHtml }}
        onClick={(e) => {
          if ((e.target as HTMLElement).tagName === "A") {
            e.stopPropagation();
          }
        }}
        onKeyDown={handleKeyActivate(() => {})}
        role="presentation"
      />
    );
  }

  // Fallback for plain text
  return (
    <div className={`${combinedClassName} ${styles.plainText}`}>{content}</div>
  );
}
