import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  DeviceCapabilities,
  MessageInput,
  ScrollSpeed,
  SwitchAnimation,
} from "@/lib/types";

interface MessageFormValues {
  title: string;
  body: string;
  mode: "duration" | "scrolls";
  durationSec: string;
  numScrolls: string;
  scrollSpeed: ScrollSpeed;
  animation: SwitchAnimation;
  soundEnabled: boolean;
  soundFileId: string;
}

interface MessageFormProps {
  capabilities: DeviceCapabilities;
  initialValues?: Partial<MessageFormValues>;
  onSave: (payload: MessageInput) => void;
  onSend: (payload: MessageInput) => void;
  supportsBatch?: boolean;
  onAddAnother?: () => void;
}

const defaultValues: MessageFormValues = {
  title: "",
  body: "",
  mode: "duration",
  durationSec: "30",
  numScrolls: "3",
  scrollSpeed: "normal",
  animation: "slide",
  soundEnabled: true,
  soundFileId: "",
};

const MessageForm = ({
  capabilities,
  initialValues,
  onSave,
  onSend,
  supportsBatch,
  onAddAnother,
}: MessageFormProps) => {
  const [values, setValues] = useState<MessageFormValues>({
    ...defaultValues,
    ...initialValues,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof MessageFormValues, string>>>({});

  const bodyLength = values.body.trim().length;
  const requiresScrollMode = bodyLength > capabilities.maxCharsPerFrame;

  useEffect(() => {
    if (requiresScrollMode && values.mode !== "scrolls") {
      setValues((current) => ({
        ...current,
        mode: "scrolls",
      }));
    }
  }, [requiresScrollMode, values.mode]);

  const handleChange = <Field extends keyof MessageFormValues>(field: Field, value: MessageFormValues[Field]) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const validate = () => {
    const nextErrors: Partial<Record<keyof MessageFormValues, string>> = {};

    if (!values.title.trim()) nextErrors.title = "Title is required";
    if (!values.body.trim()) nextErrors.body = "Body is required";

    if (values.mode === "duration") {
      const durationValue = Number(values.durationSec);
      if (!durationValue || durationValue <= 0) {
        nextErrors.durationSec = "Enter a duration in seconds";
      }
      if (requiresScrollMode) {
        nextErrors.durationSec = "Long messages must use scroll count";
      }
    } else {
      const scrollValue = Number(values.numScrolls);
      if (!scrollValue || scrollValue <= 0) {
        nextErrors.numScrolls = "Enter the number of scrolls";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildPayload = (): MessageInput => {
    const base: MessageInput = {
      title: values.title.trim(),
      body: values.body.trim(),
      soundEnabled: values.soundEnabled,
      soundFileId: values.soundEnabled ? values.soundFileId || undefined : undefined,
      scrollSpeed: values.scrollSpeed,
      animation: values.animation,
    };

    if (values.mode === "duration") {
      base.durationSec = Number(values.durationSec);
      base.numScrolls = undefined;
    } else {
      base.numScrolls = Number(values.numScrolls);
      base.durationSec = undefined;
    }

    return base;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave(buildPayload());
  };

  const handleSend = () => {
    if (!validate()) return;
    onSend(buildPayload());
  };

  const helperText = useMemo(() => {
    if (requiresScrollMode) {
      return `Body length (${bodyLength}) exceeds ${capabilities.maxCharsPerFrame} characters. Scroll mode enforced.`;
    }
    const remaining = capabilities.maxCharsPerFrame - bodyLength;
    return remaining >= 0
      ? `${remaining} characters left before scroll mode is required.`
      : "Switch to scroll count for longer messages.";
  }, [bodyLength, capabilities.maxCharsPerFrame, requiresScrollMode]);

  return (
    <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-semibold text-foreground">Title</span>
            <input
              type="text"
              value={values.title}
              onChange={(event) => handleChange("title", event.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              placeholder="Welcome message"
            />
            {errors.title ? <p className="text-xs text-destructive">{errors.title}</p> : null}
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-semibold text-foreground">Sound file ID</span>
            <input
              type="text"
              value={values.soundFileId}
              onChange={(event) => handleChange("soundFileId", event.target.value)}
              disabled={!values.soundEnabled}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none disabled:cursor-not-allowed disabled:bg-muted/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              placeholder="optional-sound.wav"
            />
          </label>
        </div>

        <label className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Body</span>
            <span className="text-xs text-muted-foreground">
              {bodyLength}/{capabilities.maxCharsPerFrame}
            </span>
          </div>
          <textarea
            value={values.body}
            onChange={(event) => handleChange("body", event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            placeholder="Line 1
Line 2"
          />
          <p className="text-xs text-muted-foreground">{helperText}</p>
          {errors.body ? <p className="text-xs text-destructive">{errors.body}</p> : null}
        </label>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">Duration vs. scrolls</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 rounded-xl border border-border bg-background/70 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Use duration</span>
              <input
                type="radio"
                name="mode"
                value="duration"
                checked={values.mode === "duration" && !requiresScrollMode}
                disabled={requiresScrollMode}
                onChange={() => handleChange("mode", "duration")}
              />
            </div>
            <input
              type="number"
              min={1}
              value={values.durationSec}
              disabled={values.mode !== "duration" || requiresScrollMode}
              onChange={(event) => handleChange("durationSec", event.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:bg-muted/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              placeholder="30"
            />
            <span className="text-xs text-muted-foreground">Seconds to show this message.</span>
            {errors.durationSec ? (
              <span className="text-xs text-destructive">{errors.durationSec}</span>
            ) : null}
          </label>

          <label className="flex flex-col gap-2 rounded-xl border border-border bg-background/70 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Use number of scrolls</span>
              <input
                type="radio"
                name="mode"
                value="scrolls"
                checked={values.mode === "scrolls" || requiresScrollMode}
                onChange={() => handleChange("mode", "scrolls")}
              />
            </div>
            <input
              type="number"
              min={1}
              value={values.numScrolls}
              onChange={(event) => handleChange("numScrolls", event.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              placeholder="3"
            />
            <span className="text-xs text-muted-foreground">Number of full scroll loops.</span>
            {errors.numScrolls ? (
              <span className="text-xs text-destructive">{errors.numScrolls}</span>
            ) : null}
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-semibold">Scroll speed</span>
            <select
              value={values.scrollSpeed}
              onChange={(event) => handleChange("scrollSpeed", event.target.value as ScrollSpeed)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              <option value="slow">Slow</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-semibold">Switch animation</span>
            <select
              value={values.animation}
              onChange={(event) => handleChange("animation", event.target.value as SwitchAnimation)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              <option value="cut">Cut</option>
              <option value="slide">Slide</option>
              <option value="fade">Fade</option>
            </select>
          </label>
        </div>
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-background/60 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold">Sound</p>
            <p className="text-xs text-muted-foreground">Toggle per message. Default comes from Settings.</p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={values.soundEnabled}
              onChange={(event) => handleChange("soundEnabled", event.target.checked)}
            />
            Enable sound for this message
          </label>
        </div>
      </section>

      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>Need to send a batch?</p>
          <p>
            {supportsBatch
              ? "Add multiple messages before pushing to the device."
              : "Your device currently sends one message at a time."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => handleSave()}>
            Save for later
          </Button>
          <Button onClick={() => handleSend()}>Send now</Button>
          {supportsBatch ? (
            <Button variant="ghost" onClick={onAddAnother}>
              + Add message
            </Button>
          ) : null}
        </div>
      </section>
    </form>
  );
};

export type { MessageFormValues };
export default MessageForm;

