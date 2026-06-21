import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

export default function MokedIdEditor({ open, templateName, mappingId, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(mappingId || "").catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">מזהה מוקד — {templateName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm text-gray-500">
            המזהה הייחודי של המוקד לסנכרון בין סביבות. הוא זהה בכל הרשתות ואינו ניתן לשינוי.
          </p>

          {mappingId ? (
            <div className="flex gap-2 items-center">
              <code className="flex-1 bg-gray-100 rounded px-3 py-2 text-xs font-mono break-all select-all">
                {mappingId}
              </code>
              <Button size="icon" variant="outline" onClick={handleCopy} title="העתק מזהה">
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded px-3 py-2 text-xs text-yellow-800">
              מזהה טרם הוקצה — ייווצר אוטומטית בטעינה הבאה.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>סגור</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}