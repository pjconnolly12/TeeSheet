import type { Database } from "./database";

export type RoundRow = Database["public"]["Tables"]["rounds"]["Row"];
export type RoundPlayerRow = Database["public"]["Tables"]["round_players"]["Row"];
export type DistributionListEntryRow =
  Database["public"]["Tables"]["distribution_list_entries"]["Row"];
export type RoundInvitationRow = Database["public"]["Tables"]["round_invitations"]["Row"];
export type RoundWaitlistEntryRow =
  Database["public"]["Tables"]["round_waitlist_entries"]["Row"];

export interface PlayerInput {
  email: string;
}

export type InviteMode = "all" | "selected";

export interface DistributionListEntryInput {
  name: string;
  email: string;
}

export interface SaveRoundPayload {
  teeTime: string;
  maxPlayers: number;
  location: string;
  holes: number;
  players: PlayerInput[];
  inviteMode: InviteMode;
  selectedInviteEmails?: string[];
}

export interface RoundWithPlayers extends RoundRow {
  round_players: RoundPlayerRow[];
  round_invitations: RoundInvitationRow[];
  round_waitlist_entries: RoundWaitlistEntryRow[];
}
