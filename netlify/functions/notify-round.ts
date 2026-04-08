import type { Handler } from "@netlify/functions";
import { buildRoundEmail, resend, sender } from "./_shared";

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
      location: string;
      teeTime: string;
      holes: number;
      maxPlayers: number;
      players: Array<{ email: string; name: string }>;
      recipients: Array<{ email: string; name: string }>;
    };

    if (!payload.recipients?.length) {
      return { statusCode: 400, body: "Recipients are required." };
    }

    const uniqueRecipients = [...new Set(
      payload.recipients
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
      heading: payload.kind === "created" ? "Your golf round is booked" : "Your golf round changed",
      intro:
        payload.kind === "created"
          ? "A new round was created by the round owner."
          : "Your round details were updated.",
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
        html
      });

      if (result.error) {
        failures.push(`${recipient}: ${result.error.message}`);
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
