#include "face_analytics.h"

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <dlfcn.h>
#include <setjmp.h>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

#include <json-glib/json-glib.h>

#include "gstnvdsinfer.h"
#include "gstnvdsmeta.h"
#include "gst-nvevent.h"
#include "gst-nvquery.h"
#include "nvbufsurface.h"
#include "nvdsmeta.h"
#include "nvmsgbroker.h"

namespace jpeg_api {
extern "C" {
#include <jpeglib.h>
}
}  // namespace jpeg_api

namespace {

constexpr guint kFaceDetectorUniqueId = 4;
constexpr guint kPrimaryDetectorUniqueId = 1;
constexpr gint kPersonClassId = 0;
constexpr guint kDetectorRowSize = 16;
constexpr guint kEmbeddingDim = 512;
constexpr guint kAlignedWidth = 112;
constexpr guint kAlignedHeight = 112;

using EncoderCreate = void *(*)(const char *, const char *, int, const char *);
using EncoderDestroy = void (*)(void *);
using EncoderGetDim = int (*)(void *);
using EncoderGetSize = int (*)(void *, unsigned int *, unsigned int *);
using EncoderInfer = int (*)(void *, float *, int, float *);

struct FaceCandidate {
  NvDsFrameMeta *frame_meta = nullptr;
  guint batch_id = 0;
  guint64 person_id = UNTRACKED_OBJECT_ID;
  float bbox[4]{};       // left, top, width, height in mux coordinates
  float landmarks[10]{};
  float confidence = 0.0F;
  float quality = 0.0F;
  std::string key;
  std::string sensor_id;
};

struct BestFaceState {
  float quality = -1.0F;
  guint64 last_frame = 0;
};

struct PendingPayload {
  gchar *data = nullptr;
};

struct FaceAnalyticsContext {
  void *encoder_lib = nullptr;
  void *encoder = nullptr;
  EncoderDestroy encoder_destroy = nullptr;
  EncoderInfer encoder_infer = nullptr;
  NvMsgBrokerClientHandle broker = nullptr;
  GMutex state_lock;
  GMutex encoder_lock;
  GstPad *query_pad = nullptr;
  gulong query_probe_id = 0;
  std::unordered_map<std::string, BestFaceState> best_faces;
  guint max_recognition_batch = 32;
  guint64 session_id = 0;
  float detector_threshold = 0.70F;
  float minimum_quality_gain = 0.02F;
  float normalization_mean = 127.5F;
  float normalization_scale = 1.0F / 127.5F;
  guint minimum_face_size = 40;
  guint state_max_age_frames = 300;
  guint fallback_bucket_frames = 30;
  guint64 detector_debug_frames = 0;
  gboolean detector_debug = FALSE;
  gboolean require_person = TRUE;
  gboolean kafka_enabled = TRUE;
  std::string kafka_topic = "mdx-face";
  RtviFaceDrainCallback drain_callback = nullptr;
  gpointer drain_user_data = nullptr;
};

static gboolean env_bool(const char *name, gboolean fallback) {
  const char *value = g_getenv(name);
  if (!value || !*value) return fallback;
  return g_ascii_strcasecmp(value, "1") == 0 ||
         g_ascii_strcasecmp(value, "true") == 0 ||
         g_ascii_strcasecmp(value, "yes") == 0 ||
         g_ascii_strcasecmp(value, "on") == 0;
}

static guint env_uint(const char *name, guint fallback) {
  const char *value = g_getenv(name);
  if (!value || !*value) return fallback;
  gchar *end = nullptr;
  const guint64 parsed = g_ascii_strtoull(value, &end, 10);
  return end && *end == '\0' && parsed <= G_MAXUINT
             ? static_cast<guint>(parsed)
             : fallback;
}

static float env_float(const char *name, float fallback) {
  const char *value = g_getenv(name);
  if (!value || !*value) return fallback;
  gchar *end = nullptr;
  const double parsed = g_ascii_strtod(value, &end);
  return end && *end == '\0' && std::isfinite(parsed)
             ? static_cast<float>(parsed)
             : fallback;
}

static const char *env_string(const char *name, const char *fallback) {
  const char *value = g_getenv(name);
  return value && *value ? value : fallback;
}

static void broker_connect_cb(NvMsgBrokerClientHandle,
                              NvMsgBrokerErrorType status) {
  g_print("[FACE_KAFKA] connection status=%d\n", static_cast<int>(status));
}

static void broker_send_cb(void *user_ptr, NvMsgBrokerErrorType status) {
  auto *pending = static_cast<PendingPayload *>(user_ptr);
  if (status != NV_MSGBROKER_API_OK)
    g_printerr("[FACE_KAFKA] asynchronous send failed status=%d\n",
               static_cast<int>(status));
  if (pending) {
    g_free(pending->data);
    delete pending;
  }
}

static void destroy_context(gpointer data) {
  auto *ctx = static_cast<FaceAnalyticsContext *>(data);
  if (!ctx) return;
  if (ctx->broker) {
    nv_msgbroker_disconnect(ctx->broker);
    ctx->broker = nullptr;
  }
  if (ctx->query_pad) {
    if (ctx->query_probe_id)
      gst_pad_remove_probe(ctx->query_pad, ctx->query_probe_id);
    gst_object_unref(ctx->query_pad);
    ctx->query_pad = nullptr;
    ctx->query_probe_id = 0;
  }
  if (ctx->encoder && ctx->encoder_destroy) {
    ctx->encoder_destroy(ctx->encoder);
    ctx->encoder = nullptr;
  }
  if (ctx->encoder_lib) {
    dlclose(ctx->encoder_lib);
    ctx->encoder_lib = nullptr;
  }
  g_mutex_clear(&ctx->state_lock);
  g_mutex_clear(&ctx->encoder_lock);
  delete ctx;
}

static std::string make_candidate_key(guint source_id, guint64 person_id) {
  return std::to_string(source_id) + ":" + std::to_string(person_id);
}

static NvDsObjectMeta *find_person(NvDsFrameMeta *frame_meta,
                                   const float bbox[4]) {
  const float face_center_x = bbox[0] + bbox[2] * 0.5F;
  const float face_center_y = bbox[1] + bbox[3] * 0.5F;
  NvDsObjectMeta *best = nullptr;
  float best_area = G_MAXFLOAT;

  for (NvDsMetaList *item = frame_meta->obj_meta_list; item;
       item = item->next) {
    auto *object = static_cast<NvDsObjectMeta *>(item->data);
    if (!object || object->parent ||
        object->unique_component_id !=
            static_cast<gint>(kPrimaryDetectorUniqueId) ||
        object->class_id != kPersonClassId)
      continue;

    const NvOSD_RectParams &box = object->rect_params;
    const gboolean contains =
        face_center_x >= box.left && face_center_x <= box.left + box.width &&
        face_center_y >= box.top && face_center_y <= box.top + box.height;
    if (!contains) continue;

    // A face should be in the upper 70% of the person box. This prevents a
    // nearby person's large box from winning in crowded scenes.
    if (face_center_y > box.top + box.height * 0.70F) continue;
    const float area = box.width * box.height;
    if (area < best_area) {
      best = object;
      best_area = area;
    }
  }
  return best;
}

static float face_quality(const float bbox[4], const float landmarks[10],
                          float confidence) {
  const float width = std::max(1.0F, bbox[2]);
  const float height = std::max(1.0F, bbox[3]);
  const float left_eye_x = landmarks[0];
  const float left_eye_y = landmarks[1];
  const float right_eye_x = landmarks[2];
  const float right_eye_y = landmarks[3];
  const float nose_x = landmarks[4];
  const float mouth_center_x = (landmarks[6] + landmarks[8]) * 0.5F;

  const float size_score = std::min(1.0F, std::min(width, height) / 112.0F);
  const float eye_distance = std::hypot(right_eye_x - left_eye_x,
                                        right_eye_y - left_eye_y);
  const float eye_score = std::min(1.0F, eye_distance / (width * 0.28F));
  const float eye_level = std::abs(right_eye_y - left_eye_y) / height;
  const float roll_score = std::max(0.0F, 1.0F - eye_level * 5.0F);
  const float center_x = (left_eye_x + right_eye_x) * 0.5F;
  const float symmetry_error =
      (std::abs(nose_x - center_x) + std::abs(mouth_center_x - center_x)) /
      width;
  const float frontal_score = std::max(0.0F, 1.0F - symmetry_error * 4.0F);

  return confidence * (0.35F * size_score + 0.20F * eye_score +
                        0.20F * roll_score + 0.25F * frontal_score);
}

// Least-squares, orientation-preserving 2D similarity transform. This is the
// closed-form equivalent of the provided SimilarityTransform/OpenCV path for
// five landmark pairs, without adding OpenCV as a runtime dependency.
static gboolean similarity_transform(const float source[10], float matrix[6]) {
  static constexpr float destination[10] = {
      38.2946F, 51.6963F, 73.5318F, 51.5014F, 56.0252F,
      71.7366F, 41.5493F, 92.3655F, 70.7299F, 92.2041F};
  float source_mean_x = 0.0F, source_mean_y = 0.0F;
  float destination_mean_x = 0.0F, destination_mean_y = 0.0F;
  for (guint i = 0; i < 5; ++i) {
    source_mean_x += source[i * 2];
    source_mean_y += source[i * 2 + 1];
    destination_mean_x += destination[i * 2];
    destination_mean_y += destination[i * 2 + 1];
  }
  source_mean_x /= 5.0F;
  source_mean_y /= 5.0F;
  destination_mean_x /= 5.0F;
  destination_mean_y /= 5.0F;

  float denominator = 0.0F;
  float a_numerator = 0.0F;
  float b_numerator = 0.0F;
  for (guint i = 0; i < 5; ++i) {
    const float sx = source[i * 2] - source_mean_x;
    const float sy = source[i * 2 + 1] - source_mean_y;
    const float dx = destination[i * 2] - destination_mean_x;
    const float dy = destination[i * 2 + 1] - destination_mean_y;
    denominator += sx * sx + sy * sy;
    a_numerator += sx * dx + sy * dy;
    b_numerator += sx * dy - sy * dx;
  }
  if (denominator < 1e-6F) return FALSE;

  const float a = a_numerator / denominator;
  const float b = b_numerator / denominator;
  matrix[0] = a;
  matrix[1] = -b;
  matrix[2] = destination_mean_x - a * source_mean_x + b * source_mean_y;
  matrix[3] = b;
  matrix[4] = a;
  matrix[5] = destination_mean_y - b * source_mean_x - a * source_mean_y;
  return std::abs(a * a + b * b) > 1e-8F;
}

static inline float sample_channel(const guint8 *rgba, guint pitch, guint width,
                                   guint height, float x, float y,
                                   guint channel) {
  x = std::max(0.0F, std::min(x, static_cast<float>(width - 1)));
  y = std::max(0.0F, std::min(y, static_cast<float>(height - 1)));
  const guint x0 = static_cast<guint>(std::floor(x));
  const guint y0 = static_cast<guint>(std::floor(y));
  const guint x1 = std::min(x0 + 1, width - 1);
  const guint y1 = std::min(y0 + 1, height - 1);
  const float wx = x - static_cast<float>(x0);
  const float wy = y - static_cast<float>(y0);
  const auto pixel = [rgba, pitch, channel](guint px, guint py) {
    return static_cast<float>(rgba[py * pitch + px * 4 + channel]);
  };
  return pixel(x0, y0) * (1.0F - wx) * (1.0F - wy) +
         pixel(x1, y0) * wx * (1.0F - wy) +
         pixel(x0, y1) * (1.0F - wx) * wy +
         pixel(x1, y1) * wx * wy;
}

static gboolean align_face_to_tensor(const NvBufSurfaceParams &surface,
                                     const float landmarks[10],
                                     FaceAnalyticsContext *ctx,
                                     float *tensor) {
  float transform[6]{};
  if (!similarity_transform(landmarks, transform)) return FALSE;
  const float determinant =
      transform[0] * transform[4] - transform[1] * transform[3];
  if (std::abs(determinant) < 1e-8F) return FALSE;

  const guint8 *rgba = static_cast<const guint8 *>(
      surface.mappedAddr.addr[0] ? surface.mappedAddr.addr[0]
                                : surface.dataPtr);
  if (!rgba || surface.width == 0 || surface.height == 0) return FALSE;

  const guint plane = kAlignedWidth * kAlignedHeight;
  for (guint y = 0; y < kAlignedHeight; ++y) {
    for (guint x = 0; x < kAlignedWidth; ++x) {
      // Invert the source->destination affine transform for warpAffine.
      const float dx = static_cast<float>(x) - transform[2];
      const float dy = static_cast<float>(y) - transform[5];
      const float source_x =
          (transform[4] * dx - transform[1] * dy) / determinant;
      const float source_y =
          (-transform[3] * dx + transform[0] * dy) / determinant;
      const guint offset = y * kAlignedWidth + x;
      for (guint channel = 0; channel < 3; ++channel) {
        const float value = sample_channel(
            rgba, surface.pitch, surface.width, surface.height, source_x,
            source_y, channel);
        tensor[channel * plane + offset] =
            (value - ctx->normalization_mean) * ctx->normalization_scale;
      }
    }
  }
  return TRUE;
}
struct JpegErrorManager {
  jpeg_api::jpeg_error_mgr base;
  jmp_buf jump;
};

static void jpeg_error_exit(jpeg_api::j_common_ptr jpeg) {
  auto *error = reinterpret_cast<JpegErrorManager *>(jpeg->err);
  longjmp(error->jump, 1);
}

static gboolean load_jpeg_rgb(const char *path, std::vector<guint8> &pixels,
                              guint &width, guint &height) {
  FILE *file = fopen(path, "rb");
  if (!file) return FALSE;
  jpeg_api::jpeg_decompress_struct decoder{};
  JpegErrorManager error{};
  decoder.err = jpeg_api::jpeg_std_error(&error.base);
  error.base.error_exit = jpeg_error_exit;
  if (setjmp(error.jump)) {
    jpeg_api::jpeg_destroy_decompress(&decoder);
    fclose(file);
    return FALSE;
  }
  jpeg_api::jpeg_CreateDecompress(
      &decoder, JPEG_LIB_VERSION,
      sizeof(jpeg_api::jpeg_decompress_struct));
  jpeg_api::jpeg_stdio_src(&decoder, file);
  jpeg_api::jpeg_read_header(&decoder, TRUE);
  decoder.out_color_space = jpeg_api::JCS_RGB;
  jpeg_api::jpeg_start_decompress(&decoder);
  width = decoder.output_width;
  height = decoder.output_height;
  if (!width || !height || decoder.output_components != 3) {
    jpeg_api::jpeg_destroy_decompress(&decoder);
    fclose(file);
    return FALSE;
  }
  pixels.resize(static_cast<size_t>(width) * height * 3);
  while (decoder.output_scanline < decoder.output_height) {
    jpeg_api::JSAMPROW row = pixels.data() +
        static_cast<size_t>(decoder.output_scanline) * width * 3;
    jpeg_api::jpeg_read_scanlines(&decoder, &row, 1);
  }
  jpeg_api::jpeg_finish_decompress(&decoder);
  jpeg_api::jpeg_destroy_decompress(&decoder);
  fclose(file);
  return TRUE;
}

static inline float sample_rgb(const guint8 *pixels, guint width,
                               guint height, float x, float y,
                               guint channel) {
  x = std::max(0.0F, std::min(x, static_cast<float>(width - 1)));
  y = std::max(0.0F, std::min(y, static_cast<float>(height - 1)));
  const guint x0 = static_cast<guint>(std::floor(x));
  const guint y0 = static_cast<guint>(std::floor(y));
  const guint x1 = std::min(x0 + 1, width - 1);
  const guint y1 = std::min(y0 + 1, height - 1);
  const float wx = x - x0;
  const float wy = y - y0;
  const auto value = [pixels, width, channel](guint px, guint py) {
    return static_cast<float>(pixels[(static_cast<size_t>(py) * width + px) *
                                     3 + channel]);
  };
  return value(x0, y0) * (1.0F - wx) * (1.0F - wy) +
         value(x1, y0) * wx * (1.0F - wy) +
         value(x0, y1) * (1.0F - wx) * wy + value(x1, y1) * wx * wy;
}

static gboolean image_to_face_tensor(const std::vector<guint8> &pixels,
                                     guint width, guint height,
                                     gboolean has_bbox, gdouble bbox_left,
                                     gdouble bbox_top, gdouble bbox_width,
                                     gdouble bbox_height,
                                     FaceAnalyticsContext *ctx,
                                     float *tensor) {
  if (pixels.empty() || !width || !height) return FALSE;
  float left = 0.0F, top = 0.0F;
  float crop_width = static_cast<float>(width);
  float crop_height = static_cast<float>(height);
  if (has_bbox) {
    left = static_cast<float>(std::max(0.0, bbox_left));
    top = static_cast<float>(std::max(0.0, bbox_top));
    crop_width = static_cast<float>(std::min(
        static_cast<double>(width) - left, bbox_width));
    crop_height = static_cast<float>(std::min(
        static_cast<double>(height) - top, bbox_height));
  }
  if (crop_width < 2.0F || crop_height < 2.0F) return FALSE;

  const guint plane = kAlignedWidth * kAlignedHeight;
  for (guint y = 0; y < kAlignedHeight; ++y) {
    const float source_y = top +
        (static_cast<float>(y) + 0.5F) * crop_height / kAlignedHeight - 0.5F;
    for (guint x = 0; x < kAlignedWidth; ++x) {
      const float source_x = left +
          (static_cast<float>(x) + 0.5F) * crop_width / kAlignedWidth - 0.5F;
      const guint offset = y * kAlignedWidth + x;
      for (guint channel = 0; channel < 3; ++channel) {
        const float value = sample_rgb(pixels.data(), width, height, source_x,
                                       source_y, channel);
        tensor[channel * plane + offset] =
            (value - ctx->normalization_mean) * ctx->normalization_scale;
      }
    }
  }
  return TRUE;
}

static GstPadProbeReturn face_image_query_probe(GstPad *,
                                                 GstPadProbeInfo *info,
                                                 gpointer user_data) {
  if (!(info->type & GST_PAD_PROBE_TYPE_QUERY_DOWNSTREAM))
    return GST_PAD_PROBE_OK;
  GstQuery *query = GST_PAD_PROBE_INFO_QUERY(info);
  auto *ctx = static_cast<FaceAnalyticsContext *>(user_data);
  if (!ctx || !query || !gst_nvquery_is_image_embedding(query))
    return GST_PAD_PROBE_OK;

  const gchar *image_path = nullptr;
  const gchar *model = nullptr;
  gboolean has_bbox = FALSE;
  gdouble left = 0.0, top = 0.0, width = 0.0, height = 0.0;
  if (!gst_nvquery_image_embedding_parse_request(
          query, &image_path, &model, &has_bbox, &left, &top, &width,
          &height) || !model || strcmp(model, "face-recognition") != 0)
    return GST_PAD_PROBE_OK;

  std::vector<guint8> pixels;
  guint image_width = 0, image_height = 0;
  std::vector<float> input(3 * kAlignedWidth * kAlignedHeight);
  std::vector<float> embedding(kEmbeddingDim);
  if (!image_path ||
      !load_jpeg_rgb(image_path, pixels, image_width, image_height) ||
      !image_to_face_tensor(pixels, image_width, image_height, has_bbox, left,
                            top, width, height, ctx, input.data())) {
    g_printerr("[FACE] failed to decode face query image: %s\n",
               image_path ? image_path : "(null)");
    return GST_PAD_PROBE_HANDLED;
  }

  g_mutex_lock(&ctx->encoder_lock);
  const int infer_status = ctx->encoder_infer(
      ctx->encoder, input.data(), 1, embedding.data());
  g_mutex_unlock(&ctx->encoder_lock);
  if (infer_status != 0) {
    g_printerr("[FACE] query image recognition inference failed\n");
    return GST_PAD_PROBE_HANDLED;
  }

  double norm = 0.0;
  for (float value : embedding) norm += static_cast<double>(value) * value;
  norm = std::sqrt(norm);
  if (norm < 1e-12) return GST_PAD_PROBE_HANDLED;
  for (float &value : embedding) value = static_cast<float>(value / norm);

  JsonBuilder *builder = json_builder_new();
  json_builder_begin_array(builder);
  json_builder_begin_object(builder);
  json_builder_set_member_name(builder, "object");
  json_builder_add_string_value(builder, "embedding");
  json_builder_set_member_name(builder, "index");
  json_builder_add_int_value(builder, 0);
  json_builder_set_member_name(builder, "embedding");
  json_builder_begin_array(builder);
  for (float value : embedding) json_builder_add_double_value(builder, value);
  json_builder_end_array(builder);
  json_builder_end_object(builder);
  json_builder_end_array(builder);
  JsonNode *root = json_builder_get_root(builder);
  JsonGenerator *generator = json_generator_new();
  json_generator_set_root(generator, root);
  gchar *json = json_generator_to_data(generator, nullptr);
  gchar *id = g_uuid_string_random();
  GValue data = G_VALUE_INIT;
  g_value_init(&data, G_TYPE_STRING);
  g_value_set_string(&data, json);
  gst_nvquery_image_embedding_set(
      query, id, static_cast<guint64>(g_get_real_time() / G_USEC_PER_SEC),
      model, &data);
  g_value_unset(&data);
  g_free(id);
  g_free(json);
  g_object_unref(generator);
  json_node_free(root);
  g_object_unref(builder);
  g_print("[FACE] generated query embedding from %ux%u image\n",
          image_width, image_height);
  return GST_PAD_PROBE_HANDLED;
}

static std::string timestamp_for_frame(const NvDsFrameMeta *frame_meta) {
  GDateTime *date_time = nullptr;
  if (frame_meta && frame_meta->ntp_timestamp > 1000000000000000ULL) {
    const guint64 timestamp_ns = frame_meta->ntp_timestamp;
    const gint64 seconds =
        static_cast<gint64>(timestamp_ns / 1000000000ULL);
    date_time = g_date_time_new_from_unix_utc(seconds);
    if (date_time) {
      const gint64 microseconds =
          static_cast<gint64>((timestamp_ns % 1000000000ULL) / 1000ULL);
      GDateTime *precise = g_date_time_add(date_time, microseconds);
      g_date_time_unref(date_time);
      date_time = precise;
    }
  }
  if (!date_time) date_time = g_date_time_new_now_utc();
  gchar *formatted = g_date_time_format(date_time, "%Y-%m-%dT%H:%M:%S.%fZ");
  std::string result = formatted ? formatted : "";
  g_free(formatted);
  g_date_time_unref(date_time);
  return result;
}

static gboolean publish_face(FaceAnalyticsContext *ctx,
                             const FaceCandidate &candidate,
                             const float *embedding) {
  if (!ctx->kafka_enabled || !ctx->broker) return TRUE;

  JsonBuilder *builder = json_builder_new();
  json_builder_begin_object(builder);
  json_builder_set_member_name(builder, "type");
  json_builder_add_string_value(builder, "mdx-face");
  json_builder_set_member_name(builder, "Id");
  const std::string document_id =
      std::to_string(ctx->session_id) + ":" + candidate.key;
  json_builder_add_string_value(builder, document_id.c_str());
  json_builder_set_member_name(builder, "timestamp");
  const std::string timestamp = timestamp_for_frame(candidate.frame_meta);
  json_builder_add_string_value(builder, timestamp.c_str());
  json_builder_set_member_name(builder, "sourceId");
  json_builder_add_int_value(builder, candidate.frame_meta->source_id);
  json_builder_set_member_name(builder, "sensorId");
  json_builder_add_string_value(builder, candidate.sensor_id.c_str());
  json_builder_set_member_name(builder, "frameId");
  json_builder_add_int_value(builder, candidate.frame_meta->frame_num);
  json_builder_set_member_name(builder, "personId");
  json_builder_add_string_value(builder,
      std::to_string(candidate.person_id).c_str());
  json_builder_set_member_name(builder, "detectorConfidence");
  json_builder_add_double_value(builder, candidate.confidence);
  json_builder_set_member_name(builder, "quality");
  json_builder_add_double_value(builder, candidate.quality);
  json_builder_set_member_name(builder, "model");
  json_builder_add_string_value(builder,
      "obr_face_recog.vit_l.i112x112.db.v1.2.1");

  json_builder_set_member_name(builder, "bbox");
  json_builder_begin_object(builder);
  json_builder_set_member_name(builder, "left");
  json_builder_add_double_value(builder, candidate.bbox[0]);
  json_builder_set_member_name(builder, "top");
  json_builder_add_double_value(builder, candidate.bbox[1]);
  json_builder_set_member_name(builder, "width");
  json_builder_add_double_value(builder, candidate.bbox[2]);
  json_builder_set_member_name(builder, "height");
  json_builder_add_double_value(builder, candidate.bbox[3]);
  json_builder_end_object(builder);

  json_builder_set_member_name(builder, "landmarks");
  json_builder_begin_array(builder);
  for (float landmark : candidate.landmarks)
    json_builder_add_double_value(builder, landmark);
  json_builder_end_array(builder);

  json_builder_set_member_name(builder, "embedding");
  json_builder_begin_object(builder);
  json_builder_set_member_name(builder, "vector");
  json_builder_begin_array(builder);
  for (guint i = 0; i < kEmbeddingDim; ++i)
    json_builder_add_double_value(builder, embedding[i]);
  json_builder_end_array(builder);
  json_builder_end_object(builder);
  json_builder_end_object(builder);

  JsonGenerator *generator = json_generator_new();
  JsonNode *root = json_builder_get_root(builder);
  json_generator_set_root(generator, root);
  gchar *payload = json_generator_to_data(generator, nullptr);
  json_node_free(root);
  g_object_unref(generator);
  g_object_unref(builder);
  if (!payload) return FALSE;

  auto *pending = new PendingPayload();
  pending->data = payload;
  NvMsgBrokerClientMsg message{};
  message.topic = const_cast<char *>(ctx->kafka_topic.c_str());
  message.payload = payload;
  message.payload_len = strlen(payload);
  const NvMsgBrokerErrorType status = nv_msgbroker_send_async(
      ctx->broker, message, broker_send_cb, pending);
  if (status != NV_MSGBROKER_API_OK) {
    g_printerr("[FACE_KAFKA] send rejected status=%d\n",
               static_cast<int>(status));
    g_free(payload);
    delete pending;
    return FALSE;
  }
  return TRUE;
}

static NvDsInferTensorMeta *find_detector_tensor(NvDsFrameMeta *frame_meta) {
  for (NvDsMetaList *item = frame_meta->frame_user_meta_list; item;
       item = item->next) {
    auto *user_meta = static_cast<NvDsUserMeta *>(item->data);
    if (!user_meta ||
        user_meta->base_meta.meta_type != NVDSINFER_TENSOR_OUTPUT_META)
      continue;
    auto *tensor =
        static_cast<NvDsInferTensorMeta *>(user_meta->user_meta_data);
    if (tensor && tensor->unique_id == kFaceDetectorUniqueId) return tensor;
  }
  return nullptr;
}

static void collect_candidates(FaceAnalyticsContext *ctx,
                               NvDsFrameMeta *frame_meta,
                               std::vector<FaceCandidate> &candidates) {
  NvDsInferTensorMeta *tensor = find_detector_tensor(frame_meta);
  if (!tensor) return;

  NvDsInferLayerInfo *output = nullptr;
  for (guint i = 0; i < tensor->num_output_layers; ++i) {
    NvDsInferLayerInfo *layer = &tensor->output_layers_info[i];
    if ((layer->layerName && strcmp(layer->layerName, "new_output") == 0) ||
        tensor->num_output_layers == 1) {
      layer->buffer = tensor->out_buf_ptrs_host[i];
      output = layer;
      break;
    }
  }
  if (!output || !output->buffer ||
      output->dataType != FLOAT) return;

  const guint elements = output->inferDims.numElements;
  if (elements < kDetectorRowSize || elements % kDetectorRowSize != 0) {
    g_printerr("[FACE_DETECT] unexpected output elements=%u\n", elements);
    return;
  }
  const float *rows = static_cast<const float *>(output->buffer);
  const guint row_count = elements / kDetectorRowSize;
  const float surface_width = frame_meta->pipeline_width
                                  ? frame_meta->pipeline_width
                                  : frame_meta->source_frame_width;
  const float surface_height = frame_meta->pipeline_height
                                   ? frame_meta->pipeline_height
                                   : frame_meta->source_frame_height;
  if (surface_width <= 0.0F || surface_height <= 0.0F) return;

  const float fit = std::min(480.0F / surface_width,
                             480.0F / surface_height);
  const float pad_x = (480.0F - surface_width * fit) * 0.5F;
  const float pad_y = (480.0F - surface_height * fit) * 0.5F;
  guint batch_rows = 0;
  guint threshold_rows = 0;
  guint sized_rows = 0;
  guint landmark_rows = 0;
  guint person_rows = 0;
  guint accepted_rows = 0;
  float max_confidence = 0.0F;
  for (guint row_index = 0; row_index < row_count; ++row_index) {
    const float *row = rows + row_index * kDetectorRowSize;
    // Exported NMS row: batch_id, bbox(4), face_score, landmarks(10).
    const gint detection_batch = static_cast<gint>(std::lround(row[0]));
    if (detection_batch != static_cast<gint>(frame_meta->batch_id)) continue;
    ++batch_rows;
    const float confidence = row[5];
    if (std::isfinite(confidence))
      max_confidence = std::max(max_confidence, confidence);
    if (!std::isfinite(confidence) || confidence < ctx->detector_threshold)
      continue;
    ++threshold_rows;

    float x1 = (row[1] - pad_x) / fit;
    float y1 = (row[2] - pad_y) / fit;
    float x2 = (row[3] - pad_x) / fit;
    float y2 = (row[4] - pad_y) / fit;
    x1 = std::max(0.0F, std::min(x1, surface_width - 1.0F));
    y1 = std::max(0.0F, std::min(y1, surface_height - 1.0F));
    x2 = std::max(0.0F, std::min(x2, surface_width));
    y2 = std::max(0.0F, std::min(y2, surface_height));
    if (x2 <= x1 || y2 <= y1 ||
        std::min(x2 - x1, y2 - y1) < ctx->minimum_face_size)
      continue;
    ++sized_rows;

    FaceCandidate candidate;
    candidate.frame_meta = frame_meta;
    candidate.batch_id = frame_meta->batch_id;
    candidate.bbox[0] = x1;
    candidate.bbox[1] = y1;
    candidate.bbox[2] = x2 - x1;
    candidate.bbox[3] = y2 - y1;
    candidate.confidence = confidence;
    gboolean landmarks_valid = TRUE;
    for (guint i = 0; i < 5; ++i) {
      candidate.landmarks[i * 2] = (row[6 + i * 2] - pad_x) / fit;
      candidate.landmarks[i * 2 + 1] =
          (row[7 + i * 2] - pad_y) / fit;
      landmarks_valid = landmarks_valid &&
          std::isfinite(candidate.landmarks[i * 2]) &&
          std::isfinite(candidate.landmarks[i * 2 + 1]);
    }
    if (!landmarks_valid) continue;
    ++landmark_rows;

    NvDsObjectMeta *person = find_person(frame_meta, candidate.bbox);
    if (person) candidate.person_id = person->object_id;
    if (ctx->require_person &&
        candidate.person_id == UNTRACKED_OBJECT_ID) continue;
    ++person_rows;
    if (candidate.person_id == UNTRACKED_OBJECT_ID) {
      const guint grid_x = static_cast<guint>(candidate.bbox[0] / 64.0F);
      const guint grid_y = static_cast<guint>(candidate.bbox[1] / 64.0F);
      const guint64 time_bucket = static_cast<guint64>(frame_meta->frame_num) /
                                  ctx->fallback_bucket_frames;
      candidate.key = std::to_string(frame_meta->source_id) + ":bbox:" +
                      std::to_string(grid_x) + ":" + std::to_string(grid_y) +
                      ":" + std::to_string(time_bucket);
    } else {
      candidate.key = make_candidate_key(frame_meta->source_id,
                                         candidate.person_id);
    }
    const char *sensor = frame_meta->sensorInfo_meta.sensor_id;
    if (!sensor || !*sensor) sensor = frame_meta->sensorInfo_meta.sensor_name;
    candidate.sensor_id = sensor && *sensor
                              ? sensor
                              : std::to_string(frame_meta->source_id);
    candidate.quality = face_quality(candidate.bbox, candidate.landmarks,
                                     candidate.confidence);

    g_mutex_lock(&ctx->state_lock);
    auto found = ctx->best_faces.find(candidate.key);
    if (found != ctx->best_faces.end() &&
        candidate.quality < found->second.quality +
                                ctx->minimum_quality_gain) {
      found->second.last_frame = frame_meta->frame_num;
      g_mutex_unlock(&ctx->state_lock);
      continue;
    }
    g_mutex_unlock(&ctx->state_lock);
    candidates.push_back(std::move(candidate));
    ++accepted_rows;
  }
  if (ctx->detector_debug) {
    ++ctx->detector_debug_frames;
    if (threshold_rows > 0 || ctx->detector_debug_frames % 50 == 0) {
      g_print("[FACE_DEBUG] source=%u frame=%d rows=%u batch=%u "
              "threshold=%u size=%u landmarks=%u person=%u accepted=%u "
              "max_confidence=%.3f configured_threshold=%.2f\n",
              frame_meta->source_id, frame_meta->frame_num, row_count,
              batch_rows, threshold_rows, sized_rows, landmark_rows,
              person_rows, accepted_rows, max_confidence,
              ctx->detector_threshold);
    }
  }
}

static void prune_states(FaceAnalyticsContext *ctx, guint64 current_frame) {
  g_mutex_lock(&ctx->state_lock);
  for (auto item = ctx->best_faces.begin(); item != ctx->best_faces.end();) {
    if (item->second.last_frame + ctx->state_max_age_frames < current_frame)
      item = ctx->best_faces.erase(item);
    else
      ++item;
  }
  g_mutex_unlock(&ctx->state_lock);
}

static GstPadProbeReturn drop_invalid_face_batch(GstPad *,
                                                  GstPadProbeInfo *info,
                                                  gpointer) {
  if (!(info->type & GST_PAD_PROBE_TYPE_BUFFER)) return GST_PAD_PROBE_OK;
  auto *buffer = GST_PAD_PROBE_INFO_BUFFER(info);
  if (!buffer) return GST_PAD_PROBE_DROP;
  NvDsBatchMeta *batch_meta = gst_buffer_get_nvds_batch_meta(buffer);
  if (!batch_meta || !batch_meta->frame_meta_list ||
      batch_meta->num_frames_in_batch == 0) {
    g_print("[FACE] dropped empty batch before RGBA conversion\n");
    return GST_PAD_PROBE_DROP;
  }
  return GST_PAD_PROBE_OK;
}

static GstPadProbeReturn face_probe(GstPad *, GstPadProbeInfo *info,
                                    gpointer user_data) {
  auto *ctx = static_cast<FaceAnalyticsContext *>(user_data);
  auto *buffer = static_cast<GstBuffer *>(info->data);
  if (!ctx || !buffer || !(info->type & GST_PAD_PROBE_TYPE_BUFFER))
    return GST_PAD_PROBE_OK;

  NvDsBatchMeta *batch_meta = gst_buffer_get_nvds_batch_meta(buffer);
  if (!batch_meta) return GST_PAD_PROBE_OK;
  std::vector<FaceCandidate> candidates;
  guint64 newest_frame = 0;
  for (NvDsMetaList *item = batch_meta->frame_meta_list; item;
       item = item->next) {
    auto *frame_meta = static_cast<NvDsFrameMeta *>(item->data);
    if (!frame_meta) continue;
    newest_frame = std::max(newest_frame,
                            static_cast<guint64>(frame_meta->frame_num));
    collect_candidates(ctx, frame_meta, candidates);
  }
  if (candidates.empty()) {
    if (newest_frame && newest_frame % 300 == 0)
      prune_states(ctx, newest_frame);
    return GST_PAD_PROBE_OK;
  }

  GstMapInfo map{};
  if (!gst_buffer_map(buffer, &map, GST_MAP_READ)) {
    g_printerr("[FACE] failed to map GstBuffer\n");
    return GST_PAD_PROBE_OK;
  }
  auto *surface = reinterpret_cast<NvBufSurface *>(map.data);
  const size_t tensor_size =
      static_cast<size_t>(candidates.size()) * 3 * kAlignedWidth *
      kAlignedHeight;
  std::vector<float> input(tensor_size);
  std::vector<FaceCandidate> aligned;
  aligned.reserve(candidates.size());

  for (const FaceCandidate &candidate : candidates) {
    if (candidate.batch_id >= surface->batchSize) continue;
    const int map_status = NvBufSurfaceMap(
        surface, static_cast<int>(candidate.batch_id), 0, NVBUF_MAP_READ);
    if (map_status != 0) {
      g_printerr("[FACE] NvBufSurfaceMap failed batch=%u status=%d\n",
                 candidate.batch_id, map_status);
      continue;
    }
    NvBufSurfaceSyncForCpu(surface, static_cast<int>(candidate.batch_id), 0);
    float *destination = input.data() +
        static_cast<size_t>(aligned.size()) * 3 * kAlignedWidth *
            kAlignedHeight;
    const gboolean ok = align_face_to_tensor(
        surface->surfaceList[candidate.batch_id], candidate.landmarks, ctx,
        destination);
    NvBufSurfaceUnMap(surface, static_cast<int>(candidate.batch_id), 0);
    if (ok) aligned.push_back(candidate);
  }
  gst_buffer_unmap(buffer, &map);
  if (aligned.empty()) return GST_PAD_PROBE_OK;

  std::vector<float> embeddings(aligned.size() * kEmbeddingDim);
  const size_t image_stride = 3 * kAlignedWidth * kAlignedHeight;
  for (size_t offset = 0; offset < aligned.size();
       offset += ctx->max_recognition_batch) {
    const guint count = static_cast<guint>(std::min<size_t>(
        ctx->max_recognition_batch, aligned.size() - offset));
    g_mutex_lock(&ctx->encoder_lock);
    const int infer_status = ctx->encoder_infer(
        ctx->encoder, input.data() + offset * image_stride,
        static_cast<int>(count), embeddings.data() + offset * kEmbeddingDim);
    g_mutex_unlock(&ctx->encoder_lock);
    if (infer_status != 0) {
      g_printerr("[FACE] recognition inference failed batch=%u\n", count);
      return GST_PAD_PROBE_OK;
    }
  }

  for (size_t i = 0; i < aligned.size(); ++i) {
    float *embedding = embeddings.data() + i * kEmbeddingDim;
    double norm = 0.0;
    for (guint j = 0; j < kEmbeddingDim; ++j)
      norm += static_cast<double>(embedding[j]) * embedding[j];
    norm = std::sqrt(norm);
    if (norm < 1e-12) continue;
    for (guint j = 0; j < kEmbeddingDim; ++j)
      embedding[j] = static_cast<float>(embedding[j] / norm);
    if (publish_face(ctx, aligned[i], embedding)) {
      g_mutex_lock(&ctx->state_lock);
      ctx->best_faces[aligned[i].key] =
          {aligned[i].quality, aligned[i].frame_meta->frame_num};
      g_mutex_unlock(&ctx->state_lock);
      g_print("[FACE] published source=%u frame=%d person=%" G_GUINT64_FORMAT
              " confidence=%.3f quality=%.3f\n",
              aligned[i].frame_meta->source_id,
              aligned[i].frame_meta->frame_num, aligned[i].person_id,
              aligned[i].confidence, aligned[i].quality);
    }
  }
  if (newest_frame && newest_frame % 300 == 0)
    prune_states(ctx, newest_frame);
  return GST_PAD_PROBE_OK;
}

static gboolean link_tee_to_element(GstElement *tee, GstElement *element) {
  GstPad *tee_pad = gst_element_request_pad_simple(tee, "src_%u");
  GstPad *sink_pad = gst_element_get_static_pad(element, "sink");
  if (!tee_pad || !sink_pad) {
    if (tee_pad) gst_object_unref(tee_pad);
    if (sink_pad) gst_object_unref(sink_pad);
    return FALSE;
  }
  const gboolean linked = gst_pad_link(tee_pad, sink_pad) == GST_PAD_LINK_OK;
  gst_object_unref(tee_pad);
  gst_object_unref(sink_pad);
  return linked;
}

static gboolean initialize_encoder(FaceAnalyticsContext *ctx) {
  const char *library_path = env_string(
      "FACE_ENCODER_RUNTIME_LIB",
      "/opt/nvidia/deepstream/deepstream/lib/gst-plugins/"
      "libnvdsgst_visionencoder.so");
  ctx->encoder_lib = dlopen(library_path, RTLD_NOW | RTLD_LOCAL);
  if (!ctx->encoder_lib) {
    g_printerr("[FACE] failed to load encoder runtime: %s\n", dlerror());
    return FALSE;
  }
  auto create = reinterpret_cast<EncoderCreate>(
      dlsym(ctx->encoder_lib, "nvds_triton_client_create"));
  ctx->encoder_destroy = reinterpret_cast<EncoderDestroy>(
      dlsym(ctx->encoder_lib, "nvds_triton_client_destroy"));
  auto get_dim = reinterpret_cast<EncoderGetDim>(
      dlsym(ctx->encoder_lib, "nvds_triton_client_get_embedding_dim"));
  auto get_size = reinterpret_cast<EncoderGetSize>(
      dlsym(ctx->encoder_lib, "nvds_triton_client_get_input_size"));
  ctx->encoder_infer = reinterpret_cast<EncoderInfer>(
      dlsym(ctx->encoder_lib, "nvds_triton_client_infer"));
  if (!create || !ctx->encoder_destroy || !get_dim || !get_size ||
      !ctx->encoder_infer) {
    g_printerr("[FACE] encoder runtime symbols are unavailable\n");
    return FALSE;
  }

  const char *engine = env_string(
      "FACE_RECOGNITION_ENGINE",
      "/opt/engines/obr_face_recog.vit_l.i112x112.db.v1.2.1_"
      "b32_gpu0_fp16.engine");
  const char *onnx = env_string(
      "FACE_RECOGNITION_ONNX",
      "/opt/models/custom/obr_face_recog.vit_l.i112x112.db.v1.2.1.onnx");
  ctx->encoder = create(engine, "face-recognition",
                        static_cast<int>(ctx->max_recognition_batch), onnx);
  if (!ctx->encoder) {
    g_printerr("[FACE] failed to initialize recognition engine\n");
    return FALSE;
  }
  unsigned int width = 0, height = 0;
  if (get_size(ctx->encoder, &width, &height) != 0 ||
      width != kAlignedWidth || height != kAlignedHeight ||
      get_dim(ctx->encoder) != static_cast<int>(kEmbeddingDim)) {
    g_printerr("[FACE] recognition shape mismatch input=%ux%u output=%d\n",
               width, height, get_dim(ctx->encoder));
    return FALSE;
  }
  return TRUE;
}

static gboolean initialize_broker(FaceAnalyticsContext *ctx) {
  ctx->kafka_enabled = env_bool("FACE_KAFKA_ENABLE", TRUE);
  if (!ctx->kafka_enabled) return TRUE;
  const char *connection =
      env_string("FACE_KAFKA_CONNECTION", "localhost;9092;mdx-face");
  const char *protocol = env_string(
      "FACE_KAFKA_PROTOCOL_LIB",
      "/opt/nvidia/deepstream/deepstream/lib/libnvds_kafka_proto.so");
  ctx->kafka_topic = env_string("FACE_KAFKA_TOPIC", "mdx-face");
  ctx->broker = nv_msgbroker_connect(const_cast<char *>(connection),
      const_cast<char *>(protocol), broker_connect_cb, nullptr);
  if (!ctx->broker) {
    g_printerr("[FACE_KAFKA] failed to connect using %s\n", connection);
    return FALSE;
  }
  return TRUE;
}

static GstPadProbeReturn face_drain_event_probe(GstPad *, GstPadProbeInfo *info,
                                                gpointer user_data) {
  auto *ctx = static_cast<FaceAnalyticsContext *>(user_data);
  if (!ctx || !(info->type & GST_PAD_PROBE_TYPE_EVENT_DOWNSTREAM))
    return GST_PAD_PROBE_OK;

  auto *event = GST_PAD_PROBE_INFO_EVENT(info);
  if (!event || GST_EVENT_TYPE(event) !=
                    static_cast<GstEventType>(GST_NVEVENT_STREAM_EOS))
    return GST_PAD_PROBE_OK;

  guint source_id = 0;
  gst_nvevent_parse_stream_eos(event, &source_id);
  g_print("[SOURCE_DRAIN] source=%u face-branch drained\n", source_id);
  if (ctx->drain_callback)
    ctx->drain_callback(source_id, ctx->drain_user_data);
  return GST_PAD_PROBE_OK;
}

}  // namespace

extern "C" gboolean rtvi_face_analytics_enabled(void) {
  return env_bool("FACE_ANALYTICS_ENABLE", TRUE);
}

extern "C" gboolean rtvi_create_face_analytics_branch(
    GstElement *pipeline, GstElement *post_tracker_tee,
    guint stream_batch_size, RtviFaceDrainCallback drain_callback,
    gpointer drain_user_data) {
  if (!rtvi_face_analytics_enabled()) {
    g_print("[FACE] analytics branch disabled\n");
    return TRUE;
  }
  if (!pipeline || !post_tracker_tee) return FALSE;

  auto *ctx = new FaceAnalyticsContext();
  g_mutex_init(&ctx->state_lock);
  g_mutex_init(&ctx->encoder_lock);
  ctx->max_recognition_batch = env_uint("FACE_RECOGNITION_BATCH", 32);
  ctx->detector_threshold = env_float("FACE_DETECT_THRESHOLD", 0.70F);
  ctx->minimum_quality_gain = env_float("FACE_MIN_QUALITY_GAIN", 0.02F);
  ctx->minimum_face_size = env_uint("FACE_MIN_SIZE", 40);
  ctx->state_max_age_frames = env_uint("FACE_STATE_MAX_AGE_FRAMES", 300);
  ctx->fallback_bucket_frames =
      std::max(1U, env_uint("FACE_FALLBACK_BUCKET_FRAMES", 30));
  ctx->detector_debug = env_bool("FACE_DEBUG", FALSE);
  ctx->require_person = env_bool("FACE_REQUIRE_PERSON", TRUE);
  ctx->normalization_mean = env_float("FACE_NORMALIZATION_MEAN", 127.5F);
  ctx->normalization_scale =
      env_float("FACE_NORMALIZATION_SCALE", 1.0F / 127.5F);
  ctx->session_id = static_cast<guint64>(g_get_real_time());
  ctx->drain_callback = drain_callback;
  ctx->drain_user_data = drain_user_data;
  if (!initialize_encoder(ctx) || !initialize_broker(ctx)) {
    destroy_context(ctx);
    return FALSE;
  }

  GstElement *bin = gst_bin_new("face_analytics_bin");
  GstElement *queue = gst_element_factory_make("queue", "face_queue");
  GstElement *converter =
      gst_element_factory_make("nvvideoconvert", "face_rgba_converter");
  GstElement *caps_filter =
      gst_element_factory_make("capsfilter", "face_rgba_caps");
  GstElement *detector =
      gst_element_factory_make("nvinferserver", "face_detector");
  GstElement *sink = gst_element_factory_make("fakesink", "face_sink");
  if (!bin || !queue || !converter || !caps_filter || !detector || !sink) {
    g_printerr("[FACE] failed to create GStreamer elements\n");
    if (bin) gst_object_unref(bin);
    destroy_context(ctx);
    return FALSE;
  }

  g_object_set(queue, "max-size-buffers", 1, "max-size-bytes", 0,
               "max-size-time", static_cast<guint64>(0), "leaky", 2,
               "flush-on-eos", FALSE, nullptr);
  g_object_set(converter, "gpu-id", 0, "nvbuf-memory-type", 3, nullptr);
  GstCaps *rgba_caps = gst_caps_from_string(
      "video/x-raw(memory:NVMM), format=(string)RGBA");
  g_object_set(caps_filter, "caps", rgba_caps, nullptr);
  gst_caps_unref(rgba_caps);
  const char *detector_config = env_string(
      "FACE_DETECTOR_CONFIG",
      "/opt/nvidia/deepstream/deepstream/sources/apps/sample_apps/"
      "metropolis_perception_app/configs/ds-face-detector-triton-config.txt");
  if (!g_file_test(detector_config, G_FILE_TEST_EXISTS)) {
    g_printerr("[FACE] detector config not found: %s\n", detector_config);
    gst_object_unref(bin);
    destroy_context(ctx);
    return FALSE;
  }
  g_object_set(detector, "config-file-path", detector_config, "batch-size",
               std::max(1U, stream_batch_size), nullptr);
  g_object_set(sink, "sync", FALSE, "async", FALSE,
               "enable-last-sample", FALSE, nullptr);

  gst_bin_add_many(GST_BIN(bin), queue, converter, caps_filter, detector, sink,
                   nullptr);
  if (!gst_element_link_many(queue, converter, caps_filter, detector, sink,
                             nullptr)) {
    g_printerr("[FACE] failed to link face branch elements\n");
    gst_object_unref(bin);
    destroy_context(ctx);
    return FALSE;
  }
  GstPad *queue_sink = gst_element_get_static_pad(queue, "sink");
  GstPad *ghost = gst_ghost_pad_new("sink", queue_sink);
  gst_object_unref(queue_sink);
  if (!ghost || !gst_element_add_pad(bin, ghost)) {
    g_printerr("[FACE] failed to create face bin ghost pad\n");
    if (ghost) gst_object_unref(ghost);
    gst_object_unref(bin);
    destroy_context(ctx);
    return FALSE;
  }
  GstPad *detector_src = gst_element_get_static_pad(detector, "src");
  gst_pad_add_probe(detector_src, GST_PAD_PROBE_TYPE_BUFFER, face_probe, ctx,
                    nullptr);
  gst_object_unref(detector_src);
  GstPad *sink_pad = gst_element_get_static_pad(sink, "sink");
  gst_pad_add_probe(sink_pad, GST_PAD_PROBE_TYPE_EVENT_DOWNSTREAM,
                    face_drain_event_probe, ctx, nullptr);
  gst_object_unref(sink_pad);
  GstPad *queue_src = gst_element_get_static_pad(queue, "src");
  gst_pad_add_probe(queue_src, GST_PAD_PROBE_TYPE_BUFFER,
                    drop_invalid_face_batch, nullptr, nullptr);
  gst_object_unref(queue_src);
  g_object_set_data_full(G_OBJECT(bin), "rtvi-face-context", ctx,
                         destroy_context);

  if (!gst_bin_add(GST_BIN(pipeline), bin) ||
      !link_tee_to_element(post_tracker_tee, bin)) {
    g_printerr("[FACE] failed to attach face branch to post-tracker tee\n");
    if (GST_OBJECT_PARENT(bin)) gst_bin_remove(GST_BIN(pipeline), bin);
    else gst_object_unref(bin);
    return FALSE;
  }
  ctx->query_pad = gst_element_get_static_pad(post_tracker_tee, "sink");
  if (ctx->query_pad) {
    ctx->query_probe_id = gst_pad_add_probe(
        ctx->query_pad, GST_PAD_PROBE_TYPE_QUERY_DOWNSTREAM,
        face_image_query_probe, ctx, nullptr);
  }

  g_print("[FACE] branch created detector_batch=%u recognition_batch=%u "
          "threshold=%.2f require_person=%d debug=%d topic=%s\n",
          std::max(1U, stream_batch_size), ctx->max_recognition_batch,
          ctx->detector_threshold, ctx->require_person, ctx->detector_debug,
          ctx->kafka_topic.c_str());
  return TRUE;
}

extern "C" void rtvi_face_analytics_source_removed(GstElement *pipeline,
                                                     guint source_id) {
  if (!pipeline || !rtvi_face_analytics_enabled()) return;
  GstElement *bin = gst_bin_get_by_name(GST_BIN(pipeline),
                                        "face_analytics_bin");
  if (!bin) return;

  auto *ctx = static_cast<FaceAnalyticsContext *>(
      g_object_get_data(G_OBJECT(bin), "rtvi-face-context"));
  guint removed = 0;
  if (ctx) {
    const std::string prefix = std::to_string(source_id) + ":";
    g_mutex_lock(&ctx->state_lock);
    for (auto item = ctx->best_faces.begin(); item != ctx->best_faces.end();) {
      if (item->first.compare(0, prefix.size(), prefix) == 0) {
        item = ctx->best_faces.erase(item);
        ++removed;
      } else {
        ++item;
      }
    }
    g_mutex_unlock(&ctx->state_lock);
  }

  g_print("[FACE] source=%u removed, cached_states=%u\n", source_id, removed);
  gst_object_unref(bin);
}
