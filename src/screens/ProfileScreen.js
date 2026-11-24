import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';

import {SafeAreaView} from 'react-native-safe-area-context';
import {useIsFocused} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import API from '../data/api';
import colors from '../theme/colors';
import AddressBottomSheet from '../components/AddressBottomSheet';
import {
  loadAddressState,
  syncAddressStateWithServer,
} from '../utils/addressHelpers';

/* ---------------- HELPERS ---------------- */

const getInitials = name => {
  if (!name) return 'C';

  const parts = name.trim().split(/\s+/);

  return (
    parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase();
};

const createFullAddress = address => {
  return [
    address.house,
    address.area,
    address.landmark,
    address.city,
    address.state,
    address.pincode,
  ]
    .filter(Boolean)
    .join(', ');
};

const Section = ({title, children}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.card}>{children}</View>
  </View>
);

const InfoRow = ({icon, label, value, last, valueStyle}) => (
  <View style={[styles.infoRow, !last && styles.rowDivider]}>
    <View style={styles.iconBox}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
    </View>

    <View style={styles.rowContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, !value && styles.infoMissing, valueStyle]}>
        {value || 'Not provided'}
      </Text>
    </View>
  </View>
);

/* ---------------- SCREEN ---------------- */

const ProfileScreen = ({navigation}) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Only the focused tab controls the status bar, so Home and Profile
  // no longer fight over its colour.
  const isFocused = useIsFocused();

  // Saved addresses (same data and same bottom sheet as the Home page).
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [addressSheetVisible, setAddressSheetVisible] = useState(false);

  /* ---------------- FETCH PROFILE ---------------- */

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);

      const token = await AsyncStorage.getItem('dkd_token');

      if (!token) {
        setError(true);
        return;
      }

      const response = await API.get('/auth/customer/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data?.success && response.data?.user) {
        setProfile(response.data.user);
      } else {
        setError(true);
      }
    } catch (err) {
      console.log(
        'PROFILE ERROR:',
        err.response?.data || err.message,
      );
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchProfile);

    fetchProfile();

    return unsubscribe;
  }, [navigation, fetchProfile]);

  /* ---------------- LOAD ADDRESSES ---------------- */

  // Same loading as Home: the phone copy first, then the server (Firebase).
  const refreshAddresses = useCallback(async () => {
    try {
      const state = await loadAddressState();

      setAddresses(state.addresses);
      setSelectedAddressId(state.selectedId);

      const synced = await syncAddressStateWithServer();

      if (synced) {
        setAddresses(synced.addresses);
        setSelectedAddressId(synced.selectedId);
      }
    } catch (err) {
      console.log('ADDRESS LOAD ERROR:', err.message);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', refreshAddresses);

    refreshAddresses();

    return unsubscribe;
  }, [navigation, refreshAddresses]);

  // Called by the address sheet after add / edit / delete / select.
  const handleAddressChange = (updatedAddresses, updatedSelectedId) => {
    setAddresses(updatedAddresses);
    setSelectedAddressId(updatedSelectedId);
  };

  /* ---------------- LOGOUT ---------------- */

const performLogout = async () => {
  try {
    setLoggingOut(true);

    console.log('LOGOUT: Starting...');

    const keysToRemove = [
      'dkd_token',
      'dkd_user',
      'dkd_mode',
      'dkd_addresses',
      'dkd_selected_address',
      'dkd_addresses_dirty',
    ];

    for (const key of keysToRemove) {
      await AsyncStorage.removeItem(key);
      console.log(`LOGOUT: Removed ${key}`);
    }

    // Verify session is cleared
    const token = await AsyncStorage.getItem('dkd_token');

    if (token !== null) {
      throw new Error('Session token could not be cleared.');
    }

    console.log('LOGOUT: Session cleared successfully');

    // Return to Login
    const rootNavigation = navigation.getParent()?.getParent() || navigation.getParent() || navigation;

    rootNavigation.reset({
      index: 0,
      routes: [{name: 'Login'}],
    });

  } catch (err) {
    console.log('LOGOUT ERROR:', err);

    Alert.alert(
      'Logout Failed',
      err.message || 'Unable to logout. Please try again.',
    );

    setLoggingOut(false);
  }
};

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout from DKD Fruits?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: performLogout,
        },
      ],
    );
  };

  /* ---------------- DISPLAY ADDRESS ---------------- */

  const selectedAddress =
    addresses.find(item => item.id === selectedAddressId) || null;

  const addressTitle = selectedAddress
    ? `Deliver to ${selectedAddress.label}`
    : 'Select your delivery address';

  const addressText = selectedAddress
    ? selectedAddress.fullAddress || createFullAddress(selectedAddress)
    : 'Tap to add your address';

  /* ---------------- STATUS BAR ---------------- */

  const statusBar = isFocused ? (
    <StatusBar
      translucent
      backgroundColor="transparent"
      barStyle="light-content"
    />
  ) : null;

  /* ---------------- LOADING ---------------- */

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {statusBar}

        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.stateText}>
            Loading your profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ---------------- ERROR ---------------- */

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {statusBar}

        <View style={styles.centerContainer}>
          <View style={styles.errorIcon}>
            <MaterialCommunityIcons
              name="account-alert-outline"
              size={40}
              color={colors.primary}
            />
          </View>

          <Text style={styles.errorTitle}>
            Unable to load profile
          </Text>

          <Text style={styles.stateText}>
            Please check your internet connection and try again.
          </Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchProfile}>
            <Text style={styles.retryButtonText}>
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isWholesale =
    profile.mode?.toLowerCase() === 'wholesale';

  /* ---------------- MAIN UI ---------------- */

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {statusBar}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>

        {/* HEADER */}

        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>

          <Text style={styles.headerSubtitle}>
            Manage your DKD Fruits account
          </Text>
        </View>

        {/* IDENTITY CARD */}

        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {getInitials(profile.name)}
            </Text>
          </View>

          <Text style={styles.customerName} numberOfLines={1}>
            {profile.name || 'Customer'}
          </Text>

          <Text style={styles.customerEmail} numberOfLines={1}>
            {profile.email || 'Email not available'}
          </Text>

          <View style={styles.modeBadge}>
            <MaterialCommunityIcons
              name={isWholesale ? 'store' : 'shopping-outline'}
              size={14}
              color={colors.primary}
            />

            <Text style={styles.modeText}>
              {isWholesale ? 'Wholesale Customer' : 'Retail Customer'}
            </Text>
          </View>
        </View>

        {/* PERSONAL INFORMATION */}

        <Section title="Personal Information">
          <InfoRow
            icon="account-outline"
            label="Full Name"
            value={profile.name}
          />

          <InfoRow
            icon="email-outline"
            label="Email Address"
            value={profile.email}
          />

          <InfoRow
            icon="phone-outline"
            label="Mobile Number"
            value={profile.phone}
            last
          />
        </Section>

        {/* BUSINESS INFORMATION */}

        {isWholesale && (
          <Section title="Business Information">
            <InfoRow
              icon="store-outline"
              label="Business Name"
              value={profile.businessName}
            />

            <InfoRow
              icon="briefcase-outline"
              label="Business Type"
              value={profile.businessType}
              last
            />
          </Section>
        )}

        {/* DELIVERY ADDRESS (same sheet as Home) */}

        <View style={styles.section}>
          <View style={styles.addressSectionHeader}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>

            <TouchableOpacity
              style={styles.addButton}
              activeOpacity={0.85}
              onPress={() => setAddressSheetVisible(true)}>
              <MaterialCommunityIcons
                name={selectedAddress ? 'pencil-outline' : 'plus'}
                size={16}
                color="#FFFFFF"
              />

              <Text style={styles.addButtonText}>
                {selectedAddress ? 'Change' : 'Add New'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.addressCard}
            activeOpacity={0.85}
            onPress={() => setAddressSheetVisible(true)}>
            <View style={styles.addressIconWrap}>
              <MaterialCommunityIcons
                name="map-marker"
                size={20}
                color={colors.primary}
              />
            </View>

            <View style={styles.addressTextBlock}>
              <Text style={styles.addressTitle} numberOfLines={1}>
                {addressTitle}
              </Text>

              <Text style={styles.addressText} numberOfLines={2}>
                {addressText}
              </Text>

              {addresses.length > 1 && (
                <Text style={styles.addressCount}>
                  {addresses.length} saved addresses
                </Text>
              )}
            </View>

            <MaterialCommunityIcons
              name="chevron-down"
              size={22}
              color="#777777"
            />
          </TouchableOpacity>
        </View>

        {/* ACCOUNT */}

        <Section title="Account">
          <InfoRow
            icon="shield-check-outline"
            label="Account Status"
            value="Active"
            valueStyle={styles.activeText}
            last
          />
        </Section>

        {/* LOGOUT */}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.8}>

          {loggingOut ? (
            <ActivityIndicator color="#D93636" />
          ) : (
            <>
              <MaterialCommunityIcons
                name="logout"
                size={20}
                color="#D93636"
              />

              <Text style={styles.logoutText}>
                Logout
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.footerText}>
          DKD Fruits & Vegetables
        </Text>

        <Text style={styles.versionText}>
          Your trusted fruit partner
        </Text>
      </ScrollView>

      {/* DELIVERY ADDRESS BOTTOM SHEET (shared with Home) */}
      <AddressBottomSheet
        visible={addressSheetVisible}
        onClose={() => setAddressSheetVisible(false)}
        addresses={addresses}
        selectedId={selectedAddressId}
        onChange={handleAddressChange}
      />
    </SafeAreaView>
  );
};

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary,
  },

  scrollContent: {
    paddingBottom: 28,
    backgroundColor: colors.background,
  },

  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 112,
  },

  headerTitle: {
    fontSize: 25,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  headerSubtitle: {
    fontSize: 13,
    color: '#E4F3E8',
    marginTop: 5,
  },

  identityCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: -46,
    borderRadius: 20,
    paddingBottom: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
  },

  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -42,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },

  avatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },

  customerName: {
    fontSize: 21,
    fontWeight: '900',
    color: '#222222',
    marginTop: 12,
  },

  customerEmail: {
    fontSize: 13,
    color: '#777777',
    marginTop: 4,
  },

  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    marginTop: 14,
    gap: 6,
  },

  modeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },

  section: {
    marginTop: 22,
    paddingHorizontal: 20,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#222222',
    marginBottom: 10,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },

  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },

  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EAF5EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  rowContent: {
    flex: 1,
  },

  infoLabel: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '600',
  },

  infoValue: {
    color: '#222222',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
    lineHeight: 20,
  },

  infoMissing: {
    color: '#A0A0A0',
    fontWeight: '500',
  },

  activeText: {
    color: colors.primary,
    fontWeight: '800',
  },

  /* DELIVERY ADDRESS */

  addressSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    marginBottom: 10,
    gap: 4,
  },

  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },

  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },

  addressIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EAF5EC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  addressTextBlock: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },

  addressTitle: {
    color: '#222222',
    fontSize: 14,
    fontWeight: '900',
  },

  addressText: {
    color: '#777777',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  addressCount: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 6,
  },

  /* LOGOUT */

  logoutButton: {
    marginHorizontal: 20,
    marginTop: 28,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#F3C4C4',
    backgroundColor: '#FFF5F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  logoutText: {
    color: '#D93636',
    fontSize: 15,
    fontWeight: '900',
  },

  footerText: {
    textAlign: 'center',
    color: colors.primary,
    fontWeight: '900',
    fontSize: 14,
    marginTop: 24,
  },

  versionText: {
    textAlign: 'center',
    color: '#999999',
    fontSize: 11,
    marginTop: 4,
  },

  /* LOADING AND ERROR */

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    backgroundColor: colors.background,
  },

  stateText: {
    color: '#777777',
    marginTop: 10,
    fontSize: 13,
    textAlign: 'center',
  },

  errorIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#222222',
    marginTop: 16,
  },

  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});

export default ProfileScreen;