"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DBAgentService = void 0;
const google_genai_1 = require("@langchain/google-genai");
const tools_1 = require("@langchain/core/tools");
const messages_1 = require("@langchain/core/messages");
const zod_1 = require("zod");
const env_1 = require("../../config/env");
const mysql_1 = require("../db/mysql");
class DBAgentService {
    constructor() {
        if (!env_1.env.geminiApiKey) {
            throw new Error("GEMINI_API_KEY is required for DBAgentService");
        }
        this.llm = new google_genai_1.ChatGoogleGenerativeAI({
            apiKey: env_1.env.geminiApiKey,
            model: "gemini-1.5-pro",
            temperature: 0,
        });
        const getSchemaTool = new tools_1.DynamicStructuredTool({
            name: "get_database_schema",
            description: "Returns the schema and tables in the MySQL database. Use this first to understand the DB structure.",
            schema: zod_1.z.object({}),
            func: async () => {
                try {
                    const [tables] = await mysql_1.dbPool.query("SHOW TABLES");
                    let schemaDetails = "";
                    for (const row of tables) {
                        const tableName = Object.values(row)[0];
                        const [columns] = await mysql_1.dbPool.query(`DESCRIBE ${tableName}`);
                        schemaDetails += `Table: ${tableName}\n`;
                        for (const col of columns) {
                            schemaDetails += `- ${col.Field} (${col.Type})\n`;
                        }
                        schemaDetails += "\n";
                    }
                    return schemaDetails || "No tables found.";
                }
                catch (e) {
                    return `Error getting schema: ${e.message}`;
                }
            },
        });
        const executeSqlTool = new tools_1.DynamicStructuredTool({
            name: "execute_sql_query",
            description: "Executes a raw SQL query (SELECT, INSERT, UPDATE, DELETE) and returns the JSON result.",
            schema: zod_1.z.object({
                query: zod_1.z.string().describe("The raw SQL query string to execute."),
            }),
            func: async (input) => {
                try {
                    const { query } = input;
                    const [result] = await mysql_1.dbPool.query(query);
                    return JSON.stringify(result, null, 2);
                }
                catch (e) {
                    return `Error executing query: ${e.message}`;
                }
            },
        });
        this.tools = [getSchemaTool, executeSqlTool];
    }
    async chatDb(userId, question) {
        try {
            const systemMessage = new messages_1.SystemMessage("Bạn là AI quản lý cơ sở dữ liệu cho hệ thống gia phả GEN-LINK. " +
                "Bạn có quyền truy cập vào MySQL database thông qua tools. " +
                "Hãy luôn dùng công cụ 'get_database_schema' trước để xem cấu trúc các bảng. " +
                "Sau đó hãy tạo câu truy vấn SQL phù hợp và gọi 'execute_sql_query' để lấy/chỉnh sửa dữ liệu. " +
                "Trả lời bằng tiếng Việt, giải thích kết quả dễ hiểu. Nếu thao tác thành công thì cũng phản hồi lại người dùng.");
            let messages = [
                systemMessage,
                new messages_1.HumanMessage(`User ID: ${userId}\nCâu hỏi: ${question}`)
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
                            messages.push(new messages_1.ToolMessage({
                                content: toolResult,
                                tool_call_id: toolCall.id,
                                name: toolCall.name
                            }));
                        }
                    }
                }
                else {
                    // No more tool calls, we are done
                    return response.content;
                }
            }
            return "Quá trình xử lý phức tạp vượt quá giới hạn, xin vui lòng thử lại câu hỏi hẹp hơn.";
        }
        catch (error) {
            console.error("[DBAgentService] Error", error);
            throw new Error("Failed to process DB chat request.");
        }
    }
}
exports.DBAgentService = DBAgentService;
