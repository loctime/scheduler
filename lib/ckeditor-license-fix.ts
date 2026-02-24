// Suprimir errores de licencia de CKEditor en desarrollo
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error
  console.error = (...args: any[]) => {
    const message = args[0]
    if (
      typeof message === 'string' && 
      (message.includes('license-key-missing') || 
       message.includes('CKEditorError: license-key-missing'))
    ) {
      return // Ignorar errores de licencia
    }
    originalConsoleError.apply(console, args)
  }
}
