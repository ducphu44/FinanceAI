import os
import json
from sqlalchemy.orm import Session

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

# ── AI Agent Tools (SQL Query Helpers) ───────────────────────────────────────

def get_top_over_budget_transactions(db: Session, limit: int = 10):
    """Lấy danh sách các giao dịch vượt ngân sách (variance_percent > 0)."""
    from app.models import FinancialTransaction
    over_budget_txns = db.query(FinancialTransaction).filter(
        FinancialTransaction.variance_percent > 0
    ).order_by(FinancialTransaction.variance_percent.desc()).limit(limit).all()
    return [
        {
            "department": txn.department,
            "category": txn.category,
            "actual_amount": txn.actual_amount,
            "budget_amount": txn.budget_amount,
            "variance_percent": txn.variance_percent
        } for txn in over_budget_txns
    ]

def get_expense_summary_by_department(db: Session):
    """Lấy chi tiết chi phí theo phòng ban và danh mục."""
    from app.models import FinancialTransaction, TransactionType
    from sqlalchemy import func
    expenses_detailed = db.query(
        FinancialTransaction.department,
        FinancialTransaction.category,
        func.sum(FinancialTransaction.actual_amount).label("total_amount")
    ).filter(
        FinancialTransaction.transaction_type == TransactionType.expense
    ).group_by(FinancialTransaction.department, FinancialTransaction.category).all()
    return [
        {"department": e.department, "category": e.category, "amount": e.total_amount} for e in expenses_detailed
    ]

def get_revenue_summary_by_department(db: Session):
    """Lấy chi tiết doanh thu theo phòng ban và danh mục."""
    from app.models import FinancialTransaction, TransactionType
    from sqlalchemy import func
    revenues_detailed = db.query(
        FinancialTransaction.department,
        FinancialTransaction.category,
        func.sum(FinancialTransaction.actual_amount).label("total_amount")
    ).filter(
        FinancialTransaction.transaction_type == TransactionType.revenue
    ).group_by(FinancialTransaction.department, FinancialTransaction.category).all()
    return [
        {"department": e.department, "category": e.category, "amount": e.total_amount} for e in revenues_detailed
    ]

def get_overall_financial_kpis(db: Session):
    """Lấy các chỉ số tài chính tổng hợp KPI."""
    from app.models import FinancialTransaction, TransactionType
    from sqlalchemy import func
    total_expense = db.query(func.sum(FinancialTransaction.actual_amount)).filter(FinancialTransaction.transaction_type == TransactionType.expense).scalar() or 0
    total_revenue = db.query(func.sum(FinancialTransaction.actual_amount)).filter(FinancialTransaction.transaction_type == TransactionType.revenue).scalar() or 0
    total_budget = db.query(func.sum(FinancialTransaction.budget_amount)).filter(FinancialTransaction.transaction_type == TransactionType.expense).scalar() or 1
    return {
        "total_revenue": total_revenue,
        "total_expense": total_expense,
        "total_budget": total_budget,
        "usage_percent": round((total_expense / total_budget) * 100, 2) if total_budget > 0 else 0
    }

# ─────────────────────────────────────────────────────────────────────────────

def ask_question(question: str, db: Session) -> str:
    """
    AI Agent chỉ huy tiếp nhận câu hỏi, tự động gọi các tool SQL thích hợp để truy vấn dữ liệu,
    sau đó tổng hợp câu trả lời tài chính chính xác cho người dùng.
    """
    client = get_openai_client()
    
    system_prompt = (
        "Bạn là một trợ lý ảo chuyên phân tích dữ liệu tài chính (AI Agent). "
        "Khi người dùng đặt câu hỏi, bạn có quyền truy cập vào các công cụ truy vấn SQL để lấy dữ liệu chính xác.\n"
        "NGUYÊN TẮC BẮT BUỘC:\n"
        "1. KHÔNG được tự bịa số liệu. Mọi số liệu phải lấy từ các công cụ (tools) cung cấp.\n"
        "2. Nếu người dùng hỏi câu hỏi giao tiếp thông thường (như xin chào, cảm ơn), bạn không cần sử dụng bất kỳ công cụ nào và hãy trả lời một cách lịch sự.\n"
        "3. Nếu thông tin lấy ra từ công cụ không đủ để trả lời câu hỏi, hãy nói rõ là 'Chưa có dữ liệu phù hợp để trả lời câu hỏi này'.\n"
        "4. Trả lời ngắn gọn, súc tích, đi thẳng vào trọng tâm.\n"
        "5. Cung cấp số liệu cụ thể khi lấy được từ công cụ.\n"
        "6. Thêm cảnh báo: 'Đây là câu trả lời do AI tạo ra, cần kiểm tra lại trước khi sử dụng chính thức.' vào cuối câu trả lời."
    )

    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_top_over_budget_transactions",
                "description": "Lấy danh sách các giao dịch chi tiêu vượt ngân sách (variance_percent > 0) sắp xếp từ mức vượt cao nhất xuống thấp.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "limit": {
                            "type": "integer",
                            "description": "Số lượng bản ghi tối đa muốn lấy (mặc định là 10).",
                            "default": 10
                        }
                    }
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_expense_summary_by_department",
                "description": "Lấy tổng hợp chi tiết tất cả các khoản chi phí thực tế phân chia theo phòng ban và hạng mục.",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_revenue_summary_by_department",
                "description": "Lấy tổng hợp chi tiết tất cả các khoản doanh thu phân chia theo phòng ban và hạng mục.",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_overall_financial_kpis",
                "description": "Lấy các chỉ số tài chính tổng quan bao gồm tổng thu, tổng chi, ngân sách và tỷ lệ sử dụng ngân sách.",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }
        }
    ]

    if client:
        try:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question}
            ]
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                tools=tools,
                tool_choice="auto",
                temperature=0.2
            )
            
            response_message = response.choices[0].message
            tool_calls = response_message.tool_calls
            
            if tool_calls:
                messages.append(response_message)
                
                for tool_call in tool_calls:
                    function_name = tool_call.function.name
                    function_args = json.loads(tool_call.function.arguments or "{}")
                    
                    if function_name == "get_top_over_budget_transactions":
                        limit = function_args.get("limit", 10)
                        tool_result = get_top_over_budget_transactions(db, limit)
                    elif function_name == "get_expense_summary_by_department":
                        tool_result = get_expense_summary_by_department(db)
                    elif function_name == "get_revenue_summary_by_department":
                        tool_result = get_revenue_summary_by_department(db)
                    elif function_name == "get_overall_financial_kpis":
                        tool_result = get_overall_financial_kpis(db)
                    else:
                        tool_result = {"error": f"Tool {function_name} not found"}
                        
                    messages.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": function_name,
                        "content": json.dumps(tool_result, ensure_ascii=False)
                    })
                    
                second_response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    temperature=0.2
                )
                return second_response.choices[0].message.content or "Không thể tạo câu trả lời."
            
            return response_message.content or "Không thể tạo câu trả lời."
        except Exception as e:
            print("OpenAI Error:", e)
            return _mock_ask_question(question, db, error=str(e))
    else:
        print("OpenAI client not initialized")
        return _mock_ask_question(question, db)

def _mock_ask_question(question: str, db: Session, error: str = None) -> str:
    """Mock trả lời nếu không có OpenAI API key"""
    q_lower = question.lower()
    
    # Giao tiếp thông thường
    greetings = ["hello", "hi", "xin chào", "chào"]
    if any(g in q_lower for g in greetings):
        return "Xin chào! Tôi là trợ lý ảo FinHub chuyên hỗ trợ tài chính. Tôi có thể giúp gì cho bạn hôm nay?\n\n*Đây là câu trả lời do AI tạo ra, cần kiểm tra lại trước khi sử dụng chính thức.*"

    # Gọi trực tiếp các SQL helpers để dựng context giả lập
    context_data = {
        "over_budget": get_top_over_budget_transactions(db),
        "expenses": get_expense_summary_by_department(db),
        "summary": get_overall_financial_kpis(db)
    }

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

