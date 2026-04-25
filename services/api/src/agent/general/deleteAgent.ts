import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";

dotenv.config();

const client = new Anthropic();

async function removeAgent(agentId: string) {
  try {
    console.log(`準備封存 Agent: ${agentId}...`);

    await client.beta.agents.archive(agentId);

    console.log("✅ Agent 已成功封存！");
  } catch (error) {
    console.error("❌ 刪除過程中發生錯誤：", error);
  }
}

// 帶入你當初 create 時取得的 agent.id
removeAgent("agent_011CaPob35BdHmEnTRuQcMUA");