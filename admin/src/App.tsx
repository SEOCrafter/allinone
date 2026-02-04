import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Adapters from './pages/Adapters';
import Requests from './pages/Requests';
import Users from './pages/Users';
import Stats from './pages/Stats';
import UnitEconomics from './pages/UnitEconomics';
import Providers from './pages/Providers';
import Tariffs from './pages/Tariffs';
import Support from './pages/Support';

const queryClient = new QueryClient();

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  return token ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="adapters" element={<Adapters />} />
            <Route path="providers" element={<Providers />} />
            <Route path="requests" element={<Requests />} />
            <Route path="users" element={<Users />} />
            <Route path="stats" element={<Stats />} />
            <Route path="unit-economics" element={<UnitEconomics />} />
            <Route path="tariffs" element={<Tariffs />} />
            <Route path="support" element={<Support />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;