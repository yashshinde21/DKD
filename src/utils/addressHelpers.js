import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../data/api';

/*
 * Shared address helpers for DKD Fruits.
 *
 * Local copy (fast, works offline):
 *   dkd_addresses         -> JSON array of address objects
 *   dkd_selected_address  -> id string of the currently selected address
 *
 * Server copy (your backend -> Firebase):
 *   GET /auth/customer/addresses  -> {success, addresses, selectedId}
 *   PUT /auth/customer/addresses  -> body {addresses, selectedId}
 *
 * Every add / edit / delete / select saves locally first, then pushes the
 * full list to the server in the background. If the push fails (offline or
 * server error) a "dirty" flag is kept and the push is retried on the next
 * sync, so nothing is lost.
 */

export const ADDRESSES_KEY = 'dkd_addresses';
export const SELECTED_ADDRESS_KEY = 'dkd_selected_address';
export const ADDRESSES_DIRTY_KEY = 'dkd_addresses_dirty';
const USER_KEY = 'dkd_user';
const TOKEN_KEY = 'dkd_token';

const ADDRESS_ENDPOINT = '/auth/customer/addresses';

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

/* ---------------- LOCAL STORAGE ---------------- */

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
 * Loads addresses + selected id from the phone (fast, never throws).
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

/* ---------------- SERVER SYNC (backend -> Firebase) ---------------- */

const authConfig = async () => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);

  return token ? {headers: {Authorization: `Bearer ${token}`}} : null;
};

// Pushes run one after another so an older push can never overwrite a newer one.
let pushChain = Promise.resolve();

const pushNow = async (addresses, selectedId) => {
  try {
    const config = await authConfig();

    if (!config) {
      console.log('ADDRESS SYNC: skipped (no login token on this phone)');
      return false;
    }

    console.log(`ADDRESS SYNC: sending ${addresses.length} address(es)...`);

    const response = await API.put(
      ADDRESS_ENDPOINT,
      {addresses, selectedId: selectedId || null},
      config,
    );

    if (response.data && response.data.success === false) {
      throw new Error(response.data.message || 'Server rejected addresses');
    }

    await AsyncStorage.removeItem(ADDRESSES_DIRTY_KEY);
    console.log('ADDRESS SYNC: saved to server');
    return true;
  } catch (error) {
    console.log(
      'ADDRESS SYNC (push) failed:',
      error.response?.status || '',
      error.response?.data || error.message,
    );

    // Keep a flag so the change is pushed again on the next sync.
    await AsyncStorage.setItem(ADDRESSES_DIRTY_KEY, '1').catch(() => {});
    return false;
  }
};

export const pushAddressesToServer = (addresses, selectedId) => {
  pushChain = pushChain.then(() => pushNow(addresses, selectedId));
  return pushChain;
};

/*
 * Use this for every add / edit / delete / select.
 * Saves on the phone, then pushes to the server in the background
 * (the screen does not wait for the network).
 */
export const persistAddressState = async (addresses, selectedId) => {
  console.log('ADDRESS SYNC: persistAddressState called');

  await saveAddresses(addresses);
  await saveSelectedAddressId(selectedId);

  const synced = await pushAddressesToServer(addresses, selectedId);

  console.log('ADDRESS SYNC RESULT:', synced);

  return synced;
};

const fetchServerAddresses = async () => {
  const config = await authConfig();

  if (!config) {
    return null;
  }

  const response = await API.get(ADDRESS_ENDPOINT, config);
  const data = response.data;

  if (!data || data.success === false || !Array.isArray(data.addresses)) {
    return null;
  }

  return {
    addresses: data.addresses.map(normalizeAddress).filter(Boolean),
    selectedId: data.selectedId || null,
  };
};

/*
 * Brings the phone and the server in line. Call it after loadAddressState().
 * Returns the state to show, or null when the server cannot be reached
 * (the screen then simply keeps the local state).
 *
 *  - unsynced local changes are pushed first (the phone wins)
 *  - otherwise, if the server has addresses, the server list is used
 *  - if the server has none yet, the local list is uploaded
 */
export const syncAddressStateWithServer = async () => {
  try {
    const config = await authConfig();

    if (!config) {
      return null;
    }

    const local = await loadAddressState();
    const dirty = await AsyncStorage.getItem(ADDRESSES_DIRTY_KEY);

    if (dirty === '1') {
      await pushAddressesToServer(local.addresses, local.selectedId);
      return local;
    }

    const remote = await fetchServerAddresses();

    if (!remote) {
      return null;
    }

    if (remote.addresses.length === 0) {
      if (local.addresses.length > 0) {
        await pushAddressesToServer(local.addresses, local.selectedId);
      }

      return local;
    }

    const selected =
      remote.addresses.find(item => item.id === remote.selectedId) ||
      remote.addresses[0];

    await saveAddresses(remote.addresses);
    await saveSelectedAddressId(selected.id);

    return {addresses: remote.addresses, selectedId: selected.id};
  } catch (error) {
    console.log(
      'ADDRESS SYNC (pull) failed:',
      error.response?.data || error.message,
    );
    return null;
  }
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