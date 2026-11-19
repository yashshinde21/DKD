
import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import LoginScreen from '../screens/LoginScreen';
import OTPScreen from '../screens/OTPScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';

import colors from '../theme/colors';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: colors.white,
          headerTitleStyle: {
            fontWeight: '800',
          },
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}>

        {/* LOGIN */}
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{
            headerShown: false,
          }}
        />

        {/* EMAIL OTP */}
        <Stack.Screen
          name="OTP"
          component={OTPScreen}
          options={{
            title: 'Verify Email',
            headerBackVisible: false,
            gestureEnabled: false,
          }}
        />

        {/* REGISTER */}
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{
            title: 'Complete Profile',
            headerBackVisible: false,
            gestureEnabled: false,
          }}
        />

        {/* HOME */}
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: 'DKD Fruits',
            headerBackVisible: false,
            gestureEnabled: false,
          }}
        />

      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
