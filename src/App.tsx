import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { FormProvider } from './context/FormContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { EnvironmentCheck } from './components/EnvironmentCheck';
import ErrorBoundary from './components/ErrorBoundary';
import DashboardAuth from './components/dashboard/DashboardAuth';
import DashboardLayout from './components/dashboard/DashboardLayout';
import HomePage from './components/dashboard/HomePage';
import PropertiesPage from './components/dashboard/PropertiesPage';
import DevelopersPage from './components/dashboard/DevelopersPage';
import PropertyDetailsPage from './components/dashboard/PropertyDetailsPage';
import PropertyEntryForm from './components/property-entry/PropertyEntryForm';
import AnalyticsOverviewPage from './components/analytics/AnalyticsOverviewPage';
import PropertyAnalyticsPage from './components/analytics/PropertyAnalyticsPage';
import UserAnalyticsPage from './components/analytics/UserAnalyticsPage';
import RealtimePage from './components/analytics/RealtimePage';
// LASCO Pages
import LascoErrorsPage from './components/lasco/ErrorsPage';
import LascoErrorDetailPage from './components/lasco/ErrorDetailPage';
import LascoFixesPage from './components/lasco/FixesPage';
import LascoSettingsPage from './components/lasco/SettingsPage';
import { setAuthCheckCallback } from './lib/supabaseAuth';
import { useEffect } from 'react';

// Component to set up auth check callback
const AuthSetup: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  try {
    const { checkAuth } = useAuth();
    
    useEffect(() => {
      try {
        setAuthCheckCallback(checkAuth);
      } catch (err) {
        console.error('Error setting auth check callback:', err);
      }
    }, [checkAuth]);
    
    return <>{children}</>;
  } catch (error) {
    console.error('AuthSetup error:', error);
    return <>{children}</>;
  }
};

function App() {
  return (
    <ErrorBoundary>
      <EnvironmentCheck>
        <ThemeProvider>
          <AuthProvider>
            <AuthSetup>
              <Router>
                <Routes>
                  {/* All routes require authentication */}
                  <Route path="/*" element={<DashboardAuth />}>
                    <Route path="*" element={<DashboardLayout />}>
                      <Route index element={<HomePage />} />
                      <Route path="properties" element={<PropertiesPage />} />
                      <Route path="developers" element={<DevelopersPage />} />
                      <Route path="property/:slug" element={<PropertyDetailsPage />} />
                      <Route
                        path="add-property"
                        element={
                          <FormProvider>
                            <PropertyEntryForm />
                          </FormProvider>
                        }
                      />
                      {/* Analytics Routes */}
                      <Route path="analytics" element={<AnalyticsOverviewPage />} />
                      <Route path="analytics/properties" element={<PropertyAnalyticsPage />} />
                      <Route path="analytics/users" element={<UserAnalyticsPage />} />
                      <Route path="analytics/realtime" element={<RealtimePage />} />
                      {/* LASCO Routes */}
                      <Route path="lasco" element={<LascoErrorsPage />} />
                      <Route path="lasco/errors" element={<LascoErrorsPage />} />
                      <Route path="lasco/errors/:id" element={<LascoErrorDetailPage />} />
                      <Route path="lasco/fixes" element={<LascoFixesPage />} />
                      <Route path="lasco/fixes/:id" element={<LascoFixesPage />} />
                      <Route path="lasco/settings" element={<LascoSettingsPage />} />
                    </Route>
                  </Route>
                </Routes>
              </Router>
            </AuthSetup>
          </AuthProvider>
        </ThemeProvider>
      </EnvironmentCheck>
    </ErrorBoundary>
  );
}

export default App;

