import type { Handler } from "@netlify/functions";
import { sendOwnerRosterChangeNotification } from "./_shared";

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
      changeType?: "joined" | "left";
      playerEmail?: string;
      source?:
        | "self_join"
        | "self_leave"
        | "owner_edit_add"
        | "owner_edit_remove"
        | "waitlist_promotion";
    };

    const roundId = payload.roundId?.trim();
    const playerEmail = payload.playerEmail?.trim().toLowerCase();
    const changeType = payload.changeType;
    const source = payload.source;

    if (!roundId || !playerEmail || !changeType || !source) {
      return {
        statusCode: 400,
        body: "Round id, change type, player email, and source are required."
      };
    }

    const result = await sendOwnerRosterChangeNotification({
      roundId,
      changeType,
      playerEmail,
      source
    });

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return {
      statusCode: 500,
      body: message
    };
  }
};
