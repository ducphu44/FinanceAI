# 📖 Data Dictionary – Financial Sample Dataset

> **File:** `sample_data/financial_sample.csv` / `sample_data/financial_sample.xlsx`  
> **Mô tả:** Bộ dữ liệu tài chính giả lập phục vụ mục đích phân tích và thực hành.  
> **Số dòng:** ~321 giao dịch  
> **Khoảng thời gian:** 2024-01-01 → 2024-06-30 (6 tháng)

---

## Mô tả các cột (Column Descriptions)

| Cột | Kiểu dữ liệu | Mô tả | Ví dụ |
|-----|-------------|-------|-------|
| `transaction_id` | `string` | Mã định danh duy nhất cho mỗi giao dịch, định dạng `TXN-XXXX` | `TXN-0001` |
| `date` | `date (YYYY-MM-DD)` | Ngày phát sinh giao dịch | `2024-03-15` |
| `month` | `string (YYYY-MM)` | Tháng phát sinh giao dịch, dùng để nhóm và phân tích theo tháng | `2024-03` |
| `department` | `string` | Phòng ban / khoa chịu trách nhiệm giao dịch | `Faculty of Medicine` |
| `category` | `string` | Khoản mục chi tiêu hoặc thu nhập | `Salary`, `Equipment` |
| `transaction_type` | `string` | Loại giao dịch: `expense` (chi phí) hoặc `revenue` (doanh thu/thu nhập) | `expense` |
| `budget_amount` | `float` | Số tiền ngân sách được phê duyệt cho giao dịch (đơn vị: VND hoặc USD giả lập) | `45000.00` |
| `actual_amount` | `float` | Số tiền thực tế phát sinh. Một số trường hợp vượt `budget_amount` (over-budget) hoặc tăng đột biến so với tháng trước (anomaly) | `52000.00` |
| `description` | `string` | Mô tả ngắn gọn nội dung giao dịch | `Monthly staff salary` |

---

## Giá trị phân loại (Categorical Values)

### `department` – Phòng ban
| Giá trị | Mô tả |
|---------|-------|
| `Faculty of Medicine` | Khoa Y |
| `Faculty of Engineering` | Khoa Kỹ thuật |
| `Faculty of Business` | Khoa Kinh doanh |
| `Admissions Office` | Phòng Tuyển sinh |
| `Student Affairs` | Phòng Công tác Sinh viên |
| `Research Office` | Phòng Nghiên cứu Khoa học |

### `category` – Khoản mục tài chính
| Giá trị | Mô tả |
|---------|-------|
| `Salary` | Lương và các khoản thù lao nhân sự |
| `Equipment` | Mua sắm, thuê hoặc bảo trì thiết bị |
| `Marketing` | Chi phí truyền thông, quảng cáo, in ấn |
| `Training` | Đào tạo, phát triển năng lực nhân viên |
| `Travel` | Chi phí đi lại, công tác |
| `Operations` | Chi phí vận hành: điện, nước, văn phòng phẩm, bảo trì |

### `transaction_type` – Loại giao dịch
| Giá trị | Mô tả |
|---------|-------|
| `expense` | Chi phí (chiếm ~75% dữ liệu) |
| `revenue` | Thu nhập / doanh thu (chiếm ~25% dữ liệu) |

---

## Các trường hợp đặc biệt được tạo cố tình

### 1. Vượt ngân sách (Over-budget)
- **Điều kiện:** `actual_amount > budget_amount`
- **Tỷ lệ:** ~15–20% tổng số giao dịch
- **Mức vượt:** từ 5% đến 40% so với `budget_amount`
- **Mục đích:** Kiểm tra khả năng phát hiện sai lệch ngân sách

### 2. Tăng đột biến so với tháng trước (Monthly Anomaly)
- **Điều kiện:** `actual_amount` tháng hiện tại tăng gấp 1.9 – 3.2 lần so với tháng trước, cùng phòng ban và khoản mục
- **Tỷ lệ:** ~10% các giao dịch có lịch sử tháng trước
- **Mục đích:** Kiểm tra khả năng phát hiện bất thường trong chuỗi thời gian

---

## Thống kê tổng quan

| Chỉ số | Giá trị |
|--------|---------|
| Tổng số dòng | ~321 |
| Số phòng ban | 6 |
| Số khoản mục | 6 |
| Khoảng thời gian | 2024-01 đến 2024-06 |
| Số giao dịch vượt ngân sách | ~63 dòng |
| Tỷ lệ `expense` / `revenue` | ~75% / ~25% |

---

## Hướng dẫn sử dụng với Pandas

```python
import pandas as pd

# Đọc CSV
df_csv = pd.read_csv("sample_data/financial_sample.csv", parse_dates=["date"])

# Đọc Excel
df_xlsx = pd.read_excel("sample_data/financial_sample.xlsx", sheet_name="Financial Data")

# Lọc giao dịch vượt ngân sách
over_budget = df_csv[df_csv["actual_amount"] > df_csv["budget_amount"]]

# Tổng chi phí theo phòng ban
dept_summary = df_csv[df_csv["transaction_type"] == "expense"].groupby("department")["actual_amount"].sum()

# Phân tích theo tháng
monthly = df_csv.groupby(["month", "category"])["actual_amount"].sum().unstack()
```

---

*Tài liệu này được tạo tự động. Dữ liệu hoàn toàn giả lập, không liên quan đến bất kỳ tổ chức thực tế nào.*
