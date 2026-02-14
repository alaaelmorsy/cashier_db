# Fix index.html by removing old content (lines 1615 to 2420)

input_file = r'd:\program\copy\cashier\src\renderer\settings\index.html'

with open(input_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Keep lines 1-1614 (index 0-1613) and from line 2421 onwards (index 2420+)
new_lines = lines[:1614] + lines[2420:]

with open(input_file, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"Fixed! New line count: {len(new_lines)}")
