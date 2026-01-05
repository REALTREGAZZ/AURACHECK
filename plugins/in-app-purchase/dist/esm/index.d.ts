import type { PluginListenerHandle } from '@capacitor/core';

type Purchase = Record<string, any>;

type Product = {
  productId?: string;
  title?: string;
  description?: string;
  localizedPrice?: string | null;
};

export interface InAppPurchasePlugin {
  initialize(options?: { ios?: boolean; android?: boolean }): Promise<{ ready: boolean }>;

  getProducts(options: { android?: string[]; products?: string[]; ios?: string[] }): Promise<{
    products: Product[];
    responseCode: number;
  }>;

  purchaseProduct(options: { productId: string }): Promise<{ responseCode: number }>;

  getPurchases(): Promise<{ purchases: Purchase[]; responseCode: number }>;

  finishTransaction(options: { purchase: Purchase }): Promise<{ acknowledged: boolean; responseCode: number }>;

  addListener(
    eventName: 'purchasesUpdated',
    listenerFunc: (data: { purchases: Purchase[]; responseCode: number }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
}

export const InAppPurchase: InAppPurchasePlugin;
