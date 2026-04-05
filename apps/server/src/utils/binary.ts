import { MessageType, MessageFlags } from "@hypersync/shared";

export function encodeEnvelope(type: MessageType, flags: number, payload: Uint8Array): Uint8Array {
  const frame = new Uint8Array(2 + payload.length);
  frame[0] = type;
  frame[1] = flags;
  frame.set(payload, 2);
  return frame;
}

export function decodeEnvelope(data: ArrayBuffer | Uint8Array): {
  type: MessageType;
  flags: number;
  payload: Uint8Array;
} | null {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (buf.length < 2) return null;

  return {
    type: buf[0] as MessageType,
    flags: buf[1],
    payload: buf.slice(2),
  };
}

export function isEncrypted(flags: number): boolean {
  return (flags & MessageFlags.ENCRYPTED) !== 0;
}

export function isCompressed(flags: number): boolean {
  return (flags & MessageFlags.COMPRESSED) !== 0;
}

export function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
