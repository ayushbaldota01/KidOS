
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Feed } from './components/Feed';
import { CreativeStudio } from './components/CreativeStudio';
import { ChatBuddy } from './components/ChatBuddy';
import { ParentZone } from './components/ParentZone';
import { LearnTV } from './components/LearnTV';
import { WelcomeAnimation } from './components/WelcomeAnimation';
import { FloatingBuddy } from './components/FloatingBuddy';
import { View } from './types';
import { IBLMProvider } from './context/IBLMContext';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.FEED);
  const [welcomeComplete, setWelcomeComplete] = useState(false);

  const handleWelcomeComplete = () => {
      setWelcomeComplete(true);
  };

  const renderView = () => {
    switch (currentView) {
      case View.FEED:
        return <Feed />;
      case View.TV:
        return <LearnTV />;
      case View.GAMES:
        return <CreativeStudio />;
      case View.CHAT:
        return <ChatBuddy />;
      case View.PARENTS:
        return <ParentZone />;
      default:
        return <Feed />;
    }
  };

  return (
    <IBLMProvider>
        {!welcomeComplete && <WelcomeAnimation onComplete={handleWelcomeComplete} />}
        
        <Layout currentView={currentView} onNavigate={setCurrentView}>
          {renderView()}
        </Layout>
        
        {welcomeComplete && (
            <FloatingBuddy currentView={currentView} />
        )}
    </IBLMProvider>
  );
};

export default App;
