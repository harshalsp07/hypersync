import * as Y from "yjs";
import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("replay-engine");

export class ReplayEngine {
  reconstructFromSnapshot(
    currentDoc: Y.Doc,
    snapshotRef: Y.Snapshot,
    updates: Uint8Array[] = []
  ): Y.Doc {
    const pastDoc = Y.createDocFromSnapshot(currentDoc, snapshotRef);

    for (const update of updates) {
      Y.applyUpdate(pastDoc, update);
    }

    return pastDoc;
  }

  getTextContent(doc: Y.Doc, textName: string = "codemirror"): string {
    const text = doc.getText(textName);
    return text.toString();
  }

  getMapContent(doc: Y.Doc, mapName: string): Map<string, unknown> {
    const map = doc.getMap(mapName);
    const result = new Map<string, unknown>();
    map.forEach((value, key) => {
      result.set(key, value);
    });
    return result;
  }

  destroyDoc(doc: Y.Doc) {
    doc.destroy();
  }
}
