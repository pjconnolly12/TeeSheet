import type { Handler } from "@netlify/functions";
import { supabaseAdmin } from "./_shared";

export const handler: Handler = async () => {
  try {
    const cutoff = new Date().toISOString();

    const { data: rounds, error: selectError } = await supabaseAdmin
      .from("rounds")
      .select("id")
      .lt("tee_time", cutoff);

    if (selectError) {
      throw selectError;
    }

    const roundIds = (rounds ?? []).map((round) => round.id);

    if (!roundIds.length) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          deletedRounds: 0
        })
      };
    }

    const { error: deleteError } = await supabaseAdmin
      .from("rounds")
      .delete()
      .in("id", roundIds);

    if (deleteError) {
      throw deleteError;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        deletedRounds: roundIds.length
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
