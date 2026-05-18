import { KeyManager } from "./key-manager.js";

export class E2EEEncryptor {
  private key: CryptoKey | null = null;

  async setKey(keyStr: string) {
    this.key = await KeyManager.importKey(keyStr);
  }

  async generateAndSetKey(): Promise<string> {
    this.key = await KeyManager.generateKey();
    return KeyManager.exportKey(this.key);
  }

  async encrypt(data: Uint8Array): Promise<Uint8Array> {
    if (!this.key) throw new Error("Key not set");

    const { iv, ciphertext } = await KeyManager.encrypt(this.key, data);
    const result = new Uint8Array(iv.length + ciphertext.length);
    result.set(iv, 0);
    result.set(ciphertext, iv.length);
    return result;
  }

  async decrypt(data: Uint8Array): Promise<Uint8Array> {
    if (!this.key) throw new Error("Key not set");

    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12);
    return KeyManager.decrypt(this.key, iv, ciphertext);
  }

  isReady(): boolean {
    return this.key !== null;
  }
}
