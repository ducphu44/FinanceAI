import sys
import os

# Thêm thư mục gốc vào PYTHONPATH để có thể import app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.services.ai_service import ask_question

def test_agent():
    print("🚀 Đang khởi động kịch bản kiểm thử AI Agent...")
    db = SessionLocal()
    try:
        # Danh sách các câu hỏi test cho từng mục đích (intent) khác nhau
        test_cases = [
            {
                "category": "GENERAL (Chào hỏi)",
                "question": "Xin chào! Bạn là ai thế?"
            },
            {
                "category": "OVER_BUDGET (Vượt ngân sách)",
                "question": "Phòng ban nào đang chi tiêu vượt ngân sách cao nhất?"
            },
            {
                "category": "EXPENSES (Chi phí)",
                "question": "Cho tôi biết chi tiết chi phí của các phòng ban?"
            },
            {
                "category": "SUMMARY (Tổng quan)",
                "question": "Tóm tắt tình hình tài chính tổng quan giúp tôi?"
            }
        ]

        for i, case in enumerate(test_cases, 1):
            print(f"\n--- TEST CASE #{i}: {case['category']} ---")
            print(f"Câu hỏi: \"{case['question']}\"")
            
            # Thực thi hàm ask_question của Agent
            response = ask_question(case['question'], db)
            
            print(f"Trả lời từ Agent:\n{response}")
            print("-" * 50)
            
    finally:
        db.close()

if __name__ == "__main__":
    test_agent()
