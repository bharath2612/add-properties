import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { FormProvider } from './context/FormContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { EnvironmentCheck } from './components/EnvironmentCheck';
import DashboardAuth from './components/dashboard/DashboardAuth';
import DashboardLayout from './components/dashboard/DashboardLayout';
import HomePage from './components/dashboard/HomePage';
import PropertiesPage from './components/dashboard/PropertiesPage';
import PropertyDetailsPage from './components/dashboard/PropertyDetailsPage';
import PropertyEntryForm from './components/property-entry/PropertyEntryForm';

function App() {
  return (
    <EnvironmentCheck>
      <ThemeProvider>
        <Router>
          <DashboardAuth>
            <Routes>
              {/* Dashboard Routes with Layout */}
              <Route path="/" element={<DashboardLayout />}>
                <Route index element={<HomePage />} />
                <Route path="properties" element={<PropertiesPage />} />
                <Route
                  path="add-property"
                  element={
                    <FormProvider>
                      <PropertyEntryForm />
                    </FormProvider>
                  }
                />
              </Route>
              
              {/* Property Details Route (Full Screen) */}
              <Route path="/property/:slug" element={<PropertyDetailsPage />} />
            </Routes>
          </DashboardAuth>
        </Router>
      </ThemeProvider>
    </EnvironmentCheck>
  );
}

export default App;

