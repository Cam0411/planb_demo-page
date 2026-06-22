import { GoogleGenerativeAI } from "@google/generative-ai";
import { Comment } from "../types";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

export const geminiService = {
  summarizeFeedback: async (comments: Comment[]): Promise<string> => {
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      return "Vui lòng cấu hình VITE_GEMINI_API_KEY để sử dụng tính năng này.";
    }

    if (comments.length === 0) {
      return "Chưa có feedback nào để tóm tắt.";
    }

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const feedbackText = comments.map(c => 
        `- [${c.priority || 'Normal'}] [${c.category || 'Edit'}] ${c.frameTime !== undefined ? `Frame ${c.frameTime}s: ` : ''}${c.content}`
      ).join('\n');

      const prompt = `Bạn là một chuyên gia Review Video. Dưới đây là danh sách feedback từ khách hàng cho một video:
      \n${feedbackText}\n
      Hãy tóm tắt các feedback này cho Editor. 
      Yêu cầu:
      1. Phân nhóm theo mức độ ưu tiên (Gấp, Cần xem xét, Gợi ý).
      2. Tóm tắt ngắn gọn các điểm chính về Edit, Audio, Color.
      3. Giọng văn chuyên nghiệp, súc tích.
      4. Sử dụng tiếng Việt.
      5. Kết quả trả về dưới dạng Markdown.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Có lỗi xảy ra khi tóm tắt feedback bằng AI. Vui lòng thử lại sau.";
    }
  }
};
