#!/usr/bin/env python3
"""Dump full contents of a single sheet for deep inspection."""
import sys
from python_calamine import CalamineWorkbook

XLSX = "/Users/sbryankusno/Documents/Akamai-Migration/bryan/apps/daily-progress-tracker/Bryan's+Daily+Progress+2025-2026+(Intern).xlsx"
sheet_name = sys.argv[1] if len(sys.argv) > 1 else "August 2025"

wb = CalamineWorkbook.from_path(XLSX)
sh = wb.get_sheet_by_name(sheet_name).to_python()
print(f"# {sheet_name} — total rows={len(sh)}")
for i, r in enumerate(sh):
    if any(str(c).strip() for c in r):
        trimmed = [
            (str(c)[:60] + "…") if c and len(str(c)) > 60 else c
            for c in r[:12]
        ]
        print(f"r{i:3}: {trimmed}")
