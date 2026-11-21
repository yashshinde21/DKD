import React, {useState, useEffect, useRef} from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';

import Geolocation from 'react-native-geolocation-service';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import colors from '../theme/colors';
import {
  ADDRESS_LABELS,
  buildFullAddress,
  createAddressId,
  reverseGeocode,
  saveAddresses,
  saveSelectedAddressId,
} from '../utils/addressHelpers';

/* ---------------- CONSTANTS ---------------- */

const DANGER = '#D92D20';

const LABEL_ICONS = {
  Home: 'home-outline',
  Work: 'briefcase-outline',
  Other: 'map-marker-outline',
};

const EMPTY_FORM = {
  label: 'Home',
  house: '',
  area: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  location: null,
};

const validateForm = form => {
  const errors = {};

  if (!form.house.trim()) {
    errors.house = 'Enter your house / flat / building number';
  }
  if (!form.area.trim()) {
    errors.area = 'Enter your area or street';
  }
  if (!form.city.trim()) {
    errors.city = 'Enter your city';
  }
  if (!form.state.trim()) {
    errors.state = 'Enter your state';
  }
  if (!/^\d{6}$/.test(form.pincode.trim())) {
    errors.pincode = 'PIN code must be exactly 6 digits';
  }

  return errors;
};

/* ---------------- LOCATION HELPERS ---------------- */

// Returns 'granted' | 'denied' | 'blocked'
const requestLocationPermission = async () => {
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location permission',
        message:
          'DKD Fruits needs your location to fill in your delivery address.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      },
    );

    if (result === PermissionsAndroid.RESULTS.GRANTED) {
      return 'granted';
    }
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      return 'blocked';
    }
    return 'denied';
  }

  const status = await Geolocation.requestAuthorization('whenInUse');

  if (status === 'granted') {
    return 'granted';
  }
  return status === 'denied' ? 'denied' : 'blocked';
};

const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
      forceRequestLocation: true,
      showLocationDialog: true,
    });
  });

const describeLocationError = error => {
  const code = error && error.code;
  const message = String((error && error.message) || '');

  // react-native-geolocation-service error codes
  if (code === 1) {
    return 'Location permission was denied. Please allow it or enter the address manually.';
  }
  if (code === 2) {
    return 'Your location is unavailable right now. Please try again or enter the address manually.';
  }
  if (code === 3) {
    return 'Getting your location timed out. Move to an open area and try again.';
  }
  if (code === 4) {
    return 'Google Play services is required to detect your location.';
  }
  if (code === 5) {
    return 'Please turn on device location (GPS) and try again.';
  }
  if (error && error.name === 'AbortError') {
    return 'Looking up your address timed out. Check your connection and try again.';
  }
  if (
    message.includes('Network request failed') ||
    message.includes('GEOCODE_HTTP')
  ) {
    return 'Could not look up your address. Check your internet connection and try again.';
  }
  if (message.includes('GEOCODE_EMPTY')) {
    return 'We could not find an address for this spot. Please enter it manually.';
  }

  return 'Unable to detect your location. Please enter the address manually.';
};

/* ---------------- COMPONENT ---------------- */

const AddressBottomSheet = ({
  visible,
  onClose,
  addresses,
  selectedId,
  onChange,
}) => {
  const {height} = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Sheet animation.
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(height)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // 'list' | 'form' | 'confirm'
  const [mode, setMode] = useState('list');
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Form state.
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState(null);
  const locationRequest = useRef(0);

  // Toast.
  const [toast, setToast] = useState({text: '', type: 'success'});
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef(null);

  // Refs to move between fields with the keyboard "next" button.
  const areaRef = useRef(null);
  const landmarkRef = useRef(null);
  const cityRef = useRef(null);
  const stateRef = useRef(null);
  const pincodeRef = useRef(null);

  /* ----- open / close animation ----- */

  useEffect(() => {
    if (visible) {
      setMode('list');
      setDeleteTarget(null);
      setFormError('');
      toastOpacity.setValue(0);
      setMounted(true);
    } else if (mounted) {
      Keyboard.dismiss();
      locationRequest.current += 1;

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: height,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(({finished}) => {
        if (finished) {
          setMounted(false);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (mounted && visible) {
      translateY.setValue(height);
      backdropOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, visible]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* ----- small helpers ----- */

  const showToast = (message, type = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({text: message, type});

    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    toastTimer.current = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }, 2300);
  };

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const backToList = () => {
    Keyboard.dismiss();
    locationRequest.current += 1;
    setLocating(false);
    setDeleteTarget(null);
    setMode('list');
  };

  // Android hardware back button.
  const handleBack = () => {
    if (mode === 'list') {
      handleClose();
    } else {
      backToList();
    }
  };

  const updateField = (key, value) => {
    setForm(previous => ({...previous, [key]: value}));

    if (errors[key]) {
      setErrors(previous => {
        const next = {...previous};
        delete next[key];
        return next;
      });
    }
  };

  /* ----- list actions ----- */

  const openAddForm = () => {
    locationRequest.current += 1;
    setLocating(false);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormError('');
    setLocationMessage(null);
    setEditingId(null);
    setMode('form');
  };

  const openEditForm = address => {
    const hasParts = address.house || address.area;

    locationRequest.current += 1;
    setLocating(false);
    setForm({
      label: address.label,
      house: address.house || '',
      // Old addresses only have one text line: show it in the Area field.
      area: hasParts ? address.area || '' : address.fullAddress,
      landmark: address.landmark || '',
      city: address.city || '',
      state: address.state || '',
      pincode: address.pincode || '',
      location: address.location || null,
    });
    setErrors({});
    setFormError('');
    setLocationMessage(null);
    setEditingId(address.id);
    setMode('form');
  };

  const selectAddress = async address => {
    try {
      await saveSelectedAddressId(address.id);
      onChange(addresses, address.id);
      handleClose();
    } catch (error) {
      showToast('Could not select this address', 'error');
    }
  };

  const askDelete = address => {
    Keyboard.dismiss();
    setDeleteTarget(address);
    setMode('confirm');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      const updated = addresses.filter(item => item.id !== deleteTarget.id);
      let nextSelected = selectedId;

      if (selectedId === deleteTarget.id) {
        nextSelected = updated.length > 0 ? updated[0].id : null;
      }

      await saveAddresses(updated);
      await saveSelectedAddressId(nextSelected);

      onChange(updated, nextSelected);
      setDeleteTarget(null);
      setMode('list');
      showToast('Address deleted');
    } catch (error) {
      setDeleteTarget(null);
      setMode('list');
      showToast('Could not delete address', 'error');
    }
  };

  /* ----- current location ----- */

  const handleUseLocation = async () => {
    if (locating) {
      return;
    }

    Keyboard.dismiss();
    locationRequest.current += 1;
    const requestId = locationRequest.current;

    setLocating(true);
    setLocationMessage(null);

    try {
      const permission = await requestLocationPermission();

      if (requestId !== locationRequest.current) {
        return;
      }

      if (permission === 'denied') {
        setLocationMessage({
          type: 'error',
          text: 'Location permission was denied. Allow it to use this feature, or enter the address manually.',
        });
        return;
      }

      if (permission === 'blocked') {
        setLocationMessage({
          type: 'error',
          text: 'Location access is turned off for DKD Fruits. Enable it in your phone settings, or enter the address manually.',
        });
        return;
      }

      const position = await getCurrentPosition();

      if (requestId !== locationRequest.current) {
        return;
      }

      const {latitude, longitude} = position.coords;
      const found = await reverseGeocode(latitude, longitude);

      if (requestId !== locationRequest.current) {
        return;
      }

      setForm(previous => ({
        ...previous,
        area: found.area || previous.area,
        city: found.city || previous.city,
        state: found.state || previous.state,
        pincode: found.pincode || previous.pincode,
        location: {latitude, longitude},
      }));

      setErrors(previous => {
        const next = {...previous};
        ['area', 'city', 'state', 'pincode'].forEach(key => {
          if (found[key]) {
            delete next[key];
          }
        });
        return next;
      });

      setLocationMessage({
        type: 'success',
        text: 'Location detected. Please check the details below.',
      });
    } catch (error) {
      if (requestId === locationRequest.current) {
        setLocationMessage({
          type: 'error',
          text: describeLocationError(error),
        });
      }
    } finally {
      if (requestId === locationRequest.current) {
        setLocating(false);
      }
    }
  };

  /* ----- save ----- */

  const handleSave = async () => {
    Keyboard.dismiss();

    const found = validateForm(form);
    setErrors(found);
    setFormError('');

    if (Object.keys(found).length > 0) {
      return;
    }

    setSaving(true);

    try {
      const details = {
        label: form.label,
        house: form.house.trim(),
        area: form.area.trim(),
        landmark: form.landmark.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        location: form.location || null,
      };

      const fullAddress = buildFullAddress(details);

      let updated;
      let nextSelected = selectedId;

      if (editingId) {
        updated = addresses.map(item =>
          item.id === editingId ? {...item, ...details, fullAddress} : item,
        );
      } else {
        const created = {id: createAddressId(), ...details, fullAddress};
        updated = [...addresses, created];
        nextSelected = created.id;
      }

      await saveAddresses(updated);

      if (nextSelected !== selectedId) {
        await saveSelectedAddressId(nextSelected);
      }

      onChange(updated, nextSelected);

      setForm(EMPTY_FORM);
      setEditingId(null);
      setLocationMessage(null);
      setMode('list');
      showToast(editingId ? 'Address updated' : 'Address saved and selected');
    } catch (error) {
      setFormError('Could not save the address. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /* ----- render helpers ----- */

  const renderCard = address => {
    const selected = address.id === selectedId;

    return (
      <TouchableOpacity
        key={address.id}
        style={[styles.card, selected && styles.cardSelected]}
        activeOpacity={0.9}
        onPress={() => selectAddress(address)}>
        <View style={styles.cardTop}>
          <View style={[styles.cardIcon, selected && styles.cardIconSelected]}>
            <MaterialCommunityIcons
              name={LABEL_ICONS[address.label] || 'map-marker-outline'}
              size={22}
              color={colors.primary}
            />
          </View>

          <View style={styles.cardDetails}>
            <View style={styles.cardLabelRow}>
              <Text style={styles.cardLabel}>{address.label}</Text>

              {selected && (
                <View style={styles.cardPill}>
                  <Text style={styles.cardPillText}>DELIVERING HERE</Text>
                </View>
              )}
            </View>

            <Text style={styles.cardAddress} numberOfLines={3}>
              {address.fullAddress}
            </Text>
          </View>

          <MaterialCommunityIcons
            name={selected ? 'check-circle' : 'circle-outline'}
            size={24}
            color={selected ? colors.primary : '#C4C9C4'}
          />
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.cardAction}
            onPress={() => openEditForm(address)}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <MaterialCommunityIcons
              name="pencil-outline"
              size={17}
              color={colors.primary}
            />
            <Text style={styles.cardActionText}>Edit</Text>
          </TouchableOpacity>

          <View style={styles.cardActionDivider} />

          <TouchableOpacity
            style={styles.cardAction}
            onPress={() => askDelete(address)}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={17}
              color={DANGER}
            />
            <Text style={[styles.cardActionText, {color: DANGER}]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderListBody = () =>
    addresses.length === 0 ? (
      <View style={styles.emptyCard}>
        <View style={styles.emptyIcon}>
          <MaterialCommunityIcons
            name="map-marker-plus-outline"
            size={34}
            color={colors.primary}
          />
        </View>
        <Text style={styles.emptyTitle}>No saved addresses yet</Text>
        <Text style={styles.emptyText}>
          Add your delivery address to see delivery details and place orders.
        </Text>
      </View>
    ) : (
      addresses.map(renderCard)
    );

  const renderConfirmBody = () => (
    <View style={styles.confirmWrap}>
      <View style={styles.confirmIcon}>
        <MaterialCommunityIcons
          name="trash-can-outline"
          size={30}
          color={DANGER}
        />
      </View>

      <Text style={styles.confirmTitle}>Delete this address?</Text>
      <Text style={styles.confirmText}>
        This address will be removed from your saved addresses.
      </Text>

      {deleteTarget && (
        <View style={styles.confirmPreview}>
          <Text style={styles.cardLabel}>{deleteTarget.label}</Text>
          <Text style={styles.cardAddress} numberOfLines={3}>
            {deleteTarget.fullAddress}
          </Text>
        </View>
      )}

      <View style={styles.confirmButtons}>
        <TouchableOpacity
          style={styles.confirmCancel}
          activeOpacity={0.85}
          onPress={backToList}>
          <Text style={styles.confirmCancelText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.confirmDelete}
          activeOpacity={0.85}
          onPress={confirmDelete}>
          <Text style={styles.confirmDeleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderError = key =>
    errors[key] ? <Text style={styles.errorText}>{errors[key]}</Text> : null;

  const renderFormBody = () => (
    <View>
      {/* 1. HOUSE / FLAT / BUILDING */}
      <Text style={styles.fieldLabel}>House / Flat / Building Number *</Text>
      <TextInput
        style={[styles.input, errors.house && styles.inputError]}
        placeholder="e.g. Flat 101, Sunrise Apartments"
        placeholderTextColor="#9AA09A"
        value={form.house}
        onChangeText={value => updateField('house', value)}
        returnKeyType="next"
        onSubmitEditing={() => areaRef.current?.focus()}
        blurOnSubmit={false}
      />
      {renderError('house')}

      {/* 2. USE MY CURRENT LOCATION */}
      <TouchableOpacity
        style={[styles.locationButton, locating && styles.locationButtonBusy]}
        activeOpacity={0.85}
        onPress={handleUseLocation}
        disabled={locating}>
        {locating ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <MaterialCommunityIcons
            name="crosshairs-gps"
            size={20}
            color={colors.primary}
          />
        )}
        <Text style={styles.locationButtonText}>
          {locating ? 'Detecting your location…' : 'Use My Current Location'}
        </Text>
      </TouchableOpacity>

      {locationMessage && (
        <View style={styles.locationMessageRow}>
          <MaterialCommunityIcons
            name={
              locationMessage.type === 'success'
                ? 'check-circle-outline'
                : 'alert-circle-outline'
            }
            size={16}
            color={locationMessage.type === 'success' ? colors.primary : DANGER}
          />
          <Text
            style={[
              styles.locationMessageText,
              {
                color:
                  locationMessage.type === 'success' ? colors.primary : DANGER,
              },
            ]}>
            {locationMessage.text}
          </Text>
        </View>
      )}

      {/* 3. AREA / STREET */}
      <Text style={styles.fieldLabel}>Area / Street *</Text>
      <TextInput
        ref={areaRef}
        style={[styles.input, errors.area && styles.inputError]}
        placeholder="e.g. Main Street, Andheri West"
        placeholderTextColor="#9AA09A"
        value={form.area}
        onChangeText={value => updateField('area', value)}
        returnKeyType="next"
        onSubmitEditing={() => landmarkRef.current?.focus()}
        blurOnSubmit={false}
      />
      {renderError('area')}

      {/* 4. LANDMARK */}
      <Text style={styles.fieldLabel}>Landmark (Optional)</Text>
      <TextInput
        ref={landmarkRef}
        style={styles.input}
        placeholder="e.g. Near City Market"
        placeholderTextColor="#9AA09A"
        value={form.landmark}
        onChangeText={value => updateField('landmark', value)}
        returnKeyType="next"
        onSubmitEditing={() => cityRef.current?.focus()}
        blurOnSubmit={false}
      />

      {/* 5. CITY */}
      <Text style={styles.fieldLabel}>City *</Text>
      <TextInput
        ref={cityRef}
        style={[styles.input, errors.city && styles.inputError]}
        placeholder="e.g. Mumbai"
        placeholderTextColor="#9AA09A"
        value={form.city}
        onChangeText={value => updateField('city', value)}
        returnKeyType="next"
        onSubmitEditing={() => stateRef.current?.focus()}
        blurOnSubmit={false}
      />
      {renderError('city')}

      {/* 6. STATE */}
      <Text style={styles.fieldLabel}>State *</Text>
      <TextInput
        ref={stateRef}
        style={[styles.input, errors.state && styles.inputError]}
        placeholder="e.g. Maharashtra"
        placeholderTextColor="#9AA09A"
        value={form.state}
        onChangeText={value => updateField('state', value)}
        returnKeyType="next"
        onSubmitEditing={() => pincodeRef.current?.focus()}
        blurOnSubmit={false}
      />
      {renderError('state')}

      {/* 7. PIN CODE */}
      <Text style={styles.fieldLabel}>PIN Code *</Text>
      <TextInput
        ref={pincodeRef}
        style={[styles.input, errors.pincode && styles.inputError]}
        placeholder="6-digit PIN code"
        placeholderTextColor="#9AA09A"
        value={form.pincode}
        onChangeText={value =>
          updateField('pincode', value.replace(/\D/g, '').slice(0, 6))
        }
        keyboardType="number-pad"
        maxLength={6}
        returnKeyType="done"
      />
      {renderError('pincode')}

      {/* ADDRESS TYPE */}
      <Text style={[styles.fieldLabel, {marginTop: 20}]}>Save address as</Text>
      <View style={styles.typeRow}>
        {ADDRESS_LABELS.map(label => {
          const active = form.label === label;

          return (
            <TouchableOpacity
              key={label}
              style={[styles.typeChip, active && styles.typeChipActive]}
              activeOpacity={0.85}
              onPress={() => updateField('label', label)}>
              <MaterialCommunityIcons
                name={LABEL_ICONS[label]}
                size={18}
                color={active ? colors.primary : colors.gray}
              />
              <Text
                style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {formError ? (
        <Text style={[styles.errorText, {marginTop: 14}]}>{formError}</Text>
      ) : null}
    </View>
  );

  /* ----- header text per mode ----- */

  let title = 'Select Delivery Address';
  let subtitle = 'Choose where you want your order delivered.';

  if (mode === 'form') {
    title = editingId ? 'Edit Address' : 'Add New Address';
    subtitle = 'Enter your delivery details below.';
  } else if (mode === 'confirm') {
    title = 'Delete Address';
    subtitle = 'Please confirm to continue.';
  }

  const footerPadding = Math.max(insets.bottom, 14) + 4;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleBack}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* DIMMED BACKDROP */}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.backdrop, {opacity: backdropOpacity}]}>
          <Pressable style={styles.backdropPress} onPress={handleClose} />
        </Animated.View>

        {/* SHEET */}
        <Animated.View
          style={[
            styles.sheet,
            {maxHeight: height * 0.88, transform: [{translateY}]},
          ]}>
          <View style={styles.handle} />

          {/* HEADER */}
          <View style={styles.header}>
            {mode !== 'list' && (
              <TouchableOpacity
                style={styles.headerBack}
                onPress={backToList}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={22}
                  color="#222222"
                />
              </TouchableOpacity>
            )}

            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <MaterialCommunityIcons name="close" size={22} color="#333333" />
            </TouchableOpacity>
          </View>

          {/* BODY */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {mode === 'list' && renderListBody()}
            {mode === 'form' && renderFormBody()}
            {mode === 'confirm' && renderConfirmBody()}
          </ScrollView>

          {/* FOOTER */}
          {mode === 'list' && (
            <View style={[styles.footer, {paddingBottom: footerPadding}]}>
              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.85}
                onPress={openAddForm}>
                <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Add New Address</Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'form' && (
            <View style={[styles.footer, {paddingBottom: footerPadding}]}>
              <TouchableOpacity
                style={[styles.primaryButton, saving && styles.primaryButtonBusy]}
                activeOpacity={0.85}
                onPress={handleSave}
                disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {editingId ? 'Update Address' : 'Save Address'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {mode === 'confirm' && <View style={{height: footerPadding}} />}

          {/* TOAST */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.toast,
              toast.type === 'error' && styles.toastError,
              {opacity: toastOpacity, bottom: footerPadding + 64},
            ]}>
            <MaterialCommunityIcons
              name={toast.type === 'error' ? 'alert-circle' : 'check-circle'}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.toastText}>{toast.text}</Text>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  backdropPress: {
    flex: 1,
  },

  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
  },

  handle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D8D8D8',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },

  /* HEADER */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },

  headerBack: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F2F4F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  headerText: {
    flex: 1,
    paddingRight: 10,
  },

  title: {
    color: colors.black,
    fontSize: 19,
    fontWeight: '900',
  },

  subtitle: {
    color: colors.gray,
    fontSize: 12,
    marginTop: 4,
  },

  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F2F4F2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* BODY */
  body: {
    flexGrow: 0,
    flexShrink: 1,
  },

  bodyContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },

  /* ADDRESS CARDS */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.3,
    borderColor: '#E6E9E6',
    padding: 14,
    marginBottom: 12,
  },

  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F5FAF5',
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#F1F5F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  cardIconSelected: {
    backgroundColor: '#E1F1E4',
  },

  cardDetails: {
    flex: 1,
    marginRight: 10,
  },

  cardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  cardLabel: {
    color: colors.black,
    fontSize: 15,
    fontWeight: '800',
  },

  cardPill: {
    backgroundColor: colors.primary,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },

  cardPillText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  cardAddress: {
    color: '#555555',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDE2DD',
    marginTop: 12,
    paddingTop: 10,
  },

  cardAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardActionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 6,
  },

  cardActionDivider: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    backgroundColor: '#DDE2DD',
  },

  /* EMPTY STATE */
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#F6F8F6',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 22,
  },

  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E5F2E7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    color: colors.black,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
  },

  emptyText: {
    color: colors.gray,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
  },

  /* DELETE CONFIRMATION */
  confirmWrap: {
    alignItems: 'center',
    paddingTop: 6,
  },

  confirmIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FEE4E2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  confirmTitle: {
    color: colors.black,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 12,
  },

  confirmText: {
    color: colors.gray,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },

  confirmPreview: {
    alignSelf: 'stretch',
    backgroundColor: '#F6F8F6',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },

  confirmButtons: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: 18,
  },

  confirmCancel: {
    flex: 1,
    borderWidth: 1.3,
    borderColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginRight: 8,
  },

  confirmCancelText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },

  confirmDelete: {
    flex: 1,
    backgroundColor: DANGER,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginLeft: 8,
  },

  confirmDeleteText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  /* FORM */
  fieldLabel: {
    color: '#333333',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 7,
  },

  input: {
    height: 50,
    borderWidth: 1.3,
    borderColor: '#DDE2DD',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#222222',
    backgroundColor: '#FAFBFA',
  },

  inputError: {
    borderColor: DANGER,
    backgroundColor: '#FFF8F7',
  },

  errorText: {
    color: DANGER,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 5,
  },

  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.3,
    borderColor: colors.primary,
    borderRadius: 12,
    backgroundColor: '#F5FAF5',
    paddingVertical: 13,
    marginTop: 14,
  },

  locationButtonBusy: {
    opacity: 0.7,
  },

  locationButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 8,
  },

  locationMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },

  locationMessageText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    marginLeft: 6,
  },

  typeRow: {
    flexDirection: 'row',
  },

  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.3,
    borderColor: '#DDE2DD',
    borderRadius: 12,
    paddingVertical: 12,
    marginRight: 8,
    backgroundColor: '#FFFFFF',
  },

  typeChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#F5FAF5',
  },

  typeChipText: {
    color: colors.gray,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },

  typeChipTextActive: {
    color: colors.primary,
    fontWeight: '900',
  },

  /* FOOTER */
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E6E9E6',
    backgroundColor: '#FFFFFF',
  },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
  },

  primaryButtonBusy: {
    opacity: 0.8,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 4,
  },

  /* TOAST */
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2D24',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    elevation: 6,
  },

  toastError: {
    backgroundColor: DANGER,
  },

  toastText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
});

export default AddressBottomSheet;