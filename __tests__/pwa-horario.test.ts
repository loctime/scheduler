// Test para verificar la funcionalidad de PWA horario
import { 
  setHorarioOwnerId, 
  getHorarioOwnerId, 
  getPwaHorarioUrls, 
  savePublishedHorario, 
  loadPublishedHorario,
  OWNER_ID_MISSING_ERROR,
  PWA_HORARIO_OWNER_ID_KEY 
} from '../lib/pwa-horario'

// Mock del entorno del navegador
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} }
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock de caches
const cacheMock = {
  store: new Map(),
  async open(name: string) {
    return {
      async put(url: string, response: Response) {
        this.store.set(url, response)
      },
      async match(url: string) {
        return this.store.get(url) || null
      }
    }
  }
}

Object.defineProperty(window, 'caches', {
  value: cacheMock
})

async function testPwaHorario() {
  console.log('🧪 Iniciando pruebas de PWA Horario...')
  
  // Test 1: Guardar y obtener ownerId
  console.log('\n📝 Test 1: Persistencia de ownerId')
  const testOwnerId = 'test-user-123'
  
  setHorarioOwnerId(testOwnerId)
  const retrievedOwnerId = getHorarioOwnerId()
  
  if (retrievedOwnerId === testOwnerId) {
    console.log('✅ ownerId guardado y recuperado correctamente')
  } else {
    console.error('❌ Error al guardar/recuperar ownerId')
    return
  }
  
  // Test 2: getPwaHorarioUrls con ownerId explícito
  console.log('\n🔗 Test 2: URLs con ownerId explícito')
  try {
    const urls = getPwaHorarioUrls('explicit-owner')
    console.log('✅ URLs generadas con ownerId explícito:', urls)
  } catch (error) {
    console.error('❌ Error al generar URLs con ownerId explícito:', error)
    return
  }
  
  // Test 3: getPwaHorarioUrls con ownerId del localStorage
  console.log('\n🔗 Test 3: URLs con ownerId del localStorage')
  try {
    const urls = getPwaHorarioUrls()
    console.log('✅ URLs generadas desde localStorage:', urls)
  } catch (error) {
    console.error('❌ Error al generar URLs desde localStorage:', error)
    return
  }
  
  // Test 4: getPwaHorarioUrls sin ownerId (debe lanzar error)
  console.log('\n❌ Test 4: URLs sin ownerId (debe fallar)')
  try {
    localStorageMock.removeItem(PWA_HORARIO_OWNER_ID_KEY)
    const urls = getPwaHorarioUrls()
    console.error('❌ No se lanzó el error esperado')
    return
  } catch (error) {
    if (error.message === OWNER_ID_MISSING_ERROR) {
      console.log('✅ Error lanzado correctamente cuando no hay ownerId')
    } else {
      console.error('❌ Error incorrecto:', error)
      return
    }
  }
  
  // Test 5: savePublishedHorario
  console.log('\n💾 Test 5: Guardar horario publicado')
  try {
    setHorarioOwnerId(testOwnerId) // Restaurar ownerId para el test
    
    const imageBlob = new Blob(['test image'], { type: 'image/png' })
    const metadata = await savePublishedHorario({
      imageBlob,
      weekStart: '2024-01-01',
      weekEnd: '2024-01-07',
      ownerId: testOwnerId
    })
    
    console.log('✅ Horario guardado correctamente:', metadata)
  } catch (error) {
    console.error('❌ Error al guardar horario:', error)
    return
  }
  
  // Test 6: loadPublishedHorario
  console.log('\n📂 Test 6: Cargar horario publicado')
  try {
    const result = await loadPublishedHorario(testOwnerId)
    
    if (result && result.imageBlob && result.metadata) {
      console.log('✅ Horario cargado correctamente')
      console.log('Metadata:', result.metadata)
    } else {
      console.error('❌ No se pudo cargar el horario')
      return
    }
  } catch (error) {
    console.error('❌ Error al cargar horario:', error)
    return
  }
  
  // Test 7: loadPublishedHorario sin ownerId (usando localStorage)
  console.log('\n📂 Test 7: Cargar horario sin ownerId explícito')
  try {
    const result = await loadPublishedHorario()
    
    if (result && result.imageBlob && result.metadata) {
      console.log('✅ Horario cargado correctamente desde localStorage')
    } else {
      console.error('❌ No se pudo cargar el horario desde localStorage')
      return
    }
  } catch (error) {
    console.error('❌ Error al cargar horario desde localStorage:', error)
    return
  }
  
  console.log('\n🎉 Todas las pruebas pasaron correctamente!')
}

// Ejecutar pruebas
testPwaHorario().catch(console.error)
