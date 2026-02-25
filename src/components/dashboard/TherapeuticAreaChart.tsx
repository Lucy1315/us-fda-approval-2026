import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, LabelList } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";

interface TherapeuticAreaData {
  name: string;
  value: number;
  category: string;
}

interface TherapeuticAreaChartProps {
  data: TherapeuticAreaData[];
}

const COLORS = [
  "hsl(210, 70%, 50%)",  // blue
  "hsl(210, 65%, 58%)",  // light blue
  "hsl(210, 60%, 42%)",  // dark blue
  "hsl(200, 70%, 55%)",  // cyan-blue
  "hsl(220, 65%, 55%)",  // indigo-blue
  "hsl(195, 70%, 50%)",  // sky blue
  "hsl(215, 60%, 48%)",  // steel blue
  "hsl(205, 65%, 52%)",  // ocean blue
];

export function TherapeuticAreaChart({ data }: TherapeuticAreaChartProps) {
  const oncologyData = useMemo(() => {
    return data.filter(d => d.category === "항암제");
  }, [data]);

  // Sort data by value descending and take top items
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => b.value - a.value).slice(0, 8);
  }, [data]);

  const sortedOncologyData = useMemo(() => {
    return [...oncologyData].sort((a, b) => b.value - a.value).slice(0, 6);
  }, [oncologyData]);

  if (data.length === 0) {
    return (
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">적응증별 분포</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] flex items-center justify-center text-muted-foreground">
            데이터가 없습니다
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">적응증별 분포</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          {/* 전체 차트 */}
          <div>
            <p className="text-sm font-semibold text-center mb-3 text-foreground">
              전체 <span className="text-primary">({data.reduce((acc, d) => acc + d.value, 0)}건)</span>
            </p>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sortedData}
                  layout="vertical"
                  margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={90}
                    tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    }}
                    formatter={(value: number, name: string) => [`${value}건`, "승인 건수"]}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                    {sortedData.map((_, index) => (
                      <Cell key={`cell-all-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    <LabelList 
                      dataKey="value" 
                      position="right" 
                      style={{ fontSize: 12, fontWeight: 600, fill: "hsl(var(--foreground))" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 항암제 차트 */}
          <div>
            <p className="text-sm font-semibold text-center mb-3 text-foreground">
              항암제 <span className="text-orange-500">({oncologyData.reduce((acc, d) => acc + d.value, 0)}건)</span>
            </p>
            <div className="h-[240px]">
              {oncologyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sortedOncologyData}
                    layout="vertical"
                    margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={90}
                      tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      }}
                      formatter={(value: number, name: string) => [`${value}건`, "승인 건수"]}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                      {sortedOncologyData.map((_, index) => (
                        <Cell key={`cell-onc-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                      <LabelList 
                        dataKey="value" 
                        position="right" 
                        style={{ fontSize: 12, fontWeight: 600, fill: "hsl(var(--foreground))" }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  항암제 데이터 없음
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
