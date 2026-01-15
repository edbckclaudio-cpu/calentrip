package digital.calentrip.android;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(android.os.Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    android.webkit.WebView webView = getBridge().getWebView();
    if (webView != null) {
      webView.setLayerType(android.view.View.LAYER_TYPE_SOFTWARE, null);
    }
  }
}
