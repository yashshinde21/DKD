
import React, {useEffect, useState} from 'react';
import {
  View,
  Image,
  StyleSheet,
  StatusBar,
} from 'react-native';

import {getApp} from '@react-native-firebase/app';
import AppNavigator from './src/navigation/AppNavigator';

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    try {
      const app = getApp();
      console.log('Firebase initialized successfully:', app.name);
    } catch (error) {
      console.error('Firebase initialization error:', error);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar hidden={true} />
        <Image
          source={require('./src/assets/dkd-splash.png')}
          style={styles.splashImage}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <>
      <StatusBar
        hidden={false}
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
      />
      <AppNavigator />
    </>
  );
};

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  splashImage: {
    width: '100%',
    height: '100%',
  },
});

export default App;
