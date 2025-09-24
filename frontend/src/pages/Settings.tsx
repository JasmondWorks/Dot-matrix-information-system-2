import { Button } from "@/components/ui/button";
import { useAppData } from "@/state/AppDataContext";

const FONT_OPTIONS = ["Orbitron", "Roboto", "Press Start 2P", "System"];

const Settings = () => {
  const { settings, device, actions } = useAppData();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure appearance defaults, sound behaviour, and device pairing options.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">Display defaults</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/60 px-4 py-3 text-sm">
            <div>
              <p className="font-semibold">Show date</p>
              <p className="text-xs text-muted-foreground">Toggle date on the device header.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.dateDisplayEnabled}
              onChange={(event) => actions.updateSettings({ dateDisplayEnabled: event.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/60 px-4 py-3 text-sm">
            <div>
              <p className="font-semibold">Show calendar</p>
              <p className="text-xs text-muted-foreground">Toggle calendar widget on device idle screen.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.calendarVisible}
              onChange={(event) => actions.updateSettings({ calendarVisible: event.target.checked })}
            />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-semibold">LED color</span>
            <input
              type="color"
              value={settings.ledColor}
              onChange={(event) => actions.updateSettings({ ledColor: event.target.value })}
              className="h-12 w-full rounded-lg border border-input bg-background"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-semibold">Font</span>
            <select
              value={settings.font}
              onChange={(event) => actions.updateSettings({ font: event.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">Sound</h2>
        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Enable sound by default</p>
            <p className="text-xs text-muted-foreground">New messages start with sound {settings.soundEnabled ? "enabled" : "muted"}.</p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(event) => actions.updateSettings({ soundEnabled: event.target.checked })}
            />
            Sound enabled
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">Device</h2>
        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Sync RTC from this device</p>
            <p className="text-xs text-muted-foreground">Uses your browser time as the source.</p>
            <p className="text-xs text-muted-foreground">Last synced: {device.rtcTime ? new Date(device.rtcTime).toLocaleString() : "Never"}</p>
          </div>
          <Button variant="outline" onClick={() => actions.syncRTC()} disabled={!device.connected}>
            Sync time now
          </Button>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/60 p-4 text-sm">
          <p className="text-sm font-semibold">Pairing & security</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Once connected, the device exposes a pairing challenge. In cloud mode, rotate tokens regularly and prefer HTTPS + MQTT for remote control.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Settings;

