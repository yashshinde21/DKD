
import {db} from '../config/firebaseAdmin.js';
import {FieldValue} from 'firebase-admin/firestore';

// SAVE CUSTOMER PROFILE
export const saveCustomerProfile = async (req, res) => {
  try {
    const email = req.user.email;

    const {
      name,
      phone,
      mode,
      businessName,
      businessType,
      address,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Full name is required.',
      });
    }

    if (!/^[6-9]\d{9}$/.test(String(phone || '').trim())) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid 10-digit mobile number.',
      });
    }

    const normalizedMode =
      String(mode || '').trim().toLowerCase();

    if (!['retail', 'wholesale'].includes(normalizedMode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account type.',
      });
    }

    if (
      normalizedMode === 'wholesale' &&
      (!businessName?.trim() || !businessType?.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: 'Business name and type are required.',
      });
    }

    if (
      !address?.house?.trim() ||
      !address?.fullAddress?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Complete delivery address is required.',
      });
    }

    const customerRef = db.collection('customers').doc(email);
    const existing = await customerRef.get();

    if (existing.exists) {
      return res.status(409).json({
        success: false,
        message: 'Customer profile already exists.',
      });
    }

    const profile = {
      name: name.trim(),
      email,
      phone: String(phone).trim(),
      mode: normalizedMode === 'wholesale' ? 'Wholesale' : 'Retail',

      ...(normalizedMode === 'wholesale'
        ? {
            businessName: businessName.trim(),
            businessType: businessType.trim(),
          }
        : {}),

      address: {
        house: address.house.trim(),
        fullAddress: address.fullAddress.trim(),
        location: address.location || null,
      },

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await customerRef.set(profile);

    return res.status(201).json({
      success: true,
      message: 'Customer profile saved successfully.',
      user: {
        ...profile,
        createdAt: null,
        updatedAt: null,
      },
    });
  } catch (error) {
    console.error('Save customer profile error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to save customer profile.',
    });
  }
};

// GET LOGGED-IN CUSTOMER PROFILE
export const getMyProfile = async (req, res) => {
  try {
    const email = req.user.email;

    const customerRef = db.collection('customers').doc(email);
    const customerSnapshot = await customerRef.get();

    if (!customerSnapshot.exists) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found.',
      });
    }

    return res.status(200).json({
      success: true,
      user: customerSnapshot.data(),
    });
  } catch (error) {
    console.error('Get customer profile error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve customer profile.',
    });
  }
};
