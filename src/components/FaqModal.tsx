const FAQ_ITEMS = [
  {
    question: "What rounds will be visible to me?",
    answer: "You will see any rounds that you created or that you were invited to."
  },
  {
    question: "Can anyone create rounds?",
    answer:
      "Yes. Anybody can use the create round function to send invites and track who is playing with them. You can use the distribution list to create a list of users to send invites to."
  },
  {
    question: "What emails will I get?",
    answer:
      "You will get an email when a round is created with you as a player or when you are invited. You will also receive an email reminder 36 hours before a round if you are in the group. You will also receive an email if you get added to a round from the waitlist."
  },
  {
    question: "How does the waitlist work?",
    answer:
      "The waitlist can be used to save your spot in case someone has to leave the round. The top member of the waitlist will be automatically added when a spot opens up. They will be sent an email to alert them that they have been added."
  },
  {
    question: "Why can't I leave the round?",
    answer:
      "You cannot leave a round within 24 hours of the tee time. You must contact the owner directly to work that out. This is due to most courses' 24-hour policy for tee times."
  }
];

interface FaqModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FaqModal({ isOpen, onClose }: FaqModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="panel modal-panel faq-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="faq-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Help</p>
            <h2 id="faq-modal-title">Frequently Asked Questions</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="stack-sm">
          {FAQ_ITEMS.map((item, index) => (
            <details className="faq-item" key={item.question} open={index === 0}>
              <summary className="faq-question">{item.question}</summary>
              <p className="faq-answer">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
