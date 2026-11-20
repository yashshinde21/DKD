
import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '../theme/colors';
import API from '../data/api';

const OTPScreen = ({navigation, route}) => {
  const email = (route?.params?.email || '').trim().toLowerCase();
  const mode = route?.params?.mode || 'Retail';

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [error, setError] = useState('');

  const inputRef = useRef(null);
  const verifyLock = useRef(false);
  const resendLock = useRef(false);

  // Countdown
  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setTimeout(() => {
      setCountdown(value => Math.max(value - 1, 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  // OTP input
  const handleOtpChange = text => {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setOtp(digits);
    setError('');
  };

  
// VERIFY OTP
const handleVerify = async () => {
  if (verifyLock.current || loading) return;

  if (!email) {
    setError('Email address is missing. Please start again.');
    return;
  }

  if (otp.length !== 6) {
    setError('Please enter the complete 6-digit OTP.');
    return;
  }

  verifyLock.current = true;
  setLoading(true);
  setError('');

  try {
    const response = await API.post('/auth/verify-otp', {
      email,
      otp: otp.trim(),
    });

    console.log('OTP VERIFY STATUS:', response.status);
    console.log('OTP VERIFY SUCCESS:', response.data?.success);

    if (response.data?.success !== true) {
      setError(response.data?.message || 'OTP verification failed.');
      return;
    }

    const {token, user} = response.data;

    if (!token || !user) {
      setError('Server did not return login information.');
      return;
    }

    // Save login session
    await AsyncStorage.setItem('dkd_token', token);

    await AsyncStorage.setItem(
      'dkd_user',
      JSON.stringify(user),
    );

    await AsyncStorage.setItem(
      'dkd_mode',
      user.profile?.mode || mode,
    );

    console.log('DKD SESSION SAVED SUCCESSFULLY');

    // Existing customer: go directly to Home
    if (user.isProfileComplete) {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'Home',
            params: {
              name: user.profile?.name || email.split('@')[0],
              email,
              mode: user.profile?.mode || mode,
              profile: user.profile,
            },
          },
        ],
      });
    } else {
      // New customer: complete registration
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'Register',
            params: {
              email,
              mode,
              token,
              user,
            },
          },
        ],
      });
    }
  } catch (err) {
    console.error(
      'OTP VERIFY ERROR:',
      err.response?.data || err.message,
    );

    setError(
      err.response?.data?.message ||
      'OTP verification failed. Please try again.',
    );
  } finally {
    verifyLock.current = false;
    setLoading(false);
  }
};


  // RESEND OTP
  const handleResend = async () => {
    if (
      resendLock.current ||
      countdown > 0 ||
      loading ||
      resending
    ) {
      return;
    }

    resendLock.current = true;
    setResending(true);
    setError('');

    try {
      const response = await API.post('/auth/send-otp', {
        email,
      });

      if (response.data?.success) {
        setOtp('');
        setCountdown(60);
        inputRef.current?.focus();
        setError('');
      } else {
        setError(
          response.data?.message || 'Unable to send OTP.',
        );
      }
    } catch (err) {
      console.error(
        'RESEND OTP ERROR:',
        err.response?.data || err.message,
      );

      setError(
        err.response?.data?.message ||
        'Unable to resend OTP. Please try again.',
      );
    } finally {
      resendLock.current = false;
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      <StatusBar
        backgroundColor={colors.background}
        barStyle="dark-content"
      />

      <View style={styles.content}>

        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.icon}>✉</Text>

          <Text style={styles.heading}>
            Verify your email
          </Text>

          <Text style={styles.subheading}>
            We've sent a 6-digit verification code to
          </Text>

          <Text style={styles.email}>
            {email}
          </Text>
        </View>

        {/* OTP INPUT */}
        <Text style={styles.label}>
          ENTER VERIFICATION CODE
        </Text>

        <TouchableOpacity
          activeOpacity={1}
          onPress={() => inputRef.current?.focus()}>

          <View style={styles.otpContainer}>
            {[0, 1, 2, 3, 4, 5].map(index => (
              <View
                key={index}
                style={[
                  styles.otpBox,
                  otp.length === index && styles.activeOtpBox,
                  !!error && styles.errorOtpBox,
                ]}>

                <Text style={styles.otpDigit}>
                  {otp[index] || ''}
                </Text>
              </View>
            ))}

            <TextInput
              ref={inputRef}
              value={otp}
              onChangeText={handleOtpChange}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              caretHidden
              editable={!loading}
              style={styles.hiddenInput}
            />
          </View>
        </TouchableOpacity>

        {!!error && (
          <Text style={styles.errorText}>
            {error}
          </Text>
        )}

        {/* RESEND */}
        <View style={styles.resendRow}>
          <Text style={styles.resendLabel}>
            Didn't receive the code?
          </Text>

          <TouchableOpacity
            onPress={handleResend}
            disabled={countdown > 0 || resending || loading}>

            {resending ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
              />
            ) : (
              <Text
                style={[
                  styles.resendButton,
                  countdown > 0 && styles.resendDisabled,
                ]}>
                {countdown > 0
                  ? `Resend in ${countdown}s`
                  : 'Resend OTP'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* VERIFY BUTTON */}
        <TouchableOpacity
          style={[
            styles.verifyButton,
            (loading || otp.length !== 6) &&
              styles.verifyDisabled,
          ]}
          onPress={handleVerify}
          disabled={loading || otp.length !== 6}
          activeOpacity={0.85}>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator
                color={colors.white}
                size="small"
              />

              <Text style={styles.verifyText}>
                Verifying...
              </Text>
            </View>
          ) : (
            <Text style={styles.verifyText}>
              Verify & Continue
            </Text>
          )}
        </TouchableOpacity>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>
            DKD FRUITS
          </Text>

          <Text style={styles.footerText}>
            Trusted Since 1938
          </Text>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 55,
  },

  header: {
    alignItems: 'center',
    marginBottom: 45,
  },

  icon: {
    fontSize: 48,
    color: colors.primary,
    marginBottom: 18,
  },

  heading: {
    fontSize: 25,
    fontWeight: '800',
    color: colors.black,
  },

  subheading: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 12,
    textAlign: 'center',
  },

  email: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 7,
  },

  label: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1,
    marginBottom: 16,
  },

  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
  },

  otpBox: {
    width: '14%',
    height: 58,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  activeOtpBox: {
    borderColor: colors.primary,
    borderWidth: 2,
  },

  errorOtpBox: {
    borderColor: '#D64545',
  },

  otpDigit: {
    fontSize: 23,
    fontWeight: '800',
    color: colors.black,
  },

  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: 58,
    opacity: 0,
  },

  errorText: {
    color: '#D64545',
    fontSize: 12,
    marginTop: 12,
  },

  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 28,
    gap: 5,
  },

  resendLabel: {
    color: colors.gray,
    fontSize: 13,
  },

  resendButton: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },

  resendDisabled: {
    color: colors.gray,
  },

  verifyButton: {
    height: 54,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },

  verifyDisabled: {
    opacity: 0.45,
  },

  verifyText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  footer: {
    marginTop: 'auto',
    paddingBottom: 25,
    alignItems: 'center',
  },

  footerBrand: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 2,
  },

  footerText: {
    fontSize: 11,
    color: colors.gray,
    marginTop: 5,
  },
});

export default OTPScreen;
