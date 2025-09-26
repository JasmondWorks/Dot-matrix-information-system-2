import {
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Clock4,
  PlugZap,
  WifiHigh,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useAppData } from "@/state/AppDataContext";

import MobileNav from "./MobileNav";

const TopBar = () => {
  const { device, actions } = useAppData();

  const connected = !!device.connected;
  const statusText = connected ? "Connected" : "Disconnected";
  const statusTone = connected ? "text-emerald-600" : "text-rose-600";
  const statusBackground = connected ? "bg-emerald-100" : "bg-rose-100";
  const batteryPct = device.batteryPct ?? 0;

  const BatteryIcon = connected
    ? batteryPct >= 80
      ? BatteryFull
      : batteryPct >= 55
        ? BatteryCharging
        : batteryPct >= 25
          ? BatteryMedium
          : BatteryLow
    : BatteryLow;

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center border-b border-border bg-background/95 px-4 backdrop-blur md:px-10">
      <div className="flex flex-1 items-center gap-4">
        <MobileNav />
        <div className="hidden rounded-full border border-dashed border-muted-foreground/40 px-3 py-1 text-xs font-medium sm:inline-flex sm:items-center sm:gap-1">
          <WifiHigh className={cn("size-3.5", connected ? "text-emerald-500" : "text-rose-500")} />
          {connected ? "Device online" : "No device"}
        </div>
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-3">
            <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", statusBackground, statusTone)}>
              <span className="size-2.5 rounded-full bg-current" />
              {statusText}
            </span>
            <p className="text-sm font-semibold">
              {device.name ?? "Unpaired device"}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {connected
              ? `IP ${device.ip ?? "—"} · RTC ${formatDateTime(device.rtcTime) || "pending"}`
              : "Connect your device to view live status"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden min-w-[120px] flex-col text-xs text-muted-foreground sm:flex">
          {/* <div className="flex items-center gap-1 text-sm font-medium text-foreground">
            <BatteryIcon className="size-4" />
            {connected ? `${batteryPct}%` : "Power"}
          </div> */}
          {device.currentMessageExcerpt ? (
            <span className="truncate text-xs">{device.currentMessageExcerpt}</span>
          ) : null}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => actions.syncRTC()}
          disabled={!connected}
          className="hidden sm:inline-flex"
        >
          <Clock4 className="size-4" /> Sync RTC
        </Button>
        <Button
          variant={connected ? "ghost" : "default"}
          size="sm"
          onClick={() =>
            connected ? actions.disconnectDevice() : actions.connectDevice()
          }
          className={cn(connected && "text-muted-foreground")}
        >
          <PlugZap className="size-4" />
          {connected ? "Disconnect" : "Connect device"}
        </Button>
      </div>
    </header>
  );
};

export default TopBar;

