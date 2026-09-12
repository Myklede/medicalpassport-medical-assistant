"""Binary wound isolation regressions; fixtures never download model weights."""
import base64
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import cv2
import numpy as np
import segmentation_models_pytorch as smp
import torch
from torch import nn

import visual_pipeline as visuals


def write_binary_fixture(path):
    """Controlled single-logit SMP fixture, not a trained/clinical model."""
    with torch.random.fork_rng():
        torch.manual_seed(93)
        model = smp.Unet(encoder_name="resnet34", encoder_weights=None, in_channels=3, classes=1)
    with torch.no_grad():
        model.segmentation_head[0].weight.zero_()
        model.segmentation_head[0].bias.fill_(1.0)
    torch.save(model.state_dict(), path)


def decode(encoded):
    return cv2.imdecode(np.frombuffer(base64.b64decode(encoded, validate=True), np.uint8), cv2.IMREAD_UNCHANGED)


class FixedBinary(nn.Module):
    def __init__(self, probability):
        super().__init__()
        self.probability = torch.as_tensor(probability, dtype=torch.float32).expand(256, 256)

    def forward(self, image):
        return torch.logit(self.probability)[None, None]


class AllSlough(nn.Module):
    def forward(self, image):
        logits = torch.zeros((1, 4, 64, 64))
        logits[:, 2] = 1.0  # Deliberately labels even surrounding skin as tissue.
        return logits


class BinaryVisualTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        cls.temporary = TemporaryDirectory(prefix="pwc-binary-tests-", dir=visuals.ROOT / "outputs")
        cls.root = Path(cls.temporary.name)
        cls.checkpoint = cls.root / "binary.pt"
        write_binary_fixture(cls.checkpoint)
        # Non-square, larger than the old 512 px preview limit.
        cls.rgb = np.tile(np.array([100, 160, 210], np.uint8), (317, 901, 1))
        cls.image_path = cls.root / "input.png"
        ok, png = cv2.imencode(".png", cv2.cvtColor(cls.rgb, cv2.COLOR_RGB2BGR))
        assert ok
        cls.image_path.write_bytes(png.tobytes())

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def test_smp_state_dict_loads_on_cpu_in_eval_mode(self):
        model = visuals.load_wound_model(self.checkpoint)
        self.assertIsInstance(model, smp.Unet)
        self.assertFalse(model.training)
        self.assertTrue(all(p.device.type == "cpu" for p in model.parameters()))
        with torch.inference_mode():
            output = model(visuals.prepare_wound_tensor(self.rgb))
        self.assertEqual(tuple(output.shape), (1, 1, 256, 256))
        self.assertTrue(torch.equal(output, torch.ones_like(output)))

    def test_common_wrappers_and_incompatible_weights(self):
        state = torch.load(self.checkpoint, map_location="cpu", weights_only=True)
        for key in ("state_dict", "model_state_dict"):
            with patch.object(visuals.torch, "load", return_value={key: state}):
                self.assertIsInstance(visuals.load_wound_model(self.checkpoint), smp.Unet)
        for invalid in ([], {}, {"head.weight": torch.tensor(float("nan"))}, {"wrong.layer": torch.ones(1)}):
            with patch.object(visuals.torch, "load", return_value=invalid):
                with self.assertRaises((ValueError, RuntimeError)):
                    visuals.load_wound_model(self.checkpoint)

    def test_rgb_imagenet_normalization_and_256_tensor(self):
        tensor = visuals.prepare_wound_tensor(self.rgb)
        self.assertEqual(tuple(tensor.shape), (1, 3, 256, 256))
        self.assertEqual(tensor.dtype, torch.float32)
        self.assertEqual(tensor.device.type, "cpu")
        expected = (np.array([100, 160, 210]) / 255.0 - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
        np.testing.assert_allclose(tensor[0, :, 0, 0].numpy(), expected, atol=1e-6)

    def test_strict_sigmoid_threshold_and_original_size(self):
        probabilities = torch.full((256, 256), 0.34)
        probabilities[:, 64:128] = 0.35
        probabilities[:, 128:192] = 0.36
        probabilities[:, 192:] = 0.9
        predicted = visuals.predict_wound_mask(self.rgb, FixedBinary(probabilities))
        self.assertEqual(predicted.shape, self.rgb.shape[:2])
        self.assertEqual(predicted.dtype, np.bool_)
        expected = cv2.resize((probabilities.numpy() > 0.35).astype(np.uint8), (901, 317), interpolation=cv2.INTER_NEAREST)
        np.testing.assert_array_equal(predicted, expected.astype(bool))

    def test_invalid_binary_outputs_are_rejected(self):
        for output in (torch.ones(1, 4, 256, 256), torch.full((1, 1, 256, 256), float("nan"))):
            with self.subTest(shape=output.shape), self.assertRaises(ValueError):
                visuals.predict_wound_mask(self.rgb, lambda image: output)

    def test_overlay_is_clipped_even_when_tissue_model_labels_all_skin(self):
        probabilities = torch.full((256, 256), 0.1)
        probabilities[60:200, 70:180] = 0.8
        with patch.object(visuals, "load_wound_model", return_value=FixedBinary(probabilities)), \
             patch.object(visuals, "load_visual_model", return_value=(AllSlough(), {"epoch": 1})):
            result = visuals.build_pipeline_visuals(self.image_path, self.checkpoint,
                {"usable_for_demo": True}, 7, self.checkpoint)
        self.assertEqual(result["status"], "available")
        self.assertEqual(result["tissue_status"], "available")
        self.assertEqual(result["processed_size"], {"width": 901, "height": 317})
        isolated, overlay = decode(result["unet_segmentation_mask"]), decode(result["tissue_analysis_overlay"])
        mask = isolated[..., 3] > 0
        self.assertTrue(mask.any() and (~mask).any())
        np.testing.assert_array_equal(mask, visuals.predict_wound_mask(self.rgb, FixedBinary(probabilities)))
        np.testing.assert_array_equal(overlay[~mask], self.rgb[..., ::-1][~mask])
        self.assertTrue(np.any(overlay[mask] != self.rgb[..., ::-1][mask]))
        self.assertEqual(isolated.shape, (317, 901, 4))
        self.assertEqual(overlay.shape, self.rgb.shape)

    def test_binary_alpha_keeps_dark_and_unclassified_wound_pixels(self):
        rgb = np.array([[[0, 0, 0], [140, 160, 180], [220, 180, 80]]], np.uint8)
        # Tissue class zero inside the wound must not erase the binary mask.
        labels, mask = np.array([[1, 0, 2]], np.uint8), np.array([[True, True, False]])
        isolated, overlay = visuals.render_segmentation(rgb, labels, mask)
        self.assertEqual(decode(isolated)[0, :, 3].tolist(), [255, 255, 0])
        np.testing.assert_array_equal(decode(overlay)[0, 2], rgb[0, 2, ::-1])

    def test_classifier_input_excludes_background_before_resizing(self):
        mask = np.zeros((12, 12), dtype=bool)
        mask[2:10, 2:10] = True
        mask[4:8, 4:8] = False  # A skin island inside the bounding box.
        first = np.full((12, 12, 3), 30, np.uint8)
        second = first.copy()
        second[~mask] = 255
        captured = []
        def classifier(tensor):
            captured.append(tensor.clone())
            return AllSlough()(tensor)
        a = visuals.predict_tissue_labels(first, classifier, mask)
        b = visuals.predict_tissue_labels(second, classifier, mask)
        self.assertTrue(torch.equal(captured[0], captured[1]))
        resized = cv2.resize(mask[2:10, 2:10].astype(np.uint8), (64, 64), interpolation=cv2.INTER_NEAREST).astype(bool)
        self.assertEqual(torch.count_nonzero(captured[0][0, :, ~resized]).item(), 0)
        np.testing.assert_array_equal(a, b)
        self.assertTrue(np.all(a[~mask] == 0))

    def test_measurement_denominator_includes_unknown_but_not_skin(self):
        labels = np.array([[1, 2, 3, 0, 1, 1, 1, 1]], np.uint8)
        mask = np.array([[True, True, True, True, False, False, False, False]])
        result = visuals.count_wound_tissues(labels, mask)
        self.assertEqual(result["wound_area_pixels"], 4)
        self.assertEqual(result["tissue_percentages"], {"necrotic": 25, "slough": 25, "granulation": 25})
        self.assertEqual(result["unclassified_percentage"], 25)
        self.assertIsNone(visuals.count_wound_tissues(labels, np.zeros_like(mask))["tissue_percentages"])

    def test_empty_mask_has_no_tissue_overlay_pixels(self):
        with patch.object(visuals, "load_wound_model", return_value=FixedBinary(0.1)), \
             patch.object(visuals, "load_visual_model") as tissue_loader:
            result = visuals.build_pipeline_visuals(self.image_path, self.checkpoint, {"usable_for_demo": True}, 0)
        tissue_loader.assert_not_called()
        self.assertEqual(result["tissue_status"], "no_wound_pixels")
        self.assertFalse(decode(result["unet_segmentation_mask"])[..., 3].any())
        np.testing.assert_array_equal(decode(result["tissue_analysis_overlay"]), self.rgb[..., ::-1])

    def test_missing_tissue_weights_preserve_binary_isolation(self):
        with patch.object(visuals, "load_wound_model", return_value=FixedBinary(0.8)):
            result = visuals.build_pipeline_visuals(self.image_path, self.checkpoint,
                {"usable_for_demo": True}, 0, self.root / "missing.pt")
        self.assertEqual(result["status"], "available")
        self.assertEqual(result["tissue_status"], "unavailable")
        self.assertIsNotNone(result["unet_segmentation_mask"])
        self.assertIsNone(result["tissue_analysis_overlay"])

    def test_tissue_override_resolves_relative_to_repository(self):
        with patch.dict(visuals.os.environ, {"MEDIPASS_TISSUE_MODEL_PATH": "outputs/custom-tissue.pt"}), \
             patch.object(visuals, "load_wound_model", return_value=FixedBinary(0.8)), \
             patch.object(visuals, "load_visual_model", side_effect=FileNotFoundError) as loader:
            visuals.build_pipeline_visuals(self.image_path, self.checkpoint, {"usable_for_demo": True}, 0)
        loader.assert_called_once_with(visuals.ROOT / "outputs" / "custom-tissue.pt")

    def test_optional_dependency_failure_preserves_visual_contract(self):
        with patch.object(visuals, "load_wound_model", side_effect=ImportError):
            result = visuals.build_pipeline_visuals(self.image_path, self.checkpoint, {"usable_for_demo": True}, 0)
        self.assertEqual(result["status"], "unavailable")
        self.assertIsNone(result["unet_segmentation_mask"])
        self.assertIsNone(result["tissue_analysis_overlay"])
        self.assertEqual(base64.b64decode(result["original_image"]), self.image_path.read_bytes())


if __name__ == "__main__":
    unittest.main()
