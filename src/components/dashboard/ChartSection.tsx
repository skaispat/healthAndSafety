import React from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Observation, Task, Department } from '../../types/database';

interface ChartSectionProps {
  observations: Observation[];
  tasks: Task[];
  departments: Department[];
}

export const ChartSection: React.FC<ChartSectionProps> = ({
  observations,
  tasks,
  departments,
}) => {
  // 1. Task Status Distribution
  const taskStatusData = [
    { name: 'Assigned', count: tasks.filter((t) => t.status === 'ASSIGNED').length, color: '#38bdf8' },
    { name: 'In Progress', count: tasks.filter((t) => t.status === 'IN_PROGRESS').length, color: '#818cf8' },
    { name: 'Awaiting Review', count: tasks.filter((t) => t.status === 'SUBMITTED_FOR_REVIEW').length, color: '#fbbf24' },
    { name: 'Rework Required', count: tasks.filter((t) => t.status === 'REWORK_REQUIRED').length, color: '#f97316' },
    { name: 'Completed', count: tasks.filter((t) => t.status === 'COMPLETED').length, color: '#10b981' },
    { name: 'Overdue', count: tasks.filter((t) => t.status === 'OVERDUE').length, color: '#ef4444' },
  ];

  // 2. Priority & Risk Breakdown
  const priorityData = [
    { name: 'High (6% – 9%)', value: observations.filter((o) => o.priority === 'HIGH').length, color: '#ef4444' },
    { name: 'Medium (3% – 6%)', value: observations.filter((o) => o.priority === 'MEDIUM').length, color: '#f59e0b' },
    { name: 'Low (1% – 3%)', value: observations.filter((o) => o.priority === 'LOW').length, color: '#10b981' },
  ];

  // 3. Department Breakdown (Filter to departments with activity so bars are clean and readable)
  const activeDepartments = departments
    .map((dept) => {
      const deptObs = observations.filter((o) => o.department_id === dept.id).length;
      const deptTasks = tasks.filter((t) => t.observation?.department_id === dept.id).length;
      return {
        name: dept.name,
        shortName: dept.code || (dept.name.length > 10 ? dept.name.slice(0, 8) + '…' : dept.name),
        fullName: dept.name,
        Observations: deptObs,
        Tasks: deptTasks,
        total: deptObs + deptTasks,
      };
    })
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total);

  const departmentData = activeDepartments.length > 0
    ? activeDepartments
    : departments.slice(0, 4).map((dept) => ({
        name: dept.name,
        shortName: dept.code || dept.name.slice(0, 8),
        fullName: dept.name,
        Observations: 0,
        Tasks: 0,
        total: 0,
      }));

  const customTooltipStyle = {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    color: '#0f172a',
    fontSize: '0.8rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  };

  return (
    <div className="grid-charts">
      {/* Chart 1: Department Breakdown */}
      <div className="ehs-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Department Safety Volume
          </h4>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {departmentData.length} Active Plant Depts
          </span>
        </div>
        <div style={{ height: '230px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={departmentData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="shortName" stroke="#64748b" fontSize={11} interval={0} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} tickLine={false} />
              <Tooltip
                contentStyle={customTooltipStyle}
                formatter={(val: any, name: any, item: any) => [val, `${item?.payload?.fullName || ''} (${name})`]}
              />
              <Legend verticalAlign="top" height={30} iconSize={10} />
              <Bar dataKey="Observations" fill="#b91c1c" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="Tasks" fill="#0284c7" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
