import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, App as AntApp, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/dashboard';
import SearchPage from './pages/search';
import MonitoringPage from './pages/monitoring';
import AlertsPage from './pages/alerts';
import SettingsPage from './pages/settings';
import IndustryMappingsPage from './pages/industry-mappings';
import TemperaturePage from './pages/temperature';
import DeepAnalysisPage from './pages/deep-analysis';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorBgBase: '#020617',
            colorBgContainer: '#0E1223',
            colorBgElevated: '#1A1E2F',
            colorBorder: '#1E293B',
            colorBorderSecondary: '#334155',
            colorText: '#F8FAFC',
            colorTextSecondary: '#94A3B8',
            colorTextTertiary: '#64748B',
            colorPrimary: '#22C55E',
            colorSuccess: '#22C55E',
            colorWarning: '#F59E0B',
            colorError: '#EF4444',
            colorInfo: '#3B82F6',
            fontFamily: "'Fira Sans', -apple-system, sans-serif",
            borderRadius: 6,
            controlHeight: 36,
          },
        }}
      >
        <AntApp>
          <BrowserRouter>
            <Routes>
              <Route element={<MainLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/monitoring" element={<MonitoringPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/industry-mappings" element={<IndustryMappingsPage />} />
                <Route path="/temperature" element={<TemperaturePage />} />
                <Route path="/deep-analysis" element={<DeepAnalysisPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
