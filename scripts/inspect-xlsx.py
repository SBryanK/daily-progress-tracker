#!/usr/bin/env python3
"""
One-off inspection of Bryan's workbook. Prints per-sheet row count and
first 4 rows of each sheet so we can verify the parser coverage matches
reality (no hallucinated structure).
"""
import sys, json
from python_calamine import CalamineWorkbook

XLSX = "/Users/sbryankusno/Documents/Akamai-Migration/bryan/apps/daily-progress-tracker/Bryan's+Daily+Progress+2025-2026+(Intern).xlsx"

wb = CalamineWorkbook.from_path(XLSX)
print(f"Total sheets: {len(wb.sheet_names)}")
for name in wb.sheet_names:
    sh = wb.get_sheet_by_name(name).to_python()
    non_empty = sum(1 for r in sh if any(str(c).strip() for c in r))
    print(f"\n=== {name} === rows={len(sh)} (non-empty={non_empty})")
    for i, r in enumerate(sh[:6]):
        # trim very long strings for readability
        trimmed = [
            (str(c)[:40] + "…") if c and len(str(c)) > 40 else c
            for c in r[:14]
        ]
        print(f"  r{i}: {trimmed}")
