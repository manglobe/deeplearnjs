/* Copyright 2017 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

import {Tensor} from '../graph';
import * as conv_util from '../math/conv_util';
import {MatrixOrientation, NDArrayMath} from '../math/math';
import {Array1D, Array2D, Array3D, Array4D, NDArray, Scalar} from '../math/ndarray';
import {TensorArrayMap} from '../tensor_array_map';
import * as util from '../util';

import {Operation} from './op';

/**
 * @hidden
 */
export class Convolution2D extends Operation {
  private zeroPad: number;

  /**
   * Constructs a convolution op with the specified properties.
   *
   * @param inputShape The shape of the input ndarray.
   * @param fieldSize The size of the filter (rows/cols of sliding window).
   * @param outputDepth The depth of the output (Number of filters).
   * @param stride How many pixels to shift the filter by when sliding.
   *     Defaults to 1.
   * @param zeroPad How many pixels to pad the input from each side. Defaults to
   *     a value so that the rows and columns of the output ndarray is
   *     the same as the input ndarray.
   * @param weights Optional. The weights of the filters.
   * @param biases Optional. The bias terms of the filters.
   */
  constructor(
      private wTensor: Tensor, private xTensor: Tensor, private bTensor: Tensor,
      private yTensor: Tensor, private fieldSize: number,
      private outputDepth: number, private stride = 1, zeroPad?: number) {
    super();
    this.assertWeightsShape(wTensor.shape);
    this.zeroPad = zeroPad != null ?
        zeroPad :
        conv_util.computeDefaultPad(
            this.xTensor.shape as [number, number, number], this.fieldSize,
            this.stride);
    util.assert(
        util.isInt(this.zeroPad),
        `The zero padding (${this.zeroPad}) must be an integer. Change the ` +
            `stride and/or zero pad parameters`);
  }

  feedForward(math: NDArrayMath, inferenceArrays: TensorArrayMap) {
    const weights = inferenceArrays.get(this.wTensor) as Array4D;
    const biases = inferenceArrays.get(this.bTensor) as Array1D;
    const x = inferenceArrays.get(this.xTensor) as Array3D;

    math.scope((keep) => {
      inferenceArrays.set(
          this.yTensor,
          keep(math.conv2d(x, weights, biases, this.stride, this.zeroPad)));
    });
  }

  backProp(
      math: NDArrayMath, inferenceArrays: TensorArrayMap,
      gradientArrays: TensorArrayMap) {
    const weights = inferenceArrays.get(this.wTensor) as Array4D;
    const x = inferenceArrays.get(this.xTensor) as Array3D;
    const dy = gradientArrays.get(this.yTensor) as Array3D;

    math.scope((keep) => {
      const {dw, db, dx} =
          math.conv2dBackProp(x, dy, weights, this.stride, this.zeroPad);
      gradientArrays.set(this.wTensor, keep(dw));
      gradientArrays.set(this.bTensor, keep(db));
      gradientArrays.set(this.xTensor, keep(dx));
    });
  }

  private assertWeightsShape(weightsShape: number[]) {
    util.assert(
        weightsShape[0] === this.fieldSize &&
            weightsShape[1] === this.fieldSize &&
            weightsShape[2] === this.xTensor.shape[2] &&
            weightsShape[3] === this.outputDepth,
        `weights must be of shape [${this.fieldSize},${this.fieldSize},` +
            `${this.xTensor.shape[2]},${this.outputDepth}] but they are of` +
            `shape [${weightsShape}]`);
  }
}
