const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { spawn, spawnSync } = require('node:child_process');

function parseCommand(input) {
  if (typeof input !== 'string') throw new Error('command 必须是字符串');
  const args = [];
  let value = '', quote = null, started = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === '\\' && input[i + 1] === quote) value += input[++i];
      else value += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      started = true;
    } else if (/\s/.test(c)) {
      if (started) { args.push(value); value = ''; started = false; }
    } else {
      value += c;
      started = true;
    }
  }
  if (quote) throw new Error('command 包含未闭合的引号');
  if (started) args.push(value);
  if (!args.length) throw new Error('command 不能为空');
  return args;
}

function resolveCli() {
  if (process.env.DOUYIN_WORLD_EXECUTABLE && process.env.DOUYIN_WORLD_SCRIPT) {
    return [process.env.DOUYIN_WORLD_EXECUTABLE, process.env.DOUYIN_WORLD_SCRIPT];
  }
  if (process.platform !== 'win32') return ['douyin-world', null];
  const found = spawnSync('where.exe', ['douyin-world'], { encoding: 'utf8', windowsHide: true });
  for (const filename of (found.stdout || '').split(/\r?\n/)) {
    if (!filename.toLowerCase().endsWith('.cmd')) continue;
    const text = fs.readFileSync(filename, 'utf8');
    const line = text.split(/\r?\n/).find(s => /douyin-world\.mjs"\s+%\*/i.test(s));
    const match = line && line.match(/^\s*"([^"]+)"\s+"([^"]+douyin-world\.mjs)"\s+%\*/i);
    if (match && path.isAbsolute(match[1]) && path.isAbsolute(match[2])) return [match[1], match[2]];
  }
  throw new Error('无法定位 douyin-world 的实际程序，请检查 CLI 安装');
}

function runCli(command) {
  const args = parseCommand(command);
  const [exe, script] = resolveCli();
  return new Promise((resolve, reject) => {
    const child = spawn(exe, script ? [script, ...args] : args, {
      env: script ? { ...process.env, ELECTRON_RUN_AS_NODE: '1' } : process.env,
      shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (exitCode, signal) => resolve({ stdout, stderr, exitCode, signal }));
  });
}

const tools = [{ name: 'douyin-world', description: '运行 douyin-world CLI 命令。修改、删除及付费操作应先获得用户确认。', inputSchema: { type: 'object', properties: { command: { type: 'string', description: 'CLI 参数，不包含 douyin-world；含空格的参数使用引号。' } }, required: ['command'], additionalProperties: false } }];
const send = message => process.stdout.write(JSON.stringify(message) + '\n');
async function handle(message) {
  if (!Object.hasOwn(message, 'id')) return;
  const { id, method, params = {} } = message;
  try {
    let result;
    if (method === 'initialize') result = { protocolVersion: params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'douyin-world-mcp', version: '1.0.0' } };
    else if (method === 'ping') result = {};
    else if (method === 'tools/list') result = { tools };
    else if (method === 'tools/call') {
      if (params.name !== 'douyin-world') throw new Error('未知工具');
      const output = await runCli(params.arguments?.command);
      result = { content: [{ type: 'text', text: JSON.stringify(output) }], isError: output.exitCode !== 0 };
    } else return send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
    send({ jsonrpc: '2.0', id, result });
  } catch (error) {
    if (method === 'tools/call') send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: error.message }], isError: true } });
    else send({ jsonrpc: '2.0', id, error: { code: -32603, message: error.message } });
  }
}
readline.createInterface({ input: process.stdin, crlfDelay: Infinity }).on('line', line => {
  try { handle(JSON.parse(line)); }
  catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
});
