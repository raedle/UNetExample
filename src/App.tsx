import * as React from 'react';
import {
  Camera,
  Canvas,
  CanvasRenderingContext2D,
  Image,
} from 'react-native-pytorch-core';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import useModel from './useModel';
import { imageMask } from './ImageMask';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

const MODEL =
  'https://github.com/raedle/test-some/releases/download/v0.0.2.0/u2netp_small_live_test.ptl';

// Mask size drawn on canvas
const SIZE = 100;
// Gap between each mask on canvas
const GAP = 10;

function ImageMask() {
  // Insets to respect notches and menus to safely render content
  const insets = useSafeAreaInsets();
  // Load model from a given url.
  const { isReady, model } = useModel(MODEL)
  // Indicates an inference in-flight
  const [isProcessing, setIsProcessing] = React.useState(false);
  const context2DRef = React.useRef<CanvasRenderingContext2D | null>(null);

  const handleImage = React.useCallback(async (image) => {
    // Show feedback to the user if the model hasn't loaded. This shouldn't
    // happen because the isReady variable is only true when the model loaded
    // and isReady. However, this is a safeguard to provide user feedback in
    // unknown edge cases ;)
    if (model == null) {
      Alert.alert('Model not loaded', 'The model has not been loaded yet');
      return;
    }

    const ctx = context2DRef.current;
    if (ctx == null) {
      Alert.alert('Canvas', 'The canvas is not initialized');
      return;
    }

    // Show activity view
    setIsProcessing(true);

    // Clear previous result
    ctx.clear();
    await ctx.invalidate();

    // Salient object detection as masks
    const images = await imageMask(model, image);

    // Render the image masks on the canvas in a simple grid
    let w = GAP;
    let h = GAP;
    for (let i = 0; i < images.length; i++) {
      const mask = images[i];
      ctx.drawImage(mask, w, h, SIZE, SIZE);
      w += SIZE + GAP;
      if (w / ((SIZE + GAP) * 3) > 1) {
        w = GAP;
        h += SIZE + GAP;
      }
    }
    // Paint canvas and wait for completion
    await ctx.invalidate();

    // Cleanup image masks
    images.forEach((mask: Image) => mask.release());

    // Release image from memory
    await image.release();

    // Hide activity view
    setIsProcessing(false);
  }, [model, setIsProcessing]);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color="tomato" />
        <Text style={styles.loadingText}>Loading unetp Model</Text>
        <Text>~4.43 MB</Text>
      </View>
    )
  }

  return (
    <View style={insets}>
      <Camera style={styles.camera} onCapture={handleImage} />
      <View style={styles.canvas}>
        <Canvas
          style={StyleSheet.absoluteFill}
          onContext2D={ctx => {
            context2DRef.current = ctx;
          }}
        />
      </View>
      {isProcessing && <View style={styles.activityIndicatorContainer}>
        <ActivityIndicator size="small" color="tomato" />
        <Text style={styles.activityIndicatorLabel}>Finding image masks</Text>
      </View>}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ImageMask />
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  activityIndicatorContainer: {
    alignItems: 'center',
    backgroundColor: 'black',
    height: '100%',
    justifyContent: 'center',
    position: 'absolute',
    width: '100%',
  },
  activityIndicatorLabel: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
  },
  camera: {
    height: '50%',
    width: '100%',
  },
  canvas: {
    backgroundColor: 'black',
    height: '50%',
  },
  loading: {
    alignItems: 'center',
    backgroundColor: 'white',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
  },
});
