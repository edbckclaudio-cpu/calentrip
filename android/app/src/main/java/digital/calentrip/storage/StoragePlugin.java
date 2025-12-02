package digital.calentrip.storage;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "StorageFiles")
public class StoragePlugin extends Plugin {
  private File dir() {
    return getContext().getFilesDir();
  }

  @PluginMethod
  public void save(PluginCall call) {
    String name = call.getString("name", "");
    String json = call.getString("json", "");
    if (name == null) name = "";
    if (json == null) json = "";
    String safe = name.replaceAll("[^A-Za-z]", "");
    if (safe.length() == 0 || safe.length() > 9) {
      JSObject ret = new JSObject();
      ret.put("ok", false);
      ret.put("error", "invalid_name");
      call.resolve(ret);
      return;
    }
    try {
      File f = new File(dir(), safe + ".json");
      try (FileOutputStream fos = new FileOutputStream(f)) {
        fos.write(json.getBytes(StandardCharsets.UTF_8));
      }
      JSObject ret = new JSObject();
      ret.put("ok", true);
      ret.put("name", safe);
      call.resolve(ret);
    } catch (Exception e) {
      JSObject ret = new JSObject();
      ret.put("ok", false);
      ret.put("error", "write_failed");
      call.resolve(ret);
    }
  }

  @PluginMethod
  public void list(PluginCall call) {
    try {
      File d = dir();
      File[] files = d.listFiles();
      List<JSObject> arr = new ArrayList<>();
      if (files != null) {
        for (File f : files) {
          if (f.isFile() && f.getName().endsWith(".json")) {
            JSObject o = new JSObject();
            String n = f.getName();
            if (n.endsWith(".json")) n = n.substring(0, n.length() - 5);
            o.put("name", n);
            o.put("size", f.length());
            o.put("modified", f.lastModified());
            arr.add(o);
          }
        }
      }
      JSObject ret = new JSObject();
      ret.put("files", arr);
      call.resolve(ret);
    } catch (Exception e) {
      JSObject ret = new JSObject();
      ret.put("files", new ArrayList<>());
      call.resolve(ret);
    }
  }

  @PluginMethod
  public void read(PluginCall call) {
    String name = call.getString("name", "");
    if (name == null) name = "";
    String safe = name.replaceAll("[^A-Za-z]", "");
    if (safe.length() == 0 || safe.length() > 9) {
      JSObject ret = new JSObject();
      ret.put("ok", false);
      ret.put("error", "invalid_name");
      call.resolve(ret);
      return;
    }
    try {
      File f = new File(dir(), safe + ".json");
      if (!f.exists()) {
        JSObject ret = new JSObject();
        ret.put("ok", false);
        ret.put("error", "not_found");
        call.resolve(ret);
        return;
      }
      byte[] buf = new byte[(int) f.length()];
      try (FileInputStream fis = new FileInputStream(f)) {
        int read = fis.read(buf);
        if (read < 0) buf = new byte[0];
      }
      String json = new String(buf, StandardCharsets.UTF_8);
      JSObject ret = new JSObject();
      ret.put("ok", true);
      ret.put("json", json);
      ret.put("name", safe);
      call.resolve(ret);
    } catch (Exception e) {
      JSObject ret = new JSObject();
      ret.put("ok", false);
      ret.put("error", "read_failed");
      call.resolve(ret);
    }
  }

  @PluginMethod
  public void delete(PluginCall call) {
    String name = call.getString("name", "");
    if (name == null) name = "";
    String safe = name.replaceAll("[^A-Za-z]", "");
    if (safe.length() == 0 || safe.length() > 9) {
      JSObject ret = new JSObject();
      ret.put("ok", false);
      ret.put("error", "invalid_name");
      call.resolve(ret);
      return;
    }
    try {
      File f = new File(dir(), safe + ".json");
      boolean ok = f.exists() && f.delete();
      JSObject ret = new JSObject();
      ret.put("ok", ok);
      ret.put("name", safe);
      call.resolve(ret);
    } catch (Exception e) {
      JSObject ret = new JSObject();
      ret.put("ok", false);
      ret.put("error", "delete_failed");
      call.resolve(ret);
    }
  }
}
