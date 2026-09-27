import json
import torch
import torch.nn as nn
from torchvision import transforms, models
import torch.nn.functional as F
import numpy as np
from PIL import Image, ImageStat


def _round2(val: float) -> float:
    """Round to 2 decimal places."""
    return round(float(val), 4)


def _get_level(conf: float) -> str:
    if conf >= 0.70:
        return "HIGH"
    elif conf >= 0.40:
        return "MODERATE"
    elif conf >= 0.15:
        return "LOW"
    else:
        return "NONE"


def _analyze_leaf_visual(image_pil: Image.Image) -> dict:
    """
    Analyze the leaf image visually using color channel statistics.
    Returns per-image water stress and heat stress indicators
    derived from actual pixel data — not from static weather metadata.
    
    Water stress indicators: wilting leaves show higher brown/yellow ratios,
    reduced green saturation, and lower overall brightness in the green channel.
    
    Heat stress indicators: heat-scorched leaves show high red-to-green ratio,
    increased warm-tone pixels, and reduced green vibrancy.
    """
    img = image_pil.copy().resize((224, 224))
    arr = np.array(img, dtype=np.float32)
    
    r_mean = arr[:, :, 0].mean()
    g_mean = arr[:, :, 1].mean()
    b_mean = arr[:, :, 2].mean()
    
    r_std = arr[:, :, 0].std()
    g_std = arr[:, :, 1].std()
    
    # --- Water stress from visual cues ---
    # Wilted/dry leaves: green channel drops, brown tones increase
    # Green dominance ratio: how much green vs. red+blue
    green_ratio = g_mean / (r_mean + g_mean + b_mean + 1e-6)
    # Healthy leaf: green_ratio ~ 0.38-0.42, stressed: < 0.33
    
    # Brown index: high red, low green, low blue
    brown_index = (r_mean - g_mean) / (r_mean + g_mean + 1e-6)
    # Healthy: brown_index < 0, brown/dry: > 0.05
    
    water_score = 0.0
    if green_ratio < 0.30:
        water_score += 0.40
    elif green_ratio < 0.34:
        water_score += 0.25
    elif green_ratio < 0.37:
        water_score += 0.10
    
    if brown_index > 0.10:
        water_score += 0.35
    elif brown_index > 0.05:
        water_score += 0.20
    elif brown_index > 0.0:
        water_score += 0.08
    
    # Low green std = uniform browning = more stress
    if g_std < 30:
        water_score += 0.15
    elif g_std < 45:
        water_score += 0.05
    
    water_score = min(water_score, 1.0)
    
    # --- Heat stress from visual cues ---
    # Heat-scorched: very high red, leaves turning yellow-brown
    # Yellow index: both red and green high, blue low
    yellow_index = ((r_mean + g_mean) / 2 - b_mean) / (r_mean + g_mean + b_mean + 1e-6)
    
    # Red dominance
    red_ratio = r_mean / (r_mean + g_mean + b_mean + 1e-6)
    
    heat_score = 0.0
    if red_ratio > 0.42:
        heat_score += 0.35
    elif red_ratio > 0.38:
        heat_score += 0.20
    elif red_ratio > 0.35:
        heat_score += 0.08
    
    if yellow_index > 0.25:
        heat_score += 0.30
    elif yellow_index > 0.18:
        heat_score += 0.15
    elif yellow_index > 0.12:
        heat_score += 0.05
    
    # Very bright overall = sun-bleached
    brightness = (r_mean + g_mean + b_mean) / 3
    if brightness > 180:
        heat_score += 0.15
    elif brightness > 160:
        heat_score += 0.05
    
    heat_score = min(heat_score, 1.0)
    
    return {
        "water_score": _round2(water_score),
        "heat_score": _round2(heat_score),
        "debug": {
            "green_ratio": _round2(green_ratio),
            "brown_index": _round2(brown_index),
            "red_ratio": _round2(red_ratio),
            "yellow_index": _round2(yellow_index),
            "brightness": _round2(brightness),
            "r_mean": _round2(r_mean),
            "g_mean": _round2(g_mean),
            "b_mean": _round2(b_mean),
        }
    }


# ── Tomato Model ──────────────────────────────────────────────────────

def load_tomato_model(model_path, classes_path):
    device = torch.device("cpu")
    with open(classes_path, "r") as f:
        class_to_idx = json.load(f)
    classes = {v: k for k, v in class_to_idx.items()}
    
    model = models.efficientnet_b0(pretrained=False)
    num_ftrs = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(num_ftrs, len(classes))
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.to(device)
    model.eval()
    
    transform = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    return model, classes, transform


def predict_tomato(model, image_pil, transform, classes):
    device = torch.device("cpu")
    image_tensor = transform(image_pil).unsqueeze(0).to(device)
    
    with torch.no_grad():
        outputs = model(image_tensor)
        probs = F.softmax(outputs, dim=1).cpu().numpy()[0]
        
    predictions = []
    for i, prob in enumerate(probs):
        predictions.append({"class": classes[i], "confidence": _round2(prob)})
        
    predictions.sort(key=lambda x: x["confidence"], reverse=True)
    top_class = predictions[0]["class"]
    top_conf = predictions[0]["confidence"]
    
    # Class groupings for stress mapping
    disease_classes = ["Early_blight", "Late_blight", "Spotted Wilt Virus"]
    pest_classes = ["Leaf Miner"]
    nutrient_classes = ["Magnesium Deficiency", "Nitrogen Deficiency", "Pottassium Deficiency"]
    
    # Accumulate probabilities per stress category across ALL classes
    disease_prob = sum(p["confidence"] for p in predictions if p["class"] in disease_classes)
    pest_prob = sum(p["confidence"] for p in predictions if p["class"] in pest_classes)
    nutrient_prob = sum(p["confidence"] for p in predictions if p["class"] in nutrient_classes)
    healthy_prob = sum(p["confidence"] for p in predictions if p["class"] == "Healthy")
    
    # Build stress dict with accumulated probabilities
    stress = {
        "disease": {
            "level": _get_level(disease_prob),
            "confidence": _round2(disease_prob),
            "possible_conditions": [p["class"].replace("_", " ") for p in predictions 
                                   if p["class"] in disease_classes and p["confidence"] > 0.05]
        },
        "nutrient": {
            "level": _get_level(nutrient_prob),
            "confidence": _round2(nutrient_prob),
            "possible_conditions": [p["class"].replace("_", " ") for p in predictions
                                   if p["class"] in nutrient_classes and p["confidence"] > 0.05]
        },
        "pest": {
            "level": _get_level(pest_prob),
            "confidence": _round2(pest_prob),
            "possible_conditions": [p["class"].replace("_", " ") for p in predictions
                                   if p["class"] in pest_classes and p["confidence"] > 0.05]
        }
    }
    
    # Visual analysis for water and heat stress (per-image, from pixel data)
    visual = _analyze_leaf_visual(image_pil)
    stress["water"] = {
        "level": _get_level(visual["water_score"]),
        "confidence": _round2(visual["water_score"]),
    }
    stress["heat"] = {
        "level": _get_level(visual["heat_score"]),
        "confidence": _round2(visual["heat_score"]),
    }
    
    # Detected condition label
    detected_condition = top_class.replace("_", " ")
    # Crop confidence = how confident we are this IS tomato (always high since
    # this model was trained on tomato images exclusively)
    # For the detected *condition*, use top_conf
    crop_confidence = _round2(top_conf)
    
    result = {
        "crop": {
            "name": "Tomato",
            "confidence": crop_confidence,
            "detected_condition": detected_condition,
        },
        "predictions": predictions,
        "stress": stress,
        "visual_analysis": visual.get("debug", {}),
    }
    return result


# ── Maize Model ───────────────────────────────────────────────────────

class SimpleCNNFixed(nn.Module):
    def __init__(self):
        super(SimpleCNNFixed, self).__init__()
        self.layer1 = nn.Sequential(
            nn.Conv2d(3, 32, 3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2)
        )
        self.layer2 = nn.Sequential(
            nn.Conv2d(32, 64, 3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d(2)
        )
        self.layer3 = nn.Sequential(
            nn.Conv2d(64, 128, 3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(),
            nn.AdaptiveMaxPool2d((1, 1))
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, 3)
        )
        
    def forward(self, x):
        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.classifier(x)
        return x


def load_maize_model(model_path, classes_path):
    device = torch.device("cpu")
    with open(classes_path, "r") as f:
        classes = json.load(f)
        
    model = SimpleCNNFixed()
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.to(device)
    model.eval()
    
    transform = transforms.Compose([
        transforms.Resize((48, 48)),
        transforms.ToTensor()
    ])
    
    return model, classes, transform


def predict_maize(model, image_pil, transform, classes):
    device = torch.device("cpu")
    image_tensor = transform(image_pil).unsqueeze(0).to(device)
    
    with torch.no_grad():
        outputs = model(image_tensor)
        probs = F.softmax(outputs, dim=1).cpu().numpy()[0]
        
    predictions = []
    for i, prob in enumerate(probs):
        predictions.append({"class": classes[str(i)], "confidence": _round2(prob)})
        
    predictions.sort(key=lambda x: x["confidence"], reverse=True)
    top_class = predictions[0]["class"]
    top_conf = predictions[0]["confidence"]
    
    # Maize classes: Healthy, Northern_Leaf_Blight, Common_Rust
    disease_classes = ["Northern_Leaf_Blight", "Common_Rust"]
    disease_prob = sum(p["confidence"] for p in predictions if p["class"] in disease_classes)
    healthy_prob = sum(p["confidence"] for p in predictions if p["class"] == "Healthy")
    
    stress = {
        "disease": {
            "level": _get_level(disease_prob),
            "confidence": _round2(disease_prob),
            "possible_conditions": [p["class"].replace("_", " ") for p in predictions 
                                   if p["class"] in disease_classes and p["confidence"] > 0.05]
        },
        "nutrient": {"level": "NONE", "confidence": 0.0},
        "pest": {"level": "NONE", "confidence": 0.0},
    }
    
    # Visual analysis for water and heat stress
    visual = _analyze_leaf_visual(image_pil)
    stress["water"] = {
        "level": _get_level(visual["water_score"]),
        "confidence": _round2(visual["water_score"]),
    }
    stress["heat"] = {
        "level": _get_level(visual["heat_score"]),
        "confidence": _round2(visual["heat_score"]),
    }
    
    detected_condition = top_class.replace("_", " ")
    
    result = {
        "crop": {
            "name": "Maize",
            "confidence": _round2(top_conf),
            "detected_condition": detected_condition,
        },
        "predictions": predictions,
        "stress": stress,
        "visual_analysis": visual.get("debug", {}),
    }
    return result
