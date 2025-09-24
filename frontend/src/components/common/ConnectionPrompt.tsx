import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAppData } from "@/state/AppDataContext";

interface ConnectionPromptProps {
  title?: string;
  description?: string;
  ctaLabel?: string;
  to?: string;
}

const ConnectionPrompt = ({
  title = "Connect your device to view live data",
  description = "Your ESP8266 is offline. Join its access point or connect it to Wi-Fi to keep schedules and messages in sync.",
  ctaLabel = "Connect device",
  to,
}: ConnectionPromptProps) => {
  const { actions } = useAppData();

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/60 px-6 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="max-w-xl text-sm">{description}</p>
      </div>
      {to ? (
        <Button asChild>
          <Link to={to}>{ctaLabel}</Link>
        </Button>
      ) : (
        <Button onClick={() => actions.connectDevice()}>{ctaLabel}</Button>
      )}
    </div>
  );
};

export default ConnectionPrompt;

