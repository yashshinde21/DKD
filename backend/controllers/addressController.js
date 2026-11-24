import {db} from '../config/firebaseAdmin.js';
import {FieldValue} from 'firebase-admin/firestore';

const ADDRESS_LABELS = new Set(['Home', 'Work', 'Other']);
const MAX_ADDRESSES = 20;

const cleanText = (value, maxLength = 600) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

/*
 * Converts old and new address objects into the new database structure.
 * Old fields are used only to recover fullAddress when necessary.
 * They are never returned or saved separately.
 */
const normalizeAddress = (raw, index = 0) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const house = cleanText(raw.house, 120);
  const landmark = cleanText(raw.landmark, 180);

  const fullAddress =
    cleanText(raw.fullAddress) ||
    [
      house,
      cleanText(raw.area, 180),
      landmark,
      cleanText(raw.city, 100),
      cleanText(raw.state, 100),
      cleanText(raw.pincode, 10),
    ]
      .filter(Boolean)
      .join(', ');

  if (!fullAddress) {
    return null;
  }

  const rawLocation = raw.location;
  let location = null;

  if (
    rawLocation &&
    Number.isFinite(rawLocation.latitude) &&
    Number.isFinite(rawLocation.longitude)
  ) {
    location = {
      latitude: rawLocation.latitude,
      longitude: rawLocation.longitude,
    };
  }

  return {
    id: cleanText(raw.id, 100) || `address-${index}`,
    label: ADDRESS_LABELS.has(raw.label) ? raw.label : 'Other',
    house,
    landmark,
    fullAddress,
    location,
  };
};

// GET /api/auth/customer/addresses
export const getCustomerAddresses = async (req, res) => {
  try {
    const email = req.user.email;
    const customerRef = db.collection('customers').doc(email);
    const snapshot = await customerRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found.',
      });
    }

    const customer = snapshot.data() || {};

    const rawAddresses = Array.isArray(customer.addresses)
      ? customer.addresses
      : [];

    // Convert old address records into the new structure.
    const addresses = rawAddresses
      .map(normalizeAddress)
      .filter(Boolean);

    const storedSelectedId = customer.selectedAddressId || null;

    const selectedAddress =
      addresses.find(address => address.id === storedSelectedId) ||
      addresses[0] ||
      null;

    const selectedId = selectedAddress?.id || null;

    // Also clean the main customer address field.
    const cleanedMainAddress = customer.address
      ? normalizeAddress(customer.address)
      : null;

    // Update Firestore only when old address fields need cleaning.
    const oldAddressesJSON = JSON.stringify(rawAddresses);
    const newAddressesJSON = JSON.stringify(addresses);

    const oldMainAddressJSON = JSON.stringify(customer.address || null);
    const newMainAddressJSON = JSON.stringify(cleanedMainAddress);

    if (
      oldAddressesJSON !== newAddressesJSON ||
      oldMainAddressJSON !== newMainAddressJSON ||
      storedSelectedId !== selectedId
    ) {
      await customerRef.update({
        addresses,
        selectedAddressId: selectedId,
        address: cleanedMainAddress,
        addressesUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log('OLD ADDRESS FIELDS CLEANED:', email);
    }

    return res.status(200).json({
      success: true,
      addresses,
      selectedId,
    });
  } catch (error) {
    console.error('Get customer addresses error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve saved addresses.',
    });
  }
};

// PUT /api/auth/customer/addresses
// Saves the customer's addresses using the new structure.
export const saveCustomerAddresses = async (req, res) => {
  try {
    const email = req.user.email;
    const incomingAddresses = req.body?.addresses;
    const requestedSelectedId = req.body?.selectedId || null;

    if (!Array.isArray(incomingAddresses)) {
      return res.status(400).json({
        success: false,
        message: 'Addresses must be provided as an array.',
      });
    }

    if (incomingAddresses.length > MAX_ADDRESSES) {
      return res.status(400).json({
        success: false,
        message: `You can save up to ${MAX_ADDRESSES} addresses.`,
      });
    }

    const addresses = incomingAddresses
      .map(normalizeAddress)
      .filter(Boolean);

    if (addresses.length !== incomingAddresses.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more addresses are invalid.',
      });
    }

    const ids = addresses.map(address => address.id);

    if (new Set(ids).size !== ids.length) {
      return res.status(400).json({
        success: false,
        message: 'Address IDs must be unique.',
      });
    }

    const selectedId = requestedSelectedId
      ? String(requestedSelectedId)
      : addresses[0]?.id || null;

    if (selectedId && !ids.includes(selectedId)) {
      return res.status(400).json({
        success: false,
        message: 'Selected address must exist in the saved address list.',
      });
    }

    const customerRef = db.collection('customers').doc(email);
    const customerSnapshot = await customerRef.get();

    if (!customerSnapshot.exists) {
      return res.status(404).json({
        success: false,
        message:
          'Customer profile not found. Please complete registration first.',
      });
    }

    const selectedAddress =
      addresses.find(address => address.id === selectedId) || null;

    await customerRef.update({
      addresses,
      selectedAddressId: selectedId,

      // Keep the main delivery address synchronized.
      address: selectedAddress,

      addressesUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log('FIRESTORE ADDRESS UPDATED SUCCESSFULLY:', email);

    return res.status(200).json({
      success: true,
      message: 'Addresses saved successfully.',
      addresses,
      selectedId,
    });
  } catch (error) {
    console.error('Save customer addresses error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to save addresses. Please try again.',
    });
  }
};