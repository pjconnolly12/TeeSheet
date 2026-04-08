import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { PlayerInput, RoundWithPlayers } from "../types/app";
import { toDateInputValue, toTimeInputValue } from "../utils/date";

interface RoundFormProps {
  initialRound?: RoundWithPlayers | null;
  creatorPlayer: PlayerInput;
  onCancelEdit: () => void;
  onSave: (payload: {
    teeTime: string;
    maxPlayers: number;
    location: string;
    holes: number;
    players: PlayerInput[];
  }) => Promise<void>;
  saving: boolean;
}

const EMPTY_PLAYER: PlayerInput = { email: "" };

export function RoundForm({
  initialRound,
  creatorPlayer,
  onCancelEdit,
  onSave,
  saving
}: RoundFormProps) {
  const initialPlayers = useMemo(() => {
    if (!initialRound) {
      return [{ ...creatorPlayer }];
    }

    return initialRound.round_players.length > 0
      ? initialRound.round_players.map((player) => ({
          email: player.email
        }))
      : [{ ...EMPTY_PLAYER }];
  }, [creatorPlayer, initialRound]);

  const [roundDate, setRoundDate] = useState("");
  const [roundTime, setRoundTime] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [location, setLocation] = useState("");
  const [holes, setHoles] = useState(18);
  const [players, setPlayers] = useState<PlayerInput[]>(initialPlayers);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialRound) {
      setRoundDate("");
      setRoundTime("");
      setMaxPlayers(4);
      setLocation("");
      setHoles(18);
      setPlayers([{ ...creatorPlayer }]);
      setError(null);
      return;
    }

    setRoundDate(toDateInputValue(initialRound.tee_time));
    setRoundTime(toTimeInputValue(initialRound.tee_time));
    setMaxPlayers(initialRound.max_players);
    setLocation(initialRound.location);
    setHoles(initialRound.holes);
    setPlayers(initialPlayers);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const cleanedPlayers = players
      .map((player) => ({
        email: player.email.trim().toLowerCase()
      }))
      .filter((player) => player.email);

    if (cleanedPlayers.length === 0) {
      setError("Add at least one golfer for the round.");
      return;
    }

    if (cleanedPlayers.length > maxPlayers) {
      setError("The player list is larger than the round capacity.");
      return;
    }

    await onSave({
      teeTime: new Date(`${roundDate}T${roundTime}`).toISOString(),
      maxPlayers,
      location: location.trim(),
      holes,
      players: cleanedPlayers
    });
  }

  return (
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
            placeholder="Breakfast Hill"
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
                value={player.email}
                placeholder="player@example.com"
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
    </section>
  );
}
