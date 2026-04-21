import type { PlayerInput } from "../types/app";

export interface NotifyRecipient {
  email: string;
  name: string;
}

export interface NotifyRoundPayload {
  kind: "created" | "updated";
  roundId: string;
  location: string;
  teeTime: string;
  timeZone: string;
  holes: number;
  maxPlayers: number;
  players: PlayerInput[];
  addedPlayers?: NotifyRecipient[];
  invitedRecipients?: NotifyRecipient[];
  updatedRecipients?: NotifyRecipient[];
}

export interface NotifyRoundOwnerRosterChangePayload {
  roundId: string;
  changeType: "joined" | "left";
  playerEmail: string;
  source:
    | "self_join"
    | "self_leave"
    | "owner_edit_add"
    | "owner_edit_remove"
    | "waitlist_promotion";
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

export async function notifyRoundOwnerRosterChange(payload: NotifyRoundOwnerRosterChangePayload) {
  const response = await fetch("/.netlify/functions/notify-round-owner-roster-change", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to send owner roster change notification.");
  }
}
