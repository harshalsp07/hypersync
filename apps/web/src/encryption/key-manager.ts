export class KeyManager {
  private static readonly ALGORITHM = "AES-GCM";
  private static readonly KEY_LENGTH = 256;

  static async generateKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH,
      },
      true,
      ["encrypt", "decrypt"]
    );
  }

  static async exportKey(key: CryptoKey): Promise<string> {
    const rawKey = await crypto.subtle.exportKey("raw", key);
    return btoa(String.fromCharCode(...new Uint8Array(rawKey)));
  }

  static async importKey(keyStr: string): Promise<CryptoKey> {
    const rawKey = Uint8Array.from(atob(keyStr), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey(
      "raw",
      rawKey.buffer as ArrayBuffer,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      true,
      ["encrypt", "decrypt"]
    );
  }

  static async encrypt(key: CryptoKey, data: Uint8Array): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: this.ALGORITHM, iv: iv.buffer as ArrayBuffer },
      key,
      data.buffer as ArrayBuffer
    );
    return { iv, ciphertext: new Uint8Array(ciphertext) };
  }

  static async decrypt(key: CryptoKey, iv: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array> {
    const plaintext = await crypto.subtle.decrypt(
      { name: this.ALGORITHM, iv: iv.buffer as ArrayBuffer },
      key,
      ciphertext.buffer as ArrayBuffer
    );
    return new Uint8Array(plaintext);
  }

  static keyToHashFragment(keyStr: string): string {
    return `#key=${encodeURIComponent(keyStr)}`;
  }

  static keyFromHashFragment(hash: string): string | null {
    const match = hash.match(/#key=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }
}
