import React, { useState } from "react";

const ChatSidebar = ({ messages, onSend }) => {
  const [draft, setDraft] = useState("");

  const submit = (event) => {
    event.preventDefault();
    if (!draft.trim()) {
      return;
    }
    onSend(draft.trim());
    setDraft("");
  };

  return (
    <aside className="flex h-full flex-col rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Live Chat</h3>
      </div>

      <div className="flex-1 space-y-2 overflow-auto px-4 py-3">
        {messages.map((message) => (
          <div key={message.id} className="rounded-lg bg-slate-100 p-2 text-xs">
            <p className="font-semibold text-slate-700">{message.sender}</p>
            <p className="text-slate-600">{message.message}</p>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="border-t border-slate-200 p-3">
        <div className="flex gap-2">
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type a message"
          />
          <button type="submit" className="rounded-lg bg-blue-600 px-3 text-sm text-white">
            Send
          </button>
        </div>
      </form>
    </aside>
  );
};

export default ChatSidebar;
