import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { Feed } from './components/Feed';
import { CreativeStudio } from './components/CreativeStudio';
import { ChatBuddy } from './components/ChatBuddy';
import { ParentZone } from './components/ParentZone';
import { LearnTV } from './components/LearnTV';
import { View } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.FEED);

  const renderView = () => {
    switch (currentView) {
      case View.FEED:
        return <Feed />;
      case View.TV:
        return <LearnTV />;
      case View.CREATE:
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
    <Layout currentView={currentView} onNavigate={setCurrentView}>
      {renderView()}
    </Layout>
  );
};

export default App;