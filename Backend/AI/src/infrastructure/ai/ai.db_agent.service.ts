import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { BaseMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { z } from "zod";
import { env } from "../../config/env";
import { dbPool } from "../db/mysql";

export class DBAgentService {
  private readonly llm: ChatGoogleGenerativeAI;
  private readonly tools: DynamicStructuredTool[];

  constructor() {
    if (!env.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is required for DBAgentService");
    }

    this.llm = new ChatGoogleGenerativeAI({
      apiKey: env.geminiApiKey,
      model: "gemini-2.5-flash-lite",
      temperature: 0,
    });

    const getSchemaTool = new DynamicStructuredTool({
      name: "get_database_schema",
      description: "Returns the schema and tables in the MySQL database. Use this first to understand the DB structure.",
      schema: z.object({}),
      func: async () => {
        try {
          const [tables] = await dbPool.query("SHOW TABLES");
          let schemaDetails = "";
          for (const row of tables as any[]) {
            const tableName = Object.values(row)[0] as string;
            const [columns] = await dbPool.query(`DESCRIBE ${tableName}`);
            schemaDetails += `Table: ${tableName}\n`;
            for (const col of columns as any[]) {
              schemaDetails += `- ${col.Field} (${col.Type})\n`;
            }
            schemaDetails += "\n";
          }
          return schemaDetails || "No tables found.";
        } catch (e: any) {
          return `Error getting schema: ${e.message}`;
        }
      },
    });

    const executeSqlTool = new DynamicStructuredTool({
      name: "execute_sql_query",
      description: "Executes a raw SQL query (SELECT, INSERT, UPDATE, DELETE) and returns the JSON result.",
      schema: z.object({
        query: z.string().describe("The raw SQL query string to execute."),
      }),
      func: async (input: any) => {
        try {
          const { query } = input;
          const [result] = await dbPool.query(query);
          return JSON.stringify(result, null, 2);
        } catch (e: any) {
          return `Error executing query: ${e.message}`;
        }
      },
    });

    this.tools = [getSchemaTool, executeSqlTool];
  }

  async chatDb(userId: string, question: string): Promise<string> {
    try {
      const systemMessage = new SystemMessage(
        "Bạn là AI quản lý cơ sở dữ liệu cho hệ thống gia phả GEN-LINK. " +
        "Bạn có quyền truy cập vào MySQL database thông qua tools. " +
        "Hãy luôn dùng công cụ 'get_database_schema' trước để xem cấu trúc các bảng. " +
        "Sau đó hãy tạo câu truy vấn SQL phù hợp và gọi 'execute_sql_query' để lấy/chỉnh sửa dữ liệu. " +
        "Trả lời bằng tiếng Việt, giải thích kết quả dễ hiểu. Nếu thao tác thành công thì cũng phản hồi lại người dùng."
      );

      let messages: BaseMessage[] = [
        systemMessage,
        new HumanMessage(`User ID: ${userId}\nCâu hỏi: ${question}`)
      ];

      const llmWithTools = this.llm.bindTools(this.tools);

      // Simple loop to handle tool calls (max 5 iterations to avoid infinite loops)
      for (let i = 0; i < 5; i++) {
        const response = await llmWithTools.invoke(messages);
        messages.push(response);

        if (response.tool_calls && response.tool_calls.length > 0) {
          for (const toolCall of response.tool_calls) {
            const tool = this.tools.find(t => t.name === toolCall.name);
            if (tool) {
              const toolResult = await tool.invoke(toolCall.args);
              messages.push(new ToolMessage({
                content: toolResult,
                tool_call_id: toolCall.id!,
                name: toolCall.name
              }));
            }
          }
        } else {
          // No more tool calls, we are done
          return response.content as string;
        }
      }

      return "Quá trình xử lý phức tạp vượt quá giới hạn, xin vui lòng thử lại câu hỏi hẹp hơn.";
    } catch (error: any) {
      console.error("[DBAgentService] Detailed Error:", error);
      throw new Error(`Failed to process DB chat request: ${error.message || error}`);
    }
  }
}
