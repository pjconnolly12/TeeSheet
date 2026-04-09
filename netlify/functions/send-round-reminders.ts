import type { Handler } from "@netlify/functions";
import { addHours } from "date-fns";
import { buildRoundEmail, resend, sender, supabaseAdmin } from "./_shared";

const REMINDER_LEAD_HOURS = 36;
const REMINDER_WINDOW_HOURS = 1;

type RoundRecord = {
  id: string;
  location: string;
  tee_time: string;
  holes: number;
  max_players: number;
  round_players: Array<{
    id: string;
    email: string;
    reminder_sent_at: string | null;
  }>;
};

export const handler: Handler = async () => {
  try {
    const now = new Date();
    const reminderWindowStart = addHours(now, REMINDER_LEAD_HOURS - REMINDER_WINDOW_HOURS);
    const reminderWindowEnd = addHours(now, REMINDER_LEAD_HOURS);

    const { data: rounds, error } = await supabaseAdmin
      .from("rounds")
      .select("id, location, tee_time, holes, max_players, round_players(id, email, reminder_sent_at)")
      .gte("tee_time", reminderWindowStart.toISOString())
      .lte("tee_time", reminderWindowEnd.toISOString());

    if (error) {
      throw error;
    }

    const pendingRounds = ((rounds ?? []) as RoundRecord[]).filter((round) =>
      round.round_players.some((player) => !player.reminder_sent_at)
    );

    for (const round of pendingRounds) {
      const recipients = round.round_players.filter((player) => !player.reminder_sent_at);
      if (!recipients.length) {
        continue;
      }

      const result = await resend.emails.send({
        from: sender,
        to: recipients.map((player) => player.email),
        subject: `Reminder: ${round.location} is coming up`,
        html: buildRoundEmail({
          heading: "Golf Round Reminder",
          intro: "Your tee time is coming up soon. Grab your clubs and be ready to roll.",
          actionText: "Open TeeLogic to review your round details and be ready for tee time.",
          location: round.location,
          teeTime: round.tee_time,
          holes: round.holes,
          maxPlayers: round.max_players
        })
      });

      if (result.error) {
        throw new Error(`Failed to send reminder for ${round.location}: ${result.error.message}`);
      }

      const playerIds = recipients.map((player) => player.id);
      const { error: updateError } = await supabaseAdmin
        .from("round_players")
        .update({ reminder_sent_at: new Date().toISOString() })
        .in("id", playerIds);

      if (updateError) {
        throw updateError;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        processedRounds: pendingRounds.length,
        reminderLeadHours: REMINDER_LEAD_HOURS
      })
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return {
      statusCode: 500,
      body: message
    };
  }
};
