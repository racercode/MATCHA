import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

const disableImage = require('@/assets/Bear/disable.png');

const Loading = ({ text = '', opacity = true }: { text?: string; opacity?: boolean }) => {
  const imageBounce = useRef(new Animated.Value(0)).current;
  const dotBounces = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    const createBounce = (animatedValue: Animated.Value, delay = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animatedValue, {
            toValue: -10,
            duration: 380,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 380,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );

    const animations = [
      createBounce(imageBounce),
      ...dotBounces.map((dot, index) => createBounce(dot, index * 120)),
    ];

    animations.forEach((animation) => animation.start());

    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, [dotBounces, imageBounce]);

  return (
    <ThemedView style={[opacity ? { opacity: 1 } : { opacity: 0.5 }, styles.overlay]}>
      <Animated.View style={[styles.imageWrap, { transform: [{ translateY: imageBounce }] }]}>
        <Image source={disableImage} style={styles.image} resizeMode="contain" />
      </Animated.View>
      <View style={styles.dotsRow}>
        {dotBounces.map((dot, index) => (
          <Animated.View
            key={index}
            style={[styles.dot, { transform: [{ translateY: dot }] }]}
          />
        ))}
      </View>
      {text !== '' && <ThemedText type="default">{text}</ThemedText>}
    </ThemedView>
  );
};

export default Loading;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  imageWrap: {
    marginBottom: 10,
  },
  image: {
    width: 150,
    height: 138,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#A8A8A8',
  },
});
