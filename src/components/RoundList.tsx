import { useState } from "react";
import type { RoundWithPlayers } from "../types/app";
import { formatRoundDateTime } from "../utils/date";

interface RoundListProps {
  rounds: RoundWithPlayers[];
  currentUserId: string;
  currentUserEmail: string;
  saving: boolean;
  onEdit: (round: RoundWithPlayers) => void;
  onDelete: (round: RoundWithPlayers) => Promise<void>;
  onJoinRound: (roundId: string) => Promise<void>;
  onJoinWaitlist: (roundId: string, entry: { name: string; email: string }) => Promise<void>;
}

export function RoundList({
  rounds,
  currentUserId,
  currentUserEmail,
  saving,
  onEdit,
  onDelete,
  onJoinRound,
  onJoinWaitlist
}: RoundListProps) {
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [draftEmails, setDraftEmails] = useState<Record<string, string>>({});
  const [submittingRoundId, setSubmittingRoundId] = useState<string | null>(null);

  async function handleWaitlistSubmit(roundId: string) {
    const name = (draftNames[roundId] ?? "").trim();
    const email = (draftEmails[roundId] ?? currentUserEmail).trim().toLowerCase();
    if (!name || !email) {
      return;
    }

    setSubmittingRoundId(roundId);
    try {
      await onJoinWaitlist(roundId, { name, email });
      setDraftNames((current) => ({ ...current, [roundId]: "" }));
      setDraftEmails((current) => ({ ...current, [roundId]: currentUserEmail }));
    } finally {
      setSubmittingRoundId(null);
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Upcoming Golf</p>
          <h2>Scheduled Rounds</h2>
        </div>
      </div>

      <div className="round-list">
        {rounds.length === 0 ? (
          <div className="empty-state">
            <p>No rounds yet.</p>
            <span>Create your first tee time to get the group organized.</span>
          </div>
        ) : (
          rounds.map((round) => {
            const isOwner = round.created_by === currentUserId;
            const isFull = round.round_players.length >= round.max_players;
            const activeWaitlist = round.round_waitlist_entries.filter((entry) => !entry.promoted_at);
            const hasWaitlistSpot = activeWaitlist.some((entry) => entry.user_id === currentUserId);
            const isAlreadyPlaying = round.round_players.some(
              (player) => player.email.toLowerCase() === currentUserEmail.toLowerCase()
            );
            const isInvited = round.round_invitations.some(
              (invite) => invite.email.toLowerCase() === currentUserEmail.toLowerCase()
            );

            return (
              <article className="round-card" key={round.id}>
                <div className="round-card-header">
                  <div>
                    <h3>{round.location}</h3>
                    <p>{formatRoundDateTime(round.tee_time)}</p>
                  </div>
                  {isOwner ? (
                    <div className="list-entry-actions">
                      <button className="ghost-button" type="button" onClick={() => onEdit(round)}>
                        Edit
                      </button>
                      <button className="icon-button" type="button" onClick={() => void onDelete(round)}>
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="round-metrics round-metrics-three">
                  <div>
                    <span>Holes</span>
                    <strong>{round.holes}</strong>
                  </div>
                  <div>
                    <span>Players</span>
                    <strong>
                      {round.round_players.length}/{round.max_players}
                    </strong>
                  </div>
                  <div>
                    <span>Waitlist</span>
                    <strong>{activeWaitlist.length}</strong>
                  </div>
                </div>

                <ul className="player-pill-list">
                  {round.round_players.map((player) => (
                    <li key={player.id}>
                      <span>{player.email}</span>
                    </li>
                  ))}
                </ul>

                {!isOwner && isInvited && !isAlreadyPlaying && !isFull ? (
                  <div className="stack-sm">
                    <p className="muted">You were invited to this round and there is still an open spot.</p>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => void onJoinRound(round.id)}
                      disabled={saving}
                    >
                      {saving ? "Joining..." : "Join round"}
                    </button>
                  </div>
                ) : null}

                {activeWaitlist.length > 0 ? (
                  <div className="stack-sm waitlist-block">
                    <p className="muted">Waitlist</p>
                    <ul className="player-pill-list">
                      {activeWaitlist.map((entry) => (
                        <li key={entry.id}>
                          <span>{entry.name}</span>
                          <small>{entry.email}</small>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {!isOwner && isFull && !hasWaitlistSpot && !isAlreadyPlaying ? (
                  <div className="stack-sm waitlist-block">
                    <p className="muted">Round is full. Join the waitlist and TeeLogic will promote you automatically if a spot opens.</p>
                    <div className="player-row">
                      <input
                        type="text"
                        value={draftNames[round.id] ?? ""}
                        placeholder="Your name"
                        onChange={(event) =>
                          setDraftNames((current) => ({ ...current, [round.id]: event.target.value }))
                        }
                      />
                      <input
                        type="email"
                        value={draftEmails[round.id] ?? currentUserEmail}
                        placeholder="you@example.com"
                        onChange={(event) =>
                          setDraftEmails((current) => ({ ...current, [round.id]: event.target.value }))
                        }
                      />
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => handleWaitlistSubmit(round.id)}
                        disabled={submittingRoundId === round.id}
                      >
                        {submittingRoundId === round.id ? "Joining..." : "Join waitlist"}
                      </button>
                    </div>
                  </div>
                ) : null}

                {!isOwner && hasWaitlistSpot ? (
                  <p className="success-message">You are currently on the waitlist for this round.</p>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
