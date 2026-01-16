package digital.calentrip.android;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(android.os.Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    android.webkit.WebView webView = getBridge().getWebView();
    if (webView != null) {
      android.webkit.WebSettings s = webView.getSettings();
      try {
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setCacheMode(android.webkit.WebSettings.LOAD_NO_CACHE);
      } catch (Throwable ignored) {}
      webView.setBackgroundColor(android.graphics.Color.BLACK);
      try { webView.clearCache(true); webView.clearFormData(); webView.clearHistory(); } catch (Throwable ignored) {}
      // Deixar o WebView com aceleração de hardware padrão
    }
  }
}
