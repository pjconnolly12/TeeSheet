import type { Handler } from "@netlify/functions";
import { buildRoundEmail, resend, sender, supabaseAdmin } from "./_shared";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method not allowed."
    };
  }

  try {
    const payload = JSON.parse(event.body ?? "{}") as {
      kind: "created" | "updated";
      roundId: string;
      ownerId: string;
      location: string;
      teeTime: string;
      holes: number;
      maxPlayers: number;
      players: Array<{ email: string; name: string }>;
      recipients: Array<{ email: string; name: string }>;
    };
    type DistributionRecipientRow = { name: string | null; email: string };

    const distributionRecipients =
      payload.kind === "created" && payload.ownerId
        ? await (async () => {
            const { data, error } = await supabaseAdmin
              .from("distribution_list_entries")
              .select("name, email")
              .eq("owner_id", payload.ownerId);

            if (error) {
              throw new Error(`Could not load distribution list: ${error.message}`);
            }

            return ((data ?? []) as DistributionRecipientRow[]).map((entry) => ({
              name: entry.name ?? entry.email,
              email: entry.email
            }));
          })()
        : [];

    const allRecipients = [...(payload.recipients ?? []), ...distributionRecipients];

    if (!allRecipients.length) {
      return { statusCode: 400, body: "Recipients are required." };
    }

    const uniqueRecipients = [...new Set(
      allRecipients
        .map((recipient) => recipient.email.trim().toLowerCase())
        .filter(Boolean)
    )];

    if (!uniqueRecipients.length) {
      return { statusCode: 400, body: "Recipients are required." };
    }

    const subject =
      payload.kind === "created"
        ? `New golf round: ${payload.location}`
        : `Updated golf round: ${payload.location}`;

    const html = buildRoundEmail({
      heading: payload.kind === "created" ? "A golf round was created" : "A golf round was updated",
      intro:
        payload.kind === "created"
          ? "A new round was created. Head to TeeLogic to join the round and see the latest details."
          : "Your round details were updated.",
      actionText:
        payload.kind === "created"
          ? "Join the round at TeeLogic using the link below."
          : "Review the updated round details at TeeLogic using the link below.",
      location: payload.location,
      teeTime: payload.teeTime,
      holes: payload.holes,
      maxPlayers: payload.maxPlayers
    });

    const failures: string[] = [];

    for (const recipient of uniqueRecipients) {
      const result = await resend.emails.send({
        from: sender,
        to: recipient,
        subject,
        html,
        tags: [
          { name: "category", value: "round_notification" },
          { name: "kind", value: payload.kind },
          { name: "round_id", value: payload.roundId.replace(/[^a-zA-Z0-9_-]/g, "-") }
        ]
      });

      if (result.error) {
        failures.push(`${recipient}: ${result.error.message}`);
        console.error("notify-round send failed", {
          roundId: payload.roundId,
          recipient,
          kind: payload.kind,
          error: result.error
        });
      } else {
        console.log("notify-round send accepted", {
          roundId: payload.roundId,
          recipient,
          kind: payload.kind,
          resendEmailId: result.data?.id ?? null
        });
      }
    }

    if (failures.length > 0) {
      return {
        statusCode: 502,
        body: `Some notifications failed: ${failures.join("; ")}`
      };
    }

    return {
      statusCode: 200,
      body: "Notification sent."
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return {
      statusCode: 500,
      body: message
    };
  }
};
