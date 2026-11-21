import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
} from 'react-native';

import ProfileScreen from '../screens/ProfileScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import LoginScreen from '../screens/LoginScreen';
import OTPScreen from '../screens/OTPScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';

import {useCart} from '../context/CartContext';
import API from '../data/api';
import colors from '../theme/colors';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Temporary screens until we build their actual features.
const ComingSoonScreen = ({route}) => (
  <View style={styles.placeholderContainer}>
    <Text style={styles.placeholderTitle}>
      {route.name === 'OrderAgain' ? 'Order Again' : route.name}
    </Text>

    <Text style={styles.placeholderText}>
      This section is coming soon.
    </Text>
  </View>
);

// Main bottom navigation.
const MainTabs = ({route}) => {
  // Cart count comes from the shared cart (provided in App.js).
  const {cartCount} = useCart();

  const icons = {
    HomeTab: 'home-variant',
    OrderAgain: 'history',
    Cart: 'shopping-outline',
    Profile: 'account-circle-outline',
  };

  return (
    <Tab.Navigator
      screenOptions={({route: tabRoute}) => ({
        headerShown: false,

        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#777777',

        tabBarStyle: {
          height: 65,
          paddingTop: 6,
          paddingBottom: 6,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#EEEEEE',
          elevation: 10,
        },

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },

        tabBarIcon: ({color, focused}) => (
          <MaterialCommunityIcons
            name={icons[tabRoute.name]}
            size={focused ? 26 : 23}
            color={color}
          />
        ),
      })}>

      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        initialParams={route.params || {}}
        options={{
          tabBarLabel: 'Home',
        }}
      />

      <Tab.Screen
        name="OrderAgain"
        component={ComingSoonScreen}
        options={{tabBarLabel: 'Order Again'}}
      />

      <Tab.Screen
        name="Cart"
        component={ComingSoonScreen}
        options={{
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary,
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '800',
          },
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
        }}
      />

    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const [initialRoute, setInitialRoute] = useState(null);
  const [initialParams, setInitialParams] = useState({});

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const token = await AsyncStorage.getItem('dkd_token');

        const savedUserString = await AsyncStorage.getItem('dkd_user');

        const savedUser = savedUserString
          ? JSON.parse(savedUserString)
          : null;

        // No token: open Login.
        if (!token) {
          setInitialRoute('Login');
          return;
        }

        // Validate token and get latest profile.
        const response = await API.get('/auth/customer/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.data?.success && response.data?.user) {
          const profile = response.data.user;

          const user = {
            email: profile.email,
            isProfileComplete: true,
            profile,
          };

          await AsyncStorage.setItem(
            'dkd_user',
            JSON.stringify(user),
          );

          await AsyncStorage.setItem(
            'dkd_mode',
            profile.mode || 'Retail',
          );

          setInitialParams({
            name: profile.name,
            email: profile.email,
            mode: profile.mode || 'Retail',
            profile,
          });

          setInitialRoute('Home');
        } else {
          setInitialRoute('Login');
        }
      } catch (error) {
        const status = error.response?.status;

        console.log(
          'AUTO LOGIN ERROR:',
          error.response?.data || error.message,
        );

        // Invalid or expired token.
        if (status === 401 || status === 403) {
          await AsyncStorage.multiRemove([
            'dkd_token',
            'dkd_user',
            'dkd_mode',
          ]);

          setInitialRoute('Login');
          return;
        }

        // Profile not found.
        if (status === 404) {
          const token = await AsyncStorage.getItem('dkd_token');
          const savedUserString = await AsyncStorage.getItem('dkd_user');
          const savedUser = savedUserString
            ? JSON.parse(savedUserString)
            : null;

          setInitialParams({
            email: savedUser?.email || '',
            mode: savedUser?.profile?.mode || 'Retail',
            token,
            user: savedUser,
          });

          setInitialRoute('Register');
          return;
        }

        // Network/server issue: use cached profile.
        const cachedString = await AsyncStorage.getItem('dkd_user');
        const cachedUser = cachedString ? JSON.parse(cachedString) : null;

        if (cachedUser?.profile) {
          setInitialParams({
            name: cachedUser.profile.name,
            email: cachedUser.email,
            mode: cachedUser.profile.mode || 'Retail',
            profile: cachedUser.profile,
          });

          setInitialRoute('Home');
        } else {
          setInitialRoute('Login');
        }
      }
    };

    checkLogin();
  }, []);

  if (!initialRoute) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
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

          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{headerShown: false}}
          />

          <Stack.Screen
            name="OTP"
            component={OTPScreen}
            options={{
              title: 'Verify Email',
              headerBackVisible: false,
              gestureEnabled: false,
            }}
          />

          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            initialParams={
              initialRoute === 'Register' ? initialParams : {}
            }
            options={{
              title: 'Complete Profile',
              headerBackVisible: false,
              gestureEnabled: false,
            }}
          />

          <Stack.Screen
            name="Home"
            component={MainTabs}
            initialParams={
              initialRoute === 'Home' ? initialParams : {}
            }
            options={{
              headerShown: false,
              gestureEnabled: false,
            }}
          />

          {/* Full-screen search page (opens above the tab bar) */}
          <Stack.Screen
            name="Search"
            component={SearchScreen}
            options={{
              headerShown: false,
              animation: 'fade',
            }}
          />

        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },

  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },

  placeholderTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#222222',
  },

  placeholderText: {
    fontSize: 14,
    color: '#777777',
    marginTop: 8,
  },
});

export default AppNavigator;