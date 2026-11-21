
import React, {useEffect, useState, useCallback, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  PermissionsAndroid,
  ActivityIndicator,
  Modal,
} from 'react-native';

import {SafeAreaView} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Geolocation from 'react-native-geolocation-service';

import API from '../data/api';
import colors from '../theme/colors';

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

  // Saved addresses
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  // Address modal
  const [formVisible, setFormVisible] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);

  // Address form
  const [addressLabel, setAddressLabel] = useState('Home');
  const [house, setHouse] = useState('');
  const [area, setArea] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');

  const [location, setLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [errors, setErrors] = useState({});

  const scrollRef = useRef(null);

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

  const loadAddresses = useCallback(async () => {
    try {
      const [storedAddresses, storedSelectedId, storedUser] =
        await Promise.all([
          AsyncStorage.getItem('dkd_addresses'),
          AsyncStorage.getItem('dkd_selected_address'),
          AsyncStorage.getItem('dkd_user'),
        ]);

      let list = storedAddresses ? JSON.parse(storedAddresses) : [];

      if (!Array.isArray(list)) {
        list = [];
      }

      // Import the registration address if no saved addresses exist.
      if (list.length === 0) {
        let oldAddress = null;

        if (storedUser) {
          const user = JSON.parse(storedUser);
          oldAddress = user.address || user.profile?.address;
        }

        if (!oldAddress && profile?.address) {
          oldAddress = profile.address;
        }

        if (oldAddress) {
          const oldData =
            typeof oldAddress === 'string'
              ? {area: oldAddress}
              : oldAddress;

          const importedAddress = {
            id: `address-${Date.now()}`,
            label: 'Home',
            house: oldData.house || '',
            area: oldData.area || oldData.fullAddress || '',
            landmark: oldData.landmark || '',
            city: oldData.city || '',
            state: oldData.state || '',
            pincode: oldData.pincode || '',
            location: oldData.location || null,
          };

          importedAddress.fullAddress =
            oldData.fullAddress || createFullAddress(importedAddress);

          if (importedAddress.fullAddress) {
            list = [importedAddress];

            await AsyncStorage.setItem(
              'dkd_addresses',
              JSON.stringify(list),
            );
          }
        }
      }

      const selected =
        list.find(item => item.id === storedSelectedId) || list[0];

      setAddresses(list);
      setSelectedAddressId(selected?.id || null);

      if (selected) {
        await AsyncStorage.setItem(
          'dkd_selected_address',
          selected.id,
        );
      } else {
        await AsyncStorage.removeItem('dkd_selected_address');
      }
    } catch (err) {
      console.log('ADDRESS LOAD ERROR:', err.message);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      loadAddresses();
    }
  }, [profile, loadAddresses]);

  /* ---------------- SAVE ADDRESS LIST ---------------- */

  const saveAddressList = async (updated, selectedId) => {
    try {
      await AsyncStorage.setItem(
        'dkd_addresses',
        JSON.stringify(updated),
      );

      if (selectedId) {
        await AsyncStorage.setItem(
          'dkd_selected_address',
          selectedId,
        );
      } else {
        await AsyncStorage.removeItem('dkd_selected_address');
      }

      setAddresses(updated);
      setSelectedAddressId(selectedId || null);

      return true;
    } catch (err) {
      console.log('ADDRESS SAVE ERROR:', err.message);
      Alert.alert('Error', 'Unable to save address details.');
      return false;
    }
  };

  /* ---------------- LOCATION PERMISSION ---------------- */

  const requestPermission = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    return result === PermissionsAndroid.RESULTS.GRANTED;
  };

  /* ---------------- CURRENT LOCATION ---------------- */

  const getCurrentLocation = async () => {
    if (isLocating) return;

    setIsLocating(true);

    try {
      const allowed = await requestPermission();

      if (!allowed) {
        Alert.alert(
          'Permission Required',
          'Allow location access to detect your delivery address.',
        );
        setIsLocating(false);
        return;
      }

      Geolocation.getCurrentPosition(
        async position => {
          const {latitude, longitude} = position.coords;

          setLocation({latitude, longitude});

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`,
              {
                headers: {
                  Accept: 'application/json',
                  'User-Agent': 'DKDFruitsMobilePrototype/1.0',
                },
              },
            );

            if (!response.ok) {
              throw new Error('Address lookup failed');
            }

            const result = await response.json();
            const a = result.address || {};

            setArea(
              a.neighbourhood ||
                a.suburb ||
                a.residential ||
                a.road ||
                a.village ||
                '',
            );

            setCity(
              a.city ||
                a.town ||
                a.village ||
                a.municipality ||
                '',
            );

            setState(a.state || '');
            setPincode(a.postcode || '');

            setErrors(previous => ({
              ...previous,
              area: '',
              city: '',
              state: '',
              pincode: '',
            }));

            Alert.alert(
              'Location Detected',
              'Address detected. Please enter your house or flat number.',
            );
          } catch (err) {
            Alert.alert(
              'Address Error',
              'GPS detected, but address lookup failed. Enter the address manually.',
            );
          } finally {
            setIsLocating(false);
          }
        },
        err => {
          setIsLocating(false);
          Alert.alert('Location Error', err.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 5000,
          showLocationDialog: true,
        },
      );
    } catch (err) {
      setIsLocating(false);
      Alert.alert('Error', 'Unable to get your location.');
    }
  };

  /* ---------------- FORM HELPERS ---------------- */

  const updateField = (key, value, setter) => {
    setter(value);

    setErrors(previous => ({
      ...previous,
      [key]: '',
    }));
  };

  const input = (
    label,
    value,
    setter,
    key,
    placeholder,
    options = {},
  ) => (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{label}</Text>

      <TextInput
        style={[
          styles.input,
          errors[key] && styles.inputError,
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.gray}
        value={value}
        onChangeText={text => updateField(key, text, setter)}
        keyboardType={options.keyboardType || 'default'}
        autoCapitalize={options.autoCapitalize || 'words'}
        maxLength={options.maxLength}
        returnKeyType="next"
        onFocus={() => {
          setTimeout(() => {
            scrollRef.current?.scrollToEnd({animated: true});
          }, 150);
        }}
      />

      {!!errors[key] && (
        <Text style={styles.errorText}>{errors[key]}</Text>
      )}
    </View>
  );

  const resetAddressForm = () => {
    setEditingAddressId(null);
    setAddressLabel('Home');
    setHouse('');
    setArea('');
    setLandmark('');
    setCity('');
    setState('');
    setPincode('');
    setLocation(null);
    setErrors({});
  };

  /* ---------------- ADD ADDRESS ---------------- */

  const openAddAddress = () => {
    resetAddressForm();
    setFormVisible(true);
  };

  /* ---------------- EDIT ADDRESS ---------------- */

  const openEditAddress = item => {
    setEditingAddressId(item.id);
    setAddressLabel(item.label || 'Home');

    setHouse(item.house || '');
    setArea(item.area || '');
    setLandmark(item.landmark || '');
    setCity(item.city || '');
    setState(item.state || '');
    setPincode(item.pincode || '');
    setLocation(item.location || null);

    // Compatibility with older saved addresses.
    if (
      !item.house &&
      !item.area &&
      item.fullAddress
    ) {
      setArea(item.fullAddress);
    }

    setErrors({});
    setFormVisible(true);
  };

  /* ---------------- VALIDATE AND SAVE ---------------- */

  const handleSaveAddress = async () => {
    const newErrors = {};

    if (!house.trim()) {
      newErrors.house = 'Enter house / flat number.';
    }

    if (!area.trim()) {
      newErrors.area = 'Enter your area.';
    }

    if (!city.trim()) {
      newErrors.city = 'Enter your city.';
    }

    if (!state.trim()) {
      newErrors.state = 'Enter your state.';
    }

    if (!/^[1-9]\d{5}$/.test(pincode.trim())) {
      newErrors.pincode = 'Enter a valid 6-digit PIN code.';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    const addressData = {
      id: editingAddressId || `address-${Date.now()}`,
      label: addressLabel,
      house: house.trim(),
      area: area.trim(),
      landmark: landmark.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      location,
    };

    addressData.fullAddress = createFullAddress(addressData);

    let updated;
    let selectedId = selectedAddressId;

    if (editingAddressId) {
      updated = addresses.map(item =>
        item.id === editingAddressId ? addressData : item,
      );
    } else {
      updated = [...addresses, addressData];
      selectedId = addressData.id;
    }

    const saved = await saveAddressList(updated, selectedId);

    if (!saved) return;

    setFormVisible(false);
    resetAddressForm();

    Alert.alert(
      'Success',
      editingAddressId
        ? 'Address updated successfully.'
        : 'New address added successfully.',
    );
  };

  /* ---------------- SET DEFAULT ---------------- */

  const handleSelectAddress = async item => {
    const saved = await saveAddressList(addresses, item.id);

    if (saved) {
      Alert.alert(
        'Default Address Updated',
        `${item.label} is now your default delivery address.`,
      );
    }
  };

  /* ---------------- DELETE ADDRESS ---------------- */

  const handleDeleteAddress = item => {
    Alert.alert(
      'Delete Address',
      `Are you sure you want to delete your ${item.label} address?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = addresses.filter(
              address => address.id !== item.id,
            );

            let selectedId = selectedAddressId;

            if (selectedAddressId === item.id) {
              selectedId = updated[0]?.id || null;
            }

            await saveAddressList(updated, selectedId);
          },
        },
      ],
    );
  };

  /* ---------------- LOGOUT ---------------- */

  const performLogout = async () => {
    try {
      setLoggingOut(true);

      await AsyncStorage.multiRemove([
        'dkd_token',
        'dkd_user',
        'dkd_mode',
        'dkd_addresses',
        'dkd_selected_address',
      ]);

      navigation.getParent()?.reset({
        index: 0,
        routes: [{name: 'Login'}],
      });
    } catch (err) {
      console.log('LOGOUT ERROR:', err.message);

      Alert.alert(
        'Error',
        'Unable to logout. Please try again.',
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

  const selectedAddress = addresses.find(
    item => item.id === selectedAddressId,
  );

  /* ---------------- LOADING ---------------- */

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar
          backgroundColor={colors.primary}
          barStyle="light-content"
        />

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
        <StatusBar
          backgroundColor={colors.primary}
          barStyle="light-content"
        />

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
      <StatusBar
        backgroundColor={colors.primary}
        barStyle="light-content"
      />

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

        {/* DELIVERY ADDRESSES */}

        <View style={styles.section}>
          <View style={styles.addressSectionHeader}>
            <Text style={styles.sectionTitle}>
              Delivery Addresses
            </Text>

            <TouchableOpacity
              style={styles.addButton}
              onPress={openAddAddress}>
              <MaterialCommunityIcons
                name="plus"
                size={18}
                color="#FFFFFF"
              />

              <Text style={styles.addButtonText}>
                Add New
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {addresses.length === 0 ? (
              <View style={styles.emptyAddress}>
                <MaterialCommunityIcons
                  name="map-marker-off-outline"
                  size={36}
                  color="#999999"
                />

                <Text style={styles.emptyAddressTitle}>
                  No addresses saved
                </Text>

                <Text style={styles.emptyAddressText}>
                  Add a delivery address to make ordering easier.
                </Text>

                <TouchableOpacity
                  style={styles.emptyAddButton}
                  onPress={openAddAddress}>
                  <Text style={styles.emptyAddButtonText}>
                    Add Delivery Address
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              addresses.map((item, index) => {
                const isSelected =
                  item.id === selectedAddressId;

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.addressItem,
                      index !== addresses.length - 1 &&
                        styles.addressDivider,
                    ]}>

                    <TouchableOpacity
                      style={styles.addressSelectArea}
                      onPress={() => handleSelectAddress(item)}
                      activeOpacity={0.7}>

                      <View style={styles.addressIcon}>
                        <MaterialCommunityIcons
                          name={
                            item.label === 'Work'
                              ? 'briefcase-outline'
                              : item.label === 'Other'
                              ? 'map-marker-outline'
                              : 'home-outline'
                          }
                          size={22}
                          color={colors.primary}
                        />
                      </View>

                      <View style={styles.addressInfo}>
                        <View style={styles.addressTitleRow}>
                          <Text style={styles.addressLabel}>
                            {item.label}
                          </Text>

                          {isSelected && (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>
                                DEFAULT
                              </Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.addressText}>
                          {item.fullAddress ||
                            createFullAddress(item)}
                        </Text>
                      </View>

                      <MaterialCommunityIcons
                        name={
                          isSelected
                            ? 'check-circle'
                            : 'circle-outline'
                        }
                        size={22}
                        color={
                          isSelected
                            ? colors.primary
                            : '#BBBBBB'
                        }
                      />
                    </TouchableOpacity>

                    <View style={styles.addressActions}>
                      {!isSelected && (
                        <TouchableOpacity
                          onPress={() => handleSelectAddress(item)}
                          style={styles.addressActionButton}>
                          <Text style={styles.defaultActionText}>
                            Set Default
                          </Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        onPress={() => openEditAddress(item)}
                        style={styles.addressActionButton}>
                        <MaterialCommunityIcons
                          name="pencil-outline"
                          size={15}
                          color={colors.primary}
                        />

                        <Text style={styles.addressActionText}>
                          Edit
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleDeleteAddress(item)}
                        style={styles.addressActionButton}>
                        <MaterialCommunityIcons
                          name="delete-outline"
                          size={16}
                          color="#D93636"
                        />

                        <Text style={styles.deleteActionText}>
                          Delete
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
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

      {/* ---------------- ADDRESS FORM MODAL ---------------- */}

      <Modal
        visible={formVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFormVisible(false)}>

        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingAddressId
                    ? 'Edit Address'
                    : 'Add New Address'}
                </Text>

                <Text style={styles.modalSubtitle}>
                  Enter your complete delivery details
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setFormVisible(false)}
                style={styles.closeButton}>
                <MaterialCommunityIcons
                  name="close"
                  size={23}
                  color="#333333"
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.formContent}>

              {/* ADDRESS LABEL */}

              <Text style={styles.inputLabel}>
                Save Address As
              </Text>

              <View style={styles.labelOptions}>
                {['Home', 'Work', 'Other'].map(label => (
                  <TouchableOpacity
                    key={label}
                    style={[
                      styles.labelOption,
                      addressLabel === label &&
                        styles.labelOptionActive,
                    ]}
                    onPress={() => setAddressLabel(label)}>

                    <MaterialCommunityIcons
                      name={
                        label === 'Home'
                          ? 'home-outline'
                          : label === 'Work'
                          ? 'briefcase-outline'
                          : 'map-marker-outline'
                      }
                      size={18}
                      color={
                        addressLabel === label
                          ? colors.primary
                          : '#777777'
                      }
                    />

                    <Text
                      style={[
                        styles.labelOptionText,
                        addressLabel === label &&
                          styles.labelOptionTextActive,
                      ]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* HOUSE */}

              {input(
                'House / Flat / Building Number',
                house,
                setHouse,
                'house',
                'Enter house or flat number',
              )}

              {/* CURRENT LOCATION */}

              <TouchableOpacity
                style={styles.locationButton}
                onPress={getCurrentLocation}
                disabled={isLocating}
                activeOpacity={0.85}>

                {isLocating ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="crosshairs-gps"
                      size={20}
                      color={colors.white}
                    />

                    <Text style={styles.locationText}>
                      Use My Current Location
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* AREA */}

              {input(
                'Area / Street',
                area,
                setArea,
                'area',
                'Enter area or street',
              )}

              {/* LANDMARK */}

              {input(
                'Landmark (Optional)',
                landmark,
                setLandmark,
                'landmark',
                'Nearby landmark',
              )}

              {/* CITY */}

              {input(
                'City',
                city,
                setCity,
                'city',
                'Enter city',
              )}

              {/* STATE */}

              {input(
                'State',
                state,
                setState,
                'state',
                'Enter state',
              )}

              {/* PINCODE */}

              {input(
                'PIN Code',
                pincode,
                setPincode,
                'pincode',
                '6-digit PIN code',
                {
                  keyboardType: 'number-pad',
                  autoCapitalize: 'none',
                  maxLength: 6,
                },
              )}

              {/* SAVE BUTTON */}

              <TouchableOpacity
                style={styles.saveAddressButton}
                onPress={handleSaveAddress}
                activeOpacity={0.85}>

                <Text style={styles.saveAddressButtonText}>
                  {editingAddressId
                    ? 'Update Address'
                    : 'Save Address'}
                </Text>
              </TouchableOpacity>

              <View style={{height: 25}} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  /* ADDRESS LIST */

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

  addressItem: {
    paddingVertical: 15,
  },

  addressDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },

  addressSelectArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  addressIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EAF5EC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  addressInfo: {
    flex: 1,
    marginRight: 8,
  },

  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },

  addressLabel: {
    color: '#222222',
    fontSize: 14,
    fontWeight: '900',
  },

  defaultBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },

  defaultBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.primary,
  },

  addressText: {
    fontSize: 12,
    color: '#777777',
    lineHeight: 18,
    marginTop: 5,
  },

  addressActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 10,
    gap: 16,
  },

  addressActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  addressActionText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '800',
  },

  defaultActionText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '800',
  },

  deleteActionText: {
    fontSize: 12,
    color: '#D93636',
    fontWeight: '800',
  },

  emptyAddress: {
    alignItems: 'center',
    paddingVertical: 28,
  },

  emptyAddressTitle: {
    fontSize: 15,
    color: '#333333',
    fontWeight: '900',
    marginTop: 9,
  },

  emptyAddressText: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'center',
    marginTop: 5,
  },

  emptyAddButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    marginTop: 16,
  },

  emptyAddButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },

  /* ADDRESS MODAL */

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },

  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 22,
    paddingTop: 22,
    maxHeight: '92%',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },

  modalTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: colors.black,
  },

  modalSubtitle: {
    color: colors.gray,
    fontSize: 12,
    marginTop: 5,
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F1F1',
    justifyContent: 'center',
    alignItems: 'center',
  },

  formContent: {
    paddingBottom: 15,
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },

  labelOptions: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 8,
  },

  labelOption: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },

  labelOptionActive: {
    backgroundColor: '#E8F5E9',
    borderColor: colors.primary,
  },

  labelOptionText: {
    color: '#777777',
    fontWeight: '700',
    fontSize: 12,
  },

  labelOptionTextActive: {
    color: colors.primary,
    fontWeight: '900',
  },

  field: {
    marginTop: 14,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: colors.background,
    fontSize: 14,
  },

  inputError: {
    borderColor: '#D93636',
  },

  errorText: {
    color: '#D93636',
    fontSize: 11,
    marginTop: 5,
  },

  locationButton: {
    backgroundColor: colors.primary,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
    marginTop: 17,
  },

  locationText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },

  saveAddressButton: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },

  saveAddressButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
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
