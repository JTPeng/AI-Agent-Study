# Mini Cursor — 基于 LangChain 的 AI 编程助手

## 项目概述

本项目是一个**迷你版 Cursor/Kiro**，使用 LangChain + OpenAI 兼容接口（通义千问）实现了一个具备文件读写、命令执行能力的 AI Agent。它能够根据自然语言指令，自主调用工具完成项目创建、代码编写、依赖安装等开发任务。

整体架构分为两层：

- `all-tools.mjs` — 工具层，定义了 Agent 可调用的 4 个工具
- `mini-cursor.mjs` — Agent 层，实现了 ReAct 循环（思考 → 调用工具 → 观察结果 → 继续思考）

---

## 文件一：`src/all-tools.mjs` — 工具定义层

### 作用

使用 LangChain 的 `tool()` 函数 + Zod schema 定义了 4 个可供 LLM 调用的结构化工具，并统一导出。

### 工具清单

| 工具名 | 功能 | 关键参数 |
|--------|------|----------|
| `read_file` | 读取文件内容 | `filePath` |
| `write_file` | 写入文件（自动创建目录） | `filePath`, `content` |
| `execute_command` | 执行系统命令（实时输出） | `command`, `workingDirectory?` |
| `list_directory` | 列出目录内容 | `directoryPath` |

### 关键代码片段

#### 工具定义模式

每个工具都遵循相同的定义模式 — `tool(执行函数, 元数据)`，其中元数据包含名称、描述和 Zod schema，LLM 通过这些信息决定何时调用、传什么参数：

```js
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const readFileTool = tool(
  async ({ filePath }) => {
    const content = await fs.readFile(filePath, "utf-8");
    return `文件内容:\n${content}`;
  },
  {
    name: "read_file",
    description: "读取指定路径的文件内容",
    schema: z.object({
      filePath: z.string().describe("文件路径"),
    }),
  },
);
```

#### 命令执行工具 — 最复杂的一个

使用 `child_process.spawn` 实现，支持指定工作目录，`stdio: "inherit"` 让子进程输出实时打印到终端：

```js
const child = spawn(cmd, args, {
  cwd,
  stdio: "inherit", // 实时输出到控制台
  shell: true,
});
```

执行成功后还会返回提示信息，引导 LLM 在后续调用中复用 `workingDirectory`，避免使用 `cd`：

```js
const cwdInfo = workingDirectory
  ? `\n\n重要提示：命令在目录 "${workingDirectory}" 中执行成功。如果需要在这个项目目录中继续执行命令，请使用 workingDirectory: "${workingDirectory}" 参数，不要使用 cd 命令。`
  : "";
```

---

## 文件二：`src/mini-cursor.mjs` — Agent 主循环

### 作用

实现了一个完整的 Tool-Calling Agent，核心流程为：

1. 构造系统提示词 + 用户指令
2. 发送给 LLM，LLM 返回工具调用请求
3. 本地执行工具，将结果回传给 LLM
4. 重复 2-3，直到 LLM 给出最终文本回复

### 关键代码片段

#### 模型初始化

通过 `ChatOpenAI` 连接通义千问（Qwen），使用 OpenAI 兼容接口：

```js
const model = new ChatOpenAI({
  modelName: "qwen-plus",
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});
```

#### 绑定工具

`bindTools` 将工具的 schema 信息注入到每次 LLM 请求中，让模型知道有哪些工具可用：

```js
const modelWithTools = model.bindTools(tools);
```

#### ReAct 循环 — Agent 的核心

这是整个项目最关键的部分。循环最多执行 30 轮，每轮：检查 LLM 是否请求工具调用 → 执行工具 → 将结果作为 `ToolMessage` 追加到对话历史 → 再次请求 LLM：

```js
async function runAgentWithTools(query, maxIterations = 30) {
  const messages = [
    new SystemMessage(`你是一个项目管理助手...`),
    new HumanMessage(query),
  ];

  for (let i = 0; i < maxIterations; i++) {
    const response = await modelWithTools.invoke(messages);
    messages.push(response);

    // 没有工具调用 → LLM 给出了最终回复，结束
    if (!response.tool_calls || response.tool_calls.length === 0) {
      return response.content;
    }

    // 有工具调用 → 逐个执行，结果回传
    for (const toolCall of response.tool_calls) {
      const foundTool = tools.find((t) => t.name === toolCall.name);
      if (foundTool) {
        const toolResult = await foundTool.invoke(toolCall.args);
        messages.push(
          new ToolMessage({
            content: toolResult,
            tool_call_id: toolCall.id,
          }),
        );
      }
    }
  }
}
```

#### System Prompt 设计

系统提示词中包含了对工具使用的约束规则，特别是防止 LLM 在 `execute_command` 中误用 `cd`：

```
重要规则 - execute_command：
- workingDirectory 参数会自动切换到指定目录
- 当使用 workingDirectory 时，绝对不要在 command 中使用 cd
- 错误示例: { command: "cd react-todo-app && pnpm install", workingDirectory: "react-todo-app" }
- 正确示例: { command: "pnpm install", workingDirectory: "react-todo-app" }
```

---

## 执行流程图

```
用户输入自然语言指令
        ↓
  构造 messages（SystemMessage + HumanMessage）
        ↓
  ┌─→ 发送给 LLM ──→ 返回 response
  │       ↓
  │   有 tool_calls？
  │     ├─ 否 → 输出最终回复，结束
  │     └─ 是 → 执行工具，生成 ToolMessage
  │               ↓
  └───── 追加到 messages，继续循环
```

## 总结

这个项目用约 150 行代码实现了一个能自主编程的 AI Agent 原型。它展示了 LangChain Tool Calling 的核心模式：用 Zod 定义工具 schema → 绑定到模型 → 在 ReAct 循环中交替执行 LLM 推理和工具调用。示例任务是让 Agent 从零创建一个 React TodoList 应用，包括脚手架搭建、代码编写、依赖安装和启动服务。
