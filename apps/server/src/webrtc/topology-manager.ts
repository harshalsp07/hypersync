import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("topology-manager");

type Topology = "mesh" | "sfu";

interface PeerConnection {
  userId: string;
  connection: unknown;
}

export class TopologyManager {
  private roomPeers: Map<string, Map<string, PeerConnection>> = new Map();
  private roomTopologies: Map<string, Topology> = new Map();
  private onTopologyChange?: (roomId: string, newTopology: Topology) => void;

  constructor() {}

  setTopologyChangeCallback(callback: (roomId: string, newTopology: Topology) => void) {
    this.onTopologyChange = callback;
  }

  addPeer(roomId: string, userId: string, connection: unknown): void {
    if (!this.roomPeers.has(roomId)) {
      this.roomPeers.set(roomId, new Map());
    }

    this.roomPeers.get(roomId)!.set(userId, { userId, connection });

    const peerCount = this.roomPeers.get(roomId)!.size;
    const currentTopology = this.roomTopologies.get(roomId) || "mesh";

    if (peerCount > 4 && currentTopology === "mesh") {
      log.info({ roomId, peerCount }, "Switching to SFU topology");
      this.roomTopologies.set(roomId, "sfu");
      this.onTopologyChange?.(roomId, "sfu");
    } else if (peerCount <= 4 && currentTopology === "sfu") {
      log.info({ roomId, peerCount }, "Switching to mesh topology");
      this.roomTopologies.set(roomId, "mesh");
      this.onTopologyChange?.(roomId, "mesh");
    }
  }

  removePeer(roomId: string, userId: string): void {
    const peers = this.roomPeers.get(roomId);
    if (peers) {
      peers.delete(userId);

      if (peers.size === 0) {
        this.roomPeers.delete(roomId);
        this.roomTopologies.delete(roomId);
      }
    }
  }

  getTopology(roomId: string): Topology {
    return this.roomTopologies.get(roomId) || "mesh";
  }

  getPeers(roomId: string): PeerConnection[] {
    const peers = this.roomPeers.get(roomId);
    return peers ? Array.from(peers.values()) : [];
  }

  getPeerCount(roomId: string): number {
    const peers = this.roomPeers.get(roomId);
    return peers ? peers.size : 0;
  }

  shouldSwitchToSFU(roomId: string): boolean {
    return this.getPeerCount(roomId) > 4;
  }

  cleanup(roomId: string): void {
    this.roomPeers.delete(roomId);
    this.roomTopologies.delete(roomId);
  }
}
