"use client"

import { Task } from "@/types/task"

interface TaskContentDisplayProps {
  task: Task
}

export function TaskContentDisplay({ task }: TaskContentDisplayProps) {
  // Función para sanitizar HTML básico (opcional, puedes usar una librería como DOMPurify)
  const sanitizeHTML = (html: string) => {
    // Sanitización básica - puedes reemplazar con DOMPurify si lo instalas
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "")
  }

  const renderContent = (content: string) => {
    if (!content) return null
    
    const sanitizedContent = sanitizeHTML(content)
    
    return (
      <div 
        className="rich-text-content prose prose-sm max-w-none"
        style={{ 
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          fontSize: '14px',
          lineHeight: '1.5'
        }}
        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {task.detailedContent && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Contenido Detallado</h3>
          <div className="p-4 bg-gray-50 rounded-md border">
            {renderContent(task.detailedContent)}
          </div>
        </div>
      )}
      
      {task.instructions && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Instrucciones Especiales</h3>
          <div className="p-4 bg-yellow-50 rounded-md border border-yellow-200">
            {renderContent(task.instructions)}
          </div>
        </div>
      )}
      
      {/* Estilos para el contenido renderizado */}
      <style jsx global>{`
        .rich-text-content h1 {
          font-size: 1.5rem;
          font-weight: bold;
          margin: 1rem 0;
          color: #111827;
        }
        
        .rich-text-content h2 {
          font-size: 1.25rem;
          font-weight: bold;
          margin: 0.75rem 0;
          color: #111827;
        }
        
        .rich-text-content h3 {
          font-size: 1.125rem;
          font-weight: bold;
          margin: 0.5rem 0;
          color: #111827;
        }
        
        .rich-text-content p {
          margin: 0.5rem 0;
          line-height: 1.5;
        }
        
        .rich-text-content ul,
        .rich-text-content ol {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
        }
        
        .rich-text-content li {
          margin: 0.25rem 0;
        }
        
        .rich-text-content blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1rem;
          margin: 0.5rem 0;
          font-style: italic;
          color: #6b7280;
        }
        
        .rich-text-content code {
          background-color: #f3f4f6;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
          font-size: 0.875em;
        }
        
        .rich-text-content pre {
          background-color: #f3f4f6;
          padding: 1rem;
          border-radius: 0.375rem;
          overflow-x: auto;
          margin: 0.5rem 0;
        }
        
        .rich-text-content pre code {
          background-color: transparent;
          padding: 0;
        }
        
        .rich-text-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 0.5rem 0;
        }
        
        .rich-text-content th,
        .rich-text-content td {
          border: 1px solid #e5e7eb;
          padding: 0.5rem;
          text-align: left;
        }
        
        .rich-text-content th {
          background-color: #f9fafb;
          font-weight: bold;
        }
        
        .rich-text-content a {
          color: #3b82f6;
          text-decoration: underline;
        }
        
        .rich-text-content a:hover {
          color: #2563eb;
        }
        
        .rich-text-content strong {
          font-weight: bold;
        }
        
        .rich-text-content em {
          font-style: italic;
        }
        
        .rich-text-content u {
          text-decoration: underline;
        }
        
        .rich-text-content s {
          text-decoration: line-through;
        }
        
        .rich-text-content .text-tiny {
          font-size: 0.75rem;
        }
        
        .rich-text-content .text-small {
          font-size: 0.875rem;
        }
        
        .rich-text-content .text-big {
          font-size: 1.125rem;
        }
        
        .rich-text-content .text-huge {
          font-size: 1.5rem;
        }
      `}</style>
    </div>
  )
}
