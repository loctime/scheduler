"use client"

import { useState, useEffect, useRef } from "react"

interface SimpleRichTextEditorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  placeholder = "Escribe aquí..."
}: SimpleRichTextEditorProps) {
  const [content, setContent] = useState(value || "")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setContent(value || "")
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setContent(newContent)
    onChange(newContent)
  }

  // Funciones de formato simples
  const insertText = (before: string, after: string = "") => {
    if (!textareaRef.current) return
    
    const start = textareaRef.current.selectionStart
    const end = textareaRef.current.selectionEnd
    const selectedText = content.substring(start, end)
    const newText = before + selectedText + after
    
    const newContent = content.substring(0, start) + newText + content.substring(end)
    setContent(newContent)
    onChange(newContent)
    
    // Restaurar cursor
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.selectionStart = start + before.length
        textareaRef.current.selectionEnd = start + before.length + selectedText.length
      }
    }, 0)
  }

  const insertBold = () => insertText("**", "**")
  const insertItalic = () => insertText("*", "*")
  const insertUnderline = () => insertText("__", "__")
  const insertStrike = () => insertText("~~", "~~")
  const insertHeading = (level: number) => insertText("#".repeat(level) + " ", "")
  const insertLink = () => {
    const url = prompt("Ingrese la URL:")
    if (url) insertText("[", `](${url})`)
  }
  const insertList = (ordered: boolean) => {
    const prefix = ordered ? "1. " : "- "
    insertText(prefix, "")
  }
  const insertQuote = () => insertText("> ", "")
  const insertCode = () => insertText("`", "`")
  const insertCodeBlock = () => insertText("```\n", "\n```")

  return (
    <div className="simple-rich-text-editor border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="bg-gray-50 border-b p-2 flex flex-wrap gap-1">
        <div className="flex gap-1 mr-2">
          <button
            type="button"
            onClick={insertBold}
            disabled={disabled}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
            title="Negrita"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            onClick={insertItalic}
            disabled={disabled}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
            title="Cursiva"
          >
            <em>I</em>
          </button>
          <button
            type="button"
            onClick={insertUnderline}
            disabled={disabled}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
            title="Subrayado"
          >
            <u>U</u>
          </button>
          <button
            type="button"
            onClick={insertStrike}
            disabled={disabled}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
            title="Tachado"
          >
            <s>S</s>
          </button>
        </div>

        <div className="flex gap-1 mr-2">
          <select
            onChange={(e) => {
              const level = parseInt(e.target.value)
              if (level > 0) insertHeading(level)
            }}
            disabled={disabled}
            className="px-2 py-1 text-sm border rounded disabled:opacity-50"
            title="Título"
          >
            <option value="">Título</option>
            <option value="1">Título 1</option>
            <option value="2">Título 2</option>
            <option value="3">Título 3</option>
          </select>
        </div>

        <div className="flex gap-1 mr-2">
          <button
            type="button"
            onClick={insertList.bind(null, false)}
            disabled={disabled}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
            title="Lista sin orden"
          >
            •
          </button>
          <button
            type="button"
            onClick={insertList.bind(null, true)}
            disabled={disabled}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
            title="Lista ordenada"
          >
            1.
          </button>
          <button
            type="button"
            onClick={insertQuote}
            disabled={disabled}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
            title="Cita"
          >
            "
          </button>
          <button
            type="button"
            onClick={insertCode}
            disabled={disabled}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
            title="Código"
          >
            {'</>'}
          </button>
          <button
            type="button"
            onClick={insertCodeBlock}
            disabled={disabled}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
            title="Bloque de código"
          >
            {'{ }'}
          </button>
        </div>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={insertLink}
            disabled={disabled}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
            title="Enlace"
          >
            🔗
          </button>
        </div>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full p-3 min-h-[200px] max-h-[500px] resize-y focus:outline-none"
        style={{ 
          fontFamily: 'monospace',
          fontSize: '14px',
          lineHeight: '1.5'
        }}
      />

      {/* Preview */}
      <div className="border-t p-3 bg-gray-50">
        <div className="text-xs text-gray-500 mb-2">Vista previa:</div>
        <div 
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ 
            __html: content
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.*?)\*/g, '<em>$1</em>')
              .replace(/__(.*?)__/g, '<u>$1</u>')
              .replace(/~~(.*?)~~/g, '<s>$1</s>')
              .replace(/^#{1,6}\s+(.*)$/gm, (match, text) => {
                const level = match.match(/^#+/)?.[0]?.length || 1
                return `<h${Math.min(level, 6)}>${text}</h${Math.min(level, 6)}>`
              })
              .replace(/^\d+\.\s+(.*)$/gm, '<li>$1</li>')
              .replace(/^-\s+(.*)$/gm, '<li>$1</li>')
              .replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>')
              .replace(/`(.*?)`/g, '<code>$1</code>')
              .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
              .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
              .replace(/\n/g, '<br>')
          }}
        />
      </div>
    </div>
  )
}
