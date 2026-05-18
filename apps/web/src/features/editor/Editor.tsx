import { useEffect, useRef, useState } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter } from "@codemirror/language";
import * as Y from "yjs";
import { yCollab } from "y-codemirror.next";
import { WSProvider } from "../../providers/ws-provider.js";
import { UserAvatar } from "../../ui/UserAvatar.js";
import config from "../../config.js";

interface EditorProps {
  roomId: string;
  token: string;
  onConnect?: () => void;
}

export function Editor({ roomId, token, onConnect }: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [connected, setConnected] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [users] = useState(["alice", "bob"]);

  useEffect(() => {
    if (!editorRef.current) return;

    const doc = new Y.Doc();
    const ytext = doc.getText("codemirror");

    const wsUrl = `${config.wsUrl}/ws?token=${token}&room=${roomId}`;
    const provider = new WSProvider(wsUrl, doc);

    provider.onSync(() => {
      setConnected(true);
      onConnect?.();
    });

    const undoManager = new Y.UndoManager(ytext);

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        bracketMatching(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        javascript(),
        oneDark,
        yCollab(ytext, provider as any, { undoManager }),
        EditorView.updateListener.of((update) => {
          if (update.selectionSet) {
            const pos = update.state.selection.main.head;
            const line = update.state.doc.lineAt(pos);
            setCursorPos({ line: line.number, col: pos - line.from + 1 });
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;
    provider.connect();

    return () => {
      view.destroy();
      provider.disconnect();
      doc.destroy();
    };
  }, [roomId, token]);

  return (
    <div className="editor-wrapper">
      <div className="editor-topbar">
        <span className="editor-title">Code Editor</span>
        <div className="editor-users">
          {users.map((u) => (
            <UserAvatar key={u} username={u} size="sm" />
          ))}
        </div>
      </div>
      <div className="editor-body" ref={editorRef} />
      <div className="editor-statusbar">
        <div className="status-left">
          <span className="status-item">Ln {cursorPos.line}, Col {cursorPos.col}</span>
          <span className="status-item">JavaScript</span>
        </div>
        <div className="status-right">
          <span className="status-item">{users.length + 1} online</span>
          <span className="status-item" style={{ color: connected ? "var(--green)" : "var(--yellow)" }}>
            {connected ? "● Synced" : "○ Syncing..."}
          </span>
        </div>
      </div>
    </div>
  );
}
