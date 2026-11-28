const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

test('MCP exposes one tool and passes quoted arguments without shell execution', async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'douyin-world-mcp.cjs')], {
    env: { ...process.env, DOUYIN_WORLD_RESULT_BYTES: '8192', DOUYIN_WORLD_EXECUTABLE: process.execPath, DOUYIN_WORLD_SCRIPT: path.join(__dirname, 'douyin-world-mcp-fixture.cjs') },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  const replies = [];
  let buffer = '';
  server.stdout.setEncoding('utf8');
  server.stdout.on('data', chunk => {
    buffer += chunk;
    let end;
    while ((end = buffer.indexOf('\n')) !== -1) {
      replies.push(JSON.parse(buffer.slice(0, end)));
      buffer = buffer.slice(end + 1);
    }
  });
  const send = message => server.stdin.write(JSON.stringify(message) + '\n');
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'douyin-world', arguments: { command: 'guide "two words" & whoami' } } });
  server.stdin.end();
  const exit = await new Promise(resolve => server.on('close', resolve));
  assert.equal(exit, 0);
  assert.equal(replies.find(x => x.id === 2).result.tools.length, 3);
  assert.equal(replies.find(x => x.id === 2).result.tools[0].name, 'douyin-world');
  const result = JSON.parse(replies.find(x => x.id === 3).result.content[0].text);
  assert.deepEqual(JSON.parse(result.stdout), ['guide', 'two words', '&', 'whoami']);
  assert.equal(result.exitCode, 0);
});

test('large output is retained losslessly and read/search are bounded', async () => {
  const fs = require('node:fs');
  const { createHash } = require('node:crypto');
  const server = spawn(process.execPath, [path.join(__dirname, 'douyin-world-mcp.cjs')], {
    env: { ...process.env, DOUYIN_WORLD_RESULT_BYTES: '128', DOUYIN_WORLD_EXECUTABLE: process.execPath,
      DOUYIN_WORLD_SCRIPT: path.join(__dirname, 'douyin-world-mcp-fixture.cjs') },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  const lines = require('node:readline').createInterface({ input: server.stdout });
  const pending = new Map();
  let id = 0;
  lines.on('line', line => {
    const reply = JSON.parse(line);
    pending.get(reply.id)?.(reply.result);
    pending.delete(reply.id);
  });
  function call(name, args) {
    return new Promise(resolve => {
      const current = ++id;
      pending.set(current, resolve);
      server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: current, method: 'tools/call', params: { name, arguments: args } }) + '\n');
    });
  }
  const read = result => JSON.parse(result.content[0].text);
  let directory;
  try {
    const output = read(await call('douyin-world', { command: 'large-fixture' }));
    directory = output.directory;
    assert.equal(output.delivery, 'reference');
    assert.equal(output.stdout, undefined);
    const expected = Buffer.from('汉字'.repeat(12000) + 'NEEDLE' + '尾');
    assert.equal(output.streams.stdout.bytes, expected.length);
    assert.equal(output.streams.stdout.sha256, createHash('sha256').update(expected).digest('hex'));
    assert.deepEqual(fs.readFileSync(path.join(directory, 'stdout')), expected);
    const match = read(await call('search_result', { result_id: output.result_id, query: 'NEEDLE' }));
    assert.equal(match.match_offset, Buffer.byteLength('汉字'.repeat(12000)));
    const page = read(await call('read_result', { result_id: output.result_id, max_bytes: 128 }));
    assert.equal(page.encoding, 'utf8');
    assert.ok(page.next_offset <= 128 && page.next_offset > 0);
    assert.deepEqual(Buffer.from(page.data), expected.subarray(0, page.next_offset));
    const last = read(await call('read_result', { result_id: output.result_id, offset: match.match_offset }));
    assert.equal(last.data, 'NEEDLE尾');
    assert.equal(last.eof, true);
    assert.equal((await call('read_result', { result_id: output.result_id, max_bytes: 129 })).isError, true);
    assert.equal((await call('read_result', { result_id: '../secret' })).isError, true);
    const stderr = read(await call('read_result', { result_id: output.result_id, stream: 'stderr' }));
    assert.equal(stderr.data, 'diagnostic');
  } finally {
    server.stdin.end();
    await new Promise(resolve => server.on('close', resolve));
    if (directory) fs.rmSync(path.dirname(directory), { recursive: true, force: true });
  }
});
