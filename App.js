
import React, {useEffect} from 'react';
import {getApp} from '@react-native-firebase/app';
import AppNavigator from './src/navigation/AppNavigator';

const App = () => {
  useEffect(() => {
    try {
      const app = getApp();
      console.log('Firebase initialized successfully:', app.name);
    } catch (error) {
      console.error('Firebase initialization error:', error);
    }
  }, []);

  return <AppNavigator />;
};

export default App;
