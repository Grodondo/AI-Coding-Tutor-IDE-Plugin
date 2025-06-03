import React from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Configure marked for better rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Configure DOMPurify to allow safe HTML elements
const purifyOptions = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'a', 'img'
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'src', 'alt', 'title',
    'class', 'id'
  ],
  ALLOW_DATA_ATTR: false,
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {  const renderMarkdown = (markdown: string): string => {
    try {
      // Parse markdown to HTML
      const rawHtml = marked.parse(markdown);
      
      // Handle both sync and async marked results
      const htmlString = typeof rawHtml === 'string' ? rawHtml : '';
      
      // Sanitize HTML to prevent XSS attacks
      const cleanHtml = DOMPurify.sanitize(htmlString, purifyOptions);
      
      return cleanHtml;
    } catch (error) {
      console.error('Error rendering markdown:', error);
      return markdown; // Fallback to plain text
    }
  };

  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
};

export default MarkdownRenderer;
