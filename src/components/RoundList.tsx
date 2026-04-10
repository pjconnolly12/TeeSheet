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
  onLeaveRound: (roundId: string) => Promise<void>;
  onJoinWaitlist: (roundId: string) => Promise<void>;
  onLeaveWaitlist: (roundId: string) => Promise<void>;
}

export function RoundList({
  rounds,
  currentUserId,
  currentUserEmail,
  saving,
  onEdit,
  onDelete,
  onJoinRound,
  onLeaveRound,
  onJoinWaitlist,
  onLeaveWaitlist
}: RoundListProps) {
  const [submittingRoundId, setSubmittingRoundId] = useState<string | null>(null);

  async function handleWaitlistSubmit(roundId: string) {
    if (!currentUserEmail.trim()) {
      return;
    }

    setSubmittingRoundId(roundId);
    try {
      await onJoinWaitlist(roundId);
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
            const ownerEmail = round.owner_email?.toLowerCase();
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
                  {round.round_players.map((player) => {
                    const isRoundOwner = ownerEmail ? player.email.toLowerCase() === ownerEmail : false;

                    return (
                      <li key={player.id}>
                        <span>{player.email}</span>
                        {isRoundOwner ? <span className="owner-tag">Owner</span> : null}
                      </li>
                    );
                  })}
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

                {!isOwner && isAlreadyPlaying ? (
                  <div className="stack-sm">
                    <p className="muted">You have joined this round.</p>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => void onLeaveRound(round.id)}
                      disabled={saving}
                    >
                      {saving ? "Leaving..." : "Leave round"}
                    </button>
                  </div>
                ) : null}

                {activeWaitlist.length > 0 ? (
                  <div className="stack-sm waitlist-block">
                    <p className="muted">Waitlist</p>
                    <ul className="player-pill-list">
                      {activeWaitlist.map((entry) => (
                        <li key={entry.id}>
                          <span>{entry.email}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {!isOwner && isFull && !hasWaitlistSpot && !isAlreadyPlaying ? (
                  <div className="stack-sm waitlist-block">
                    <p className="muted">Round is full. Join the waitlist and TeeLogic will promote you automatically if a spot opens.</p>
                    <div className="player-row">
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => handleWaitlistSubmit(round.id)}
                        disabled={submittingRoundId === round.id || !currentUserEmail.trim()}
                      >
                        {submittingRoundId === round.id ? "Joining..." : "Join"}
                      </button>
                    </div>
                  </div>
                ) : null}

                {!isOwner && hasWaitlistSpot ? (
                  <div className="stack-sm">
                    <p className="success-message">You are currently on the waitlist for this round.</p>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => void onLeaveWaitlist(round.id)}
                      disabled={saving}
                    >
                      {saving ? "Leaving..." : "Leave waitlist"}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
