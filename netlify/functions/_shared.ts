import { createClient } from "@supabase/supabase-js";
import { format } from "date-fns";
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

type RoundSummary = {
  id: string;
  location: string;
  tee_time: string;
  holes: number;
  max_players: number;
};

export function buildRoundEmail({
  heading,
  intro,
  actionText,
  location,
  teeTime,
  holes,
  maxPlayers
}: {
  heading: string;
  intro: string;
  actionText: string;
  location: string;
  teeTime: string;
  holes: number;
  maxPlayers: number;
}) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:24px;background:#f6f8f3;">
      <div style="background:#ffffff;border-radius:18px;padding:24px;border:1px solid #dde5da;">
        <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#1f7a4f;margin:0 0 12px;">TeeLogic</p>
        <h1 style="margin:0 0 12px;color:#183122;">${heading}</h1>
        <p style="margin:0 0 20px;color:#496454;">${intro}</p>
        <div style="background:#eef6e4;border-radius:16px;padding:16px;">
          <p style="margin:0 0 8px;"><strong>Location:</strong> ${location}</p>
          <p style="margin:0 0 8px;"><strong>Date:</strong> ${format(new Date(teeTime), "EEEE, MMMM d, yyyy")}</p>
          <p style="margin:0 0 8px;"><strong>Time:</strong> ${format(new Date(teeTime), "h:mm a")}</p>
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
    .select("id, location, tee_time, holes, max_players")
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
