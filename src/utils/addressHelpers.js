import AsyncStorage from '@react-native-async-storage/async-storage';

/*
 * Shared address helpers for DKD Fruits.
 *
 * HomeScreen and ProfileScreen MUST both use these helpers (or at least the
 * same storage keys) so that they always see the same addresses:
 *
 *   dkd_addresses         -> JSON array of address objects
 *   dkd_selected_address  -> id string of the currently selected address
 */

export const ADDRESSES_KEY = 'dkd_addresses';
export const SELECTED_ADDRESS_KEY = 'dkd_selected_address';
const USER_KEY = 'dkd_user';

export const ADDRESS_LABELS = ['Home', 'Work', 'Other'];

/* ---------------- BASIC HELPERS ---------------- */

const text = value => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
};

export const createAddressId = () =>
  `address-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const buildFullAddress = address =>
  [
    address.house,
    address.area,
    address.landmark,
    address.city,
    address.state,
    address.pincode,
  ]
    .map(text)
    .filter(Boolean)
    .join(', ');

/*
 * Converts anything found in storage into the standard address shape.
 * Old addresses that only have {id, label, fullAddress} are kept working.
 * Returns null for unusable data.
 */
export const normalizeAddress = (raw, index = 0) => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const base = {
    house: text(raw.house),
    area: text(raw.area),
    landmark: text(raw.landmark),
    city: text(raw.city),
    state: text(raw.state),
    pincode: text(raw.pincode),
  };

  const fullAddress = text(raw.fullAddress) || buildFullAddress(base);

  if (!fullAddress) {
    return null;
  }

  const latitude = raw.location ? raw.location.latitude : null;
  const longitude = raw.location ? raw.location.longitude : null;
  const hasLocation =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  return {
    id: text(raw.id) || `legacy-address-${index}`,
    label: ADDRESS_LABELS.includes(raw.label) ? raw.label : 'Other',
    ...base,
    location: hasLocation ? {latitude, longitude} : null,
    fullAddress,
  };
};

/* ---------------- STORAGE ---------------- */

export const saveAddresses = async addresses => {
  await AsyncStorage.setItem(ADDRESSES_KEY, JSON.stringify(addresses));
};

export const saveSelectedAddressId = async id => {
  if (id) {
    await AsyncStorage.setItem(SELECTED_ADDRESS_KEY, id);
  } else {
    await AsyncStorage.removeItem(SELECTED_ADDRESS_KEY);
  }
};

/*
 * Loads addresses + selected id safely.
 *  - invalid / missing data never throws
 *  - imports the registration address from `dkd_user` on first use
 *  - always returns a valid selected id (or null when there are no addresses)
 */
export const loadAddressState = async () => {
  const [storedRaw, selectedRaw, userRaw] = await Promise.all([
    AsyncStorage.getItem(ADDRESSES_KEY),
    AsyncStorage.getItem(SELECTED_ADDRESS_KEY),
    AsyncStorage.getItem(USER_KEY),
  ]);

  let addresses = [];

  try {
    const parsed = storedRaw ? JSON.parse(storedRaw) : [];

    if (Array.isArray(parsed)) {
      addresses = parsed.map(normalizeAddress).filter(Boolean);
    }
  } catch (error) {
    addresses = [];
  }

  // Import the address entered at registration (only when nothing is saved).
  if (addresses.length === 0 && userRaw) {
    try {
      const user = JSON.parse(userRaw);
      const old = user?.address || user?.profile?.address;

      let imported = null;

      if (typeof old === 'string') {
        imported = normalizeAddress({
          id: createAddressId(),
          label: 'Home',
          fullAddress: old,
        });
      } else if (old && typeof old === 'object') {
        imported = normalizeAddress({
          id: createAddressId(),
          label: 'Home',
          ...old,
          fullAddress: [old.house, old.fullAddress]
            .filter(Boolean)
            .join(', '),
        });
      }

      if (imported) {
        addresses = [imported];
        await saveAddresses(addresses);
      }
    } catch (error) {
      // Ignore broken user data.
    }
  }

  const selected =
    addresses.find(item => item.id === selectedRaw) || addresses[0] || null;
  const selectedId = selected ? selected.id : null;

  if (selectedId !== selectedRaw) {
    await saveSelectedAddressId(selectedId);
  }

  return {addresses, selectedId};
};

/* ---------------- REVERSE GEOCODING (OpenStreetMap Nominatim) ---------------- */

/*
 * Nominatim usage policy: identify your app with a User-Agent and keep to
 * about 1 request per second. This is only called on a button tap.
 */
export const reverseGeocode = async (latitude, longitude) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const url =
      'https://nominatim.openstreetmap.org/reverse' +
      `?format=jsonv2&addressdetails=1&zoom=18&lat=${latitude}&lon=${longitude}`;

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
        'User-Agent': 'DKDFruitsApp/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`GEOCODE_HTTP_${response.status}`);
    }

    const data = await response.json();
    const a = (data && data.address) || {};

    const road = a.road || a.pedestrian || a.footway || '';
    const locality =
      a.suburb ||
      a.neighbourhood ||
      a.quarter ||
      a.city_district ||
      a.hamlet ||
      '';

    const area = [road, locality]
      .filter((value, index, list) => value && list.indexOf(value) === index)
      .join(', ');

    const city =
      a.city ||
      a.town ||
      a.village ||
      a.municipality ||
      a.county ||
      a.state_district ||
      '';

    const state = a.state || '';
    const pincode = text(a.postcode).replace(/\D/g, '').slice(0, 6);

    if (!area && !city && !state && !pincode) {
      throw new Error('GEOCODE_EMPTY');
    }

    return {area, city, state, pincode};
  } finally {
    clearTimeout(timer);
  }
};