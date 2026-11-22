import {db} from '../config/firebaseAdmin.js';
import {FieldValue} from 'firebase-admin/firestore';

const ADDRESS_LABELS = new Set(['Home', 'Work', 'Other']);
const MAX_ADDRESSES = 20;

const cleanText = (value, maxLength = 250) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const normalizeAddress = (raw, index) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const house = cleanText(raw.house, 120);
  const area = cleanText(raw.area, 180);
  const landmark = cleanText(raw.landmark, 180);
  const city = cleanText(raw.city, 100);
  const state = cleanText(raw.state, 100);
  const pincode = cleanText(raw.pincode, 6).replace(/\D/g, '').slice(0, 6);

  const suppliedFullAddress = cleanText(raw.fullAddress, 600);
  const fullAddress =
    suppliedFullAddress ||
    [house, area, landmark, city, state, pincode].filter(Boolean).join(', ');

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
    area,
    landmark,
    city,
    state,
    pincode,
    location,
    fullAddress,
  };
};

// GET /api/auth/customer/addresses
export const getCustomerAddresses = async (req, res) => {
  try {
    const email = req.user.email;
    console.log('ADDRESS SAVE: authenticated email:', email);
console.log('ADDRESS SAVE: request body:', JSON.stringify(req.body));
    const customerRef = db.collection('customers').doc(email);
    const snapshot = await customerRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found.',
      });
    }

    const customer = snapshot.data() || {};
    const addresses = Array.isArray(customer.addresses)
      ? customer.addresses
      : [];

    const storedSelectedId = customer.selectedAddressId || null;
    const selectedAddress =
      addresses.find(address => address.id === storedSelectedId) ||
      addresses[0] ||
      null;

    return res.status(200).json({
      success: true,
      addresses,
      selectedId: selectedAddress?.id || null,
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
// Replaces the signed-in customer's saved address list and selected address.
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

    const addresses = incomingAddresses.map(normalizeAddress);

    if (addresses.some(address => !address)) {
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
      : (addresses[0]?.id || null);

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
        message: 'Customer profile not found. Please complete registration first.',
      });
    }
console.log('ADDRESS SAVE: customer exists:', customerSnapshot.exists);
console.log('ADDRESS SAVE: writing to Firestore...');
// Find the currently selected address
const selectedAddress =
  addresses.find(address => address.id === selectedId) || null;

// Save all addresses and update the main delivery address
await customerRef.update({
  addresses,

  selectedAddressId: selectedId,

  // Keep the existing profile address field synchronized
  address: selectedAddress
    ? {
        id: selectedAddress.id,
        label: selectedAddress.label,
        house: selectedAddress.house,
        area: selectedAddress.area,
        landmark: selectedAddress.landmark,
        city: selectedAddress.city,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
        fullAddress: selectedAddress.fullAddress,
        location: selectedAddress.location,
      }
    : null,

  addressesUpdatedAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
});

console.log('SELECTED DELIVERY ADDRESS:', selectedAddress?.fullAddress);
console.log('FIRESTORE ADDRESS UPDATED SUCCESSFULLY');

    console.log('ADDRESS SAVE: FIRESTORE WRITE SUCCESS');

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
