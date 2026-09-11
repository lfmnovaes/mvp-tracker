// Copyright 2026 Luis Fernando. SPDX-License-Identifier: AGPL-3.0-only
using System;
using System.Drawing;

public class SavedWindow {
    public int Version = 1;
    public string Monitor;
    public int X, Y, Width, Height, WorkX, WorkY;
    public bool Valid() {
        return Version == 1 && !String.IsNullOrEmpty(Monitor) && Monitor.Length <= 128
            && Math.Abs((long)X) <= 100000 && Math.Abs((long)Y) <= 100000
            && Math.Abs((long)WorkX) <= 100000 && Math.Abs((long)WorkY) <= 100000
            && Width >= 320 && Height >= 240 && Width <= 32768 && Height <= 32768;
    }
}
public static class WindowPlacement {
    // Coordinates are physical pixels; preserve offsets when a monitor is rearranged.
    public static Rectangle Restore(SavedWindow saved, Rectangle area, bool sameMonitor) {
        int width = Math.Min(saved.Width, area.Width), height = Math.Min(saved.Height, area.Height);
        int x = sameMonitor ? area.Left + saved.X - saved.WorkX : area.Left + (area.Width - width) / 2;
        int y = sameMonitor ? area.Top + saved.Y - saved.WorkY : area.Top + (area.Height - height) / 2;
        return new Rectangle(Math.Max(area.Left, Math.Min(x, area.Right - width)),
            Math.Max(area.Top, Math.Min(y, area.Bottom - height)), width, height);
    }
}
