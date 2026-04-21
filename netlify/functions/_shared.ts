import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.VITE_APP_URL;

if (!resendApiKey || !emailFrom || !supabaseUrl || !supabaseServiceRoleKey || !appUrl) {
  throw new Error("Missing server environment variables.");
}

export const resend = new Resend(resendApiKey);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
export const sender = emailFrom;
export const siteUrl = appUrl;

type BatchEmailTag = {
  name: string;
  value: string;
};

export type BatchEmailJob = {
  to: string;
  subject: string;
  html: string;
  tags?: BatchEmailTag[];
};

type RoundSummary = {
  id: string;
  location: string;
  tee_time: string;
  timezone: string;
  holes: number;
  max_players: number;
  owner_email: string | null;
};

export type OwnerRosterChangeSource =
  | "self_join"
  | "self_leave"
  | "owner_edit_add"
  | "owner_edit_remove"
  | "waitlist_promotion";

export type OwnerRosterChangeType = "joined" | "left";

export function resolveRoundTimeZone(timeZone?: string | null) {
  const normalizedTimeZone = timeZone?.trim();

  if (!normalizedTimeZone) {
    console.warn("round email timezone missing; falling back to UTC");
    return "UTC";
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: normalizedTimeZone }).format(new Date());
    return normalizedTimeZone;
  } catch {
    console.warn("round email timezone invalid; falling back to UTC", {
      suppliedTimeZone: normalizedTimeZone
    });
    return "UTC";
  }
}

function formatInTimeZone(value: string, timeZone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    ...options
  }).format(new Date(value));
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendBatchEmailJobs({
  jobs,
  category,
  chunkSize = 5,
  delayMs = 1000
}: {
  jobs: BatchEmailJob[];
  category: string;
  chunkSize?: number;
  delayMs?: number;
}) {
  const failures: string[] = [];

  if (!jobs.length) {
    return { failures };
  }

  const chunks = chunkArray(jobs, chunkSize);
  console.log("sendBatchEmailJobs starting", {
    category,
    totalJobs: jobs.length,
    chunkSize,
    chunkCount: chunks.length,
    delayMs
  });

  for (const [index, chunk] of chunks.entries()) {
    console.log("sendBatchEmailJobs sending chunk", {
      category,
      chunkNumber: index + 1,
      chunkCount: chunks.length,
      recipients: chunk.map((job) => job.to)
    });

    const result = await resend.batch.send(
      chunk.map((job) => ({
        from: sender,
        to: job.to,
        subject: job.subject,
        html: job.html,
        tags: job.tags
      }))
    );

    if (result.error) {
      const chunkRecipients = chunk.map((job) => job.to).join(", ");
      failures.push(`${chunkRecipients}: ${result.error.message}`);
      console.error("sendBatchEmailJobs chunk failed", {
        category,
        chunkNumber: index + 1,
        error: result.error
      });
    } else {
      console.log("sendBatchEmailJobs chunk accepted", {
        category,
        chunkNumber: index + 1,
        acceptedCount: chunk.length
      });
    }

    if (index < chunks.length - 1) {
      await delay(delayMs);
    }
  }

  return { failures };
}

export function buildRoundEmail({
  heading,
  intro,
  actionText,
  location,
  teeTime,
  timeZone,
  holes,
  maxPlayers
}: {
  heading: string;
  intro: string;
  actionText: string;
  location: string;
  teeTime: string;
  timeZone: string;
  holes: number;
  maxPlayers: number;
}) {
  const resolvedTimeZone = resolveRoundTimeZone(timeZone);
  console.log("buildRoundEmail formatting tee time", {
    teeTime,
    suppliedTimeZone: timeZone,
    resolvedTimeZone
  });
  const formattedDate = formatInTimeZone(teeTime, resolvedTimeZone, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
  const formattedTime = formatInTimeZone(teeTime, resolvedTimeZone, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });

  return `
    <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:24px;background:#f6f8f3;">
      <div style="background:#ffffff;border-radius:18px;padding:24px;border:1px solid #dde5da;">
        <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#1f7a4f;margin:0 0 12px;">TeeLogic</p>
        <h1 style="margin:0 0 12px;color:#183122;">${heading}</h1>
        <p style="margin:0 0 20px;color:#496454;">${intro}</p>
        <div style="background:#eef6e4;border-radius:16px;padding:16px;">
          <p style="margin:0 0 8px;"><strong>Location:</strong> ${location}</p>
          <p style="margin:0 0 8px;"><strong>Date:</strong> ${formattedDate}</p>
          <p style="margin:0 0 8px;"><strong>Time:</strong> ${formattedTime}</p>
          <p style="margin:0 0 8px;"><strong>Holes:</strong> ${holes}</p>
          <p style="margin:0;"><strong>Group size:</strong> ${maxPlayers}</p>
        </div>
        <p style="margin:20px 0 0;color:#496454;">
          ${actionText}
        </p>
        <p style="margin:16px 0 0;">
          <a href="${siteUrl}" style="display:inline-block;background:#1f7a4f;color:#ffffff;font-weight:700;text-decoration:none;padding:12px 18px;border-radius:999px;">Open TeeLogic</a>
        </p>
        <p style="margin:16px 0 0;color:#496454;">
          You can also manage your rounds at
          <a href="${siteUrl}" style="color:#1f7a4f;font-weight:700;text-decoration:none;"> TeeLogic</a>.
        </p>
      </div>
    </div>
  `;
}

function humanizeRosterChangeSource(source: OwnerRosterChangeSource) {
  switch (source) {
    case "self_join":
      return "Joined from the round page";
    case "self_leave":
      return "Left from the round page";
    case "owner_edit_add":
      return "Added during a round edit";
    case "owner_edit_remove":
      return "Removed during a round edit";
    case "waitlist_promotion":
      return "Auto-promoted from the waitlist";
    default:
      return "Roster changed";
  }
}

export function buildOwnerRosterChangeEmail({
  changeType,
  playerEmail,
  source,
  location,
  teeTime,
  timeZone,
  holes,
  maxPlayers
}: {
  changeType: OwnerRosterChangeType;
  playerEmail: string;
  source: OwnerRosterChangeSource;
  location: string;
  teeTime: string;
  timeZone: string;
  holes: number;
  maxPlayers: number;
}) {
  const resolvedTimeZone = resolveRoundTimeZone(timeZone);
  const formattedDate = formatInTimeZone(teeTime, resolvedTimeZone, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
  const formattedTime = formatInTimeZone(teeTime, resolvedTimeZone, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
  const actionText = changeType === "joined" ? "joined" : "left";
  const sourceLabel = humanizeRosterChangeSource(source);

  return `
    <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:24px;background:#f6f8f3;">
      <div style="background:#ffffff;border-radius:18px;padding:24px;border:1px solid #dde5da;">
        <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#1f7a4f;margin:0 0 12px;">TeeLogic</p>
        <h1 style="margin:0 0 12px;color:#183122;">A player ${actionText} your round</h1>
        <p style="margin:0 0 20px;color:#496454;">${playerEmail} ${actionText} the roster. Here are the latest round details.</p>
        <div style="background:#eef6e4;border-radius:16px;padding:16px;">
          <p style="margin:0 0 8px;"><strong>Player:</strong> ${playerEmail}</p>
          <p style="margin:0 0 8px;"><strong>Change source:</strong> ${sourceLabel}</p>
          <p style="margin:0 0 8px;"><strong>Location:</strong> ${location}</p>
          <p style="margin:0 0 8px;"><strong>Date:</strong> ${formattedDate}</p>
          <p style="margin:0 0 8px;"><strong>Time:</strong> ${formattedTime}</p>
          <p style="margin:0 0 8px;"><strong>Holes:</strong> ${holes}</p>
          <p style="margin:0;"><strong>Group size:</strong> ${maxPlayers}</p>
        </div>
        <p style="margin:20px 0 0;color:#496454;">
          Open TeeLogic to review the current roster and round details.
        </p>
        <p style="margin:16px 0 0;">
          <a href="${siteUrl}" style="display:inline-block;background:#1f7a4f;color:#ffffff;font-weight:700;text-decoration:none;padding:12px 18px;border-radius:999px;">Open TeeLogic</a>
        </p>
      </div>
    </div>
  `;
}

export async function sendOwnerRosterChangeNotification({
  roundId,
  changeType,
  playerEmail,
  source
}: {
  roundId: string;
  changeType: OwnerRosterChangeType;
  playerEmail: string;
  source: OwnerRosterChangeSource;
}) {
  const normalizedPlayerEmail = playerEmail.trim().toLowerCase();

  if (!normalizedPlayerEmail) {
    return { sent: 0, skipped: "missing_player_email" as const };
  }

  const { data: roundData, error: roundError } = await supabaseAdmin
    .from("rounds")
    .select("id, owner_email, location, tee_time, timezone, holes, max_players")
    .eq("id", roundId)
    .single();

  if (roundError) {
    throw new Error(`Could not load round details: ${roundError.message}`);
  }

  const round = roundData as RoundSummary;
  const ownerEmail = round.owner_email?.trim().toLowerCase();

  if (!ownerEmail) {
    return { sent: 0, skipped: "missing_owner_email" as const };
  }

  if (ownerEmail === normalizedPlayerEmail) {
    return { sent: 0, skipped: "owner_is_affected_player" as const };
  }

  const actionText = changeType === "joined" ? "joined" : "left";
  const result = await resend.emails.send({
    from: sender,
    to: ownerEmail,
    subject: `Player ${actionText} your round: ${round.location}`,
    html: buildOwnerRosterChangeEmail({
      changeType,
      playerEmail: normalizedPlayerEmail,
      source,
      location: round.location,
      teeTime: round.tee_time,
      timeZone: round.timezone,
      holes: round.holes,
      maxPlayers: round.max_players
    }),
    tags: [
      { name: "category", value: "owner_roster_change" },
      { name: "change_type", value: changeType },
      { name: "source", value: source },
      { name: "round_id", value: round.id.replace(/[^a-zA-Z0-9_-]/g, "-") }
    ]
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return { sent: 1 };
}

export async function sendWaitlistPromotionNotifications({
  roundId,
  recipientEmails
}: {
  roundId: string;
  recipientEmails: string[];
}) {
  const uniqueRecipients = [...new Set(
    recipientEmails.map((email) => email.trim().toLowerCase()).filter(Boolean)
  )];

  if (!uniqueRecipients.length) {
    return { sent: 0 };
  }

  const { data: roundData, error: roundError } = await supabaseAdmin
    .from("rounds")
    .select("id, location, tee_time, timezone, holes, max_players")
    .eq("id", roundId)
    .single();

  if (roundError) {
    throw new Error(`Could not load round details: ${roundError.message}`);
  }

  const round = roundData as RoundSummary;
  const subject = `You're in the round: ${round.location}`;
  const html = buildRoundEmail({
    heading: "You were moved off the waitlist",
    intro: "A spot opened up and you were automatically added to the round.",
    actionText: "Open TeeLogic to review the round details and get ready for tee time.",
    location: round.location,
    teeTime: round.tee_time,
    timeZone: round.timezone,
    holes: round.holes,
    maxPlayers: round.max_players
  });

  const failures: string[] = [];

  for (const recipient of uniqueRecipients) {
    const result = await resend.emails.send({
      from: sender,
      to: recipient,
      subject,
      html,
      tags: [
        { name: "category", value: "waitlist_promotion" },
        { name: "round_id", value: round.id.replace(/[^a-zA-Z0-9_-]/g, "-") }
      ]
    });

    if (result.error) {
      failures.push(`${recipient}: ${result.error.message}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Some promotion notifications failed: ${failures.join("; ")}`);
  }

  return { sent: uniqueRecipients.length };
}
