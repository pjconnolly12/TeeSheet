import { useEffect, useState } from "react";
import type { DistributionListEntryInput, DistributionListEntryRow } from "../types/app";

interface DistributionListPanelProps {
  entries: DistributionListEntryRow[];
  isOpen: boolean;
  onClose: () => void;
  saving: boolean;
  onSave: (entries: DistributionListEntryInput[]) => Promise<void>;
}

const EMPTY_ENTRY: DistributionListEntryInput = {
  name: "",
  email: ""
};

export function DistributionListPanel({
  entries,
  isOpen,
  onClose,
  saving,
  onSave
}: DistributionListPanelProps) {
  const [draftEntries, setDraftEntries] = useState<DistributionListEntryInput[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formEntry, setFormEntry] = useState<DistributionListEntryInput>(EMPTY_ENTRY);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nextEntries = entries.map((entry) => ({
      name: entry.name ?? "",
      email: entry.email
    }));

    setDraftEntries(nextEntries);
    setEditingIndex(null);
    setFormEntry(EMPTY_ENTRY);
  }, [entries]);

  function resetEditor() {
    setEditingIndex(null);
    setFormEntry(EMPTY_ENTRY);
  }

  function startEdit(index: number) {
    setEditingIndex(index);
    setFormEntry(draftEntries[index] ?? EMPTY_ENTRY);
    setMessage(null);
    setError(null);
  }

  function removeEntry(index: number) {
    setDraftEntries((current) => current.filter((_, entryIndex) => entryIndex !== index));
    if (editingIndex === index) {
      resetEditor();
    } else if (editingIndex !== null && index < editingIndex) {
      setEditingIndex(editingIndex - 1);
    }
    setMessage(null);
    setError(null);
  }

  function upsertEntry() {
    const cleanedEntry = {
      name: formEntry.name.trim(),
      email: formEntry.email.trim().toLowerCase()
    };

    if (!cleanedEntry.email) {
      setError("Email is required.");
      return;
    }

    const duplicateIndex = draftEntries.findIndex(
      (entry, index) =>
        entry.email.toLowerCase() === cleanedEntry.email &&
        index !== editingIndex
    );

    if (duplicateIndex !== -1) {
      setError("That email is already in the distribution list.");
      return;
    }

    setDraftEntries((current) => {
      if (editingIndex === null) {
        return [...current, cleanedEntry];
      }

      return current.map((entry, index) =>
        index === editingIndex ? cleanedEntry : entry
      );
    });

    resetEditor();
    setMessage(null);
    setError(null);
  }

  async function handleSave() {
    setMessage(null);
    setError(null);

    try {
      await onSave(draftEntries);
      setMessage("Distribution list saved.");
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error ? caughtError.message : "Could not save distribution list.";
      setError(nextError);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="panel modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="distribution-list-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Owner Distribution List</p>
            <h2 id="distribution-list-title">View and Update the Full List</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="stack-sm">
          <p className="muted">
            When you create a round, TeeLogic emails everyone on this list in addition to the golfers assigned to the round.
          </p>

          <div className="distribution-list-summary">
            <span className="muted">
              {draftEntries.length === 0
                ? "No saved recipients yet."
                : `${draftEntries.length} saved recipient${draftEntries.length === 1 ? "" : "s"}`}
            </span>
          </div>

          {draftEntries.length > 0 ? (
            <ul className="player-pill-list">
              {draftEntries.map((entry, index) => (
                <li className="list-entry" key={entry.email}>
                  <div>
                    <span>{entry.name || "Unnamed recipient"}</span>
                    <small>{entry.email}</small>
                  </div>
                  <div className="list-entry-actions">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => startEdit(index)}
                    >
                      Edit
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => removeEntry(index)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="stack-sm distribution-editor">
            <p className="muted">
              {editingIndex === null ? "Add a recipient" : "Update recipient"}
            </p>

            <div className="player-row">
              <input
                type="text"
                value={formEntry.name}
                placeholder="Optional name"
                onChange={(event) =>
                  setFormEntry((current) => ({ ...current, name: event.target.value }))
                }
              />
              <input
                type="email"
                value={formEntry.email}
                placeholder="friend-group@example.com"
                onChange={(event) =>
                  setFormEntry((current) => ({ ...current, email: event.target.value }))
                }
              />
              <button className="primary-button" type="button" onClick={upsertEntry}>
                {editingIndex === null ? "Add" : "Update"}
              </button>
            </div>

            {editingIndex !== null ? (
              <button className="text-button" type="button" onClick={resetEditor}>
                Cancel edit
              </button>
            ) : null}
          </div>

          {message ? <p className="success-message">{message}</p> : null}
          {error ? <p className="error-message">{error}</p> : null}

          <button className="primary-button" type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save full distribution list"}
          </button>
        </div>
      </section>
    </div>
  );
}
