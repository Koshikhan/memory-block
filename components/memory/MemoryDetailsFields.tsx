type Props = {
    locked: boolean;
    sender: string;
    recipient: string;
    message: string;
    onSenderChange: (value: string) => void;
    onRecipientChange: (value: string) => void;
    onMessageChange: (value: string) => void;
  };
  
  export default function MemoryDetailsFields({
    locked,
    sender,
    recipient,
    message,
    onSenderChange,
    onRecipientChange,
    onMessageChange,
  }: Props) {
    return (
      <fieldset
        disabled={locked}
        className="mt-8 min-w-0 border-t border-slate-200 pt-8"
      >
        <legend className="text-xl font-semibold">
          Memory details
        </legend>
  
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            From
  
            <input
              type="text"
              required
              value={sender}
              onChange={(event) =>
                onSenderChange(event.target.value)
              }
              placeholder="Sender’s name"
              maxLength={80}
              className="rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
            />
          </label>
  
          <label className="grid gap-2 text-sm font-medium">
            For
  
            <input
              type="text"
              required
              value={recipient}
              onChange={(event) =>
                onRecipientChange(event.target.value)
              }
              placeholder="Recipient’s name"
              maxLength={80}
              className="rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
            />
          </label>
        </div>
  
        <label className="mt-6 grid gap-2 text-sm font-medium">
          Short message — optional
  
          <textarea
            value={message}
            onChange={(event) =>
              onMessageChange(event.target.value)
            }
            placeholder="A little message, made just for you."
            maxLength={500}
            rows={3}
            className="resize-y rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
          />
  
          <span className="text-right text-xs font-normal text-slate-400">
            {message.length}/500
          </span>
        </label>
      </fieldset>
    );
  }
  