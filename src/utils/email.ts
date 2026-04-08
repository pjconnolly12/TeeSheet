import type { DistributionListEntryInput, PlayerInput } from "../types/app";

export interface NotifyRoundPayload {
  kind: "created" | "updated";
  roundId: string;
  location: string;
  teeTime: string;
  holes: number;
  maxPlayers: number;
  players: PlayerInput[];
  recipients: DistributionListEntryInput[];
}

export async function notifyRound(payload: NotifyRoundPayload) {
  const response = await fetch("/.netlify/functions/notify-round", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to send email notification.");
  }
}
