const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

test('MCP exposes one tool and passes quoted arguments without shell execution', async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'douyin-world-mcp.cjs')], {
    env: { ...process.env, DOUYIN_WORLD_EXECUTABLE: process.execPath, DOUYIN_WORLD_SCRIPT: path.join(__dirname, 'douyin-world-mcp-fixture.cjs') },
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
  assert.equal(replies.find(x => x.id === 2).result.tools.length, 1);
  assert.equal(replies.find(x => x.id === 2).result.tools[0].name, 'douyin-world');
  const result = JSON.parse(replies.find(x => x.id === 3).result.content[0].text);
  assert.deepEqual(JSON.parse(result.stdout), ['guide', 'two words', '&', 'whoami']);
  assert.equal(result.exitCode, 0);
});
