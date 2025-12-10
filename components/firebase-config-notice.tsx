"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

export function FirebaseConfigNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Configuración de Firebase Requerida</CardTitle>
          <CardDescription>
            Para usar esta aplicación, necesitas configurar las credenciales de Firebase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Las variables de entorno de Firebase no están configuradas. Sigue los pasos a continuación para comenzar.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Paso 1: Crear Proyecto Firebase</h3>
              <p className="text-sm text-muted-foreground mb-2">Ve a Firebase Console y crea un nuevo proyecto</p>
              <Button variant="outline" size="sm" asChild>
                <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer">
                  Abrir Firebase Console
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Paso 2: Habilitar Servicios</h3>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Authentication → Google Sign-in</li>
                <li>Firestore Database</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Paso 3: Obtener Credenciales</h3>
              <p className="text-sm text-muted-foreground mb-2">
                En Project Settings → General → Your apps, registra una aplicación web y copia las credenciales
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Paso 4: Configurar Variables de Entorno</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Crea un archivo <strong>.env.local</strong> en la raíz del proyecto y agrega las siguientes variables:
              </p>
              <div className="bg-muted p-4 rounded-lg text-sm font-mono space-y-1">
                <div>NEXT_PUBLIC_FIREBASE_API_KEY</div>
                <div>NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN</div>
                <div>NEXT_PUBLIC_FIREBASE_PROJECT_ID</div>
                <div>NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET</div>
                <div>NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID</div>
                <div>NEXT_PUBLIC_FIREBASE_APP_ID</div>
              </div>
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                Para más detalles, consulta el archivo <strong>FIREBASE_SETUP.md</strong> en la documentación del
                proyecto.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
