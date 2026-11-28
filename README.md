# douyin-world MCP

通过 stdio 将本机已安装的 `douyin-world` CLI 接入 MCP 客户端。执行、完整结果存储、按需读取相互分离，避免大型 CLI 输出直接进入模型上下文。

## 安装与更新

需要 Node.js 18 或更高版本，以及已经安装并配置的 douyin-world CLI。本项目无第三方运行依赖，不负责安装 CLI。Windows 的 CLI 定位依赖其生成的 .cmd 启动器格式；早期在 Windows CLI 1.0.105 上验证过 --help，其他环境需自行验证。

```powershell
git clone https://github.com/NoRegret-L/douyin-world-mcp.git
cd douyin-world-mcp
```

已有仓库使用 `git pull --ff-only` 更新，不需要 npm install。

## Agent Prompt（推荐）

将以下提示词直接发送给 Agent：

```text
Set up douyin-world MCP from https://github.com/NoRegret-L/douyin-world-mcp. Read the complete README and follow its setup instructions. Preserve existing settings and verify the MCP connection.
```

## 客户端配置

以下示例使用 Windows 路径，请替换为实际绝对路径；macOS/Linux 使用对应的绝对路径。若客户端无法找到 node 或 CLI，请检查其 PATH，必要时填写 node 的绝对路径。先运行 `node --version` 和 `douyin-world --help` 确认本机环境。

## Codex

在 `~/.codex/config.toml`（Windows：`%USERPROFILE%/.codex/config.toml`）中合并：

```toml
[mcp_servers.douyin-world]
command = "node"
args = ["C:/path/douyin-world-mcp/douyin-world-mcp.cjs"]

[mcp_servers.douyin-world.env]
DOUYIN_WORLD_RESULT_BYTES = "8192"
```

也可以通过 CLI 注册（与手动配置二选一）：

```bash
codex mcp add douyin-world -- node "C:/path/douyin-world-mcp/douyin-world-mcp.cjs"
codex mcp list
```

重启 Codex，通过 `/mcp` 检查连接。[官方文档](https://developers.openai.com/codex/mcp)。

## Claude Code

```bash
claude mcp add --transport stdio --scope user douyin-world -- node "C:/path/douyin-world-mcp/douyin-world-mcp.cjs"
claude mcp list
```

使用默认传输预算 8192 字节。重新启动 Claude Code，通过 `/mcp` 检查状态。项目级共享配置可使用项目根目录的 `.mcp.json`，格式如下节所示；不要提交本机绝对路径或凭据。[官方文档](https://code.claude.com/docs/en/mcp)。

## Claude Desktop

打开 Settings → Developer → Edit Config，将以下内容合并到 `claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "douyin-world": {
      "command": "node",
      "args": ["C:/path/douyin-world-mcp/douyin-world-mcp.cjs"],
      "env": {
        "DOUYIN_WORLD_RESULT_BYTES": "8192"
      }
    }
  }
}
```

完全退出并重启应用。以上均为本地 stdio 配置，不适用于仅支持远程 HTTP 的客户端。

## Zed 配置

在 settings.json 的 context_servers 中合并以下配置，保留其他服务：

```json
{
  "context_servers": {
    "douyin-world": {
      "command": "node",
      "args": ["C:/path/douyin-world-mcp/douyin-world-mcp.cjs"],
      "env": {
        "DOUYIN_WORLD_RESULT_BYTES": "8192"
      }
    }
  }
}
```

替换为实际绝对路径。其他 MCP 客户端可能使用 mcpServers 作为外层字段，内部配置相同。Windows 路径可使用正斜杠；若使用反斜杠需遵循 JSON 转义。找不到 node 时填写其绝对路径。重启客户端后应显示以下三个工具。

## 工具契约

| 工具 | 参数 | 用途 |
| --- | --- | --- |
| douyin-world | command | 执行 CLI，返回退出状态和结果引用；小结果可内联 |
| read_result | result_id, stream, offset, max_bytes | 按字节范围读取 |
| search_result | result_id, stream, query, offset | 查找下一个字面字符串匹配 |

执行示例：`{"command":"guide workflow"}`。command 不包含 CLI 可执行文件名；有空格的参数使用引号。已知搜索目标时优先 search_result，再用 read_result 读取附近内容。仅在确实需要时连续读取多页，不要为了读取已有结果重新执行 CLI。

读取示例：`{"result_id":"返回的 ID","stream":"stdout","offset":0,"max_bytes":4096}`。

stream 默认为 stdout，也支持 stderr；offset 默认为 0，是字节偏移而非字符或对象索引。读取返回 next_offset、eof 和 encoding；base64 表示无法直接以 UTF-8 解码的字节。分页不是 JSON 对象分页，跨页 JSON 需要自行重组。搜索返回匹配字节位置而非完整数据。

## 输出管理

stdout 和 stderr 直接写入系统临时目录，记录各自的字节数和 SHA-256 摘要。退出码、信号和 result_id 随结果返回。小型 UTF-8 结果在序列化后的大小满足内联预算时直接返回；其他结果返回引用和目录。原始输出不截断。

DOUYIN_WORLD_RESULT_BYTES 默认 8192，允许 0 到 1048576 的整数。它同时控制内联预算和单页原始字节预算；0 表示只返回引用，页预算仍为 8192。此配置是可调整的传输预算，不是 Token 阈值；JSON 转义、base64 和元数据可能增加传输大小。服务无法获取客户端实时剩余上下文，多次读取仍可能积累大量 Token。

结果 ID 仅在当前 MCP 进程内有效，完整文件位于系统临时目录 douyin-world-mcp-* 下，重启后可手动访问。文件不会自动删除，请自行管理敏感数据、磁盘空间和清理周期。SHA-256 是写入完成时的摘要，并非每次读取都重新验证。服务没有磁盘配额保证。

## 安全

CLI 以 MCP 服务用户的权限运行，可能修改或删除数据或调用付费服务。执行前核实命令并获得必要确认；服务不强制执行用户确认。命令不通过 shell 执行，但 CLI 自身权限与行为仍然存在。仅连接可信客户端，不要将 stdio 服务直接暴露到网络。

## 项目结构

```text
douyin-world-mcp/
├── douyin-world-mcp.cjs
├── result-store.cjs
├── package.json
├── README.md
└── tests/
    ├── douyin-world-mcp.test.cjs
    └── fixtures/
        └── douyin-world-mcp-fixture.cjs
```

根目录仅保留运行入口及支持文件；测试和模拟 CLI 独立存放，不参与正式运行。

## 测试

```powershell
npm test
```

测试使用 Node.js 内置测试框架及模拟 CLI，覆盖工具契约、参数解析、原始结果保留、字节分页和关键词检索，不修改真实游戏项目。真实 CLI 和客户端兼容性需要另行验证。

## 许可

许可证尚未确定；在仓库所有者明确选择许可证前，不授予额外的开源使用许可。douyin-world CLI 和相关商标的权利属于各自权利人。
