import json

import torch
import triton_python_backend_utils as pb_utils
from torch.utils.dlpack import from_dlpack


def post_process(pred_logits, pred_boxes, pos_maps, target_sizes, device, num_select=300):
    bs = pred_logits.shape[0]
    target_device = torch.device(device)

    prob_to_token = torch.sigmoid(pred_logits.to(target_device))

    pos_maps = pos_maps.to(target_device)
    row_sums = pos_maps.sum(dim=1, keepdim=True)
    pos_maps = torch.where(row_sums > 0, pos_maps / row_sums.clamp_min(1e-12), pos_maps)

    prob = prob_to_token @ pos_maps.T

    topk_indices = torch.topk(prob.view(bs, -1), k=num_select, dim=1, largest=True).indices
    scores = torch.stack(
        [per_batch_prob[ind] for per_batch_prob, ind in zip(prob.view(bs, -1), topk_indices)]
    )

    topk_boxes = topk_indices // prob.shape[2]
    labels = topk_indices % prob.shape[2]

    x_c, y_c, width, height = (
        pred_boxes[..., 0].to(target_device),
        pred_boxes[..., 1].to(target_device),
        pred_boxes[..., 2].to(target_device),
        pred_boxes[..., 3].to(target_device),
    )
    boxes = torch.stack(
        [(x_c - 0.5 * width), (y_c - 0.5 * height), (x_c + 0.5 * width), (y_c + 0.5 * height)],
        dim=-1,
    )
    boxes = torch.gather(boxes, 1, topk_boxes.unsqueeze(-1).expand(-1, -1, 4))

    scaled_target_sizes = target_sizes.to(target_device)
    boxes = boxes * scaled_target_sizes[:, None, :]

    for index, target_size in enumerate(scaled_target_sizes):
        max_width, max_height = target_size[0], target_size[1]
        boxes[index, :, 0::2] = torch.clamp(boxes[index, :, 0::2], 0.0, max_width)
        boxes[index, :, 1::2] = torch.clamp(boxes[index, :, 1::2], 0.0, max_height)

    return (
        labels.detach().cpu().numpy(),
        scores.detach().cpu().numpy(),
        boxes.detach().cpu().numpy(),
    )


class TritonPythonModel:
    def initialize(self, args):
        self.model_config = model_config = json.loads(args["model_config"])

        self.device = "cpu"

        output0_config = pb_utils.get_output_config_by_name(model_config, "labels")
        self.output0_dtype = pb_utils.triton_string_to_numpy(output0_config["data_type"])

        output1_config = pb_utils.get_output_config_by_name(model_config, "boxes")
        self.output1_dtype = pb_utils.triton_string_to_numpy(output1_config["data_type"])

        output2_config = pb_utils.get_output_config_by_name(model_config, "scores")
        self.output2_dtype = pb_utils.triton_string_to_numpy(output2_config["data_type"])

    def execute(self, requests):
        responses = []

        for request in requests:
            in_0 = pb_utils.get_input_tensor_by_name(request, "pred_logits")
            in_1 = pb_utils.get_input_tensor_by_name(request, "pred_boxes")
            in_2 = pb_utils.get_input_tensor_by_name(request, "pos_map")
            in_3 = pb_utils.get_input_tensor_by_name(request, "target_sizes")

            pred_logits = from_dlpack(in_0.to_dlpack())
            pred_boxes = from_dlpack(in_1.to_dlpack())
            pos_map = from_dlpack(in_2.to_dlpack())
            target_sizes = from_dlpack(in_3.to_dlpack())

            class_labels, scores, boxes = post_process(
                pred_logits,
                pred_boxes,
                pos_map[0],
                target_sizes,
                device=self.device,
            )

            inference_response = pb_utils.InferenceResponse(
                output_tensors=[
                    pb_utils.Tensor("labels", class_labels.astype(self.output0_dtype)),
                    pb_utils.Tensor("boxes", boxes.astype(self.output1_dtype)),
                    pb_utils.Tensor("scores", scores.astype(self.output2_dtype)),
                ]
            )
            responses.append(inference_response)

        return responses

    def finalize(self):
        print("Cleaning up...")