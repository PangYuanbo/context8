import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { View } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('home');

  return (
    <Layout currentView={currentView} onViewChange={setCurrentView}>
      {currentView === 'home' ? <Home /> : <Dashboard />}
    </Layout>
  );
};

export default App;