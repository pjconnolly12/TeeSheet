import type { Handler } from "@netlify/functions";
import { sendWaitlistPromotionNotifications } from "./_shared";

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
      recipientEmails?: string[];
    };

    const roundId = payload.roundId?.trim();
    const recipientEmails = payload.recipientEmails ?? [];

    if (!roundId || !recipientEmails.length) {
      return {
        statusCode: 400,
        body: "Round id and recipient emails are required."
      };
    }

    const result = await sendWaitlistPromotionNotifications({
      roundId,
      recipientEmails
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
