// SPDX-License-Identifier: Apache-2.0

#include "nvdsinfer_custom_impl.h"

#include <algorithm>
#include <mutex>
#include <cmath>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <numeric>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace {

constexpr std::size_t kRowWidth = 7;
constexpr std::size_t kMinPlateCharacters = 5;
constexpr unsigned int kStableObservationCount = 3;
constexpr const char *kDefaultLabelFile =
    "/opt/models/custom/obd_lpcs_kr.c89.cls";

struct Character {
  std::string label;
  float left;
  float top;
  float width;
  float height;
  float confidence;
};

bool debugEnabled() {
  const char *value = std::getenv("LPR_DEBUG");
  return value != nullptr && std::string(value) != "0" &&
         std::string(value) != "false";
}

const std::vector<std::string> &labels() {
  static const std::vector<std::string> loaded = [] {
    const char *configured = std::getenv("LPR_LABEL_FILE");
    const std::string path = configured != nullptr ? configured
                                                   : kDefaultLabelFile;
    std::ifstream stream(path);
    std::vector<std::string> result;
    if (!stream.is_open()) {
      if (debugEnabled()) {
        std::cerr << "[LPR] failed to read label file: " << path << std::endl;
      }
      return result;
    }
    std::string line;
    while (std::getline(stream, line)) {
      if (!line.empty() && line.back() == '\r') {
        line.pop_back();
      }
      result.push_back(line);
    }
    return result;
  }();
  return loaded;
}

std::string assembleText(std::vector<Character> characters) {
  if (characters.empty()) {
    return {};
  }

  const float averageHeight =
      std::accumulate(characters.begin(), characters.end(), 0.0F,
                      [](float sum, const Character &character) {
                        return sum + character.height;
                      }) /
      static_cast<float>(characters.size());

  const auto [minY, maxY] = std::minmax_element(
      characters.begin(), characters.end(), [](const auto &lhs, const auto &rhs) {
        return lhs.top + lhs.height * 0.5F < rhs.top + rhs.height * 0.5F;
      });
  const bool twoRows =
      characters.size() >= 4 &&
      ((maxY->top + maxY->height * 0.5F) -
       (minY->top + minY->height * 0.5F)) > averageHeight * 0.75F;

  std::vector<Character> upper;
  std::vector<Character> lower;
  if (twoRows) {
    std::vector<float> centers;
    for (const auto &character : characters) {
      centers.push_back(character.top + character.height * 0.5F);
    }
    std::sort(centers.begin(), centers.end());
    const float split = centers[centers.size() / 2];
    for (const auto &character : characters) {
      ((character.top + character.height * 0.5F) < split ? upper : lower)
          .push_back(character);
    }
  } else {
    upper = std::move(characters);
  }

  const auto sortByX = [](auto &row) {
    std::sort(row.begin(), row.end(),
              [](const auto &lhs, const auto &rhs) {
                return lhs.left < rhs.left;
              });
  };
  sortByX(upper);
  sortByX(lower);

  std::string text;
  for (const auto &character : upper) {
    text += character.label;
  }
  for (const auto &character : lower) {
    text += character.label;
  }
  return text;
}

} // namespace

extern "C" bool NvDsInferParseCustomYoloV7LPR(
    const std::vector<NvDsInferLayerInfo> &outputLayersInfo,
    const NvDsInferNetworkInfo &networkInfo,
    const NvDsInferParseDetectionParams &detectionParams,
    std::vector<NvDsInferObjectDetectionInfo> &objectList) {

  const NvDsInferLayerInfo *output = nullptr;
  for (const auto &layer : outputLayersInfo) {
    if (layer.layerName != nullptr &&
        std::string(layer.layerName) == "output") {
      output = &layer;
      break;
    }
  }
  if (output == nullptr && !outputLayersInfo.empty()) {
    output = &outputLayersInfo.front();
  }
  if (output == nullptr || output->buffer == nullptr) {
    std::cerr << "[LPR] parser received no output tensor" << std::endl;
    return false;
  }

  const std::size_t elementCount = output->inferDims.numElements;
  if (elementCount % kRowWidth != 0) {
    std::cerr << "[LPR] unexpected output element count=" << elementCount
              << ", expected rows of 7" << std::endl;
    return false;
  }

  const auto &classLabels = labels();
  const float *values = static_cast<const float *>(output->buffer);
  std::vector<Character> characters;

  for (std::size_t offset = 0; offset < elementCount; offset += kRowWidth) {
    const float batchId = values[offset];
    float x1 = values[offset + 1];
    float y1 = values[offset + 2];
    float x2 = values[offset + 3];
    float y2 = values[offset + 4];
    // The end-to-end YOLOv7 ONNX graph emits
    // [batch_id, x1, y1, x2, y2, class_id, score].
    const int classId = static_cast<int>(std::lround(values[offset + 5]));
    const float confidence = values[offset + 6];

    // Validation uses SGIE batch-size=1. The end-to-end NMS output is [N,7]
    // and column 0 is the inference batch index.
    if (std::lround(batchId) != 0 || classId < 0 ||
        static_cast<unsigned int>(classId) >=
            detectionParams.numClassesConfigured) {
      continue;
    }

    float threshold = 0.25F;
    if (static_cast<std::size_t>(classId) <
        detectionParams.perClassPreclusterThreshold.size()) {
      threshold = detectionParams.perClassPreclusterThreshold[classId];
    }
    if (!std::isfinite(confidence) || confidence < threshold) {
      continue;
    }

    // Accept normalized or 224x224 pixel coordinates.
    if (x1 >= -0.01F && y1 >= -0.01F && x2 <= 1.01F && y2 <= 1.01F) {
      x1 *= networkInfo.width;
      x2 *= networkInfo.width;
      y1 *= networkInfo.height;
      y2 *= networkInfo.height;
    }

    x1 = std::clamp(x1, 0.0F, static_cast<float>(networkInfo.width - 1));
    y1 = std::clamp(y1, 0.0F, static_cast<float>(networkInfo.height - 1));
    x2 = std::clamp(x2, 0.0F, static_cast<float>(networkInfo.width));
    y2 = std::clamp(y2, 0.0F, static_cast<float>(networkInfo.height));
    if (x2 <= x1 || y2 <= y1) {
      continue;
    }

    NvDsInferObjectDetectionInfo detection{};
    detection.classId = classId;
    detection.detectionConfidence = confidence;
    detection.left = x1;
    detection.top = y1;
    detection.width = x2 - x1;
    detection.height = y2 - y1;
    objectList.push_back(detection);

    const std::string label =
        static_cast<std::size_t>(classId) < classLabels.size()
            ? classLabels[classId]
            : std::to_string(classId);
    characters.push_back({label, detection.left, detection.top, detection.width,
                          detection.height, confidence});
  }

  if (debugEnabled() && characters.size() >= kMinPlateCharacters) {
    const std::string text = assembleText(characters);
    const float averageConfidence =
        std::accumulate(characters.begin(), characters.end(), 0.0F,
                        [](float sum, const Character &character) {
                          return sum + character.confidence;
                        }) /
        static_cast<float>(characters.size());

    static std::mutex resultMutex;
    static std::unordered_map<std::string, unsigned int> observationCounts;
    static std::unordered_set<std::string> emittedTexts;
    bool emit = false;
    {
      std::lock_guard<std::mutex> lock(resultMutex);
      if (emittedTexts.find(text) == emittedTexts.end()) {
        const unsigned int observations = ++observationCounts[text];
        if (observations >= kStableObservationCount) {
          emit = emittedTexts.insert(text).second;
          observationCounts.erase(text);
        }
      }
    }

    if (emit) {
      std::cerr << "[LPR_RAW] candidate=\"" << text
                << "\" chars=" << characters.size()
                << " avg_conf=" << averageConfidence << std::endl;
    }
  }

  return true;
}

CHECK_CUSTOM_PARSE_FUNC_PROTOTYPE(NvDsInferParseCustomYoloV7LPR);
