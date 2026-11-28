const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { TextDecoder } = require('node:util');

// Transport budget, not a model token estimate. Zero disables inline output.
const budget = Number(process.env.DOUYIN_WORLD_RESULT_BYTES ?? 8192);
if (!Number.isSafeInteger(budget) || budget < 0 || budget > 1048576) {
  throw new Error('DOUYIN_WORLD_RESULT_BYTES must be an integer from 0 to 1048576');
}
const pageBudget = budget || 8192;
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'douyin-world-mcp-'));
const records = new Map();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const channels = ['stdout', 'stderr'];

function begin() {
  const id = randomUUID();
  const dir = path.join(root, id);
  fs.mkdirSync(dir, { mode: 0o700 });
  return { id, dir };
}
function file(record, channel) {
  if (!channels.includes(channel)) throw new Error('stream must be stdout or stderr');
  return path.join(record.dir, channel);
}
async function describe(filename) {
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of fs.createReadStream(filename)) {
    bytes += chunk.length;
    hash.update(chunk);
  }
  return { bytes, sha256: hash.digest('hex') };
}
function lookup(id) {
  const record = records.get(id);
  if (!record) throw new Error('Unknown result_id in this MCP process');
  return record;
}
function textOrNull(buffer) {
  try { return decoder.decode(buffer); } catch { return null; }
}
async function finish(record, status) {
  const streams = {};
  for (const channel of channels) streams[channel] = await describe(file(record, channel));
  record.streams = streams;
  records.set(record.id, record);
  const metadata = { ...status, result_id: record.id, streams };
  // Check serialized bytes too: JSON escaping can expand the response.
  if (streams.stdout.bytes + streams.stderr.bytes <= budget) {
    const stdout = textOrNull(fs.readFileSync(file(record, 'stdout')));
    const stderr = textOrNull(fs.readFileSync(file(record, 'stderr')));
    const inline = { ...metadata, stdout, stderr, delivery: 'inline' };
    if (stdout !== null && stderr !== null &&
        Buffer.byteLength(JSON.stringify(inline)) <= budget) return inline;
  }
  return { ...metadata, delivery: 'reference', directory: record.dir,
    instruction: 'Use read_result or search_result with result_id. Do not rerun the CLI to retrieve output.' };
}
function integer(value, name, min, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error('Invalid ' + name);
  return value;
}
async function readResult({ result_id, stream = 'stdout', offset = 0, max_bytes = pageBudget }) {
  const record = lookup(result_id);
  const filename = file(record, stream);
  const size = record.streams[stream].bytes;
  integer(offset, 'offset', 0, size);
  integer(max_bytes, 'max_bytes', 1, pageBudget);
  const length = Math.min(max_bytes, size - offset);
  const buffer = Buffer.alloc(length);
  const handle = await fs.promises.open(filename, 'r');
  let count = 0;
  try {
    while (count < length) {
      const { bytesRead } = await handle.read(buffer, count, length - count, offset + count);
      if (!bytesRead) throw new Error('Stored result changed or was truncated');
      count += bytesRead;
    }
  } finally { await handle.close(); }
  // Avoid splitting a valid UTF-8 code point at the end of an ordinary page.
  let data = buffer;
  let text = textOrNull(data);
  if (text === null && offset + count < size) {
    for (let trim = 1; trim <= 3 && trim < count; trim++) {
      const candidate = buffer.subarray(0, count - trim);
      const decoded = textOrNull(candidate);
      if (decoded !== null) { data = candidate; text = decoded; break; }
    }
  }
  const next_offset = offset + data.length;
  return { result_id, stream, offset, next_offset, eof: next_offset === size,
    encoding: text === null ? 'base64' : 'utf8', data: text === null ? data.toString('base64') : text };
}
async function searchResult({ result_id, stream = 'stdout', query, offset = 0 }) {
  const record = lookup(result_id);
  const filename = file(record, stream);
  const size = record.streams[stream].bytes;
  integer(offset, 'offset', 0, size);
  if (typeof query !== 'string' || !query.length || Buffer.byteLength(query) > pageBudget) {
    throw new Error('query must be a nonempty string within the configured page budget');
  }
  const needle = Buffer.from(query);
  if (offset === size) return { result_id, stream, found: false, eof: true };
  let tail = Buffer.alloc(0), position = offset;
  for await (const chunk of fs.createReadStream(filename, { start: offset })) {
    const data = Buffer.concat([tail, chunk]);
    const index = data.indexOf(needle);
    if (index !== -1) {
      const match_offset = position - tail.length + index;
      return { result_id, stream, found: true, match_offset,
        match_end: match_offset + needle.length, next_offset: match_offset + 1 };
    }
    position += chunk.length;
    tail = data.subarray(Math.max(0, data.length - (needle.length - 1)));
  }
  return { result_id, stream, found: false, eof: true };
}
module.exports = { begin, file, finish, readResult, searchResult, pageBudget };
