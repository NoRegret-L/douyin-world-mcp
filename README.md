# douyin-world MCP

将本机 `douyin-world` CLI 接入 MCP。大结果完整保存到磁盘，按需读取，减少上下文占用。

## Agent Prompt（推荐）

直接发送给 Agent：

```text
Set up douyin-world MCP from https://github.com/NoRegret-L/douyin-world-mcp. Read the complete README and follow its setup instructions. Preserve existing settings and verify the MCP connection.
```

## 安装

要求：Node.js ≥ 18，且已安装并配置 `douyin-world` CLI。

```bash
node --version
douyin-world --help
git clone https://github.com/NoRegret-L/douyin-world-mcp.git
cd douyin-world-mcp
```

无需 `npm install`。已有仓库执行 `git pull --ff-only` 更新。

## 手动配置

以下路径均需替换为本机实际绝对路径。保留已有 MCP 配置；若找不到 Node.js 或 CLI，请检查 PATH。

### Codex

```bash
codex mcp add douyin-world -- node "C:/path/douyin-world-mcp/douyin-world-mcp.cjs"
codex mcp list
```

或在 `~/.codex/config.toml` 中添加：

```toml
[mcp_servers.douyin-world]
command = "node"
args = ["C:/path/douyin-world-mcp/douyin-world-mcp.cjs"]
```

[官方文档](https://developers.openai.com/codex/mcp)

### Claude Code

```bash
claude mcp add --transport stdio --scope user douyin-world -- node "C:/path/douyin-world-mcp/douyin-world-mcp.cjs"
claude mcp list
```

[官方文档](https://code.claude.com/docs/en/mcp)

### Claude Desktop

打开 Settings → Developer → Edit Config，将以下配置合并到 `claude_desktop_config.json`。Claude Code 项目级配置（`.mcp.json`）也可使用此格式，但不要提交本机绝对路径或凭据。

```json
{
  "mcpServers": {
    "douyin-world": {
      "command": "node",
      "args": ["C:/path/douyin-world-mcp/douyin-world-mcp.cjs"]
    }
  }
}
```

### Zed

在 `settings.json` 中合并：

```json
{
  "context_servers": {
    "douyin-world": {
      "command": "node",
      "args": ["C:/path/douyin-world-mcp/douyin-world-mcp.cjs"]
    }
  }
}
```

配置完成后重启客户端，检查以下三个工具是否可用。本服务仅支持本地 stdio。

## MCP 工具

| 工具 | 参数 | 用途 |
| --- | --- | --- |
| `douyin-world` | command | 执行 CLI |
| `read_result` | result_id, stream, offset, max_bytes | 分页读取结果 |
| `search_result` | result_id, stream, query, offset | 搜索结果中的字面字符串 |

示例：`{"command":"guide workflow"}`。无需在 command 中重复 CLI 名称；含空格的参数使用引号。

大结果返回 `result_id`，优先搜索，再读取所需内容，不必重复执行命令。stream 默认为 stdout，也支持 stderr；offset 默认为 0，按字节计算。读取时使用 next_offset 翻页，eof 表示结束；base64 表示无法直接解码为 UTF-8，跨页 JSON 需自行拼接。

## 输出设置与安全

- `DOUYIN_WORLD_RESULT_BYTES`：默认 8192，范围 0–1048576。通过客户端环境变量设置；0 表示仅返回引用，分页预算仍为 8192。单位为字节，不是 Token，也不是完整响应大小上限。
- 原始 stdout/stderr 不截断，保存在系统临时目录 `douyin-world-mcp-*`，附字节数和写入时的 SHA-256 摘要。结果 ID 仅在当前进程有效；文件不会自动清理，也没有磁盘配额。
- CLI 使用当前服务用户权限运行，不经 shell，但仍可能修改、删除数据或产生费用。操作前需确认，服务本身不强制确认。仅连接可信客户端，妥善清理敏感输出。

## 测试

```bash
npm test
```

测试位于 `tests/`，使用模拟 CLI，不操作真实项目。Windows CLI 1.0.105 曾验证过 `--help`；Windows 定位依赖 CLI 的 .cmd 启动器格式，其他版本、平台及真实客户端兼容性需自行验证。

## 许可

尚未指定许可证，不授予额外开源使用许可。
