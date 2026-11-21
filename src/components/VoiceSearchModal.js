import React, {useEffect, useRef, useState, useCallback} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  Linking,
  PermissionsAndroid,
  Platform,
} from 'react-native';

import Voice from '@dev-amirzubair/react-native-voice';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import colors from '../theme/colors';

const LOCALE = 'en-IN';

/**
 * Bottom sheet that listens for speech on the current page.
 * When a phrase is recognised it calls onResult(text); the parent decides
 * what to do with it (Home opens the Search page with that text).
 */
const VoiceSearchModal = ({visible, onClose, onResult}) => {
  // 'listening' | 'error' | 'denied'
  const [status, setStatus] = useState('listening');
  const [transcript, setTranscript] = useState('');
  const [errorText, setErrorText] = useState('');

  const finishedRef = useRef(false);
  const transcriptRef = useRef('');
  const onResultRef = useRef(onResult);

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  /* ---------- pulse animation ---------- */

  useEffect(() => {
    if (!visible || status !== 'listening') {
      pulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );

    loop.start();

    return () => loop.stop();
  }, [visible, status, pulse]);

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.1],
  });

  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0],
  });

  /* ---------- speech handling ---------- */

  const finish = useCallback(text => {
    const clean = (text || '').trim();

    if (finishedRef.current || !clean) {
      return;
    }

    finishedRef.current = true;
    Voice.stop().catch(() => {});
    onResultRef.current?.(clean);
  }, []);

  const startListening = useCallback(async () => {
    finishedRef.current = false;
    transcriptRef.current = '';
    setTranscript('');
    setErrorText('');
    setStatus('listening');

    try {
      const available = await Voice.isAvailable();

      if (!available) {
        setErrorText(
          'No speech recognition service found. Install or enable the Google app.',
        );
        setStatus('error');
        return;
      }

      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone permission',
            message: 'DKD Fruits needs the microphone for voice search.',
            buttonPositive: 'Allow',
            buttonNegative: 'Not now',
          },
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setStatus('denied');
          return;
        }
      }

      await Voice.start(LOCALE);
    } catch (error) {
      console.log('Voice start error:', error);
      setErrorText(String(error?.message || error));
      setStatus('error');
    }
  }, []);

  // Register recogniser listeners once.
  useEffect(() => {
    Voice.onSpeechPartialResults = event => {
      const text = event?.value?.[0] || '';

      transcriptRef.current = text;
      setTranscript(text);
    };

    Voice.onSpeechResults = event => {
      const text = event?.value?.[0] || transcriptRef.current;

      finish(text);
    };

    // Fallback in case the final results event does not fire.
    Voice.onSpeechEnd = () => {
      if (transcriptRef.current) {
        finish(transcriptRef.current);
      }
    };

    Voice.onSpeechError = event => {
      console.log('Voice error:', event?.error);

      if (finishedRef.current) {
        return;
      }

      if (transcriptRef.current) {
        finish(transcriptRef.current);
      } else {
        const code = event?.error?.code ?? '';
        const message = event?.error?.message ?? String(event?.error ?? '');

        setErrorText(`Error ${code} ${message}`.trim());
        setStatus('error');
      }
    };

    return () => {
      Voice.destroy()
        .then(Voice.removeAllListeners)
        .catch(() => {});
    };
  }, [finish]);

  // Start / stop together with the sheet.
  useEffect(() => {
    if (visible) {
      startListening();
    } else {
      finishedRef.current = true;
      Voice.cancel().catch(() => {});
    }
  }, [visible, startListening]);

  const handleClose = () => {
    finishedRef.current = true;
    Voice.cancel().catch(() => {});
    onClose();
  };

  /* ---------- text for each state ---------- */

  let title = 'Listening...';
  let hint = 'Try saying "apple" or "green grapes"';

  if (status === 'error') {
    title = "Didn't catch that";
    hint = 'Check your connection and try speaking again.';
  } else if (status === 'denied') {
    title = 'Microphone access needed';
    hint = 'Allow microphone permission in settings to use voice search.';
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />

      <View style={styles.sheet}>
        <View style={styles.handle} />

        <Text style={styles.title}>{title}</Text>

        <Text style={styles.transcript} numberOfLines={3}>
          {status === 'listening' && transcript ? transcript : hint}
        </Text>

        {status === 'error' && errorText !== '' && (
          <Text style={styles.errorDetail}>{errorText}</Text>
        )}

        <View style={styles.micArea}>
          {status === 'listening' && (
            <Animated.View
              style={[
                styles.ring,
                {opacity: ringOpacity, transform: [{scale: ringScale}]},
              ]}
            />
          )}

          <TouchableOpacity
            style={[
              styles.micCircle,
              status !== 'listening' && styles.micCircleIdle,
            ]}
            activeOpacity={0.85}
            onPress={status === 'listening' ? handleClose : startListening}>
            <MaterialCommunityIcons
              name={status === 'listening' ? 'microphone' : 'microphone-off'}
              size={34}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        {status === 'error' && (
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={startListening}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </TouchableOpacity>
        )}

        {status === 'denied' && (
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={() => Linking.openSettings()}>
            <Text style={styles.primaryButtonText}>Open settings</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.cancelButton}
          activeOpacity={0.7}
          onPress={handleClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const MIC_SIZE = 76;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 28,
    alignItems: 'center',
  },

  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDDDDD',
    marginBottom: 18,
  },

  title: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.black,
  },

  transcript: {
    marginTop: 8,
    minHeight: 40,
    fontSize: 15,
    color: colors.gray,
    textAlign: 'center',
  },

  errorDetail: {
    marginTop: 2,
    fontSize: 12,
    color: '#B42318',
    textAlign: 'center',
  },

  micArea: {
    width: MIC_SIZE * 2.2,
    height: MIC_SIZE * 2.2,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },

  ring: {
    position: 'absolute',
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    backgroundColor: colors.primary,
  },

  micCircle: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 3},
  },

  micCircleIdle: {
    backgroundColor: '#9AA39B',
  },

  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: 4,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  cancelButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },

  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray,
  },
});

export default VoiceSearchModal;