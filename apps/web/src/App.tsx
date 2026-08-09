import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './lib/api';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { AcceptInvitePage } from './pages/patient/AcceptInvitePage';
import { ClinicsPage } from './pages/patient/ClinicsPage';
import { PassportPage } from './pages/patient/PassportPage';
import { PatientDashboard } from './pages/patient/PatientDashboard';
import { ClinicDashboard } from './pages/clinic/ClinicDashboard';
import { PatientsPage } from './pages/clinic/PatientsPage';
import { ReviewPage } from './pages/clinic/ReviewPage';

/** Resolves the acting clinic (first membership) for clinic-portal pages. */
function WithClinic({ children }: { children: (clinicId: string) => JSX.Element }) {
  const [clinicId, setClinicId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    api<{ memberships: { clinic: { id: string } }[] }>('/me')
      .then((me) => setClinicId(me.memberships[0]?.clinic.id ?? null))
      .catch(() => setClinicId(null));
  }, []);
  if (clinicId === undefined) return <main style={{ fontFamily: 'system-ui', padding: 24 }}>Loading…</main>;
  if (clinicId === null) return <Navigate to="/c" replace />;
  return children(clinicId);
}

// Route map per Stage 2 §22. Patient portal under /p, clinic portal under /c.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/invite/:token" element={<AcceptInvitePage />} />
      <Route path="/p" element={<PatientDashboard />} />
      <Route path="/p/passport" element={<PassportPage />} />
      <Route path="/p/clinics" element={<ClinicsPage />} />
      <Route path="/c" element={<ClinicDashboard />} />
      <Route path="/c/patients" element={<WithClinic>{(id) => <PatientsPage clinicId={id} />}</WithClinic>} />
      <Route path="/c/review" element={<WithClinic>{(id) => <ReviewPage clinicId={id} />}</WithClinic>} />
    </Routes>
  );
}
