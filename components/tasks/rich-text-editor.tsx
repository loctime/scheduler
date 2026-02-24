"use client"

import { CKEditor } from "@ckeditor/ckeditor5-react"
import ClassicEditor from "@ckeditor/ckeditor5-build-classic"
import { useEffect, useRef, useState } from "react"
import "@/lib/ckeditor-license-fix"

interface RichTextEditorProps {
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
}: RichTextEditorProps) {
  const editorRef = useRef<any>(null)
  const [isReady, setIsReady] = useState(false)

  console.log("RichTextEditor - value:", value)
  console.log("RichTextEditor - disabled:", disabled)

  // Configuración profesional del toolbar
  const editorConfiguration = {
    // Eliminar licenseKey para usar versión GPL sin advertencias
    placeholder,
    toolbar: {
      items: [
        "undo",
        "redo",
        "|",
        "heading",
        "|",
        "bold",
        "italic",
        "underline",
        "strikethrough",
        "|",
        "fontSize",
        "fontColor",
        "fontBackgroundColor",
        "|",
        "alignment",
        "|",
        "bulletedList",
        "numberedList",
        "blockquote",
        "codeBlock",
        "|",
        "link",
        "insertTable",
        "|"
      ],
      shouldNotGroupWhenFull: true
    },
    heading: {
      options: [
        { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
        { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
        { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
        { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' }
      ]
    } as any,
    fontSize: {
      options: [
        'tiny',
        'small',
        'default',
        'big',
        'huge'
      ]
    } as any,
    table: {
      contentToolbar: [
        'tableColumn',
        'tableRow',
        'mergeTableCells',
        'tableCellProperties',
        'tableProperties'
      ]
    } as any,
    link: {
      addTargetToExternalLinks: true,
      decorators: [
        {
          mode: 'manual',
          label: 'Downloadable',
          attributes: {
            download: 'download'
          }
        }
      ]
    } as any,
    language: "es"
  }

  // Manejar cambios del editor
  const handleEditorChange = (_event: any, editor: any) => {
    if (editor && editor.getData && isReady) {
      try {
        const data = editor.getData()
        onChange(data)
      } catch (error) {
        console.warn('Error getting editor data:', error)
      }
    }
  }

  // Manejar la inicialización del editor
  const handleEditorReady = (editor: any) => {
    editorRef.current = editor
    setIsReady(true)
    
    // Establecer el valor inicial si existe
    if (value && editor && editor.setData) {
      try {
        editor.setData(value)
      } catch (error) {
        console.warn('Error setting initial data:', error)
      }
    }
  }

  // Manejar errores del editor
  const handleError = (error: any) => {
    // Ignorar errores de licencia - es normal en versión GPL
    if (error?.includes?.('license-key-missing') || error?.message?.includes?.('license-key-missing')) {
      return
    }
    console.error('CKEditor error:', error)
  }

  // Limpiar el editor al desmontar
  useEffect(() => {
    return () => {
      if (editorRef.current && editorRef.current.destroy) {
        try {
          editorRef.current.destroy()
        } catch (error) {
          console.warn('Error destroying editor:', error)
        }
        editorRef.current = null
      }
    }
  }, [])

  return (
    <div className="rich-text-editor">
      <CKEditor
        editor={ClassicEditor}
        config={editorConfiguration}
        data={value || ""}
        disabled={disabled}
        onChange={handleEditorChange}
        onReady={handleEditorReady}
        onError={handleError}
      />
      
      {/* Estilos críticos para visibilidad del editor */}
      <style jsx global>{`
        .ck-editor {
          display: block !important;
          width: 100% !important;
        }
        
        .ck-editor__main {
          display: block !important;
        }
        
        .ck-editor__editable {
          display: block !important;
          min-height: 200px !important;
          max-height: 500px !important;
          overflow-y: auto !important;
          padding: 1rem !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 0.375rem !important;
          background-color: white !important;
        }
        
        .ck-editor__editable_inline {
          display: block !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 0.375rem !important;
          border-top: none !important;
        }
        
        .ck-toolbar {
          display: block !important;
          border: 1px solid #e5e7eb !important;
          border-bottom: none !important;
          border-radius: 0.375rem 0.375rem 0 0 !important;
          background: #f9fafb !important;
          padding: 0.5rem !important;
        }
        
        .ck.ck-editor {
          display: block !important;
          border-radius: 0.375rem !important;
          overflow: hidden !important;
          border: 1px solid #e5e7eb !important;
        }
        
        .ck.ck-editor__main > .ck-editor__editable {
          border-top: none !important;
        }
        
        .ck-toolbar__items {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 0.25rem !important;
        }
        
        .ck-button {
          display: inline-flex !important;
          align-items: center !important;
          padding: 0.25rem 0.5rem !important;
          border: 1px solid #d1d5db !important;
          border-radius: 0.25rem !important;
          background: white !important;
          cursor: pointer !important;
        }
        
        .ck-button:hover {
          background: #f3f4f6 !important;
        }
        
        .ck-button__label {
          font-size: 0.875rem !important;
        }
        
        /* Estilos para contenido renderizado */
        .rich-text-content h1 {
          font-size: 2rem;
          font-weight: bold;
          margin: 1rem 0;
        }
        
        .rich-text-content h2 {
          font-size: 1.5rem;
          font-weight: bold;
          margin: 0.75rem 0;
        }
        
        .rich-text-content h3 {
          font-size: 1.25rem;
          font-weight: bold;
          margin: 0.5rem 0;
        }
        
        .rich-text-content ul,
        .rich-text-content ol {
          margin: 0.5rem 0;
          padding-left: 2rem;
        }
        
        .rich-text-content blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1rem;
          margin: 0.5rem 0;
          font-style: italic;
        }
        
        .rich-text-content code {
          background-color: #f3f4f6;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-family: monospace;
        }
        
        .rich-text-content pre {
          background-color: #f3f4f6;
          padding: 1rem;
          border-radius: 0.375rem;
          overflow-x: auto;
          margin: 0.5rem 0;
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
      `}</style>
    </div>
  )
}
