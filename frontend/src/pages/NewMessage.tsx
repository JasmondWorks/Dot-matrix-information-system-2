import { useLocation, useNavigate } from "react-router-dom";

import MessageForm, { type MessageFormValues } from "@/components/messages/MessageForm";
import ConnectionPrompt from "@/components/common/ConnectionPrompt";
import { useAppData } from "@/state/AppDataContext";

const NewMessage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings, capabilities, messages, actions, device } = useAppData();

  const editId = (location.state as { edit?: string } | undefined)?.edit;
  const editingMessage = messages.find((item) => item.id === editId);

  const initialValues: Partial<MessageFormValues> | undefined = editingMessage
    ? {
        title: editingMessage.title,
        body: editingMessage.body,
        mode: editingMessage.numScrolls ? "scrolls" : "duration",
        durationSec: editingMessage.durationSec?.toString() ?? "30",
        numScrolls: editingMessage.numScrolls?.toString() ?? "3",
        scrollSpeed: editingMessage.scrollSpeed,
        animation: editingMessage.animation,
        // soundEnabled: editingMessage.soundEnabled ?? settings.soundEnabled,
        // soundFileId: editingMessage.soundFileId ?? "",
      }
    : {
        // soundEnabled: settings.soundEnabled,
      };

  const handleSave = (payload: Parameters<typeof actions.createMessage>[0]) => {
    if (editingMessage) {
      actions.updateMessage(editingMessage.id, {
        ...payload,
        durationSec: payload.durationSec,
        numScrolls: payload.numScrolls,
      });
      navigate(`/messages/${editingMessage.id}`);
      return;
    }
    const created = actions.createMessage(payload, { tags: ["saved"] });
    navigate(`/messages/${created.id}`);
  };

  const handleSend = (payload: Parameters<typeof actions.createMessage>[0]) => {
    if (!device.connected) {
      window.alert("Device is disconnected. Connect it before sending.");
      return;
    }
    if (editingMessage) {
      actions.updateMessage(editingMessage.id, {
        ...payload,
        durationSec: payload.durationSec,
        numScrolls: payload.numScrolls,
      });
      actions.updateDevice({
        currentMessageId: editingMessage.id,
        currentMessageExcerpt: payload.body.slice(0, 64),
        scrollsDone: 0,
        timeLeftSec: payload.durationSec,
      });
      navigate(`/messages/${editingMessage.id}`);
      return;
    }
    const created = actions.createMessage(payload, { sendNow: true });
    navigate(`/messages/${created.id}`);
  };

  return (
    <div className="space-y-6">
      {!device.connected ? (
        <ConnectionPrompt title="Connect your device before sending new messages" />
      ) : null}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          {editingMessage ? "Edit message" : "Create a new message"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure title, body and playback settings before saving or sending.
        </p>
      </div>
      <MessageForm
        capabilities={capabilities}
        initialValues={initialValues}
        onSave={handleSave}
        onSend={handleSend}
        supportsBatch={capabilities.supportsMultiMessageBatch}
        onAddAnother={() => window.alert("Batch send will arrive when the firmware supports it.")}
      />
    </div>
  );
};

export default NewMessage;

