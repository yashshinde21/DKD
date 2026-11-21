import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import colors from '../theme/colors';

const AddControl = ({qty, onAdd, onRemove, onDark, color}) => {
  if (qty === 0) {
    return (
      <TouchableOpacity
        style={[
          styles.addButton,
          onDark
            ? {backgroundColor: colors.white}
            : {borderColor: color, borderWidth: 1.5, backgroundColor: '#FFFFFF'},
        ]}
        onPress={onAdd}
        activeOpacity={0.85}>
        <Text style={[styles.addButtonText, {color}]}>ADD</Text>
      </TouchableOpacity>
    );
  }

  const background = onDark ? colors.white : color;
  const textColor = onDark ? color : colors.white;

  return (
    <View style={[styles.stepper, {backgroundColor: background}]}>
      <TouchableOpacity
        style={styles.stepperButton}
        onPress={onRemove}
        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
        <Text style={[styles.stepperSymbol, {color: textColor}]}>−</Text>
      </TouchableOpacity>

      <Text style={[styles.stepperQty, {color: textColor}]}>{qty}</Text>

      <TouchableOpacity
        style={styles.stepperButton}
        onPress={onAdd}
        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
        <Text style={[styles.stepperSymbol, {color: textColor}]}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  addButton: {
    minWidth: 76,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  addButtonText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  stepper: {
    minWidth: 76,
    height: 34,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },

  stepperButton: {
    paddingHorizontal: 4,
  },

  stepperSymbol: {
    fontSize: 18,
    fontWeight: '800',
  },

  stepperQty: {
    fontSize: 14,
    fontWeight: '800',
    marginHorizontal: 6,
  },
});

export default AddControl;
