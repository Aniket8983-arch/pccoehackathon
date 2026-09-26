import urllib.request, json

d = json.loads(urllib.request.urlopen('http://127.0.0.1:8000/api/grid').read())
cells = d['cells']
cell_map = {}
for c in cells:
    cell_map[f"{c['row']}_{c['col']}"] = c

rows, cols = 110, 105
visible_water = 0
visible_heat = 0
visible_disease = 0
total_with_data = 0

for r in range(rows):
    for c_idx in range(cols):
        key = f'{r}_{c_idx}'
        cell = cell_map.get(key)
        if cell:
            sw = cell.get('stress_water')
            sh = cell.get('stress_heat')
            sd = cell.get('stress_disease')
            if sw:
                total_with_data += 1
                if sw['score'] > 30:
                    visible_water += 1
            if sh and sh['score'] > 30:
                visible_heat += 1
            if sd and sd['score'] > 30:
                visible_disease += 1

print(f"Total cells with stress data: {total_with_data}")
print(f"Water > 30 (visible): {visible_water}")
print(f"Heat > 30 (visible): {visible_heat}")
print(f"Disease > 30 (visible): {visible_disease}")
print(f"Total terrain pixels: {rows*cols}")

# Check a specific high-score cell
high_cells = [c for c in cells if c.get('stress_water', {}).get('score', 0) > 80]
if high_cells:
    c = high_cells[0]
    print(f"\nSample critical cell: row={c['row']}, col={c['col']}, score={c['stress_water']['score']}")
