import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, TextStyle, ViewStyle } from 'react-native';

type ButtonState = 'default' | 'disabled' | 'loading' | 'hover';

interface ButtonProps {
  title?: string;
  onPress?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  state?: ButtonState;
  paddingHorizontal?: number;
  paddingVertical?: number;
}

export default function CustomButton({
  title = '確定',
  onPress,
  style,
  textStyle,
  state = 'default',
  paddingHorizontal = 20,
  paddingVertical = 16,
}: ButtonProps) {
  const [isPressed, setIsPressed] = useState(false);

  const getButtonStyle = () => {
    if (state === 'disabled') return styles.buttonDisabled;
    if (state === 'loading') return styles.buttonLoading;
    if (state === 'hover' || (isPressed && state === 'default')) return styles.buttonHover;
    return styles.buttonDefault;
  };

  return (
    <TouchableOpacity
      style={[styles.button, getButtonStyle(), { paddingHorizontal, paddingVertical }, style]}
      onPress={() => state !== 'disabled' && state !== 'loading' && onPress?.()}
      onPressIn={() => state === 'default' && setIsPressed(true)}
      onPressOut={() => state === 'default' && setIsPressed(false)}
      activeOpacity={1}
      disabled={state === 'disabled' || state === 'loading'}
    >
      <Text style={[styles.text, textStyle]}>
        {state === 'loading' ? '確認中⋯⋯' : title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 138,
    height: 70,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDefault: { backgroundColor: '#FFD745' },
  buttonDisabled: { backgroundColor: 'rgba(255, 215, 69, 0.60)' },
  buttonLoading: { backgroundColor: '#FFD745' },
  buttonHover: {
    backgroundColor: '#FFC904',
    shadowColor: '#f7eeeeff',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.7,
    shadowRadius: 4,
    elevation: 3,
  },
  text: {
    color: '#000',
    textAlign: 'center',
    fontFamily: 'System',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 20,
  },
});
