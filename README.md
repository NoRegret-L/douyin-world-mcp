# douyin-world MCP

通过 MCP 的 stdio 连接暴露一个 `douyin-world` 工具，使用 `command` 字符串调用本机已安装的 `douyin-world` CLI。

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
