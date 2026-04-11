import type { Handler } from "@netlify/functions";
import { buildRoundEmail, resend, sender } from "./_shared";

type NotifyRecipient = {
  email: string;
  name: string;
};

function normalizeRecipients(recipients: NotifyRecipient[] = []) {
  return Array.from(
    new Map(
      recipients
        .map((recipient) => {
          const email = recipient.email.trim().toLowerCase();
          if (!email) {
            return null;
          }

          return [
            email,
            {
              email,
              name: recipient.name?.trim() || recipient.email
            }
          ] as const;
        })
        .filter(Boolean) as Array<readonly [string, NotifyRecipient]>
    ).values()
  );
}

async function sendRoundEmails({
  recipients,
  subject,
  html,
  roundId,
  category,
  kind
}: {
  recipients: NotifyRecipient[];
  subject: string;
  html: string;
  roundId: string;
  category: string;
  kind: "created" | "updated";
}) {
  const failures: string[] = [];

  for (const recipient of recipients) {
    const result = await resend.emails.send({
      from: sender,
      to: recipient.email,
      subject,
      html,
      tags: [
        { name: "category", value: category },
        { name: "kind", value: kind },
        { name: "round_id", value: roundId.replace(/[^a-zA-Z0-9_-]/g, "-") }
      ]
    });

    if (result.error) {
      failures.push(`${recipient.email}: ${result.error.message}`);
      console.error("notify-round send failed", {
        roundId,
        recipient: recipient.email,
        category,
        kind,
        error: result.error
      });
    } else {
      console.log("notify-round send accepted", {
        roundId,
        recipient: recipient.email,
        category,
        kind,
        resendEmailId: result.data?.id ?? null
      });
    }
  }

  return failures;
}

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
      location: string;
      teeTime: string;
      holes: number;
      maxPlayers: number;
      players: Array<{ email: string; name: string }>;
      addedPlayers?: NotifyRecipient[];
      invitedRecipients?: NotifyRecipient[];
      updatedRecipients?: NotifyRecipient[];
    };
    const normalizedAddedPlayers = normalizeRecipients(payload.addedPlayers);
    const addedPlayerEmails = new Set(normalizedAddedPlayers.map((recipient) => recipient.email));
    const normalizedInvitedRecipients = normalizeRecipients(payload.invitedRecipients).filter(
      (recipient) => !addedPlayerEmails.has(recipient.email)
    );
    const normalizedUpdatedRecipients = normalizeRecipients(payload.updatedRecipients);

    const failures: string[] = [];

    if (payload.kind === "created") {
      if (normalizedAddedPlayers.length > 0) {
        failures.push(
          ...(
            await sendRoundEmails({
              recipients: normalizedAddedPlayers,
              subject: "You have been added to a golf round",
              html: buildRoundEmail({
                heading: "You have been added to a golf round",
                intro: "You were added directly to this round. Here are the round details.",
                actionText: "Open TeeLogic to review the round and get ready for tee time.",
                location: payload.location,
                teeTime: payload.teeTime,
                holes: payload.holes,
                maxPlayers: payload.maxPlayers
              }),
              roundId: payload.roundId,
              category: "round_added",
              kind: payload.kind
            })
          )
        );
      }

      if (normalizedInvitedRecipients.length > 0) {
        failures.push(
          ...(
            await sendRoundEmails({
              recipients: normalizedInvitedRecipients,
              subject: `New golf round: ${payload.location}`,
              html: buildRoundEmail({
                heading: "A golf round was created",
                intro: "A new round was created. Head to TeeLogic to join the round and see the latest details.",
                actionText: "Join the round at TeeLogic using the link below.",
                location: payload.location,
                teeTime: payload.teeTime,
                holes: payload.holes,
                maxPlayers: payload.maxPlayers
              }),
              roundId: payload.roundId,
              category: "round_invitation",
              kind: payload.kind
            })
          )
        );
      }
    } else {
      if (normalizedUpdatedRecipients.length > 0) {
        failures.push(
          ...(
            await sendRoundEmails({
              recipients: normalizedUpdatedRecipients,
              subject: `Updated golf round: ${payload.location}`,
              html: buildRoundEmail({
                heading: "A golf round was updated",
                intro: "Your round details were updated.",
                actionText: "Review the updated round details at TeeLogic using the link below.",
                location: payload.location,
                teeTime: payload.teeTime,
                holes: payload.holes,
                maxPlayers: payload.maxPlayers
              }),
              roundId: payload.roundId,
              category: "round_notification",
              kind: payload.kind
            })
          )
        );
      }

      if (normalizedInvitedRecipients.length > 0) {
        failures.push(
          ...(
            await sendRoundEmails({
              recipients: normalizedInvitedRecipients,
              subject: `New golf round: ${payload.location}`,
              html: buildRoundEmail({
                heading: "A golf round was created",
                intro: "A spot is available and you can join this round in TeeLogic.",
                actionText: "Join the round at TeeLogic using the link below.",
                location: payload.location,
                teeTime: payload.teeTime,
                holes: payload.holes,
                maxPlayers: payload.maxPlayers
              }),
              roundId: payload.roundId,
              category: "round_invitation",
              kind: payload.kind
            })
          )
        );
      }
    }

    if (
      payload.kind === "created" &&
      normalizedAddedPlayers.length === 0 &&
      normalizedInvitedRecipients.length === 0
    ) {
      return {
        statusCode: 200,
        body: "No notifications to send."
      };
    }

    if (
      payload.kind === "updated" &&
      normalizedUpdatedRecipients.length === 0 &&
      normalizedInvitedRecipients.length === 0
    ) {
      return {
        statusCode: 200,
        body: "No notifications to send."
      };
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
