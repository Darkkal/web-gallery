'use client';

import React from 'react';
import styles from '@/components/FormattedContent.module.css';

interface FormattedContentProps {
    content: string | null | undefined;
    className?: string;
}

export default function FormattedContent({ content, className }: FormattedContentProps) {
    if (!content) return null;

    const combinedClassName = `${styles.formattedContent} ${className || ''}`.trim();

    // Simple check for HTML tags
    const isHtml = /<[a-z][\s\S]*>/i.test(content);

    if (isHtml) {
        // Process links to open in new tab and handle some basic Pixiv-specific HTML cleanup if needed
        // Pixiv often uses <br /> or <br>
        // We also want to ensure links open in new tabs
        const processedHtml = content.replace(
            /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi,
            (match) => {
                if (!match.includes('target=')) {
                    return match + ' target="_blank" rel="noopener noreferrer"';
                }
                return match;
            }
        );

        return (
            <div
                className={combinedClassName}
                dangerouslySetInnerHTML={{ __html: processedHtml }}
                onClick={(e) => {
                    // Prevent clicks on links from bubbling up if needed,
                    // but usually we want them to bubble to the parent if the parent handles background clicks.
                    // However, if the parent has an onClick that toggles UI, we might want to stop propagation for links.
                    if ((e.target as HTMLElement).tagName === 'A') {
                        e.stopPropagation();
                    }
                }}
            />
        );
    }

    // Fallback for plain text
    return (
        <div className={`${combinedClassName} ${styles.plainText}`}>
            {content}
        </div>
    );
}
