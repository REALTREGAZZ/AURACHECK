# 🚀 Guía Maestra: Publicación y Monetización de App Flutter (Play Store + IAP + AdMob)

Esta guía cubre todo el proceso para publicar tu app, activar la monetización (IAP y Ads) y gestionar los ingresos de forma legal y escalable, incluso siendo menor de edad y sin cuenta bancaria inicial.

---

## 🏗️ Fase 1: Preparación y Configuración (Guía A - Alta Velocidad)

### 1. Google Play Console
1.  **Registro**: Si ya pagaste los $25, accede a tu [Play Console](https://play.google.com/console).
2.  **Crear App**: Botón "Crear aplicación" -> Idioma: Inglés (o Español) -> Tipo: App -> Gratis/Pago: Gratis.
3.  **Configuración Inicial**: Completa el cuestionario de clasificación de contenido, política de privacidad y audiencia objetivo.

### 2. Configuración de Productos In-App (IAP)
Dentro de la Play Console, ve a **Monetizar > Productos > Productos integrados en la aplicación**.
Crea los siguientes IDs (coinciden con `billing_service.dart`):
*   `premium_month`: Suscripción mensual (ej. 4.99€).
*   `premium_lifetime`: Pago único (ej. 19.99€).
*   `coins_pack`: Consumible (ej. 0.99€ por 100 monedas).
*   **Importante**: Activa los productos para que estén disponibles.

### 3. Construcción del App Bundle
En tu terminal Flutter:
```bash
flutter build appbundle
```
El archivo generado estará en `build/app/outputs/bundle/release/app-release.aab`. Este es el archivo que subirás a Play Store.

---

## 💰 Fase 2: Implementación de Monetización (Guía B - Completa)

### 1. Servicios de Monetización (Código Listo)

#### A. `lib/services/billing_service.dart` (IAP)
Maneja las compras dentro de la app. **Obligatorio** para bienes digitales en Play Store.

```dart
import 'package:in_app_purchase/in_app_purchase.dart';
import 'dart:async';

class BillingService {
  final InAppPurchase _iap = InAppPurchase.instance;
  late StreamSubscription<List<PurchaseDetails>> _subscription;
  
  // IDs deben coincidir con Play Console
  final Set<String> _productIds = {'premium_month', 'premium_lifetime', 'coins_pack'};
  List<ProductDetails> products = [];

  void init() {
    final Stream<List<PurchaseDetails>> purchaseUpdated = _iap.purchaseStream;
    _subscription = purchaseUpdated.listen((purchaseDetailsList) {
      _listenToPurchaseUpdated(purchaseDetailsList);
    }, onDone: () {
      _subscription.cancel();
    }, onError: (error) {
      // Handle error
    });
    _loadProducts();
  }

  Future<void> _loadProducts() async {
    final bool available = await _iap.isAvailable();
    if (!available) return;
    
    final ProductDetailsResponse response = await _iap.queryProductDetails(_productIds);
    products = response.productDetails;
  }

  void buyProduct(ProductDetails product) {
    final PurchaseParam purchaseParam = PurchaseParam(productDetails: product);
    // Para suscripciones usa buyNonConsumable, para monedas buyConsumable
    if (product.id == 'coins_pack') {
      _iap.buyConsumable(purchaseParam: purchaseParam);
    } else {
      _iap.buyNonConsumable(purchaseParam: purchaseParam);
    }
  }

  void _listenToPurchaseUpdated(List<PurchaseDetails> purchaseDetailsList) {
    purchaseDetailsList.forEach((PurchaseDetails purchaseDetails) async {
      if (purchaseDetails.status == PurchaseStatus.pending) {
        // Mostrar spinner
      } else {
        if (purchaseDetails.status == PurchaseStatus.error) {
          // Manejar error
        } else if (purchaseDetails.status == PurchaseStatus.purchased ||
                   purchaseDetails.status == PurchaseStatus.restored) {
          // ✅ COMPRA EXITOSA: Aquí conectas con PaymentOrchestrator
          // await paymentOrchestrator.processPayment(userId, amount);
        }
        if (purchaseDetails.pendingCompletePurchase) {
          await _iap.completePurchase(purchaseDetails);
        }
      }
    });
  }
}
```

#### B. `lib/services/admob_service.dart` (Ads)
Muestra anuncios para monetizar usuarios gratuitos.

```dart
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'dart:io';

class AdmobService {
  // IDs de prueba de Google (ÚSALOS PARA DESARROLLO)
  final String bannerAdUnitId = Platform.isAndroid 
    ? 'ca-app-pub-3940256099942544/6300978111' 
    : 'ca-app-pub-3940256099942544/2934735716';

  static Future<void> init() async {
    await MobileAds.instance.initialize();
  }

  BannerAd createBannerAd() {
    return BannerAd(
      adUnitId: bannerAdUnitId,
      size: AdSize.banner,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (_) => print('Ad loaded'),
        onAdFailedToLoad: (ad, error) {
          ad.dispose();
          print('Ad failed to load: $error');
        },
      ),
    )..load();
  }
}
```

### 2. Acumulación de Ingresos (El "Banco" de Google)
*   **Cómo funciona**: Cuando un usuario compra algo, Google cobra y retiene el dinero en tu cuenta de Play Console.
*   **Sin cuenta bancaria**: Si no configuras una cuenta de pago, el dinero se **acumula indefinidamente**. No se pierde.
*   **Estrategia**: Deja que el dinero se acumule (meses o años) hasta que tengas 18 años o puedas añadir la cuenta de un tutor legal verificado. Es 100% seguro y legal.

---

## 🚀 Fase 3: Optimización y Escalado (Guía C - Ultra Pro)

### 1. Payment Orchestrator (Gestión de Ingresos Futuros)
Cuando finalmente cobres de Google (a tu cuenta bancaria o la de tu tutor), usarás este sistema para distribuir los fondos manualmente según tu lógica de negocio.

**Ubicación**: `lib/services/payment_orchestrator.dart`

```dart
import 'dart:math';
import '../models/payment_account.dart';
import '../models/payment_tx.dart';
import 'package:uuid/uuid.dart';

class PaymentOrchestrator {
  final String cryptoWallet; 
  final List<PaymentAccount> fiatAccounts;
  final double targetCryptoPct; // 0.75 (75%)

  PaymentOrchestrator({
    required this.cryptoWallet,
    required this.fiatAccounts,
    this.targetCryptoPct = 0.75,
  });

  Future<PaymentTx> processPayment({required String userId, required double amount}) async {
    // 1. Calcular división
    double cryptoAlloc = amount * targetCryptoPct;
    double fiatAlloc = amount - cryptoAlloc;
    
    Map<String, double> allocations = {};
    double remainingFiat = fiatAlloc;

    // 2. Distribuir Fiat solo a cuentas VERIFICADAS
    for (final acc in fiatAccounts) {
      if (remainingFiat <= 0) break;
      if (!acc.isVerified) continue; // 🛡️ COMPLIANCE CHECK

      double space = acc.monthlyLimit - acc.currentBalance;
      if (space <= 0) continue;

      double toAllocate = min(space, remainingFiat);
      acc.addBalance(toAllocate);
      allocations[acc.id] = toAllocate;
      remainingFiat -= toAllocate;
    }

    // 3. Overflow a Crypto
    if (remainingFiat > 0) {
      cryptoAlloc += remainingFiat;
    }

    // 4. Generar Transacción
    return PaymentTx(
      id: Uuid().v4(),
      userId: userId,
      grossAmount: amount,
      createdAt: DateTime.now(),
      allocations: {
        cryptoWallet: cryptoAlloc,
        ...allocations
      },
      status: 'completed',
    );
  }
}
```

### 2. Estrategia de Precios Psicológicos
Configura tus productos IAP con estos precios para maximizar conversión:
*   **Monedas**: 0.99€ (Compra impulsiva).
*   **Mes Premium**: 4.99€ (Estándar).
*   **Lifetime**: 19.99€ - 29.99€ (Ancla de valor alto).

### 3. Compliance Checklist (Antes de Publicar)
1.  [ ] **IAP**: Asegúrate de que `billing_service.dart` esté inicializado en `main.dart`.
2.  [ ] **Ads**: Usa IDs de prueba durante el desarrollo. Cambia a IDs reales de AdMob solo al publicar.
3.  [ ] **Política**: No incluyas botones de PayPal/Skrill dentro de la app Android para desbloquear funciones. Úsalos solo en tu web.
4.  [ ] **Privacidad**: Añade una URL de Política de Privacidad en la ficha de Play Store (generadores online gratuitos sirven).

---

## 📝 Resumen del Flujo de Dinero

1.  **Usuario paga** (IAP 4.99€).
2.  **Google procesa** y se queda su 15-30%.
3.  **Saldo acumulado** en Play Console (Tu "hucha" segura).
4.  **Futuro**:
    *   Añades cuenta bancaria (tutor o propia al ser mayor).
    *   Google transfiere el acumulado.
    *   Usas `PaymentOrchestrator` (mentalmente o en tu backend administrativo) para dividir ese ingreso neto: 75% a Crypto (vía exchange) y 25% a gastos/cuentas fiat.

¡Estás listo para lanzar! 🚀
