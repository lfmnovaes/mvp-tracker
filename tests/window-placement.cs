using System;
using System.Drawing;
using System.Web.Script.Serialization;
class PlacementTests {
    static void Equal(Rectangle actual, Rectangle expected) { if (actual != expected) throw new Exception("Window placement regression: " + actual + " != " + expected); }
    static void Main() {
        var saved = new SavedWindow { Monitor = "DISPLAY2", X = -1800, Y = 100, Width = 1080, Height = 820, WorkX = -1920, WorkY = 0 };
        var serializer = new JavaScriptSerializer();
        saved = serializer.Deserialize<SavedWindow>(serializer.Serialize(saved));
        if (!saved.Valid()) throw new Exception("Round trip failed.");
        Equal(WindowPlacement.Restore(saved, new Rectangle(-1920, 0, 1920, 1040), true), new Rectangle(-1800, 100, 1080, 820));
        Equal(WindowPlacement.Restore(saved, new Rectangle(1920, 40, 1920, 1040), true), new Rectangle(2040, 140, 1080, 820));
        Equal(WindowPlacement.Restore(saved, new Rectangle(0, 0, 1280, 720), false), new Rectangle(100, 0, 1080, 720));
        saved.X = -500; saved.Y = 950;
        Equal(WindowPlacement.Restore(saved, new Rectangle(-1920, 0, 1280, 720), true), new Rectangle(-1720, 0, 1080, 720));
        saved.Width = -1; if (saved.Valid()) throw new Exception("Invalid dimensions accepted.");
        saved.Width = 1080; saved.X = Int32.MinValue; if (saved.Valid()) throw new Exception("Invalid coordinate accepted.");
        Console.WriteLine("Window placement checks passed.");
    }
}
