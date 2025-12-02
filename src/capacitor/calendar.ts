import { registerPlugin, Capacitor } from "@capacitor/core";

export type EventInput = { startISO: string; endISO?: string; title: string; description?: string };
export type AddEventsResult = { ok: boolean; added: number; errors?: string[] };

type CalendarPluginType = {
  addEvents(input: { events: EventInput[] }): Promise<AddEventsResult>;
  requestPermissions(): Promise<{ granted: boolean }>;
};

export const Calendar = registerPlugin<CalendarPluginType>("CalendarPlugin", {
  web: {
    async addEvents() {
      return { ok: false, added: 0, errors: ["web"] };
    },
    async requestPermissions() {
      return { granted: false };
    },
  },
});

export function isCapAndroid() {
  try { return Capacitor.getPlatform() === "android"; } catch { return false; }
}

