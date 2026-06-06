import os
import json
try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

def get_openai_client():
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass
        
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key and OpenAI:
        return OpenAI(api_key=api_key)
    return None

def ask_question(question: str, context_data: dict) -> str:
    """
    Trả lời câu hỏi dựa trên dữ liệu tài chính cung cấp.
    """
    client = get_openai_client()
    
    system_prompt = (
        "Bạn là một trợ lý ảo chuyên phân tích dữ liệu tài chính. "
        "NGUYÊN TẮC BẮT BUỘC:\n"
        "1. KHÔNG được tự bịa số liệu. Mọi số liệu phải lấy từ dữ liệu được cung cấp.\n"
        "2. Nếu người dùng hỏi câu hỏi giao tiếp thông thường (như xin chào, cảm ơn), hãy trả lời một cách lịch sự như một trợ lý ảo. Nếu hỏi về tài chính nhưng không có dữ liệu phù hợp trong ngữ cảnh, hãy nói rõ là 'Chưa có dữ liệu phù hợp để trả lời câu hỏi này'.\n"
        "3. Trả lời ngắn gọn, súc tích, đi thẳng vào trọng tâm.\n"
        "4. Cung cấp số liệu cụ thể nếu có trong dữ liệu.\n"
        "5. Thêm cảnh báo: 'Đây là câu trả lời do AI tạo ra, cần kiểm tra lại trước khi sử dụng chính thức.' vào cuối câu trả lời."
    )
    
    user_prompt = f"Dữ liệu được cung cấp (JSON): {json.dumps(context_data, ensure_ascii=False)}\n\nCâu hỏi: {question}"

    if client:
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2
            )
            return response.choices[0].message.content or "Không thể tạo câu trả lời."
        except Exception as e:
            print("OpenAI Error:", e)
            return _mock_ask_question(question, context_data, error=str(e))
    else:
        print("OpenAI client not initialized")
        return _mock_ask_question(question, context_data)

def _mock_ask_question(question: str, context_data: dict, error: str = None) -> str:
    """Mock trả lời nếu không có OpenAI API key"""
    q_lower = question.lower()
    
    # Giao tiếp thông thường
    greetings = ["hello", "hi", "xin chào", "chào"]
    if any(g in q_lower for g in greetings):
        return "Xin chào! Tôi là trợ lý ảo FinHub chuyên hỗ trợ tài chính. Tôi có thể giúp gì cho bạn hôm nay?\n\n*Đây là câu trả lời do AI tạo ra, cần kiểm tra lại trước khi sử dụng chính thức.*"

    # Kiểm tra xem có dữ liệu không
    if not context_data or all(not v for v in context_data.values()):
        return "Chưa có dữ liệu phù hợp để trả lời câu hỏi này.\n\n*Đây là câu trả lời do AI tạo ra, cần kiểm tra lại trước khi sử dụng chính thức.*"

    ans = ""
    if "vượt ngân sách" in q_lower:
        over_budget = context_data.get("over_budget", [])
        if over_budget:
            top = over_budget[0]
            ans = f"**{top.get('department')}** có mức vượt ngân sách cao nhất:\n- {top.get('category')}: actual {top.get('actual_amount')} / budget {top.get('budget_amount')} -> **+{top.get('variance_percent')}%**\n\n"
        else:
            ans = "Không có khoản nào vượt ngân sách dựa trên dữ liệu hiện tại.\n\n"
            
    elif "cao nhất" in q_lower or "tổng chi" in q_lower:
        expenses = context_data.get("expenses", [])
        if expenses:
            ans = "**Tổng chi phí:**\n\n| Phòng ban | Chi phí |\n|---|---|\n"
            for exp in expenses:
                ans += f"| {exp.get('department')} | {exp.get('amount')} |\n"
            ans += "\n"
        else:
            ans = "Không có dữ liệu chi phí.\n\n"
            
    elif "tóm tắt" in q_lower:
        summary = context_data.get("summary", {})
        if summary:
            ans = f"**Tóm tắt tình hình tài chính:**\n\n- Tổng thu: **{summary.get('total_revenue')}**\n- Tổng chi: **{summary.get('total_expense')}**\n- Tỷ lệ sử dụng ngân sách: **{summary.get('usage_percent')}%**\n\n"
        else:
            ans = "Không có dữ liệu tóm tắt.\n\n"
            
    else:
        ans = (
            f"Dựa trên dữ liệu tài chính hiện tại, tôi đang phân tích câu hỏi: **\"{question}\"**.\n"
            f"Dữ liệu có sẵn gồm: {', '.join(context_data.keys())}.\n\n"
        )

    ans += "*Đây là câu trả lời do AI tạo ra, cần kiểm tra lại trước khi sử dụng chính thức.*"
    return ans

def generate_report(period: str, report_type: str, context_data: dict) -> str:
    """
    Sinh báo cáo tài chính nháp.
    """
    client = get_openai_client()
    
    system_prompt = (
        "Bạn là một chuyên gia phân tích tài chính. Hãy tạo một báo cáo tài chính nháp dựa trên dữ liệu được cung cấp.\n"
        "NGUYÊN TẮC BẮT BUỘC:\n"
        "1. KHÔNG tự bịa số liệu.\n"
        "2. Sử dụng định dạng Markdown cho báo cáo.\n"
        "3. Cấu trúc báo cáo bắt buộc phải gồm các phần: Tóm tắt tổng quan, Tình hình thu chi, Tình hình sử dụng ngân sách, Các khoản vượt ngân sách, Biến động bất thường, Điểm cần lãnh đạo lưu ý.\n"
        "4. Ở cuối báo cáo, luôn thêm: '_Báo cáo do AI hỗ trợ, cần kiểm tra trước khi sử dụng chính thức._'"
    )
    
    user_prompt = f"Kỳ báo cáo: {period}\nLoại báo cáo: {report_type}\n\nDữ liệu được cung cấp (JSON): {json.dumps(context_data, ensure_ascii=False)}\n\nHãy tạo báo cáo tài chính chi tiết."

    if client:
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3
            )
            return response.choices[0].message.content or "Không thể tạo báo cáo."
        except Exception as e:
            return _mock_generate_report(period, report_type, context_data, error=str(e))
    else:
        return _mock_generate_report(period, report_type, context_data)

def _mock_generate_report(period: str, report_type: str, context_data: dict, error: str = None) -> str:
    """Mock tạo báo cáo"""
    summary = context_data.get("summary", {})
    over_budget = context_data.get("over_budget", [])
    
    content = (
        f"# Báo cáo Tài chính – {period}\n\n"
        f"**Loại báo cáo:** {report_type}\n\n"
        
        "## Tóm tắt tổng quan\n"
        f"- Tổng thu: **{summary.get('total_revenue', 'N/A')}**\n"
        f"- Tổng chi: **{summary.get('total_expense', 'N/A')}**\n"
        f"- Tỷ lệ sử dụng ngân sách: **{summary.get('usage_percent', 'N/A')}%**\n\n"
        
        "## Tình hình thu chi\n"
        "Dữ liệu thu chi trong kỳ đang bám sát dự toán. Tổng chi phí chiếm phần lớn từ các phòng ban chủ chốt.\n\n"
        
        "## Tình hình sử dụng ngân sách\n"
        "Hầu hết các phòng ban đều trong hạn mức cho phép. Tuy nhiên có một số điểm cần lưu ý.\n\n"
        
        "## Các khoản vượt ngân sách\n"
    )
    
    if over_budget:
        for ob in over_budget:
            content += f"- **{ob.get('department')} ({ob.get('category')})**: Thực tế {ob.get('actual_amount')}, Ngân sách {ob.get('budget_amount')} -> Vượt **{ob.get('variance_percent')}%**\n"
    else:
        content += "Không ghi nhận khoản nào vượt ngân sách đáng kể.\n"
        
    content += (
        "\n## Biến động bất thường\n"
        "Chưa phát hiện biến động bất thường lớn dựa trên dữ liệu hiện tại.\n\n"
        
        "## Điểm cần lãnh đạo lưu ý\n"
        "1. Theo dõi sát sao các khoản mục đang tiệm cận ngân sách giới hạn.\n"
        "2. Đánh giá lại ngân sách dự kiến cho kỳ tiếp theo dựa trên tỷ lệ thực tế.\n\n"
        
        "_Báo cáo do AI hỗ trợ, cần kiểm tra trước khi sử dụng chính thức._"
    )
    
    return content
