import { describe, expect, it } from "vitest";
import {
  HC256,
  base64ToBytes,
  bytesToBase64,
  decreeId,
  deriveDecreeKeyPair,
  emptyDecreeState,
  fingerprintOf,
  formatDecreeText,
  groupFingerprint,
  nextDecreeNumber,
  normalizeDecreeState,
  passphraseIssue,
  signDecree,
  verifyDecree,
  type DecreeSignature,
  type SignedDecree,
  type SignedFields,
} from "./decreesEngine";

const PASSPHRASE =
  "артель калиновка полночь реестр подпись сургуч конвой касса";

const fields = (overrides: Partial<SignedFields> = {}): SignedFields => ({
  kind: "decree",
  number: 1,
  week: 12,
  date: "19.03.1845",
  addressee: "Директору по логистике Д. Новаку",
  title: "О порядке отгрузки партии",
  body: "Партии с мезонина отгружать только при наличии двух подписей.",
  signerName: "Елена Вэнс",
  signerRole: "CEO",
  rank: 3,
  ...overrides,
});

describe("decrees engine", () => {
  it("signs a document with Ed25519 and verifies it", async () => {
    const keys = await deriveDecreeKeyPair(PASSPHRASE);
    const document = await signDecree(
      fields(),
      keys,
      new Date("1845-03-19T09:00:00.000Z"),
    );

    expect(document.signature.algorithm).toBe("Ed25519");
    expect(document.signature.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(document.signature.publicKey).toBe(keys.publicKeyBase64);
    expect(document.id).toBe(decreeId(fields()));

    const verdict = await verifyDecree(document, document.signature);
    expect(verdict.status).toBe("valid");
    if (verdict.status === "valid")
      expect(verdict.signedAt).toBe("1845-03-19T09:00:00.000Z");
  });

  it("rejects a document edited after signing", async () => {
    const keys = await deriveDecreeKeyPair(PASSPHRASE);
    const document = await signDecree(fields(), keys);
    const tampered: SignedDecree = {
      ...document,
      body: `${document.body} Плюс сжечь улики.`,
    };

    const verdict = await verifyDecree(tampered, tampered.signature);
    expect(verdict.status).toBe("invalid");
    if (verdict.status === "invalid")
      expect(verdict.reason).toMatch(/документ изменён/i);
  });

  it("rejects a signature made with a different pair of words", async () => {
    const signer = await deriveDecreeKeyPair(PASSPHRASE);
    const other = await deriveDecreeKeyPair(
      "другой ключ без единого общего слова но всё же длинный",
    );
    const document = await signDecree(fields(), signer);
    const foreign: DecreeSignature = {
      ...document.signature,
      publicKey: other.publicKeyBase64,
    };

    const verdict = await verifyDecree(document, foreign);
    expect(verdict.status).toBe("invalid");
    if (verdict.status === "invalid")
      expect(verdict.reason).toMatch(/не соответствует ключу/i);
  });

  it("derives the same key from the same words and a different one from other words", async () => {
    const a = await deriveDecreeKeyPair(PASSPHRASE);
    const b = await deriveDecreeKeyPair(`  ${PASSPHRASE.toUpperCase()}  `);
    const c = await deriveDecreeKeyPair(
      "совершенно другая пара слов которых явно больше восьми штук",
    );
    expect(a.publicKeyBase64).toBe(b.publicKeyBase64);
    expect(a.publicKeyBase64).not.toBe(c.publicKeyBase64);
  });

  it("produces a stable fingerprint and a fresh HC-256 stream", async () => {
    const first = await fingerprintOf(fields());
    const second = await fingerprintOf(fields());
    const changed = await fingerprintOf(fields({ number: 2 }));
    expect(first).toBe(second);
    expect(changed).not.toBe(first);
    expect(groupFingerprint(first)).toMatch(/^([0-9A-F]{4} ){15}[0-9A-F]{4}$/);
  });

  it("HC-256 streams deterministically from the same key and IV", () => {
    const key = new Uint8Array(32).fill(1);
    const iv = new Uint8Array(32).fill(2);
    const a = new HC256(key, iv).stream(48);
    const b = new HC256(key, iv).stream(48);
    const c = new HC256(key, new Uint8Array(32).fill(3)).stream(48);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
    expect(new Set(Array.from(a.slice(0, 16))).size).toBeGreaterThan(1);
  });

  it("numbers documents per kind and week", () => {
    const base = fields();
    const documents = [
      { ...base, id: "x", signature: {} as DecreeSignature },
      { ...base, id: "y", number: 2, signature: {} as DecreeSignature },
      {
        ...base,
        id: "z",
        kind: "order" as const,
        signature: {} as DecreeSignature,
      },
    ];
    expect(nextDecreeNumber(documents, "decree", 12)).toBe(3);
    expect(nextDecreeNumber(documents, "order", 12)).toBe(2);
    expect(nextDecreeNumber([], "decree", 13)).toBe(1);
  });

  it("warns about short pairs of words only", () => {
    expect(passphraseIssue("три слова")).toMatch(/не меньше 8 слов/);
    expect(passphraseIssue(PASSPHRASE)).toBeNull();
  });

  it("round-trips base64 helpers", () => {
    const bytes = new Uint8Array([0, 1, 127, 200, 255]);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(
      Array.from(bytes),
    );
  });

  it("normalizes saves, dropping broken entries and keeping the signed text", async () => {
    const keys = await deriveDecreeKeyPair(PASSPHRASE);
    const document = await signDecree(fields(), keys);

    const state = normalizeDecreeState({
      documents: [document, { kind: "decree" }, null, "x"],
    });
    expect(state.documents).toHaveLength(1);
    expect(state.documents[0].body).toBe(fields().body);
    expect(
      await verifyDecree(state.documents[0], state.documents[0].signature),
    ).toMatchObject({ status: "valid" });

    expect(normalizeDecreeState(null)).toEqual(emptyDecreeState());
    expect(normalizeDecreeState({ documents: "nope" })).toEqual(
      emptyDecreeState(),
    );
  });

  it("renders the printed form with the signature block", async () => {
    const keys = await deriveDecreeKeyPair(PASSPHRASE);
    const document = await signDecree(fields(), keys);
    const text = formatDecreeText(document);
    expect(text).toContain("УКАЗ № 1/12");
    expect(text).toContain("Отпечаток: " + document.signature.fingerprint);
    expect(text).toContain(`Подпись: ${document.signature.signature}`);
  });
});
