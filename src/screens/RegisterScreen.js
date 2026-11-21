
import React, {useEffect, useState} from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  StatusBar,
  Alert,
  PermissionsAndroid,
  KeyboardAvoidingView,
  ActivityIndicator,
  BackHandler,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../data/api';
import Geolocation from 'react-native-geolocation-service';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import colors from '../theme/colors';

const RegisterScreen = ({navigation, route}) => {
  const email = route?.params?.email || '';
  const token = route?.params?.token || '';

  const [isSaving, setIsSaving] = useState(false);

  // Account type dropdown
  const [mode, setMode] = useState('');
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const isBulk = mode === 'Wholesale';

  // Customer details
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Business details
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');

  // Address details
  const [house, setHouse] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState(null);

  const [isLocating, setIsLocating] = useState(false);
  const [errors, setErrors] = useState({});

  // Prevent Android back button from returning to Login.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true,
    );

    return () => subscription.remove();
  }, []);

  // ---------------------------------------------
  // LOCATION PERMISSION
  // ---------------------------------------------

  const requestPermission = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    return result === PermissionsAndroid.RESULTS.GRANTED;
  };

  // ---------------------------------------------
  // GET CURRENT LOCATION
  // ---------------------------------------------

  const getCurrentLocation = async () => {
    if (isLocating) {
      return;
    }

    setIsLocating(true);

    try {
      const allowed = await requestPermission();

      if (!allowed) {
        Alert.alert(
          'Permission Required',
          'Please allow location access to detect your address.',
        );

        setIsLocating(false);
        return;
      }

      Geolocation.getCurrentPosition(
        async position => {
          const {latitude, longitude} = position.coords;

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`,
              {
                headers: {
                  Accept: 'application/json',
                  'User-Agent': 'DKDFruitsMobile/1.0',
                },
              },
            );

            if (!response.ok) {
              throw new Error('Address lookup failed');
            }

            const result = await response.json();

            if (!result.display_name) {
              throw new Error('Address not found');
            }

            setAddress(result.display_name);
            setLocation({latitude, longitude});

            setErrors(previous => ({
              ...previous,
              address: '',
            }));

            Alert.alert(
              'Location Detected',
              'Your delivery address has been filled successfully.',
            );
          } catch (error) {
            Alert.alert(
              'Address Error',
              'Could not convert your location into an address. Please enter it manually.',
            );
          } finally {
            setIsLocating(false);
          }
        },
        error => {
          setIsLocating(false);
          Alert.alert('Location Error', error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 5000,
          showLocationDialog: true,
        },
      );
    } catch (error) {
      setIsLocating(false);
      Alert.alert('Error', 'Unable to get your current location.');
    }
  };

  // ---------------------------------------------
  // UPDATE INPUT FIELDS
  // ---------------------------------------------

  const updateField = (key, value, setter) => {
    setter(value);

    setErrors(previous => ({
      ...previous,
      [key]: '',
    }));
  };

  // ---------------------------------------------
  // REUSABLE INPUT COMPONENT
  // ---------------------------------------------

  const input = (
    label,
    value,
    setter,
    key,
    placeholder,
    options = {},
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        style={[
          styles.input,
          errors[key] && styles.inputError,
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.gray}
        value={value}
        onChangeText={text =>
          updateField(key, text, setter)
        }
        keyboardType={options.keyboardType || 'default'}
        autoCapitalize={options.autoCapitalize || 'words'}
        maxLength={options.maxLength}
        returnKeyType="next"
      />

      {!!errors[key] && (
        <Text style={styles.errorText}>
          {errors[key]}
        </Text>
      )}
    </View>
  );

  // ---------------------------------------------
  // ACCOUNT TYPE SELECTION
  // ---------------------------------------------

  const selectMode = selectedMode => {
    setMode(selectedMode);
    setDropdownVisible(false);

    setErrors(previous => ({
      ...previous,
      mode: '',
    }));

    if (selectedMode === 'Retail') {
      setBusinessName('');
      setBusinessType('');

      setErrors(previous => ({
        ...previous,
        businessName: '',
        businessType: '',
      }));
    }
  };

  // ---------------------------------------------
  // REGISTER CUSTOMER
  // ---------------------------------------------

  const handleRegister = async () => {
    const newErrors = {};

    if (!mode) {
      newErrors.mode = 'Please select your account type.';
    }

    if (!name.trim()) {
      newErrors.name = 'Please enter your full name.';
    }

    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      newErrors.phone = 'Enter a valid 10-digit mobile number.';
    }

    if (isBulk && !businessName.trim()) {
      newErrors.businessName = 'Please enter your business name.';
    }

    if (isBulk && !businessType.trim()) {
      newErrors.businessType = 'Please enter your business type.';
    }

    if (!house.trim()) {
      newErrors.house = 'Enter your house or flat number.';
    }

    if (!address.trim()) {
      newErrors.address = 'Please enter your delivery address.';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    if (!email || !token) {
      Alert.alert(
        'Session Error',
        'Your login session is missing. Please verify your email again.',
      );
      return;
    }

    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const profile = {
        name: name.trim(),
        phone: phone.trim(),

        // Backend accepts only retail or wholesale.
        mode: isBulk ? 'wholesale' : 'retail',

        ...(isBulk && {
          businessName: businessName.trim(),
          businessType: businessType.trim(),
        }),

        address: {
          house: house.trim(),
          fullAddress: address.trim(),
          location: location || null,
        },
      };

      const response = await API.post(
        '/auth/customer/profile',
        profile,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data.success) {
        const savedProfile = response.data.user;

        await AsyncStorage.setItem(
          'dkd_user',
          JSON.stringify({
            email,
            isProfileComplete: true,
            profile: savedProfile,
          }),
        );

        await AsyncStorage.setItem(
          'dkd_mode',
          savedProfile.mode || profile.mode,
        );

        Alert.alert(
          'Profile Saved',
          'Your details have been saved successfully.',
          [
            {
              text: 'Continue',
              onPress: () => {
                navigation.replace('Home', {
                  name: savedProfile.name,
                  email,
                  mode: savedProfile.mode || profile.mode,
                  profile: savedProfile,
                });
              },
            },
          ],
        );
      }
    } catch (error) {
      console.log(
        'CUSTOMER PROFILE SAVE ERROR:',
        error.response?.data || error.message,
      );

      Alert.alert(
        'Registration Failed',
        error.response?.data?.message ||
          'Unable to save your profile. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------------------------------------
  // MAIN UI
  // ---------------------------------------------

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      <StatusBar
        backgroundColor={colors.primary}
        barStyle="light-content"
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* DKD HERO */}

        <View style={styles.hero}>
          <Text style={styles.wordmark}>DKD</Text>

          <Text style={styles.tagline}>
            Fresh fruits. Better living.
          </Text>

          <Text style={styles.since}>
            TRUSTED SINCE 1938
          </Text>
        </View>

        {/* PROFILE FORM */}

        <View style={styles.sheet}>
          <Text style={styles.heading}>
            Complete Your Profile
          </Text>

          <Text style={styles.subheading}>
            Just a few details to get started.
          </Text>

          {/* ACCOUNT TYPE DROPDOWN */}

          <View style={styles.field}>
            <Text style={styles.label}>
              Account Type
            </Text>

            <TouchableOpacity
              style={[
                styles.dropdownButton,
                errors.mode && styles.inputError,
              ]}
              onPress={() =>
                setDropdownVisible(!dropdownVisible)
              }
              activeOpacity={0.8}>

              <View style={styles.dropdownLeft}>
                <MaterialCommunityIcons
                  name="account-group-outline"
                  size={22}
                  color={mode ? colors.primary : colors.gray}
                />

                <Text
                  style={[
                    styles.dropdownText,
                    !mode && styles.dropdownPlaceholder,
                  ]}>
                  {mode || 'Select Retail or Wholesale'}
                </Text>
              </View>

              <MaterialCommunityIcons
                name={
                  dropdownVisible
                    ? 'chevron-up'
                    : 'chevron-down'
                }
                size={24}
                color={colors.primary}
              />
            </TouchableOpacity>

            {dropdownVisible && (
              <View style={styles.dropdownMenu}>
                <TouchableOpacity
                  style={styles.dropdownOption}
                  onPress={() => selectMode('Retail')}
                  activeOpacity={0.8}>

                  <View style={styles.optionIcon}>
                    <MaterialCommunityIcons
                      name="cart-outline"
                      size={23}
                      color={colors.primary}
                    />
                  </View>

                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>
                      Retail
                    </Text>
                    <Text style={styles.optionSubtitle}>
                      For individual customers
                    </Text>
                  </View>

                  {mode === 'Retail' && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={22}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>

                <View style={styles.optionDivider} />

                <TouchableOpacity
                  style={styles.dropdownOption}
                  onPress={() => selectMode('Wholesale')}
                  activeOpacity={0.8}>

                  <View style={styles.optionIcon}>
                    <MaterialCommunityIcons
                      name="store-outline"
                      size={23}
                      color={colors.primary}
                    />
                  </View>

                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>
                      Wholesale
                    </Text>
                    <Text style={styles.optionSubtitle}>
                      For shops, hotels and businesses
                    </Text>
                  </View>

                  {mode === 'Wholesale' && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={22}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              </View>
            )}

            {!!errors.mode && (
              <Text style={styles.errorText}>
                {errors.mode}
              </Text>
            )}
          </View>

          {/* PERSONAL DETAILS */}

          {input(
            'Full Name',
            name,
            setName,
            'name',
            'Enter your full name',
          )}

          {input(
            'Mobile Number',
            phone,
            setPhone,
            'phone',
            '10-digit mobile number',
            {
              keyboardType: 'number-pad',
              autoCapitalize: 'none',
              maxLength: 10,
            },
          )}

          {/* BUSINESS DETAILS - WHOLESALE ONLY */}

          {isBulk && (
            <>
              <View style={styles.addressHeader}>
                <Text style={styles.sectionTitle}>
                  Business Details
                </Text>

                <Text style={styles.optional}>
                  Required for Wholesale Account
                </Text>
              </View>

              {input(
                'Business Name',
                businessName,
                setBusinessName,
                'businessName',
                'Enter your business name',
              )}

              {input(
                'Type of Business',
                businessType,
                setBusinessType,
                'businessType',
                'Example: Restaurant, Hotel, Fruit Shop',
              )}
            </>
          )}

          {/* DELIVERY ADDRESS */}

          <View style={styles.addressHeader}>
            <Text style={styles.sectionTitle}>
              Delivery Address
            </Text>

            {mode ? (
              <Text style={styles.optional}>
                {mode} Account
              </Text>
            ) : null}
          </View>

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
              <View style={styles.locationRow}>
                <MaterialCommunityIcons
                  name="crosshairs-gps"
                  size={20}
                  color={colors.white}
                />

                <Text style={styles.locationText}>
                  Use My Current Location
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* COMPLETE ADDRESS */}

          <View style={styles.field}>
            <Text style={styles.label}>
              Complete Delivery Address
            </Text>

            <TextInput
              style={[
                styles.addressInput,
                errors.address && styles.inputError,
              ]}
              placeholder="Your complete delivery address"
              placeholderTextColor={colors.gray}
              value={address}
              onChangeText={text =>
                updateField('address', text, setAddress)
              }
              multiline
              textAlignVertical="top"
            />

            {!!errors.address && (
              <Text style={styles.errorText}>
                {errors.address}
              </Text>
            )}
          </View>

          {/* SAVE */}

          <TouchableOpacity
            style={[
              styles.submitButton,
              isSaving && styles.disabledButton,
            ]}
            onPress={handleRegister}
            disabled={isSaving}
            activeOpacity={0.85}>

            {isSaving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.submitText}>
                Save & Continue
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footer}>
            © DKD Fruits & Vegetables Pvt. Ltd.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ---------------------------------------------
// STYLES
// ---------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },

  scroll: {
    flexGrow: 1,
  },

  hero: {
    alignItems: 'center',
    paddingTop: 55,
    paddingBottom: 40,
  },

  wordmark: {
    fontSize: 65,
    fontWeight: '900',
    letterSpacing: 5,
    color: colors.white,
  },

  tagline: {
    marginTop: 5,
    fontSize: 17,
    fontWeight: '700',
    color: '#F5D66D',
  },

  since: {
    color: colors.white,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 12,
  },

  sheet: {
    flexGrow: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
  },

  heading: {
    fontSize: 23,
    fontWeight: '800',
    color: colors.black,
  },

  subheading: {
    marginTop: 6,
    marginBottom: 18,
    fontSize: 13,
    color: colors.gray,
  },

  field: {
    marginTop: 14,
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: colors.background,
  },

  addressInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    backgroundColor: colors.background,
    fontSize: 14,
  },

  inputError: {
    borderColor: '#D64545',
  },

  errorText: {
    color: '#D64545',
    fontSize: 12,
    marginTop: 5,
  },

  // ACCOUNT TYPE DROPDOWN

  dropdownButton: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 11,
  },

  dropdownText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },

  dropdownPlaceholder: {
    color: colors.gray,
    fontWeight: '400',
  },

  dropdownMenu: {
    marginTop: 8,
    backgroundColor: colors.white,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 7,
    shadowOffset: {width: 0, height: 3},
  },

  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 14,
  },

  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EAF6ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  optionContent: {
    flex: 1,
  },

  optionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },

  optionSubtitle: {
    fontSize: 11,
    color: colors.gray,
    marginTop: 4,
  },

  optionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 13,
  },

  // ADDRESS

  addressHeader: {
    marginTop: 25,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.black,
  },

  optional: {
    color: colors.gray,
    fontSize: 12,
    marginTop: 5,
  },

  locationButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  locationText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },

  // SUBMIT

  submitButton: {
    height: 54,
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },

  disabledButton: {
    opacity: 0.7,
  },

  submitText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },

  footer: {
    color: colors.gray,
    textAlign: 'center',
    fontSize: 11,
    marginTop: 22,
  },
});

export default RegisterScreen;
