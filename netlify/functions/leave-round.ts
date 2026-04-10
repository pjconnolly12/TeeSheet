import type { Handler } from "@netlify/functions";
import { sendWaitlistPromotionNotifications, supabaseAdmin } from "./_shared";

type RoundRecord = {
  id: string;
  max_players: number;
  round_players: Array<{ id: string; email: string }>;
};

type WaitlistEntryRecord = {
  id: string;
  email: string;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method not allowed."
    };
  }

  try {
    const payload = JSON.parse(event.body ?? "{}") as {
      roundId?: string;
      email?: string;
    };

    const roundId = payload.roundId?.trim();
    const email = payload.email?.trim().toLowerCase();

    if (!roundId || !email) {
      return {
        statusCode: 400,
        body: "Round id and email are required."
      };
    }

    const { data: roundData, error: roundError } = await supabaseAdmin
      .from("rounds")
      .select("id, max_players, round_players(id, email)")
      .eq("id", roundId)
      .single();

    if (roundError) {
      throw roundError;
    }

    const round = roundData as RoundRecord;
    const playerToRemove = round.round_players.find(
      (player) => player.email.trim().toLowerCase() === email
    );

    if (!playerToRemove) {
      return {
        statusCode: 404,
        body: "Player is not in this round."
      };
    }

    const { error: deleteError } = await supabaseAdmin
      .from("round_players")
      .delete()
      .eq("id", playerToRemove.id);

    if (deleteError) {
      throw deleteError;
    }

    const remainingPlayerCount = round.round_players.length - 1;
    const openSpots = round.max_players - remainingPlayerCount;
    let promotedEmail: string | null = null;

    if (openSpots > 0) {
      const { data: waitlistEntries, error: waitlistError } = await supabaseAdmin
        .from("round_waitlist_entries")
        .select("id, email")
        .eq("round_id", roundId)
        .is("promoted_at", null)
        .order("created_at", { ascending: true })
        .limit(1);

      if (waitlistError) {
        throw waitlistError;
      }

      const nextEntry = ((waitlistEntries ?? []) as WaitlistEntryRecord[])[0];

      if (nextEntry) {
        const { error: promotedPlayerError } = await supabaseAdmin.from("round_players").insert({
          round_id: roundId,
          email: nextEntry.email.trim().toLowerCase()
        });

        if (promotedPlayerError) {
          throw promotedPlayerError;
        }

        const { error: markPromotedError } = await supabaseAdmin
          .from("round_waitlist_entries")
          .update({ promoted_at: new Date().toISOString() })
          .eq("id", nextEntry.id);

        if (markPromotedError) {
          throw markPromotedError;
        }

        promotedEmail = nextEntry.email;

        await sendWaitlistPromotionNotifications({
          roundId,
          recipientEmails: [nextEntry.email]
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ promotedEmail })
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return {
      statusCode: 500,
      body: message
    };
  }
};
