import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
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
          token: {
            colorPrimary: '#1677ff',
            borderRadius: 6,
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
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
