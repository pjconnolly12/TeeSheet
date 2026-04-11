import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type {
  DistributionListEntryRow,
  InviteMode,
  PlayerInput,
  RoundWithPlayers,
  SaveRoundPayload
} from "../types/app";
import { localDateTimeToUtcIso, toDateInputValue, toTimeInputValue } from "../utils/date";

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
  const [activeGolferPickerIndex, setActiveGolferPickerIndex] = useState<number | null>(null);
  const [golferPickerQuery, setGolferPickerQuery] = useState("");
  const [pendingPayload, setPendingPayload] = useState<SaveRoundPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredGolferOptions = useMemo(() => {
    const query = golferPickerQuery.trim().toLowerCase();
    if (!query) {
      return distributionListOptions;
    }

    return distributionListOptions.filter(
      (entry) =>
        entry.label.toLowerCase().includes(query) || entry.email.toLowerCase().includes(query)
    );
  }, [distributionListOptions, golferPickerQuery]);

  const inviteableRecipients = useMemo(() => {
    const currentPlayerEmails = new Set(
      players.map((player) => player.email.trim().toLowerCase()).filter(Boolean)
    );
    const openSpots = maxPlayers - currentPlayerEmails.size;
    const existingInviteEmails = new Set(
      (initialRound?.round_invitations ?? [])
        .map((invite) => invite.email.trim().toLowerCase())
        .filter(Boolean)
    );

    if (openSpots <= 0) {
      return [];
    }

    return distributionList.filter((entry) => {
      const email = entry.email.trim().toLowerCase();
      if (!email) {
        return false;
      }

      if (currentPlayerEmails.has(email)) {
        return false;
      }

      if (initialRound && existingInviteEmails.has(email)) {
        return false;
      }

      return true;
    });
  }, [distributionList, initialRound, maxPlayers, players]);

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
      setActiveGolferPickerIndex(null);
      setGolferPickerQuery("");
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
    setActiveGolferPickerIndex(null);
    setGolferPickerQuery("");
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

    if (activeGolferPickerIndex === index) {
      setActiveGolferPickerIndex(null);
      setGolferPickerQuery("");
    } else if (activeGolferPickerIndex !== null && index < activeGolferPickerIndex) {
      setActiveGolferPickerIndex(activeGolferPickerIndex - 1);
    }

    setPlayers((current) => current.filter((_, playerIndex) => playerIndex !== index));
  }

  function openGolferPicker(index: number) {
    setActiveGolferPickerIndex(index);
    setGolferPickerQuery("");
  }

  function closeGolferPicker() {
    setActiveGolferPickerIndex(null);
    setGolferPickerQuery("");
  }

  function selectSavedGolfer(email: string) {
    if (activeGolferPickerIndex === null) {
      return;
    }

    updatePlayer(activeGolferPickerIndex, "email", email);
    closeGolferPicker();
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

    const teeTime = localDateTimeToUtcIso(roundDate, roundTime);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    return {
      teeTime,
      timeZone,
      maxPlayers,
      location: location.trim(),
      holes,
      players: cleanedPlayers,
      inviteMode,
      selectedInviteEmails:
        !initialRound || inviteMode === "selected"
          ? selectedInviteEmails
          : selectedInviteEmails.length > 0
            ? selectedInviteEmails
            : undefined
    };
  }

  function toggleSelectedInvite(email: string) {
    setSelectedInviteEmails((current) =>
      current.includes(email)
        ? current.filter((entryEmail) => entryEmail !== email)
        : [...current, email]
    );
  }

  function openInviteModal() {
    setError(null);
    setIsInviteModalOpen(true);
  }

  async function submitPayload(payload: SaveRoundPayload) {
    const saved = await onSave(payload);
    if (saved) {
      setPendingPayload(null);
      setIsInviteModalOpen(false);
      setSelectedInviteEmails([]);
      if (!initialRound) {
        setInviteMode("all");
      }
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
              <select
                value={maxPlayers}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  setMaxPlayers(nextValue);
                  if (players.length > nextValue) {
                    setPlayers((current) => current.slice(0, nextValue));
                  }
                }}
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
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
            </div>

            {players.map((player, index) => (
              <div className="player-row player-row-golfer" key={index}>
                <div className="golfer-input-group">
                  <input
                    type="email"
                    value={player.email}
                    placeholder="player@example.com"
                    onChange={(event) => updatePlayer(index, "email", event.target.value)}
                    disabled={!initialRound && index === 0}
                    required={index === 0}
                  />
                  {index === 0 && !initialRound ? null : (
                    <button
                      className="ghost-button golfer-picker-button"
                      type="button"
                      onClick={() => openGolferPicker(index)}
                      disabled={distributionListOptions.length === 0}
                    >
                      Saved golfers
                    </button>
                  )}
                </div>
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

            <div className="add-golfer-action">
              <button className="ghost-button" type="button" onClick={addPlayerRow}>
                Add Golfer
              </button>
            </div>

            {initialRound && selectedInviteEmails.length > 0 ? (
              <p className="muted">
                {selectedInviteEmails.length} invite{selectedInviteEmails.length === 1 ? "" : "s"} selected to send when you update this round.
              </p>
            ) : null}
          </div>

          {error ? <p className="error-message">{error}</p> : null}

          {initialRound ? (
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={openInviteModal} disabled={saving}>
                Add Invites
              </button>
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Update Round"}
              </button>
            </div>
          ) : (
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Create Round"}
            </button>
          )}
        </form>
      </section>

      {activeGolferPickerIndex !== null ? (
        <div className="modal-backdrop" role="presentation" onClick={closeGolferPicker}>
          <section
            className="panel modal-panel golfer-picker-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="golfer-picker-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Saved Golfers</p>
                <h2 id="golfer-picker-title">Choose a saved golfer</h2>
              </div>
              <button className="ghost-button" type="button" onClick={closeGolferPicker}>
                Close
              </button>
            </div>

            <div className="stack-sm">
              <label>
                <span>Search saved golfers</span>
                <input
                  type="text"
                  value={golferPickerQuery}
                  onChange={(event) => setGolferPickerQuery(event.target.value)}
                  placeholder="Search by name or email"
                />
              </label>

              {distributionListOptions.length === 0 ? (
                <div className="empty-state">
                  <p>No saved golfers yet.</p>
                  <span>Add people to your distribution list to reuse them here.</span>
                </div>
              ) : filteredGolferOptions.length === 0 ? (
                <div className="empty-state">
                  <p>No matching golfers.</p>
                  <span>Try a different name or email search.</span>
                </div>
              ) : (
                <ul className="player-pill-list golfer-picker-list">
                  {filteredGolferOptions.map((entry) => (
                    <li key={entry.email}>
                      <button
                        className="golfer-picker-option"
                        type="button"
                        onClick={() => selectSavedGolfer(entry.email)}
                      >
                        <span>{entry.label}</span>
                        <small>{entry.email}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      ) : null}

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
                <p className="eyebrow">{initialRound ? "Stage Invites" : "Select Invites"}</p>
                <h2 id="invite-selection-title">
                  {initialRound ? "Choose recipients to invite on update" : "Choose recipients for this round"}
                </h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => setIsInviteModalOpen(false)}>
                Close
              </button>
            </div>

            <div className="stack-sm">
              <p className="muted">
                {initialRound
                  ? "Pick which saved distribution-list recipients should receive an invitation when you update this round."
                  : "Pick which saved distribution-list recipients should receive an invitation when this round is created."}
              </p>

              {inviteableRecipients.length === 0 ? (
                <div className="empty-state">
                  <p>{distributionList.length === 0 ? "No saved recipients yet." : "No eligible invite recipients."}</p>
                  <span>
                    {distributionList.length === 0
                      ? "You can still save the round without sending distribution-list invitations."
                      : "Everyone on your saved list is already playing or has already been invited."}
                  </span>
                </div>
              ) : (
                <ul className="player-pill-list">
                  {inviteableRecipients.map((entry) => {
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
                {initialRound ? (
                  <>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setSelectedInviteEmails([])}
                      disabled={saving || selectedInviteEmails.length === 0}
                    >
                      Clear
                    </button>
                    <button className="primary-button" type="button" onClick={() => setIsInviteModalOpen(false)} disabled={saving}>
                      Done
                    </button>
                  </>
                ) : (
                  <>
                    <button className="ghost-button" type="button" onClick={() => setIsInviteModalOpen(false)}>
                      Back
                    </button>
                    <button className="primary-button" type="button" onClick={() => void handleConfirmInvites()} disabled={saving}>
                      {saving ? "Saving..." : "Confirm invites"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
