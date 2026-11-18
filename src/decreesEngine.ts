/**
 * Указы и приказы синдиката с электронной подписью.
 *
 * Подпись — Ed25519 (WebCrypto, нода — через тот же интерфейс Node). Ключевая
 * пара выводится из выбранной пары слов: act как соль для PBKDF2-SHA256
 * (310 000 итераций), затем два Ed25519-ключа — ключ подписи (первый корень) и
 * ключ отпечатка (второй корень). Отпечаток на документе — это HC-256 поток
 * от SHA-256 (раундовый регистр как в спецификации HC-256, 256 бит ключа,
 * 256 бит IV), поэтому сам ключ подписи никогда не покидает устройство
 * (non-extractable CryptoKey).
 *
 * Подписывается не строка, показанная человеку, а каноничная форма (поля
 * документа, все кроме подписи), поэтому по документу можно проверить, не
 * меняли ли его после подписания.
 */

export type DecreeKind = "decree" | "order";
/** 4 — приказ, 3 — указ, 2 — распоряжение, 1 — резолюция. */
export type DecreeRank = 1 | 2 | 3 | 4;

export interface DecreeDocument {
  id: string;
  kind: DecreeKind;
  /** Номер внутри недели: 1, 2, 3… */
  number: number;
  week: number;
  /** Формальная дата документа. */
  date: string;
  /** Кому адресован документ. */
  addressee: string;
  title: string;
  body: string;
  /** Кто подписал и в каком качестве. */
  signerName: string;
  signerRole: string;
  /** Не перевод и не БД, а карточка для людей. */
  rank: DecreeRank;
}

export interface DecreeSignature {
  algorithm: "Ed25519";
  /** Base64: 32 байта открытого ключа Ed25519. */
  publicKey: string;
  /** Base64: 64 байта подписи Ed25519. */
  signature: string;
  /** HC-256 поток от SHA-256 каноничной формы (64 hex-символа). */
  fingerprint: string;
  /** ISO-время момента подписания. */
  signedAt: string;
}

export type DecreeVerdict =
  | { status: "invalid"; reason: string }
  | { status: "valid"; signedAt: string; publicKey: string };

/** Поля документа без подписи — ровно то, что защищает ЭП. */
export type SignedFields = Omit<DecreeDocument, "id">;

export interface SignedDecree extends DecreeDocument {
  signature: DecreeSignature;
}

export interface DecreeState {
  documents: SignedDecree[];
}

export const DECREE_KIND_LABELS: Record<DecreeKind, string> = {
  decree: "Указ",
  order: "Приказ",
};

export const DECREE_RANK_LABELS: Record<DecreeRank, string> = {
  1: "Резолюция",
  2: "Распоряжение",
  3: "Указ",
  4: "Приказ",
};

export const MIN_PASSPHRASE_WORDS = 8;

/* -------------------------------------------------------------------------- */
/* Кодеки                                                                     */
/* -------------------------------------------------------------------------- */

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const encoder = new TextEncoder();

/** TextEncoder всегда создаёт ArrayBuffer, но тип это не выражает — помогаем TS. */
const utf8 = (text: string): Uint8Array<ArrayBuffer> => encoder.encode(text);

/* -------------------------------------------------------------------------- */
/* Каноничная форма и хеш                                                     */
/* -------------------------------------------------------------------------- */

function canonicalDocument(fields: SignedFields): string {
  const entries: [string, string | number][] = [
    ["kind", fields.kind],
    ["number", fields.number],
    ["week", fields.week],
    ["date", fields.date],
    ["addressee", fields.addressee.trim()],
    ["title", fields.title.trim()],
    ["body", fields.body.trim()],
    ["signerName", fields.signerName.trim()],
    ["signerRole", fields.signerRole.trim()],
    ["rank", fields.rank],
  ];
  // key=value через перевод строки, в фиксированном порядке — стабильно между
  // браузерами и при пересохранении документа.
  return entries.map(([key, value]) => `${key}=${String(value)}`).join("\n");
}

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(digest);
}

export async function documentHash(fields: SignedFields): Promise<string> {
  return toHex(await sha256(utf8(canonicalDocument(fields))));
}

/* -------------------------------------------------------------------------- */
/* HC-256                                                                    */
/* -------------------------------------------------------------------------- */

const rotl32 = (value: number, count: number): number =>
  ((value << count) | (value >>> (32 - count))) >>> 0;

const f1 = (x: number): number => (rotl32(x, 10) ^ rotl32(x, 19) ^ (x >>> 3)) >>> 0;
const f2 = (x: number): number => (rotl32(x, 19) ^ rotl32(x, 27) ^ (x >>> 10)) >>> 0;

/** HC-256: 256-битный ключ и 256-битный IV, слово 32 бита, таблицы P и Q по 1024. */
export class HC256 {
  private readonly p = new Uint32Array(1024);
  private readonly q = new Uint32Array(1024);
  private counter = 0;

  constructor(key: Uint8Array, iv: Uint8Array) {
    if (key.length !== 32 || iv.length !== 32)
      throw new Error("HC-256: ожидаются ключ и IV по 32 байта.");
    const words = (bytes: Uint8Array): number[] => {
      const out: number[] = [];
      for (let i = 0; i < 32; i += 4) {
        out.push(
          (bytes[i] |
            (bytes[i + 1] << 8) |
            (bytes[i + 2] << 16) |
            (bytes[i + 3] << 24)) >>>
            0,
        );
      }
      return out;
    };
    const w = [...words(key), ...words(iv)];

    for (let i = 0; i < 2560; i += 1) {
      if (i < 1024)
        this.p[i] =
          w[i % 8] ^
          w[8 + (i % 8)] ^
          this.p[(i - 2) & 1023] ^
          this.p[(i - 10) & 1023] ^
          this.p[(i - 23) & 1023];
      if (i < 1024)
        this.q[i] =
          w[16 + (i % 8)] ^
          w[24 + (i % 8)] ^
          this.q[(i - 2) & 1023] ^
          this.q[(i - 10) & 1023] ^
          this.q[(i - 23) & 1023];
      this.nextWord();
    }
  }

  /** Одно слово гаммы (Little Endian в байтах через `stream`). */
  nextWord(): number {
    const i = this.counter & 1023;
    let r: number;
    if (this.counter < 1024) {
      const p = this.p;
      r =
        (this.q[(i - 3) & 1023] +
          this.q[(i - 10) & 1023] +
          this.q[(i - 511) & 1023]) >>>
        0;
      p[i] =
        (p[i] +
          p[(i - 7) & 1023] +
          (f1(p[(i - 3) & 1023]) ^ p[(i - 3) & 1023] ^ p[(i - 10) & 1023]) +
          r) >>>
        0;
      r = (r ^ p[i]) >>> 0;
    } else {
      const q = this.q;
      r =
        (this.p[(i - 3) & 1023] +
          this.p[(i - 10) & 1023] +
          this.p[(i - 511) & 1023]) >>>
        0;
      q[i] =
        (q[i] +
          q[(i - 7) & 1023] +
          (f2(q[(i - 3) & 1023]) ^ q[(i - 3) & 1023] ^ q[(i - 10) & 1023]) +
          r) >>>
        0;
      r = (r ^ q[i]) >>> 0;
    }
    this.counter += 1;
    return r >>> 0;
  }

  stream(length: number): Uint8Array {
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
      if ((i & 3) === 0) {
        const word = this.nextWord();
        for (let j = 0; j < 4 && i + j < length; j += 1)
          out[i + j] = (word >>> (j * 8)) & 0xff;
      }
    }
    return out;
  }
}

/** Отпечаток документа: 64 hex-символа из потока HC-256(SHA-256(документ)). */
export async function fingerprintOf(fields: SignedFields): Promise<string> {
  const hash = await sha256(utf8(canonicalDocument(fields)));
  const key = hash;
  const iv = await sha256(hash);
  return toHex(new HC256(key, iv).stream(32));
}

/* -------------------------------------------------------------------------- */
/* Ключи                                                                      */
/* -------------------------------------------------------------------------- */

/** Сколько слов должно быть в паре — 8; проверка мягкая, предупреждает в UI. */
export function passphraseIssue(passphrase: string): string | null {
  const words = passphrase.trim().split(/\s+/).filter(Boolean);
  if (words.length < MIN_PASSPHRASE_WORDS) {
    return `Для ключа нужно не меньше ${MIN_PASSPHRASE_WORDS} слов (сейчас ${words.length}).`;
  }
  return null;
}

export interface DecreeKeyPair {
  signingKey: CryptoKey;
  fingerprintKey: CryptoKey;
  publicKeyBase64: string;
  algorithm: "Ed25519";
}

/** PKCS#8-обёртка вокруг 32-байтного зерна Ed25519 (RFC 8410, версия 0). */
const ED25519_PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
  0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

async function hkdfEdit(base: ArrayBuffer, info: string, length = 32): Promise<Uint8Array<ArrayBuffer>> {
  const combined = new Uint8Array(base.byteLength + info.length);
  combined.set(new Uint8Array(base), 0);
  combined.set(utf8(info), base.byteLength);
  // Для Ed25519 нужен ровно seed в 32 байта; длиннее 64 — вторая половина SHA-512.
  const digestName = length > 32 ? "SHA-512" : "SHA-256";
  const digest = new Uint8Array(await crypto.subtle.digest(digestName, combined));
  return new Uint8Array(digest.slice(0, length));
}

function toPkcs8(seed: Uint8Array): Uint8Array<ArrayBuffer> {
  const pkcs8 = new Uint8Array(ED25519_PKCS8_PREFIX.length + seed.length);
  pkcs8.set(ED25519_PKCS8_PREFIX, 0);
  pkcs8.set(seed, ED25519_PKCS8_PREFIX.length);
  return pkcs8;
}

/**
 * Выводит пару ключей Ed25519 из пары слов. Ключи non-extractable, поэтому
 * приватный ключ не попадает ни в localStorage, ни в сохранение кампании.
 */
export async function deriveDecreeKeyPair(
  passphrase: string,
): Promise<DecreeKeyPair> {
  const normalized = passphrase.trim().split(/\s+/).join(" ").toLowerCase();
  if (!normalized) throw new Error("Пустая пара слов.");
  const seed = await crypto.subtle.importKey(
    "raw",
    utf8(normalized),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: utf8("emporium-decree-signature-v1"),
      iterations: 310_000,
    },
    seed,
    256,
  );
  const signingPkcs8 = toPkcs8(await hkdfEdit(bits, "ed25519-signing"));
  const fingerprintPkcs8 = toPkcs8(await hkdfEdit(bits, "ed25519-fingerprint"));
  // Открытый ключ берётся экспортом JWK у одноразового extractable-дубликата:
  // рабочие ключи остаются non-extractable и не уходят в сохранение.
  const [signingKey, fingerprintKey, jwk] = await Promise.all([
    crypto.subtle.importKey("pkcs8", signingPkcs8, { name: "Ed25519" }, false, [
      "sign",
    ]),
    crypto.subtle.importKey(
      "pkcs8",
      fingerprintPkcs8,
      { name: "Ed25519" },
      false,
      ["sign"],
    ),
    (async (): Promise<JsonWebKey> => {
      const probe = await crypto.subtle.importKey(
        "pkcs8",
        signingPkcs8,
        { name: "Ed25519" },
        true,
        ["sign"],
      );
      return crypto.subtle.exportKey("jwk", probe);
    })(),
  ]);
  if (!jwk.x) throw new Error("Не удалось получить открытый ключ Ed25519.");
  return {
    signingKey,
    fingerprintKey,
    publicKeyBase64: jwk.x,
    algorithm: "Ed25519",
  };
}

/* -------------------------------------------------------------------------- */
/* Подпись и проверка                                                         */
/* -------------------------------------------------------------------------- */

export async function signDecree(
  fields: SignedFields,
  keys: DecreeKeyPair,
  signedAt = new Date(),
): Promise<SignedDecree> {
  const payload = utf8(canonicalDocument(fields));
  const signature = await crypto.subtle.sign(
    { name: "Ed25519" },
    keys.signingKey,
    payload,
  );
  const fingerprint = await fingerprintOf(fields);
  return {
    ...fields,
    id: decreeId(fields),
    signature: {
      algorithm: "Ed25519",
      publicKey: keys.publicKeyBase64,
      signature: bytesToBase64(new Uint8Array(signature)),
      fingerprint,
      signedAt: signedAt.toISOString(),
    },
  };
}

function fieldsOf(document: DecreeDocument): SignedFields {
  const { id: _id, ...rest } = document;
  return {
    kind: rest.kind,
    number: rest.number,
    week: rest.week,
    date: rest.date,
    addressee: rest.addressee,
    title: rest.title,
    body: rest.body,
    signerName: rest.signerName,
    signerRole: rest.signerRole,
    rank: rest.rank,
  };
}

const publicKeyCache = new Map<string, Promise<CryptoKey>>();

async function importPublicKey(base64: string): Promise<CryptoKey> {
  const cached = publicKeyCache.get(base64);
  if (cached) return cached;
  const key = crypto.subtle.importKey(
    "raw",
    new Uint8Array(base64ToBytes(base64)),
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  publicKeyCache.set(base64, key);
  return key;
}

/**
 * Проверяет документ: Ed25519-подпись по каноничной форме и совпадение
 * отпечатка. Документ, изменённый после подписания, вернёт `invalid`.
 */
export async function verifyDecree(
  document: DecreeDocument,
  signature: DecreeSignature,
): Promise<DecreeVerdict> {
  if (signature.algorithm !== "Ed25519") {
    return { status: "invalid", reason: "Неизвестный алгоритм подписи." };
  }
  if (!signature.publicKey || !signature.signature) {
    return {
      status: "invalid",
      reason: "В документе нет открытого ключа или подписи.",
    };
  }
  const fields = fieldsOf(document);
  let signatureBytes: Uint8Array;
  let publicKey: CryptoKey;
  try {
    signatureBytes = base64ToBytes(signature.signature);
    publicKey = await importPublicKey(signature.publicKey);
  } catch {
    return {
      status: "invalid",
      reason: "Подпись или открытый ключ повреждены.",
    };
  }
  let signatureOk = false;
  try {
    signatureOk = await crypto.subtle.verify(
      { name: "Ed25519" },
      publicKey,
      new Uint8Array(signatureBytes),
      utf8(canonicalDocument(fields)),
    );
  } catch {
    signatureOk = false;
  }
  // Отпечаток сверяется первым: если он расходится, текст точно правили после
  // подписи — это точнее говорит игроку, что произошло, чем отказ подписи.
  const expected = await fingerprintOf(fields);
  if (expected !== signature.fingerprint) {
    return {
      status: "invalid",
      reason:
        "Отпечаток документа не совпадает — документ изменён после подписания.",
    };
  }
  if (!signatureOk)
    return {
      status: "invalid",
      reason: "Подпись не соответствует ключу или тексту документа.",
    };
  return {
    status: "valid",
    signedAt: signature.signedAt,
    publicKey: signature.publicKey,
  };
}

/* -------------------------------------------------------------------------- */
/* Номер, состояние, нормализация                                             */
/* -------------------------------------------------------------------------- */

export function nextDecreeNumber(
  documents: SignedDecree[],
  kind: DecreeKind,
  week: number,
): number {
  const numbers = documents
    .filter((document) => document.kind === kind && document.week === week)
    .map((document) => document.number);
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

export function decreeId(fields: SignedFields): string {
  return `decree_${fields.kind}_w${fields.week}_n${fields.number}`;
}

export function emptyDecreeState(): DecreeState {
  return { documents: [] };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Читает состояние из сохранения, отбрасывая битые записи. */
export function normalizeDecreeState(raw: unknown): DecreeState {
  if (!isRecord(raw) || !Array.isArray(raw.documents))
    return emptyDecreeState();
  const documents: SignedDecree[] = [];
  const seen = new Set<string>();
  for (const item of raw.documents) {
    if (!isRecord(item)) continue;
    const kind: DecreeKind = item.kind === "decree" ? "decree" : "order";
    const number = Math.max(1, Math.floor(Number(item.number) || 1));
    const week = Math.max(1, Math.floor(Number(item.week) || 1));
    const rankRaw = Math.floor(Number(item.rank) || 0);
    const rank: DecreeRank =
      rankRaw >= 1 && rankRaw <= 4
        ? (rankRaw as DecreeRank)
        : kind === "decree"
          ? 3
          : 4;
    const text = (value: unknown, fallback = ""): string =>
      typeof value === "string" ? value : fallback;
    const signature = item.signature;
    if (!isRecord(signature)) continue;
    if (
      typeof signature.publicKey !== "string" ||
      typeof signature.signature !== "string" ||
      typeof signature.fingerprint !== "string"
    )
      continue;
    const fields: SignedFields = {
      kind,
      number,
      week,
      date: text(item.date),
      addressee: text(item.addressee),
      title: text(item.title),
      body: text(item.body),
      signerName: text(item.signerName),
      signerRole: text(item.signerRole),
      rank,
    };
    const document: SignedDecree = {
      ...fields,
      id: decreeId(fields),
      signature: {
        algorithm: "Ed25519",
        publicKey: signature.publicKey,
        signature: signature.signature,
        fingerprint: signature.fingerprint,
        signedAt: text(signature.signedAt),
      },
    };
    if (seen.has(document.id)) continue;
    seen.add(document.id);
    documents.push(document);
  }
  return { documents };
}

/* -------------------------------------------------------------------------- */
/* Печать и копирование                                                       */
/* -------------------------------------------------------------------------- */

/** Текст документа для PDF-браузера и копирования в чат. */
export function formatDecreeText(document: SignedDecree): string {
  const lines: string[] = [
    `${DECREE_KIND_LABELS[document.kind].toUpperCase()} № ${document.number}/${document.week}`,
    `Дата: ${document.date}`,
    "",
    `Кому: ${document.addressee}`,
    `Заголовок: ${document.title}`,
    "",
    document.body,
    "",
    `Подписант: ${document.signerName} — ${document.signerRole}`,
    `Уровень: ${DECREE_RANK_LABELS[document.rank]}`,
    "",
    "— Электронная подпись —",
    `Алгоритм: ${document.signature.algorithm}`,
    `Открытый ключ: ${document.signature.publicKey}`,
    `Отпечаток: ${document.signature.fingerprint}`,
    `Подписано: ${document.signature.signedAt}`,
    `Подпись: ${document.signature.signature}`,
  ];
  return lines.join("\n");
}

/** Группирует отпечаток по 4 символа — для чтения и сверки по звонку. */
export function groupFingerprint(fingerprint: string): string {
  return fingerprint.replace(/(.{4})(?=.)/g, "$1 ").toUpperCase();
}
