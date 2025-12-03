'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { Components } from 'react-markdown';

export const MarkdownComponents: Components = {
  // Table wrapper for responsive scrolling
  table: ({ children }) => (
    <div className="overflow-x-auto touch-pan-x my-4 rounded-md border border-gray-200">
      <table className="w-full">{children}</table>
    </div>
  ),

  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,

  th: ({ children, style }) => {
    const align = style?.textAlign;
    return (
      <th
        className="bg-gray-50 px-3 py-2 sm:px-4 sm:py-3 text-left font-semibold text-gray-900 border-b border-gray-200 text-sm sm:text-base"
        style={align ? { textAlign: align } : undefined}
      >
        {children}
      </th>
    );
  },

  td: ({ children, style }) => {
    const align = style?.textAlign;
    return (
      <td
        className="px-3 py-2 sm:px-4 sm:py-3 border-b border-gray-200 text-sm sm:text-base"
        style={align ? { textAlign: align } : undefined}
      >
        {children}
      </td>
    );
  },

  // Link renderer with external link icon
  a: ({ href, children, title }) => {
    const isExternal = href && !href.startsWith('/') && !href.startsWith('#');
    return (
      <a
        href={href}
        title={title}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        className="text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
      >
        {children}
        {isExternal && (
          <ExternalLink
            size={14}
            className="inline flex-shrink-0 ml-0.5"
            aria-label="opens in new tab"
          />
        )}
      </a>
    );
  },

  // Headings with responsive sizing
  h1: ({ children }) => (
    <h1 className="text-xl sm:text-2xl font-bold mt-4 sm:mt-6 mb-2 sm:mb-3">
      {children}
    </h1>
  ),

  h2: ({ children }) => (
    <h2 className="text-lg sm:text-xl font-bold mt-4 sm:mt-6 mb-2 sm:mb-3 pb-2 border-b border-gray-200">
      {children}
    </h2>
  ),

  h3: ({ children }) => (
    <h3 className="text-base sm:text-lg font-bold mt-3 sm:mt-5 mb-2">
      {children}
    </h3>
  ),

  h4: ({ children }) => (
    <h4 className="text-base font-bold mt-4 mb-2">{children}</h4>
  ),

  h5: ({ children }) => (
    <h5 className="font-bold mt-3 mb-2">{children}</h5>
  ),

  h6: ({ children }) => (
    <h6 className="font-bold text-sm mt-3 mb-2">{children}</h6>
  ),

  // Blockquote with blue styling
  blockquote: ({ children }) => (
    <blockquote className="border-l-3 sm:border-l-4 border-blue-500 bg-blue-50 px-3 sm:px-4 py-2 my-3 text-sm sm:text-base text-gray-700 italic rounded-r">
      {children}
    </blockquote>
  ),

  // Lists with responsive indentation
  ul: ({ children }) => (
    <ul className="list-disc list-inside my-2 pl-4 sm:pl-6 text-sm sm:text-base">
      {children}
    </ul>
  ),

  ol: ({ children }) => (
    <ol className="list-decimal list-inside my-2 pl-4 sm:pl-6 text-sm sm:text-base">
      {children}
    </ol>
  ),

  li: ({ children }) => (
    <li className="my-1">{children}</li>
  ),

  // Code components
  code: ({ children, className }) => {
    // Check if it's a code block (has language class) vs inline code
    const isInline = !className;

    if (isInline) {
      return (
        <code className="px-1.5 py-0.5 rounded font-mono text-xs sm:text-sm">
          {children}
        </code>
      );
    }

    return (
      <code className="text-gray-100 font-mono text-xs sm:text-sm">
        {children}
      </code>
    );
  },

  pre: ({ children }) => (
    <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto my-3 border border-gray-700 max-w-full touch-pan-x">
      {children}
    </pre>
  ),

  // Paragraphs
  p: ({ children }) => (
    <p className="mb-3">{children}</p>
  ),

  // Horizontal rule
  hr: ({ }) => (
    <hr className="my-4 border-gray-300" />
  ),

  // Strong/bold
  strong: ({ children }) => (
    <strong className="font-bold">{children}</strong>
  ),

  // Emphasis/italic
  em: ({ children }) => (
    <em className="italic">{children}</em>
  ),
};
