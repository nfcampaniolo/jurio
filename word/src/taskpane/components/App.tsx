import React, { useEffect, useState } from "react";
import { onAuthStateChange } from "../../firebase/auth";
import type { User } from "firebase/auth";

import LoginPage from "../../auth/LoginPage";
import Workspace from "../../app/Workspace";
import { LOGO_URL } from "../../config/env";
import "../../global.css";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChange((currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });

    return unsubscribe;
  }, []);

  if (!authReady) {
    return (
      <div className="page-container app-loading">
        <img src={LOGO_URL} alt="" />
        <div className="spinner"></div>
        <p className="loading-text">Caricamento in corso...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <Workspace user={user} />;
};

export default App;
