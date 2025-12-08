package digital.calentrip;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import digital.calentrip.billing.BillingPlugin;
import digital.calentrip.calendar.CalendarPlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    try { this.registerPlugin(BillingPlugin.class); } catch (Exception ignored) {}
    try { this.registerPlugin(CalendarPlugin.class); } catch (Exception ignored) {}
  }
}
