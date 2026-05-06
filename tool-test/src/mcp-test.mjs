import "dotenv/config";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import chalk from "chalk";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  anthropicApiUrl: process.env.OPENAI_BASE_URL,
  //   configuration: {
  //     baseURL: process.env.OPENAI_BASE_URL,
  //   },
});

const mcpClient = new MultiServerMCPClient({
  mcpServers: {
    "my-mcp-server": {
      command: "node",
      args: [
        "/Users/timer/Document/Code/ai-code/ai-course/AI-Agent-Study/tool-test/src/my-mcp-server.mjs",
      ],
    },
    "chrome-devtools": {
        "command": "npx",
        "args": [
            "-y",
            "chrome-devtools-mcp@latest"
        ]
    },
    "amap-maps-streamableHTTP": {
      url: "https://mcp.amap.com/mcp?key=" + process.env.AMAP_MAPS_API_KEY,
    },
  },
});

const tools = await mcpClient.getTools();
const modelWithTools = model.bindTools(tools);

function contentToText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (block?.type === "text") return block.text ?? "";
        return "";
      })
      .join("");
  }
  return String(content ?? "");
}

async function runAgentWithTools(query, maxIterations = 30) {
  const messages = [new HumanMessage(query)];

  for (let i = 0; i < maxIterations; i++) {
    console.log(chalk.bgGreen(`⏳ 正在等待 AI 思考...`));
    const response = await modelWithTools.invoke(messages);
    messages.push(response); // 检查是否有工具调用

    if (!response.tool_calls || response.tool_calls.length === 0) {
      const text = contentToText(response.content);
      console.log(`\n✨ AI 最终回复:\n${text}\n`);
      return text;
    }

    console.log(
      chalk.bgBlue(`🔍 检测到 ${response.tool_calls.length} 个工具调用`),
    );
    console.log(
      chalk.bgBlue(
        `🔍 工具调用: ${response.tool_calls.map((t) => t.name).join(", ")}`,
      ),
    ); // 执行工具调用
    for (const toolCall of response.tool_calls) {
      const foundTool = tools.find((t) => t.name === toolCall.name);
      if (foundTool) {
        const cleanArgs = Object.fromEntries(
          Object.entries(toolCall.args ?? {}).filter(
            ([, v]) => v !== undefined,
          ),
        );
        console.log(
          chalk.gray(`   ↳ ${toolCall.name}(${JSON.stringify(cleanArgs)})`),
        );
        let toolResult;
        try {
          toolResult = await foundTool.invoke(cleanArgs);
        } catch (err) {
          console.log(chalk.bgRed(`   ⚠️ 工具 ${toolCall.name} 调用失败: ${err.message}`));
          toolResult = `Error: ${err.message}`;
        }
        messages.push(
          new ToolMessage({
            content: toolResult,
            tool_call_id: toolCall.id,
          }),
        );
      }
    }
  }

  return contentToText(messages[messages.length - 1].content);
}

// await runAgentWithTools("深圳北站附近的酒店，以及去的路线");
await runAgentWithTools("深圳北站附近的酒店，最近的 3 个酒店，拿到酒店图片，打开浏览器，展示每个酒店的图片，每个 tab 一个 url 展示，并且在把那个页面标题改为酒店名");

await mcpClient.close();
