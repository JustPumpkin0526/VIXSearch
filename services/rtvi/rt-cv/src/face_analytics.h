#ifndef __RTVI_FACE_ANALYTICS_H__
#define __RTVI_FACE_ANALYTICS_H__

#include <gst/gst.h>

#ifdef __cplusplus
extern "C" {
#endif

gboolean rtvi_face_analytics_enabled(void);

typedef void (*RtviFaceDrainCallback)(guint source_id, gpointer user_data);

gboolean rtvi_create_face_analytics_branch(GstElement *pipeline,
                                            GstElement *post_tracker_tee,
                                            guint stream_batch_size,
                                            RtviFaceDrainCallback drain_callback,
                                            gpointer drain_user_data);

void rtvi_face_analytics_source_removed(GstElement *pipeline,
                                        guint source_id);

#ifdef __cplusplus
}
#endif

#endif
