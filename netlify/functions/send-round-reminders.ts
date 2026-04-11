import type { Handler } from "@netlify/functions";
import { addHours } from "date-fns";
import { buildRoundEmail, resend, sender, supabaseAdmin } from "./_shared";

const REMINDER_LEAD_HOURS = 36;

type RoundRecord = {
  id: string;
  location: string;
  tee_time: string;
  timezone: string;
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
    const reminderCutoff = addHours(now, REMINDER_LEAD_HOURS);
    console.log("send-round-reminders invoked", {
      now: now.toISOString(),
      reminderLeadHours: REMINDER_LEAD_HOURS,
      reminderCutoff: reminderCutoff.toISOString()
    });

    const { data: rounds, error } = await supabaseAdmin
      .from("rounds")
      .select("id, location, tee_time, timezone, holes, max_players, round_players(id, email, reminder_sent_at)")
      .gt("tee_time", now.toISOString())
      .lte("tee_time", reminderCutoff.toISOString());

    if (error) {
      throw error;
    }

    const roundRecords = (rounds ?? []) as RoundRecord[];
    console.log("send-round-reminders fetched rounds", {
      totalRoundsInWindow: roundRecords.length
    });

    const pendingRounds = roundRecords.filter((round) =>
      round.round_players.some((player) => !player.reminder_sent_at)
    );
    console.log("send-round-reminders pending rounds", {
      pendingRounds: pendingRounds.length
    });

    const roundSummaries: Array<{
      roundId: string;
      location: string;
      teeTime: string;
      attemptedRecipients: string[];
      sent: boolean;
      resendEmailId: string | null;
      updatedPlayerIds: string[];
    }> = [];
    let attemptedRecipients = 0;

    for (const round of pendingRounds) {
      const recipients = round.round_players.filter((player) => !player.reminder_sent_at);
      if (!recipients.length) {
        roundSummaries.push({
          roundId: round.id,
          location: round.location,
          teeTime: round.tee_time,
          attemptedRecipients: [],
          sent: false,
          resendEmailId: null,
          updatedPlayerIds: []
        });
        continue;
      }

      attemptedRecipients += recipients.length;
      console.log("send-round-reminders attempting round", {
        roundId: round.id,
        location: round.location,
        teeTime: round.tee_time,
        recipients: recipients.map((player) => player.email)
      });

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
          timeZone: round.timezone,
          holes: round.holes,
          maxPlayers: round.max_players
        })
      });

      if (result.error) {
        console.error("send-round-reminders send failed", {
          roundId: round.id,
          location: round.location,
          recipients: recipients.map((player) => player.email),
          error: result.error
        });
        throw new Error(`Failed to send reminder for ${round.location}: ${result.error.message}`);
      }

      console.log("send-round-reminders send accepted", {
        roundId: round.id,
        location: round.location,
        resendEmailId: result.data?.id ?? null
      });

      const playerIds = recipients.map((player) => player.id);
      console.log("send-round-reminders updating reminder_sent_at", {
        roundId: round.id,
        playerIds,
        recipientEmails: recipients.map((player) => player.email)
      });
      const { error: updateError } = await supabaseAdmin
        .from("round_players")
        .update({ reminder_sent_at: new Date().toISOString() })
        .in("id", playerIds);

      if (updateError) {
        throw updateError;
      }

      roundSummaries.push({
        roundId: round.id,
        location: round.location,
        teeTime: round.tee_time,
        attemptedRecipients: recipients.map((player) => player.email),
        sent: true,
        resendEmailId: result.data?.id ?? null,
        updatedPlayerIds: playerIds
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        invokedAt: now.toISOString(),
        processedRounds: pendingRounds.length,
        fetchedRoundsInWindow: roundRecords.length,
        attemptedRecipients,
        reminderLeadHours: REMINDER_LEAD_HOURS,
        reminderCutoff: reminderCutoff.toISOString(),
        roundSummaries
      })
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    console.error("send-round-reminders failed", { message });
    return {
      statusCode: 500,
      body: message
    };
  }
};
