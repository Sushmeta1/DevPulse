import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, Empty } from './Card.jsx';

const COLORS = { Merged: '#7c3aed', Open: '#16a34a', Closed: '#dc2626' };

export default function PullRequestChart({ data }) {
  const total = data.reduce((n, d) => n + d.value, 0);
  return (
    <Card title="Pull requests by state">
      {total === 0 ? (
        <Empty>No pull requests in this period.</Empty>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {data.map((d) => <Cell key={d.name} fill={COLORS[d.name]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
