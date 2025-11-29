package digital.calentrip;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import digital.calentrip.billing.BillingPlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    try { this.registerPlugin(BillingPlugin.class); } catch (Exception ignored) {}
  }
}
