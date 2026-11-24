import React, {useState, useEffect, useCallback} from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';

import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useIsFocused} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import colors from '../theme/colors';
import AddressBottomSheet from '../components/AddressBottomSheet';

import {
  loadAddressState,
  syncAddressStateWithServer,
} from '../utils/addressHelpers';

const WHATSAPP_NUMBER = '919867167932';

/* ---------------- REUSABLE COMPONENTS ---------------- */

const Section = ({title, children}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

// Read-only information row (used for email)
const InfoRow = ({icon, label, value, last}) => (
  <View style={[styles.infoRow, !last && styles.rowDivider]}>
    <View style={styles.iconBox}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
    </View>

    <View style={styles.rowContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, !value && styles.infoMissing]}>
        {value || 'Not provided'}
      </Text>
    </View>
  </View>
);

// Editable customer information
const EditableInfoRow = ({
  icon,
  label,
  value,
  onChangeText,
  last,
  keyboardType = 'default',
}) => (
  <View style={[styles.infoRow, !last && styles.rowDivider]}>
    <View style={styles.iconBox}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
    </View>

    <View style={styles.rowContent}>
      <Text style={styles.infoLabel}>{label}</Text>

      <TextInput
        style={styles.editableInfoInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={`Enter ${label.toLowerCase()}`}
        placeholderTextColor="#A0A0A0"
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'phone-pad' ? 'none' : 'words'}
      />
    </View>

    <MaterialCommunityIcons
      name="pencil-outline"
      size={16}
      color="#999999"
    />
  </View>
);

// Dropdown component
const DropdownField = ({
  label,
  value,
  placeholder,
  options,
  onSelect,
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Text style={styles.dropdownLabel}>{label}</Text>

      <TouchableOpacity
        style={styles.dropdownButton}
        activeOpacity={0.8}
        onPress={() => setVisible(true)}>
        <Text
          style={[
            styles.dropdownValue,
            !value && styles.dropdownPlaceholder,
          ]}>
          {value || placeholder}
        </Text>

        <MaterialCommunityIcons
          name="chevron-down"
          size={22}
          color="#777777"
        />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}>
          <View style={styles.dropdownModal}>
            <Text style={styles.dropdownModalTitle}>{label}</Text>

            {options.map(option => (
              <TouchableOpacity
                key={option}
                style={styles.dropdownOption}
                activeOpacity={0.75}
                onPress={() => {
                  onSelect(option);
                  setVisible(false);
                }}>
                <Text style={styles.dropdownOptionText}>{option}</Text>

                {value === option && (
                  <MaterialCommunityIcons
                    name="check"
                    size={20}
                    color={colors.primary}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

/* ---------------- MAIN SCREEN ---------------- */

const BulkEnquiryScreen = ({navigation}) => {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const [profileLoading, setProfileLoading] = useState(true);
  const [addressLoading, setAddressLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [addressSheetVisible, setAddressSheetVisible] = useState(false);

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    customerType: 'Personal',
    businessName: '',
    businessType: '',
    fruits: '',
  });

  // Only show the address explicitly selected by the customer.
  const selectedAddress =
    addresses.find(item => item.id === selectedAddressId) || null;

  const updateField = (key, value) => {
    setForm(previous => ({
      ...previous,
      [key]: value,
    }));
  };

  /* ---------------- LOAD CUSTOMER DETAILS ---------------- */

  const loadCustomerDetails = useCallback(async () => {
    try {
      const userRaw = await AsyncStorage.getItem('dkd_user');

      if (!userRaw) {
        Alert.alert(
          'Profile Not Found',
          'Please log in again to continue.',
        );
        return;
      }

      const user = JSON.parse(userRaw);
      const customer = user.profile || user;

      const savedMode = String(
        customer.customerType || customer.mode || user.mode || '',
      ).toLowerCase();

      const hasSavedBusinessDetails =
        !!customer.businessName || !!customer.businessType;

      const customerType =
        savedMode.includes('business') ||
        savedMode.includes('wholesale') ||
        hasSavedBusinessDetails
          ? 'Business'
          : 'Personal';

      setForm(previous => ({
        ...previous,
        name: customer.name || '',
        email: customer.email || user.email || '',
        phone: customer.phone || '',
        customerType,
        businessName: customer.businessName || '',
        businessType: customer.businessType || '',
      }));
    } catch (error) {
      console.log('CUSTOMER DETAILS ERROR:', error.message);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  /* ---------------- LOAD SAVED ADDRESSES ---------------- */

  const refreshAddresses = useCallback(async () => {
    try {
      setAddressLoading(true);

      // Load local addresses first.
      const localState = await loadAddressState();

      setAddresses(localState.addresses);
      setSelectedAddressId(localState.selectedId);

      // Synchronize with the server.
      const synced = await syncAddressStateWithServer();

      if (synced) {
        setAddresses(synced.addresses);
        setSelectedAddressId(synced.selectedId);
      }
    } catch (error) {
      console.log('ADDRESS LOADING ERROR:', error.message);
    } finally {
      setAddressLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      loadCustomerDetails();
      refreshAddresses();
    }
  }, [isFocused, loadCustomerDetails, refreshAddresses]);

  /* ---------------- ADDRESS BOTTOM SHEET ---------------- */

  const handleAddressChange = (updatedAddresses, updatedSelectedId) => {
    setAddresses(updatedAddresses);
    setSelectedAddressId(updatedSelectedId);
  };

  const openAddressSheet = () => {
    setAddressSheetVisible(true);
  };

  /* ---------------- WHATSAPP ENQUIRY ---------------- */

  const handleSubmit = async () => {
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.replace(/\D/g, '');
    const customerType = form.customerType;
    const businessName = form.businessName.trim();
    const businessType = form.businessType.trim();
    const fruits = form.fruits.trim();

    if (!name || !phone || !email) {
      Alert.alert(
        'Incomplete Profile',
        'Please complete your personal information.',
      );
      return;
    }

    if (phone.length !== 10) {
      Alert.alert(
        'Invalid Phone Number',
        'Please enter a valid 10-digit mobile number.',
      );
      return;
    }

    if (
      customerType === 'Business' &&
      (!businessName || !businessType)
    ) {
      Alert.alert(
        'Business Details Required',
        'Please enter your business name and select your business type.',
      );
      return;
    }

    if (!selectedAddress) {
      Alert.alert(
        'Delivery Address Required',
        'Please select or add a delivery address.',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Add Address',
            onPress: openAddressSheet,
          },
        ],
      );
      return;
    }

    if (!fruits) {
      Alert.alert(
        'Missing Requirements',
        'Please enter the fruits and quantities you require.',
      );
      return;
    }

    const address =
      selectedAddress.fullAddress ||
      [
        selectedAddress.house,
        selectedAddress.area,
        selectedAddress.landmark,
        selectedAddress.city,
        selectedAddress.state,
      ]
        .filter(Boolean)
        .join(', ');

    const pincode = selectedAddress.pincode || '';

    const businessDetails =
      customerType === 'Business'
        ? `Business Name: ${businessName}
Business Type: ${businessType}`
        : '';

    const message = `Hello DKD Fruits!

I would like to enquire about fruit prices.

CUSTOMER DETAILS

Customer Type: ${customerType}
Name: ${name}
Email: ${email}
Phone: ${phone}
${businessDetails}

SELECTED DELIVERY ADDRESS

Address Type: ${selectedAddress.label || 'Not provided'}
Address: ${address || 'Not provided'}
PIN Code: ${pincode || 'Not provided'}

FRUITS REQUIRED

${fruits}

Please share your prices and available quantities.

Thank you!`;

    const whatsappUrl =
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    try {
      setSending(true);
      await Linking.openURL(whatsappUrl);
    } catch (error) {
      Alert.alert(
        'Unable to Open WhatsApp',
        'Please install WhatsApp or try again.',
      );
    } finally {
      setSending(false);
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <View style={styles.screen}>
      {isFocused && (
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle="light-content"
        />
      )}

      {/* HEADER */}

      <View style={[styles.header, {paddingTop: insets.top + 10}]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.8}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={22}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <View style={styles.headerTextBlock}>
            <Text style={styles.headerTitle}>Bulk Enquiry</Text>
          </View>
        </View>

        <Text style={styles.headerSubtitle}>
          Share your requirements and get wholesale fruit prices from our team.
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            {paddingBottom: insets.bottom + 28},
          ]}>

          {/* CUSTOMER DETAILS */}

          <Section title="Customer Details">
            <View style={[styles.card, styles.cardPadded]}>
              {profileLoading ? (
                <ActivityIndicator
                  color={colors.primary}
                  style={styles.loader}
                />
              ) : (
                <>
                  <DropdownField
                    label="Enquiry For"
                    value={form.customerType}
                    placeholder="Select Personal or Business"
                    options={['Personal', 'Business']}
                    onSelect={value => {
                      updateField('customerType', value);

                      if (value === 'Personal') {
                        updateField('businessName', '');
                        updateField('businessType', '');
                      }
                    }}
                  />

                  <EditableInfoRow
                    icon="account-outline"
                    label="Full Name"
                    value={form.name}
                    onChangeText={value => updateField('name', value)}
                  />

                  {/* EMAIL IS READ-ONLY */}

                  <InfoRow
                    icon="email-outline"
                    label="Email Address"
                    value={form.email}
                  />

                  <EditableInfoRow
                    icon="phone-outline"
                    label="Mobile Number"
                    value={form.phone}
                    onChangeText={value => updateField('phone', value)}
                    keyboardType="phone-pad"
                    last={form.customerType === 'Personal'}
                  />

                  {/* BUSINESS FIELDS */}

                  {form.customerType === 'Business' && (
                    <>
                      <EditableInfoRow
                        icon="store-outline"
                        label="Business Name"
                        value={form.businessName}
                        onChangeText={value =>
                          updateField('businessName', value)
                        }
                      />

                        <EditableInfoRow
                        icon="briefcase-outline"
                        label="Business Type"
                        value={form.businessType}
                        onChangeText={value => updateField('businessType', value)}
                        last
                        />
                    </>
                  )}
                </>
              )}
            </View>
          </Section>

          {/* DELIVERY ADDRESS */}

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleInline}>
                Delivery Address
              </Text>

              <TouchableOpacity
                style={styles.addButton}
                activeOpacity={0.85}
                onPress={openAddressSheet}>
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

            {addressLoading ? (
              <View style={styles.addressCard}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addressCard}
                activeOpacity={0.85}
                onPress={openAddressSheet}>
                <View style={styles.addressIconWrap}>
                  <MaterialCommunityIcons
                    name="map-marker"
                    size={20}
                    color={colors.primary}
                  />
                </View>

                <View style={styles.addressTextBlock}>
                  <Text style={styles.addressTitle} numberOfLines={1}>
                    {selectedAddress
                      ? `Deliver to ${selectedAddress.label}`
                      : 'Select your delivery address'}
                  </Text>

                  <Text style={styles.addressText} numberOfLines={3}>
                    {selectedAddress
                      ? selectedAddress.fullAddress ||
                        [
                          selectedAddress.house,
                          selectedAddress.area,
                          selectedAddress.city,
                          selectedAddress.state,
                          selectedAddress.pincode,
                        ]
                          .filter(Boolean)
                          .join(', ')
                      : 'Tap to add your address'}
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
            )}
          </View>

          {/* FRUIT REQUIREMENTS */}

          <Section title="Fruits Required">
            <View style={[styles.card, styles.cardPadded]}>
              <Text style={styles.inputLabel}>
                Fruit Names and Quantities *
              </Text>

              <TextInput
                style={styles.textArea}
                value={form.fruits}
                placeholder={
                  'Example:\nOrange - 50 kg\nApple - 100 kg\nBanana - 30 kg'
                }
                placeholderTextColor="#9AA09A"
                onChangeText={value => updateField('fruits', value)}
                multiline
                numberOfLines={5}
                maxLength={1000}
                textAlignVertical="top"
                autoCapitalize="sentences"
              />

              <Text style={styles.helperText}>
                Mention fruit names and approximate quantities for an accurate
                wholesale quotation.
              </Text>
            </View>
          </Section>

          {/* WHATSAPP BUTTON */}

          <TouchableOpacity
            style={[styles.submitButton, sending && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={sending || profileLoading || addressLoading}
            activeOpacity={0.85}>
            {sending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <MaterialCommunityIcons
                name="whatsapp"
                size={22}
                color="#FFFFFF"
              />
            )}

            <Text style={styles.submitText}>
              {sending ? 'Opening WhatsApp...' : 'Send Enquiry on WhatsApp'}
            </Text>
          </TouchableOpacity>

          <View style={styles.secureNote}>
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={16}
              color={colors.gray}
            />

            <Text style={styles.secureText}>
              Your enquiry details will be shared through WhatsApp.
            </Text>
          </View>

          <Text style={styles.footerText}>DKD Fruits & Vegetables</Text>
          <Text style={styles.versionText}>Trusted Since 1938</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* EXISTING ADDRESS BOTTOM SHEET */}

      <AddressBottomSheet
        visible={addressSheetVisible}
        onClose={() => setAddressSheetVisible(false)}
        addresses={addresses}
        selectedId={selectedAddressId}
        onChange={handleAddressChange}
      />
    </View>
  );
};

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  flex: {
    flex: 1,
  },

  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  headerTextBlock: {
    flex: 1,
  },

  headerTitle: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 1,
  },

  headerSubtitle: {
    color: '#E4F3E8',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
  },

  scrollContent: {
    paddingTop: 4,
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

  sectionTitleInline: {
    fontSize: 16,
    fontWeight: '900',
    color: '#222222',
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },

  cardPadded: {
    paddingVertical: 14,
  },

  loader: {
    marginVertical: 22,
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

  editableInfoInput: {
    color: '#222222',
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 2,
    paddingHorizontal: 0,
    marginTop: 2,
  },

  dropdownLabel: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 7,
  },

  dropdownButton: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#E2E7E2',
    borderRadius: 10,
    backgroundColor: '#FAFBFA',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dropdownValue: {
    color: '#222222',
    fontSize: 14,
    fontWeight: '700',
  },

  dropdownPlaceholder: {
    color: '#999999',
    fontWeight: '500',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  dropdownModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
    maxHeight: '75%',
  },

  dropdownModalTitle: {
    color: '#222222',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 10,
  },

  dropdownOption: {
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dropdownOptionText: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '600',
  },

  businessTypeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },

  businessTypeContent: {
    flex: 1,
  },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
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
    minHeight: 72,
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

  inputLabel: {
    color: '#333333',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },

  textArea: {
    minHeight: 120,
    borderWidth: 1.3,
    borderColor: '#DDE2DD',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 13,
    fontSize: 14,
    color: '#222222',
    backgroundColor: '#FAFBFA',
  },

  helperText: {
    color: colors.gray,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },

  submitButton: {
    marginHorizontal: 20,
    marginTop: 26,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  disabledButton: {
    opacity: 0.6,
  },

  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  secureNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 20,
  },

  secureText: {
    color: colors.gray,
    fontSize: 11,
    flexShrink: 1,
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
});

export default BulkEnquiryScreen;