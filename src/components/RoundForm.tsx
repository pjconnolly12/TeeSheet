import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type {
  DistributionListEntryRow,
  InviteMode,
  PlayerInput,
  RoundWithPlayers,
  SaveRoundPayload
} from "../types/app";
import { toDateInputValue, toTimeInputValue } from "../utils/date";

interface RoundFormProps {
  initialRound?: RoundWithPlayers | null;
  creatorPlayer: PlayerInput;
  distributionList: DistributionListEntryRow[];
  onCancelEdit: () => void;
  onSave: (payload: SaveRoundPayload) => Promise<boolean>;
  saving: boolean;
}

const EMPTY_PLAYER: PlayerInput = { email: "" };

export function RoundForm({
  initialRound,
  creatorPlayer,
  distributionList,
  onCancelEdit,
  onSave,
  saving
}: RoundFormProps) {
  const initialPlayers = useMemo(() => {
    if (!initialRound) {
      return [{ email: creatorPlayer.email }];
    }

    return initialRound.round_players.length > 0
      ? initialRound.round_players.map((player) => ({ email: player.email }))
      : [{ ...EMPTY_PLAYER }];
  }, [creatorPlayer.email, initialRound]);

  const distributionListOptions = useMemo(
    () =>
      distributionList.map((entry) => ({
        label: entry.name || entry.email,
        email: entry.email.trim().toLowerCase()
      })),
    [distributionList]
  );

  const [roundDate, setRoundDate] = useState("");
  const [roundTime, setRoundTime] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [location, setLocation] = useState("");
  const [holes, setHoles] = useState(18);
  const [players, setPlayers] = useState<PlayerInput[]>(initialPlayers);
  const [inviteMode, setInviteMode] = useState<InviteMode>("all");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedInviteEmails, setSelectedInviteEmails] = useState<string[]>([]);
  const [pendingPayload, setPendingPayload] = useState<SaveRoundPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialRound) {
      setRoundDate("");
      setRoundTime("");
      setMaxPlayers(4);
      setLocation("");
      setHoles(18);
      setPlayers([{ email: creatorPlayer.email }]);
      setInviteMode("all");
      setIsInviteModalOpen(false);
      setSelectedInviteEmails([]);
      setPendingPayload(null);
      setError(null);
      return;
    }

    setRoundDate(toDateInputValue(initialRound.tee_time));
    setRoundTime(toTimeInputValue(initialRound.tee_time));
    setMaxPlayers(initialRound.max_players);
    setLocation(initialRound.location);
    setHoles(initialRound.holes);
    setPlayers(initialPlayers);
    setInviteMode("all");
    setIsInviteModalOpen(false);
    setSelectedInviteEmails([]);
    setPendingPayload(null);
    setError(null);
  }, [creatorPlayer, initialPlayers, initialRound]);

  function updatePlayer(index: number, field: keyof PlayerInput, value: string) {
    setPlayers((current) =>
      current.map((player, playerIndex) =>
        playerIndex === index ? { ...player, [field]: value } : player
      )
    );
  }

  function addPlayerRow() {
    if (players.length >= maxPlayers) {
      setError("You cannot add more golfers than the round allows.");
      return;
    }

    setPlayers((current) => [...current, { ...EMPTY_PLAYER }]);
    setError(null);
  }

  function removePlayerRow(index: number) {
    if (!initialRound && index === 0) {
      return;
    }

    setPlayers((current) => current.filter((_, playerIndex) => playerIndex !== index));
  }

  function buildPayload(): SaveRoundPayload | null {
    const cleanedPlayers = players
      .map((player) => ({
        email: player.email.trim().toLowerCase()
      }))
      .filter((player) => player.email);

    if (cleanedPlayers.length === 0) {
      setError("Add at least one golfer for the round.");
      return null;
    }

    const uniqueEmails = new Set(cleanedPlayers.map((player) => player.email));
    if (uniqueEmails.size !== cleanedPlayers.length) {
      setError("Each golfer must have a unique email address.");
      return null;
    }

    if (cleanedPlayers.length > maxPlayers) {
      setError("The player list is larger than the round capacity.");
      return null;
    }

    const teeTime = new Date(`${roundDate}T${roundTime}`).toISOString();
    return {
      teeTime,
      maxPlayers,
      location: location.trim(),
      holes,
      players: cleanedPlayers,
      inviteMode,
      selectedInviteEmails: inviteMode === "selected" ? selectedInviteEmails : undefined
    };
  }

  function toggleSelectedInvite(email: string) {
    setSelectedInviteEmails((current) =>
      current.includes(email)
        ? current.filter((entryEmail) => entryEmail !== email)
        : [...current, email]
    );
  }

  async function submitPayload(payload: SaveRoundPayload) {
    const saved = await onSave(payload);
    if (saved && !initialRound) {
      setPendingPayload(null);
      setIsInviteModalOpen(false);
      setSelectedInviteEmails([]);
      setInviteMode("all");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const payload = buildPayload();
    if (!payload) {
      return;
    }

    if (!initialRound && inviteMode === "selected") {
      setPendingPayload(payload);
      setIsInviteModalOpen(true);
      return;
    }

    await submitPayload(payload);
  }

  async function handleConfirmInvites() {
    const payload = pendingPayload ?? buildPayload();
    if (!payload) {
      return;
    }

    await submitPayload({
      ...payload,
      selectedInviteEmails
    });
  }

  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{initialRound ? "Update Round" : "New Round"}</p>
            <h2>{initialRound ? "Edit the TeeLogic" : "Create a Golf Round"}</h2>
          </div>
          {initialRound ? (
            <button className="ghost-button" type="button" onClick={onCancelEdit}>
              Cancel Edit
            </button>
          ) : null}
        </div>

        <form className="stack" onSubmit={handleSubmit}>
          <div className="grid-two">
            <label>
              <span>Date</span>
              <input
                type="date"
                value={roundDate}
                onChange={(event) => setRoundDate(event.target.value)}
                required
              />
            </label>

            <label>
              <span>Time</span>
              <input
                type="time"
                value={roundTime}
                onChange={(event) => setRoundTime(event.target.value)}
                required
              />
            </label>
          </div>

          <label>
            <span>Course</span>
            <input
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Add Course Name"
              required
            />
          </label>

          <div className="grid-two">
            <label>
              <span>Number of Players</span>
              <input
                type="number"
                min={1}
                max={4}
                value={maxPlayers}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  setMaxPlayers(nextValue);
                  if (players.length > nextValue) {
                    setPlayers((current) => current.slice(0, nextValue));
                  }
                }}
                required
              />
            </label>

            <label>
              <span>Number of Holes</span>
              <select value={holes} onChange={(event) => setHoles(Number(event.target.value))}>
                <option value={9}>9</option>
                <option value={18}>18</option>
              </select>
            </label>
          </div>

          {!initialRound ? (
            <div className="stack-sm">
              <div>
                <span>Distribution List Invites</span>
                <p className="muted">
                  Choose whether to invite everyone on your saved list or select recipients when you create the round.
                </p>
              </div>
              <div className="invite-mode-toggle" role="radiogroup" aria-label="Distribution list invite mode">
                <button
                  className={inviteMode === "all" ? "primary-button" : "ghost-button"}
                  type="button"
                  onClick={() => {
                    setInviteMode("all");
                    setIsInviteModalOpen(false);
                    setPendingPayload(null);
                  }}
                  aria-pressed={inviteMode === "all"}
                >
                  Invite All
                </button>
                <button
                  className={inviteMode === "selected" ? "primary-button" : "ghost-button"}
                  type="button"
                  onClick={() => setInviteMode("selected")}
                  aria-pressed={inviteMode === "selected"}
                >
                  Select Invites
                </button>
              </div>
            </div>
          ) : null}

          <div className="stack-sm">
            <div className="players-header">
              <div>
                <span>Players</span>
                <p className="muted">
                  {players.filter((player) => player.email).length} of {maxPlayers} spots filled
                </p>
              </div>
              <button className="ghost-button" type="button" onClick={addPlayerRow}>
                Add Golfer
              </button>
            </div>

            {players.map((player, index) => (
              <div className="player-row player-row-email" key={index}>
                <input
                  type="email"
                  list={index === 0 && !initialRound ? undefined : "distribution-list-golfer-options"}
                  value={player.email}
                  placeholder={
                    index === 0 && !initialRound
                      ? "player@example.com"
                      : distributionListOptions.length > 0
                        ? "Type or choose a saved golfer"
                        : "player@example.com"
                  }
                  onChange={(event) => updatePlayer(index, "email", event.target.value)}
                  disabled={!initialRound && index === 0}
                  required={index === 0}
                />
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => removePlayerRow(index)}
                  disabled={players.length === 1 || (!initialRound && index === 0)}
                  aria-label={`Remove golfer ${index + 1}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {error ? <p className="error-message">{error}</p> : null}

          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? "Saving..." : initialRound ? "Update round" : "Create round"}
          </button>
        </form>

        {distributionListOptions.length > 0 ? (
          <datalist id="distribution-list-golfer-options">
            {distributionListOptions.map((entry) => (
              <option key={entry.email} value={entry.email}>
                {entry.label}
              </option>
            ))}
          </datalist>
        ) : null}
      </section>

      {isInviteModalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsInviteModalOpen(false)}>
          <section
            className="panel modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-selection-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Select Invites</p>
                <h2 id="invite-selection-title">Choose recipients for this round</h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => setIsInviteModalOpen(false)}>
                Cancel
              </button>
            </div>

            <div className="stack-sm">
              <p className="muted">
                Pick which saved distribution-list recipients should receive an invitation when this round is created.
              </p>

              {distributionList.length === 0 ? (
                <div className="empty-state">
                  <p>No saved recipients yet.</p>
                  <span>You can still create the round without sending distribution-list invitations.</span>
                </div>
              ) : (
                <ul className="player-pill-list">
                  {distributionList.map((entry) => {
                    const normalizedEmail = entry.email.trim().toLowerCase();
                    const isChecked = selectedInviteEmails.includes(normalizedEmail);

                    return (
                      <li className="invite-selection-item" key={entry.id}>
                        <label className="invite-checkbox-row">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectedInvite(normalizedEmail)}
                          />
                          <div>
                            <span>{entry.name || entry.email}</span>
                            <small>{entry.email}</small>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="modal-actions">
                <button className="ghost-button" type="button" onClick={() => setIsInviteModalOpen(false)}>
                  Back
                </button>
                <button className="primary-button" type="button" onClick={() => void handleConfirmInvites()} disabled={saving}>
                  {saving ? "Saving..." : "Confirm invites"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
