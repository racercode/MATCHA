import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 初始化 Anthropic Client
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function init_seesion() {
  try {
    console.log("正在初始化...");

    // 1. 建立持久化 Session 並綁定 MCP 工具
    const client = new Anthropic();

    const agent = await client.beta.agents.create({
      name: "YouZhe Test Agent",
      model: "claude-sonnet-4-6",
      system: `你是一個專注於機器學習與電腦視覺研究的自動化助理。
                     請保持理性與邏輯，你的任務是確保實驗流程順暢，並精準記錄所有數據異常。`,
    //   tools: [
    //     // 這裡可以掛載你寫好的 MCP Server 工具
    //     { type: "mcp", name: "monitor_training_logs" },
    //     { type: "mcp", name: "alibaba_cloud_container_control" },
    //     { type: "mcp", name: "git_commit_results" }
    //   ]
    });

    const environment = await client.beta.environments.create({
        name: "test-env",
        config: {
          type: "cloud",
          networking: { type: "unrestricted" },
        },
      });

    console.log(`Environment ID: ${environment.id}`);

    const session = await client.beta.sessions.create({
        agent: agent.id,
        environment_id: environment.id,
        title: "test session",
      });

    console.log(`初始化完成`);

    return session.id;

  } catch (error) {
    console.error("Inititalization發生錯誤:", error);
    return null;
    }
}

async function runAgentStream(sessionId: string) {
  // 開啟 session 的事件 stream
  const stream = await client.beta.sessions.events.stream(sessionId);

  // Stream 啟動後發送 user.message 給 agent
  await client.beta.sessions.events.send(sessionId, {
    events: [
      {
        type: "user.message",
        content: [
          {
            type: "text",
            text: "hello",
          },
        ],
      },
    ],
  });

  // 處理 streaming event
  for await (const event of stream) {
    if (event.type === "agent.message") {
      for (const block of event.content) {
        process.stdout.write(block.text);
      }
    } else if (event.type === "agent.tool_use") {
      console.log(`\n[Using tool: ${event.name}]`);
    } else if (event.type === "session.status_idle") {
      console.log("\n\nAgent finished.");
      break;
    }
  }
}


async function main() {
    const sessionId = await init_seesion();
    if (sessionId) {
      await runAgentStream(sessionId);
    }
  }

main().catch(console.error);