import os
import json
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, Subset
from sklearn.metrics import accuracy_score, f1_score, confusion_matrix, precision_recall_fscore_support
from tqdm import tqdm

class MaizeDataset(Dataset):
    def __init__(self, data_path, label_path):
        self.data = np.load(data_path).astype(np.float32) / 255.0
        # self.data shape is (N, 48, 48, 3) -> reshape to (N, 3, 48, 48) for PyTorch
        self.data = np.transpose(self.data, (0, 3, 1, 2))
        self.labels = np.load(label_path).astype(np.int64)
        
    def __len__(self):
        return len(self.labels)
        
    def __getitem__(self, idx):
        return torch.tensor(self.data[idx]), torch.tensor(self.labels[idx])

class SimpleCNN(nn.Module):
    def __init__(self):
        super(SimpleCNN, self).__init__()
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

def train():
    dataset_path = r"c:\Users\anike\Desktop\Pccoe hackathon\MaizeLeaf_dataset"
    models_dir = os.path.join("ml", "models")
    os.makedirs(models_dir, exist_ok=True)
    
    device = torch.device("cpu")
    print(f"Training Maize model on {device}")
    
    train_dataset = MaizeDataset(
        os.path.join(dataset_path, "trainData.npy"),
        os.path.join(dataset_path, "trainLabel.npy")
    )
    
    val_dataset = MaizeDataset(
        os.path.join(dataset_path, "valData.npy"),
        os.path.join(dataset_path, "valLabel.npy")
    )
    
    test_dataset = MaizeDataset(
        os.path.join(dataset_path, "testData.npy"),
        os.path.join(dataset_path, "testLabel.npy")
    )
    
    # Train for 2 epochs on full data
    train_loader = DataLoader(train_dataset, batch_size=64, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=64, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_dataset, batch_size=64, shuffle=False, num_workers=0)
    
    classes = {"0": "Healthy", "1": "Northern_Leaf_Blight", "2": "Common_Rust"}
    with open(os.path.join(models_dir, "maize_classes.json"), "w") as f:
        json.dump(classes, f)
        
    model = SimpleCNN().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    
    best_acc = 0.0
    metrics_history = {"train_loss": [], "val_acc": [], "val_f1": []}
    
    for epoch in range(1, 3):
        model.train()
        running_loss = 0.0
        for inputs, labels in tqdm(train_loader, desc=f"Epoch {epoch} Training"):
            inputs, labels = inputs.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item()
            
        print(f"Epoch {epoch} Loss: {running_loss / len(train_loader):.4f}")
        
        # Validation
        model.eval()
        all_preds = []
        all_labels = []
        with torch.no_grad():
            for inputs, labels in tqdm(val_loader, desc=f"Epoch {epoch} Validation"):
                inputs, labels = inputs.to(device), labels.to(device)
                outputs = model(inputs)
                _, preds = torch.max(outputs, 1)
                all_preds.extend(preds.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())
                
        val_acc = accuracy_score(all_labels, all_preds)
        val_f1 = f1_score(all_labels, all_preds, average="macro")
        print(f"Epoch {epoch} Val Acc: {val_acc:.4f}, Val F1: {val_f1:.4f}")
        
        metrics_history["train_loss"].append(running_loss / len(train_loader))
        metrics_history["val_acc"].append(float(val_acc))
        metrics_history["val_f1"].append(float(val_f1))
        
        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), os.path.join(models_dir, "maize_leaf_cnn.pth"))
            
    # Testing
    print("Evaluating on Test Set...")
    model.load_state_dict(torch.load(os.path.join(models_dir, "maize_leaf_cnn.pth")))
    model.eval()
    
    test_preds = []
    test_labels = []
    with torch.no_grad():
        for inputs, labels in tqdm(test_loader, desc="Testing"):
            inputs, labels = inputs.to(device), labels.to(device)
            outputs = model(inputs)
            _, preds = torch.max(outputs, 1)
            test_preds.extend(preds.cpu().numpy())
            test_labels.extend(labels.cpu().numpy())
            
    final_metrics = {
        "accuracy": float(accuracy_score(test_labels, test_preds)),
        "macro_f1": float(f1_score(test_labels, test_preds, average="macro")),
        "history": metrics_history
    }
    
    print("\nTest Results:")
    print(f"Accuracy: {final_metrics['accuracy']:.4f}")
    print(f"Macro F1: {final_metrics['macro_f1']:.4f}")
    
    with open(os.path.join(models_dir, "maize_metrics.json"), "w") as f:
        json.dump(final_metrics, f)

if __name__ == "__main__":
    train()
