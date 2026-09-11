// Copyright 2026 Luis Fernando. SPDX-License-Identifier: AGPL-3.0-only
// Small Windows-only companion: tray, registered hotkeys, instance activation and lifetime.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

class ShellHost : Form {
    [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr h, int id, uint modifiers, uint key);
    [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr h, int id);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr data);
    delegate bool EnumProc(IntPtr h, IntPtr data);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, System.Text.StringBuilder text, int length);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int mode);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out Rect rect);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int height, uint flags);
    [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr process, int info, ref BasicInfo data, int size, IntPtr returned);
    [StructLayout(LayoutKind.Sequential)] struct BasicInfo { public IntPtr reserved, peb, reserved2, reserved3, pid, parent; }
    [StructLayout(LayoutKind.Sequential)] struct Rect { public int left, top, right, bottom; }
    readonly JavaScriptSerializer json = new JavaScriptSerializer();
    readonly Process backend, owner;
    readonly EventWaitHandle activation;
    readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
    readonly Dictionary<string, string> errors = new Dictionary<string, string>();
    readonly string[] actions = { "toggle", "add", "sync" };
    NotifyIcon tray;
    bool finishing;
    bool capturing;
    DateTime captureDeadline;
    Dictionary<string, object> savedKeys;
    int ticks;
    readonly string placementFile;
    bool placementRestored;
    bool restoreRequested;
    string lastPlacement;
    static readonly object outputLock = new object();
    static int ParentPid(Process process) {
        BasicInfo info = new BasicInfo();
        if (NtQueryInformationProcess(process.Handle, 0, ref info, Marshal.SizeOf(info), IntPtr.Zero) != 0) throw new Exception("parent-unavailable");
        return info.parent.ToInt32();
    }
    static Process FindOwner(Process backend) {
        Process candidate = Process.GetProcessById(ParentPid(backend));
        if (candidate.ProcessName.Equals("cmd", StringComparison.OrdinalIgnoreCase)) candidate = Process.GetProcessById(ParentPid(candidate));
        return candidate;
    }
    [STAThread] static void Main(string[] args) {
        if (args.Length != 2) return;
        SetProcessDpiAwarenessContext(new IntPtr(-4));
        Application.EnableVisualStyles();
        string scope = "Local\\MVPTracker-" + WindowsIdentity.GetCurrent().User.Value;
        bool created;
        using (Mutex mutex = new Mutex(true, scope, out created))
        using (EventWaitHandle activate = new EventWaitHandle(false, EventResetMode.AutoReset, scope + "-activate")) {
            if (!created) { activate.Set(); Console.WriteLine("{\"type\":\"duplicate\"}"); return; }
            try { using (ShellHost host = new ShellHost(int.Parse(args[0]), args[1], activate)) Application.Run(host); }
            catch { Console.WriteLine("{\"type\":\"fatal\"}"); }
            finally { mutex.ReleaseMutex(); }
        }
    }
    ShellHost(int backendPid, string icon, EventWaitHandle activate) {
        backend = Process.GetProcessById(backendPid); owner = FindOwner(backend); activation = activate;
        placementFile = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(icon), "..", "..", "data", "window.json"));
        ShowInTaskbar = false; FormBorderStyle = FormBorderStyle.None; Opacity = 0; Size = new Size(1, 1);
        // Force a stable message handle for registered hotkeys and the reader thread.
        IntPtr handle = Handle;
        try {
            tray = new NotifyIcon { Icon = new Icon(icon), Text = "MVP Tracker", Visible = true };
            ContextMenuStrip menu = new ContextMenuStrip();
            menu.Items.Add("Show MVP Tracker", null, delegate { Act("show"); });
            menu.Items.Add("Settings", null, delegate { Act("settings"); });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Exit", null, delegate { Emit(new { type = "action", action = "exit" }); });
            tray.ContextMenuStrip = menu;
            tray.DoubleClick += delegate { Act("show"); };
        } catch { if (tray != null) tray.Dispose(); tray = null; }
        timer.Interval = 250;
        timer.Tick += delegate {
            if (activation.WaitOne(0)) Act("show");
            if (capturing && DateTime.UtcNow > captureDeadline) { capturing = false; if (savedKeys != null) Configure(savedKeys); }
            if (++ticks % 4 == 0) {
                if (backend.HasExited || owner.HasExited) { Finish(true); return; }
                // Recover the titlebar after monitor changes; WinForms repairs the tray after TaskbarCreated.
                IntPtr window = Window();
                if (restoreRequested && window != IntPtr.Zero) Restore(window);
                if (placementRestored && window != IntPtr.Zero && !IsIconic(window)) {
                    if (IsWindowVisible(window)) Recover(window);
                    Remember(window);
                }
            }
        };
        timer.Start();
        new Thread(delegate() {
            try {
                string line;
                while ((line = Console.ReadLine()) != null) {
                    if (line.Length > 4096) continue;
                    string command = line;
                    BeginInvoke((Action)delegate { Receive(command); });
                }
            } catch { }
            try { BeginInvoke((Action)delegate { Finish(true); }); } catch { }
        }) { IsBackground = true }.Start();
        Emit(new { type = "ready", trayReady = tray != null, ownerPid = owner.Id });
    }
    protected override void SetVisibleCore(bool value) { base.SetVisibleCore(false); }
    IntPtr Window() {
        IntPtr found = IntPtr.Zero;
        EnumWindows(delegate(IntPtr h, IntPtr _) {
            uint pid; GetWindowThreadProcessId(h, out pid);
            if (pid != owner.Id) return true;
            System.Text.StringBuilder title = new System.Text.StringBuilder(128);
            GetWindowText(h, title, title.Capacity);
            // WebView2 creates additional untitled top-level windows in the same process.
            if (title.ToString() == "MVP Tracker") { found = h; return false; }
            return true;
        }, IntPtr.Zero);
        return found;
    }
    void Recover(IntPtr window) {
        Rect r; if (!GetWindowRect(window, out r)) return;
        // Neutralino parks its initializing WebView beyond x=9999 and uses that
        // position to restore its normal window styles. Moving it early breaks startup.
        if (r.left > 9999) return;
        Rectangle title = new Rectangle(r.left, r.top, Math.Max(1, r.right - r.left), 44);
        foreach (Screen screen in Screen.AllScreens) {
            Rectangle overlap = Rectangle.Intersect(screen.WorkingArea, title);
            if (overlap.Width >= 180 && overlap.Height >= 30) return;
        }
        Rectangle area = Screen.PrimaryScreen.WorkingArea;
        int width = Math.Min(r.right - r.left, area.Width), height = Math.Min(r.bottom - r.top, area.Height);
        SetWindowPos(window, IntPtr.Zero, area.Left + Math.Max(0, (area.Width - width) / 2), area.Top + Math.Max(0, (area.Height - height) / 2), width, height, 0x0014);
    }
    void Restore(IntPtr window) {
        Rect r;
        if (placementRestored || !GetWindowRect(window, out r) || r.left > 9999) return;
        placementRestored = true;
        try {
            if (!File.Exists(placementFile) || new FileInfo(placementFile).Length > 4096) return;
            SavedWindow saved = json.Deserialize<SavedWindow>(File.ReadAllText(placementFile));
            if (saved == null || !saved.Valid()) return;
            Screen monitor = Array.Find(Screen.AllScreens, s => s.DeviceName == saved.Monitor);
            Rectangle bounds = WindowPlacement.Restore(saved, (monitor ?? Screen.PrimaryScreen).WorkingArea, monitor != null);
            SetWindowPos(window, IntPtr.Zero, bounds.X, bounds.Y, bounds.Width, bounds.Height, 0x0014);
        } catch { Emit(new { type = "warning", message = "window-placement-unavailable" }); }
    }
    void Remember(IntPtr window) {
        Rect r;
        if (!placementRestored || window == IntPtr.Zero || IsIconic(window) || IsZoomed(window) || !GetWindowRect(window, out r)) return;
        Rectangle bounds = Rectangle.FromLTRB(r.left, r.top, r.right, r.bottom);
        Screen screen = Screen.FromRectangle(bounds);
        // Do not persist initialization/minimization coordinates or an invisible titlebar.
        Rectangle title = Rectangle.Intersect(screen.WorkingArea, new Rectangle(bounds.X, bounds.Y, bounds.Width, 44));
        if (title.Width < 180 || title.Height < 30) return;
        SavedWindow saved = new SavedWindow { Monitor = screen.DeviceName, X = bounds.X, Y = bounds.Y,
            Width = bounds.Width, Height = bounds.Height, WorkX = screen.WorkingArea.X, WorkY = screen.WorkingArea.Y };
        if (!saved.Valid()) return;
        string text = json.Serialize(saved);
        if (text == lastPlacement) return;
        try {
            Directory.CreateDirectory(Path.GetDirectoryName(placementFile));
            File.WriteAllText(placementFile + ".tmp", text);
            if (File.Exists(placementFile)) File.Replace(placementFile + ".tmp", placementFile, null);
            else File.Move(placementFile + ".tmp", placementFile);
            lastPlacement = text;
        } catch { Emit(new { type = "warning", message = "window-placement-unavailable" }); }
    }
    void Act(string action) {
        // Neutralino owns WebView visibility state. Do not bypass it with ShowWindow.
        Emit(new { type = "action", action = action });
    }
    void Configure(Dictionary<string, object> keys) {
        savedKeys = keys;
        errors.Clear();
        for (int i = 0; i < actions.Length; i++) UnregisterHotKey(Handle, i + 1);
        if (capturing) return;
        for (int i = 0; i < actions.Length; i++) {
            object value;
            if (!keys.TryGetValue(actions[i], out value) || String.IsNullOrEmpty(value as string)) continue;
            try {
                string[] parts = ((string)value).Split('+'); uint modifiers = 0x4000;
                for (int j = 0; j < parts.Length - 1; j++) {
                    if (parts[j] == "Ctrl") modifiers |= 2;
                    else if (parts[j] == "Alt") modifiers |= 1;
                    else if (parts[j] == "Shift") modifiers |= 4;
                    else throw new Exception();
                }
                Keys key = (Keys)Enum.Parse(typeof(Keys), parts[parts.Length - 1].Length == 1 && Char.IsDigit(parts[parts.Length - 1][0]) ? "D" + parts[parts.Length - 1] : parts[parts.Length - 1]);
                if (!RegisterHotKey(Handle, i + 1, modifiers, (uint)key)) errors[actions[i]] = "Unavailable: Windows or another application owns this shortcut.";
            } catch { errors[actions[i]] = "Invalid shortcut."; }
        }
        Emit(new { type = "hotkeys", errors = errors });
    }
    void Receive(string line) {
        try {
            Dictionary<string, object> data = json.Deserialize<Dictionary<string, object>>(line);
            string command = data["command"] as string;
            if (command == "exit") Finish(false);
            else if (command == "recover") { restoreRequested = true; IntPtr window = Window(); if (window != IntPtr.Zero) { Restore(window); Recover(window); Remember(window); } }
            else if (command == "remember") Remember(Window());
            else if (command == "capture") {
                capturing = (bool)data["active"]; captureDeadline = DateTime.UtcNow.AddSeconds(30);
                if (savedKeys != null) Configure(savedKeys);
            }
            else if (command == "configure") Configure((Dictionary<string, object>)data["hotkeys"]);
            else if (command == "show" || command == "hide" || command == "minimize" || command == "add" || command == "sync") Act(command);
        } catch { Emit(new { type = "warning", message = "invalid-command" }); }
    }
    protected override void WndProc(ref Message m) {
        if (m.Msg == 0x0312) { int id = m.WParam.ToInt32() - 1; if (id >= 0 && id < actions.Length) Act(actions[id]); }
        base.WndProc(ref m);
    }
    void Emit(object value) { lock (outputLock) { try { Console.WriteLine(json.Serialize(value)); Console.Out.Flush(); } catch { Finish(true); } } }
    void Finish(bool terminateOwner) {
        if (finishing) return; finishing = true; timer.Stop();
        Remember(Window());
        for (int i = 1; i <= actions.Length; i++) UnregisterHotKey(Handle, i);
        if (tray != null) { tray.Visible = false; tray.Dispose(); }
        if (terminateOwner) {
            try { if (!owner.HasExited) owner.Kill(); } catch { }
            try { if (!backend.HasExited) backend.Kill(); } catch { }
        }
        Application.ExitThread();
    }
    protected override void Dispose(bool disposing) { if (disposing) { timer.Dispose(); if (tray != null) tray.Dispose(); } base.Dispose(disposing); }
}
