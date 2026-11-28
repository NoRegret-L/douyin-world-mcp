# douyin-world MCP

通过 MCP 的 stdio 连接暴露 `douyin-world` CLI 工具及按需结果读取工具，使用 `command` 字符串调用本机已安装的 `douyin-world` CLI。

## 环境要求

- Node.js 18 或更高版本。
- 已安装并配置 `douyin-world` CLI，且运行服务的用户可以访问该命令及编辑器。
- 已在 Windows 上使用 `douyin-world` 1.0.105 验证 `--help`；其他系统及 CLI 版本尚未验证。Windows 适配依赖 CLI 生成的 `.cmd` 启动器格式。

本项目不包含或安装 `douyin-world` CLI。

## 配置

将仓库下载到本机，在支持 stdio 的 MCP 客户端配置中添加服务。以下是常见的 `mcpServers` 格式：

```json
{
  "mcpServers": {
    "douyin-world": {
      "command": "node",
      "args": ["C:/路径/douyin-world-mcp/douyin-world-mcp.cjs"]
    }
  }
}
```

将 `args` 中的路径替换为本机 `douyin-world-mcp.cjs` 的**绝对路径**。Windows 路径在 JSON 中的反斜杠必须写成 `\\`；也可以使用正斜杠。若客户端找不到 Node.js，将 `command` 替换为 Node.js 可执行文件的绝对路径。不同客户端的配置文件位置和外层字段可能不同，已有服务应保留。

保存配置后重启客户端，确认工具列表中出现 `douyin-world`。调用工具时传入例如：

```json
{ "command": "guide workflow" }
```

参数含空格时使用引号，例如 `guide "two words"`。不要在工具的 `command` 参数前重复输入 `douyin-world`。

## 大结果与上下文管理（1.1）

CLI 的 stdout/stderr 直接写入本地临时目录，不在 MCP 中无限累积字符串。每个结果提供 result_id、独立字节数、SHA-256、退出码与信号。小型 UTF-8 结果保留原 stdout/stderr 字段；超过预算的结果返回引用，不截断原始文件，也不重新执行命令。

- DOUYIN_WORLD_RESULT_BYTES：可配置的内联与单页原始字节预算，默认 8192；设为 0 时执行结果仅返回引用，读取页预算为 8192。允许范围 0 到 1048576。该预算是传输策略，不是模型 Token 阈值，也不代表剩余上下文。JSON 转义和 base64 可增加单页传输体积。
- read_result：传入 result_id、stream（stdout 或 stderr）、offset（字节偏移）、max_bytes（不超过页预算）。使用 next_offset 继续，直到 eof。非 UTF-8 数据以 base64 返回，避免字节丢失。
- search_result：传入 result_id、stream、query（字面字符串）及 offset，返回下一个匹配的字节位置；按需读取匹配附近的数据。

示例：先执行 CLI，获取 result_id，再调用 read_result，参数为 {"result_id":"返回的 ID","stream":"stdout","offset":0,"max_bytes":4096}。不要为了读取同一结果再次执行 CLI。

完整输出存于系统临时目录 douyin-world-mcp-* 下；大型结果会返回 directory。ID 仅在当前 MCP 进程有效，重启后可通过原目录手动访问文件。文件不会自动删除，以免损失证据；请在不需要时手动清理目录。输出可能含敏感数据，注意磁盘容量、系统临时目录访问权限及备份策略。文件保存不是磁盘配额或客户端总上下文保证。

## 安全说明

该工具以运行服务的用户权限执行 CLI，能够修改或删除数据，也可能调用付费服务。服务本身**不强制确认**这些操作；请仅连接可信任的 MCP 客户端，并在执行前核实命令。输出可能包含敏感数据。

服务直接启动程序，不将 `command` 作为 shell 命令执行。它不提供认证或远程访问防护，不应直接暴露到网络。

## 测试

在仓库目录执行：

```sh
node --test douyin-world-mcp.test.cjs
```

测试使用 Node.js 内置测试框架和模拟 CLI，不会修改游戏项目。真实 CLI 的可用性需要另行验证。

## 许可

许可证尚未确定；在仓库所有者明确选择许可证前，不授予额外的开源使用许可。`douyin-world` CLI 和相关商标的权利属于其各自权利人。
