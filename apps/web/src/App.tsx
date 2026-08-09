import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { PatientDashboard } from './pages/patient/PatientDashboard';
import { ClinicDashboard } from './pages/clinic/ClinicDashboard';

// Route map per Stage 2 §22. Patient portal under /p, clinic portal under /c.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/p" element={<PatientDashboard />} />
      <Route path="/c" element={<ClinicDashboard />} />
    </Routes>
  );
}
