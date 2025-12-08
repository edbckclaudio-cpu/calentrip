package digital.calentrip.calendar;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import android.text.TextUtils;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;
import java.util.TimeZone;

@CapacitorPlugin(name = "CalendarPlugin")
public class CalendarPlugin extends Plugin {

  private boolean hasPermission() {
    Context ctx = getContext();
    int r = ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_CALENDAR);
    int w = ContextCompat.checkSelfPermission(ctx, Manifest.permission.WRITE_CALENDAR);
    return r == android.content.pm.PackageManager.PERMISSION_GRANTED && w == android.content.pm.PackageManager.PERMISSION_GRANTED;
  }

  @PluginMethod
  public void requestPermissions(PluginCall call) {
    boolean granted = hasPermission();
    if (!granted && getActivity() != null) {
      ActivityCompat.requestPermissions(
        getActivity(),
        new String[]{Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR},
        1001
      );
    }
    JSObject ret = new JSObject();
    ret.put("granted", hasPermission());
    call.resolve(ret);
  }

  private long resolveCalendarId(ContentResolver cr) {
    Cursor cursor = null;
    try {
      Uri uri = CalendarContract.Calendars.CONTENT_URI;
      String[] projection = new String[]{
        CalendarContract.Calendars._ID,
        CalendarContract.Calendars.IS_PRIMARY,
        CalendarContract.Calendars.VISIBLE
      };
      cursor = cr.query(uri, projection, null, null, null);
      long fallbackId = -1;
      if (cursor != null) {
        while (cursor.moveToNext()) {
          long id = cursor.getLong(0);
          int isPrimary = cursor.getInt(1);
          int visible = cursor.getInt(2);
          if (visible == 1 && isPrimary == 1) {
            return id;
          }
          if (fallbackId < 0 && visible == 1) fallbackId = id;
        }
      }
      return fallbackId;
    } finally {
      if (cursor != null) cursor.close();
    }
  }

  @PluginMethod
  public void addEvents(PluginCall call) {
    JSObject ret = new JSObject();
    List<String> errors = new ArrayList<>();
    int added = 0;

    if (!hasPermission()) {
      ret.put("ok", false);
      ret.put("added", 0);
      errors.add("permission");
      ret.put("errors", errors);
      call.resolve(ret);
      return;
    }

    JSObject input = call.getObject("events", null);
    // When using Capacitor, arrays come as JSArray in call.getArray, but for simplicity we read as Any
    // We will retrieve from call.getArray("events") instead
    com.getcapacitor.JSArray arr = call.getArray("events");
    if (arr == null) {
      ret.put("ok", false);
      ret.put("added", 0);
      errors.add("no_events");
      ret.put("errors", errors);
      call.resolve(ret);
      return;
    }

    ContentResolver cr = getContext().getContentResolver();
    long calId = resolveCalendarId(cr);
    if (calId < 0) {
      ret.put("ok", false);
      ret.put("added", 0);
      errors.add("no_calendar");
      ret.put("errors", errors);
      call.resolve(ret);
      return;
    }

    String tz = TimeZone.getDefault().getID();

    try {
      for (int i = 0; i < arr.length(); i++) {
        JSObject ev = arr.getJSONObject(i);
        String startISO = ev.getString("startISO");
        String endISO = ev.getString("endISO");
        String title = ev.getString("title");
        String description = ev.getString("description");

        if (TextUtils.isEmpty(startISO) || TextUtils.isEmpty(title)) {
          errors.add("invalid_event_" + i);
          continue;
        }

        long dtStart = parseIso(startISO);
        long dtEnd = !TextUtils.isEmpty(endISO) ? parseIso(endISO) : dtStart + (60 * 60 * 1000);
        if (dtStart <= 0) { errors.add("invalid_start_" + i); continue; }

        ContentValues values = new ContentValues();
        values.put(CalendarContract.Events.CALENDAR_ID, calId);
        values.put(CalendarContract.Events.TITLE, title);
        if (!TextUtils.isEmpty(description)) values.put(CalendarContract.Events.DESCRIPTION, description);
        values.put(CalendarContract.Events.DTSTART, dtStart);
        values.put(CalendarContract.Events.DTEND, dtEnd);
        values.put(CalendarContract.Events.EVENT_TIMEZONE, tz);

        Uri uri = cr.insert(CalendarContract.Events.CONTENT_URI, values);
        if (uri != null) {
          added++;
        } else {
          errors.add("insert_failed_" + i);
        }
      }
    } catch (Exception e) {
      errors.add("exception");
    }

    ret.put("ok", added > 0);
    ret.put("added", added);
    ret.put("errors", errors);
    call.resolve(ret);
  }

  private long parseIso(String iso) {
    try {
      java.time.Instant instant = java.time.Instant.parse(iso);
      return instant.toEpochMilli();
    } catch (Throwable t) {
      try {
        return Long.parseLong(iso);
      } catch (Throwable ignored) { return -1; }
    }
  }
}
