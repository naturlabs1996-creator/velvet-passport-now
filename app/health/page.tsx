import HealthDashboard from "./HealthDashboard";

export const metadata = {
  title: "NOW System Health",
  robots: { index: false, follow: false },
};

export default function HealthPage() {
  return <HealthDashboard />;
}
