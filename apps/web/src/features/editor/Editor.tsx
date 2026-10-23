import { useEffect, useRef, useState, useCallback } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter } from "@codemirror/language";
import * as Y from "yjs";
import { yCollab } from "y-codemirror.next";
import { WSProvider, RoomMember } from "../../providers/ws-provider.js";
import { UserAvatar } from "../../ui/UserAvatar.js";

interface EditorProps {
  roomId: string;
  token?: string;
  doc: Y.Doc;
  provider?: WSProvider | null;
  members?: RoomMember[];
  connected?: boolean;
}

export function Editor({ roomId, doc, provider, members = [], connected = true }: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeFile, setActiveFile] = useState("main.js");
  const [files, setFiles] = useState<string[]>(["main.js", "notes.md"]);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const initEditor = useCallback(() => {
    if (!editorRef.current) return;
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const ytext = doc.getText(`file:${activeFile}`);
    if (ytext.length === 0 && activeFile === "main.js") {
      ytext.insert(0, `// HyperSync Collaborative Code Engine\n// Room: ${roomId}\n\nfunction helloWorld() {\n  console.log("HyperSync real-time sync active!");\n}\n\nhelloWorld();\n`);
    }

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

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    });
  }, [doc, activeFile, roomId, provider]);

  useEffect(() => {
    initEditor();
    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [initEditor]);

  // File Upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    const fileName = uploadedFile.name;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const ytext = doc.getText(`file:${fileName}`);
      doc.transact(() => {
        if (ytext.length > 0) {
          ytext.delete(0, ytext.length);
        }
        ytext.insert(0, content);
      });

      if (!files.includes(fileName)) {
        setFiles((prev) => [...prev, fileName]);
      }
      setActiveFile(fileName);
    };
    reader.readAsText(uploadedFile);
  };

  // Drag and drop code files onto the editor
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;

    const fileName = droppedFile.name;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const ytext = doc.getText(`file:${fileName}`);
      doc.transact(() => {
        if (ytext.length > 0) {
          ytext.delete(0, ytext.length);
        }
        ytext.insert(0, content);
      });

      if (!files.includes(fileName)) {
        setFiles((prev) => [...prev, fileName]);
      }
      setActiveFile(fileName);
    };
    reader.readAsText(droppedFile);
  };

  const handleDownload = () => {
    const ytext = doc.getText(`file:${activeFile}`);
    const blob = new Blob([ytext.toString()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeFile;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleNewFile = () => {
    const name = prompt("Enter file name (e.g. index.ts, style.css):");
    if (name && !files.includes(name)) {
      setFiles((prev) => [...prev, name]);
      setActiveFile(name);
    }
  };

  return (
    <div className="editor-wrapper" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      <div className="editor-topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", gap: "4px" }}>
            {files.map((f) => (
              <button
                key={f}
                className={`tab-btn ${activeFile === f ? "active" : ""}`}
                style={{
                  background: activeFile === f ? "var(--bg-active, #2e303e)" : "transparent",
                  color: activeFile === f ? "#fff" : "var(--text-secondary)",
                  border: "1px solid var(--border-subtle, #333)",
                  borderRadius: "4px",
                  padding: "4px 10px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
                onClick={() => setActiveFile(f)}
              >
                📄 {f}
              </button>
            ))}
            <button
              onClick={handleNewFile}
              title="Add New File"
              style={{
                background: "transparent",
                color: "var(--text-secondary)",
                border: "1px dashed var(--border-subtle, #444)",
                borderRadius: "4px",
                padding: "4px 8px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              +
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileUpload}
            accept=".js,.ts,.jsx,.tsx,.py,.json,.md,.html,.css,.txt"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload code or text file"
            style={{
              background: "var(--accent-surface, rgba(99, 102, 241, 0.2))",
              color: "var(--accent, #818cf8)",
              border: "1px solid rgba(99, 102, 241, 0.4)",
              borderRadius: "4px",
              padding: "4px 10px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            ⬆ Upload File
          </button>
          <button
            onClick={handleDownload}
            title="Download active file"
            style={{
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle, #333)",
              borderRadius: "4px",
              padding: "4px 10px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            ⬇ Export
          </button>
          <div className="editor-users" style={{ display: "flex", gap: "4px" }}>
            {members.map((u) => (
              <UserAvatar key={u.id || u.username} username={u.username} size="sm" />
            ))}
          </div>
        </div>
      </div>

      <div className="editor-body" ref={editorRef} style={{ flex: 1, minHeight: "350px" }} />

      <div className="editor-statusbar">
        <div className="status-left">
          <span className="status-item">Ln {cursorPos.line}, Col {cursorPos.col}</span>
          <span className="status-item">{activeFile}</span>
        </div>
        <div className="status-right">
          <span className="status-item">{members.length > 0 ? members.length : 1} in room</span>
          <span className="status-item" style={{ color: connected ? "var(--green, #22c55e)" : "var(--yellow, #eab308)" }}>
            {connected ? "● Synced" : "○ Offline"}
          </span>
        </div>
      </div>
    </div>
  );
}
