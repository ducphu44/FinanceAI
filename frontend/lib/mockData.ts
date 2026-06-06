// lib/mockData.ts – Mock data dùng cho toàn bộ frontend MVP

export const MONTHS = ["2024-01","2024-02","2024-03","2024-04","2024-05","2024-06"];
export const DEPARTMENTS = [
  "Faculty of Medicine","Faculty of Engineering","Faculty of Business",
  "Admissions Office","Student Affairs","Research Office",
];

// KPI summary
export const kpiData = {
  totalRevenue:     1_842_500,
  totalExpense:     2_315_800,
  totalBudget:      2_600_000,
  budgetUsed:       2_315_800,
  budgetRemaining:    284_200,
  budgetUtilization:   89.07,
};

// Monthly revenue vs expense
export const monthlyChart = [
  { month:"Jan", revenue:280000, expense:365000 },
  { month:"Feb", revenue:310000, expense:380000 },
  { month:"Mar", revenue:295000, expense:410000 },
  { month:"Apr", revenue:320000, expense:355000 },
  { month:"May", revenue:305000, expense:390000 },
  { month:"Jun", revenue:332500, expense:415800 },
];

// Expense by department
export const departmentChart = [
  { department:"Med",     amount:520000 },
  { department:"Eng",     amount:438000 },
  { department:"Business",amount:372000 },
  { department:"Admiss.", amount:298000 },
  { department:"Student", amount:356000 },
  { department:"Research",amount:331800 },
];

// Over-budget table
export const overBudgetRows = [
  { id:"TXN-0042", dept:"Faculty of Medicine",    cat:"Salary",    budget:45000, actual:52300, variance:16.2 },
  { id:"TXN-0117", dept:"Research Office",         cat:"Operations",budget:20000, actual:62000, variance:210.0},
  { id:"TXN-0088", dept:"Faculty of Engineering", cat:"Equipment", budget:32000, actual:36800, variance:15.0 },
  { id:"TXN-0203", dept:"Student Affairs",         cat:"Travel",    budget:8000,  actual:9500,  variance:18.75},
  { id:"TXN-0156", dept:"Admissions Office",       cat:"Marketing", budget:15000, actual:19200, variance:28.0 },
];

// Alerts
export const alerts = [
  { id:1, level:"critical", message:"Research Office – Operations vượt ngân sách 210%", date:"2024-03-22" },
  { id:2, level:"warning",  message:"Faculty of Medicine – Salary tăng đột biến 2.4x so với tháng 2", date:"2024-03-15" },
  { id:3, level:"warning",  message:"Admissions Office – Marketing vượt ngân sách 28%", date:"2024-04-05" },
  { id:4, level:"info",     message:"Faculty of Business – Training tăng 1.9x so với tháng trước", date:"2024-05-10" },
];

// Upload preview
export const previewRows = [
  { txn:"TXN-0001", date:"2024-01-03", dept:"Faculty of Medicine",   cat:"Salary",    type:"expense", budget:45000, actual:41200 },
  { txn:"TXN-0002", date:"2024-01-07", dept:"Faculty of Engineering",cat:"Equipment", type:"expense", budget:30000, actual:28500 },
  { txn:"TXN-0003", date:"2024-01-11", dept:"Research Office",       cat:"Operations",type:"revenue", budget:20000, actual:22000 },
  { txn:"TXN-0004", date:"2024-01-15", dept:"Admissions Office",     cat:"Marketing", type:"expense", budget:15000, actual:14300 },
  { txn:"TXN-0005", date:"2024-01-20", dept:"Student Affairs",       cat:"Travel",    type:"expense", budget:8000,  actual:7800  },
];

// AI suggested questions
export const suggestedQuestions = [
  "Phòng ban nào vượt ngân sách nhiều nhất trong Q1/2024?",
  "Tổng chi phí Salary 6 tháng đầu năm là bao nhiêu?",
  "So sánh chi phí Equipment giữa các khoa.",
  "Tháng nào có tỷ lệ vượt ngân sách cao nhất?",
  "Liệt kê các giao dịch bất thường trong tháng 3.",
];

// AI chat history
export const aiMessages = [
  {
    role:"user",
    text:"Phòng ban nào vượt ngân sách nhiều nhất trong Q1/2024?",
    time:"21:05",
  },
  {
    role:"assistant",
    text:`**Research Office** có mức vượt ngân sách cao nhất trong Q1/2024:\n\n- Khoản mục **Operations**: actual 62,000 / budget 20,000 → vượt **210%**\n- Tổng variance Q1: **+42,000**\n\nXếp hạng tiếp theo: Faculty of Medicine (+16.2%), Admissions Office (+28%).`,
    time:"21:05",
  },
];

// Reports
export const reportsList = [
  { id:1, title:"Báo cáo Tài chính Tháng 1/2024", period:"2024-01", type:"monthly",   status:"approved", createdBy:"Nguyễn Thị Lan", approvedBy:"Lê Thị Hoa" },
  { id:2, title:"Báo cáo Tài chính Tháng 2/2024", period:"2024-02", type:"monthly",   status:"approved", createdBy:"Nguyễn Thị Lan", approvedBy:"Lê Thị Hoa" },
  { id:3, title:"Báo cáo Quý 1/2024",             period:"2024-Q1", type:"quarterly", status:"reviewed", createdBy:"Nguyễn Thị Lan", approvedBy:"-"           },
  { id:4, title:"Báo cáo Tài chính Tháng 3/2024", period:"2024-03", type:"monthly",   status:"draft",    createdBy:"Nguyễn Thị Lan", approvedBy:"-"           },
];

export const reportContent = `# Báo cáo Tài chính Tháng 3/2024

## Tổng quan
- **Tổng thu:** 295,000
- **Tổng chi:** 410,000
- **Vượt ngân sách:** 3 giao dịch

## Phân tích chi phí theo phòng ban

| Phòng ban | Ngân sách | Thực tế | Chênh lệch |
|-----------|-----------|---------|-----------|
| Faculty of Medicine | 45,000 | 52,300 | +16.2% |
| Research Office | 20,000 | 62,000 | +210% |
| Faculty of Engineering | 32,000 | 36,800 | +15% |

## Cảnh báo đặc biệt
Research Office có khoản chi Operations bất thường (210% ngân sách). Cần điều tra và báo cáo lên cấp trên.

## Đề xuất
1. Tăng cường kiểm soát chi phí tại Research Office
2. Xem xét điều chỉnh ngân sách Operations cho Q2/2024
`;

// Users
export const usersList = [
  { id:1, name:"System Administrator", email:"admin@example.com",    role:"admin",           isActive:true,  createdAt:"2024-01-01" },
  { id:2, name:"Nguyễn Thị Lan",       email:"staff@example.com",    role:"finance_staff",   isActive:true,  createdAt:"2024-01-01" },
  { id:3, name:"Trần Văn Minh",        email:"manager@example.com",  role:"finance_manager", isActive:true,  createdAt:"2024-01-01" },
  { id:4, name:"Lê Thị Hoa",           email:"leader@example.com",   role:"leader",          isActive:true,  createdAt:"2024-01-01" },
  { id:5, name:"Phạm Văn Đức",         email:"staff2@example.com",   role:"finance_staff",   isActive:false, createdAt:"2024-02-15" },
];

export const ROLE_LABELS: Record<string, string> = {
  admin:           "Admin",
  finance_staff:   "Finance Staff",
  finance_manager: "Finance Manager",
  leader:          "Leader",
};
