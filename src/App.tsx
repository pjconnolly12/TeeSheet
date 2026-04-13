import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthCard } from "./components/AuthCard";
import { DistributionListPanel } from "./components/DistributionListPanel";
import { FaqModal } from "./components/FaqModal";
import { RoundForm } from "./components/RoundForm";
import { RoundList } from "./components/RoundList";
import { supabase } from "./lib/supabase";
import type {
  DistributionListEntryInput,
  DistributionListEntryRow,
  SaveRoundPayload,
  PlayerInput,
  RoundWithPlayers
} from "./types/app";
import { notifyRound } from "./utils/email";

const LEAVE_ROUND_BLOCKED_MESSAGE =
  "You cannot leave the round within 24 hours of tee time, please contact the owner of the round directly to manage your round, thanks.";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);
  const [rounds, setRounds] = useState<RoundWithPlayers[]>([]);
  const [editingRound, setEditingRound] = useState<RoundWithPlayers | null>(null);
  const [distributionList, setDistributionList] = useState<DistributionListEntryRow[]>([]);
  const [isDistributionListOpen, setIsDistributionListOpen] = useState(false);
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileRoundFormOpen, setIsMobileRoundFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDistributionList, setSavingDistributionList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaveRoundErrors, setLeaveRoundErrors] = useState<Record<string, string>>({});

  function buildCreatorPlayer(): PlayerInput | null {
    if (!session?.user.email) {
      return null;
    }

    return {
      email: session.user.email.toLowerCase()
    };
  }

  function getLeaveRoundBlockedMessage(teeTimeValue: string) {
    const teeTime = new Date(teeTimeValue).getTime();
    if (!Number.isFinite(teeTime)) {
      return null;
    }

    const timeUntilTeeTime = teeTime - Date.now();
    const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

    return timeUntilTeeTime <= twentyFourHoursInMs ? LEAVE_ROUND_BLOCKED_MESSAGE : null;
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (window.location.hash.includes("type=recovery")) {
        setIsRecoveringPassword(true);
      }

      const {
        data: { session: nextSession }
      } = await supabase.auth.getSession();

      if (cancelled) {
        return;
      }

      setSession(nextSession);

      if (nextSession) {
        await Promise.all([loadRounds(nextSession), loadDistributionList(nextSession.user.id)]);
      } else {
        setLoading(false);
      }
    }

    void bootstrap();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveringPassword(true);
      }

      if (event === "SIGNED_OUT") {
        setIsRecoveringPassword(false);
      }

      setSession(nextSession);
      if (nextSession) {
        void loadRounds(nextSession);
        void loadDistributionList(nextSession.user.id);
      } else {
        setRounds([]);
        setDistributionList([]);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (editingRound) {
      setIsMobileRoundFormOpen(true);
    }
  }, [editingRound]);

  async function loadRounds(activeSession: Session | null = session) {
    if (!activeSession) {
      setRounds([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: roundError } = await supabase
      .from("rounds")
      .select("*, round_players(*), round_invitations(*), round_waitlist_entries(*)")
      .gte("tee_time", new Date().toISOString())
      .order("tee_time", { ascending: true });

    if (roundError) {
      setError(roundError.message);
      setLoading(false);
      return;
    }

    setRounds((data ?? []) as RoundWithPlayers[]);
    setLoading(false);
  }

  async function loadDistributionList(userId: string) {
    const { data, error: distributionError } = await supabase
      .from("distribution_list_entries")
      .select("*")
      .eq("owner_id", userId)
      .order("email", { ascending: true });

    if (distributionError) {
      setError(distributionError.message);
      return;
    }

    setDistributionList(data ?? []);
  }

  async function handleSaveDistributionList(entries: DistributionListEntryInput[]) {
    if (!session) {
      return;
    }

    setSavingDistributionList(true);
    setError(null);

    const normalizedEntries = entries.map((entry) => ({
      owner_id: session.user.id,
      name: entry.name || null,
      email: entry.email
    }));

    try {
      const { error: deleteError } = await supabase
        .from("distribution_list_entries")
        .delete()
        .eq("owner_id", session.user.id);

      if (deleteError) {
        throw deleteError;
      }

      if (normalizedEntries.length > 0) {
        const { error: insertError } = await supabase
          .from("distribution_list_entries")
          .insert(normalizedEntries);

        if (insertError) {
          throw insertError;
        }
      }

      await loadDistributionList(session.user.id);
    } finally {
      setSavingDistributionList(false);
    }
  }

  async function handleSaveRound(payload: SaveRoundPayload) {
    if (!session) {
      return false;
    }

    setSaving(true);
    setError(null);

    try {
      const creatorPlayer = buildCreatorPlayer();
      const normalizedPlayers = payload.players.map((player) => ({
        email: player.email.trim().toLowerCase()
      }));

      const finalPlayers =
        !editingRound && creatorPlayer
          ? [
              creatorPlayer,
              ...normalizedPlayers.filter(
                (player) => player.email !== creatorPlayer.email
              )
            ]
          : normalizedPlayers;

      if (finalPlayers.length > payload.maxPlayers) {
        throw new Error("The player list is larger than the round capacity.");
      }

      const openSpots = payload.maxPlayers - finalPlayers.length;
      let invitationEntries: DistributionListEntryRow[] = [];

      let roundId = editingRound?.id;

      if (editingRound) {
        const { error: updateError } = await supabase
          .from("rounds")
          .update({
            tee_time: payload.teeTime,
            timezone: payload.timeZone,
            max_players: payload.maxPlayers,
            location: payload.location,
            holes: payload.holes,
            updated_at: new Date().toISOString()
          })
          .eq("id", editingRound.id);

        if (updateError) {
          throw updateError;
        }

        const { error: deletePlayersError } = await supabase
          .from("round_players")
          .delete()
          .eq("round_id", editingRound.id);

        if (deletePlayersError) {
          throw deletePlayersError;
        }
      } else {
        const { data: insertedRound, error: insertError } = await supabase
          .from("rounds")
          .insert({
            created_by: session.user.id,
            owner_email: session.user.email?.trim().toLowerCase() ?? null,
            tee_time: payload.teeTime,
            timezone: payload.timeZone,
            max_players: payload.maxPlayers,
            location: payload.location,
            holes: payload.holes
          })
          .select("id")
          .single();

        if (insertError) {
          throw insertError;
        }

        roundId = insertedRound.id;
      }

      if (!roundId) {
        throw new Error("Missing round id.");
      }

      const { error: playersError } = await supabase.from("round_players").insert(
        finalPlayers.map((player) => ({
          round_id: roundId,
          email: player.email
        }))
      );

      if (playersError) {
        throw playersError;
      }

      const playerEmails = new Set(finalPlayers.map((player) => player.email));
      const stagedInviteEmails = new Set(
        (payload.selectedInviteEmails ?? [])
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean)
      );

      if (openSpots > 0) {
        if (!editingRound) {
          const selectedInviteEmails = payload.inviteMode === "selected" ? stagedInviteEmails : null;
          invitationEntries = distributionList.filter((entry) => {
            const email = entry.email.trim().toLowerCase();
            return email && !playerEmails.has(email) && (selectedInviteEmails ? selectedInviteEmails.has(email) : true);
          });
        } else if (stagedInviteEmails.size > 0) {
          const existingInvitationEmails = new Set(
            editingRound.round_invitations.map((invite) => invite.email.trim().toLowerCase()).filter(Boolean)
          );
          invitationEntries = distributionList.filter((entry) => {
            const email = entry.email.trim().toLowerCase();
            return (
              email &&
              stagedInviteEmails.has(email) &&
              !playerEmails.has(email) &&
              !existingInvitationEmails.has(email)
            );
          });
        }

        const invitationEmails = Array.from(
          new Set(
            invitationEntries
              .map((entry) => entry.email.trim().toLowerCase())
              .filter(Boolean)
          )
        );

        if (invitationEmails.length > 0) {
          const { error: invitationsError } = await supabase.from("round_invitations").insert(
            invitationEmails.map((email) => ({
              round_id: roundId,
              email
            }))
          );

          if (invitationsError) {
            throw invitationsError;
          }
        }
      }

      await promoteWaitlist(roundId, payload.maxPlayers, finalPlayers.length);

      const addedPlayerRecipients = Array.from(
        new Map(
          finalPlayers.map((player) => {
            const email = player.email.trim().toLowerCase();
            return [
              email,
              {
                name: player.email,
                email
              }
            ];
          })
        ).values()
      );

      const addedPlayerEmails = new Set(addedPlayerRecipients.map((recipient) => recipient.email));
      const invitedRecipients = Array.from(
        new Map(
          invitationEntries
            .map((entry) => {
              const email = entry.email.trim().toLowerCase();
              return email
                ? [
                    email,
                    {
                      name: entry.name ?? entry.email,
                      email
                    }
                  ]
                : null;
            })
            .filter(Boolean) as Array<[string, { name: string; email: string }]>
        ).values()
      ).filter((recipient) => !addedPlayerEmails.has(recipient.email));

      await notifyRound({
        kind: editingRound ? "updated" : "created",
        roundId,
        location: payload.location,
        teeTime: payload.teeTime,
        timeZone: payload.timeZone,
        holes: payload.holes,
        maxPlayers: payload.maxPlayers,
        players: finalPlayers,
        addedPlayers: editingRound ? undefined : addedPlayerRecipients,
        invitedRecipients: invitedRecipients,
        updatedRecipients: editingRound ? addedPlayerRecipients : undefined
      });

      await loadRounds();
      setEditingRound(null);
      setIsMobileRoundFormOpen(false);
      return true;
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to save round.";
      setError(message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function promoteWaitlist(roundId: string, maxPlayers: number, currentPlayers: number) {
    const openSpots = maxPlayers - currentPlayers;
    if (openSpots <= 0) {
      return;
    }

    const { data: waitlistEntries, error: waitlistError } = await supabase
      .from("round_waitlist_entries")
      .select("*")
      .eq("round_id", roundId)
      .is("promoted_at", null)
      .order("created_at", { ascending: true })
      .limit(openSpots);

    if (waitlistError) {
      throw waitlistError;
    }

    if (!waitlistEntries?.length) {
      return;
    }

    const { error: promotedPlayersError } = await supabase.from("round_players").insert(
      waitlistEntries.map((entry) => ({
        round_id: roundId,
        email: entry.email
      }))
    );

    if (promotedPlayersError) {
      throw promotedPlayersError;
    }

    const waitlistIds = waitlistEntries.map((entry) => entry.id);
    const { error: markPromotedError } = await supabase
      .from("round_waitlist_entries")
      .update({ promoted_at: new Date().toISOString() })
      .in("id", waitlistIds);

    if (markPromotedError) {
      throw markPromotedError;
    }

    try {
      const response = await fetch("/.netlify/functions/notify-waitlist-promotion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          roundId,
          recipientEmails: waitlistEntries.map((entry) => entry.email)
        })
      });

      if (!response.ok) {
        const message = await response.text();
        setError(message || "Promoted players, but could not send notification email.");
      }
    } catch {
      setError("Promoted players, but could not send notification email.");
    }
  }

  async function handleJoinWaitlist(roundId: string) {
    if (!session) {
      return;
    }

    const email = session.user.email?.trim().toLowerCase();
    if (!email) {
      setError("Your account is missing an email address.");
      return;
    }

    setError(null);

    const { error: insertError } = await supabase.from("round_waitlist_entries").insert({
      round_id: roundId,
      email,
      user_id: session.user.id
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    await loadRounds();
  }

  async function handleLeaveWaitlist(roundId: string) {
    if (!session) {
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const { error: deleteError } = await supabase
        .from("round_waitlist_entries")
        .delete()
        .eq("round_id", roundId)
        .eq("user_id", session.user.id)
        .is("promoted_at", null);

      if (deleteError) {
        throw deleteError;
      }

      await loadRounds();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to leave waitlist.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleJoinRound(roundId: string) {
    if (!session) {
      return;
    }

    const email = session.user.email?.trim().toLowerCase();
    if (!email) {
      setError("Your account is missing an email address.");
      return;
    }

    setError(null);
    setSaving(true);

    const { error: joinError } = await supabase.from("round_players").insert({
      round_id: roundId,
      email
    });

    try {
      if (joinError) {
        setError(joinError.message);
        return;
      }

      await loadRounds();
    } finally {
      setSaving(false);
    }
  }

  async function handleLeaveRound(roundId: string, teeTimeValue: string) {
    if (!session) {
      return;
    }

    const email = session.user.email?.trim().toLowerCase();
    if (!email) {
      setError("Your account is missing an email address.");
      return;
    }

    const blockedMessage = getLeaveRoundBlockedMessage(teeTimeValue);
    if (blockedMessage) {
      setLeaveRoundErrors((current) => ({
        ...current,
        [roundId]: blockedMessage
      }));
      return;
    }

    setLeaveRoundErrors((current) => {
      if (!current[roundId]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[roundId];
      return nextErrors;
    });
    setSaving(true);

    try {
      const response = await fetch("/.netlify/functions/leave-round", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ roundId, email })
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to leave round.");
      }

      setLeaveRoundErrors((current) => {
        if (!current[roundId]) {
          return current;
        }

        const nextErrors = { ...current };
        delete nextErrors[roundId];
        return nextErrors;
      });
      await loadRounds();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to leave round.";
      setLeaveRoundErrors((current) => ({
        ...current,
        [roundId]: message
      }));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRound(round: RoundWithPlayers) {
    if (!session) {
      return;
    }

    const confirmed = window.confirm(
      `Delete the round at ${round.location} on ${new Date(round.tee_time).toLocaleString()}?`
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    const { error: deleteError } = await supabase.from("rounds").delete().eq("id", round.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingRound?.id === round.id) {
      setEditingRound(null);
    }

    await loadRounds();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setEditingRound(null);
    setSession(null);
    setLoading(false);
  }

  function handleOpenDistributionList() {
    setIsDistributionListOpen(true);
    setIsMobileMenuOpen(false);
  }

  function handleOpenFaq() {
    setIsFaqOpen(true);
    setIsMobileMenuOpen(false);
  }

  function handleOpenRoundForm() {
    setEditingRound(null);
    setIsMobileRoundFormOpen(true);
    setIsMobileMenuOpen(false);
  }

  if (loading && !session && !isRecoveringPassword) {
    return <main className="app-shell loading-shell">Loading TeeLogic...</main>;
  }

  if (!session || isRecoveringPassword) {
    return (
      <main className="app-shell auth-shell">
        <AuthCard
          recoveryMode={isRecoveringPassword}
          onAuthSuccess={async () => {
            const {
              data: { session: nextSession }
            } = await supabase.auth.getSession();

            setSession(nextSession);
            if (nextSession) {
              await Promise.all([loadRounds(nextSession), loadDistributionList(nextSession.user.id)]);
            }
          }}
          onPasswordResetComplete={() => {
            setIsRecoveringPassword(false);
            window.history.replaceState({}, document.title, window.location.pathname);
          }}
        />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">TeeLogic</p>
          <h1>Keep the crew aligned from booking to tee time.</h1>
          <p className="muted">
            Create and manage your golf rounds
          </p>
        </div>

        <div className="hero-actions">
          <button className="ghost-button desktop-only" type="button" onClick={handleSignOut}>
            Log out
          </button>
          <button
            className="ghost-button mobile-menu-button mobile-only"
            type="button"
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            aria-expanded={isMobileMenuOpen}
            aria-label="Open menu"
          >
            Menu
          </button>
        </div>
      </header>

      {isMobileMenuOpen ? (
        <div className="mobile-menu mobile-only">
          <button className="ghost-button" type="button" onClick={handleOpenRoundForm}>
            Create round
          </button>
          <button className="ghost-button" type="button" onClick={handleOpenFaq}>
            FAQ
          </button>
          <button className="ghost-button" type="button" onClick={handleOpenDistributionList}>
            Manage distribution list
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              void handleSignOut();
            }}
          >
            Log out
          </button>
        </div>
      ) : null}

      <div className="toolbar-row desktop-only">
        <div className="toolbar-actions">
          <button className="ghost-button" type="button" onClick={handleOpenFaq}>
            FAQ
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={handleOpenDistributionList}
          >
            Manage distribution list
          </button>
        </div>
        <span className="muted">
          {distributionList.length === 0
            ? "No saved recipients"
            : `${distributionList.length} saved recipient${distributionList.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="content-grid">
        <div className={isMobileRoundFormOpen || editingRound ? "mobile-form-visible" : "mobile-form-hidden"}>
          {isMobileRoundFormOpen && !editingRound ? (
            <div className="mobile-form-actions mobile-only">
              <button
                className="text-button"
                type="button"
                onClick={() => setIsMobileRoundFormOpen(false)}
              >
                Hide create round
              </button>
            </div>
          ) : null}
          <RoundForm
            initialRound={editingRound}
            creatorPlayer={buildCreatorPlayer() ?? { email: "" }}
            distributionList={distributionList}
            onCancelEdit={() => {
              setEditingRound(null);
              setIsMobileRoundFormOpen(false);
            }}
            onSave={handleSaveRound}
            saving={saving}
          />
        </div>
        <RoundList
          rounds={rounds}
          currentUserId={session.user.id}
          currentUserEmail={session.user.email ?? ""}
          saving={saving}
          leaveRoundErrors={leaveRoundErrors}
          onEdit={(round) => {
            setEditingRound(round);
            setIsMobileRoundFormOpen(true);
          }}
          onDelete={handleDeleteRound}
          onJoinRound={handleJoinRound}
          onLeaveRound={handleLeaveRound}
          onJoinWaitlist={handleJoinWaitlist}
          onLeaveWaitlist={handleLeaveWaitlist}
        />
      </section>

      <DistributionListPanel
        entries={distributionList}
        isOpen={isDistributionListOpen}
        onClose={() => setIsDistributionListOpen(false)}
        saving={savingDistributionList}
        onSave={handleSaveDistributionList}
      />
      <FaqModal isOpen={isFaqOpen} onClose={() => setIsFaqOpen(false)} />
    </main>
  );
}
