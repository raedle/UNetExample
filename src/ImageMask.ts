import { Alert } from "react-native";
import { Image, media, Module, Tensor, torch, torchvision } from "react-native-pytorch-core";

// Original source: https://github.com/pytorch/android-demo-app/blob/master/ObjectDetection/app/src/main/java/org/pytorch/demo/objectdetection/PrePostProcessor.java
// The code was adjusted to match PyTorch Live API

// The image size is defined by the expected model input.
const IMAGE_SIZE = 224;

// Helper type to store left, top, right, bottom bounds
type Rect = [number, number, number, number];

type BoundingBox = {
  // The detected object label
  label: string,
  // The confidence score
  score: number,
  // The object bounds
  rect: Rect,
}

/**
 * Detect objects in an image. The model needs to be a PyTorch model loaded in
 * the lite interpreter runtime and be compatible with the implemented
 * preprocessing and postprocessing steps.
 *
 * @param model Model loaded for lite interpreter runtime.
 * @param image Image object either from the camera or loaded via url or
 * bundle.
 * @returns Detected objects with their score, label, and bounds (left, top,
 * right, bottom).
 */
export async function imageMask(model: Module, image: Image): Promise<Image[]> {
  // BEGIN: Capture performance measure for preprocessing
  const startPackTime = performance.now();
  const height = image.getHeight();
  const width = image.getWidth();
  // Convert camera image to blob (raw image data in HWC format)
  const blob = media.toBlob(image);
  // Get tensor from blob and define HWC shape for tensor
  let tensor = torch.fromBlob(blob, [height, width, 3]);
  // Change tensor shape from HWC to CHW (channel first) (3, H, C)
  tensor = tensor.permute([2, 0, 1]);
  // Convert to float tensor and values to [0, 1]
  tensor = tensor.div(255);
  // Center crop image tensor to have squared images
  const centerCrop = torchvision.transforms.centerCrop(Math.min(width, height));
  tensor = centerCrop(tensor);
  // Resize image tensor to match model input shape (3, IMAGE_SIZE, IMAGE_SIZE)
  const resize = torchvision.transforms.resize([IMAGE_SIZE, IMAGE_SIZE]);
  tensor = resize(tensor);
  // Add dimension for batch size (1, 3, IMAGE_SIZE, IMAGE_SIZE)
  tensor = tensor.unsqueeze(0);
  // END: Capture performance measure for preprocessing
  const packTime = global.performance.now() - startPackTime;

  try {
    // BEGIN: Capture performance measure for inference
    const startInferencTime = global.performance.now();
    // Run ML inference
    const output = await model.forward<Tensor, Tensor[]>(tensor);
    // END: Capture performance measure for inference
    const inferenceTime = global.performance.now() - startInferencTime;

    // BEGIN: Capture performance measure for postprocessing
    const startUnpackTime = global.performance.now();
    // Note: The toTensor API is likely going to change
    const images = [];
    for (let i = 0; i < output.length; i++) {
      const grayscaleTensor = output[i].squeeze(0);
      const rgbImage = oneDto3D(grayscaleTensor.mul(255));
      const image = media.imageFromTensor(rgbImage);
      images.push(image);
    }

    // END: Capture performance measure for postprocessing
    const unpackTime = global.performance.now() - startUnpackTime;

    console.log(`pack time ${packTime.toFixed(3)} ms`);
    console.log(`inference time ${inferenceTime.toFixed(3)} ms`);
    console.log(`unpack time ${unpackTime.toFixed(3)} ms`);

    return images;
  }
  catch (error: any) {
    Alert.alert('Error', error);
  }
  return [];
}

/**
 * Convert a grayscale tensor to a RGB CHW tensor.
 * 
 * @param t Grayscale tensor of shape [1, H, W]
 * @returns RGB CHW tensor
 */
function oneDto3D(t: Tensor): Tensor {
  const h = t.shape[1];
  const w = t.shape[2];
  const flatData = [...t.data()];
  return torch
    .tensor([flatData, flatData, flatData], {
      dtype: torch.uint8,
    })
    .reshape([3, h, w]);
}