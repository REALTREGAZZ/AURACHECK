# 🚀 VibeScan Lite (Web Version)

Esta es la versión ultra-ligera de VibeScan. No requiere Flutter ni Android Studio. Funciona directamente en tu navegador y se puede instalar como una App.

## ⚡ Cómo iniciar (Modo Rápido)

Simplemente ejecuta este comando en la terminal:

```bash
cd web-version
npm run dev
```

Luego abre el link que aparece (usualmente `http://localhost:5173`) en tu navegador.

## 📱 Cómo instalar en Android

1. Abre la app en Chrome en tu móvil (necesitas estar en la misma red WiFi y usar la IP de tu PC, ej: `http://192.168.1.X:5173`).
2. Toca los 3 puntos (menú) -> **"Instalar aplicación"** o **"Agregar a la pantalla principal"**.
3. ¡Listo! Ahora funcionará como una app nativa, a pantalla completa y sin barra de direcciones.

## 🛠️ Convertir a APK real (Opcional)

Si necesitas un archivo `.apk` para subir a la Play Store, podemos usar **Capacitor**:

1. `npm install @capacitor/core @capacitor/cli @capacitor/android`
2. `npx cap init`
3. `npx cap add android`
4. `npx cap sync`
