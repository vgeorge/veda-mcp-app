// Announce a collection pick in the chat via app.sendMessage so the model
// drives the next step. A failed send surfaces as an error string telling the
// user to type the pick instead.
import type { App } from "@modelcontextprotocol/ext-apps";
import { useState } from "react";
import type { CollectionView } from "../../view-contract";

const SEND_FAILED =
  "Couldn't send your selection to the chat — type it instead.";

export function useSendPick(app: App | null) {
  const [sending, setSending] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  const pick = async (collection: CollectionView) => {
    if (!app) return;
    setSending(true);
    setPickError(null);
    try {
      const sent = await app.sendMessage({
        role: "user",
        content: [{
          type: "text",
          text: `I picked the dataset "${collection.title}" (id: ${collection.id}).`,
        }],
      });
      if (sent.isError) setPickError(SEND_FAILED);
    } catch (e) {
      console.error(e);
      setPickError(SEND_FAILED);
    } finally {
      setSending(false);
    }
  };

  return { pick, sending, pickError };
}
