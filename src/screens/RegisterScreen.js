
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

import Geolocation from 'react-native-geolocation-service';
import colors from '../theme/colors';

const RegisterScreen = ({navigation, route}) => {
  const mode = route?.params?.mode || 'Retail';
  const email = route?.params?.email || '';
  const token = route?.params?.token || '';

  // Check whether the selected account is Bulk or Wholesale.
  const isBulk =
    String(mode).toLowerCase() === 'bulk' ||
    String(mode).toLowerCase() === 'wholesale';

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

  const requestPermission = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    return result === PermissionsAndroid.RESULTS.GRANTED;
  };

  // Get current GPS location and convert it into an address.
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

  const updateField = (key, value, setter) => {
    setter(value);

    setErrors(previous => ({
      ...previous,
      [key]: '',
    }));
  };

  // Reusable input component with automatic scrolling.
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
        style={[styles.input, errors[key] && styles.inputError]}
        placeholder={placeholder}
        placeholderTextColor={colors.gray}
        value={value}
        onChangeText={text => updateField(key, text, setter)}
        keyboardType={options.keyboardType || 'default'}
        autoCapitalize={options.autoCapitalize || 'words'}
        maxLength={options.maxLength}
        returnKeyType="next"
      />

      {!!errors[key] && (
        <Text style={styles.errorText}>{errors[key]}</Text>
      )}
    </View>
  );

  // Validate and register customer.
  const handleRegister = () => {
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Please enter your full name.';
    }

    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      newErrors.phone = 'Enter a valid 10-digit mobile number.';
    }

    // Business validation only for Bulk customers.
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

    // Customer profile
    const profile = {
      name: name.trim(),
      email,
      phone: phone.trim(),
      mode,

      // Add business details only for Bulk customers.
      ...(isBulk && {
        businessName: businessName.trim(),
        businessType: businessType.trim(),
      }),

      address: {
        house: house.trim(),
        fullAddress: address.trim(),
        location,
      },

      token,
    };

    // Temporary: connect your backend profile API here.
    console.log('DKD Customer Profile:', profile);

    Alert.alert(
      'Profile Completed',
      'Your details have been successfully entered.',
      [
        {
          text: 'Continue',
          onPress: () => {
            navigation.replace('Home', {
              name: profile.name,
              mode,
              profile,
            });
          },
        },
      ],
    );
  };

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

          {/* BUSINESS DETAILS - BULK CUSTOMERS ONLY */}

          {isBulk && (
            <>
              <View style={styles.addressHeader}>
                <Text style={styles.sectionTitle}>
                  Business Details
                </Text>

                <Text style={styles.optional}>
                  Required for Bulk Account
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

            <Text style={styles.optional}>
              {mode} Account
            </Text>
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
              <Text style={styles.locationText}>
                ◎  Use My Current Location
              </Text>
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
            style={styles.submitButton}
            onPress={handleRegister}
            activeOpacity={0.85}>

            <Text style={styles.submitText}>
              Save & Continue
            </Text>
          </TouchableOpacity>

          <Text style={styles.footer}>
            © DKD Fruits & Vegetables Pvt. Ltd.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

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

  locationText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },

  submitButton: {
    height: 54,
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
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
