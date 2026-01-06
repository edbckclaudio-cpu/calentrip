package digital.calentrip.billing;

import android.app.Activity;
import android.util.Log;
import androidx.annotation.Nullable;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "Billing")
public class BillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private BillingClient billingClient;
    private ProductDetails cachedProduct;
    private String cachedOfferToken = null;
    private String lastToken = null;

    @Override
    public void load() {
        Activity activity = getActivity();
        billingClient = BillingClient.newBuilder(activity)
                .enablePendingPurchases()
                .setListener(this)
                .build();
        billingClient.startConnection(new BillingClientStateListener() {
            @Override public void onBillingServiceDisconnected() { Log.w("Billing", "service disconnected"); }
            @Override public void onBillingSetupFinished(BillingResult billingResult) {
                Log.i("Billing", "setup: " + billingResult.getResponseCode());
            }
        });
    }

    @PluginMethod
    public void isReady(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ready", billingClient != null && billingClient.isReady());
        call.resolve(ret);
    }

    @PluginMethod
    public void queryProduct(PluginCall call) {
        String productId = call.getString("productId", "trip_premium");
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        products.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.SUBS)
                .build());
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder().setProductList(products).build();
        billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsList) -> {
            JSObject ret = new JSObject();
            ret.put("code", billingResult.getResponseCode());
            if (productDetailsList != null && !productDetailsList.isEmpty()) {
                cachedProduct = productDetailsList.get(0);
                cachedOfferToken = null;
                ret.put("found", true);
                ret.put("title", cachedProduct.getTitle());
                try {
                    List<ProductDetails.SubscriptionOfferDetails> offers = cachedProduct.getSubscriptionOfferDetails();
                    if (offers != null && !offers.isEmpty()) {
                        ProductDetails.SubscriptionOfferDetails offer = offers.get(0);
                        cachedOfferToken = offer.getOfferToken();
                        String price = null;
                        List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
                        if (phases != null && !phases.isEmpty()) {
                            // Use first phase formatted price (intro or base)
                            price = phases.get(0).getFormattedPrice();
                        }
                        ret.put("price", price);
                    } else {
                        ret.put("price", null);
                    }
                } catch (Exception e) {
                    ret.put("price", null);
                }
            } else {
                ret.put("found", false);
            }
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void purchaseTripPremium(PluginCall call) {
        String productId = call.getString("productId", "trip_premium");
        if (cachedProduct == null || !productId.equals(cachedProduct.getProductId())) {
            call.reject("Product not loaded. Call queryProduct first.");
            return;
        }
        List<BillingFlowParams.ProductDetailsParams> pdp = new ArrayList<>();
        BillingFlowParams.ProductDetailsParams.Builder builder = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(cachedProduct);
        if (cachedOfferToken != null) {
            builder.setOfferToken(cachedOfferToken);
        }
        pdp.add(builder.build());
        BillingFlowParams flowParams = BillingFlowParams.newBuilder().setProductDetailsParamsList(pdp).build();
        BillingResult res = billingClient.launchBillingFlow(getActivity(), flowParams);
        JSObject ret = new JSObject();
        ret.put("code", res.getResponseCode());
        call.resolve(ret);
    }

    @Override
    public void onPurchasesUpdated(BillingResult billingResult, @Nullable List<Purchase> list) {
        Log.i("Billing", "purchase updated: code=" + billingResult.getResponseCode());
        try {
            if (list != null) {
                for (Purchase p : list) {
                    lastToken = p.getPurchaseToken();
                    JSObject ev = new JSObject();
                    ev.put("token", lastToken);
                    ev.put("products", p.getProducts());
                    notifyListeners("purchase", ev);
                }
            }
        } catch (Exception ignored) {}
    }

    @PluginMethod
    public void getLastToken(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("token", lastToken);
        call.resolve(ret);
    }
}
