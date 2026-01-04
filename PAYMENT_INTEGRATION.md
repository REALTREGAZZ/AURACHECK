# Payment Integration Guide

## Sistema de Pagos Integrado en VibeScan AI (Web)

He integrado el sistema de orquestación de pagos en tu app web. Aquí está lo que he añadido:

### 📂 Archivos Nuevos

1. **`payment-orchestrator.js`**: Sistema de gestión de pagos en JavaScript
   - Clase `PaymentAccount` para gestionar cuentas
   - Clase `PaymentOrchestrator` con la lógica de distribución
   - Almacenamiento en `localStorage` para historial de transacciones

2. **`payment.html`**: Página de pagos/donaciones
   - Botones para PayPal, Skrill y Crypto
   - UI moderna con gradientes y efectos
   - Integración con el orchestrator

### 🎯 Cómo Funciona

#### En la App Principal:
- Añadí un botón **"💸 SUPPORT US"** en la pantalla principal
- Al hacer clic, te lleva a `/payment.html`

#### En la Página de Pagos:
1. El usuario elige método de pago (PayPal, Skrill, Crypto)
2. Ingresa el monto
3. El sistema:
   - Registra la transacción con `PaymentOrchestrator`
   - Calcula la distribución (75% Crypto, 25% Fiat)
   - Guarda el log en `localStorage`
   - Abre el checkout externo

### 🔧 Configuración Necesaria

Edita `payment.html` líneas **90-106** para añadir tus datos reales:

```javascript
const accounts = [
  new PaymentAccount({
    id: 'paypal_main',
    provider: 'paypal',
    addressOrEmail: 'TU-EMAIL-PAYPAL@example.com', // ✏️ CAMBIAR
    monthlyLimit: 1000,
    isVerified: true,
    isAdultOwned: true
  }),
  // ... más cuentas
];
```

Y actualiza los enlaces de checkout (líneas **124-129**):

```javascript
if (provider === 'paypal') {
  url = `https://www.paypal.com/paypalme/TUNOMBRE/${amount}EUR`; // ✏️ CAMBIAR
}
```

### 📊 Ver Historial de Transacciones

Abre la consola del navegador y ejecuta:
```javascript
window.paymentOrchestrator.getHistory()
```

### 🚀 Prueba Local

Accede a:
- **App principal**: http://localhost:5173/
- **Página de pagos**: http://localhost:5173/payment.html

El sistema está 100% funcional y listo para recibir donaciones/pagos cuando configures tus datos reales.
