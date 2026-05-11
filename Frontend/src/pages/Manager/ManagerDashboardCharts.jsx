import { useMemo } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const GENDER_COLORS = {
  Nam: "#8b0000",
  Nữ: "#ff69b4",
  "Chưa cập nhật": "#c99a2c",
};

const FINANCE_COLORS = {
  income: "#0f766e",
  expense: "#dc2626",
};

const FAMILY_COLOR = "#d4a62a";

const formatMoney = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatShortMoney = (value) => {
  const number = Number(value || 0);

  if (number >= 1000000) {
    return `${(number / 1000000).toFixed(number % 1000000 === 0 ? 0 : 1)}tr`;
  }

  if (number >= 1000) {
    return `${Math.round(number / 1000)}k`;
  }

  return `${number}`;
};

const normalizeGender = (gender) => {
  const value = String(gender ?? "").trim().toLowerCase();

  if (value === "1" || value === "male" || value === "nam") {
    return "Nam";
  }

  if (
    value === "2" ||
    value === "female" ||
    value === "nữ" ||
    value === "nu"
  ) {
    return "Nữ";
  }

  return "Chưa cập nhật";
};

const getQuarterFromDate = (dateValue) => {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return {
      key: "unknown",
      label: "Chưa rõ",
      year: 0,
      quarter: 0,
    };
  }

  const month = date.getMonth() + 1;
  const quarter = Math.ceil(month / 3);
  const year = date.getFullYear();

  return {
    key: `${year}-Q${quarter}`,
    label: `Quý ${quarter}/${year}`,
    year,
    quarter,
  };
};

const buildGenderData = (members = []) => {
  const map = new Map();

  members.forEach((member) => {
    const gender = normalizeGender(member.gender);
    map.set(gender, (map.get(gender) || 0) + 1);
  });

  return Array.from(map.entries()).map(([name, value]) => ({
    name,
    value,
  }));
};

const buildFamilyQuarterData = (families = [], members = []) => {
  const map = new Map();

  if (families.length > 0) {
    families.forEach((family) => {
      const quarterInfo = getQuarterFromDate(
        family.created_at ||
          family.createdAt ||
          family.marriage_date ||
          family.marriageDate ||
          family.updated_at ||
          family.updatedAt ||
          family.date
      );

      const current = map.get(quarterInfo.key) || {
        quarter: quarterInfo.label,
        total: 0,
        year: quarterInfo.year,
        quarterNumber: quarterInfo.quarter,
      };

      current.total += 1;
      map.set(quarterInfo.key, current);
    });
  } else {
    const familyMap = new Map();

    members.forEach((member) => {
      const familyId =
        member.family_id ||
        member.familyId ||
        member.father_id ||
        member.mother_id ||
        "unknown";

      if (!familyMap.has(familyId)) {
        familyMap.set(familyId, member);
      }
    });

    familyMap.forEach((member) => {
      const quarterInfo = getQuarterFromDate(
        member.created_at ||
          member.createdAt ||
          member.updated_at ||
          member.updatedAt ||
          member.birth_date ||
          member.birthDate
      );

      const current = map.get(quarterInfo.key) || {
        quarter: quarterInfo.label,
        total: 0,
        year: quarterInfo.year,
        quarterNumber: quarterInfo.quarter,
      };

      current.total += 1;
      map.set(quarterInfo.key, current);
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.quarterNumber - b.quarterNumber;
  });
};

const buildQuarterFinanceData = (transactions = []) => {
  const map = new Map();

  transactions.forEach((tx) => {
    const quarterInfo = getQuarterFromDate(tx.date || tx.created_at);

    const current = map.get(quarterInfo.key) || {
      quarter: quarterInfo.label,
      income: 0,
      expense: 0,
      balance: 0,
      year: quarterInfo.year,
      quarterNumber: quarterInfo.quarter,
    };

    const amount = Number(tx.amount || 0);

    if (tx.type === "income") {
      current.income += amount;
    }

    if (tx.type === "expense") {
      current.expense += amount;
    }

    current.balance = current.income - current.expense;

    map.set(quarterInfo.key, current);
  });

  return Array.from(map.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.quarterNumber - b.quarterNumber;
  });
};

export default function ManagerDashboardCharts({
  members = [],
  families = [],
  fundTransactions = [],
  loading = false,
}) {
  const genderData = useMemo(() => buildGenderData(members), [members]);

  const familyQuarterData = useMemo(
  () => buildFamilyQuarterData(families, members),
  [families, members]
);

  const financeQuarterData = useMemo(
    () => buildQuarterFinanceData(fundTransactions),
    [fundTransactions]
  );

  const totalMembersWithGender = genderData.reduce(
    (sum, item) => sum + item.value,
    0
  );

  if (loading) {
    return (
      <div className="dashboard-chart-area dashboard-chart-area-clean">
        <div className="section-card chart-card chart-empty">
          Đang tải biểu đồ...
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-chart-area dashboard-chart-area-clean">
      <div className="section-card chart-card gender-chart-card">
        <div className="chart-title-row">
          <div>
            <h2>Thành viên theo giới tính</h2>
            <p>Tỷ lệ nam, nữ trong dòng họ</p>
          </div>
        </div>

        {genderData.length === 0 ? (
          <div className="chart-empty">Chưa có dữ liệu giới tính.</div>
        ) : (
          <div className="gender-chart-layout">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={genderData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={72}
                  outerRadius={108}
                  paddingAngle={6}
                >
                  {genderData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={GENDER_COLORS[entry.name] || "#c99a2c"}
                    />
                  ))}
                </Pie>

                <Tooltip
                  formatter={(value, name) => {
                    const percent = totalMembersWithGender
                      ? ((Number(value) / totalMembersWithGender) * 100).toFixed(1)
                      : 0;

                    return [`${value} người - ${percent}%`, name];
                  }}
                />

                <Legend />
              </PieChart>
            </ResponsiveContainer>

            <div className="gender-summary">
              {genderData.map((item) => {
                const percent = totalMembersWithGender
                  ? ((item.value / totalMembersWithGender) * 100).toFixed(1)
                  : 0;

                return (
                  <div className="gender-summary-item" key={item.name}>
                    <span
                      style={{
                        backgroundColor: GENDER_COLORS[item.name] || "#c99a2c",
                      }}
                    />

                    <div>
                      <strong>{item.value}</strong>
                      <p>
                        {item.name} - {percent}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="section-card chart-card family-chart-card">
  <div className="chart-title-row">
  <div>
    <h2>Gia đình theo quý</h2>
    <p>Thống kê số gia đình theo chu kỳ 3 tháng</p>
  </div>

  <span className="chart-badge">3 tháng</span>
</div>

  {familyQuarterData.length === 0 ? (
    <div className="chart-empty">Chưa có dữ liệu gia đình theo quý.</div>
  ) : (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={familyQuarterData}
        margin={{ top: 20, right: 20, left: 0, bottom: 10 }}
        barCategoryGap="28%"
      >
        <CartesianGrid
          strokeDasharray="4 4"
          vertical={false}
          stroke="#eadfce"
        />

        <XAxis
          dataKey="quarter"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#7a684f", fontSize: 14, fontWeight: 600 }}
        />

        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#7a684f", fontSize: 14 }}
        />

        <Tooltip
          formatter={(value) => [`${value} gia đình`, "Số lượng"]}
          contentStyle={{
            borderRadius: "12px",
            border: "1px solid #ecd9bc",
            background: "#fffaf3",
          }}
        />

        <Bar
          dataKey="total"
          name="Số gia đình"
          fill={FAMILY_COLOR}
          radius={[12, 12, 0, 0]}
          maxBarSize={68}
        />
         </BarChart>
        </ResponsiveContainer>
         )}
    </div>

      <div className="section-card chart-card finance-quarter-card">
  <div className="chart-title-row">
    <div>
      <h2>Thu / Chi theo quý</h2>
      <p>Mỗi quý gồm 2 cột: tổng thu và tổng chi</p>
    </div>
  </div>

  {financeQuarterData.length === 0 ? (
    <div className="chart-empty">Chưa có dữ liệu thu chi.</div>
  ) : (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart
        data={financeQuarterData}
        margin={{ top: 20, right: 24, left: 10, bottom: 10 }}
        barGap={10}
        barCategoryGap="30%"
      >
        <CartesianGrid
          strokeDasharray="4 4"
          vertical={false}
          stroke="#eadfce"
        />

        <XAxis
          dataKey="quarter"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#7a684f", fontSize: 14, fontWeight: 600 }}
        />

        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#7a684f", fontSize: 14 }}
          tickFormatter={formatShortMoney}
        />

        <Tooltip
          formatter={(value, name) => [formatMoney(value), name]}
          contentStyle={{
            borderRadius: "12px",
            border: "1px solid #ecd9bc",
            background: "#fffaf3",
          }}
        />

        <Legend
          wrapperStyle={{
            paddingTop: 14,
            fontWeight: 700,
          }}
          iconType="circle"
        />

        <Bar
          dataKey="income"
          name="Thu"
          fill={FINANCE_COLORS.income}
          radius={[10, 10, 0, 0]}
          maxBarSize={54}
        />

        <Bar
          dataKey="expense"
          name="Chi"
          fill={FINANCE_COLORS.expense}
          radius={[10, 10, 0, 0]}
          maxBarSize={54}
        />
      </BarChart>
    </ResponsiveContainer>
  )}
</div>
    </div>
  );
}