package com.capacitorcommunity.inapppurchase;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesResponseListener;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.PluginMethod;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "InAppPurchase")
public class InAppPurchasePlugin extends Plugin implements PurchasesUpdatedListener {

    private BillingClient billingClient;
    private boolean isReady = false;
    private final Map<String, ProductDetails> productCache = new HashMap<>();

    @PluginMethod
    public void initialize(PluginCall call) {
        if (billingClient != null && isReady) {
            call.resolve(new JSObject().put("ready", true));
            return;
        }

        billingClient = BillingClient.newBuilder(getContext())
            .enablePendingPurchases()
            .setListener(this)
            .build();

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    isReady = true;
                    call.resolve(new JSObject().put("ready", true));
                } else {
                    call.reject("BillingClient init failed", String.valueOf(billingResult.getResponseCode()));
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                isReady = false;
            }
        });
    }

    @PluginMethod
    public void getProducts(PluginCall call) {
        if (!ensureReady(call)) return;

        List<String> ids = readProductIds(call);
        if (ids.isEmpty()) {
            call.resolve(new JSObject().put("products", new JSArray()));
            return;
        }

        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String id : ids) {
            products.add(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(id)
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build()
            );
        }

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
            .setProductList(products)
            .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsList) -> {
            JSArray out = new JSArray();

            if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && productDetailsList != null) {
                for (ProductDetails details : productDetailsList) {
                    productCache.put(details.getProductId(), details);

                    String price = null;
                    if (details.getOneTimePurchaseOfferDetails() != null) {
                        price = details.getOneTimePurchaseOfferDetails().getFormattedPrice();
                    }

                    JSObject obj = new JSObject();
                    obj.put("productId", details.getProductId());
                    obj.put("title", details.getTitle());
                    obj.put("description", details.getDescription());
                    obj.put("localizedPrice", price);
                    out.put(obj);
                }
            }

            JSObject result = new JSObject();
            result.put("products", out);
            result.put("responseCode", billingResult.getResponseCode());
            call.resolve(result);
        });
    }

    @PluginMethod
    public void purchaseProduct(PluginCall call) {
        if (!ensureReady(call)) return;

        String productId = call.getString("productId");
        if (productId == null || productId.isEmpty()) {
            call.reject("productId requerido");
            return;
        }

        ProductDetails cached = productCache.get(productId);
        if (cached != null) {
            launchBillingFlow(call, cached);
            return;
        }

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
            .setProductList(Collections.singletonList(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(productId)
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build()
            ))
            .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsList) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK || productDetailsList == null || productDetailsList.isEmpty()) {
                call.reject("Producto no encontrado", String.valueOf(billingResult.getResponseCode()));
                return;
            }

            ProductDetails details = productDetailsList.get(0);
            productCache.put(details.getProductId(), details);
            launchBillingFlow(call, details);
        });
    }

    @PluginMethod
    public void getPurchases(PluginCall call) {
        if (!ensureReady(call)) return;

        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.INAPP)
            .build();

        billingClient.queryPurchasesAsync(params, (billingResult, purchases) -> {
            JSArray out = new JSArray();
            if (purchases != null) {
                for (Purchase purchase : purchases) {
                    out.put(purchaseToJS(purchase));
                    maybeAcknowledge(purchase);
                }
            }

            JSObject result = new JSObject();
            result.put("purchases", out);
            result.put("responseCode", billingResult.getResponseCode());
            call.resolve(result);
        });
    }

    @PluginMethod
    public void finishTransaction(PluginCall call) {
        if (!ensureReady(call)) return;

        JSObject purchase = call.getObject("purchase");
        if (purchase == null) {
            call.reject("purchase requerido");
            return;
        }

        String token = purchase.getString("purchaseToken");
        if (token == null || token.isEmpty()) {
            call.reject("purchaseToken requerido");
            return;
        }

        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(token)
            .build();

        billingClient.acknowledgePurchase(params, billingResult -> {
            JSObject res = new JSObject();
            res.put("acknowledged", billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK);
            res.put("responseCode", billingResult.getResponseCode());
            call.resolve(res);
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        JSArray out = new JSArray();

        if (purchases != null) {
            for (Purchase purchase : purchases) {
                out.put(purchaseToJS(purchase));
                maybeAcknowledge(purchase);
            }
        }

        JSObject payload = new JSObject();
        payload.put("purchases", out);
        payload.put("responseCode", billingResult.getResponseCode());

        notifyListeners("purchasesUpdated", payload, true);
    }

    private boolean ensureReady(PluginCall call) {
        if (billingClient == null || !isReady) {
            call.reject("BillingClient no inicializado");
            return false;
        }
        return true;
    }

    private List<String> readProductIds(PluginCall call) {
        List<String> ids = new ArrayList<>();

        JSArray android = call.getArray("android");
        JSArray products = call.getArray("products");

        JSArray source = android != null ? android : products;
        if (source == null) return ids;

        for (int i = 0; i < source.length(); i++) {
            try {
                String id = source.getString(i);
                if (id != null && !id.isEmpty()) ids.add(id);
            } catch (Exception ignored) {
                // ignore
            }
        }

        return ids;
    }

    private void launchBillingFlow(PluginCall call, ProductDetails details) {
        BillingFlowParams.ProductDetailsParams productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(details)
            .build();

        BillingFlowParams flowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(Collections.singletonList(productParams))
            .build();

        getActivity().runOnUiThread(() -> {
            BillingResult result = billingClient.launchBillingFlow(getActivity(), flowParams);

            JSObject out = new JSObject();
            out.put("responseCode", result.getResponseCode());
            call.resolve(out);
        });
    }

    private JSObject purchaseToJS(Purchase purchase) {
        JSObject obj = new JSObject();

        String productId = null;
        if (purchase.getProducts() != null && !purchase.getProducts().isEmpty()) {
            productId = purchase.getProducts().get(0);
        }

        obj.put("productId", productId);
        obj.put("purchaseToken", purchase.getPurchaseToken());
        obj.put("orderId", purchase.getOrderId());
        obj.put("acknowledged", purchase.isAcknowledged());

        if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
            obj.put("state", "Purchased");
        } else {
            obj.put("state", "Pending");
        }

        return obj;
    }

    private void maybeAcknowledge(Purchase purchase) {
        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) return;
        if (purchase.isAcknowledged()) return;

        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.getPurchaseToken())
            .build();

        billingClient.acknowledgePurchase(params, billingResult -> {
            // no-op
        });
    }
}
