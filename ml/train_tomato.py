import os
import json
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms, models
from torch.utils.data import DataLoader
from sklearn.metrics import accuracy_score, f1_score, confusion_matrix, precision_recall_fscore_support
from tqdm import tqdm

def train():
    dataset_path = r"c:\Users\anike\Desktop\Pccoe hackathon\Disease2\Tomato-Village-main\Variant-a(Multiclass Classification)"
    models_dir = os.path.join("ml", "models")
    os.makedirs(models_dir, exist_ok=True)
    
    device = torch.device("cpu")
    
    train_transform = transforms.Compose([
        transforms.RandomResizedCrop(224),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    val_transform = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    train_dir = os.path.join(dataset_path, "train")
    val_dir = os.path.join(dataset_path, "val")
    test_dir = os.path.join(dataset_path, "test")
    
    full_train = datasets.ImageFolder(train_dir, transform=train_transform)
    full_val = datasets.ImageFolder(val_dir, transform=val_transform)
    full_test = datasets.ImageFolder(test_dir, transform=val_transform)
    
    train_dataset = full_train
    val_dataset = full_val
    test_dataset = full_test
    
    train_loader = DataLoader(train_dataset, batch_size=16, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=16, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_dataset, batch_size=16, shuffle=False, num_workers=0)
    
    classes = full_train.classes
    class_to_idx = full_train.class_to_idx
    with open(os.path.join(models_dir, "tomato_classes.json"), "w") as f:
        json.dump(class_to_idx, f)
        
    model = models.efficientnet_b0(pretrained=True)
    for param in model.parameters():
        param.requires_grad = False
        
    num_ftrs = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(num_ftrs, len(classes))
    model = model.to(device)
    
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.classifier.parameters(), lr=0.001)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='max', factor=0.1, patience=1)
    
    def train_epoch(epoch):
        model.train()
        running_loss = 0.0
        for inputs, labels in tqdm(train_loader, desc=f"Epoch {epoch} Training"):
            inputs, labels = inputs.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * inputs.size(0)
        return running_loss / len(train_dataset)

    def val_epoch(epoch):
        model.eval()
        running_loss = 0.0
        all_preds = []
        all_labels = []
        with torch.no_grad():
            for inputs, labels in tqdm(val_loader, desc=f"Epoch {epoch} Validation"):
                inputs, labels = inputs.to(device), labels.to(device)
                outputs = model(inputs)
                loss = criterion(outputs, labels)
                running_loss += loss.item() * inputs.size(0)
                _, preds = torch.max(outputs, 1)
                all_preds.extend(preds.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())
        acc = accuracy_score(all_labels, all_preds)
        return running_loss / len(val_dataset), acc

    best_acc = 0.0
    
    print("Training classifier (backbone frozen)")
    for epoch in range(1, 4):
        train_loss = train_epoch(epoch)
        val_loss, val_acc = val_epoch(epoch)
        print(f"Epoch {epoch}: Train Loss {train_loss:.4f} | Val Loss {val_loss:.4f} | Val Acc {val_acc:.4f}")
        scheduler.step(val_acc)
        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), os.path.join(models_dir, "tomato_disease_efficientnet.pth"))

    print("Fine-tuning (unfreezing last 2 blocks)")
    # Unfreeze last blocks of features
    for name, param in model.features.named_parameters():
        if "7" in name or "8" in name:
            param.requires_grad = True
            
    optimizer = optim.Adam(filter(lambda p: p.requires_grad, model.parameters()), lr=0.0001)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='max', factor=0.1, patience=1)

    for epoch in range(4, 7):
        train_loss = train_epoch(epoch)
        val_loss, val_acc = val_epoch(epoch)
        print(f"Epoch {epoch}: Train Loss {train_loss:.4f} | Val Loss {val_loss:.4f} | Val Acc {val_acc:.4f}")
        scheduler.step(val_acc)
        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), os.path.join(models_dir, "tomato_disease_efficientnet.pth"))
            
    # Test Evaluation
    model.load_state_dict(torch.load(os.path.join(models_dir, "tomato_disease_efficientnet.pth")))
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
            
    precision, recall, f1, _ = precision_recall_fscore_support(test_labels, test_preds, labels=range(len(classes)))
    acc = accuracy_score(test_labels, test_preds)
    macro_f1 = f1_score(test_labels, test_preds, average='macro')
    cm = confusion_matrix(test_labels, test_preds)
    
    metrics = {
        "overall_accuracy": acc,
        "macro_f1": macro_f1,
        "per_class": {
            classes[i]: {
                "precision": precision[i],
                "recall": recall[i],
                "f1": f1[i]
            } for i in range(len(classes))
        },
        "confusion_matrix": cm.tolist()
    }
    
    with open(os.path.join(models_dir, "tomato_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=4)
        
    print(f"Test Accuracy: {acc:.4f}")
    print(f"Macro F1: {macro_f1:.4f}")
    print("Confusion Matrix:")
    print(cm)

if __name__ == "__main__":
    train()
